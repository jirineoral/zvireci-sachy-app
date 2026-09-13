/**
 * chess.com import (Phase 15 / R3): the public, unauthenticated Published-Data API
 * (`api.chess.com/pub`, CORS `*`) — archives list, then one month's games. Every PGN goes
 * through `recordFromPgn` (chess.js); nothing else from the response reaches the DOM
 * except validated strings through `textContent`. The only external host the CSP allows.
 */
import { PgnError, recordFromPgn, type GameRecord } from './games';

export const CHESSCOM_STORAGE_KEY = 'skm.chesscom';
const API = 'https://api.chess.com/pub';
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
const ARCHIVE_PATTERN = /\/games\/(\d{4})\/(\d{2})$/;

export class ChesscomError extends Error {}

export interface ChesscomMonth {
  /** "2026/08" */
  key: string;
  label: string;
  url: string;
}

export interface ChesscomGame {
  record: GameRecord;
  endTime: number;
  timeClass: string;
  url: string | null;
}

export function isValidUsername(name: string): boolean {
  return USERNAME_PATTERN.test(name);
}

export async function fetchArchives(username: string): Promise<ChesscomMonth[]> {
  if (!isValidUsername(username)) throw new ChesscomError('Uživatelské jméno může mít jen písmena, číslice, - a _.');
  const raw = await getJson(`${API}/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
  const archives = (raw as { archives?: unknown }).archives;
  if (!Array.isArray(archives)) throw new ChesscomError('Chess.com poslal nečekanou odpověď.');
  const months: ChesscomMonth[] = [];
  for (const url of archives) {
    if (typeof url !== 'string' || !url.startsWith(API + '/')) continue;
    const m = ARCHIVE_PATTERN.exec(url);
    if (!m) continue;
    months.push({ key: `${m[1]}/${m[2]}`, label: `${Number(m[2])}/${m[1]}`, url });
  }
  months.reverse(); // newest first
  return months;
}

export async function fetchMonth(month: ChesscomMonth, username: string): Promise<ChesscomGame[]> {
  const raw = await getJson(month.url);
  const games = (raw as { games?: unknown }).games;
  if (!Array.isArray(games)) throw new ChesscomError('Chess.com poslal nečekanou odpověď.');
  const out: ChesscomGame[] = [];
  const me = username.toLowerCase();
  for (const g of games) {
    if (typeof g !== 'object' || g === null) continue;
    const x = g as Record<string, unknown>;
    if (typeof x.pgn !== 'string' || (x.rules !== undefined && x.rules !== 'chess')) continue;
    let record: GameRecord;
    try {
      record = recordFromPgn(x.pgn);
    } catch (err) {
      if (!(err instanceof PgnError)) throw err;
      continue; // a variant or a broken PGN: skip silently
    }
    const white = playerOf(x.white);
    const black = playerOf(x.black);
    if (white) record.white = white;
    if (black) record.black = black;
    record.humanColor = white?.toLowerCase() === me ? 'w' : black?.toLowerCase() === me ? 'b' : null;
    const endTime = typeof x.end_time === 'number' && Number.isFinite(x.end_time) ? x.end_time * 1000 : Date.now();
    record.playedAt = endTime;
    out.push({
      record,
      endTime,
      timeClass: typeof x.time_class === 'string' ? x.time_class.slice(0, 20) : '',
      url: typeof x.url === 'string' && x.url.startsWith('https://www.chess.com/') ? x.url : null,
    });
  }
  out.sort((a, b) => b.endTime - a.endTime);
  return out;
}

function playerOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const name = (value as { username?: unknown }).username;
  return typeof name === 'string' && name.length > 0 && name.length <= 60 ? name : null;
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    console.warn('chess.com request failed', err);
    throw new ChesscomError('Nepodařilo se spojit s chess.com. Jsi online?');
  }
  if (response.status === 404) throw new ChesscomError('Hráč nenalezen.');
  if (response.status === 429) throw new ChesscomError('Chess.com teď odmítá další dotazy — zkus to za chvíli.');
  if (!response.ok) throw new ChesscomError(`Chess.com odpověděl chybou ${response.status}.`);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ChesscomError('Chess.com poslal nečekanou odpověď.');
  }
}

export function readChesscomUsername(storage: Storage | null): string {
  try {
    const v = storage?.getItem(CHESSCOM_STORAGE_KEY) ?? '';
    return isValidUsername(v) ? v : '';
  } catch {
    return '';
  }
}

export function writeChesscomUsername(storage: Storage | null, username: string): void {
  try {
    storage?.setItem(CHESSCOM_STORAGE_KEY, username);
  } catch (err) {
    console.warn('Could not persist the chess.com username', err);
  }
}
