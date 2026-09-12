/**
 * Human-readable game status, derived exclusively from chess.js flags.
 * No position inspection of our own happens here.
 */
import type { Chess } from 'chess.js';

export interface GameStatus {
  over: boolean;
  text: string;
}

export function gameStatus(chess: Chess): GameStatus {
  const sideToMove = chess.turn() === 'w' ? 'bílý' : 'černý';
  const winner = chess.turn() === 'w' ? 'černý' : 'bílý';

  if (chess.isCheckmate()) return { over: true, text: `Šach mat — vyhrává ${winner}` };
  if (chess.isStalemate()) return { over: true, text: 'Remíza — pat' };
  if (chess.isInsufficientMaterial()) {
    return { over: true, text: 'Remíza — nedostatečný materiál' };
  }
  if (chess.isThreefoldRepetition()) return { over: true, text: 'Remíza — trojí opakování' };
  if (chess.isDrawByFiftyMoves()) return { over: true, text: 'Remíza — pravidlo 50 tahů' };

  const check = chess.inCheck() ? ' — šach!' : '';
  return { over: false, text: `Na tahu: ${sideToMove}${check}` };
}
