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
import { DEFAULT_DIFFICULTY, difficulty, isDifficultyLevel, type DifficultyLevel } from './difficulty';
import { MATE_SCORE, type Analysis, type Engine, type PvLine, type Search, type UciMove } from './engine';
import { ANALYSIS, classifyMove, sacrificeOf, uciToMove, type Glyph } from './feedback';
import { gameStatus, type GameStatus } from './game-status';
import { commentaryFor, positionAt, type PlyRecord, type SpeakerVoice } from './review';
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
}

type EngineState = 'loading' | 'ready' | 'failed';

/** Result of the pre-move analysis (A): what the engine thought before the human moved. */
interface PreMoveInfo {
  fen: string;
  evalBefore: number; // human POV
  bestMove: UciMove | null;
  secondBestEval: number | null; // human POV
}

/** Engine options currently loaded: the level's play settings, or full-strength analysis. */
type EngineMode = 'play' | 'analysis';

export class GameController {
  private readonly chess: Chess;
  private readonly board: BoardBridge;
  private humanColor: Color = 'w';
  private difficultyLevel: DifficultyLevel = DEFAULT_DIFFICULTY;
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
      void this.newGame().catch((err) => console.error('newGame failed', err));
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
        this.engine.setOptions({ ...difficulty(this.difficultyLevel).options, multiPv: 1 });
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
    if (this.engineState === 'ready') this.engine.newGame();
    this.options.onNewGame(this.humanColor);
    this.afterPositionChange(); // engine opens (new search) only if the human is black
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
    this.renderControls();
    if (this.engineState !== 'ready') return;
    const wasThinking = this.pendingSearch !== null;
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.engine.setOptions({ ...difficulty(level).options, multiPv: 1 }); // no search outstanding here
    this.engineMode = 'play';
    if (wasThinking) this.afterPositionChange(); // restarts the search with the new settings
  }

  /** Enters the review of the finished game at the start position. */
  startReview(): void {
    if (this.reviewPly !== null || this.chess.history().length === 0 || !gameStatus(this.chess).over) return;
    this.reviewPly = 0;
    this.refreshView();
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
    return this.engine.stop();
  }

  /** Restores the level's play options after an analysis. Caller guarantees nothing outstanding. */
  private ensurePlayOptions(): void {
    if (this.engineMode === 'play' || this.engineState !== 'ready') return;
    this.engine.setOptions({ ...difficulty(this.difficultyLevel).options, multiPv: 1 });
    this.engineMode = 'play';
  }

  /** Runs one analysis at full strength; resolves null when cancelled. Caller guarantees nothing outstanding. */
  private async runAnalysis(multiPv: 1 | 2): Promise<PvLine[] | null> {
    this.engine.setOptions({ skillLevel: 20, multiPv });
    this.engineMode = 'analysis';
    const analysis = this.engine.analyse(this.chess.fen(), { depth: ANALYSIS.depth, movetimeMs: ANALYSIS.movetimeMs, multiPv });
    this.pendingAnalysis = analysis;
    const lines = await analysis.result;
    if (this.pendingAnalysis === analysis) {
      this.pendingAnalysis = null;
      this.ensurePlayOptions(); // our job was the only outstanding one and it just settled
    }
    return lines;
  }

  private feedbackActive(status: GameStatus): boolean {
    return this.feedbackEnabled && this.engineState === 'ready' && !status.over;
  }

  /** Analysis A: evaluate the position the human is about to move in (runs while they think). */
  private startPreMoveAnalysis(): void {
    if (this.pendingSearch !== null || this.pendingAnalysis !== null || this.evaluating) return;
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
      this.evaluating = true;
      this.refreshView();
      let lines: PvLine[] | null = null;
      try {
        lines = await this.runAnalysis(1);
      } finally {
        this.evaluating = false;
      }
      if (gen !== this.transition || lines === null) return;
      const best = lines.find((l) => l.multipv === 1);
      if (!best) return;
      evalAfter = -best.scoreCp; // B is opponent-to-move
      reply = best.pv[0];
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
    if (status.over) return;
    if (this.engineState !== 'ready') return;
    if (this.chess.turn() === this.humanColor) return;
    if (this.pendingSearch !== null || this.pendingAnalysis !== null || this.evaluating) return;
    this.ensurePlayOptions();

    const d = difficulty(this.difficultyLevel);
    // Weak levels: sometimes play a random legal move instead of asking the engine. It is
    // wrapped as a Search so the identity + FEN guards below apply unchanged.
    const search =
      Math.random() < d.randomMoveChance
        ? this.randomMoveSearch()
        : this.engine.search(this.chess.fen(), d.limits);
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

  /** A uniformly random legal move (rules from chess.js), shaped like an engine search. */
  private randomMoveSearch(): Search {
    const moves = this.chess.moves({ verbose: true });
    const pick = moves[Math.floor(Math.random() * moves.length)];
    const uci: UciMove = `${pick.from}${pick.to}${pick.promotion ?? ''}`;
    return { fen: this.chess.fen(), result: Promise.resolve(uci) };
  }

  /** Sync + render + (maybe) start the engine. */
  private afterPositionChange(): void {
    const status = gameStatus(this.chess);
    this.syncBoard(status);
    this.render(status);
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
      });
      return;
    }
    this.board.sync(this.chess, {
      orientation: toBoardColor(this.humanColor),
      movableColor: this.movableColor(status),
      annotation: this.lastHumanAnnotation(),
    });
  }

  private movableColor(status: GameStatus): BoardColor | null {
    if (status.over || this.promotionOpen || this.pendingSearch !== null || this.evaluating) return null;
    if (this.engineState === 'failed') return toBoardColor(this.chess.turn()); // two-player fallback
    if (this.chess.turn() !== this.humanColor) return null; // engine's turn (or still loading)
    return toBoardColor(this.humanColor);
  }

  private render(status: GameStatus): void {
    const sans = this.chess.history();
    const glyphs = this.plies.map((p) => p?.glyph ?? null);
    renderMoveList(this.els.moveList, sans, glyphs, this.reviewPly);
    renderStatus(this.els.status, { status, engine: this.engineIndicator() });
    this.renderControls();
    this.els.reviewButton.hidden = !(status.over && sans.length > 0 && this.reviewPly === null);
    renderReviewControls(this.els.reviewControls, {
      active: this.reviewPly !== null,
      ply: this.reviewPly ?? 0,
      plies: sans.length,
    });
    const bubbles: { white: string | null; black: string | null } = { white: null, black: null };
    if (this.reviewPly !== null) {
      const { main, reaction } = commentaryFor(this.startFen(), sans, this.reviewPly, this.plies, this.options.voiceOf);
      for (const b of [main, reaction]) if (b) bubbles[b.speaker === 'w' ? 'white' : 'black'] = b.text;
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
      difficulty: this.difficultyLevel,
      feedbackEnabled: this.feedbackEnabled,
      undoEnabled: this.chess.history().length > 0 && !this.promotionOpen && this.reviewPly === null,
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
