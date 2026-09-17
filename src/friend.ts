/**
 * "Hrát s kamarádem" (Phase 20, R10): the browser side of the relay in `worker/`.
 *
 * A game is a room: 12 random base32 characters made up by the host's browser and put in
 * the link's fragment (`#hra=<id>`, never sent to the Pages host or the analytics). Each
 * player is known to the room only by a random token their browser keeps in
 * `sessionStorage` (`skm.friend`) so a reload reconnects to the same seat. The room
 * forwards SAN moves and keeps the move list for 24 h; chess.js on both ends decides what
 * is legal. Nothing here is a name, an account or a cookie.
 */
import type { Color } from 'chess.js';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SESSION_KEY = 'skm.friend';
const ROOM_ID = /^[a-z2-7]{12}$/;
const RECONNECT_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/** Where the relay lives; the CSP `connect-src` in vite.config.ts allows exactly this origin. */
export const FRIEND_WS: string = __FRIEND_WS__;

export type ServerMessage =
  | { t: 'state'; seat: Color; sans: string[]; game: number; peer: boolean }
  | { t: 'move'; san: string; ply: number }
  | { t: 'peer'; online: boolean }
  | { t: 'rematch'; from: Color }
  | { t: 'full' }
  | { t: 'error'; msg: string };

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface FriendSession {
  room: string;
  token: string;
  /** The host's colour preference for the first game (the guest has none). */
  pref?: Color | 'random';
}

export interface FriendEvents {
  onMessage: (msg: ServerMessage) => void;
  onConnection: (state: Connection, reason?: string) => void;
}

export interface FriendClient {
  readonly session: FriendSession;
  send(msg: { t: 'move'; san: string; ply: number } | { t: 'rematch' }): void;
  /** Deliberate leave: no reconnect, the session is forgotten. */
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

export function readSession(storage: Storage | null): FriendSession | null {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<FriendSession>;
    if (typeof v.room !== 'string' || !ROOM_ID.test(v.room) || typeof v.token !== 'string' || !/^[a-z2-7]{16,32}$/.test(v.token)) return null;
    return { room: v.room, token: v.token, pref: v.pref === 'w' || v.pref === 'b' || v.pref === 'random' ? v.pref : undefined };
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

/** A session for a room: the stored one when it is for this room, otherwise a fresh token. */
export function sessionFor(storage: Storage | null, room: string, pref?: Color | 'random'): FriendSession {
  const stored = readSession(storage);
  if (stored && stored.room === room) return stored;
  const session: FriendSession = { room, token: randomId(20), pref };
  writeSession(storage, session);
  return session;
}

/**
 * Opens the socket and keeps it open: a drop reconnects with backoff and says `hello`
 * again with the same token; the room answers with the full state each time.
 */
export function connectFriend(session: FriendSession, events: FriendEvents): FriendClient {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let closed = false;
  let timer: number | null = null;

  const open = (): void => {
    if (closed) return;
    events.onConnection(attempt === 0 ? 'connecting' : 'reconnecting');
    let sock: WebSocket;
    try {
      sock = new WebSocket(`${FRIEND_WS}/r/${session.room}`);
    } catch (err) {
      console.error('WebSocket refused', err);
      events.onConnection('closed', 'unavailable');
      return;
    }
    ws = sock;
    sock.addEventListener('open', () => {
      attempt = 0;
      sock.send(JSON.stringify({ t: 'hello', token: session.token, pref: session.pref }));
      events.onConnection('open');
    });
    sock.addEventListener('message', (e) => {
      if (typeof e.data !== 'string' || e.data.length > 20_000) return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data) as ServerMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg.t !== 'string') return;
      if (msg.t === 'full') closed = true; // the room refused us: no point retrying
      events.onMessage(msg);
    });
    sock.addEventListener('close', (e) => {
      if (ws !== sock) return;
      ws = null;
      if (closed || e.reason === 'full' || e.reason === 'replaced' || e.reason === 'expired' || e.reason === 'policy') {
        closed = true;
        events.onConnection('closed', e.reason);
        return;
      }
      const delay = RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)];
      attempt++;
      events.onConnection('reconnecting');
      timer = window.setTimeout(open, delay);
    });
    sock.addEventListener('error', () => {
      // `close` follows and schedules the retry
    });
  };
  open();

  return {
    session,
    send(msg) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      closed = true;
      if (timer !== null) window.clearTimeout(timer);
      const sock = ws;
      ws = null;
      sock?.close(1000, 'leave');
      events.onConnection('closed', 'leave');
    },
  };
}
