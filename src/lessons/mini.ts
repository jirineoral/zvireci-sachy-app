/**
 * Lessons: mini-games (Phase 21b) — pěšcová válka and seber všechny pěšce. They are not
 * chess games: no kings, no check, their own win conditions (types.ts, `MiniStep`). So
 * they cannot go through chess.js or Stockfish (both need two kings and a legal chess
 * position); the opponent is this small local move picker on the lesson geometry instead.
 * It is deliberately weak — it never looks ahead — so a child can always win. Pure and
 * deterministic for a given `random`, so node tests can measure how beatable it is.
 */
import type { Color, Square } from 'chess.js';
import { moved, pseudoTargets, rankOf, type Board } from './geometry';
import type { MiniStep } from './types';

export type MiniGoal = MiniStep['goal'];
export type MiniMove = [Square, Square];

export type MiniResult =
  | { result: 'won'; reason: 'promoted' | 'captured-all' }
  | { result: 'lost'; reason: 'promoted' | 'captured-all' | 'piece-taken' }
  | { result: 'draw'; reason: 'blocked' };

/** Every move of `color`'s pieces (pawns: pushes and captures, no en passant). */
export function miniMoves(board: Board, color: Color): MiniMove[] {
  const out: MiniMove[] = [];
  for (const [sq, p] of board) {
    if (p.color !== color) continue;
    for (const to of pseudoTargets(board, sq)) out.push([sq, to]);
  }
  return out;
}

export function countPawns(board: Board, color: Color): number {
  let n = 0;
  for (const p of board.values()) if (p.color === color && p.type === 'p') n++;
  return n;
}

function countPieces(board: Board, color: Color): number {
  let n = 0;
  for (const p of board.values()) if (p.color === color && p.type !== 'p') n++;
  return n;
}

const lastRank = (color: Color): number => (color === 'w' ? 7 : 0);

function promotedPawn(board: Board, color: Color): boolean {
  for (const [sq, p] of board) if (p.color === color && p.type === 'p' && rankOf(sq) === lastRank(color)) return true;
  return false;
}

/**
 * The result after `mover` has moved (null = the game goes on). `child` is the child's colour.
 * Pěšcová válka: a pawn on the last rank, or no enemy pawns left, wins for the mover; the
 * next side without a move → draw. Seber všechny pěšce: no pawns left → the child wins; the
 * child's piece gone or a pawn on the last rank → the child lost (a pawn side without a move
 * simply passes, see `pickReply`).
 */
export function miniOutcome(goal: MiniGoal, board: Board, mover: Color, child: Color): MiniResult | null {
  const other: Color = mover === 'w' ? 'b' : 'w';
  const engine: Color = child === 'w' ? 'b' : 'w';
  if (goal === 'promote-first') {
    const won = mover === child;
    if (promotedPawn(board, mover)) return won ? { result: 'won', reason: 'promoted' } : { result: 'lost', reason: 'promoted' };
    if (countPawns(board, other) === 0) return won ? { result: 'won', reason: 'captured-all' } : { result: 'lost', reason: 'captured-all' };
    if (miniMoves(board, other).length === 0) return { result: 'draw', reason: 'blocked' };
    return null;
  }
  if (countPieces(board, child) === 0) return { result: 'lost', reason: 'piece-taken' };
  if (promotedPawn(board, engine)) return { result: 'lost', reason: 'promoted' };
  if (countPawns(board, engine) === 0) return { result: 'won', reason: 'captured-all' };
  if (miniMoves(board, child).length === 0) return { result: 'draw', reason: 'blocked' };
  return null;
}

/**
 * The weak opponent's move, or null when it has none. Level 1: it promotes when it can,
 * takes the child's piece in the queen game (that is the lesson), otherwise takes a pawn
 * only half the time and else pushes a random pawn. Level 2 always takes and prefers
 * pushes that cannot be taken. Neither looks further than this one move.
 */
export function pickReply(goal: MiniGoal, board: Board, engine: Color, level: 1 | 2, random: () => number): MiniMove | null {
  const moves = miniMoves(board, engine);
  if (moves.length === 0) return null;
  const pick = (list: MiniMove[]): MiniMove => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  const promoting = moves.filter(([, to]) => rankOf(to) === lastRank(engine));
  if (promoting.length) return pick(promoting);
  const captures = moves.filter(([, to]) => board.has(to));
  const bigCaptures = captures.filter(([, to]) => board.get(to)!.type !== 'p');
  if (goal === 'capture-all-pawns' && bigCaptures.length) return pick(bigCaptures);
  if (captures.length && (level === 2 || random() < 0.5)) return pick(captures);
  const quiet = moves.filter(([, to]) => !board.has(to));
  if (level === 2) {
    const child: Color = engine === 'w' ? 'b' : 'w';
    const safe = quiet.filter(([from, to]) => !miniMoves(moved(board, from, to), child).some(([, t]) => t === to));
    if (safe.length) return pick(safe);
  }
  return pick(quiet.length ? quiet : moves);
}

/** A small seeded generator (mulberry32) for reproducible games in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
