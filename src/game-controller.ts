/**
 * The single stateful object of the app. Owns the chess.js game, the board bridge,
 * the engine and the UI element references. No module-level mutable state exists
 * anywhere else.
 *
 * Concurrency: at most one engine search is in flight (`pendingSearch`). Every
 * transition that talks to the engine (new game, undo, difficulty, side) first cancels
 * and *awaits* that search, then checks a generation counter so that overlapping
 * transitions cannot interleave. An engine result is applied only if it is still the
 * pending search *and* was computed for the current position.
 */
import { Chess, DEFAULT_POSITION, type Color, type Square } from 'chess.js';
import type { Api } from '@lichess-org/chessground/api';
import {
  createBoardBridge,
  toBoardColor,
  type BoardBridge,
  type BoardColor,
} from './board-bridge';
import { DEFAULT_DIFFICULTY, difficulty, isDifficultyLevel, type Difficulty, type DifficultyLevel } from './difficulty';
import { MATE_SCORE, type Analysis, type Engine, type EngineOptions, type PvLine, type Search, type UciMove } from './engine';
import { ANALYSIS, classifyMove, isObviousMove, sacrificeOf, uciToMove, type Glyph, type PreviousMove } from './feedback';
import { gameStatus, type GameStatus } from './game-status';
import { commentaryFor, pick, positionAt, type PlyRecord, type SpeakerVoice } from './review';
import { DEFAULT_VOICE, ENDINGS, PUZZLE_BUBBLES } from './commentary';
import { analyseGame, type AnalysisHandle } from './analysis';
import { newGameId, replayRecord, resultOf, type GameRecord } from './games';
import { renderEvalBar } from './ui/eval-bar';
import { populateControls, renderControls } from './ui/controls';
import { renderMoveList } from './ui/move-list';
import { promptPromotion, type PromotionPiece } from './ui/promotion-dialog';
import {
  bindReviewControls,
  renderReviewControls,
  type ReviewControlElements,
} from './ui/review-controls';
import { renderSpectators, type Outcome, type SpectatorElements } from './ui/spectators';
import { capturedMaterial } from './material';
import { renderStatus, type EngineIndicator } from './ui/status';

export interface GameControllerElements {
  board: HTMLElement;
  status: HTMLElement;
  moveList: HTMLElement;
  newGameButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  difficultySelect: HTMLSelectElement;
  feedbackSelect: HTMLSelectElement;
  undoLimitSelect: HTMLSelectElement;
  promotionDialog: HTMLDialogElement;
  /** "Rozbor": shown only once the game is over. */
  reviewButton: HTMLButtonElement;
  reviewControls: ReviewControlElements;
  spectators: SpectatorElements;
  /** Phase 9: whole-game analysis button (in the review) and the eval bar beside the board. */
  analyseButton: HTMLButtonElement;
  evalBar: HTMLElement;
  /** `Vzdát`: shown during a game against the computer; two clicks end it as a loss. */
  resignButton: HTMLButtonElement;
  /** U1: the big `▶ Hrát` over the empty middle of the board, shown only before the game starts. */
  startButton: HTMLButtonElement;
}

export interface GameControllerOptions {
  /** Move feedback (glyphs) on/off at start; persisted by the caller via onFeedbackChange. */
  feedbackEnabled: boolean;
  onFeedbackChange: (enabled: boolean) => void;
  /** Pilot P3: how many take-backs a game allows (null = unlimited). */
  undoLimit: number | null;
  onUndoLimitChange: (limit: number | null) => void;
  /** The kings' voices in the review, by colour; view-only. */
  voiceOf: (color: Color) => SpeakerVoice;
  /** Asked at every new game: which colour the human plays (the view holds the preference). */
  nextColor: () => Color;
  /** B7: the next game is two people at one board — no engine, white below. */
  twoPlayer: () => boolean;
  /** Phase 20: a game over a link started; the view shows who is who. */
  onRemoteStart: (humanColor: Color) => void;
  /** Phase 20: the human's move in a game over a link (SAN + its ply index), to send. */
  onRemoteMove: (san: string, ply: number) => void;
  /** Phase 20: `Nová hra` (or a puzzle/training) left the game over a link. */
  onRemoteEnd: () => void;
  /** Told after every new game which colour was drawn. */
  onNewGame: (color: Color) => void;
  /** Display names of the two sides for saved games ("kůzlata", "hadi", …). */
  sideNames: () => { white: string; black: string };
  /** A game just ended (or its analysis finished): persist it. */
  onGameRecord: (record: GameRecord) => void;
  /** A saved/pasted game was opened in the review (the view shows its players). */
  onGameLoaded: (record: GameRecord) => void;
  /**
   * `Hrát!` (Phase 12): the view may run the piece drop; while the returned handle is
   * pending the board stays locked and the engine waits. Null = start at once.
   */
  onGameStart: (humanColor: Color) => { done: Promise<void>; cancel: () => void } | null;
  /** Puzzle mode events (Phase 10): a puzzle started for the given human colour; a result. */
  onPuzzleStart: (humanColor: Color) => void;
  /** Endgame training (Phase 13): a position was set up for the given human colour. */
  onTrainingStart: (humanColor: Color) => void;
  onPuzzleResult: (result: 'wrong' | 'correct' | 'solved') => void;
  /** The engine became loading / ready / failed (the view offers `Zkusit znovu` while failed). */
  onEngineState?: (state: EngineState) => void;
  /** The level selected at start (persisted by the caller via onDifficultyChange). */
  difficulty: DifficultyLevel;
  onDifficultyChange: (level: DifficultyLevel) => void;
  /** `Nová hra` would throw away a game in progress: the view asks first; false = keep playing. */
  confirmDiscard: () => Promise<boolean>;
  /**
   * Phase 21a: lesson mode ended because another mode took the board (`Nová hra`, a puzzle,
   * a friend's link…) — the view detaches the lesson board and hides the lesson panel.
   */
  onLessonEnd?: () => void;
  /**
   * Sound effects (branch feat-sounds): a ply was just applied to the board. `mine` = the
   * player sitting at this device made it (human move, either side of a two-player game);
   * false = the computer or the remote friend's move arrived. The view maps this to a
   * move/opponent-move/capture/check sound — never called during a lesson (lessons own
   * their board and never reach afterPositionChange) or for puzzle attempts (those go
   * through onPuzzleResult instead).
   */
  onMove?: (info: { mine: boolean; capture: boolean; check: boolean }) => void;
}

/** Glyphs the child's king comments on during play (the review comments on all of them). */
const SPOKEN_GLYPHS: ReadonlySet<Glyph> = new Set<Glyph>(['!!', '!', '?!', '?', '??']);
/** How long `Vzdát` waits for the confirming second click. */
const RESIGN_CONFIRM_MS = 4000;

/** Puzzle mode state: Lichess semantics, `moves[0]` is the opponent's. */
interface PuzzleState {
  moves: string[];
  index: number;
  /** 0 none, 1 piece circled, 2 destination circled too. */
  hint: 0 | 1 | 2;
  attempts: number;
  message: 'start' | 'correct' | 'wrong' | 'solved';
}

export type EngineState = 'loading' | 'ready' | 'failed';

/** Result of the pre-move analysis (A): what the engine thought before the human moved. */
interface PreMoveInfo {
  fen: string;
  evalBefore: number; // human POV
  bestMove: UciMove | null;
  secondBestEval: number | null; // human POV
  bestLine: UciMove[];
  secondLine: UciMove[] | null;
}

/** Engine options currently loaded: the level's play settings, full-strength analysis, or stale (level changed; reload before the next search). */
type EngineMode = 'play' | 'analysis' | 'stale';

/**
 * Pilot feedback: the computer answered in a blink, which read as "it is not thinking"
 * and pulled the child into blitzing back. Its reply now arrives no sooner than this long
 * after the human's move (search time counts towards it); the board stays locked and the
 * status reads "přemýšlím…" meanwhile.
 */
const THINK_PAUSE_MS: readonly [number, number] = [1000, 2000];

export class GameController {
  private readonly chess: Chess;
  private readonly board: BoardBridge;
  private humanColor: Color = 'w';
  private difficultyLevel: DifficultyLevel;
  /** Phase 11: the campaign's interpolated strength, replacing the selected level while set. */
  private difficultyOverride: Difficulty | null = null;
  private engineState: EngineState = 'loading';
  /** The one in-flight search, or null. */
  private pendingSearch: Search | null = null;
  private promotionOpen = false;
  /** Generation counter for async transitions; a superseded transition returns early. */
  private transition = 0;
  /** Move feedback (Phase 4). */
  private feedbackEnabled: boolean;
  /** Pilot P3: take-backs allowed per game (null = unlimited); counts down, resets at a new game. */
  private undoBudget: number | null;
  private undosLeft: number | null;
  /** The one in-flight analysis (A while the human thinks, B right after the human's move). */
  private pendingAnalysis: Analysis | null = null;
  /** True while analysis B runs: board locked, status "hodnotím…". */
  private evaluating = false;
  private preMove: PreMoveInfo | null = null;
  /** Feedback per ply (index = ply of the human's move); missing = none. */
  private plies: (PlyRecord | null)[] = [];
  private engineMode: EngineMode = 'play';
  /** Post-game review (Phase 5B): the ply being shown, or null while playing. */
  private reviewPly: number | null = null;
  /** Phase 9: the record of the game on the board (saved on game end / loaded for review). */
  private record: GameRecord | null = null;
  private gameAnalysis: AnalysisHandle | null = null;
  private analysisProgress: string | null = null;
  /** Phase 10: the puzzle being solved, or null. */
  private puzzle: PuzzleState | null = null;
  private puzzleTimer: number | null = null;
  /**
   * Pre-game (Phase 8): after `Nová hra` the position is set up but nothing moves until the
   * player presses `Hrát` (or, playing white, simply makes a move). Lets the child pick the
   * character and the colour before the engine's first move.
   */
  private started = false;
  /** B7: two players at one board (no engine, both colours movable). Set per game. */
  private twoPlayer = false;
  /** Phase 20: a game over a link — this browser moves `humanColor`, the other side's moves arrive by `applyRemoteMove`. */
  private remote = false;
  /** Phase 20: the friend has not opened the link yet — the status line says so instead of "Na tahu". */
  private remoteWaiting = false;
  /** Phase 12: the piece drop in progress (board locked, engine waiting), or null. */
  private starting: { done: Promise<void>; cancel: () => void } | null = null;
  /** The human resigned this game (it is over, lost, and saved like any finished game). */
  private resigned = false;
  /** Endgame training (Phase 13) is on the board: no `Vzdát` (the panel has its own flow). */
  private training = false;
  /** `Vzdát` was clicked once; a second click within RESIGN_CONFIRM_MS resigns. */
  private resignArmed: number | null = null;
  /**
   * Phase 21a: a lesson runs on the board — the lesson board drives chessground directly,
   * so the controller neither syncs the board nor starts the engine; it only shows this
   * text in the status line. Null = no lesson.
   */
  private lessonStatus: string | null = null;

  constructor(
    private readonly els: GameControllerElements,
    /** Replaced only by `retryEngine` after a failure. */
    private engine: Engine,
    private readonly options: GameControllerOptions,
  ) {
    this.feedbackEnabled = options.feedbackEnabled;
    this.difficultyLevel = isDifficultyLevel(options.difficulty) ? options.difficulty : DEFAULT_DIFFICULTY;
    this.undoBudget = options.undoLimit;
    this.undosLeft = options.undoLimit;
    this.chess = new Chess();
    this.board = createBoardBridge(els.board, (from, to) => this.handleUserMove(from, to));

    populateControls(this.controlsElements());
    els.newGameButton.addEventListener('click', () => {
      if (!this.started) this.startPlaying();
      else if (this.gameInProgress) {
        void this.options
          .confirmDiscard()
          .then((ok) => (ok ? this.newGame() : undefined))
          .catch((err) => console.error('newGame failed', err));
      } else void this.newGame().catch((err) => console.error('newGame failed', err));
    });
    els.resignButton.addEventListener('click', () => this.resignClicked());
    els.startButton.addEventListener('click', () => this.startPlaying());
    // Playing white the child may simply move: while a piece is picked up the button lets
    // taps through to the squares under it (e4, d4…) instead of catching them.
    // Recomputed on any tap (a tap outside the board also drops the selection) and on every render.
    document.addEventListener('pointerdown', () => {
      window.requestAnimationFrame(() => this.syncStartSeeThrough());
    });
    els.undoButton.addEventListener('click', () => {
      void this.undo().catch((err) => console.error('undo failed', err));
    });
    els.difficultySelect.addEventListener('change', () => {
      const level = Number(els.difficultySelect.value);
      if (!isDifficultyLevel(level)) {
        console.error('Unknown difficulty selected', els.difficultySelect.value);
        return;
      }
      void this.setDifficulty(level).catch((err) => console.error('setDifficulty failed', err));
    });
    els.undoLimitSelect.addEventListener('change', () => {
      const v = els.undoLimitSelect.value;
      this.setUndoLimit(v === 'unlimited' ? null : Number(v));
    });
    els.feedbackSelect.addEventListener('change', () => {
      void this.setFeedback(els.feedbackSelect.value === 'on').catch((err) =>
        console.error('setFeedback failed', err),
      );
    });
    els.reviewButton.addEventListener('click', () => this.startReview());
    els.analyseButton.addEventListener('click', () => {
      void this.analyseGame().catch((err) => console.error('analyseGame failed', err));
    });
    bindReviewControls(els.reviewControls, {
      onFirst: () => this.reviewGo(0),
      onPrev: () => this.reviewGo((this.reviewPly ?? 0) - 1),
      onNext: () => this.reviewGo((this.reviewPly ?? 0) + 1),
      onLast: () => this.reviewGo(this.chess.history().length),
      isActive: () => this.reviewPly !== null,
    });

    this.watchEngine(engine);

    void this.newGame().catch((err) => console.error('newGame failed', err));
  }

  async newGame(): Promise<void> {
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.endLesson();
    this.leaveRemote();
    this.twoPlayer = this.options.twoPlayer();
    this.humanColor = this.twoPlayer ? 'w' : this.options.nextColor();
    this.chess.reset();
    this.plies = [];
    this.preMove = null;
    this.reviewPly = null;
    this.record = null;
    this.clearPuzzle();
    this.resigned = false;
    this.training = false;
    this.undosLeft = this.undoBudget;
    this.started = false; // wait for `Hrát` (or the human's first move)
    if (this.engineState === 'ready') this.engine.newGame();
    this.options.onNewGame(this.humanColor);
    this.afterPositionChange();
  }

  /**
   * Endgame training (Phase 13): the position is on the board, the game is on at once
   * (no `Hrát!`, no piece drop) and the engine plays the other side. Caller sets the
   * trainer strength through `setDifficultyOverride`.
   */
  async startTraining(fen: string, humanColor: Color): Promise<void> {
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.endLesson();
    this.chess.load(fen);
    this.plies = [];
    this.preMove = null;
    this.record = null;
    this.reviewPly = null;
    this.clearPuzzle();
    this.leaveRemote();
    this.resigned = false;
    this.training = true;
    this.twoPlayer = false;
    this.humanColor = humanColor;
    this.started = true;
    if (this.engineState === 'ready') this.engine.newGame();
    this.options.onTrainingStart(humanColor);
    this.afterPositionChange();
  }

  /**
   * Phase 20: a game over a link. `sans` is what the room already has (a reconnect or a
   * reload replays it); the game is on at once, no `Hrát!`, no engine, no take-backs.
   */
  async startRemoteGame(humanColor: Color, sans: readonly string[]): Promise<'playing' | 'over' | 'broken'> {
    const t = await this.beginTransition();
    if (t !== this.transition) return 'broken';
    this.endLesson();
    // The room holds what the other seat sent; only chess.js decides whether it is a game.
    const replay = new Chess();
    try {
      for (const san of sans) replay.move(san);
    } catch (err) {
      console.error('The room holds a move chess.js refuses', err);
      return 'broken';
    }
    this.chess.reset();
    for (const san of sans) this.chess.move(san);
    this.plies = sans.map(() => null);
    this.preMove = null;
    this.reviewPly = null;
    this.clearPuzzle();
    this.resigned = false;
    this.training = false;
    this.twoPlayer = false;
    this.remote = true;
    this.humanColor = humanColor;
    this.started = true;
    this.record = null;
    this.options.onRemoteStart(humanColor); // the view sets the sides' names before any record is built
    // A game that was already over when we (re)joined was recorded when it ended: keep it out of the store.
    if (this.chess.isGameOver() && sans.length > 0) this.record = this.buildRecord();
    this.afterPositionChange();
    return this.chess.isGameOver() ? 'over' : 'playing';
  }

  /** Phase 20: the other side's move from the room. False = not ours to take (wrong turn, illegal, no remote game). */
  applyRemoteMove(san: string, ply: number): boolean {
    if (!this.remote || this.reviewPly !== null || this.promotionOpen) return false;
    if (ply !== this.chess.history().length || this.chess.turn() === this.humanColor) return false;
    try {
      this.chess.move(san);
    } catch (err) {
      console.error('Remote move rejected by chess.js', san, this.chess.fen(), err);
      return false;
    }
    this.plies.push(null);
    this.notifyMove(false);
    this.afterPositionChange();
    return true;
  }

  /**
   * A game the child is playing and has not finished: `Nová hra`, a colour change or a
   * reload would throw it away. A game over a link is not counted (it lives in the room).
   */
  get gameInProgress(): boolean {
    return this.started && this.chess.history().length > 0 && !this.status().over && this.reviewPly === null && this.puzzle === null && !this.remote && this.record === null;
  }

  /** `Vzdát` is offered: a game against the computer in progress (not training, not two players). */
  private canResign(status: GameStatus): boolean {
    return (
      this.started &&
      this.starting === null &&
      !this.promotionOpen &&
      this.chess.history().length > 0 &&
      !status.over &&
      this.reviewPly === null &&
      this.puzzle === null &&
      !this.remote &&
      !this.twoPlayer &&
      !this.training &&
      this.engineState !== 'failed' &&
      this.record === null
    );
  }

  /** First click arms the button ("Opravdu vzdát?"), the second within a few seconds resigns. */
  private resignClicked(): void {
    if (!this.canResign(this.status())) return;
    if (this.resignArmed === null) {
      this.resignArmed = window.setTimeout(() => {
        this.resignArmed = null;
        this.renderResign(this.status());
      }, RESIGN_CONFIRM_MS);
      this.renderResign(this.status());
      return;
    }
    this.disarmResign();
    void this.resign().catch((err) => console.error('resign failed', err));
  }

  private disarmResign(): void {
    if (this.resignArmed !== null) window.clearTimeout(this.resignArmed);
    this.resignArmed = null;
  }

  /** The human gives up: the game ends as their loss and is saved like any finished game. */
  async resign(): Promise<void> {
    if (!this.canResign(this.status())) return;
    const t = await this.beginTransition(); // stops the engine's search / the analysis
    if (t !== this.transition || !this.canResign(this.status())) return;
    this.resigned = true;
    this.preMove = null;
    this.afterPositionChange(); // over now: the record is built and handed on
  }

  private renderResign(status: GameStatus): void {
    const btn = this.els.resignButton;
    const offered = this.canResign(status);
    if (!offered) this.disarmResign();
    btn.hidden = !offered;
    const armed = this.resignArmed !== null;
    btn.textContent = armed ? 'Opravdu vzdát?' : 'Vzdát';
    btn.classList.toggle('armed', armed);
  }

  /** chess.js's status, or the resignation (which chess.js knows nothing about). */
  private status(): GameStatus {
    if (!this.resigned) return gameStatus(this.chess);
    return { over: true, text: `Vzdáno — vyhrává ${this.humanColor === 'w' ? 'černý' : 'bílý'}` };
  }

  get isRemote(): boolean {
    return this.remote;
  }

  /** Phase 20: a game (or a puzzle, a training position) under way that a new friend game would end. */
  get anythingInProgress(): boolean {
    return this.started && this.reviewPly === null && !this.chess.isGameOver();
  }

  /** Phase 20: the friend-bar says whether we are still waiting for the friend to join. */
  setRemoteWaiting(waiting: boolean): void {
    if (this.remoteWaiting === waiting) return;
    this.remoteWaiting = waiting;
    if (this.remote) this.refreshView();
  }

  /** The colour this browser moves. */
  get humanSide(): Color {
    return this.humanColor;
  }

  private leaveRemote(): void {
    if (!this.remote) return;
    this.remote = false;
    this.remoteWaiting = false;
    this.options.onRemoteEnd();
  }

  /**
   * Phase 21a: hands the board to a lesson. Stops any search/analysis/piece drop, drops a
   * puzzle, training, review or friend game, and resets the game underneath (the caller
   * has asked before discarding a game in progress). Returns the chessground instance for
   * the lesson board, or null when a newer transition superseded this one.
   */
  async startLesson(status: string): Promise<Api | null> {
    const t = await this.beginTransition();
    if (t !== this.transition) return null;
    this.leaveRemote();
    this.clearPuzzle();
    this.disarmResign();
    this.chess.reset();
    this.plies = [];
    this.preMove = null;
    this.record = null;
    this.reviewPly = null;
    this.resigned = false;
    this.training = false;
    this.twoPlayer = false;
    this.humanColor = 'w';
    this.started = false;
    this.lessonStatus = status;
    this.renderLessonChrome();
    return this.board.api;
  }

  /** Phase 21a: the status line while a lesson runs (e.g. another lesson started). */
  setLessonStatus(status: string): void {
    if (this.lessonStatus === null) return;
    this.lessonStatus = status;
    this.renderLessonChrome();
  }

  get inLesson(): boolean {
    return this.lessonStatus !== null;
  }

  /** `▶ Hrát` lets taps through only while it shows and a piece is picked up. */
  private syncStartSeeThrough(): void {
    const btn = this.els.startButton;
    btn.classList.toggle('see-through', !btn.hidden && this.lessonStatus === null && this.board.api.state.selected !== undefined);
  }

  /** U1: a game is set up and waits for `Hrát` (or the human's first move). */
  get preGame(): boolean {
    return !this.started && this.lessonStatus === null;
  }

  /** Phase 21a: leaves the lesson for a fresh pre-game (the view detached the lesson board first). */
  async leaveLesson(): Promise<void> {
    await this.newGame(); // newGame ends lesson mode and re-syncs the board
  }

  private endLesson(): void {
    if (this.lessonStatus === null) return;
    this.lessonStatus = null;
    this.options.onLessonEnd?.();
  }

  /** Lesson mode: the lesson owns the board; the rest of the view shows no game at all. */
  private renderLessonChrome(): void {
    const status = this.status();
    renderMoveList(this.els.moveList, [], [], null, false);
    renderStatus(this.els.status, { status, engine: 'ready', puzzle: this.lessonStatus });
    this.renderControls();
    this.els.newGameButton.textContent = 'Nová hra';
    this.els.newGameButton.classList.remove('pregame');
    this.els.startButton.hidden = true;
    this.syncStartSeeThrough();
    this.renderResign(status);
    this.els.reviewButton.hidden = true;
    renderReviewControls(this.els.reviewControls, { active: false, ply: 0, plies: 0 });
    this.els.analyseButton.hidden = true;
    renderEvalBar(this.els.evalBar, { visible: false, cp: null, orientation: 'white' });
    const material = capturedMaterial(new Chess(), this.chess);
    renderSpectators(this.els.spectators, { humanColor: 'w', bubbles: { white: null, black: null }, outcome: null, material });
  }

  /** Starts a puzzle (Phase 10): the opponent's first move plays itself after a beat. */
  async startPuzzle(fen: string, moves: string[]): Promise<void> {
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.endLesson();
    this.chess.load(fen);
    this.plies = [];
    this.preMove = null;
    this.record = null;
    this.reviewPly = null;
    this.clearPuzzle();
    this.puzzle = { moves, index: 0, hint: 0, attempts: 0, message: 'start' };
    this.resigned = false;
    this.training = false;
    this.leaveRemote();
    this.twoPlayer = false;
    this.humanColor = this.chess.turn() === 'w' ? 'b' : 'w';
    this.started = true;
    this.options.onPuzzleStart(this.humanColor);
    this.afterPositionChange();
    this.puzzleTimer = window.setTimeout(() => this.playPuzzleOpponentMove(t), 350);
  }

  /** The opponent's move from the puzzle data (never the engine). */
  private playPuzzleOpponentMove(t: number): void {
    this.puzzleTimer = null;
    if (t !== this.transition || !this.puzzle) return;
    const uci = this.puzzle.moves[this.puzzle.index];
    if (!uci) return;
    try {
      this.chess.move(uciToMove(uci));
    } catch (err) {
      console.error('Puzzle move rejected by chess.js', uci, err);
      return;
    }
    this.puzzle.index++;
    this.puzzle.hint = 0;
    this.afterPositionChange();
  }

  /** Shows the next hint step; false when there is nothing to hint (not the solver's turn). */
  puzzleHint(): boolean {
    if (!this.puzzle || this.chess.turn() !== this.humanColor) return false;
    this.puzzle.hint = this.puzzle.hint >= 2 ? 2 : ((this.puzzle.hint + 1) as 1 | 2);
    this.refreshView();
    return true;
  }

  get inPuzzle(): boolean {
    return this.puzzle !== null;
  }

  private clearPuzzle(): void {
    if (this.puzzleTimer !== null) window.clearTimeout(this.puzzleTimer);
    this.puzzleTimer = null;
    this.puzzle = null;
  }

  /**
   * Puzzle mode: compare the human's move with the solution; promotions come from the data.
   * Any checkmate solves the puzzle too (a mate-in-N often has more than one mating move).
   */
  private handlePuzzleMove(from: Square, to: Square): void {
    const puzzle = this.puzzle!;
    const expected = puzzle.moves[puzzle.index];
    if (!expected || puzzle.index % 2 === 0) {
      this.afterPositionChange();
      return;
    }
    if (`${from}${to}` !== expected.slice(0, 4)) {
      const mate = this.chess
        .moves({ square: from, verbose: true })
        .find((m) => {
          if (m.to !== to) return false;
          const probe = new Chess(this.chess.fen());
          probe.move(m.san);
          return probe.isCheckmate();
        });
      if (mate) {
        this.chess.move(mate.san);
        puzzle.index = puzzle.moves.length;
        puzzle.hint = 0;
        puzzle.message = 'solved';
        this.options.onPuzzleResult('solved');
        this.afterPositionChange();
        return;
      }
      puzzle.attempts++;
      puzzle.message = 'wrong';
      this.options.onPuzzleResult('wrong');
      this.afterPositionChange(); // re-sync: the piece snaps back
      return;
    }
    this.chess.move({ from, to, promotion: expected[4] });
    puzzle.index++;
    puzzle.hint = 0;
    if (puzzle.index >= puzzle.moves.length) {
      puzzle.message = 'solved';
      this.options.onPuzzleResult('solved');
      this.afterPositionChange();
      return;
    }
    puzzle.message = 'correct';
    this.options.onPuzzleResult('correct');
    this.afterPositionChange();
    const t = this.transition;
    this.puzzleTimer = window.setTimeout(() => this.playPuzzleOpponentMove(t), 400);
  }

  private puzzleHints(): Square[] {
    if (!this.puzzle || this.puzzle.hint === 0 || this.chess.turn() !== this.humanColor) return [];
    const expected = this.puzzle.moves[this.puzzle.index];
    if (!expected) return [];
    const squares = [expected.slice(0, 2) as Square];
    if (this.puzzle.hint === 2) squares.push(expected.slice(2, 4) as Square);
    return squares;
  }

  private puzzleStatusText(): string {
    const p = this.puzzle!;
    if (p.message === 'solved') return 'Vyřešeno!';
    const side = this.humanColor === 'w' ? 'bílé' : 'černé';
    if (p.index % 2 === 0) return 'Úloha: soupeř táhne…';
    return p.message === 'wrong' ? 'To není ono — zkus to znovu.' : `Úloha: najdi nejlepší tah za ${side}.`;
  }

  private puzzleBubble(): string {
    const p = this.puzzle!;
    const zvuk = this.options.voiceOf(this.humanColor)?.sound ?? 'Hm!';
    switch (p.message) {
      case 'solved':
        return `${zvuk} Vyřešeno! Jsi hlava.`;
      case 'correct':
        return pick(PUZZLE_BUBBLES.correct, `${p.moves.join(' ')}:${p.index}`).replace('{zvuk}', zvuk);
      case 'wrong':
        return pick(PUZZLE_BUBBLES.wrong, `${p.moves.join(' ')}:${p.index}:${p.attempts}`);
      default:
        return 'Najdi nejlepší tah!';
    }
  }

  /** Opens a saved or pasted game in the review (Phase 9). Returns false when its moves do not replay. */
  async loadGame(record: GameRecord): Promise<boolean> {
    if (replayRecord(record) === null) return false;
    const t = await this.beginTransition();
    if (t !== this.transition) return false;
    this.endLesson();
    this.leaveRemote();
    this.chess.load(record.startFen);
    for (const san of record.sans) this.chess.move(san);
    this.plies = record.plies.map((p) => (p ? { ...p } : null));
    this.record = record;
    this.resigned = false;
    this.training = false;
    this.preMove = null;
    this.humanColor = record.humanColor ?? 'w';
    this.started = true;
    this.reviewPly = 0;
    if (this.engineState === 'ready') this.engine.newGame();
    this.options.onGameLoaded(record);
    this.afterPositionChange();
    return true;
  }

  /** Whole-game analysis in the review: evals + glyphs for both sides (Phase 9). */
  async analyseGame(): Promise<void> {
    if (this.reviewPly === null || this.gameAnalysis !== null || this.engineState !== 'ready') return;
    const t = await this.beginTransition();
    if (t !== this.transition || this.reviewPly === null) return;
    this.engine.setOptions({ skillLevel: 20, multiPv: 2 });
    this.engineMode = 'analysis';
    const sans = this.chess.history();
    const handle = analyseGame(this.engine, this.startFen(), sans, (p) => {
      this.analysisProgress = `${p.done}/${p.total}`;
      this.refreshView();
    });
    this.gameAnalysis = handle;
    const result = await handle.result;
    if (this.gameAnalysis === handle) this.gameAnalysis = null;
    this.analysisProgress = null;
    if (t !== this.transition || result === null) {
      this.refreshView();
      return;
    }
    this.plies = result.plies.map((p) => ({ glyph: p.glyph, betterSan: p.betterSan, evalCp: p.evalCp, bestSan: p.bestSan }));
    if (this.record) {
      this.record = { ...this.record, plies: this.plies, startEvalCp: result.startEvalCp, startBestSan: result.startBestSan };
      this.options.onGameRecord(this.record);
    } else {
      this.record = this.buildRecord();
      this.record.startEvalCp = result.startEvalCp;
      this.record.startBestSan = result.startBestSan;
    }
    this.ensurePlayOptions();
    this.refreshView();
  }

  private buildRecord(): GameRecord {
    const names = this.options.sideNames();
    return {
      id: this.record?.id ?? newGameId(),
      playedAt: this.record?.playedAt ?? Date.now(),
      startFen: this.startFen(),
      sans: this.chess.history(),
      result: this.resigned ? (this.humanColor === 'w' ? '0-1' : '1-0') : resultOf(this.chess),
      humanColor: this.humanColor,
      white: names.white,
      black: names.black,
      plies: this.plies.map((p) => (p ? { ...p } : null)),
      source: 'app',
      level: this.currentDifficulty().level,
    };
  }

  /** `Hrát`: the set-up game begins — after the piece drop, if the view runs one — the engine opens if it has white. */
  startPlaying(): void {
    if (this.started || this.lessonStatus !== null) return;
    this.started = true;
    const drop = this.options.onGameStart(this.humanColor);
    if (!drop) {
      this.afterPositionChange();
      return;
    }
    const t = this.transition;
    this.starting = drop;
    this.refreshView(); // locked board, "Figurky nastupují…"
    void drop.done.then(() => {
      if (this.starting !== drop) return; // cancelled by a transition, which re-rendered itself
      this.starting = null;
      if (t !== this.transition) return;
      this.afterPositionChange();
    });
  }

  private cancelStarting(): void {
    if (!this.starting) return;
    const drop = this.starting;
    this.starting = null;
    drop.cancel();
  }

  /**
   * R6: undo as black at move 1. With only the engine's opening move on the board (ply
   * count 1) and the human to move next, the normal "pop 2 plies" rule would try to take
   * back both the (nonexistent) human move and the engine's move, landing on the start
   * position with the engine to move again — "Zpět" would visibly do nothing but let the
   * engine re-open. Disabled in exactly that state; every other position undoes normally.
   * Two-player mode and the failed-engine fallback have no "engine's turn" to protect and
   * are excluded, so they keep undoing one ply whenever one exists.
   */
  private undoBlockedAtEngineOpening(): boolean {
    return (
      !this.twoPlayer &&
      this.engineState !== 'failed' &&
      this.chess.history().length === 1 &&
      this.chess.turn() === this.humanColor
    );
  }

  async undo(): Promise<void> {
    if (this.chess.history().length === 0 || this.reviewPly !== null) return;
    if (this.remote) return; // no take-backs against a friend over a link (a rematch instead)
    if (this.resigned) return; // a resigned game is over and saved
    if (this.undosLeft !== null && this.undosLeft <= 0 && !this.twoPlayer) return;
    if (this.undoBlockedAtEngineOpening()) return; // R6: would reopen at the start position
    // Evaluated before the await: the position cannot change during it (board locked or idle).
    const wasEngineTurn = this.chess.turn() !== this.humanColor;
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    // Back to the most recent position where it was the human's turn:
    //  - engine to move (thinking, or game just ended after a human move): pop 1 ply
    //  - human to move: pop the engine reply and the human move: pop 2 plies
    //  - two-player fallback: pop 1 ply
    const plies = this.engineState === 'failed' || this.twoPlayer ? 1 : wasEngineTurn ? 1 : 2;
    for (let i = 0; i < plies && this.chess.history().length > 0; i++) this.chess.undo();
    this.plies.length = Math.min(this.plies.length, this.chess.history().length);
    this.preMove = null;
    if (this.undosLeft !== null && !this.twoPlayer) this.undosLeft--;
    this.afterPositionChange();
  }

  /** Pilot P3: the take-back budget for this and every next game (null = unlimited). */
  setUndoLimit(limit: number | null): void {
    this.undoBudget = limit;
    this.undosLeft = limit;
    this.options.onUndoLimitChange(limit);
    this.renderControls();
  }

  async setDifficulty(level: DifficultyLevel): Promise<void> {
    this.difficultyLevel = level;
    this.options.onDifficultyChange(level);
    await this.applyDifficulty();
  }

  /**
   * Campaign (Phase 11): plays at `d` regardless of the selected level until cleared. The
   * select shows the nearest level and is locked meanwhile.
   */
  async setDifficultyOverride(d: Difficulty | null): Promise<void> {
    this.difficultyOverride = d;
    await this.applyDifficulty();
  }

  /** The strength in force: the override, else the selected level. */
  currentDifficulty(): Difficulty {
    return this.difficultyOverride ?? difficulty(this.difficultyLevel);
  }

  private async applyDifficulty(): Promise<void> {
    // Whatever the engine has loaded no longer matches: the next idle moment reloads it
    // (beginTransition / maybeStartEngine call ensurePlayOptions). Marking instead of
    // setting here keeps a newGame() that follows immediately from racing this await.
    this.engineMode = 'stale';
    this.renderControls();
    if (this.engineState !== 'ready') return;
    const wasThinking = this.pendingSearch !== null;
    const t = await this.beginTransition(); // reloads the options once nothing is outstanding
    if (t !== this.transition) return; // a later transition took over and reloaded them itself
    if (wasThinking) this.afterPositionChange(); // restarts the search with the new settings
  }

  /** Enters the review of the finished game at the start position. */
  startReview(): void {
    if (this.reviewPly !== null || this.chess.history().length === 0 || !this.status().over) return;
    this.reviewPly = 0;
    this.refreshView();
  }

  /** Eval of the shown review position (white POV), once analysed. */
  private evalAt(ply: number): number | null {
    if (ply === 0) return this.record?.startEvalCp ?? null;
    return this.plies[ply - 1]?.evalCp ?? null;
  }

  /** The engine's best move in the shown review position, as an arrow, once analysed. */
  private bestArrowAt(shown: Chess, ply: number): { from: Square; to: Square } | null {
    const san = ply === 0 ? this.record?.startBestSan : this.plies[ply - 1]?.bestSan;
    if (!san || shown.isGameOver()) return null;
    try {
      const move = new Chess(shown.fen()).move(san);
      return { from: move.from, to: move.to };
    } catch {
      return null;
    }
  }

  private reviewGo(ply: number): void {
    if (this.reviewPly === null) return;
    const clamped = Math.max(0, Math.min(this.chess.history().length, ply));
    if (clamped === this.reviewPly) return;
    this.reviewPly = clamped;
    this.refreshView();
  }

  async setFeedback(enabled: boolean): Promise<void> {
    if (enabled === this.feedbackEnabled) return;
    this.feedbackEnabled = enabled;
    this.options.onFeedbackChange(enabled);
    this.renderControls();
    // Only an analysis needs cancelling; a running opponent search is left alone.
    if (this.pendingAnalysis !== null) {
      const t = await this.beginTransition();
      if (t !== this.transition) return;
    }
    this.preMove = null;
    this.afterPositionChange(); // enabled + human's turn → pre-move analysis starts
  }

  /** Cancels the in-flight search and returns the generation of this transition. */
  private async beginTransition(): Promise<number> {
    const t = ++this.transition;
    this.cancelStarting();
    // A search can only start synchronously inside afterPositionChange(); if one slipped
    // in while we were awaiting (e.g. the engine became ready), cancel again — but never
    // loop forever: later phases add more async entry points, and a hang here is worse
    // than one stale search (which the identity + FEN guards discard anyway).
    let attempts = 0;
    do {
      await this.cancelSearch();
      attempts++;
      if (attempts >= 2 && (this.pendingSearch !== null || this.pendingAnalysis !== null)) {
        console.error('beginTransition: search kept restarting; breaking out');
        break;
      }
    } while ((this.pendingSearch !== null || this.pendingAnalysis !== null) && t === this.transition);
    if (t === this.transition) this.ensurePlayOptions(); // nothing outstanding: safe to restore
    return t;
  }

  /** Resolves when the engine has consumed the cancelled job's bestmove (search or analysis). */
  private cancelSearch(): Promise<void> {
    this.pendingSearch = null;
    this.pendingAnalysis = null;
    this.evaluating = false;
    if (this.gameAnalysis) {
      this.gameAnalysis.cancel();
      this.gameAnalysis = null;
      this.analysisProgress = null;
    }
    return this.engine.stop();
  }

  /** Restores the level's play options after an analysis. Caller guarantees nothing outstanding. */
  private ensurePlayOptions(): void {
    if (this.engineMode === 'play' || this.engineState !== 'ready') return;
    this.engine.setOptions(this.playOptions());
    this.engineMode = 'play';
  }

  /** The level's engine options; MultiPV defaults to 1 (the weak levels ask for their top-N). */
  private playOptions(): EngineOptions {
    return { multiPv: 1, ...this.currentDifficulty().options };
  }

  /** Runs one analysis at full strength; resolves null when cancelled. Caller guarantees nothing outstanding. */
  private async runAnalysis(multiPv: 1 | 2, fen: string = this.chess.fen()): Promise<PvLine[] | null> {
    this.engine.setOptions({ skillLevel: 20, multiPv });
    this.engineMode = 'analysis';
    const analysis = this.engine.analyse(fen, { depth: ANALYSIS.depth, movetimeMs: ANALYSIS.movetimeMs, multiPv });
    this.pendingAnalysis = analysis;
    const lines = await analysis.result;
    if (this.pendingAnalysis === analysis) {
      this.pendingAnalysis = null;
      this.ensurePlayOptions(); // our job was the only outstanding one and it just settled
    }
    return lines;
  }

  private feedbackActive(status: GameStatus): boolean {
    return this.feedbackEnabled && this.engineState === 'ready' && !status.over && this.puzzle === null && !this.twoPlayer && !this.remote;
  }

  /** Analysis A: evaluate the position the human is about to move in (runs while they think). */
  private startPreMoveAnalysis(): void {
    if (this.pendingSearch !== null || this.pendingAnalysis !== null || this.evaluating) return;
    // B19: a forced move cannot be judged — Stockfish answers a one-move position with a
    // depth-1 score. No analysis A, hence no glyph for that move (it was the best one).
    if (this.chess.moves().length <= 1) {
      this.preMove = null;
      return;
    }
    const gen = this.transition;
    const fen = this.chess.fen();
    this.runAnalysis(2)
      .then((lines) => {
        if (gen !== this.transition || lines === null) return; // cancelled / superseded
        if (fen !== this.chess.fen()) return; // the human already moved
        this.preMove = preMoveInfo(fen, lines) ?? this.preMove;
      })
      .catch((err) => console.error('pre-move analysis failed', err));
  }

  private watchEngine(engine: Engine): void {
    engine.ready
      .then(() => {
        if (engine !== this.engine || this.engineState !== 'loading') return; // replaced / already failed
        this.engineState = 'ready';
        this.options.onEngineState?.('ready');
        this.engine.setOptions(this.playOptions());
        this.engineMode = 'play';
        this.afterPositionChange(); // an engine turn that waited during loading starts now
      })
      .catch((err: unknown) => this.engineFailed(err, engine));
  }

  /**
   * Engine load/worker/move failure → two-player fallback until `retryEngine`. `source`:
   * the instance that reported; a failure of an already replaced one is ignored.
   */
  engineFailed(err: unknown, source: Engine = this.engine): void {
    if (source !== this.engine) return;
    if (this.engineState === 'failed') return; // idempotent: ready-rejection and onError may both report
    console.error('Engine unavailable', err);
    this.engineState = 'failed';
    this.engine.dispose(); // no-op when the engine already shut itself down
    void this.cancelSearch().catch((e) => console.error('cancelSearch failed', e));
    this.options.onEngineState?.('failed');
    this.afterPositionChange(); // two-player fallback takes effect immediately
  }

  /** `Zkusit znovu`: swaps in a freshly created engine after a failure; the game on the board goes on. */
  retryEngine(next: Engine): void {
    if (this.engineState !== 'failed') {
      next.dispose();
      return;
    }
    this.engine = next;
    this.engineState = 'loading';
    this.engineMode = 'play';
    this.options.onEngineState?.('loading');
    this.watchEngine(next);
    this.afterPositionChange();
  }

  private async handleUserMove(from: Square, to: Square): Promise<void> {
    if (this.remote && this.chess.turn() !== this.humanColor) return; // the friend's turn (the board already refuses; belt and braces)
    const candidates = this.chess
      .moves({ square: from, verbose: true })
      .filter((m) => m.to === to);
    if (candidates.length === 0) {
      // Cannot happen: the board's dests came from chess.js. Re-sync to be safe.
      console.error(`Move ${from}->${to} is not in chess.js's legal moves`);
      this.afterPositionChange();
      return;
    }
    if (this.puzzle) {
      this.handlePuzzleMove(from, to);
      return;
    }

    let promotion: PromotionPiece | undefined;
    if (candidates[0].promotion) {
      // chess.js says this is a promotion: ask which piece.
      this.promotionOpen = true;
      this.board.lock(); // board locked; the just-dropped pawn stays on the destination square (R5)
      this.render(this.status()); // controls/status disabled; syncBoard is skipped on purpose
      let choice: PromotionPiece | null = null;
      try {
        choice = await promptPromotion(this.els.promotionDialog, this.chess.turn());
      } catch (err) {
        this.promotionOpen = false;
        this.afterPositionChange(); // re-sync and unlock before the error leaves
        throw err; // the bridge's .catch logs it
      } finally {
        this.promotionOpen = false; // clears the flag only
      }
      if (choice === null) {
        this.afterPositionChange(); // cancelled: nothing applied
        return;
      }
      promotion = choice;
    }

    const fenBefore = this.chess.fen();
    let moved = false;
    try {
      this.chess.move({ from, to, promotion });
      moved = true;
      this.started = true; // playing white, the first move is the start
    } catch (err) {
      console.error(`Move ${from}->${to} rejected by chess.js`, err);
    }
    if (moved) this.notifyMove(true);
    if (moved && this.remote) {
      const history = this.chess.history();
      this.options.onRemoteMove(history[history.length - 1], history.length - 1);
    }
    if (moved) await this.evaluateHumanMove(fenBefore, `${from}${to}${promotion ?? ''}`);
    this.afterPositionChange();
  }

  /**
   * Analysis B (post-move) and classification. Board stays locked ("hodnotím…") until it
   * settles; any transition in the meantime cancels it and the move simply gets no glyph.
   */
  private async evaluateHumanMove(fenBefore: string, played: UciMove): Promise<void> {
    const status = gameStatus(this.chess);
    let pre = this.preMove && this.preMove.fen === fenBefore ? this.preMove : null;
    this.preMove = null;
    const history = this.chess.history({ verbose: true });
    const ply = history.length - 1;
    const opponentMove = history[ply - 1];
    const prev: PreviousMove | null = opponentMove ? { fen: opponentMove.before, move: opponentMove.lan } : null;
    const gen = this.transition;
    // Same conditions as analysis A (feedbackActive before the move; B19: a forced move gets no glyph).
    const wanted = this.feedbackEnabled && this.engineState === 'ready' && !this.twoPlayer && !this.remote && new Chess(fenBefore).moves().length > 1;

    const running = this.pendingAnalysis;
    if (running !== null) {
      if (wanted && pre === null && running.fen === fenBefore) {
        // A fast mover: analysis A of the position just left is still running. Let it finish
        // instead of cancelling it (a transition meanwhile cancels it and bumps `gen`).
        this.evaluating = true;
        this.refreshView();
        let lines: PvLine[] | null = null;
        try {
          lines = await running.result;
        } finally {
          this.evaluating = false;
        }
        if (gen !== this.transition || lines === null) return;
        pre = preMoveInfo(fenBefore, lines);
      } else {
        await this.cancelSearch(); // analysis A still running: let the engine settle it first
        if (gen !== this.transition) return;
      }
    }
    if (!wanted) return;
    if (pre === null && this.pendingAnalysis === null) {
      // Analysis A never ran for this position (the move came before it started): run it now.
      this.evaluating = true;
      this.refreshView();
      let lines: PvLine[] | null = null;
      try {
        lines = await this.runAnalysis(2, fenBefore);
      } finally {
        this.evaluating = false;
      }
      if (gen !== this.transition || lines === null) return;
      pre = preMoveInfo(fenBefore, lines);
    }
    if (pre === null) return;

    let evalAfter: number; // human POV
    let line: UciMove[] = []; // the opponent's reply and the engine's line after it, as far as known
    if (status.over) {
      // Nothing to search in a finished game: mate delivered = best possible, any draw = 0.
      evalAfter = this.chess.isCheckmate() ? MATE_SCORE : 0;
    } else {
      // B19: when the opponent's reply is forced, Stockfish would answer with a depth-1
      // score; evaluate the position after the forced reply instead (human to move, so
      // the score is already from the human's point of view).
      const legal = this.chess.moves({ verbose: true });
      const forced = legal.length === 1 ? legal[0] : null;
      let probeFen = this.chess.fen();
      let probeOver: number | null = null;
      if (forced) {
        line = [`${forced.from}${forced.to}${forced.promotion ?? ''}`];
        const probe = new Chess(probeFen);
        probe.move(forced.san);
        probeFen = probe.fen();
        if (probe.isGameOver()) probeOver = probe.isCheckmate() ? -MATE_SCORE : 0;
      }
      if (probeOver !== null) {
        evalAfter = probeOver;
      } else {
        this.evaluating = true;
        this.refreshView();
        let lines: PvLine[] | null = null;
        try {
          lines = await this.runAnalysis(1, probeFen);
        } finally {
          this.evaluating = false;
        }
        if (gen !== this.transition || lines === null) return;
        const best = lines.find((l) => l.multipv === 1);
        if (!best) return;
        evalAfter = forced ? best.scoreCp : -best.scoreCp; // B is opponent-to-move unless the reply was forced
        line = forced ? [...line, ...best.pv] : best.pv;
      }
    }

    const glyph = classifyMove({
      evalBefore: pre.evalBefore,
      evalAfter,
      bestMove: pre.bestMove,
      secondBestEval: pre.secondBestEval,
      played,
      sacrificed: sacrificeOf(fenBefore, this.humanColor, played, line),
      obvious: isObviousMove(prev, fenBefore, played, pre.bestLine, pre.secondLine),
    });
    const wantsBetter = (glyph === '?!' || glyph === '?' || glyph === '??') && pre.bestMove !== played;
    this.plies[ply] = { glyph, betterSan: wantsBetter ? sanOf(fenBefore, pre.bestMove) : null };
  }

  private applyEngineMove(uci: UciMove): void {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    try {
      this.chess.move({ from, to, promotion });
    } catch (err) {
      console.error('Engine move rejected by chess.js', uci, this.chess.fen(), err);
      this.engineFailed(err);
      return;
    }
    this.notifyMove(false);
    this.afterPositionChange();
  }

  private maybeStartEngine(status: GameStatus): void {
    if (status.over || !this.started || this.twoPlayer || this.remote) return;
    if (this.engineState !== 'ready') return;
    if (this.chess.turn() === this.humanColor) return;
    if (this.pendingSearch !== null || this.pendingAnalysis !== null || this.evaluating) return;
    this.ensurePlayOptions();

    const d = this.currentDifficulty();
    // Weak levels: draw the move among the engine's top candidates instead of taking the
    // best one. Wrapped as a Search so the identity + FEN guards below apply unchanged.
    const search = d.topMoves > 1 ? this.topMovesSearch(d) : this.engine.search(this.chess.fen(), d.limits);
    this.pendingSearch = search;
    this.refreshView(); // locks the board, shows "přemýšlím…"
    const startedAt = performance.now();
    const thinkMs = THINK_PAUSE_MS[0] + Math.random() * (THINK_PAUSE_MS[1] - THINK_PAUSE_MS[0]);

    search.result
      .then(async (move) => {
        if (this.pendingSearch !== search) return; // superseded or cancelled: discard
        if (move === null) {
          this.pendingSearch = null;
          return; // cancelled by stop()
        }
        // A visible pause: the move is known, the computer "thinks" a moment longer.
        const wait = thinkMs - (performance.now() - startedAt);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (this.pendingSearch !== search) return; // a new game / undo / puzzle came in meanwhile
        this.pendingSearch = null;
        if (search.fen !== this.chess.fen()) {
          console.error('Stale engine move discarded', search.fen, this.chess.fen());
          return;
        }
        this.applyEngineMove(move);
      })
      .catch((err) => console.error('engine search failed', err));
  }

  /**
   * The weak levels' move: the same weak search with MultiPV, then a uniform draw among
   * the lines within `topWindowCp` of the best. Shaped like an engine search; null when
   * the analysis was cancelled (the caller discards it exactly like a cancelled search).
   */
  private topMovesSearch(d: Difficulty): Search {
    const analysis = this.engine.analyse(this.chess.fen(), { ...d.limits, multiPv: d.topMoves });
    const result = analysis.result.then((lines) => {
      if (lines === null || lines.length === 0) return null;
      const best = lines[0].scoreCp;
      const candidates = lines.filter((l) => l.pv[0] !== undefined && best - l.scoreCp <= d.topWindowCp);
      const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? lines[0];
      return pick.pv[0] ?? null;
    });
    return { fen: analysis.fen, result };
  }

  /** Sound effects: called right after a ply lands on `this.chess`, before afterPositionChange re-renders. */
  private notifyMove(mine: boolean): void {
    const last = this.chess.history({ verbose: true }).at(-1);
    this.options.onMove?.({ mine, capture: last?.captured !== undefined, check: this.chess.inCheck() });
  }

  /** Sync + render + (maybe) start the engine. */
  private afterPositionChange(): void {
    if (this.lessonStatus !== null) {
      this.renderLessonChrome(); // the lesson owns the board; the engine stays out
      return;
    }
    const status = this.status();
    this.syncBoard(status);
    this.render(status);
    if (status.over && this.reviewPly === null && this.puzzle === null && this.chess.history().length > 0 && this.record === null) {
      this.record = this.buildRecord(); // the game just ended: keep it (Phase 9)
      this.options.onGameRecord(this.record);
    }
    if (this.reviewPly !== null || this.puzzle !== null) return; // reviewing / puzzle: the engine stays out
    if (this.chess.turn() === this.humanColor) {
      if (this.feedbackActive(status)) this.startPreMoveAnalysis();
    } else {
      this.maybeStartEngine(status);
    }
  }

  /** Sync + render only — used while thinking or while the dialog is open. */
  private refreshView(): void {
    if (this.lessonStatus !== null) {
      this.renderLessonChrome();
      return;
    }
    const status = this.status();
    this.syncBoard(status);
    this.render(status);
  }

  private syncBoard(status: GameStatus): void {
    if (this.reviewPly !== null) {
      const shown = positionAt(this.startFen(), this.chess.history(), this.reviewPly);
      this.board.sync(shown, {
        orientation: toBoardColor(this.humanColor),
        movableColor: null,
        annotation: this.annotationAt(shown, this.reviewPly),
        arrow: this.bestArrowAt(shown, this.reviewPly),
      });
      return;
    }
    this.board.sync(this.chess, {
      orientation: toBoardColor(this.humanColor),
      movableColor: this.movableColor(status),
      annotation: this.puzzle ? null : this.lastHumanAnnotation(),
      hints: this.puzzleHints(),
    });
  }

  private movableColor(status: GameStatus): BoardColor | null {
    if (status.over || this.promotionOpen || this.pendingSearch !== null || this.evaluating || this.starting !== null) return null;
    if (this.remote) return this.chess.turn() === this.humanColor ? toBoardColor(this.humanColor) : null; // the friend's turn
    if (this.engineState === 'failed' || this.twoPlayer) return toBoardColor(this.chess.turn()); // two people at one board
    if (this.chess.turn() !== this.humanColor) return null; // engine's turn (or still loading)
    return toBoardColor(this.humanColor);
  }

  private render(status: GameStatus): void {
    const sans = this.chess.history();
    const glyphs = this.plies.map((p) => p?.glyph ?? null);
    renderMoveList(this.els.moveList, sans, glyphs, this.reviewPly, new Chess(this.startFen()).turn() === 'b');
    renderStatus(this.els.status, {
      status,
      engine: this.engineIndicator(),
      preGame: !this.started && sans.length === 0 && !status.over,
      analysing: this.analysisProgress,
      puzzle: this.puzzle ? this.puzzleStatusText() : this.starting ? 'Figurky nastupují…' : this.remote && this.remoteWaiting && !status.over ? 'Čekám na kamaráda…' : null,
    });
    this.renderControls();
    // U1: before the game the only start control is `▶ Hrát` on the board; `Nová hra` in the
    // button row steps aside (a class, not `hidden`: the endgame panel owns that attribute).
    const preGame = !this.started;
    this.els.newGameButton.textContent = 'Nová hra';
    this.els.newGameButton.classList.toggle('pregame', preGame);
    this.els.startButton.hidden = !preGame;
    this.syncStartSeeThrough();
    // Take-backs never apply to a puzzle or an ending (an ending has `Znovu`, a puzzle `Další úloha`).
    this.els.undoButton.hidden = this.puzzle !== null || this.training;
    this.renderResign(status);
    this.els.reviewButton.hidden = !(status.over && sans.length > 0 && this.reviewPly === null && this.puzzle === null);
    renderReviewControls(this.els.reviewControls, {
      active: this.reviewPly !== null,
      ply: this.reviewPly ?? 0,
      plies: sans.length,
    });
    const analysed = this.reviewPly !== null && this.evalAt(this.reviewPly) !== null;
    this.els.analyseButton.hidden = this.reviewPly === null || this.engineState !== 'ready';
    this.els.analyseButton.disabled = this.gameAnalysis !== null || (analysed && this.evalAt(sans.length) !== null);
    this.els.analyseButton.textContent = this.gameAnalysis !== null ? 'Analyzuju…' : analysed ? 'Zanalyzováno' : 'Analyzovat partii';
    renderEvalBar(this.els.evalBar, {
      visible: this.reviewPly !== null && analysed,
      cp: this.reviewPly !== null ? this.evalAt(this.reviewPly) : null,
      orientation: toBoardColor(this.humanColor),
    });
    const bubbles: { white: string | null; black: string | null } = { white: null, black: null };
    if (this.reviewPly !== null) {
      const { main, reaction } = commentaryFor(this.startFen(), sans, this.reviewPly, this.plies, this.options.voiceOf);
      for (const b of [main, reaction]) if (b) bubbles[b.speaker === 'w' ? 'white' : 'black'] = b.text;
    } else if (this.puzzle) {
      bubbles[this.humanColor === 'w' ? 'white' : 'black'] = this.puzzleBubble();
    } else {
      bubbles[this.humanColor === 'w' ? 'white' : 'black'] = this.glyphBubble(sans);
    }
    const outcome = this.outcome(status);
    if (outcome) {
      const zvuk = this.options.voiceOf(this.humanColor)?.sound ?? DEFAULT_VOICE.sound;
      bubbles[this.humanColor === 'w' ? 'white' : 'black'] = pick(ENDINGS[outcome], sans.join(' ')).replace('{zvuk}', zvuk);
    }
    // Phase 19: trays follow the position on the screen (the reviewed ply while reviewing).
    const shown = this.reviewPly !== null ? positionAt(this.startFen(), sans, this.reviewPly) : this.chess;
    const material = capturedMaterial(new Chess(this.startFen()), shown);
    renderSpectators(this.els.spectators, { humanColor: this.humanColor, bubbles, outcome, material });
  }

  /**
   * During play: the child's king says a word about the child's latest move when it earned
   * a glyph (the review's lines, so the child learns what `?!` or `!` means). It stays until
   * the child's next move; null when that move has no spoken glyph.
   */
  private glyphBubble(sans: readonly string[]): string | null {
    const history = this.chess.history({ verbose: true });
    let ply = history.length - 1;
    while (ply >= 0 && history[ply].color !== this.humanColor) ply--;
    const glyph = ply >= 0 ? (this.plies[ply]?.glyph ?? null) : null;
    if (!glyph || !SPOKEN_GLYPHS.has(glyph)) return null;
    return commentaryFor(this.startFen(), sans, ply + 1, this.plies, this.options.voiceOf).main?.text ?? null;
  }

  /** Phase 17: how a game the child just played ended for them (null outside that case). */
  private outcome(status: GameStatus): Outcome | null {
    if (!status.over || !this.started || this.reviewPly !== null || this.puzzle !== null || this.chess.history().length === 0) return null;
    if (this.record?.source === 'pgn' || (this.record && this.record.humanColor === null)) return null; // a loaded game
    if (this.resigned) return 'loss';
    if (!this.chess.isCheckmate()) return 'draw';
    if (this.twoPlayer) return null; // two people: the status line names the winner, nobody is sent off
    return this.chess.turn() === this.humanColor ? 'loss' : 'win';
  }

  private engineIndicator(): EngineIndicator {
    if (this.engineState === 'ready' && this.pendingSearch !== null) return 'thinking';
    if (this.engineState === 'ready' && this.evaluating) return 'evaluating';
    return this.engineState;
  }

  /**
   * Glyph badge for the human's move while it is the last one on the board. Once the
   * opponent replies (a recapture may now stand on that square) the badge goes: the move
   * list and the king's bubble keep the verdict.
   */
  private lastHumanAnnotation(): { square: Square; glyph: Glyph } | null {
    const history = this.chess.history({ verbose: true });
    const last = history.at(-1);
    if (!last || last.color !== this.humanColor) return null;
    const glyph = this.plies[history.length - 1]?.glyph ?? null;
    return glyph ? { square: last.to, glyph } : null;
  }

  /** Where the game's move list starts: the initial position unless a FEN was loaded. */
  private startFen(): string {
    return this.chess.getHeaders().FEN ?? DEFAULT_POSITION;
  }

  /** Review: the badge of the move that led to `shown` (ply index `ply - 1`), if any. */
  private annotationAt(shown: Chess, ply: number): { square: Square; glyph: Glyph } | null {
    if (ply === 0) return null;
    const glyph = this.plies[ply - 1]?.glyph ?? null;
    const last = shown.history({ verbose: true }).at(-1);
    return glyph && last ? { square: last.to, glyph } : null;
  }

  private renderControls(): void {
    renderControls(this.controlsElements(), {
      difficulty: this.difficultyOverride?.level ?? this.difficultyLevel,
      difficultyLocked: this.difficultyOverride !== null,
      feedbackEnabled: this.feedbackEnabled,
      undoEnabled:
        this.chess.history().length > 0 &&
        !this.promotionOpen &&
        this.reviewPly === null &&
        this.record === null &&
        !this.resigned &&
        this.puzzle === null &&
        !this.remote &&
        !this.undoBlockedAtEngineOpening() &&
        (this.twoPlayer || this.undosLeft === null || this.undosLeft > 0),
      undosLeft: this.twoPlayer ? null : this.undosLeft,
      undoLimit: this.undoBudget,
      disabled: this.promotionOpen,
    });
  }

  private controlsElements() {
    return {
      difficulty: this.els.difficultySelect,
      feedback: this.els.feedbackSelect,
      undoLimit: this.els.undoLimitSelect,
      undo: this.els.undoButton,
    };
  }
}

/** SAN of a UCI move in the position `fen`, or null when chess.js rejects it. */
function sanOf(fen: string, uci: UciMove | null): string | null {
  if (!uci) return null;
  try {
    return new Chess(fen).move(uciToMove(uci)).san;
  } catch {
    return null;
  }
}

/** Analysis A's lines → what the classifier needs from the position before the move; null without a best line. */
function preMoveInfo(fen: string, lines: PvLine[]): PreMoveInfo | null {
  const best = lines.find((l) => l.multipv === 1);
  const second = lines.find((l) => l.multipv === 2);
  if (!best) return null;
  return {
    fen,
    evalBefore: best.scoreCp,
    bestMove: best.pv[0] ?? null,
    secondBestEval: second ? second.scoreCp : null,
    bestLine: best.pv,
    secondLine: second ? second.pv : null,
  };
}
