/**
 * "Hrát s kamarádem" (Phase 20): the bar under the status line while a game over a link
 * is on (who is connected, the link to share, rematch, leave) and the flow into it:
 * `Kamarád` shows a short explanation with `Vytvořit odkaz`; only that button (after a
 * question when a game is under way) makes a room, copies the link and starts the game;
 * opening a `#hra=` link joins it. The room itself is `src/friend.ts`; the board is the
 * controller's `startRemoteGame` / `applyRemoteMove`. All text goes through `textContent`.
 *
 * A move of ours stays *pending* until the room is known to have it (the friend answers
 * it, or a `state` after a reconnect contains it); a `state` that stops one ply short gets
 * it sent again, so a move made on a dying socket is not lost.
 */
import type { Color } from 'chess.js';
import {
  connectFriend,
  friendStorage,
  isRoomId,
  randomId,
  readSession,
  REJOIN_MS,
  roomLink,
  sessionFor,
  touchSession,
  writeSession,
  type Connection,
  type FriendClient,
  type PendingMove,
  type ServerMessage,
} from '../friend';
import { copyText } from '../prompts';

export interface FriendPanelDeps {
  bar: HTMLElement;
  /** `Kamarád` in the button row. */
  button: HTMLButtonElement;
  /** `localStorage` (null when blocked); the panel falls back to `sessionStorage` itself. */
  storage: Storage | null;
  /** The host's colour preference for the first game (the `Barva` select). */
  pref: () => Color | 'random';
  /** A game is under way that a new friend game would end (the panel asks first). */
  inProgress: () => boolean;
  /** Puts the room's game on the board for this seat: playing, already over, or broken (a SAN chess.js refused). */
  start: (color: Color, sans: readonly string[]) => Promise<'playing' | 'over' | 'broken'>;
  /** The friend moved; false = not accepted (out of sync). */
  applyMove: (san: string, ply: number) => boolean;
  /** Still waiting for the friend to open the link: the status line says so instead of "Na tahu". */
  waiting: (on: boolean) => void;
  /** `Odejít`: a fresh pre-game against the computer (the controller then calls `onLeft`). */
  leave: () => void;
}

export interface FriendPanel {
  /** Joins the room from a `#hra=` link (no-op for a bad id). */
  join: (room: string) => void;
  /** Rejoins the room of the stored session when it was live within REJOIN_MS; true when it did. */
  rejoin: () => boolean;
  /** The controller left the game over a link (`Nová hra`, a puzzle…): drop the socket. */
  onLeft: () => void;
  /** The human moved: send it. */
  onMove: (san: string, ply: number) => void;
  /** The game on the board ended (the bar offers a rematch). */
  onGameOver: () => void;
  readonly active: boolean;
}

const COLOR_NAME: Record<Color, string> = { w: 'bílé', b: 'černé' };
/** A two-step button falls back to its first label after this long. */
const CONFIRM_MS = 4000;

export function buildFriendPanel(deps: FriendPanelDeps): FriendPanel {
  const { bar } = deps;
  const storage = friendStorage(deps.storage);
  bar.replaceChildren();
  bar.hidden = true;

  const text = document.createElement('span');
  text.className = 'friend-text';
  const createBtn = button('Vytvořit odkaz', 'friend-create');
  const cancelBtn = button('Zpět', 'friend-cancel');
  const copyBtn = button('Kopírovat odkaz', 'friend-copy');
  const shareBtn = button('Sdílet…', 'friend-share');
  const rematchBtn = button('Odveta', 'friend-rematch');
  const leaveBtn = button('Odejít', 'friend-leave');
  bar.append(text, createBtn, cancelBtn, copyBtn, shareBtn, rematchBtn, leaveBtn);
  const canShare = typeof navigator.share === 'function';

  let client: FriendClient | null = null;
  /** Bumped whenever the client is replaced or dropped: events of an older client are ignored. */
  let generation = 0;
  let seat: Color | null = null;
  let game = 0;
  let sans: string[] = [];
  let peer = false;
  let connection: Connection = 'closed';
  let reconnectReason: string | undefined;
  let over = false;
  let rematchAsked = false; // by us
  let rematchOffered = false; // by the friend
  let note = '';
  /** What happened to the link just made (copied or not); shown while waiting for the friend. */
  let linkNote = '';
  /** `Kamarád` tapped: the explanation and `Vytvořit odkaz` are showing. */
  let intro = false;
  let createArmed = false;
  let leaveArmed = false;
  let createTimer: number | null = null;
  let leaveTimer: number | null = null;

  const pending = (): PendingMove | undefined => client?.session.pending;
  const setPending = (p: PendingMove | undefined): void => {
    if (!client) return;
    if (p) client.session.pending = p;
    else delete client.session.pending;
    writeSession(storage, client.session);
  };

  const disarm = (): void => {
    createArmed = leaveArmed = false;
    if (createTimer !== null) window.clearTimeout(createTimer);
    if (leaveTimer !== null) window.clearTimeout(leaveTimer);
    createTimer = leaveTimer = null;
  };

  const render = (): void => {
    bar.hidden = client === null && !intro;
    deps.waiting(client !== null && !peer && sans.length === 0 && game <= 1);
    if (bar.hidden) return;
    if (intro) {
      text.textContent = `Pošli kamarádovi odkaz. Kdo ho má, může si sednout ke stolu.${createArmed ? ' Rozehraná partie tím skončí — opravdu?' : ''}`;
      createBtn.textContent = createArmed ? 'Ano, vytvořit odkaz' : 'Vytvořit odkaz';
      for (const b of [copyBtn, shareBtn, rematchBtn, leaveBtn]) b.hidden = true;
      createBtn.hidden = cancelBtn.hidden = false;
      return;
    }
    createBtn.hidden = cancelBtn.hidden = true;
    const parts: string[] = [];
    if (seat) parts.push(`Hraješ s kamarádem — máš ${COLOR_NAME[seat]}.`);
    const waitingMove = pending() !== undefined;
    if (connection === 'connecting') parts.push(waitingMove ? 'Tvůj tah čeká na spojení — připojuju…' : 'Připojuju…');
    else if (connection === 'reconnecting') {
      if (reconnectReason === 'rate') parts.push('Moc zpráv najednou — za chvilku se připojím znovu…');
      else parts.push(waitingMove ? 'Spojení vypadlo — tvůj tah pošlu, až se připojím. Připojuju…' : 'Spojení vypadlo, zkouším znovu…');
    } else if (connection === 'closed') parts.push(note || 'Odpojeno.');
    else if (!peer) parts.push(sans.length === 0 && game <= 1 ? linkNote || 'Čekám na kamaráda — pošli mu odkaz (jen tomu, s kým chceš hrát).' : 'Kamarád je odpojený…');
    else if (over) parts.push(rematchOffered ? 'Kamarád chce odvetu!' : rematchAsked ? 'Čekám, jestli kamarád chce odvetu…' : 'Konec partie.');
    text.textContent = parts.join(' ');
    copyBtn.hidden = peer && !over;
    shareBtn.hidden = !canShare || (peer && !over);
    rematchBtn.hidden = !(over && peer && connection === 'open');
    rematchBtn.disabled = rematchAsked;
    rematchBtn.textContent = rematchOffered ? 'Odveta — jdeme na to!' : 'Odveta';
    leaveBtn.hidden = false;
    leaveBtn.textContent = leaveArmed ? 'Opravdu odejít?' : 'Odejít';
    leaveBtn.classList.toggle('armed', leaveArmed);
  };

  /** Drops the socket; `forget` also clears the stored seat token (a real leave). */
  const stop = (forget = true): void => {
    generation++;
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
    reconnectReason = undefined;
    disarm();
    if (forget) writeSession(storage, null);
    render();
  };

  /**
   * The room's `state` against our pending move: the room already has it (done), is one
   * ply short (send it again and keep it on the board), or went elsewhere (drop it).
   */
  const reconcile = (msg: Extract<ServerMessage, { t: 'state' }>): string[] => {
    const p = pending();
    if (!p) return msg.sans;
    const ourTurnAtP: Color = p.ply % 2 === 0 ? 'w' : 'b';
    if (p.game === msg.game && ourTurnAtP === msg.seat) {
      if (msg.sans.length === p.ply) {
        client?.send({ t: 'move', san: p.san, ply: p.ply });
        return [...msg.sans, p.san];
      }
      if (msg.sans.length > p.ply && msg.sans[p.ply] === p.san) {
        setPending(undefined);
        return msg.sans;
      }
    }
    console.warn('Pending move dropped — the room moved on without it', p);
    setPending(undefined);
    return msg.sans;
  };

  const onMessage = (msg: ServerMessage): void => {
    if (msg.t === 'state') {
      if (client) touchSession(storage, client.session);
      peer = msg.peer;
      const roomSans = reconcile(msg);
      const sameGame = msg.game === game && msg.seat === seat && roomSans.length === sans.length && roomSans.every((s, i) => s === sans[i]);
      game = msg.game;
      seat = msg.seat;
      sans = roomSans.slice();
      if (!sameGame) {
        over = false;
        rematchAsked = false;
        rematchOffered = false;
        const gen = generation;
        void deps
          .start(msg.seat, roomSans)
          .then((result) => {
            if (gen !== generation) return;
            if (result === 'broken') {
              stop();
              note = 'Hra je poškozená — začni novou.';
              connection = 'closed';
              bar.hidden = false;
              text.textContent = note;
              return;
            }
            over = result === 'over';
            render();
          })
          .catch((err) => console.error('startRemoteGame failed', err));
      }
      // The room remembers a rematch offer made while one of us was away (older relays do not send it).
      if (msg.rematch) {
        rematchAsked = msg.rematch.includes(msg.seat);
        rematchOffered = msg.rematch.some((s) => s !== msg.seat);
      }
    } else if (msg.t === 'move') {
      if (deps.applyMove(msg.san, msg.ply)) {
        sans.push(msg.san);
        const p = pending();
        if (p && msg.ply > p.ply) setPending(undefined); // the friend answered it: the room has it
        if (client) touchSession(storage, client.session);
      } else {
        console.warn('Remote move not applied — re-syncing from the room', msg.ply, sans.length);
        client?.resync();
      }
    } else if (msg.t === 'error') {
      // The room refused our move (illegal or out of turn): it is not coming back; the room's state re-syncs the board.
      console.warn('Relay refused a message — re-syncing from the room', msg.msg);
      setPending(undefined);
      client?.resync();
    } else if (msg.t === 'peer') {
      peer = msg.online;
      if (client) touchSession(storage, client.session);
    } else if (msg.t === 'rematch') {
      rematchOffered = true;
    } else if (msg.t === 'full') {
      note = msg.taken ? 'Tvoje místo u stolu mezitím zabral někdo jiný, kdo měl odkaz.' : 'V téhle hře už dva hráči jsou.';
      writeSession(storage, null); // nothing to come back to: no rejoin on the next load
    }
    render();
  };

  const connect = (room: string, pref?: Color | 'random'): void => {
    if (!isRoomId(room)) return;
    stop(false);
    intro = false;
    note = '';
    linkNote = '';
    // The room id leaves the address bar (and the history) at once; the stored session brings a reload back.
    if (location.hash.startsWith('#hra=')) history.replaceState(null, '', location.pathname + location.search);
    const session = sessionFor(storage, room, pref);
    const gen = ++generation;
    client = connectFriend(session, {
      onMessage: (msg) => {
        if (gen === generation) onMessage(msg);
      },
      onConnection: (state, reason) => {
        if (gen !== generation) return;
        connection = state;
        reconnectReason = state === 'reconnecting' ? reason : undefined;
        if (state === 'closed') {
          if (reason === 'expired') note = 'Hra vypršela (24 hodin bez tahu).';
          else if (reason === 'unavailable') note = 'Server pro hru s kamarádem není dostupný.';
          else if (reason === 'replaced') note = 'Hra pokračuje v jiné záložce.';
          // Not a ban: our client sent something the room does not take (a bug). The seat is kept, a reload rejoins.
          else if (reason === 'policy') note = 'Server spojení ukončil. Načti stránku znovu — hra na tebe počká.';
        }
        render();
      },
    });
    render();
  };

  deps.button.addEventListener('click', () => {
    disarm();
    intro = true;
    render();
  });
  createBtn.addEventListener('click', () => {
    if (!createArmed && deps.inProgress()) {
      createArmed = true;
      createTimer = window.setTimeout(() => {
        createArmed = false;
        render();
      }, CONFIRM_MS);
      render();
      return;
    }
    disarm();
    const room = randomId(12);
    connect(room, deps.pref());
    const gen = generation;
    void copyText(roomLink(room)).then((ok) => {
      if (gen !== generation) return;
      linkNote = ok ? 'Odkaz je zkopírovaný — pošli ho kamarádovi (WhatsApp, SMS…). Čekám, až ho otevře.' : 'Zkopíruj odkaz tlačítkem a pošli ho kamarádovi.';
      render();
    });
  });
  cancelBtn.addEventListener('click', () => {
    disarm();
    intro = false;
    render();
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
  // Two steps: `Odejít` sits next to `Odveta` and leaving cannot be undone.
  leaveBtn.addEventListener('click', () => {
    if (!leaveArmed) {
      leaveArmed = true;
      leaveTimer = window.setTimeout(() => {
        leaveArmed = false;
        render();
      }, CONFIRM_MS);
      render();
      return;
    }
    stop();
    deps.leave();
  });

  return {
    join: (room) => connect(room),
    /** A stored session rejoins without the link — only when it was live recently (a reload, a re-opened tab), not the next day on a shared PC. */
    rejoin: () => {
      const stored = readSession(storage);
      if (!stored || Date.now() - stored.seen > REJOIN_MS) return false;
      connect(stored.room);
      return true;
    },
    onLeft: stop,
    onMove: (san, ply) => {
      sans.push(san);
      if (client) {
        // Pending until the room is known to have it; sent again after a reconnect if not.
        setPending({ san, ply, game });
        client.send({ t: 'move', san, ply });
        touchSession(storage, client.session);
      }
      render();
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
