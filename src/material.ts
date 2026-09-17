/**
 * Captured pieces and material balance (Phase 19, pilot P5). Pure: derived from the
 * game's start position and the position shown, nothing is tracked move by move — so
 * undo, review and loaded games are right by construction.
 */
import type { Chess, Color, PieceSymbol } from 'chess.js';

/** Non-king pieces in tray order (small to large). */
export const TRAY_ORDER: readonly PieceSymbol[] = ['p', 'n', 'b', 'r', 'q'];

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface Material {
  /** Pieces each colour has captured (opponent's pieces gone since the start), tray order. */
  captured: Record<Color, PieceSymbol[]>;
  /** Material on the board, white minus black (P 1, N 3, B 3, R 5, Q 9). */
  balance: number;
}

/** Counts of the non-king pieces on the board, per colour. */
function count(chess: Chess): Record<Color, Record<PieceSymbol, number>> {
  const zero = (): Record<PieceSymbol, number> => ({ p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 });
  const c: Record<Color, Record<PieceSymbol, number>> = { w: zero(), b: zero() };
  for (const row of chess.board()) for (const sq of row) if (sq) c[sq.color][sq.type]++;
  return c;
}

export function capturedMaterial(start: Chess, shown: Chess): Material {
  const before = count(start);
  const now = count(shown);
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  let balance = 0;
  for (const color of ['w', 'b'] as const) {
    const taker: Color = color === 'w' ? 'b' : 'w';
    for (const type of TRAY_ORDER) {
      // A promotion adds a queen: clamped at 0, the pawn still counts as lost.
      const gone = Math.max(0, before[color][type] - now[color][type]);
      for (let i = 0; i < gone; i++) captured[taker].push(type);
      balance += (color === 'w' ? 1 : -1) * VALUE[type] * now[color][type];
    }
  }
  return { captured, balance };
}
