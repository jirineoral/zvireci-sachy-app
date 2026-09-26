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
  /** Phase 21a: only puzzles with this Lichess theme tag (null = all themes). */
  theme: string | null;
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
  const fallback: PuzzleProgress = { band: set.bands[Math.min(1, set.bands.length - 1)].id, theme: null, solved: {} };
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
    const theme = typeof o.theme === 'string' && THEME_LABELS.has(o.theme) ? o.theme : null;
    return { band, theme, solved };
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

/** The puzzles of the progress's band (and theme, when one is chosen). */
function inSelection(set: PuzzleSet, progress: PuzzleProgress): Puzzle[] {
  const band = set.bands.find((b) => b.id === progress.band) ?? set.bands[0];
  return set.puzzles.filter((p) => p.rating >= band.min && p.rating <= band.max && (progress.theme === null || p.themes.includes(progress.theme)));
}

/** A random unsolved puzzle of the band and theme (all solved → any of them). */
export function nextPuzzle(set: PuzzleSet, progress: PuzzleProgress, exclude: string | null = null): Puzzle | null {
  const inBand = inSelection(set, progress).filter((p) => p.id !== exclude);
  if (inBand.length === 0) return null;
  const fresh = inBand.filter((p) => !(p.id in progress.solved));
  const pool = fresh.length > 0 ? fresh : inBand;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function bandCounts(set: PuzzleSet, progress: PuzzleProgress): { solved: number; total: number; label: string } {
  const band = set.bands.find((b) => b.id === progress.band) ?? set.bands[0];
  const selection = inSelection(set, progress);
  const solved = selection.filter((p) => p.id in progress.solved).length;
  const theme = progress.theme !== null ? THEME_LABELS.get(progress.theme) : undefined;
  return { solved, total: selection.length, label: theme ? `${band.label} · ${theme}` : band.label };
}

/** The named themes present in a band, in THEME_NAMES order, with their puzzle counts. */
export function themesInBand(set: Pick<PuzzleSet, 'bands' | 'puzzles'>, bandId: string): { tag: string; label: string; count: number }[] {
  const band = set.bands.find((b) => b.id === bandId) ?? set.bands[0];
  const counts = new Map<string, number>();
  for (const p of set.puzzles) {
    if (p.rating < band.min || p.rating > band.max) continue;
    for (const t of p.themes) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return THEME_NAMES.filter(([tag]) => (counts.get(tag) ?? 0) > 0).map(([tag, label]) => ({ tag, label, count: counts.get(tag) ?? 0 }));
}

/**
 * Czech names of Lichess puzzle themes, most telling first. Tags missing here (length,
 * "crushing", "master", rare mate patterns…) are not shown at all and cannot be filtered on.
 */
export const THEME_NAMES: readonly (readonly [string, string])[] = [
  ['mateIn1', 'mat 1. tahem'],
  ['mateIn2', 'mat 2. tahem'],
  ['mateIn3', 'mat 3. tahem'],
  ['mateIn4', 'mat 4. tahem'],
  ['mateIn5', 'mat 5. tahem'],
  ['backRankMate', 'mat na poslední řadě'],
  ['smotheredMate', 'dušený mat'],
  ['arabianMate', 'arabský mat'],
  ['anastasiaMate', 'Anastáziin mat'],
  ['bodenMate', 'Bodenův mat'],
  ['epauletteMate', 'epoletový mat'],
  ['mate', 'mat'],
  ['fork', 'vidlička'],
  ['pin', 'vazba'],
  ['skewer', 'rentgen'],
  ['discoveredAttack', 'odtažný útok'],
  ['discoveredCheck', 'odtažný šach'],
  ['doubleCheck', 'dvojšach'],
  ['hangingPiece', 'nechráněná figurka'],
  ['trappedPiece', 'chycená figurka'],
  ['sacrifice', 'oběť'],
  ['attraction', 'vlákání'],
  ['deflection', 'odlákání'],
  ['capturingDefender', 'odstranění obránce'],
  ['clearance', 'uvolnění cesty'],
  ['interference', 'přerušení'],
  ['intermezzo', 'mezitah'],
  ['quietMove', 'tichý tah'],
  ['defensiveMove', 'obranný tah'],
  ['promotion', 'proměna'],
  ['advancedPawn', 'daleko postoupený pěšec'],
  ['enPassant', 'braní mimochodem'],
  ['castling', 'rošáda'],
  ['kingsideAttack', 'útok na krále'],
  ['queensideAttack', 'útok na dámském křídle'],
  ['attackingF2F7', 'útok na f2/f7'],
  ['exposedKing', 'odkrytý král'],
  ['pawnEndgame', 'pěšcová koncovka'],
  ['rookEndgame', 'věžová koncovka'],
  ['bishopEndgame', 'střelcová koncovka'],
  ['knightEndgame', 'jezdcová koncovka'],
  ['queenEndgame', 'dámská koncovka'],
  ['queenRookEndgame', 'koncovka s dámou a věží'],
  ['endgame', 'koncovka'],
  ['middlegame', 'střední hra'],
  ['opening', 'zahájení'],
];

export const THEME_LABELS: ReadonlyMap<string, string> = new Map(THEME_NAMES.map(([tag, label]) => [tag, label]));

/** The puzzle's themes as Czech names; "mat" and "koncovka" only when nothing more exact is known. */
export function themeNames(themes: readonly string[]): string[] {
  const known = THEME_NAMES.filter(([tag]) => themes.includes(tag)).map(([tag]) => tag);
  const exactMate = known.some((t) => t.startsWith('mateIn') || t.endsWith('Mate'));
  const exactEndgame = known.some((t) => t.endsWith('Endgame'));
  return THEME_NAMES.filter(([tag]) => known.includes(tag) && !(tag === 'mate' && exactMate) && !(tag === 'endgame' && exactEndgame)).map(([, name]) => name);
}
