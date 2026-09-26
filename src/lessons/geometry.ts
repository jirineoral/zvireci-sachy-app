/**
 * Lessons: board geometry without the rules of a game. chess.js needs a legal position
 * (two kings, side to move); lessons also show a lone piece on an empty board and must
 * explain moves chess.js would refuse („tvůj král by byl v šachu“). This module knows
 * how pieces move and what they attack — nothing about turns, check or castling.
 * Pure; runs in the browser and in node (scripts/check-lessons.mjs).
 */
import type { Color, Square } from 'chess.js';
import type { PieceType } from './types';

export interface BoardPiece {
  type: PieceType;
  color: Color;
}

/** Square → piece. Empty squares are absent. */
export type Board = Map<Square, BoardPiece>;

const FILES = 'abcdefgh';

export function squareOf(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${rank + 1}` as Square;
}

export function fileOf(sq: Square): number {
  return FILES.indexOf(sq[0]);
}

export function rankOf(sq: Square): number {
  return Number(sq[1]) - 1;
}

export function isSquare(s: string): s is Square {
  return /^[a-h][1-8]$/.test(s);
}

/** a1 is dark. */
export function isLightSquare(sq: Square): boolean {
  return (fileOf(sq) + rankOf(sq)) % 2 === 1;
}

/** The placement field of a FEN → board; throws on malformed input. */
export function parsePlacement(fen: string): Board {
  const placement = fen.trim().split(/\s+/)[0] ?? '';
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error(`FEN placement must have 8 ranks: ${fen}`);
  const board: Board = new Map();
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const lower = ch.toLowerCase();
      if (!'pnbrqk'.includes(lower)) throw new Error(`Bad piece "${ch}" in FEN: ${fen}`);
      const sq = squareOf(file, rank);
      if (!sq) throw new Error(`Rank ${rank + 1} too long in FEN: ${fen}`);
      board.set(sq, { type: lower as PieceType, color: ch === lower ? 'b' : 'w' });
      file++;
    }
    if (file !== 8) throw new Error(`Rank ${rank + 1} has ${file} squares in FEN: ${fen}`);
  });
  return board;
}

/** Board → placement field (rank 8 first). */
export function placementOf(board: Board): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = board.get(squareOf(file, rank)!);
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += String(empty);
      empty = 0;
      row += p.color === 'w' ? p.type.toUpperCase() : p.type;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const KING_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS] as const;
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const;

/** Squares a piece on `from` attacks (for a pawn: its two capture squares). Own pieces included. */
export function attacks(board: Board, from: Square): Square[] {
  const piece = board.get(from);
  if (!piece) return [];
  const f = fileOf(from);
  const r = rankOf(from);
  const out: Square[] = [];
  const slide = (dirs: readonly (readonly [number, number])[]): void => {
    for (const [df, dr] of dirs) {
      for (let i = 1; i < 8; i++) {
        const sq = squareOf(f + df * i, r + dr * i);
        if (!sq) break;
        out.push(sq);
        if (board.has(sq)) break;
      }
    }
  };
  const step = (dirs: readonly (readonly [number, number])[]): void => {
    for (const [df, dr] of dirs) {
      const sq = squareOf(f + df, r + dr);
      if (sq) out.push(sq);
    }
  };
  switch (piece.type) {
    case 'r': slide(ROOK_DIRS); break;
    case 'b': slide(BISHOP_DIRS); break;
    case 'q': slide(KING_DIRS); break;
    case 'k': step(KING_DIRS); break;
    case 'n': step(KNIGHT_JUMPS); break;
    case 'p': step(piece.color === 'w' ? [[-1, 1], [1, 1]] : [[-1, -1], [1, -1]]); break;
  }
  return out;
}

/**
 * Where the piece on `from` may go ignoring check: its attacks minus own pieces (and the
 * enemy king, which is never taken), and for a pawn its pushes (two from the start rank
 * when both squares are empty), captures only onto enemy pieces or `epSquare`.
 */
export function pseudoTargets(board: Board, from: Square, epSquare: Square | null = null): Square[] {
  const piece = board.get(from);
  if (!piece) return [];
  const takeable = (sq: Square): boolean => {
    const t = board.get(sq);
    return !t || (t.color !== piece.color && t.type !== 'k');
  };
  if (piece.type !== 'p') return attacks(board, from).filter(takeable);
  const dir = piece.color === 'w' ? 1 : -1;
  const f = fileOf(from);
  const r = rankOf(from);
  const out: Square[] = [];
  const one = squareOf(f, r + dir);
  if (one && !board.has(one)) {
    out.push(one);
    const startRank = piece.color === 'w' ? 1 : 6;
    const two = squareOf(f, r + 2 * dir);
    if (r === startRank && two && !board.has(two)) out.push(two);
  }
  for (const sq of attacks(board, from)) {
    const t = board.get(sq);
    if ((t && t.color !== piece.color && t.type !== 'k') || sq === epSquare) out.push(sq);
  }
  return out;
}

/** Squares of `color`'s pieces that attack `target`. */
export function attackersOf(board: Board, target: Square, color: Color): Square[] {
  const out: Square[] = [];
  for (const [sq, p] of board) if (p.color === color && attacks(board, sq).includes(target)) out.push(sq);
  return out;
}

/** The board after moving `from` → `to` (captures by replacement; e.p. and castling are not modelled). */
export function moved(board: Board, from: Square, to: Square, promotion?: PieceType): Board {
  const next = new Map(board);
  const piece = next.get(from);
  if (!piece) return next;
  next.delete(from);
  next.set(to, promotion ? { type: promotion, color: piece.color } : piece);
  return next;
}

export function findKing(board: Board, color: Color): Square | null {
  for (const [sq, p] of board) if (p.type === 'k' && p.color === color) return sq;
  return null;
}
