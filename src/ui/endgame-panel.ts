/**
 * Endgame training panel (Phase 13, restructured Phase 23): category → type → position
 * grid, goal + hint, result, progress. Sits under the status line while training is
 * active (shares the puzzle panel's styling).
 */
import {
  ENDGAMES,
  ENDGAME_CATEGORIES,
  endgamesOfType,
  endgameType,
  goalMet,
  readEndgameProgress,
  typesOfCategory,
  writeEndgameProgress,
  type Endgame,
  type EndgameProgress,
} from '../endgames';
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
  /** Opens the panel and starts the selected position (or `id`, e.g. from a lesson's practice pointer). */
  open: (id?: string) => void;
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

  const categorySelect = document.createElement('select');
  categorySelect.className = 'endgame-category-select';
  for (const c of ENDGAME_CATEGORIES) categorySelect.append(new Option(c.title, c.id));

  const typeSelect = document.createElement('select');
  typeSelect.className = 'endgame-type-select';

  const grid = document.createElement('div');
  grid.className = 'endgame-grid';

  const playBtn = button('Hrát', 'endgame-play');
  const againBtn = button('Znovu', 'endgame-again');
  const nextBtn = button('Další pozice', 'endgame-next');
  const leaveBtn = button('Konec koncovek', 'puzzle-leave');
  const goal = el('div', '', 'puzzle-info');
  const hint = el('div', '', 'puzzle-info');
  const progress = el('div', '', 'puzzle-progress');
  const message = el('div', '', 'puzzle-msg');
  message.setAttribute('role', 'status');
  const row = document.createElement('div');
  row.className = 'puzzle-row';
  row.append(labelled('Kategorie', categorySelect), labelled('Typ', typeSelect));
  const row2 = document.createElement('div');
  row2.className = 'puzzle-row';
  row2.append(playBtn, againBtn, nextBtn, leaveBtn);
  container.append(row, grid, row2, goal, hint, progress, message);

  const state: EndgameProgress = readEndgameProgress(deps.storage);
  let current: Endgame | null = null;
  let selectedId: string = ENDGAMES[0].id;

  const selectedEndgame = (): Endgame => ENDGAMES.find((e) => e.id === selectedId) ?? ENDGAMES[0];

  const rebuildTypeSelect = (): void => {
    typeSelect.replaceChildren();
    for (const t of typesOfCategory(categorySelect.value)) typeSelect.append(new Option(t.title, t.id));
  };

  const rebuildGrid = (): void => {
    grid.replaceChildren();
    const positions = endgamesOfType(typeSelect.value);
    for (const e of positions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'endgame-pos' + (state.done[e.id] ? ' endgame-pos-done' : '') + (e.id === selectedId ? ' endgame-pos-selected' : '');
      b.textContent = `${e.order}${state.done[e.id] ? ' ✓' : ''}`;
      b.title = e.title;
      b.dataset.endgameId = e.id;
      b.addEventListener('click', () => {
        selectedId = e.id;
        if (current) void start(e);
        else render();
      });
      grid.append(b);
    }
  };

  const render = (): void => {
    const e = current ?? selectedEndgame();
    goal.textContent = `${e.title} · Cíl: ${e.goal === 'win' ? 'vyhraj' : 'udrž remízu'} · hraješ ${e.human === 'w' ? 'bílými' : 'černými'}${state.done[e.id] ? ' · ✓ zvládnuto' : ''}`;
    hint.textContent = `Rada: ${e.hint}`;
    const done = Object.keys(state.done).length;
    progress.textContent = `Zvládnuto ${done} z ${ENDGAMES.length}`;
    againBtn.hidden = current === null;
    nextBtn.hidden = current === null;
    for (const b of Array.from(grid.children) as HTMLButtonElement[]) {
      const posId = b.dataset.endgameId;
      b.classList.toggle('endgame-pos-selected', posId === selectedId);
      const done = !!(posId && state.done[posId]);
      b.classList.toggle('endgame-pos-done', done);
      const pos = ENDGAMES.find((x) => x.id === posId);
      if (pos) b.textContent = `${pos.order}${done ? ' ✓' : ''}`;
    }
  };

  const start = async (e: Endgame): Promise<void> => {
    current = e;
    selectedId = e.id;
    message.textContent = '';
    render();
    await deps.start(e);
  };

  const selectCategoryFor = (id: string): void => {
    const e = ENDGAMES.find((x) => x.id === id) ?? ENDGAMES[0];
    const t = endgameType(e.typeId);
    categorySelect.value = t?.categoryId ?? ENDGAME_CATEGORIES[0].id;
    rebuildTypeSelect();
    typeSelect.value = e.typeId;
    rebuildGrid();
    selectedId = e.id;
  };

  categorySelect.addEventListener('change', () => {
    rebuildTypeSelect();
    typeSelect.dispatchEvent(new Event('change'));
  });
  typeSelect.addEventListener('change', () => {
    const positions = endgamesOfType(typeSelect.value);
    selectedId = positions[0]?.id ?? selectedId;
    rebuildGrid();
    render();
  });
  playBtn.addEventListener('click', () => void start(selectedEndgame()));
  againBtn.addEventListener('click', () => {
    if (current) void start(current);
  });
  nextBtn.addEventListener('click', () => {
    if (!current) return;
    const positions = endgamesOfType(current.typeId);
    const idx = positions.findIndex((p) => p.id === current!.id);
    const next = positions[idx + 1] ?? positions.find((p) => !state.done[p.id]) ?? positions[0];
    if (next) void start(next);
  });
  const close = (): void => {
    container.hidden = true;
    current = null;
  };
  leaveBtn.addEventListener('click', () => {
    close();
    deps.leave();
  });

  selectCategoryFor(selectedId);

  return {
    get current() {
      return current;
    },
    open(id?: string): void {
      const targetId = id && ENDGAMES.some((e) => e.id === id) ? id : selectedId;
      selectCategoryFor(targetId);
      container.hidden = false;
      message.textContent = '';
      void start(selectedEndgame());
    },
    close,
    onGameRecord(record): void {
      if (!current || record.startFen !== current.fen || record.source !== 'app') return;
      if (goalMet(current, record.result)) {
        state.done[current.id] = true;
        writeEndgameProgress(deps.storage, state);
        message.textContent = 'Zvládnuto! Zkus další pozici.';
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
