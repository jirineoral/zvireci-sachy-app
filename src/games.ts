/**
 * Game records (Phase 9): what the review needs to replay and analyse any game — the one
 * just played, a saved one, a pasted PGN, later an imported one. Kept in IndexedDB
 * (`skm` / `games`), browser-local; memory fallback when storage is unavailable.
 */
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { STORE_GAMES as STORE, openDatabase, requestToPromise } from './db';
import type { Glyph } from './feedback';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

/** Per-ply data, superset of the review's PlyRecord: play-time feedback plus analysis. */
export interface PlyData {
  glyph: Glyph | null;
  betterSan: string | null;
  /** Analysis: eval of the position AFTER this ply, white POV, centipawns (mate-normalised). */
  evalCp?: number;
  /** Analysis: the engine's best move in the position AFTER this ply (SAN), if any. */
  bestSan?: string | null;
}

export interface GameRecord {
  id: string;
  playedAt: number;
  startFen: string;
  sans: string[];
  result: GameResult;
  /** Which side the human played; null for imported games. */
  humanColor: 'w' | 'b' | null;
  /** Display names of the two sides (character names or PGN players). */
  white: string;
  black: string;
  plies: (PlyData | null)[];
  /** Eval of the start position (white POV) once analysed. */
  startEvalCp?: number;
  startBestSan?: string | null;
  source: 'app' | 'pgn';
  /** Phase 14: the difficulty level in force (1–6; a campaign step rounds to the nearest). Absent in old records. */
  level?: number;
  /** Phase 14: how the game came about. Absent in old records (= play). */
  mode?: GameMode;
}

export type GameMode = 'play' | 'campaign' | 'training' | 'two';

export interface Tally {
  wins: number;
  draws: number;
  losses: number;
}

export interface GameStats {
  /** Index 0 unused; 1–6 by level (games with a known level, mode play). */
  byLevel: Tally[];
  campaign: Tally;
  /** Games without a level (records from before Phase 14). */
  unknown: Tally;
  total: Tally;
  /** By opponent display name, in order of first appearance. */
  byOpponent: { name: string; tally: Tally }[];
}

const emptyTally = (): Tally => ({ wins: 0, draws: 0, losses: 0 });

function addTo(t: Tally, record: GameRecord): void {
  if (record.result === '1/2-1/2') t.draws++;
  else if ((record.result === '1-0') === (record.humanColor === 'w')) t.wins++;
  else t.losses++;
}

/**
 * The player's own record (R1, option c): finished games the app played, training and
 * imported PGNs left out. Old records without a level count in the total only.
 */
export function statsFrom(records: readonly GameRecord[]): GameStats {
  const stats: GameStats = { byLevel: Array.from({ length: 7 }, emptyTally), campaign: emptyTally(), unknown: emptyTally(), total: emptyTally(), byOpponent: [] };
  for (const r of records) {
    if (r.source !== 'app' || r.humanColor === null || r.result === '*' || r.mode === 'training' || r.mode === 'two') continue;
    addTo(stats.total, r);
    if (r.mode === 'campaign') addTo(stats.campaign, r);
    else if (r.level !== undefined && r.level >= 1 && r.level <= 6) addTo(stats.byLevel[r.level], r);
    else addTo(stats.unknown, r);
    const opponent = r.humanColor === 'w' ? r.black : r.white;
    let row = stats.byOpponent.find((o) => o.name === opponent);
    if (!row) {
      row = { name: opponent, tally: emptyTally() };
      stats.byOpponent.push(row);
    }
    addTo(row.tally, r);
  }
  return stats;
}

export interface GameStore {
  readonly persistent: boolean;
  list(): Promise<GameRecord[]>;
  save(record: GameRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

export function newGameId(): string {
  return `g${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function openGameStore(): Promise<GameStore> {
  try {
    const db = await openDatabase();
    return new IdbGames(db);
  } catch (err) {
    console.warn('IndexedDB unavailable; saved games will last only for this session', err);
    return new MemoryGames();
  }
}

class IdbGames implements GameStore {
  readonly persistent = true;
  constructor(private readonly db: IDBDatabase) {}
  async list(): Promise<GameRecord[]> {
    const tx = this.db.transaction(STORE, 'readonly');
    const all = await requestToPromise(tx.objectStore(STORE).getAll());
    return all.filter(isGameRecord).sort((a, b) => b.playedAt - a.playedAt);
  }
  async save(record: GameRecord): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    await requestToPromise(tx.objectStore(STORE).put(record));
  }
  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    await requestToPromise(tx.objectStore(STORE).delete(id));
  }
}

class MemoryGames implements GameStore {
  readonly persistent = false;
  private readonly games = new Map<string, GameRecord>();
  async list(): Promise<GameRecord[]> {
    return Array.from(this.games.values()).sort((a, b) => b.playedAt - a.playedAt);
  }
  async save(record: GameRecord): Promise<void> {
    this.games.set(record.id, record);
  }
  async remove(id: string): Promise<void> {
    this.games.delete(id);
  }
}

const RESULTS: readonly GameResult[] = ['1-0', '0-1', '1/2-1/2', '*'];

/** Shape check for records read back (the user can edit the database); the moves are re-validated by chess.js on load. */
function isGameRecord(value: unknown): value is GameRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.playedAt === 'number' &&
    typeof v.startFen === 'string' &&
    Array.isArray(v.sans) &&
    v.sans.every((s) => typeof s === 'string' && s.length <= 12) &&
    (RESULTS as readonly unknown[]).includes(v.result) &&
    (v.humanColor === 'w' || v.humanColor === 'b' || v.humanColor === null) &&
    typeof v.white === 'string' &&
    typeof v.black === 'string' &&
    Array.isArray(v.plies) &&
    (v.source === 'app' || v.source === 'pgn') &&
    (v.level === undefined || (typeof v.level === 'number' && Number.isInteger(v.level) && v.level >= 1 && v.level <= 6)) &&
    (v.mode === undefined || v.mode === 'play' || v.mode === 'campaign' || v.mode === 'training' || v.mode === 'two')
  );
}

/** chess.js result of a finished (or unfinished) position. */
export function resultOf(chess: Chess): GameResult {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0';
  if (chess.isGameOver()) return '1/2-1/2';
  return '*';
}

export const RESULT_LABEL: Record<GameResult, string> = {
  '1-0': '1 : 0',
  '0-1': '0 : 1',
  '1/2-1/2': '½ : ½',
  '*': 'nedohráno',
};

export class PgnError extends Error {}

/** A record from pasted PGN (headers optional). Throws PgnError with a Czech message. */
export function recordFromPgn(text: string): GameRecord {
  const pgn = text.trim();
  if (pgn.length === 0) throw new PgnError('Vlož PGN nebo aspoň seznam tahů.');
  if (pgn.length > 200_000) throw new PgnError('Text je moc dlouhý.');
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    throw new PgnError('Tohle se nepodařilo přečíst jako PGN (zkontroluj tahy).');
  }
  const headers = chess.getHeaders();
  const sans = chess.history();
  if (sans.length === 0) throw new PgnError('V PGN není žádný tah.');
  const startFen = headers.FEN ?? DEFAULT_POSITION;
  // A real result tag wins; chess.js's roster default "*" (and a missing tag) defer to the position.
  const headerResult = headers.Result;
  const result: GameResult =
    headerResult && headerResult !== '*' && (RESULTS as readonly string[]).includes(headerResult) ? (headerResult as GameResult) : resultOf(chess);
  return {
    id: newGameId(),
    playedAt: Date.now(),
    startFen,
    sans,
    result,
    humanColor: null,
    white: playerName(headers.White, 'Bílý'),
    black: playerName(headers.Black, 'Černý'),
    plies: sans.map(() => null),
    source: 'pgn',
  };
}

/** chess.js fills missing roster tags with "?"; treat those as absent. */
function playerName(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim();
  return v.length === 0 || v === '?' ? fallback : v.slice(0, 60);
}

/** Re-validates a record's moves with chess.js; returns the final Chess or null when a move is illegal. */
export function replayRecord(record: GameRecord): Chess | null {
  try {
    const chess = new Chess(record.startFen);
    for (const san of record.sans) chess.move(san);
    return chess;
  } catch {
    return null;
  }
}
