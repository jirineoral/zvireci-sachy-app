/**
 * Puzzles (Phase 10 / R2): the shipped Lichess subset (`public/puzzles/puzzles.json`, CC0),
 * band selection and solved-progress in `localStorage`. Lichess semantics: `fen` is the
 * position before the opponent's move `moves[0]`; the solver answers with `moves[1]`,
 * the opponent replies with `moves[2]`, and so on.
 */
import { Chess } from 'chess.js';

export interface PuzzleBand {
  id: string;
  label: string;
  min: number;
  max: number;
}

export interface Puzzle {
  id: string;
  fen: string;
  /** UCI moves, opponent first. */
  moves: string[];
  rating: number;
  themes: string[];
}

export interface PuzzleSet {
  bands: PuzzleBand[];
  puzzles: Puzzle[];
}

export interface PuzzleProgress {
  band: string;
  /** puzzle id → attempts needed (1 = first try). */
  solved: Record<string, number>;
}

export const PUZZLES_STORAGE_KEY = 'skm.puzzles';
const ID_PATTERN = /^[A-Za-z0-9]{3,12}$/;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export class PuzzleLoadError extends Error {}

export async function loadPuzzleSet(baseUrl: string): Promise<PuzzleSet> {
  let raw: unknown;
  try {
    const response = await fetch(`${baseUrl}puzzles/puzzles.json`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = await response.json();
  } catch (err) {
    console.error('Puzzle set could not be loaded', err);
    throw new PuzzleLoadError('Úlohy se nepodařilo načíst. Zkus to za chvíli znovu.');
  }
  const set = validateSet(raw);
  if (!set) throw new PuzzleLoadError('Soubor s úlohami je poškozený.');
  return set;
}

function validateSet(raw: unknown): PuzzleSet | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.bands) || !Array.isArray(r.puzzles)) return null;
  const bands: PuzzleBand[] = [];
  for (const b of r.bands) {
    if (typeof b !== 'object' || b === null) return null;
    const x = b as Record<string, unknown>;
    if (typeof x.id !== 'string' || typeof x.label !== 'string' || typeof x.min !== 'number' || typeof x.max !== 'number') return null;
    bands.push({ id: x.id, label: x.label, min: x.min, max: x.max });
  }
  const puzzles: Puzzle[] = [];
  for (const row of r.puzzles) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [id, fen, moves, rating, themes] = row as unknown[];
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || typeof fen !== 'string' || typeof moves !== 'string' || typeof rating !== 'number') continue;
    const uci = moves.split(' ');
    if (uci.length < 2 || !uci.every((m) => UCI_PATTERN.test(m))) continue;
    puzzles.push({ id, fen, moves: uci, rating, themes: typeof themes === 'string' ? themes.split(' ').filter(Boolean) : [] });
  }
  if (bands.length === 0 || puzzles.length === 0) return null;
  return { bands, puzzles };
}

/** Replays the puzzle through chess.js; false when the data does not fit the rules. */
export function puzzleIsPlayable(p: Puzzle): boolean {
  try {
    const chess = new Chess(p.fen);
    for (const uci of p.moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return true;
  } catch {
    return false;
  }
}

export function readProgress(storage: Storage | null, set: PuzzleSet): PuzzleProgress {
  const fallback: PuzzleProgress = { band: set.bands[Math.min(1, set.bands.length - 1)].id, solved: {} };
  let raw: string | null = null;
  try {
    raw = storage?.getItem(PUZZLES_STORAGE_KEY) ?? null;
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null) throw new Error('not an object');
    const o = v as Record<string, unknown>;
    const band = typeof o.band === 'string' && set.bands.some((b) => b.id === o.band) ? o.band : fallback.band;
    const solved: Record<string, number> = {};
    if (typeof o.solved === 'object' && o.solved !== null) {
      for (const [id, n] of Object.entries(o.solved as Record<string, unknown>)) {
        if (ID_PATTERN.test(id) && typeof n === 'number' && n >= 1 && n < 1000) solved[id] = Math.floor(n);
        if (Object.keys(solved).length > set.puzzles.length) break;
      }
    }
    return { band, solved };
  } catch {
    console.warn('Stored puzzle progress is unreadable; starting over');
    return fallback;
  }
}

export function writeProgress(storage: Storage | null, progress: PuzzleProgress): void {
  try {
    storage?.setItem(PUZZLES_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Could not persist puzzle progress', err);
  }
}

/** A random unsolved puzzle of the band (all solved → any puzzle of the band). */
export function nextPuzzle(set: PuzzleSet, progress: PuzzleProgress, exclude: string | null = null): Puzzle | null {
  const band = set.bands.find((b) => b.id === progress.band) ?? set.bands[0];
  const inBand = set.puzzles.filter((p) => p.rating >= band.min && p.rating <= band.max && p.id !== exclude);
  if (inBand.length === 0) return null;
  const fresh = inBand.filter((p) => !(p.id in progress.solved));
  const pool = fresh.length > 0 ? fresh : inBand;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function bandCounts(set: PuzzleSet, progress: PuzzleProgress): { solved: number; total: number; label: string } {
  const band = set.bands.find((b) => b.id === progress.band) ?? set.bands[0];
  const inBand = set.puzzles.filter((p) => p.rating >= band.min && p.rating <= band.max);
  const solved = inBand.filter((p) => p.id in progress.solved).length;
  return { solved, total: inBand.length, label: band.label };
}
