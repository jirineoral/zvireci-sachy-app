/**
 * Difficulty ladder. All levels drive Stockfish through `Skill Level` plus a depth cap
 * (one strength mechanism only). The two weakest levels additionally replace a share of
 * the engine's moves with a uniformly random legal move (from chess.js): even at depth 1
 * Stockfish resolves every capture sequence and never hangs a piece, which made the
 * bottom of the ladder feel like a "greedy automaton" rather than a beginner (tester
 * feedback, 2026-09-12). The numbers are an estimate to be tuned by playing; this table
 * is the single place to change them.
 */
import type { EngineOptions, SearchLimits } from './engine';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Difficulty {
  level: DifficultyLevel;
  label: string;
  options: EngineOptions;
  limits: SearchLimits;
  /** Probability (0-1) that a move is drawn at random from the legal moves instead of asked from the engine. */
  randomMoveChance: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { level: 1, label: '1 · Jikra', options: { skillLevel: 0 }, limits: { depth: 1, movetimeMs: 300 }, randomMoveChance: 0.6 },
  { level: 2, label: '2 · Pulec', options: { skillLevel: 0 }, limits: { depth: 1, movetimeMs: 300 }, randomMoveChance: 0.3 },
  { level: 3, label: '3 · Žabka', options: { skillLevel: 0 }, limits: { depth: 2, movetimeMs: 400 }, randomMoveChance: 0 },
  { level: 4, label: '4 · Skokan', options: { skillLevel: 1 }, limits: { depth: 3, movetimeMs: 500 }, randomMoveChance: 0 },
  { level: 5, label: '5 · Ropucha', options: { skillLevel: 3 }, limits: { depth: 4, movetimeMs: 700 }, randomMoveChance: 0 },
  { level: 6, label: '6 · Žabí král', options: { skillLevel: 6 }, limits: { depth: 6, movetimeMs: 1000 }, randomMoveChance: 0 },
];

export const DEFAULT_DIFFICULTY: DifficultyLevel = 3;

export function difficulty(level: DifficultyLevel): Difficulty {
  const found = DIFFICULTIES.find((d) => d.level === level);
  if (!found) throw new Error(`Unknown difficulty level ${level}`);
  return found;
}

export function isDifficultyLevel(value: number): value is DifficultyLevel {
  return DIFFICULTIES.some((d) => d.level === value);
}
