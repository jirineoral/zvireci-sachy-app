/**
 * The single stateful object of the app. Owns the chess.js game, the board
 * bridge and the UI element references. No module-level mutable state exists
 * anywhere else.
 */
import { Chess, type Square } from 'chess.js';
import { createBoardBridge, type BoardBridge } from './board-bridge';
import { gameStatus } from './game-status';
import { renderMoveList } from './ui/move-list';
import { renderStatus } from './ui/status';

export interface GameControllerElements {
  board: HTMLElement;
  status: HTMLElement;
  moveList: HTMLElement;
  newGameButton: HTMLButtonElement;
}

export class GameController {
  private readonly chess: Chess;
  private readonly board: BoardBridge;

  constructor(private readonly els: GameControllerElements) {
    this.chess = new Chess();
    this.board = createBoardBridge(els.board, (from, to) => this.handleUserMove(from, to));
    els.newGameButton.addEventListener('click', () => this.newGame());
    this.newGame();
  }

  newGame(): void {
    this.chess.reset();
    this.board.sync(this.chess);
    this.render();
  }

  private handleUserMove(from: Square, to: Square): void {
    try {
      // TODO(phase-2): promotion dialog — auto-promote to queen for now.
      // chess.js ignores `promotion` on non-promotion moves, so passing it always is safe.
      this.chess.move({ from, to, promotion: 'q' });
    } catch (err) {
      console.error(`Move ${from}->${to} rejected by chess.js`, err);
    }
    this.board.sync(this.chess); // always re-sync from chess.js, success or failure
    this.render();
  }

  private render(): void {
    renderMoveList(this.els.moveList, this.chess.history());
    renderStatus(this.els.status, gameStatus(this.chess));
  }
}
