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
import {
  createBoardBridge,
  toBoardColor,
  type BoardBridge,
  type BoardColor,
} from './board-bridge';
import { DEFAULT_DIFFICULTY, difficulty, isDifficultyLevel, type Difficulty, type DifficultyLevel } from './difficulty';
import { MATE_SCORE, type Analysis, type Engine, type EngineOptions, type PvLine, type Search, type UciMove } from './engine';
import { ANALYSIS, classifyMove, sacrificeOf, uciToMove, type Glyph } from './feedback';
import { gameStatus, type GameStatus } from './game-status';
import { commentaryFor, positionAt, type PlyRecord, type SpeakerVoice } from './review';
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
import { renderSpectators, type SpectatorElements } from './ui/spectators';
import { renderStatus, type EngineIndicator } from './ui/status';

export interface GameControllerElements {
  board: HTMLElement;
  status: HTMLElement;
  moveList: HTMLElement;
  newGameButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  difficultySelect: HTMLSelectElement;
  feedbackSelect: HTMLSelectElement;
  promotionDialog: HTMLDialogElement;
  /** "Rozbor": shown only once the game is over. */
  reviewButton: HTMLButtonElement;
  reviewControls: ReviewControlElements;
  spectators: SpectatorElements;
  /** Phase 9: whole-game analysis button (in the review) and the eval bar beside the board. */
  analyseButton: HTMLButtonElement;
  evalBar: HTMLElement;
}

export interface GameControllerOptions {
  /** Move feedback (glyphs) on/off at start; persisted by the caller via onFeedbackChange. */
  feedbackEnabled: boolean;
  onFeedbackChange: (enabled: boolean) => void;
  /** The kings' voices in the review, by colour; view-only. */
  voiceOf: (color: Color) => SpeakerVoice;
  /** Asked at every new game: which colour the human plays (the view holds the preference). */
  nextColor: () => Color;
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
}

/** Puzzle mode state: Lichess semantics, `moves[0]` is the opponent's. */
interface PuzzleState {
  moves: string[];
  index: number;
  /** 0 none, 1 piece circled, 2 destination circled too. */
  hint: 0 | 1 | 2;
  attempts: number;
  message: 'start' | 'correct' | 'wrong' | 'solved';
}

type EngineState = 'loading' | 'ready' | 'failed';

/** Result of the pre-move analysis (A): what the engine thought before the human moved. */
interface PreMoveInfo {
  fen: string;
  evalBefore: number; // human POV
  bestMove: UciMove | null;
  secondBestEval: number | null; // human POV
}

/** Engine options currently loaded: the level's play settings, full-strength analysis, or stale (level changed; reload before the next search). */
type EngineMode = 'play' | 'analysis' | 'stale';

export class GameController {
  private readonly chess: Chess;
  private readonly board: BoardBridge;
  private humanColor: Color = 'w';
  private difficultyLevel: DifficultyLevel = DEFAULT_DIFFICULTY;
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
  /** Phase 12: the piece drop in progress (board locked, engine waiting), or null. */
  private starting: { done: Promise<void>; cancel: () => void } | null = null;

  constructor(
    private readonly els: GameControllerElements,
    private readonly engine: Engine,
    private readonly options: GameControllerOptions,
  ) {
    this.feedbackEnabled = options.feedbackEnabled;
    this.chess = new Chess();
    this.board = createBoardBridge(els.board, (from, to) => this.handleUserMove(from, to));

    populateControls(this.controlsElements());
    els.newGameButton.addEventListener('click', () => {
      if (!this.started) this.startPlaying();
      else void this.newGame().catch((err) => console.error('newGame failed', err));
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

    engine.ready
      .then(() => {
        this.engineState = 'ready';
        this.engine.setOptions(this.playOptions());
        this.engineMode = 'play';
        this.afterPositionChange(); // an engine turn that waited during loading starts now
      })
      .catch((err: unknown) => this.engineFailed(err));

    void this.newGame().catch((err) => console.error('newGame failed', err));
  }

  async newGame(): Promise<void> {
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.humanColor = this.options.nextColor();
    this.chess.reset();
    this.plies = [];
    this.preMove = null;
    this.reviewPly = null;
    this.record = null;
    this.clearPuzzle();
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
    this.chess.load(fen);
    this.plies = [];
    this.preMove = null;
    this.record = null;
    this.reviewPly = null;
    this.clearPuzzle();
    this.humanColor = humanColor;
    this.started = true;
    if (this.engineState === 'ready') this.engine.newGame();
    this.options.onTrainingStart(humanColor);
    this.afterPositionChange();
  }

  /** Starts a puzzle (Phase 10): the opponent's first move plays itself after a beat. */
  async startPuzzle(fen: string, moves: string[]): Promise<void> {
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.chess.load(fen);
    this.plies = [];
    this.preMove = null;
    this.record = null;
    this.reviewPly = null;
    this.clearPuzzle();
    this.puzzle = { moves, index: 0, hint: 0, attempts: 0, message: 'start' };
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

  puzzleHint(): void {
    if (!this.puzzle || this.chess.turn() !== this.humanColor) return;
    this.puzzle.hint = this.puzzle.hint >= 2 ? 2 : ((this.puzzle.hint + 1) as 1 | 2);
    this.refreshView();
  }

  get inPuzzle(): boolean {
    return this.puzzle !== null;
  }

  private clearPuzzle(): void {
    if (this.puzzleTimer !== null) window.clearTimeout(this.puzzleTimer);
    this.puzzleTimer = null;
    this.puzzle = null;
  }

  /** Puzzle mode: compare the human's move with the solution; promotions come from the data. */
  private handlePuzzleMove(from: Square, to: Square): void {
    const puzzle = this.puzzle!;
    const expected = puzzle.moves[puzzle.index];
    if (!expected || puzzle.index % 2 === 0) {
      this.afterPositionChange();
      return;
    }
    if (`${from}${to}` !== expected.slice(0, 4)) {
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
        return `${zvuk} Správně! Pokračuj.`;
      case 'wrong':
        return 'Hm… to ne. Zkus to znovu.';
      default:
        return 'Najdi nejlepší tah!';
    }
  }

  /** Opens a saved or pasted game in the review (Phase 9). Returns false when its moves do not replay. */
  async loadGame(record: GameRecord): Promise<boolean> {
    if (replayRecord(record) === null) return false;
    const t = await this.beginTransition();
    if (t !== this.transition) return false;
    this.chess.load(record.startFen);
    for (const san of record.sans) this.chess.move(san);
    this.plies = record.plies.map((p) => (p ? { ...p } : null));
    this.record = record;
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
      result: resultOf(this.chess),
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
    if (this.started) return;
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

  async undo(): Promise<void> {
    if (this.chess.history().length === 0 || this.reviewPly !== null) return;
    // Evaluated before the await: the position cannot change during it (board locked or idle).
    const wasEngineTurn = this.chess.turn() !== this.humanColor;
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    // Back to the most recent position where it was the human's turn:
    //  - engine to move (thinking, or game just ended after a human move): pop 1 ply
    //  - human to move: pop the engine reply and the human move: pop 2 plies
    //  - two-player fallback: pop 1 ply
    const plies = this.engineState === 'failed' ? 1 : wasEngineTurn ? 1 : 2;
    for (let i = 0; i < plies && this.chess.history().length > 0; i++) this.chess.undo();
    this.plies.length = Math.min(this.plies.length, this.chess.history().length);
    this.preMove = null;
    this.afterPositionChange();
  }

  async setDifficulty(level: DifficultyLevel): Promise<void> {
    this.difficultyLevel = level;
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
    if (this.reviewPly !== null || this.chess.history().length === 0 || !gameStatus(this.chess).over) return;
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
    return this.feedbackEnabled && this.engineState === 'ready' && !status.over && this.puzzle === null;
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
        const best = lines.find((l) => l.multipv === 1);
        const second = lines.find((l) => l.multipv === 2);
        if (!best) return;
        this.preMove = {
          fen,
          evalBefore: best.scoreCp,
          bestMove: best.pv[0] ?? null,
          secondBestEval: second ? second.scoreCp : null,
        };
      })
      .catch((err) => console.error('pre-move analysis failed', err));
  }

  /** Engine load/worker/move failure → two-player fallback for the rest of the page load. */
  engineFailed(err: unknown): void {
    if (this.engineState === 'failed') return; // idempotent: ready-rejection and onError may both report
    console.error('Engine unavailable', err);
    this.engineState = 'failed';
    void this.cancelSearch().catch((e) => console.error('cancelSearch failed', e));
    this.afterPositionChange(); // two-player fallback takes effect immediately
  }

  private async handleUserMove(from: Square, to: Square): Promise<void> {
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
      this.refreshView(); // board locked, controls disabled (pawn re-syncs to its origin square)
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
    if (moved) await this.evaluateHumanMove(fenBefore, `${from}${to}${promotion ?? ''}`);
    this.afterPositionChange();
  }

  /**
   * Analysis B (post-move) and classification. Board stays locked ("hodnotím…") until it
   * settles; any transition in the meantime cancels it and the move simply gets no glyph.
   */
  private async evaluateHumanMove(fenBefore: string, played: UciMove): Promise<void> {
    const status = gameStatus(this.chess);
    const pre = this.preMove && this.preMove.fen === fenBefore ? this.preMove : null;
    this.preMove = null;
    const ply = this.chess.history().length - 1;
    const gen = this.transition;

    if (this.pendingAnalysis !== null) {
      await this.cancelSearch(); // analysis A still running: let the engine settle it first
      if (gen !== this.transition) return;
    }
    if (!this.feedbackEnabled || this.engineState !== 'ready' || pre === null) return;

    let evalAfter: number; // human POV
    let reply: UciMove | undefined;
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
        reply = `${forced.from}${forced.to}${forced.promotion ?? ''}`;
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
        if (!forced) reply = best.pv[0];
      }
    }

    const glyph = classifyMove({
      evalBefore: pre.evalBefore,
      evalAfter,
      bestMove: pre.bestMove,
      secondBestEval: pre.secondBestEval,
      played,
      sacrificed: sacrificeOf(fenBefore, this.humanColor, played, reply),
    });
    const wantsBetter = glyph === '?!' || glyph === '?' || glyph === '??';
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
    this.afterPositionChange();
  }

  private maybeStartEngine(status: GameStatus): void {
    if (status.over || !this.started) return;
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

    search.result
      .then((move) => {
        if (this.pendingSearch !== search) return; // superseded or cancelled: discard
        this.pendingSearch = null;
        if (move === null) return; // cancelled by stop()
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

  /** Sync + render + (maybe) start the engine. */
  private afterPositionChange(): void {
    const status = gameStatus(this.chess);
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
    const status = gameStatus(this.chess);
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
    if (this.engineState === 'failed') return toBoardColor(this.chess.turn()); // two-player fallback
    if (this.chess.turn() !== this.humanColor) return null; // engine's turn (or still loading)
    return toBoardColor(this.humanColor);
  }

  private render(status: GameStatus): void {
    const sans = this.chess.history();
    const glyphs = this.plies.map((p) => p?.glyph ?? null);
    renderMoveList(this.els.moveList, sans, glyphs, this.reviewPly);
    renderStatus(this.els.status, {
      status,
      engine: this.engineIndicator(),
      preGame: !this.started && sans.length === 0 && !status.over,
      analysing: this.analysisProgress,
      puzzle: this.puzzle ? this.puzzleStatusText() : this.starting ? 'Figurky nastupují…' : null,
    });
    this.renderControls();
    const preGame = !this.started;
    this.els.newGameButton.textContent = preGame ? 'Hrát!' : 'Nová hra';
    this.els.newGameButton.classList.toggle('start', preGame);
    this.els.reviewButton.hidden = !(status.over && sans.length > 0 && this.reviewPly === null && this.puzzle === null);
    renderReviewControls(this.els.reviewControls, {
      active: this.reviewPly !== null,
      ply: this.reviewPly ?? 0,
      plies: sans.length,
    });
    const analysed = this.reviewPly !== null && this.evalAt(this.reviewPly) !== null;
    this.els.analyseButton.hidden = this.reviewPly === null || this.engineState !== 'ready';
    this.els.analyseButton.disabled = this.gameAnalysis !== null || (analysed && this.evalAt(sans.length) !== null);
    this.els.analyseButton.textContent = this.gameAnalysis !== null ? 'Analyzuji…' : analysed ? 'Zanalyzováno' : 'Analyzovat partii';
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
    }
    renderSpectators(this.els.spectators, { humanColor: this.humanColor, bubbles });
  }

  private engineIndicator(): EngineIndicator {
    if (this.engineState === 'ready' && this.pendingSearch !== null) return 'thinking';
    if (this.engineState === 'ready' && this.evaluating) return 'evaluating';
    return this.engineState;
  }

  /** Glyph badge for the most recent human move, if it has one. */
  private lastHumanAnnotation(): { square: Square; glyph: Glyph } | null {
    const history = this.chess.history({ verbose: true });
    for (let ply = history.length - 1; ply >= 0; ply--) {
      if (history[ply].color !== this.humanColor) continue;
      const glyph = this.plies[ply]?.glyph ?? null;
      return glyph ? { square: history[ply].to, glyph } : null;
    }
    return null;
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
      undoEnabled: this.chess.history().length > 0 && !this.promotionOpen && this.reviewPly === null && this.record === null && this.puzzle === null,
      disabled: this.promotionOpen,
    });
  }

  private controlsElements() {
    return {
      difficulty: this.els.difficultySelect,
      feedback: this.els.feedbackSelect,
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
