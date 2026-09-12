/**
 * Human-readable game status, derived exclusively from chess.js flags.
 * No position inspection of our own happens here.
 *
 * `over` is the single definition of "game over" in the app: chess.js's own
 * `isGameOver()`. The branches below only choose the wording.
 */
import type { Chess } from 'chess.js';

export interface GameStatus {
  over: boolean;
  text: string;
}

export function gameStatus(chess: Chess): GameStatus {
  const over = chess.isGameOver();
  const sideToMove = chess.turn() === 'w' ? 'bílý' : 'černý';
  const winner = chess.turn() === 'w' ? 'černý' : 'bílý';

  if (chess.isCheckmate()) return { over, text: `Šach mat — vyhrává ${winner}` };
  if (chess.isStalemate()) return { over, text: 'Remíza — pat' };
  if (chess.isInsufficientMaterial()) return { over, text: 'Remíza — nedostatečný materiál' };
  if (chess.isThreefoldRepetition()) return { over, text: 'Remíza — trojí opakování' };
  if (chess.isDrawByFiftyMoves()) return { over, text: 'Remíza — pravidlo 50 tahů' };

  if (over) {
    console.error('Game over with no matching reason', chess.fen());
    return { over, text: 'Konec hry' };
  }

  const check = chess.inCheck() ? ' — šach!' : '';
  return { over, text: `Na tahu: ${sideToMove}${check}` };
}
