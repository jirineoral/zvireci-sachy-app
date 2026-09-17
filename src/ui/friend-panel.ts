/**
 * "Hrát s kamarádem" (Phase 20): the bar under the status line while a game over a link
 * is on (who is connected, the link to share, rematch, leave) and the one-click flow:
 * `Kamarád` makes a room and shows the link; opening a `#hra=` link joins it. The room
 * itself is `src/friend.ts`; the board is the controller's `startRemoteGame` /
 * `applyRemoteMove`. All text goes through `textContent`.
 */
import type { Color } from 'chess.js';
import { connectFriend, isRoomId, randomId, roomLink, sessionFor, writeSession, type Connection, type FriendClient, type ServerMessage } from '../friend';
import { copyText } from '../prompts';

export interface FriendPanelDeps {
  bar: HTMLElement;
  /** `Kamarád` in the button row. */
  button: HTMLButtonElement;
  storage: Storage | null;
  /** The host's colour preference for the first game (the `Barva` select). */
  pref: () => Color | 'random';
  /** Puts the room's game on the board for this seat. */
  start: (color: Color, sans: readonly string[]) => Promise<void>;
  /** The friend moved; false = not accepted (out of sync). */
  applyMove: (san: string, ply: number) => boolean;
  /** `Odejít`: a fresh pre-game against the computer (the controller then calls `onLeft`). */
  leave: () => void;
}

export interface FriendPanel {
  /** Joins the room from a `#hra=` link (no-op for a bad id). */
  join: (room: string) => void;
  /** The controller left the game over a link (`Nová hra`, a puzzle…): drop the socket. */
  onLeft: () => void;
  /** The human moved: send it. */
  onMove: (san: string, ply: number) => void;
  /** The game on the board ended (the bar offers a rematch). */
  onGameOver: () => void;
  readonly active: boolean;
}

const COLOR_NAME: Record<Color, string> = { w: 'bílé', b: 'černé' };

export function buildFriendPanel(deps: FriendPanelDeps): FriendPanel {
  const { bar } = deps;
  bar.replaceChildren();
  bar.hidden = true;

  const text = document.createElement('span');
  text.className = 'friend-text';
  const copyBtn = button('Kopírovat odkaz', 'friend-copy');
  const shareBtn = button('Sdílet…', 'friend-share');
  shareBtn.hidden = typeof navigator.share !== 'function';
  const rematchBtn = button('Odveta', 'friend-rematch');
  rematchBtn.hidden = true;
  const leaveBtn = button('Odejít', 'friend-leave');
  bar.append(text, copyBtn, shareBtn, rematchBtn, leaveBtn);

  let client: FriendClient | null = null;
  let seat: Color | null = null;
  let game = 0;
  let sans: string[] = [];
  let peer = false;
  let connection: Connection = 'closed';
  let over = false;
  let rematchAsked = false; // by us
  let rematchOffered = false; // by the friend
  let note = '';

  const render = (): void => {
    bar.hidden = client === null;
    if (client === null) return;
    const parts: string[] = [];
    if (seat) parts.push(`Hraješ s kamarádem — máš ${COLOR_NAME[seat]}.`);
    if (connection === 'connecting') parts.push('Připojuji…');
    else if (connection === 'reconnecting') parts.push('Spojení vypadlo, zkouším znovu…');
    else if (connection === 'closed') parts.push(note || 'Odpojeno.');
    else if (!peer) parts.push(sans.length === 0 && game <= 1 ? 'Čekám na kamaráda — pošli mu odkaz.' : 'Kamarád je odpojený…');
    else if (over) parts.push(rematchOffered ? 'Kamarád chce odvetu!' : rematchAsked ? 'Čekám, jestli kamarád chce odvetu…' : 'Konec partie.');
    text.textContent = parts.join(' ');
    copyBtn.hidden = peer && !over;
    shareBtn.hidden = typeof navigator.share !== 'function' || (peer && !over);
    rematchBtn.hidden = !(over && peer && connection === 'open');
    rematchBtn.disabled = rematchAsked;
    rematchBtn.textContent = rematchOffered ? 'Odveta — jdeme na to!' : 'Odveta';
  };

  const stop = (): void => {
    client?.close();
    client = null;
    seat = null;
    game = 0;
    sans = [];
    peer = false;
    over = false;
    rematchAsked = false;
    rematchOffered = false;
    connection = 'closed';
    writeSession(deps.storage, null);
    if (location.hash.startsWith('#hra=')) history.replaceState(null, '', location.pathname + location.search);
    render();
  };

  const onMessage = (msg: ServerMessage): void => {
    if (msg.t === 'state') {
      peer = msg.peer;
      const sameGame = msg.game === game && msg.seat === seat && msg.sans.length === sans.length && msg.sans.every((s, i) => s === sans[i]);
      game = msg.game;
      seat = msg.seat;
      sans = msg.sans.slice();
      if (!sameGame) {
        over = false;
        rematchAsked = false;
        rematchOffered = false;
        void deps.start(msg.seat, msg.sans).catch((err) => console.error('startRemoteGame failed', err));
      }
    } else if (msg.t === 'move') {
      if (deps.applyMove(msg.san, msg.ply)) sans.push(msg.san);
      else console.warn('Remote move not applied (out of sync)', msg.ply, sans.length);
    } else if (msg.t === 'peer') {
      peer = msg.online;
    } else if (msg.t === 'rematch') {
      rematchOffered = true;
    } else if (msg.t === 'full') {
      note = 'V téhle hře už dva hráči jsou.';
    } else if (msg.t === 'error') {
      console.warn('Relay refused a message', msg.msg);
    }
    render();
  };

  const connect = (room: string, pref?: Color | 'random'): void => {
    if (!isRoomId(room)) return;
    stop();
    note = '';
    const session = sessionFor(deps.storage, room, pref);
    client = connectFriend(session, {
      onMessage,
      onConnection: (state, reason) => {
        connection = state;
        if (state === 'closed' && reason === 'expired') note = 'Hra vypršela (24 h bez tahu).';
        if (state === 'closed' && reason === 'unavailable') note = 'Server pro hru s kamarádem není dostupný.';
        if (state === 'closed' && reason === 'replaced') note = 'Hra pokračuje v jiné záložce.';
        render();
      },
    });
    render();
  };

  deps.button.addEventListener('click', () => {
    const room = randomId(12);
    history.replaceState(null, '', `#hra=${room}`);
    connect(room, deps.pref());
    void copyText(roomLink(room)).then((ok) => {
      note = '';
      text.textContent = ok ? 'Odkaz je zkopírovaný — pošli ho kamarádovi (WhatsApp, SMS…). Čekám, až ho otevře.' : 'Zkopíruj odkaz a pošli ho kamarádovi.';
    });
  });
  copyBtn.addEventListener('click', () => {
    if (!client) return;
    void copyText(roomLink(client.session.room)).then((ok) => {
      text.textContent = ok ? 'Odkaz zkopírovaný — pošli ho kamarádovi.' : 'Kopírování se nepovedlo; zkopíruj adresu z řádku prohlížeče.';
    });
  });
  shareBtn.addEventListener('click', () => {
    if (!client) return;
    void navigator.share({ title: 'Zvířecí šachy — zahraj si se mnou', url: roomLink(client.session.room) }).catch(() => undefined);
  });
  rematchBtn.addEventListener('click', () => {
    if (!client || !over) return;
    rematchAsked = true;
    client.send({ t: 'rematch' });
    render();
  });
  leaveBtn.addEventListener('click', () => {
    stop();
    deps.leave();
  });

  return {
    join: (room) => connect(room),
    onLeft: stop,
    onMove: (san, ply) => {
      sans.push(san);
      client?.send({ t: 'move', san, ply });
    },
    onGameOver: () => {
      over = true;
      render();
    },
    get active() {
      return client !== null;
    },
  };
}

function button(label: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  return b;
}
