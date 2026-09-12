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
import { Chess, type Color, type Square } from 'chess.js';
import {
  createBoardBridge,
  toBoardColor,
  type BoardBridge,
  type BoardColor,
} from './board-bridge';
import { DEFAULT_DIFFICULTY, difficulty, isDifficultyLevel, type DifficultyLevel } from './difficulty';
import type { Engine, Search, UciMove } from './engine';
import { gameStatus, type GameStatus } from './game-status';
import { populateControls, renderControls } from './ui/controls';
import { renderMoveList } from './ui/move-list';
import { promptPromotion, type PromotionPiece } from './ui/promotion-dialog';
import { renderStatus, type EngineIndicator } from './ui/status';

export interface GameControllerElements {
  board: HTMLElement;
  status: HTMLElement;
  moveList: HTMLElement;
  newGameButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  difficultySelect: HTMLSelectElement;
  sideSelect: HTMLSelectElement;
  promotionDialog: HTMLDialogElement;
}

type EngineState = 'loading' | 'ready' | 'failed';

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

  constructor(
    private readonly els: GameControllerElements,
    private readonly engine: Engine,
  ) {
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
    els.sideSelect.addEventListener('change', () => {
      const color = els.sideSelect.value === 'b' ? 'b' : 'w';
      void this.setHumanColor(color).catch((err) => console.error('setHumanColor failed', err));
    });

    engine.ready
      .then(() => {
        this.engineState = 'ready';
        this.engine.setOptions(difficulty(this.difficultyLevel).options);
        this.afterPositionChange(); // an engine turn that waited during loading starts now
      })
      .catch((err: unknown) => this.engineFailed(err));

    void this.newGame().catch((err) => console.error('newGame failed', err));
  }

  async newGame(): Promise<void> {
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.chess.reset();
    if (this.engineState === 'ready') this.engine.newGame();
    this.afterPositionChange(); // engine opens (new search) only if the human is black
  }

  async undo(): Promise<void> {
    if (this.chess.history().length === 0) return;
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
    this.afterPositionChange();
  }

  async setDifficulty(level: DifficultyLevel): Promise<void> {
    this.difficultyLevel = level;
    this.renderControls();
    if (this.engineState !== 'ready') return;
    const wasThinking = this.pendingSearch !== null;
    const t = await this.beginTransition();
    if (t !== this.transition) return;
    this.engine.setOptions(difficulty(level).options); // no search outstanding here
    if (wasThinking) this.afterPositionChange(); // restarts the search with the new settings
  }

  setHumanColor(color: Color): Promise<void> {
    this.humanColor = color;
    return this.newGame();
  }

  /** Cancels the in-flight search and returns the generation of this transition. */
  private async beginTransition(): Promise<number> {
    const t = ++this.transition;
    // A search can only start synchronously inside afterPositionChange(); if one slipped
    // in while we were awaiting (e.g. the engine became ready), cancel again.
    do {
      await this.cancelSearch();
    } while (this.pendingSearch !== null && t === this.transition);
    return t;
  }

  /** Resolves when the engine has consumed the cancelled search's bestmove. */
  private cancelSearch(): Promise<void> {
    this.pendingSearch = null;
    return this.engine.stop();
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

    try {
      this.chess.move({ from, to, promotion });
    } catch (err) {
      console.error(`Move ${from}->${to} rejected by chess.js`, err);
    }
    this.afterPositionChange();
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
    if (this.pendingSearch !== null) return;

    const search = this.engine.search(this.chess.fen(), difficulty(this.difficultyLevel).limits);
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

  /** Sync + render + (maybe) start the engine. */
  private afterPositionChange(): void {
    const status = gameStatus(this.chess);
    this.syncBoard(status);
    this.render(status);
    this.maybeStartEngine(status);
  }

  /** Sync + render only — used while thinking or while the dialog is open. */
  private refreshView(): void {
    const status = gameStatus(this.chess);
    this.syncBoard(status);
    this.render(status);
  }

  private syncBoard(status: GameStatus): void {
    this.board.sync(this.chess, {
      orientation: toBoardColor(this.humanColor),
      movableColor: this.movableColor(status),
    });
  }

  private movableColor(status: GameStatus): BoardColor | null {
    if (status.over || this.promotionOpen || this.pendingSearch !== null) return null;
    if (this.engineState === 'failed') return toBoardColor(this.chess.turn()); // two-player fallback
    if (this.chess.turn() !== this.humanColor) return null; // engine's turn (or still loading)
    return toBoardColor(this.humanColor);
  }

  private render(status: GameStatus): void {
    renderMoveList(this.els.moveList, this.chess.history());
    renderStatus(this.els.status, { status, engine: this.engineIndicator() });
    this.renderControls();
  }

  private engineIndicator(): EngineIndicator {
    if (this.engineState === 'ready' && this.pendingSearch !== null) return 'thinking';
    return this.engineState;
  }

  private renderControls(): void {
    renderControls(this.controlsElements(), {
      difficulty: this.difficultyLevel,
      humanColor: this.humanColor,
      undoEnabled: this.chess.history().length > 0 && !this.promotionOpen,
      disabled: this.promotionOpen,
    });
  }

  private controlsElements() {
    return {
      difficulty: this.els.difficultySelect,
      side: this.els.sideSelect,
      undo: this.els.undoButton,
    };
  }
}
