import './styles/board.css';
import './styles/pieces.css';
import './styles/app.css';
import './styles/intro.css';

import { createEngine, type Engine } from './engine';
import { GameController } from './game-controller';
import { initPieceSets, type ColorPreference, type PieceSetManager } from './piece-sets';
import { setDifficultyLabels } from './ui/controls';
import { buildUserSetsDialog } from './ui/user-sets-dialog';
import { openUserSetStore } from './user-sets';
import { RESULT_LABEL, openGameStore, type GameRecord, type GameStore } from './games';
import { buildGamesDialog } from './ui/games-dialog';
import { buildBroadcastsDialog } from './ui/broadcasts-dialog';
import { buildPuzzlePanel } from './ui/puzzle-panel';
import { buildEndgamePanel } from './ui/endgame-panel';
import { TRAINER } from './endgames';
import { DEFAULT_POSITION } from 'chess.js';
import { buildCampaignDialog } from './ui/campaign-dialog';
import { dropPieces, readPieceDropSetting, writePieceDropSetting, type Announcement } from './ui/piece-drop';
import { initSounds, play, readSoundSetting, writeSoundSetting } from './sounds';
import { initVoice, readSpeakSetting, stopSpeaking, writeSpeakSetting } from './lessons/voice';
import { campaignStep, moveInOrder, readCampaign, recordCampaignGame, resetProgress, skipOpponent, writeCampaign, type CampaignState } from './campaign';
import { DEFAULT_DIFFICULTY, interpolateDifficulty, isDifficultyLevel, type Difficulty, type DifficultyLevel } from './difficulty';
import { createIntro, readIntroSetting, shownThisSession, writeIntroSetting } from './intro/intro';
import { buildIntroPool } from './intro/pool';
import { guardDialog, requireElement } from './ui/dom';
import { buildFriendPanel } from './ui/friend-panel';
import { roomFromLocation } from './friend';
import { startAnalytics } from './analytics';
import { COURSE } from './lessons/course';
import { markLessonDone, markTestPassed, readLessonProgress, setTeacher, type LessonProgress } from './lessons/progress';
import type { Lesson, PracticePointer } from './lessons/types';
import { buildCourseMap } from './ui/course-map';
import { buildDiplomaDialog } from './ui/diploma';
import { createChessgroundLessonBoard, type ChessgroundLessonBoard } from './ui/lesson-board';
import { buildLessonPanel, OWL, teacherInfo } from './ui/lesson-panel';
import { promptPromotion } from './ui/promotion-dialog';
import { initUiVersion } from './ui-version';
import { registerServiceWorker } from './pwa';

registerServiceWorker(); // PWA (R12 step 1): production builds only, see src/pwa.ts

const app = requireElement<HTMLDivElement>(document, '#app');

/** U1 item 8: a small globe on the buttons that go online (Kamarád, Turnaje). */
const ONLINE_BADGE =
  '<svg class="online-badge" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
  '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
  '<ellipse cx="8" cy="8" rx="2.8" ry="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
  '<path d="M1.5 8h13M2.7 4.7h10.6M2.7 11.3h10.6" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>' +
  '<span class="visually-hidden"> (přes internet)</span>';

app.innerHTML = `
  <div class="stage">
    <div class="spectator spectator-top cg-wrap"><piece class="king black"></piece><div class="captured" hidden></div><div class="bubble" hidden></div></div>
    <div class="board-row">
      <div class="eval-bar" hidden><div class="eval-fill"></div><span class="eval-text"></span></div>
      <div class="board"></div>
      <div class="announce" hidden></div>
      <button type="button" class="board-start" hidden><span class="board-start-icon" aria-hidden="true">▶</span> Hrát</button>
    </div>
    <div class="spectator spectator-bottom cg-wrap"><piece class="king white"></piece><div class="captured" hidden></div><div class="bubble" hidden></div></div>
  </div>
  <aside class="panel">
    <h1>Zvířecí šachy <small class="subtitle">(nejen) pro děti</small></h1>
    <p class="trust">Zdarma · bez reklam · bez registrace · <a href="/soukromi.html" target="_blank" rel="noopener">Soukromí</a></p>
    <details class="settings">
      <summary>⚙ Nastavení</summary>
      <div class="controls">
        <label>Hraju za <select class="animal"></select></label>
        <label>Soupeř <select class="opponent"></select></label>
        <label>Barva <select class="side"></select></label>
        <label>Obtížnost <select class="difficulty"></select></label>
        <label>Figurky <select class="piece-family"></select></label>
        <label>Hodnocení tahů <select class="feedback"></select></label>
        <label>Tahy zpět <select class="undo-limit"></select></label>
        <label>Intro <select class="intro-setting"></select></label>
        <label>Nástup figurek <select class="drop-setting"></select></label>
        <label>Zvuky <select class="sound-setting"></select></label>
        <label>Sova čte nahlas <select class="speak-setting"></select></label>
        <button type="button" class="user-sets-open">Vlastní figurky…</button>
      </div>
    </details>
    <div class="matchup"></div>
    <details class="legend">
      <summary>Jak poznat figurky?</summary>
      <p>Pěšec je bez pokrývky hlavy · <b>věž</b> má na hlavě hrad · <b>jezdec</b> helmu s chocholem ·
      <b>střelec</b> mitru s křížem · <b>dáma</b> korunu · <b>král</b> vyšší korunu s křížem a žezlo.
      Když se v nich ztrácíš, přepni <i>Figurky</i> na <i>Klasické</i>.</p>
    </details>
    <div class="campaign-bar" hidden><span class="campaign-text"></span><button type="button" class="campaign-next" hidden></button><button type="button" class="campaign-open">Kampaň…</button></div>
    <div class="status" role="status" aria-live="polite"></div>
    <button type="button" class="engine-retry" hidden>Zkusit znovu</button>
    <p class="save-error" role="alert" hidden></p>
    <div class="friend-bar" hidden></div>
    <div class="review-controls" hidden>
      <button type="button" class="review-first" aria-label="Na začátek">⏮</button>
      <button type="button" class="review-prev" aria-label="Předchozí tah">◀</button>
      <button type="button" class="review-next" aria-label="Další tah">▶</button>
      <button type="button" class="review-last" aria-label="Na konec">⏭</button>
    </div>
    <button type="button" class="analyse" hidden>Analyzovat partii</button>
    <div class="puzzle-panel" hidden></div>
    <div class="endgame-panel" hidden></div>
    <div class="lesson-panel" hidden></div>
    <details class="moves" open>
      <summary>Tahy <span class="moves-summary"></span></summary>
      <ol class="move-list"></ol>
    </details>
    <div class="buttons">
      <button type="button" class="new-game">Nová hra</button>
      <button type="button" class="undo">Zpět</button>
      <button type="button" class="resign" hidden>Vzdát</button>
      <button type="button" class="review" hidden>Rozbor</button>
      <button type="button" class="lessons">Lekce</button>
      <button type="button" class="games">Partie</button>
      <button type="button" class="puzzles">Úlohy</button>
      <button type="button" class="endgames">Koncovky</button>
      <button type="button" class="broadcasts" title="Přes internet">Turnaje${ONLINE_BADGE}</button>
      <button type="button" class="campaign">Kampaň</button>
      <button type="button" class="friend" title="Přes internet">Kamarád${ONLINE_BADGE}</button>
    </div>
    <footer class="credits">
      <p class="mission">Pro děti napořád zdarma, bez reklam a bez registrace. Žádné osobní údaje nesbíráme:
      nastavení, postup i partie zůstávají jen v tomhle prohlížeči (jen když si načteš partie z chess.com nebo turnaj z Lichess, prohlížeč si je od nich stáhne).
      Návštěvy počítáme anonymně (Cloudflare), bez cookies. Při hře s kamarádem projdou tahy přes náš server
      a do 24 hodin od posledního tahu se smažou. Odkaz na zpětnou vazbu otevře formulář Google — vyplň ho s rodičem; verze appky a typ zařízení se do něj předvyplní.</p>
      <p class="feedback-line"><a class="feedback-link" href="#" target="_blank" rel="noopener">Napiš mi, co si o tom myslíš →</a> · <a href="/soukromi.html">Soukromí</a> <span class="build"></span></p>
      <p class="social-line">Sleduj nás: <a href="https://www.facebook.com/zvirecisachy" target="_blank" rel="noopener">Facebook</a> · <a href="https://www.youtube.com/@zvirecisachy" target="_blank" rel="noopener">YouTube</a> · <a href="https://www.instagram.com/zvirecisachy/" target="_blank" rel="noopener">Instagram</a></p>
      Engine <a href="https://github.com/official-stockfish/Stockfish">Stockfish</a> 18
      (<a href="https://github.com/nmrugg/stockfish.js">stockfish.js</a>, GPL-3.0 —
      <a href="/engine/LICENSE-GPL-3.0.txt">licence</a>) ·
      deska <a href="https://github.com/lichess-org/chessground">chessground</a> ·
      pravidla <a href="https://github.com/jhlywa/chess.js">chess.js</a> ·
      zvířecí figurky jsou vygenerované umělou inteligencí ·
      klasické figurky © <a href="https://en.wikipedia.org/wiki/User:Cburnett" rel="noopener">Colin M.L. Burnett</a>
      (<a href="https://creativecommons.org/licenses/by-sa/3.0/" rel="noopener">CC BY-SA 3.0</a>) ·
      <a href="https://github.com/jirineoral/zvireci-sachy-app" rel="noopener">zdrojový kód</a> (GPL-3.0) ·
      <a href="/THIRD-PARTY-NOTICES.txt">licence třetích stran</a>
    </footer>
  </aside>
  <dialog class="promotion-dialog"></dialog>
  <dialog class="user-sets-dialog"></dialog>
  <dialog class="games-dialog"></dialog>
  <dialog class="campaign-dialog"></dialog>
  <dialog class="broadcasts-dialog"></dialog>
  <dialog class="course-map"></dialog>
  <dialog class="diploma-dialog"></dialog>
`;
// Old browsers without <dialog> support get an inline fallback instead of a throwing button.
for (const dialog of app.querySelectorAll('dialog')) guardDialog(dialog);

const ENGINE_WORKER_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;
// Byte size of stockfish-18-lite-single.wasm as shipped by stockfish@18.0.8. Used by the
// engine's reachability pre-check (±5 %). UPDATE THIS when the engine version changes.
const ENGINE_WASM_BYTES = 7_295_411;
// Read while the controller is constructed below — the keys must be initialised before
// that (a `const` further down would still be in its temporal dead zone: the read throws,
// the catch returns the default, and the stored setting is silently ignored).
const FEEDBACK_STORAGE_KEY = 'skm.moveFeedback';
const UNDO_LIMIT_STORAGE_KEY = 'skm.undoLimit';
const DIFFICULTY_STORAGE_KEY = 'skm.difficulty';
// U1 §8.1: beginner defaults for genuinely new users only — decided before any setting is
// read (localStorage at once; a browser with no `skm.*` key also asks IndexedDB for saved games).
const uiVersion = initUiVersion(safeLocalStorage());
/** What the board holds, for the matchup line (a puzzle or an ending is never "two players"). */
let boardMode: 'play' | 'puzzle' | 'training' | 'lesson' = 'play';

// The controller owns engine-failure handling (before and after the handshake). It is
// constructed after the engine, hence the late binding. `Zkusit znovu` creates a new one.
let controller: GameController | undefined;
function startEngine(): Engine {
  const created: Engine = createEngine(
    ENGINE_WORKER_URL,
    (err) => {
      if (controller) controller.engineFailed(err, created);
      else console.error('Engine failed before the controller existed', err);
    },
    { expectedWasmBytes: ENGINE_WASM_BYTES },
  );
  return created;
}
const engine = startEngine();
requireElement<HTMLButtonElement>(app, '.review').addEventListener('click', () => onBoardStart()); // U1 F2: Rozbor
const engineRetryButton = requireElement<HTMLButtonElement>(app, '.engine-retry');
engineRetryButton.addEventListener('click', () => controller?.retryEngine(startEngine()));

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
    undoLimitSelect: requireElement<HTMLSelectElement>(app, '.undo-limit'),
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
    resignButton: requireElement<HTMLButtonElement>(app, '.resign'),
    startButton: requireElement<HTMLButtonElement>(app, '.board-start'),
  },
  engine,
  {
    feedbackEnabled: readFeedbackSetting(),
    onFeedbackChange: writeFeedbackSetting,
    undoLimit: readUndoLimitSetting(),
    onUndoLimitChange: writeUndoLimitSetting,
    difficulty: readDifficultySetting(),
    onDifficultyChange: writeDifficultySetting,
    confirmDiscard: () => confirmDiscard(requireElement<HTMLElement>(app, '.buttons')),
    // Voices, colour preference and the drawn pair live in the piece-set manager, which
    // loads after the controller exists (hence the late lookups).
    voiceOf: (color) => pieceSets?.animalOf(color) ?? null,
    nextColor: () => pieceSets?.drawColor() ?? 'w',
    twoPlayer: () => pieceSets?.colorPreference === 'two',
    onRemoteStart: (color) => {
      boardMode = 'play';
      endgamePanel.close();
      pieceSets?.startGame(color);
      renderMatchup();
    },
    onRemoteMove: (san, ply) => friendPanel.onMove(san, ply),
    onRemoteEnd: () => {
      friendPanel.onLeft();
      renderMatchup();
    },
    onNewGame: (color) => {
      boardMode = 'play';
      endgamePanel.close();
      campaignHooks?.beforeNewGame();
      pieceSets?.startGame(color);
      renderMatchup();
    },
    sideNames: () => ({
      white: pieceSets?.animalOf('w')?.name ?? 'bílý',
      black: pieceSets?.animalOf('b')?.name ?? 'černý',
    }),
    onGameRecord: (record) => {
      record.mode = game.isRemote ? 'friend' : endgamePanel.current ? 'training' : campaignOpponent ? 'campaign' : pieceSets?.colorPreference === 'two' ? 'two' : 'play';
      if (game.isRemote) friendPanel.onGameOver();
      void saveGame(record);
      campaignHooks?.afterGame(record);
      endgamePanel.onGameRecord(record);
      if (record.humanColor !== null && record.result !== '*') {
        if (record.result === '1/2-1/2') play('loss', 0.7); // a draw: same gentle cue as a loss, never a fanfare
        else if ((record.result === '1-0') === (record.humanColor === 'w')) play('win');
        else play('loss');
      }
    },
    onGameLoaded: (record) => {
      const human = record.mode === 'two' ? null : record.humanColor; // two people: nobody is "ty"
      const you = human === 'w' ? ' (ty)' : '';
      const them = human === 'b' ? ' (ty)' : '';
      matchupEl.textContent = `Rozbor: ${record.white}${you} × ${record.black}${them} · ${RESULT_LABEL[record.result]}`;
      onBoardStart();
    },
    onGameStart: () => {
      onBoardStart(); // `Hrát` (the board button, a campaign game): the board, not the settings
      if (!readPieceDropSetting(safeLocalStorage())) return null;
      play('piece-drop');
      return dropPieces(boardEl, announceEl, announcement());
    },
    onPuzzleStart: (color) => {
      boardMode = 'puzzle';
      pieceSets?.startGame(color);
      renderMatchup();
      onBoardStart();
    },
    onPuzzleResult: (result) => {
      puzzlePanel.onResult(result);
      if (result === 'solved') play('puzzle-solved');
      else if (result === 'wrong') play('lesson-wrong', 0.7); // same soft, non-buzzer cue as a lesson mistake
    },
    onMove: ({ mine, capture, check }) => {
      if (check) play('check');
      else if (capture) play('capture');
      else play(mine ? 'move' : 'opponent-move');
    },
    onTrainingStart: (color) => {
      boardMode = 'training';
      pieceSets?.startGame(color);
      renderMatchup();
      onBoardStart();
    },
    onEngineState: (state) => {
      engineRetryButton.hidden = state !== 'failed';
    },
    onLessonEnd: () => endLessonView(),
  },
);

// Endgame training (Phase 13): trainer strength while a position is being played.
const endgamePanel = buildEndgamePanel({
  container: requireElement<HTMLElement>(app, '.endgame-panel'),
  storage: safeLocalStorage(),
  start: async (e) => {
    await game.setDifficultyOverride(TRAINER);
    await game.startTraining(e.fen, e.human);
  },
  leave: () => {
    void game.setDifficultyOverride(campaignHooks?.currentDifficulty() ?? null).catch((err) => console.error('setDifficultyOverride failed', err));
    void game.newGame().catch((err) => console.error('newGame failed', err));
    unfoldSettings(); // back to the pre-game: settings matter again (0 → 0 plies does not reopen them)
  },
});
// The endgame panel has its own `Hrát` / `Konec koncovek`: the green `Nová hra` beside them
// would only confuse, so it steps aside while the panel is open.
{
  const container = requireElement<HTMLElement>(app, '.endgame-panel');
  const newGameBtn = requireElement<HTMLButtonElement>(app, '.new-game');
  const sync = (): void => {
    newGameBtn.hidden = !container.hidden;
  };
  new MutationObserver(sync).observe(container, { attributes: true, attributeFilter: ['hidden'] });
  sync();
}
requireElement<HTMLButtonElement>(app, '.endgames').addEventListener('click', async () => {
  if (!(await mayLeaveGame())) return; // U1 F4: a curious tap no longer throws a game away
  puzzlePanel.close();
  endgamePanel.open();
});

// Play with a friend over a link (Phase 20): the bar under the status line, the `Kamarád` button, `#hra=` on load.
const friendPanel = buildFriendPanel({
  bar: requireElement<HTMLElement>(app, '.friend-bar'),
  button: requireElement<HTMLButtonElement>(app, '.friend'),
  storage: safeLocalStorage(),
  pref: () => {
    const p = pieceSets?.colorPreference;
    return p === 'w' || p === 'b' ? p : 'random';
  },
  inProgress: () => game.anythingInProgress,
  start: (color, sans) => game.startRemoteGame(color, sans),
  applyMove: (san, ply) => game.applyRemoteMove(san, ply),
  waiting: (on) => game.setRemoteWaiting(on),
  leave: () => void game.newGame().catch((err) => console.error('newGame failed', err)),
});

// Feedback (pilot): a Google Form, opened in a new tab with the build stamp and the device
// prefilled — no address in the code, nothing sent from the app itself.
const FEEDBACK_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLScsfUJLrihM81ZTS9ATcvgc_MJAj5LKcHpbEIItWcw7swCu5A/viewform';
const FEEDBACK_VERSION_FIELD = 'entry.449486042';
const feedbackLink = requireElement<HTMLAnchorElement>(app, 'a.feedback-link');
// Visit counting (public build); `#bezmereni` / `#mereni` switch it off / on for this browser.
const counted = startAnalytics(__CF_BEACON_TOKEN__, safeLocalStorage());
requireElement<HTMLElement>(app, '.build').textContent =
  `verze ${__BUILD_STAMP__}${__DEV_SITE__ ? ' · TESTOVACÍ VERZE (dev)' : ''}${__CF_BEACON_TOKEN__ && !counted ? ' · bez měření' : ''}`;
if (__DEV_SITE__) {
  feedbackLink.hidden = true; // the pilot's form is for the public build only
  document.title = `[DEV] ${document.title}`;
  document.documentElement.classList.add('dev-site');
}
feedbackLink.href = `${FEEDBACK_FORM}?usp=pp_url&${FEEDBACK_VERSION_FIELD}=${encodeURIComponent(`${__BUILD_STAMP__} · ${deviceStamp()}`)}`;
function deviceStamp(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '?';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '?';
  return `${os} ${browser}`;
}

// Piece drop (Phase 12): the announcement over the board names the two sides.
const announceEl = requireElement<HTMLElement>(app, '.announce');
const dropSelect = requireElement<HTMLSelectElement>(app, '.drop-setting');
dropSelect.replaceChildren(new Option('zapnuto', 'on'), new Option('vypnuto', 'off'));
dropSelect.value = readPieceDropSetting(safeLocalStorage()) ? 'on' : 'off';
dropSelect.addEventListener('change', () => writePieceDropSetting(safeLocalStorage(), dropSelect.value === 'on'));

// Sound effects: lazily unlocked on the first pointerdown/keydown (iOS/Safari autoplay
// rules), so nothing plays during the intro splash before the child has touched anything.
initSounds(import.meta.env.BASE_URL, () => readSoundSetting(safeLocalStorage()));
const soundSelect = requireElement<HTMLSelectElement>(app, '.sound-setting');
soundSelect.replaceChildren(new Option('zapnuto', 'on'), new Option('vypnuto', 'off'));
soundSelect.value = readSoundSetting(safeLocalStorage()) ? 'on' : 'off';
soundSelect.addEventListener('change', () => {
  writeSoundSetting(safeLocalStorage(), soundSelect.value === 'on');
  if (soundSelect.value === 'off') stopSpeaking(); // "Zvuky" also gates narration
  lessonPanel.refresh(); // the 🔊 button's visibility depends on this setting too
});

// "Sova čte nahlas" (U1 pilot): pre-recorded narration from Cloudflare R2, shares the sound
// effects' AudioContext/unlock (src/lessons/voice.ts) and the "Zvuky" gate.
initVoice(() => readSoundSetting(safeLocalStorage()));
const speakSelect = requireElement<HTMLSelectElement>(app, '.speak-setting');
speakSelect.replaceChildren(new Option('zapnuto', 'on'), new Option('vypnuto', 'off'));
speakSelect.value = readSpeakSetting(safeLocalStorage()) ? 'on' : 'off';
speakSelect.addEventListener('change', () => {
  writeSpeakSetting(safeLocalStorage(), speakSelect.value === 'on');
  if (speakSelect.value === 'off') stopSpeaking();
});
function announcement(): Announcement {
  const manager = pieceSets;
  if (!manager || !manager.isLibrary) {
    const human = manager?.humanColor ?? 'w';
    return { line1: human === 'w' ? 'BÍLÉ vs. ČERNÉ' : 'ČERNÉ vs. BÍLÉ' };
  }
  const me = manager.animalOf(manager.humanColor)?.name ?? '?';
  const them = manager.animalOf(manager.humanColor === 'w' ? 'b' : 'w')?.name ?? '?';
  const line1 = `${me} vs. ${them}`.toLocaleUpperCase('cs-CZ');
  const step = campaignOpponent && campaignState ? campaignStep(campaignState, manager.animals, manager.animal, campaignOpponent) : null;
  return step ? { line1, line2: `soupeř ${step.index + 1} z ${step.total}` } : { line1 };
}

// Puzzles (Phase 10): the panel loads the CC0 subset on first use.
const puzzlePanel = buildPuzzlePanel({
  container: requireElement<HTMLElement>(app, '.puzzle-panel'),
  baseUrl: import.meta.env.BASE_URL,
  storage: safeLocalStorage(),
  start: (puzzle) => game.startPuzzle(puzzle.fen, puzzle.moves),
  hint: () => game.puzzleHint(),
  leave: () => void game.newGame().catch((err) => console.error('newGame failed', err)),
});
requireElement<HTMLButtonElement>(app, '.puzzles').addEventListener('click', async () => {
  if (!(await mayLeaveGame())) return; // U1 F4
  endgamePanel.close();
  puzzlePanel.open();
});

// ---- Lessons (Phase 21a / R6) ------------------------------------------------------------
// `Lekce` opens the course map; a lesson runs on the main board through the lesson board
// adapter (the controller is in lesson mode and neither syncs the board nor starts the
// engine). Progress lives in `skm.lessons`; nothing leaves the browser.
const lessonsButton = requireElement<HTMLButtonElement>(app, '.lessons');
let lessonProgress: LessonProgress = readLessonProgress(safeLocalStorage());
let lessonBoard: ChessgroundLessonBoard | null = null;

/** The child's library character teaches and names the pieces; null with classic / own sets. */
function lessonAnimalId(): string | null {
  return pieceSets?.isLibrary ? pieceSets.animal : null;
}
function lessonTeacherImage(id: string): string | null {
  return pieceSets?.characterImage(id, 'light', 'K') ?? null;
}
function lessonStatusText(lesson: Lesson): string {
  const total = COURSE.find((l) => l.level === lesson.level)?.lessons.length ?? lesson.number;
  return `Lekce ${lesson.number}/${total}: ${lesson.title}`;
}
function markDone(lesson: Lesson): void {
  lessonProgress = markLessonDone(safeLocalStorage(), lessonProgress, lesson.id);
}

// Phase 21b: a passed level test earns the badge and the printable diploma.
const diplomaDialog = buildDiplomaDialog({
  dialog: requireElement<HTMLDialogElement>(app, '.diploma-dialog'),
  storage: safeLocalStorage,
  teacher: () => teacherInfo(lessonProgress.teacher, lessonAnimalId(), lessonTeacherImage),
});
function openDiploma(level: number): void {
  const title = COURSE.find((l) => l.level === level)?.title ?? '';
  diplomaDialog.open(level, title);
}

const lessonPanel = buildLessonPanel({
  container: requireElement<HTMLElement>(app, '.lesson-panel'),
  teacher: () => teacherInfo(lessonProgress.teacher, lessonAnimalId(), lessonTeacherImage),
  askPromotion: (color) => promptPromotion(requireElement<HTMLDialogElement>(app, '.promotion-dialog'), color),
  onLessonDone: (lesson, result) => {
    if (!lesson.test) markDone(lesson);
    else if (result?.passed) lessonProgress = markTestPassed(safeLocalStorage(), lessonProgress, lesson);
  },
  onDiploma: openDiploma,
  onKnowIt: markDone,
  onBackToMap: () => courseMap.open(),
  onLeave: () => {
    endLessonView();
    void game.leaveLesson().catch((err) => console.error('leaveLesson failed', err));
    unfoldSettings();
  },
  onPractice: (pointer) => void practise(pointer),
  onNextLesson: (lesson) => void openLesson(lesson),
  onFeedback: (tone) => play(tone === 'good' ? 'lesson-correct' : 'lesson-wrong', tone === 'good' ? 0.8 : 0.6),
  autoSpeak: () => readSpeakSetting(safeLocalStorage()),
  // U1 F2: a step played on the board brings the board back into view (reading steps do not
  // scroll, so `Dál ▶` under the bubble stays where the child's finger is).
  onStep: (boardTask) => {
    if (boardTask) revealBoard();
  },
});

const courseMap = buildCourseMap({
  dialog: requireElement<HTMLDialogElement>(app, '.course-map'),
  progress: () => lessonProgress,
  teachers: () => {
    const id = lessonAnimalId();
    return { owl: OWL, animal: id ? teacherInfo('animal', id, lessonTeacherImage) : null };
  },
  currentLesson: () => lessonPanel.current,
  start: (lesson) => void openLesson(lesson),
  markDone,
  openDiploma,
  setTeacher: (teacher) => {
    lessonProgress = setTeacher(safeLocalStorage(), lessonProgress, teacher);
    if (lessonPanel.current) lessonPanel.refreshTeacher();
  },
});
lessonsButton.addEventListener('click', () => courseMap.open());

/** Hands the board to a lesson (asking first when a game would be thrown away). */
async function openLesson(lesson: Lesson): Promise<void> {
  if (!game.inLesson && !(await mayLeaveGame())) return;
  const hadTraining = endgamePanel.current !== null;
  puzzlePanel.close();
  endgamePanel.close();
  if (hadTraining) await game.setDifficultyOverride(campaignHooks?.currentDifficulty() ?? null).catch((err) => console.error('setDifficultyOverride failed', err));
  const api = await game.startLesson(lessonStatusText(lesson));
  if (!api) return; // superseded by another mode meanwhile
  boardMode = 'lesson';
  pieceSets?.startGame('w'); // the child's character on the white pieces, as the lessons say
  renderMatchup();
  lessonBoard ??= createChessgroundLessonBoard(api, {
    onMove: (from, to) => lessonPanel.input({ type: 'move', from, to }),
    onSquare: (square) => lessonPanel.input({ type: 'square', square }),
  });
  app.classList.add('lesson-mode');
  settingsPanel.open = false; // room for the teacher's bubble
  lessonPanel.start(lesson, lessonBoard, { animalId: lessonAnimalId() });
  revealBoard();
  // Laptop: the board is sticky, but closing the course map returned focus (and the scroll)
  // to `Lekce` far down the panel — bring the teacher's bubble back up.
  if (!window.matchMedia('(max-width: 899px)').matches) {
    window.requestAnimationFrame(() => requireElement<HTMLElement>(app, '.lesson-panel').scrollIntoView({ block: 'nearest' }));
  }
}

/** Lesson view off: the board's own handlers back, the panel hidden (idempotent). */
function endLessonView(): void {
  lessonBoard?.detach();
  lessonBoard = null;
  lessonPanel.close();
  app.classList.remove('lesson-mode');
  if (boardMode === 'lesson') boardMode = 'play';
}

/** A practice pointer at the end of a lesson: a game at a level, filtered puzzles, an ending. */
async function practise(pointer: PracticePointer): Promise<void> {
  endLessonView();
  if (pointer.kind === 'play') {
    const level = pointer.level;
    if (isDifficultyLevel(level)) await game.setDifficulty(level).catch((err) => console.error('setDifficulty failed', err));
    await game.leaveLesson().catch((err) => console.error('leaveLesson failed', err));
  } else if (pointer.kind === 'puzzles') {
    endgamePanel.close();
    puzzlePanel.open({ band: pointer.band, theme: pointer.theme ?? null });
  } else {
    puzzlePanel.close();
    endgamePanel.open(pointer.id);
  }
}

// Tournament broadcasts (Phase 16): Lichess, read-only, nothing stored.
const broadcasts = buildBroadcastsDialog({ dialog: requireElement<HTMLDialogElement>(app, '.broadcasts-dialog'), open: (r) => game.loadGame(r) });
requireElement<HTMLButtonElement>(app, '.broadcasts').addEventListener('click', () => broadcasts.open());

// Saved games (Phase 9): the store opens in the background; a record that arrives before
// it is ready is written once it is.
let gameStore: GameStore | null = null;
const pendingRecords: GameRecord[] = [];
function saveGame(record: GameRecord): Promise<void> {
  if (!gameStore) {
    pendingRecords.push(record);
    return Promise.resolve();
  }
  return gameStore.save(record).catch((err) => {
    console.warn('Saving the game failed', err);
    showSaveError('Partii se nepodařilo uložit — v prohlížeči je asi málo místa.');
  });
}
const saveErrorEl = requireElement<HTMLElement>(app, '.save-error');
let saveErrorTimer: number | undefined;
/** A short note under the status line for the child; hides itself after a while. */
function showSaveError(text: string): void {
  saveErrorEl.textContent = text;
  saveErrorEl.hidden = false;
  window.clearTimeout(saveErrorTimer);
  saveErrorTimer = window.setTimeout(() => {
    saveErrorEl.hidden = true;
  }, 10_000);
}
void openGameStore().then((store) => {
  gameStore = store;
  const dialog = buildGamesDialog({
    dialog: requireElement<HTMLDialogElement>(app, '.games-dialog'),
    store,
    open: (r) => game.loadGame(r),
    levelLabel: (level) => difficultySelect.options[level - 1]?.text ?? String(level),
    storage: safeLocalStorage(),
  });
  requireElement<HTMLButtonElement>(app, '.games').addEventListener('click', () => dialog.open());
  for (const r of pendingRecords.splice(0)) void saveGame(r);
});


const game: GameController = controller;

// The controller read the difficulty before IndexedDB answered: a new user's beginner level
// (written by initUiVersion) applies now, still before any game has started.
if (uiVersion.sync === null) {
  void uiVersion.done.then((kind) => {
    // Only while nothing has started yet (a slow IndexedDB must not change a running game).
    if (kind === 'new' && game.preGame) void game.setDifficulty(readDifficultySetting()).catch((err) => console.error('setDifficulty failed', err));
  });
}

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

sideSelect.replaceChildren(new Option('náhodně', 'random'), new Option('bílá', 'w'), new Option('černá', 'b'), new Option('dva hráči (bez počítače)', 'two'));

// User sets (IndexedDB, or memory when blocked) are read first so a reload can restore one.
void openUserSetStore()
  .then(async (store) => {
    const userSets = await store.list().catch((err) => {
      console.warn('Could not read user piece sets', err);
      return [];
    });
    await uiVersion.done; // the colour default of a new user is written before it is read
    const manager = await initPieceSets({ baseUrl: import.meta.env.BASE_URL, boardEl, storage: safeLocalStorage(), userSets });
    pieceSets = manager;
    const rerender = wirePieceSetSelects(manager);
    wireCampaign(manager, rerender);
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
    // (no move has been played yet; a new game is what a colour change means anyway) —
    // unless a game over a link (`#hra=`) is already on: then only align the characters.
    // A friend connection still on its way (`#hra=`, rejoin) must not be superseded by a
    // computer game either: its `startRemoteGame` would come back 'broken'.
    if (game.isRemote || friendPanel.active) {
      manager.startGame(game.humanSide);
      renderMatchup();
    } else {
      void game.newGame().catch((err) => console.error('newGame failed', err));
    }
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
  if (game.isRemote) {
    matchupEl.textContent = `Ty: ${me?.name ?? '?'} (${COLOR_NAME[manager.humanColor]}) · Kamarád (${COLOR_NAME[other]})`;
    return;
  }
  if (boardMode === 'lesson') {
    matchupEl.textContent = '';
    return;
  }
  if (manager.colorPreference === 'two' && boardMode === 'play') {
    matchupEl.textContent = `Dva hráči · ${COLOR_NAME[manager.humanColor]}: ${me?.name ?? '?'} · ${COLOR_NAME[other]}: ${them?.name ?? '?'}`;
    return;
  }
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
      opponentSelect.value = campaignOpponent ?? manager.opponentPreference;
      opponentSelect.disabled = campaignOpponent !== null;
      opponentSelect.title = campaignOpponent !== null ? 'Soupeře určuje kampaň' : '';
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
    campaignHooks?.afterAnimalChange();
    render();
  });
  opponentSelect.addEventListener('change', () => {
    manager.setOpponentPreference(opponentSelect.value);
    render();
  });
  // Colour is a preference; changing it means a new game (the controller draws via nextColor).
  sideSelect.addEventListener('change', async () => {
    const wanted = sideSelect.value as ColorPreference;
    if (!game.isRemote && game.gameInProgress) {
      sideSelect.value = manager.colorPreference; // unchanged until the player confirms
      if (!(await confirmDiscard(sideSelect.closest('label') ?? sideSelect))) return;
      sideSelect.value = wanted;
    }
    manager.setColorPreference(wanted);
    if (!game.isRemote) void game.newGame().catch((err) => console.error('newGame failed', err)); // a friend game keeps its colours
    render();
  });
  render();
  return render;
}

// ---- Campaign (Phase 11 / R8) -------------------------------------------------------------
// Session state: the opponent being played (null = campaign not active) and, after a win,
// the opponent the next `Nová hra` switches to. Progress itself is in `skm.campaign`.
// The hooks exist once the piece-set manager (and with it the library) has loaded.
let campaignOpponent: string | null = null;
let campaignNext: string | null = null;
let campaignState: CampaignState | null = null;
let campaignHooks: { afterGame: (r: GameRecord) => void; beforeNewGame: () => void; afterAnimalChange: () => void; currentDifficulty: () => Difficulty | null } | null = null;
const campaignBar = requireElement<HTMLElement>(app, '.campaign-bar');
const campaignText = requireElement<HTMLElement>(app, '.campaign-text');
const campaignNextBtn = requireElement<HTMLButtonElement>(app, '.campaign-next');
const campaignOpenBtn = requireElement<HTMLButtonElement>(app, '.campaign-open');
const campaignButton = requireElement<HTMLButtonElement>(app, '.campaign');

function wireCampaign(manager: PieceSetManager, rerenderSelects: () => void): void {
  const state: CampaignState = readCampaign(safeLocalStorage(), manager.animals);
  campaignState = state;
  const save = (): void => writeCampaign(safeLocalStorage(), state);
  const other = (): 'w' | 'b' => (manager.humanColor === 'w' ? 'b' : 'w');
  const nextUndefeated = (): string | null => campaignStep(state, manager.animals, manager.animal)?.animal.id ?? null;

  /** Sets the engine strength of the step `opponentId` occupies; false when it is not an opponent. */
  const strengthOf = (opponentId: string): Difficulty | null => {
    const step = campaignStep(state, manager.animals, manager.animal, opponentId);
    return step ? interpolateDifficulty(step.x) : null;
  };
  const applyStrength = (opponentId: string): boolean => {
    const d = strengthOf(opponentId);
    if (!d) return false;
    void game.setDifficultyOverride(d).catch((err) => console.error('setDifficultyOverride failed', err));
    return true;
  };

  const renderBar = (): void => {
    campaignBar.hidden = campaignOpponent === null;
    if (campaignOpponent === null) return;
    const step = campaignStep(state, manager.animals, manager.animal, campaignOpponent);
    const next = campaignNext ? manager.animals.find((a) => a.id === campaignNext) : null;
    const done = nextUndefeated() === null;
    const losses = step ? (state.losses[step.animal.id] ?? 0) : 0;
    campaignText.textContent = !step
      ? 'Kampaň'
      : done
        ? `Kampaň hotová — všichni poraženi! (${step.index + 1}/${step.total})`
        : `Kampaň ${step.index + 1}/${step.total} · soupeř ${step.animal.name}${losses > 0 ? ` · pokusů: ${losses}` : ''}`;
    campaignNextBtn.hidden = !next;
    if (next) campaignNextBtn.textContent = `Další: ${next.name}`;
  };

  const play = async (opponentId: string): Promise<void> => {
    if (!manager.isLibrary || !strengthOf(opponentId)) return;
    if (!(await mayLeaveGame())) return; // U1 F4: asked before anything changes
    if (!applyStrength(opponentId)) return;
    if (manager.colorPreference === 'two') manager.setColorPreference('random'); // the campaign is against the computer
    campaignOpponent = opponentId;
    campaignNext = null;
    manager.forceOpponent(opponentId);
    rerenderSelects();
    renderBar();
    void game
      .newGame()
      .then(() => game.startPlaying())
      .catch((err) => console.error('campaign newGame failed', err));
  };

  const leave = (): void => {
    campaignOpponent = null;
    campaignNext = null;
    manager.forceOpponent(null);
    void game.setDifficultyOverride(null).catch((err) => console.error('setDifficultyOverride failed', err));
    rerenderSelects();
    renderBar();
  };

  const dialog = buildCampaignDialog({
    dialog: requireElement<HTMLDialogElement>(app, '.campaign-dialog'),
    state: () => state,
    animals: () => manager.animals,
    playerId: () => manager.animal,
    currentOpponent: () => campaignOpponent,
    image: (id) => manager.characterImage(id, 'light', 'K'),
    play,
    skip: (id) => {
      skipOpponent(state, id);
      save();
      if (campaignOpponent === id) campaignNext = nextUndefeated();
      renderBar();
      dialog.render();
    },
    move: (id, delta) => {
      if (!moveInOrder(state, id, delta, manager.animal)) return;
      save();
      if (campaignOpponent) applyStrength(campaignOpponent); // the step number may have changed
      renderBar();
      dialog.render();
    },
    reset: () => {
      resetProgress(state);
      save();
      campaignNext = null;
      renderBar();
      dialog.render();
    },
    leave,
  });

  campaignButton.addEventListener('click', () => {
    if (!manager.isLibrary) {
      window.alert('Kampaň potřebuje zvířecí figurky — vyber styl „Hlavy“.');
      return;
    }
    dialog.open();
  });
  campaignOpenBtn.addEventListener('click', () => dialog.open());
  campaignNextBtn.addEventListener('click', () => {
    if (campaignNext) void play(campaignNext);
  });

  campaignHooks = {
    currentDifficulty: () => (campaignOpponent ? strengthOf(campaignOpponent) : null),
    afterGame: (record) => {
      if (record.mode === 'friend') return; // a friend over a link is not a campaign opponent
      if (campaignOpponent === null || record.source !== 'app' || record.humanColor === null || record.sans.length === 0) return;
      if (record.startFen !== DEFAULT_POSITION) return; // endgame training, not a campaign game
      if (manager.animalOf(other())?.id !== campaignOpponent) return;
      const won = (record.result === '1-0' && record.humanColor === 'w') || (record.result === '0-1' && record.humanColor === 'b');
      recordCampaignGame(state, campaignOpponent, won);
      save();
      if (won) {
        campaignNext = nextUndefeated();
        if (campaignNext) applyStrength(campaignNext); // the engine is idle: only future games are affected
      }
      renderBar();
    },
    beforeNewGame: () => {
      if (campaignOpponent === null || campaignNext === null) return;
      campaignOpponent = campaignNext;
      campaignNext = null;
      manager.forceOpponent(campaignOpponent);
      rerenderSelects();
      renderBar();
    },
    afterAnimalChange: () => {
      if (campaignOpponent === null) return;
      if (campaignOpponent === manager.animal) {
        const next = nextUndefeated();
        if (next === null) {
          leave();
          return;
        }
        campaignOpponent = next;
        campaignNext = null;
        manager.forceOpponent(next);
      }
      applyStrength(campaignOpponent); // the step count changed with the excluded character
      renderBar();
    },
  };
}


// Pilot feedback (P3): the helpers are OFF by default — a child should learn to see a
// hanging piece and to think before moving; adults switch them on explicitly.
function readFeedbackSetting(): boolean {
  try {
    return window.localStorage.getItem(FEEDBACK_STORAGE_KEY) === 'on'; // default off
  } catch {
    return false;
  }
}

/** Take-backs per game: 0, 3 (default) or null = unlimited. */
function readUndoLimitSetting(): number | null {
  try {
    const v = window.localStorage.getItem(UNDO_LIMIT_STORAGE_KEY);
    if (v === 'unlimited') return null;
    if (v === '0' || v === '3') return Number(v);
    return 3;
  } catch {
    return 3;
  }
}

function writeUndoLimitSetting(limit: number | null): void {
  try {
    window.localStorage.setItem(UNDO_LIMIT_STORAGE_KEY, limit === null ? 'unlimited' : String(limit));
  } catch (err) {
    console.warn('Could not persist the undo-limit setting', err);
  }
}

/** The selected level (1–7); anything else stored reads as the default. */
function readDifficultySetting(): DifficultyLevel {
  try {
    const v = Number(window.localStorage.getItem(DIFFICULTY_STORAGE_KEY));
    return isDifficultyLevel(v) ? v : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

function writeDifficultySetting(level: DifficultyLevel): void {
  try {
    window.localStorage.setItem(DIFFICULTY_STORAGE_KEY, String(level));
  } catch (err) {
    console.warn('Could not persist the difficulty setting', err);
  }
}

// A game in progress is not thrown away unasked (Nová hra, a colour change): a small
// question under `anchor`, answered in the page (no window.confirm). One at a time.
let pendingConfirm: ((ok: boolean) => void) | null = null;
function confirmDiscard(anchor: Element): Promise<boolean> {
  pendingConfirm?.(false);
  return new Promise((resolve) => {
    const bar = document.createElement('div');
    bar.className = 'confirm-bar';
    bar.setAttribute('role', 'alertdialog');
    const text = document.createElement('p');
    text.textContent = 'Opravdu ukončit rozehranou partii?';
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'confirm-yes';
    yes.textContent = 'Ano, ukončit';
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'confirm-no';
    no.textContent = 'Ne, hrát dál';
    bar.append(text, yes, no);
    const done = (ok: boolean): void => {
      if (pendingConfirm !== done) return;
      pendingConfirm = null;
      bar.remove();
      resolve(ok);
    };
    pendingConfirm = done;
    yes.addEventListener('click', () => done(true));
    no.addEventListener('click', () => done(false));
    anchor.after(bar);
    bar.scrollIntoView({ block: 'nearest' });
    no.focus({ preventScroll: true });
    // Asked from inside a modal (Kampaň) that closes right after: focus the answer once the
    // dialog has handed focus back to its opener.
    window.requestAnimationFrame(() => {
      if (bar.isConnected) no.focus({ preventScroll: true });
    });
  });
}
/**
 * U1 F4: before a mode takes the board (Úlohy, Koncovky, Kampaň, a lesson), a game in
 * progress — or a game with a friend over a link — is not thrown away unasked.
 */
async function mayLeaveGame(): Promise<boolean> {
  if (!game.gameInProgress && !(game.isRemote && game.anythingInProgress)) return true;
  return confirmDiscard(requireElement<HTMLElement>(app, '.buttons'));
}

/**
 * U1 F2: after every start the board is what matters. Scrolls it into view when any part of
 * it is off-screen (on phones the panel sits below the board) and folds the settings.
 */
function revealBoard(): void {
  const stage = app.querySelector<HTMLElement>('.stage');
  if (!stage) return;
  window.requestAnimationFrame(() => {
    const r = stage.getBoundingClientRect();
    const visible = window.visualViewport?.height ?? window.innerHeight;
    if (r.top >= 0 && r.bottom <= visible) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 4), behavior: smooth ? 'smooth' : 'auto' });
  });
}

/** Leaving a mode for the pre-game (Konec koncovek / lekcí): the settings open again, if the player keeps them open. */
let settingsWanted = false;

function unfoldSettings(): void {
  const settings = app.querySelector<HTMLDetailsElement>('details.settings');
  if (settings) settings.open = settingsWanted;
}

/** A game, puzzle, ending or review starts: settings fold away and the board comes into view. */
function onBoardStart(): void {
  const settings = app.querySelector<HTMLDetailsElement>('details.settings');
  if (settings) settings.open = false;
  revealBoard();
}

// A reload or a closed tab would lose the game too: let the browser ask.
window.addEventListener('beforeunload', (e) => {
  if (game.gameInProgress) e.preventDefault();
});

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

// Compact panel: once the first move is played, fold the settings away (on every width —
// the move list needs the room beside the board) and, on narrow screens, the move list
// too; a new game unfolds the settings again. Pure view logic driven by the rendered move
// list, so the controller stays unaware of it.
const settingsPanel = requireElement<HTMLDetailsElement>(app, '.settings');
// The settings start folded (a new player sees the board, not ten drop-downs); one tap on
// the summary opens them and the choice is remembered (`settingsWanted` is what the
// pre-game shows). Only a tap before the first move counts: peeking mid-game does not.
const SETTINGS_OPEN_KEY = 'skm.settingsOpen';
settingsWanted = safeLocalStorage()?.getItem(SETTINGS_OPEN_KEY) === '1';
requireElement<HTMLElement>(settingsPanel, 'summary').addEventListener('click', () => {
  if (lastPlies > 0) return;
  settingsWanted = !settingsPanel.open; // the click has not toggled it yet
  try {
    safeLocalStorage()?.setItem(SETTINGS_OPEN_KEY, settingsWanted ? '1' : '0');
  } catch {
    // blocked storage: the choice just lasts for this visit
  }
});
const movesPanel = requireElement<HTMLDetailsElement>(app, '.moves');
const movesSummary = requireElement<HTMLElement>(app, '.moves-summary');
const moveListEl = requireElement<HTMLElement>(app, '.move-list');
const narrow = window.matchMedia('(max-width: 899px)');
let lastPlies = -1;

function syncPanels(): void {
  // Only the moves themselves (their glyph is a nested span), read without the glyph.
  const sans = Array.from(moveListEl.querySelectorAll<HTMLElement>('li > span.san'))
    .map((el) => el.dataset.san ?? '')
    .filter((t) => t.length > 0);
  const plies = sans.length;
  movesSummary.textContent = plies === 0 ? '' : `(${plies}) … ${sans[plies - 1]}`;
  if (plies !== lastPlies) {
    if (lastPlies <= 0 && plies > 0) {
      settingsPanel.open = false; // game started: make room for the board / the move list
      if (narrow.matches) movesPanel.open = false;
    } else if (plies === 0 && boardMode === 'play' && game.preGame) {
      // A new game waiting for `Hrát`: settings matter again. (Not an ending that starts
      // with no moves, nor a game already started — U1 F6.)
      settingsPanel.open = settingsWanted;
      if (narrow.matches) movesPanel.open = false;
    }
  }
  lastPlies = plies;
}

new MutationObserver(syncPanels).observe(moveListEl, { childList: true, subtree: true, characterData: true });
narrow.addEventListener('change', () => {
  if (!narrow.matches) {
    settingsPanel.open = lastPlies <= 0 && settingsWanted;
    movesPanel.open = true; // the wide layout always shows the moves
  } else {
    settingsPanel.open = lastPlies === 0 && settingsWanted;
    movesPanel.open = false;
  }
});
if (narrow.matches) movesPanel.open = false;
syncPanels();

// `#hra=` on load / rejoin: last, once every view and the controller exist (joining renders
// the friend bar, which reaches into the controller and the status views).
{
  const room = roomFromLocation(location.hash);
  if (room) friendPanel.join(room);
  else friendPanel.rejoin(); // a reload or a re-opened tab within 24 h of the last friend game
}
