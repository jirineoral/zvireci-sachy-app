/**
 * "Hrát s kamarádem" (Phase 20, R10): the browser side of the relay in `worker/`.
 *
 * A game is a room: 12 random base32 characters made up by the host's browser and put in
 * the link's fragment (`#hra=<id>`, never sent to the Pages host or the analytics; dropped
 * from the address bar once read). Each player is known to the room only by a random
 * token their browser keeps in `localStorage` (`skm.friend`, one room, forgotten after
 * 24 h or on `Odejít`; `sessionStorage` when `localStorage` is blocked) so a reload — or
 * the link opened again in a fresh tab — returns to the same seat. The room forwards SAN
 * moves, checks them with chess.js and keeps the move list for 24 h; chess.js on both
 * ends decides what is legal too. Nothing here is a name, an account or a cookie.
 *
 * The socket is kept honest: an app-level ping every 25 s (answered by the relay's
 * runtime without waking the room) and a missed pong forces a reconnect, as do the page
 * becoming visible again and the network coming back. The room answers every reconnect
 * with its full `state`; a move of ours it has not seen is sent again then (friend-panel).
 */
import type { Color } from 'chess.js';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SESSION_KEY = 'skm.friend';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // the room's own lifetime
const ROOM_ID = /^[a-z2-7]{12}$/;
const TOKEN = /^[a-z2-7]{16,32}$/;
const SAN = /^[A-Za-z0-9=+#-]{2,10}$/;
const MAX_SANS = 1000;
const RECONNECT_MS = [1000, 2000, 4000, 8000, 16000, 30000];
/** After a `rate` close the first retry waits this long (the flood guard is per second). */
const RATE_BACKOFF_MS = 3000;
/** Keep-alive: the relay's runtime answers PING with PONG itself (worker/src/index.ts). */
const PING = '{"t":"ping"}';
const PONG = '{"t":"pong"}';
const PING_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
/** After the page comes back to the foreground: a quicker verdict on the socket. */
const WAKE_PONG_TIMEOUT_MS = 4_000;

/** Where the relay lives; the CSP `connect-src` in vite.config.ts allows exactly this origin. */
export const FRIEND_WS: string = __FRIEND_WS__;

export type ServerMessage =
  /** `rematch` = seats that asked for a rematch of this game (relay since 2026-09-26; absent from an older relay). */
  | { t: 'state'; seat: Color; sans: string[]; game: number; peer: boolean; rematch?: Color[] }
  | { t: 'move'; san: string; ply: number }
  | { t: 'peer'; online: boolean }
  | { t: 'rematch'; from: Color }
  /** No seat for our token; `taken` = we had one and another link-holder took it while we were away. */
  | { t: 'full'; taken: boolean }
  | { t: 'error'; msg: string };

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** A move of ours the room has not confirmed yet (it comes back in `state` or the friend answers it). */
export interface PendingMove {
  san: string;
  ply: number;
  game: number;
}

export interface FriendSession {
  room: string;
  token: string;
  /** The host's colour preference for the first game (the guest has none). */
  pref?: Color | 'random';
  /** When the session was made; older than 24 h = gone with the room (the room itself lives 24 h from its last message, so a stored session never outlives its room). */
  at: number;
  /** Last `state`/move seen. A reload rejoins only within REJOIN_MS of this — on a shared PC the next child should not land in the previous one's game. */
  seen: number;
  /** Our last move until the room is known to have it; kept across a reload so a checkmate played offline still reaches the room. */
  pending?: PendingMove;
}

export const REJOIN_MS = 2 * 60 * 60 * 1000;

const isColor = (v: unknown): v is Color => v === 'w' || v === 'b';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Shape check of what the room sends; anything else is dropped (the room is ours, but the other seat is not). */
export function isServerMessage(v: unknown): v is ServerMessage {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  switch (m.t) {
    case 'state':
      return (
        isColor(m.seat) &&
        isInt(m.game) &&
        typeof m.peer === 'boolean' &&
        Array.isArray(m.sans) &&
        m.sans.length <= MAX_SANS &&
        m.sans.every((s) => typeof s === 'string' && SAN.test(s)) &&
        (m.rematch === undefined || (Array.isArray(m.rematch) && m.rematch.length <= 2 && m.rematch.every(isColor)))
      );
    case 'move':
      return typeof m.san === 'string' && SAN.test(m.san) && isInt(m.ply);
    case 'peer':
      return typeof m.online === 'boolean';
    case 'rematch':
      return isColor(m.from);
    case 'full':
      return typeof m.taken === 'boolean';
    case 'error':
      return typeof m.msg === 'string' && m.msg.length <= 100;
    default:
      return false;
  }
}

export interface FriendEvents {
  onMessage: (msg: ServerMessage) => void;
  /**
   * `reason` for 'closed': why the room or we ended it (`full`, `taken`, `replaced`,
   * `expired`, `policy`, `unavailable`, `leave`); for 'reconnecting': `rate` when the room
   * closed us for sending too fast (the seat stays ours).
   */
  onConnection: (state: Connection, reason?: string) => void;
}

export interface FriendClient {
  readonly session: FriendSession;
  /** Sends when the socket is open; otherwise nothing (the caller keeps a move pending and sends it again after `state`). */
  send(msg: { t: 'move'; san: string; ply: number } | { t: 'rematch' }): void;
  /** Drops the socket and opens a new one at once: the room answers with `state`, which re-syncs the board. */
  resync(): void;
  /** Deliberate leave: tells the room (the seat is freed), no reconnect. */
  close(): void;
}

export function randomId(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

export function isRoomId(id: string): boolean {
  return ROOM_ID.test(id);
}

/** The room id in the page's fragment (`#hra=abc…`), if any. */
export function roomFromLocation(hash: string): string | null {
  const m = /^#hra=([a-z2-7]{12})$/.exec(hash);
  return m ? m[1] : null;
}

export function roomLink(room: string): string {
  return `${location.origin}${location.pathname}#hra=${room}`;
}

/**
 * Where the seat token lives: `localStorage` when it can be written, else this tab's
 * `sessionStorage` (Safari private mode, blocked site data) — a reload in the same tab
 * still rejoins. Null only when both are unusable.
 */
export function friendStorage(local: Storage | null): Storage | null {
  const candidates: (() => Storage | null)[] = [() => local, () => window.sessionStorage];
  for (const get of candidates) {
    try {
      const s = get();
      if (!s) continue;
      s.setItem(`${SESSION_KEY}.probe`, '1');
      s.removeItem(`${SESSION_KEY}.probe`);
      return s;
    } catch {
      // blocked or full: try the next one
    }
  }
  return null;
}

function readPending(v: unknown): PendingMove | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  return typeof p.san === 'string' && SAN.test(p.san) && isInt(p.ply) && isInt(p.game) ? { san: p.san, ply: p.ply, game: p.game } : undefined;
}

export function readSession(storage: Storage | null): FriendSession | null {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<FriendSession>;
    if (typeof v.room !== 'string' || !ROOM_ID.test(v.room) || typeof v.token !== 'string' || !TOKEN.test(v.token)) return null;
    if (!isInt(v.at) || Date.now() - v.at > SESSION_TTL_MS) return null;
    const seen = isInt(v.seen) ? v.seen : v.at;
    const pref = v.pref === 'w' || v.pref === 'b' || v.pref === 'random' ? v.pref : undefined;
    return { room: v.room, token: v.token, pref, at: v.at, seen, pending: readPending(v.pending) };
  } catch {
    return null;
  }
}

export function writeSession(storage: Storage | null, session: FriendSession | null): void {
  try {
    if (session === null) storage?.removeItem(SESSION_KEY);
    else storage?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Could not persist the friend session', err);
  }
}

/** Marks the session as live now (a `state` or a move arrived). */
export function touchSession(storage: Storage | null, session: FriendSession): void {
  session.seen = Date.now();
  writeSession(storage, session);
}

/** A session for a room: the stored one when it is for this room, otherwise a fresh token. */
export function sessionFor(storage: Storage | null, room: string, pref?: Color | 'random'): FriendSession {
  const stored = readSession(storage);
  if (stored && stored.room === room) return stored;
  const now = Date.now();
  const session: FriendSession = { room, token: randomId(20), pref, at: now, seen: now };
  writeSession(storage, session);
  return session;
}

/** Close reasons after which reconnecting is pointless (the room said so, or we left). */
const FINAL_REASONS = new Set(['full', 'taken', 'replaced', 'expired', 'policy', 'leave']);

/**
 * Opens the socket and keeps it open: a drop reconnects with backoff and says `hello`
 * again with the same token; the room answers with the full state each time.
 */
export function connectFriend(session: FriendSession, events: FriendEvents): FriendClient {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let closed = false;
  let finished = false;
  let timer: number | null = null; // the next reconnect
  let pingTimer: number | null = null;
  let pongTimer: number | null = null; // armed while a ping is unanswered

  const stopKeepAlive = (): void => {
    if (pingTimer !== null) window.clearInterval(pingTimer);
    if (pongTimer !== null) window.clearTimeout(pongTimer);
    pingTimer = pongTimer = null;
  };

  /** Pings now; no answer (nor any other message) within `timeout` = the socket is dead, reconnect. */
  const ping = (timeout: number): void => {
    const sock = ws;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    try {
      sock.send(PING);
    } catch {
      // the close event follows
    }
    if (pongTimer !== null) window.clearTimeout(pongTimer);
    pongTimer = window.setTimeout(() => {
      pongTimer = null;
      if (ws === sock) {
        console.warn('Relay did not answer the ping — reconnecting');
        reconnectNow();
      }
    }, timeout);
  };

  /** Drops the current socket (if any) and connects again without waiting for backoff. */
  const reconnectNow = (): void => {
    if (closed) return;
    stopKeepAlive();
    const sock = ws;
    ws = null; // the close handler ignores a socket that is no longer ours
    try {
      sock?.close(1000, 'resync');
    } catch {
      // already closing
    }
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    attempt = 0;
    open();
  };

  const onVisible = (): void => {
    if (closed || document.visibilityState !== 'visible') return;
    // A phone that slept may hold a socket that looks open but is dead: test it at once.
    if (ws && ws.readyState === WebSocket.OPEN) ping(WAKE_PONG_TIMEOUT_MS);
    else if (!ws || ws.readyState !== WebSocket.CONNECTING) reconnectNow();
  };
  /** The network came back (Wi-Fi → LTE…): the old socket rode on the old route. */
  const onOnline = (): void => reconnectNow();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);

  const open = (): void => {
    if (closed) return;
    events.onConnection(attempt === 0 ? 'connecting' : 'reconnecting');
    let sock: WebSocket;
    try {
      sock = new WebSocket(`${FRIEND_WS}/r/${session.room}`);
    } catch (err) {
      console.error('WebSocket refused', err);
      finish('unavailable');
      return;
    }
    ws = sock;
    sock.addEventListener('open', () => {
      if (ws !== sock) return;
      attempt = 0;
      sock.send(JSON.stringify({ t: 'hello', token: session.token, pref: session.pref }));
      events.onConnection('open');
      stopKeepAlive();
      pingTimer = window.setInterval(() => ping(PONG_TIMEOUT_MS), PING_MS);
    });
    sock.addEventListener('message', (e) => {
      if (ws !== sock) return;
      // Any message proves the socket alive.
      if (pongTimer !== null) window.clearTimeout(pongTimer);
      pongTimer = null;
      if (e.data === PONG) return;
      if (typeof e.data !== 'string' || e.data.length > 20_000) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!isServerMessage(parsed)) {
        if ((parsed as { t?: unknown } | null)?.t !== 'pong') console.warn('Relay message dropped (unexpected shape)');
        return;
      }
      const msg = parsed;
      if (msg.t === 'full') closed = true; // the room refused us: no point retrying
      events.onMessage(msg);
    });
    sock.addEventListener('close', (e) => {
      if (ws !== sock) return;
      ws = null;
      stopKeepAlive();
      if (closed || FINAL_REASONS.has(e.reason)) {
        finish(e.reason);
        return;
      }
      // `rate`: the room's flood guard (we sent too fast) — not a ban, the seat stays ours.
      const delay = e.reason === 'rate' ? Math.max(RATE_BACKOFF_MS, RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)]) : RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)];
      attempt++;
      events.onConnection('reconnecting', e.reason === 'rate' ? 'rate' : undefined);
      timer = window.setTimeout(open, delay);
    });
    sock.addEventListener('error', () => {
      // `close` follows and schedules the retry
    });
  };

  /** No more reconnects: listeners off, the panel told why. */
  const finish = (reason: string): void => {
    if (finished) return;
    finished = true;
    closed = true;
    stopKeepAlive();
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    events.onConnection('closed', reason);
  };

  open();

  return {
    session,
    send(msg) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    resync() {
      reconnectNow();
    },
    close() {
      if (finished) return;
      closed = true;
      const sock = ws;
      ws = null;
      if (sock && sock.readyState === WebSocket.OPEN) {
        try {
          sock.send(JSON.stringify({ t: 'leave' })); // the room frees the seat and closes
        } catch {
          // closing anyway
        }
      }
      sock?.close(1000, 'leave');
      finish('leave');
    },
  };
}
