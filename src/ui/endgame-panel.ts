/**
 * Endgame training panel (Phase 13): position select, goal + hint, result, progress.
 * Sits under the status line while training is active (shares the puzzle panel's styling).
 */
import { ENDGAMES, ENDGAME_GROUPS, goalMet, readEndgameProgress, writeEndgameProgress, type Endgame, type EndgameProgress } from '../endgames';
import type { GameRecord } from '../games';

export interface EndgamePanelDeps {
  container: HTMLElement;
  storage: Storage | null;
  /** Puts the position on the board (trainer strength, engine on the other side). */
  start: (endgame: Endgame) => Promise<void>;
  /** Leaves training (a fresh pre-game, strength restored). */
  leave: () => void;
}

export interface EndgamePanel {
  open: () => void;
  /** Hides the panel and forgets the training (a new game / puzzle took over). */
  close: () => void;
  /** The training in progress, or null. */
  readonly current: Endgame | null;
  /** Called with every finished game's record; ignores games that are not the training. */
  onGameRecord: (record: GameRecord) => void;
}

export function buildEndgamePanel(deps: EndgamePanelDeps): EndgamePanel {
  const { container } = deps;
  container.replaceChildren();
  container.hidden = true;

  const select = document.createElement('select');
  select.className = 'endgame-select';
  for (const group of ENDGAME_GROUPS) {
    const og = document.createElement('optgroup');
    og.label = group;
    for (const e of ENDGAMES.filter((x) => x.group === group)) og.append(new Option(e.title, e.id));
    select.append(og);
  }
  const playBtn = button('Hrát', 'endgame-play');
  const againBtn = button('Znovu', 'endgame-again');
  const leaveBtn = button('Zpět do hry', 'puzzle-leave');
  const goal = el('div', '', 'puzzle-info');
  const hint = el('div', '', 'puzzle-info');
  const progress = el('div', '', 'puzzle-progress');
  const message = el('div', '', 'puzzle-msg');
  message.setAttribute('role', 'status');
  const row = document.createElement('div');
  row.className = 'puzzle-row';
  row.append(labelled('Koncovka', select), playBtn, againBtn, leaveBtn);
  container.append(row, goal, hint, progress, message);

  const state: EndgameProgress = readEndgameProgress(deps.storage);
  let current: Endgame | null = null;

  const selected = (): Endgame => ENDGAMES.find((e) => e.id === select.value) ?? ENDGAMES[0];

  const render = (): void => {
    const e = current ?? selected();
    goal.textContent = `Cíl: ${e.goal === 'win' ? 'vyhraj' : 'udrž remízu'} · hraješ ${e.human === 'w' ? 'bílými' : 'černými'}${state.done[e.id] ? ' · ✓ zvládnuto' : ''}`;
    hint.textContent = `Rada: ${e.hint}`;
    const done = Object.keys(state.done).length;
    progress.textContent = `Zvládnuto ${done} z ${ENDGAMES.length}`;
    againBtn.hidden = current === null;
  };

  const start = async (e: Endgame): Promise<void> => {
    current = e;
    select.value = e.id;
    message.textContent = '';
    render();
    await deps.start(e);
  };

  select.addEventListener('change', () => {
    if (current) void start(selected());
    else render();
  });
  playBtn.addEventListener('click', () => void start(selected()));
  againBtn.addEventListener('click', () => {
    if (current) void start(current);
  });
  const close = (): void => {
    container.hidden = true;
    current = null;
  };
  leaveBtn.addEventListener('click', () => {
    close();
    deps.leave();
  });

  return {
    get current() {
      return current;
    },
    open(): void {
      container.hidden = false;
      message.textContent = '';
      void start(selected());
    },
    close,
    onGameRecord(record): void {
      if (!current || record.startFen !== current.fen || record.source !== 'app') return;
      if (goalMet(current, record.result)) {
        state.done[current.id] = true;
        writeEndgameProgress(deps.storage, state);
        message.textContent = 'Zvládnuto! Můžeš zkusit další koncovku.';
        message.classList.remove('us-error');
      } else {
        message.textContent = current.goal === 'win' ? 'Tentokrát ne — zkus to znovu.' : 'Remíza se neudržela — zkus to znovu.';
        message.classList.add('us-error');
      }
      render();
    },
  };
}

function el(tag: string, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = className;
  return b;
}

function labelled(text: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.append(text + ' ', control);
  return label;
}
