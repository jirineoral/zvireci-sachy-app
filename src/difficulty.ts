/**
 * Difficulty ladder. All levels drive Stockfish through `Skill Level` plus a depth cap
 * (one strength mechanism only). The numbers are an initial estimate to be tuned by
 * playing; this table is the single place to change them.
 */
import type { EngineOptions, SearchLimits } from './engine';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Difficulty {
  level: DifficultyLevel;
  label: string;
  options: EngineOptions;
  limits: SearchLimits;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { level: 1, label: '1 · Jikra', options: { skillLevel: 0 }, limits: { depth: 1, movetimeMs: 300 } },
  { level: 2, label: '2 · Pulec', options: { skillLevel: 0 }, limits: { depth: 2, movetimeMs: 400 } },
  { level: 3, label: '3 · Žabka', options: { skillLevel: 1 }, limits: { depth: 3, movetimeMs: 500 } },
  { level: 4, label: '4 · Skokan', options: { skillLevel: 3 }, limits: { depth: 4, movetimeMs: 700 } },
  { level: 5, label: '5 · Ropucha', options: { skillLevel: 6 }, limits: { depth: 6, movetimeMs: 1000 } },
  { level: 6, label: '6 · Žabí král', options: { skillLevel: 10 }, limits: { depth: 8, movetimeMs: 1200 } },
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
