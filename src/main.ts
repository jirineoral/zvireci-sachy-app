import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';

import { createEngine } from './engine';
import { GameController } from './game-controller';
import { initPieceSets, type PieceSetManager } from './piece-sets';
import { requireElement } from './ui/dom';

const app = requireElement<HTMLDivElement>(document, '#app');

app.innerHTML = `
  <div class="board"></div>
  <aside class="panel">
    <h1>ŠACH KVÁK MEK!!!</h1>
    <details class="settings" open>
      <summary>⚙ Nastavení</summary>
      <div class="controls">
        <label>Obtížnost <select class="difficulty"></select></label>
        <label>Hraju za <select class="side"></select></label>
        <label>Figurky <select class="piece-set"></select></label>
      </div>
    </details>
    <div class="status"></div>
    <details class="moves" open>
      <summary>Tahy <span class="moves-summary"></span></summary>
      <ol class="move-list"></ol>
    </details>
    <div class="buttons">
      <button type="button" class="new-game">Nová hra</button>
      <button type="button" class="undo">Zpět</button>
    </div>
  </aside>
  <dialog class="promotion-dialog"></dialog>
`;

const ENGINE_WORKER_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;
// Byte size of stockfish-18-lite-single.wasm as shipped by stockfish@18.0.8. Used by the
// engine's reachability pre-check (±5 %). UPDATE THIS when the engine version changes.
const ENGINE_WASM_BYTES = 7_295_411;

// The controller owns engine-failure handling (before and after the handshake). It is
// constructed after the engine, hence the late binding.
let controller: GameController | undefined;
const engine = createEngine(
  ENGINE_WORKER_URL,
  (err) => {
    if (controller) controller.engineFailed(err);
    else console.error('Engine failed before the controller existed', err);
  },
  { expectedWasmBytes: ENGINE_WASM_BYTES },
);

const boardEl = requireElement<HTMLElement>(app, '.board');

controller = new GameController(
  {
    board: boardEl,
    status: requireElement<HTMLElement>(app, '.status'),
    moveList: requireElement<HTMLElement>(app, '.move-list'),
    newGameButton: requireElement<HTMLButtonElement>(app, '.new-game'),
    undoButton: requireElement<HTMLButtonElement>(app, '.undo'),
    difficultySelect: requireElement<HTMLSelectElement>(app, '.difficulty'),
    sideSelect: requireElement<HTMLSelectElement>(app, '.side'),
    promotionDialog: requireElement<HTMLDialogElement>(app, '.promotion-dialog'),
  },
  engine,
);


// Piece sets are view state only; the controller never learns about them.
const pieceSetSelect = requireElement<HTMLSelectElement>(app, '.piece-set');
void initPieceSets({ baseUrl: import.meta.env.BASE_URL, boardEl, storage: safeLocalStorage() })
  .then((manager) => wirePieceSetSelect(pieceSetSelect, manager))
  .catch((err) => console.error('Piece sets failed to initialise', err));

function wirePieceSetSelect(select: HTMLSelectElement, manager: PieceSetManager): void {
  if (manager.sets.length === 0) {
    select.replaceChildren(new Option('Klasické (vestavěné)', ''));
    select.disabled = true;
    return;
  }
  select.replaceChildren(...manager.sets.map((set) => new Option(set.name, set.id)));
  select.value = manager.currentId ?? manager.sets[0].id;
  select.addEventListener('change', () => manager.select(select.value));
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage behaves like a first visit
  }
}

// Compact panel on narrow screens: once the first move is played, fold the settings and
// the move list away; a new game unfolds the settings again. Pure view logic driven by
// the rendered move list, so the controller stays unaware of it.
const settingsPanel = requireElement<HTMLDetailsElement>(app, '.settings');
const movesPanel = requireElement<HTMLDetailsElement>(app, '.moves');
const movesSummary = requireElement<HTMLElement>(app, '.moves-summary');
const moveListEl = requireElement<HTMLElement>(app, '.move-list');
const narrow = window.matchMedia('(max-width: 899px)');
let lastPlies = -1;

function syncPanels(): void {
  const sans = Array.from(moveListEl.querySelectorAll('li span:not(.move-number)'))
    .map((el) => el.textContent ?? '')
    .filter((t) => t.length > 0);
  const plies = sans.length;
  movesSummary.textContent = plies === 0 ? '' : `(${plies}) … ${sans[plies - 1]}`;
  if (narrow.matches && plies !== lastPlies) {
    if (lastPlies <= 0 && plies > 0) {
      settingsPanel.open = false; // game started: make room for the board
      movesPanel.open = false;
    } else if (plies === 0) {
      settingsPanel.open = true; // new game: settings matter again
      movesPanel.open = false;
    }
  }
  lastPlies = plies;
}

new MutationObserver(syncPanels).observe(moveListEl, { childList: true, subtree: true, characterData: true });
narrow.addEventListener('change', () => {
  if (!narrow.matches) {
    settingsPanel.open = true; // wide layout has room for everything
    movesPanel.open = true;
  } else {
    settingsPanel.open = lastPlies === 0;
    movesPanel.open = false;
  }
});
if (narrow.matches) movesPanel.open = false;
syncPanels();
