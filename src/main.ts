import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';
import './styles/intro.css';

import { createEngine } from './engine';
import { GameController } from './game-controller';
import { initPieceSets, type ColorPreference, type PieceSetManager } from './piece-sets';
import { setDifficultyLabels } from './ui/controls';
import { buildUserSetsDialog } from './ui/user-sets-dialog';
import { openUserSetStore } from './user-sets';
import { RESULT_LABEL, openGameStore, type GameRecord, type GameStore } from './games';
import { buildGamesDialog } from './ui/games-dialog';
import { buildPuzzlePanel } from './ui/puzzle-panel';
import { createIntro, readIntroSetting, shownThisSession, writeIntroSetting } from './intro/intro';
import { buildIntroPool } from './intro/pool';
import { requireElement } from './ui/dom';

const app = requireElement<HTMLDivElement>(document, '#app');

app.innerHTML = `
  <div class="stage">
    <div class="spectator spectator-top cg-wrap"><piece class="king black"></piece><div class="bubble" hidden></div></div>
    <div class="board-row">
      <div class="eval-bar" hidden><div class="eval-fill"></div><span class="eval-text"></span></div>
      <div class="board"></div>
    </div>
    <div class="spectator spectator-bottom cg-wrap"><piece class="king white"></piece><div class="bubble" hidden></div></div>
  </div>
  <aside class="panel">
    <h1>Zvířecí šachy <small class="subtitle">(nejen) pro děti</small></h1>
    <details class="settings" open>
      <summary>⚙ Nastavení</summary>
      <div class="controls">
        <label>Hraju za <select class="animal"></select></label>
        <label>Soupeř <select class="opponent"></select></label>
        <label>Barva <select class="side"></select></label>
        <label>Obtížnost <select class="difficulty"></select></label>
        <label>Figurky <select class="piece-family"></select></label>
        <label>Hodnocení tahů <select class="feedback"></select></label>
        <label>Intro <select class="intro-setting"></select></label>
        <button type="button" class="user-sets-open">Vlastní figurky…</button>
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
    <button type="button" class="analyse" hidden>Analyzovat partii</button>
    <div class="puzzle-panel" hidden></div>
    <details class="moves" open>
      <summary>Tahy <span class="moves-summary"></span></summary>
      <ol class="move-list"></ol>
    </details>
    <div class="buttons">
      <button type="button" class="new-game">Nová hra</button>
      <button type="button" class="undo">Zpět</button>
      <button type="button" class="review" hidden>Rozbor</button>
      <button type="button" class="games">Partie</button>
      <button type="button" class="puzzles">Úlohy</button>
    </div>
    <footer class="credits">
      Engine <a href="https://github.com/official-stockfish/Stockfish">Stockfish</a> 18
      (<a href="https://github.com/nmrugg/stockfish.js">stockfish.js</a>, GPL-3.0 —
      <a href="engine/LICENSE-GPL-3.0.txt">licence</a>) ·
      deska <a href="https://github.com/lichess-org/chessground">chessground</a> ·
      pravidla <a href="https://github.com/jhlywa/chess.js">chess.js</a> ·
      grafika figurek je vygenerovaná umělou inteligencí
    </footer>
  </aside>
  <dialog class="promotion-dialog"></dialog>
  <dialog class="user-sets-dialog"></dialog>
  <dialog class="games-dialog"></dialog>
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
    analyseButton: requireElement<HTMLButtonElement>(app, '.analyse'),
    evalBar: requireElement<HTMLElement>(app, '.eval-bar'),
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
    sideNames: () => ({
      white: pieceSets?.animalOf('w')?.name ?? 'bílý',
      black: pieceSets?.animalOf('b')?.name ?? 'černý',
    }),
    onGameRecord: (record) => void saveGame(record),
    onGameLoaded: (record) => {
      const you = record.humanColor === 'w' ? ' (ty)' : '';
      const them = record.humanColor === 'b' ? ' (ty)' : '';
      matchupEl.textContent = `Rozbor: ${record.white}${you} × ${record.black}${them} · ${RESULT_LABEL[record.result]}`;
    },
    onPuzzleStart: (color) => {
      pieceSets?.startGame(color);
      renderMatchup();
    },
    onPuzzleResult: (result) => puzzlePanel.onResult(result),
  },
);

// Puzzles (Phase 10): the panel loads the CC0 subset on first use.
const puzzlePanel = buildPuzzlePanel({
  container: requireElement<HTMLElement>(app, '.puzzle-panel'),
  baseUrl: import.meta.env.BASE_URL,
  storage: safeLocalStorage(),
  start: (puzzle) => game.startPuzzle(puzzle.fen, puzzle.moves),
  hint: () => game.puzzleHint(),
  leave: () => void game.newGame().catch((err) => console.error('newGame failed', err)),
});
requireElement<HTMLButtonElement>(app, '.puzzles').addEventListener('click', () => puzzlePanel.open());

// Saved games (Phase 9): the store opens in the background; a record that arrives before
// it is ready is written once it is.
let gameStore: GameStore | null = null;
const pendingRecords: GameRecord[] = [];
function saveGame(record: GameRecord): Promise<void> {
  if (!gameStore) {
    pendingRecords.push(record);
    return Promise.resolve();
  }
  return gameStore.save(record).catch((err) => console.warn('Saving the game failed', err));
}
void openGameStore().then((store) => {
  gameStore = store;
  const dialog = buildGamesDialog({ dialog: requireElement<HTMLDialogElement>(app, '.games-dialog'), store, open: (r) => game.loadGame(r) });
  requireElement<HTMLButtonElement>(app, '.games').addEventListener('click', () => dialog.open());
  for (const r of pendingRecords.splice(0)) void saveGame(r);
});


const game: GameController = controller;

// Intro + splash (Phase 8): the overlay is a sibling of #app (which becomes inert while the
// overlay is up — it must not be inside it); the game boots underneath.
const introOverlay = document.createElement('div');
introOverlay.className = 'intro intro-preload';
introOverlay.setAttribute('role', 'dialog');
introOverlay.setAttribute('aria-modal', 'true');
introOverlay.setAttribute('aria-label', 'Úvodní obrazovka');
document.body.appendChild(introOverlay);
const introSelect = requireElement<HTMLSelectElement>(app, '.intro-setting');
introSelect.replaceChildren(new Option('zapnuto', 'on'), new Option('vypnuto', 'off'));
introSelect.value = readIntroSetting(safeLocalStorage()) ? 'on' : 'off';
introSelect.addEventListener('change', () => writeIntroSetting(safeLocalStorage(), introSelect.value === 'on'));
const intro = createIntro({
  overlay: introOverlay,
  app,
  baseUrl: import.meta.env.BASE_URL,
  storage: safeLocalStorage(),
  session: safeSessionStorage(),
  onDisable: () => {
    introSelect.value = 'off';
  },
});
const introWanted = readIntroSetting(safeLocalStorage()) && !shownThisSession(safeSessionStorage());
if (!introWanted) intro.dismiss();

// Piece sets are view state only; the controller never learns about them. The family
// (drawing style), the characters and the colour preference live in piece-sets.ts.
const familySelect = requireElement<HTMLSelectElement>(app, '.piece-family');
const animalSelect = requireElement<HTMLSelectElement>(app, '.animal');
const opponentSelect = requireElement<HTMLSelectElement>(app, '.opponent');
const sideSelect = requireElement<HTMLSelectElement>(app, '.side');
const difficultySelect = requireElement<HTMLSelectElement>(app, '.difficulty');
const matchupEl = requireElement<HTMLElement>(app, '.matchup');
const userSetsButton = requireElement<HTMLButtonElement>(app, '.user-sets-open');
const userSetsDialog = requireElement<HTMLDialogElement>(app, '.user-sets-dialog');
let pieceSets: PieceSetManager | undefined;

sideSelect.replaceChildren(new Option('náhodně', 'random'), new Option('bílá', 'w'), new Option('černá', 'b'));

// User sets (IndexedDB, or memory when blocked) are read first so a reload can restore one.
void openUserSetStore()
  .then(async (store) => {
    const userSets = await store.list().catch((err) => {
      console.warn('Could not read user piece sets', err);
      return [];
    });
    const manager = await initPieceSets({ baseUrl: import.meta.env.BASE_URL, boardEl, storage: safeLocalStorage(), userSets });
    pieceSets = manager;
    const rerender = wirePieceSetSelects(manager);
    const dialog = buildUserSetsDialog({ dialog: userSetsDialog, store, manager, onChanged: rerender });
    userSetsButton.addEventListener('click', () => dialog.open());
    if (introWanted) {
      const library = manager.families.find((f) => f.library);
      const pool = buildIntroPool({
        baseUrl: import.meta.env.BASE_URL,
        libraryFolder: library ? (library.sets.find((s) => s.library)?.library ?? null) : null,
        animals: library?.library?.animals ?? [],
        userSets,
      });
      void intro.start(pool);
    }
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

/** Wires the selects; returns the re-render used after user sets change. */
function wirePieceSetSelects(manager: PieceSetManager): () => void {
  const render = (): void => {
    if (manager.families.length === 0) {
      familySelect.replaceChildren(new Option('Klasické (vestavěné)', ''));
      familySelect.disabled = true;
      for (const sel of [animalSelect, opponentSelect]) {
        sel.replaceChildren(new Option('—', ''));
        sel.disabled = true;
      }
      return;
    }
    familySelect.disabled = false;
    familySelect.replaceChildren(...manager.families.map((f) => new Option(f.name, f.id)));
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
  return render;
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

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
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
