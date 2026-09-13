import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';

import { createEngine } from './engine';
import { GameController } from './game-controller';
import { ANIMALS, ANIMAL_LABEL, initPieceSets, type Animal, type PieceSetManager } from './piece-sets';
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
        <label>Hraju za <select class="animal"></select></label>
        <label>Barva <select class="side"></select></label>
        <label>Figurky <select class="piece-family"></select></label>
        <label>Hodnocení tahů <select class="feedback"></select></label>
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
    <footer class="credits">
      Engine <a href="https://github.com/official-stockfish/Stockfish">Stockfish</a> 18
      (<a href="https://github.com/nmrugg/stockfish.js">stockfish.js</a>, GPL-3.0 —
      <a href="engine/LICENSE-GPL-3.0.txt">licence</a>) ·
      deska <a href="https://github.com/lichess-org/chessground">chessground</a> ·
      pravidla <a href="https://github.com/jhlywa/chess.js">chess.js</a>
    </footer>
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
    feedbackSelect: requireElement<HTMLSelectElement>(app, '.feedback'),
    promotionDialog: requireElement<HTMLDialogElement>(app, '.promotion-dialog'),
  },
  engine,
  { feedbackEnabled: readFeedbackSetting(), onFeedbackChange: writeFeedbackSetting },
);


// Piece sets are view state only; the controller never learns about them. The family
// (drawing style), the animal and the colour together pick the set (piece-sets.ts).
const familySelect = requireElement<HTMLSelectElement>(app, '.piece-family');
const animalSelect = requireElement<HTMLSelectElement>(app, '.animal');
const sideSelect = requireElement<HTMLSelectElement>(app, '.side');
void initPieceSets({ baseUrl: import.meta.env.BASE_URL, boardEl, storage: safeLocalStorage(), humanColor: 'w' })
  .then((manager) => wirePieceSetSelects(manager))
  .catch((err) => console.error('Piece sets failed to initialise', err));

function wirePieceSetSelects(manager: PieceSetManager): void {
  if (manager.families.length === 0) {
    familySelect.replaceChildren(new Option('Klasické (vestavěné)', ''));
    familySelect.disabled = true;
    animalSelect.replaceChildren(new Option('—', ''));
    animalSelect.disabled = true;
    return;
  }
  familySelect.replaceChildren(...manager.families.map((f) => new Option(f.name, f.id)));
  animalSelect.replaceChildren(...ANIMALS.map((a) => new Option(ANIMAL_LABEL[a], a)));

  const render = (): void => {
    familySelect.value = manager.familyId ?? manager.families[0].id;
    const choice = manager.animalChoice();
    if (choice.effective === null) {
      // No animals in this family: show a dash instead of a misleading animal.
      if (!animalSelect.querySelector('option[value=""]')) animalSelect.add(new Option('—', ''));
      animalSelect.value = '';
    } else {
      animalSelect.querySelector('option[value=""]')?.remove();
      animalSelect.value = choice.effective;
    }
    animalSelect.disabled = !choice.enabled;
  };

  familySelect.addEventListener('change', () => {
    manager.setFamily(familySelect.value);
    render();
  });
  animalSelect.addEventListener('change', () => {
    manager.setAnimal(animalSelect.value as Animal);
    render();
  });
  // The controller owns the colour (its own listener starts a new game); the view only
  // follows the same select to pick the matching set of the family.
  sideSelect.addEventListener('change', () => {
    manager.setHumanColor(sideSelect.value === 'b' ? 'b' : 'w');
    render();
  });
  render();
}

const FEEDBACK_STORAGE_KEY = 'skm.moveFeedback';

function readFeedbackSetting(): boolean {
  try {
    return window.localStorage.getItem(FEEDBACK_STORAGE_KEY) !== 'off'; // default on
  } catch {
    return true;
  }
}

function writeFeedbackSetting(enabled: boolean): void {
  try {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (err) {
    console.warn('Could not persist move-feedback setting', err);
  }
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

