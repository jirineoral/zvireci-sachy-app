/**
 * Difficulty ladder. All levels drive Stockfish through `Skill Level` plus a depth cap
 * (one strength mechanism only). The two weakest levels additionally pick their move at
 * random among the engine's top `topMoves` candidates that lie within `topWindowCp` of
 * the best one (MultiPV of the same weak search): the opponent stays coherent — a hanging
 * piece is still saved when every alternative loses it — but varies its play and misses
 * the finer points. This replaced "a share of uniformly random legal moves" (Phase 4),
 * which read as oblivious rather than weak: quiet pawn pushes while a rook hangs (MVP
 * release, 2026-09-13, docs/phase-7-plan.md M5). The numbers are an estimate to be tuned
 * by playing; this table is the single place to change them.
 */
import type { EngineOptions, SearchLimits } from './engine';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Difficulty {
  level: DifficultyLevel;
  label: string;
  options: EngineOptions;
  limits: SearchLimits;
  /** The move is drawn at random among the engine's best `topMoves` lines (1 = always the best). */
  topMoves: number;
  /** Candidates worse than the best line by more than this (centipawns) are never drawn. */
  topWindowCp: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { level: 1, label: '1 · Jikra', options: { skillLevel: 0, multiPv: 8 }, limits: { depth: 1, movetimeMs: 300 }, topMoves: 8, topWindowCp: 250 },
  { level: 2, label: '2 · Pulec', options: { skillLevel: 0, multiPv: 5 }, limits: { depth: 1, movetimeMs: 300 }, topMoves: 5, topWindowCp: 120 },
  { level: 3, label: '3 · Žabka', options: { skillLevel: 0 }, limits: { depth: 2, movetimeMs: 400 }, topMoves: 1, topWindowCp: 0 },
  { level: 4, label: '4 · Skokan', options: { skillLevel: 1 }, limits: { depth: 3, movetimeMs: 500 }, topMoves: 1, topWindowCp: 0 },
  { level: 5, label: '5 · Ropucha', options: { skillLevel: 3 }, limits: { depth: 4, movetimeMs: 700 }, topMoves: 1, topWindowCp: 0 },
  { level: 6, label: '6 · Žabí král', options: { skillLevel: 6 }, limits: { depth: 6, movetimeMs: 1000 }, topMoves: 1, topWindowCp: 0 },
  // Pilot feedback (P2): adults beat level 6 at once. Level 7 is the engine at full strength
  // for adults and strong juniors; the children's ladder 1–6 and the campaign (interpolated
  // over 1–6) are unchanged. The label is the same for every character.
  { level: 7, label: '7 · Velmistr', options: { skillLevel: 20 }, limits: { depth: 14, movetimeMs: 1500 }, topMoves: 1, topWindowCp: 0 },
];

/** The campaign interpolates over the children's ladder only. */
export const CAMPAIGN_MAX_LEVEL = 6;

export const DEFAULT_DIFFICULTY: DifficultyLevel = 3;

export function difficulty(level: DifficultyLevel): Difficulty {
  const found = DIFFICULTIES.find((d) => d.level === level);
  if (!found) throw new Error(`Unknown difficulty level ${level}`);
  return found;
}

export function isDifficultyLevel(value: number): value is DifficultyLevel {
  return DIFFICULTIES.some((d) => d.level === value);
}

/**
 * A point on the ladder between two levels (campaign, Phase 11): `x` in [1, 6], the
 * numbers linearly interpolated between the neighbouring levels and rounded. `x = 3.5`
 * plays between "Žabka" and "Skokan"; whole numbers reproduce the table exactly.
 */
export function interpolateDifficulty(x: number): Difficulty {
  const clamped = Math.min(CAMPAIGN_MAX_LEVEL, Math.max(1, Number.isFinite(x) ? x : DEFAULT_DIFFICULTY));
  const lo = difficulty(Math.floor(clamped) as DifficultyLevel);
  const hi = difficulty(Math.ceil(clamped) as DifficultyLevel);
  const t = clamped - Math.floor(clamped);
  const lerp = (a: number, b: number): number => Math.round(a + (b - a) * t);
  const topMoves = lerp(lo.topMoves, hi.topMoves);
  const options: EngineOptions = { skillLevel: lerp(lo.options.skillLevel, hi.options.skillLevel) };
  if (topMoves > 1) options.multiPv = topMoves;
  return {
    level: Math.round(clamped) as DifficultyLevel,
    label: `Kampaň (${clamped.toFixed(1)})`,
    options,
    limits: { depth: lerp(lo.limits.depth, hi.limits.depth), movetimeMs: lerp(lo.limits.movetimeMs, hi.limits.movetimeMs) },
    topMoves,
    topWindowCp: lerp(lo.topWindowCp, hi.topWindowCp),
  };
}
