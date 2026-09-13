import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';

import { createEngine } from './engine';
import { GameController } from './game-controller';
import { initPieceSets, type ColorPreference, type PieceSetManager } from './piece-sets';
import { setDifficultyLabels } from './ui/controls';
import { requireElement } from './ui/dom';

const app = requireElement<HTMLDivElement>(document, '#app');

app.innerHTML = `
  <div class="stage">
    <div class="spectator spectator-top cg-wrap"><piece class="king black"></piece><div class="bubble" hidden></div></div>
    <div class="board"></div>
    <div class="spectator spectator-bottom cg-wrap"><piece class="king white"></piece><div class="bubble" hidden></div></div>
  </div>
  <aside class="panel">
    <h1>ŠACH KVÁK MEK!!!</h1>
    <details class="settings" open>
      <summary>⚙ Nastavení</summary>
      <div class="controls">
        <label>Hraju za <select class="animal"></select></label>
        <label>Soupeř <select class="opponent"></select></label>
        <label>Barva <select class="side"></select></label>
        <label>Obtížnost <select class="difficulty"></select></label>
        <label>Figurky <select class="piece-family"></select></label>
        <label>Hodnocení tahů <select class="feedback"></select></label>
      </div>
    </details>
    <div class="matchup"></div>
    <div class="status"></div>
    <div class="review-controls" hidden>
      <button type="button" class="review-first" aria-label="Na začátek">⏮</button>
      <button type="button" class="review-prev" aria-label="Předchozí tah">◀</button>
      <button type="button" class="review-next" aria-label="Další tah">▶</button>
      <button type="button" class="review-last" aria-label="Na konec">⏭</button>
    </div>
    <details class="moves" open>
      <summary>Tahy <span class="moves-summary"></span></summary>
      <ol class="move-list"></ol>
    </details>
    <div class="buttons">
      <button type="button" class="new-game">Nová hra</button>
      <button type="button" class="undo">Zpět</button>
      <button type="button" class="review" hidden>Rozbor</button>
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
    feedbackSelect: requireElement<HTMLSelectElement>(app, '.feedback'),
    promotionDialog: requireElement<HTMLDialogElement>(app, '.promotion-dialog'),
    reviewButton: requireElement<HTMLButtonElement>(app, '.review'),
    reviewControls: {
      container: requireElement<HTMLElement>(app, '.review-controls'),
      first: requireElement<HTMLButtonElement>(app, '.review-first'),
      prev: requireElement<HTMLButtonElement>(app, '.review-prev'),
      next: requireElement<HTMLButtonElement>(app, '.review-next'),
      last: requireElement<HTMLButtonElement>(app, '.review-last'),
    },
    spectators: {
      top: requireElement<HTMLElement>(app, '.spectator-top'),
      bottom: requireElement<HTMLElement>(app, '.spectator-bottom'),
    },
  },
  engine,
  {
    feedbackEnabled: readFeedbackSetting(),
    onFeedbackChange: writeFeedbackSetting,
    // Voices, colour preference and the drawn pair live in the piece-set manager, which
    // loads after the controller exists (hence the late lookups).
    voiceOf: (color) => pieceSets?.animalOf(color) ?? null,
    nextColor: () => pieceSets?.drawColor() ?? 'w',
    onNewGame: (color) => {
      pieceSets?.startGame(color);
      renderMatchup();
    },
  },
);


const game: GameController = controller;

// Piece sets are view state only; the controller never learns about them. The family
// (drawing style), the characters and the colour preference live in piece-sets.ts.
const familySelect = requireElement<HTMLSelectElement>(app, '.piece-family');
const animalSelect = requireElement<HTMLSelectElement>(app, '.animal');
const opponentSelect = requireElement<HTMLSelectElement>(app, '.opponent');
const sideSelect = requireElement<HTMLSelectElement>(app, '.side');
const difficultySelect = requireElement<HTMLSelectElement>(app, '.difficulty');
const matchupEl = requireElement<HTMLElement>(app, '.matchup');
let pieceSets: PieceSetManager | undefined;

sideSelect.replaceChildren(new Option('náhodně', 'random'), new Option('bílá', 'w'), new Option('černá', 'b'));

void initPieceSets({ baseUrl: import.meta.env.BASE_URL, boardEl, storage: safeLocalStorage() })
  .then((manager) => {
    pieceSets = manager;
    wirePieceSetSelects(manager);
    // The controller opened its first game before the preferences were known: draw again
    // (no move has been played yet; a new game is what a colour change means anyway).
    void game.newGame().catch((err) => console.error('newGame failed', err));
  })
  .catch((err) => console.error('Piece sets failed to initialise', err));

const COLOR_NAME: Record<'w' | 'b', string> = { w: 'bílé', b: 'černé' };

/** "Ty: kůzlata (bílé) · Soupeř: hadi (černé)" — the resolved pair of the current game. */
function renderMatchup(): void {
  const manager = pieceSets;
  if (!manager || !manager.isLibrary) {
    matchupEl.textContent = manager ? `Hraješ za ${COLOR_NAME[manager.humanColor]}.` : '';
    return;
  }
  const me = manager.animalOf(manager.humanColor);
  const them = manager.animalOf(manager.humanColor === 'w' ? 'b' : 'w');
  const other = manager.humanColor === 'w' ? 'b' : 'w';
  matchupEl.textContent = `Ty: ${me?.name ?? '?'} (${COLOR_NAME[manager.humanColor]}) · Soupeř: ${them?.name ?? '?'} (${COLOR_NAME[other]})`;
}

function wirePieceSetSelects(manager: PieceSetManager): void {
  if (manager.families.length === 0) {
    familySelect.replaceChildren(new Option('Klasické (vestavěné)', ''));
    familySelect.disabled = true;
    for (const sel of [animalSelect, opponentSelect]) {
      sel.replaceChildren(new Option('—', ''));
      sel.disabled = true;
    }
    return;
  }
  familySelect.replaceChildren(...manager.families.map((f) => new Option(f.name, f.id)));

  const render = (): void => {
    familySelect.value = manager.familyId ?? manager.families[0].id;
    sideSelect.value = manager.colorPreference;
    if (manager.isLibrary) {
      animalSelect.replaceChildren(...manager.animals.map((a) => new Option(a.za, a.id)));
      animalSelect.value = manager.animal;
      animalSelect.disabled = false;
      opponentSelect.replaceChildren(new Option('náhodně', 'random'), ...manager.animals.map((a) => new Option(a.name, a.id)));
      opponentSelect.value = manager.opponentPreference;
      opponentSelect.disabled = false;
      const me = manager.animalOf(manager.humanColor);
      setDifficultyLabels(difficultySelect, me?.levels ?? null);
    } else {
      // Pair styles have no choice of character: show a dash, keep the ladder's own names.
      for (const sel of [animalSelect, opponentSelect]) {
        sel.replaceChildren(new Option('—', ''));
        sel.disabled = true;
      }
      setDifficultyLabels(difficultySelect, null);
    }
    renderMatchup();
  };

  familySelect.addEventListener('change', () => {
    manager.setFamily(familySelect.value);
    render();
  });
  animalSelect.addEventListener('change', () => {
    manager.setAnimal(animalSelect.value);
    render();
  });
  opponentSelect.addEventListener('change', () => {
    manager.setOpponentPreference(opponentSelect.value);
    render();
  });
  // Colour is a preference; changing it means a new game (the controller draws via nextColor).
  sideSelect.addEventListener('change', () => {
    manager.setColorPreference(sideSelect.value as ColorPreference);
    void game.newGame().catch((err) => console.error('newGame failed', err));
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
