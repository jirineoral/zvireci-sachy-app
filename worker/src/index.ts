/**
 * Relay for "Hrát s kamarádem" (Phase 20, docs/phase-20-plan.md).
 *
 * One Durable Object per game ("room"). Two seats, white and black; a player is known
 * only by a random token their browser made up (so a reload reconnects to the same
 * seat). The room stores the move list (SAN) and the seat tokens, forwards moves, and
 * deletes itself 24 h after the last message. It validates turn order and message
 * shape, not chess rules — both browsers run chess.js and reject an illegal SAN.
 *
 * Nothing about the players is kept: no names, no cookies, no logs (observability is
 * off in wrangler.toml). The edge sees the two IP addresses while a socket is open.
 */
import { DurableObject } from 'cloudflare:workers';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
}

type Seat = 'w' | 'b';
type Pref = 'w' | 'b' | 'random';

/** Client → room. */
type ClientMessage =
  | { t: 'hello'; token: string; pref?: Pref }
  | { t: 'move'; san: string; ply: number }
  | { t: 'rematch' }
  | { t: 'leave' };

/** Room → client. */
type ServerMessage =
  | { t: 'state'; seat: Seat; sans: string[]; game: number; peer: boolean }
  | { t: 'move'; san: string; ply: number }
  | { t: 'peer'; online: boolean }
  | { t: 'rematch'; from: Seat }
  | { t: 'full' }
  | { t: 'error'; msg: string };

interface Attachment {
  token: string;
  seat: Seat;
}

const TOKEN = /^[a-z2-7]{16,32}$/;
const SAN = /^[A-Za-z0-9=+#-]{2,10}$/; // e.g. e4, Nxf7+, O-O-O, e8=Q#
const MAX_MESSAGE_CHARS = 200; // UTF-16 units; the accepted grammar is ASCII anyway
const MAX_MESSAGES_PER_SECOND = 10;
const MAX_PLIES = 1000;
const IDLE_MS = 24 * 60 * 60 * 1000;
/** A seat whose player has had no socket open for this long may be taken by a new token (the link opened in a fresh tab). */
const SEAT_RECLAIM_MS = 60 * 1000;
/** Only the app's own origins may open a socket (no embedding of the relay by other sites). */
const ORIGINS = new Set(['https://zvirecisachy.cz', 'https://www.zvirecisachy.cz', 'https://dev.zvirecisachy.cz', 'http://localhost:5173', 'http://127.0.0.1:5173']);

/** Seat tokens and when each seat's last socket closed (absent = a socket is open or it never connected). */
interface Seats {
  w?: string;
  b?: string;
  wClosed?: number;
  bClosed?: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = /^\/r\/([a-z2-7]{12})$/.exec(url.pathname);
    if (!m) return new Response(null, { status: url.pathname === '/' ? 204 : 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
    const origin = request.headers.get('Origin') ?? '';
    if (!ORIGINS.has(origin)) return new Response('Forbidden', { status: 403 });
    const id = env.ROOMS.idFromName(m[1]);
    return env.ROOMS.get(id).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class Room extends DurableObject<Env> {
  /** Per-socket rate limit window; lost on hibernation, which is fine. */
  private rate = new WeakMap<WebSocket, { second: number; n: number }>();

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_CHARS || this.overRate(ws)) {
      ws.close(1008, 'policy');
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      ws.close(1008, 'policy');
      return;
    }
    const att = this.attachment(ws);
    if (msg.t === 'hello') return this.hello(ws, att, msg);
    if (!att) {
      ws.close(1008, 'hello first');
      return;
    }
    await this.touch();
    if (msg.t === 'move') return this.move(ws, att, msg);
    if (msg.t === 'rematch') return this.rematch(ws, att);
    if (msg.t === 'leave') return this.leave(ws, att);
    ws.close(1008, 'policy');
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = this.attachment(ws);
    if (!att) return;
    // A replaced tab closing must not report the player offline while their new socket is open.
    if (this.seatOnline(att.seat, ws)) return;
    const seats = (await this.ctx.storage.get<Seats>('seats')) ?? {};
    if (seats[att.seat] === att.token) {
      seats[`${att.seat}Closed`] = Date.now();
      await this.ctx.storage.put('seats', seats);
    }
    this.sendToOthers(ws, att.seat, { t: 'peer', online: false });
  }

  /** The room lives 24 h after the last valid message. */
  private touch(): Promise<void> {
    return this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    return this.webSocketClose(ws);
  }

  /** 24 h after the last message: the game is gone. */
  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) ws.close(1001, 'expired');
    await this.ctx.storage.deleteAll();
  }

  private async hello(ws: WebSocket, current: Attachment | null, msg: { token: string; pref?: Pref }): Promise<void> {
    if (typeof msg.token !== 'string' || !TOKEN.test(msg.token) || (current !== null && current.token !== msg.token)) {
      ws.close(1008, 'policy'); // one browser, one seat
      return;
    }
    const seats = (await this.ctx.storage.get<Seats>('seats')) ?? {};
    let seat = (['w', 'b'] as Seat[]).find((s) => seats[s] === msg.token);
    if (!seat) {
      // Free = never taken, or taken by a player who has been gone for a while (the link
      // opened again in a fresh tab has a fresh token; the old tab is gone).
      const now = Date.now();
      const free = (['w', 'b'] as Seat[]).filter((s) => {
        if (!seats[s]) return true;
        const closed = seats[`${s}Closed`];
        return closed !== undefined && now - closed > SEAT_RECLAIM_MS && !this.seatOnline(s, ws);
      });
      if (free.length === 0) {
        this.send(ws, { t: 'full' });
        ws.close(1000, 'full');
        return;
      }
      if (!seats.w && !seats.b) {
        // The host: their preference decides; the guest takes what is left.
        seat = msg.pref === 'w' || msg.pref === 'b' ? msg.pref : Math.random() < 0.5 ? 'w' : 'b';
      } else {
        seat = free[0];
      }
      seats[seat] = msg.token;
    }
    delete seats[`${seat}Closed`];
    await this.ctx.storage.put('seats', seats);
    await this.touch();
    // One live socket per seat: an older tab of the same player is closed.
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && this.attachment(other)?.token === msg.token) other.close(1000, 'replaced');
    }
    ws.serializeAttachment({ token: msg.token, seat } satisfies Attachment);
    const sans = (await this.ctx.storage.get<string[]>('sans')) ?? [];
    const game = (await this.ctx.storage.get<number>('game')) ?? 1;
    this.send(ws, { t: 'state', seat, sans, game, peer: this.peerOnline(ws, seat) });
    this.sendToOthers(ws, seat, { t: 'peer', online: true });
  }

  private async move(ws: WebSocket, att: Attachment, msg: { san: string; ply: number }): Promise<void> {
    const sans = (await this.ctx.storage.get<string[]>('sans')) ?? [];
    const turn: Seat = sans.length % 2 === 0 ? 'w' : 'b';
    if (typeof msg.san !== 'string' || !SAN.test(msg.san) || !Number.isInteger(msg.ply) || msg.ply !== sans.length || turn !== att.seat || sans.length >= MAX_PLIES) {
      this.send(ws, { t: 'error', msg: 'move refused' });
      return;
    }
    sans.push(msg.san);
    await this.ctx.storage.put('sans', sans);
    await this.ctx.storage.delete('rematch');
    this.sendToOthers(ws, att.seat, { t: 'move', san: msg.san, ply: msg.ply });
  }

  /** Both players ask → the move list is cleared and the colours swap. */
  private async rematch(ws: WebSocket, att: Attachment): Promise<void> {
    const wanted = (await this.ctx.storage.get<Seat[]>('rematch')) ?? [];
    if (!wanted.includes(att.seat)) wanted.push(att.seat);
    if (wanted.length < 2) {
      await this.ctx.storage.put('rematch', wanted);
      this.sendToOthers(ws, att.seat, { t: 'rematch', from: att.seat });
      return;
    }
    const seats = (await this.ctx.storage.get<Seats>('seats')) ?? {};
    const swapped: Seats = { w: seats.b, b: seats.w, wClosed: seats.bClosed, bClosed: seats.wClosed };
    const game = ((await this.ctx.storage.get<number>('game')) ?? 1) + 1;
    await this.ctx.storage.put({ seats: swapped, sans: [], game });
    await this.ctx.storage.delete('rematch');
    const swappedSeats: [WebSocket, Seat][] = [];
    for (const sock of this.ctx.getWebSockets()) {
      const a = this.attachment(sock);
      if (!a) continue;
      const seat: Seat = a.seat === 'w' ? 'b' : 'w';
      sock.serializeAttachment({ token: a.token, seat } satisfies Attachment);
      swappedSeats.push([sock, seat]);
    }
    // All seats swapped first, then told — `peer` looks at the other socket's new seat.
    for (const [sock, seat] of swappedSeats) this.send(sock, { t: 'state', seat, sans: [], game, peer: this.peerOnline(sock, seat) });
  }

  /** `Odejít`: the seat is free at once for whoever opens the link next. */
  private async leave(ws: WebSocket, att: Attachment): Promise<void> {
    const seats = (await this.ctx.storage.get<Seats>('seats')) ?? {};
    if (seats[att.seat] === att.token) {
      delete seats[att.seat];
      delete seats[`${att.seat}Closed`];
      await this.ctx.storage.put('seats', seats);
    }
    ws.serializeAttachment(null);
    this.sendToOthers(ws, att.seat, { t: 'peer', online: false });
    ws.close(1000, 'leave');
  }

  /** Another open socket (not `except`) holds this seat. */
  private seatOnline(seat: Seat, except: WebSocket): boolean {
    return this.ctx.getWebSockets().some((s) => s !== except && this.attachment(s)?.seat === seat);
  }

  private attachment(ws: WebSocket): Attachment | null {
    return (ws.deserializeAttachment() as Attachment | null) ?? null;
  }

  private peerOnline(ws: WebSocket, seat: Seat): boolean {
    return this.ctx.getWebSockets().some((s) => {
      const a = s !== ws ? this.attachment(s) : null;
      return a !== null && a.seat !== seat;
    });
  }

  private sendToOthers(ws: WebSocket, seat: Seat, msg: ServerMessage): void {
    for (const sock of this.ctx.getWebSockets()) {
      if (sock === ws) continue;
      const a = this.attachment(sock);
      if (a && a.seat !== seat) this.send(sock, msg);
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // closed meanwhile
    }
  }

  private overRate(ws: WebSocket): boolean {
    const second = Math.floor(Date.now() / 1000);
    const r = this.rate.get(ws);
    if (!r || r.second !== second) {
      this.rate.set(ws, { second, n: 1 });
      return false;
    }
    r.n++;
    return r.n > MAX_MESSAGES_PER_SECOND;
  }
}
