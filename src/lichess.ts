/**
 * Tournament broadcasts (Phase 16 / R7): the public Lichess Broadcast API
 * (`lichess.org/api/broadcast`, unauthenticated, CORS `*`). Search → tour (rounds) →
 * round PGN (every game of the round), each game parsed by `recordFromPgn` (chess.js).
 * Everything else from the responses is reduced to bounded strings, numbers and 8-char
 * ids before it can reach the DOM (always through `textContent`).
 */
import { PgnError, recordFromPgn, type GameRecord } from './games';

const API = 'https://lichess.org/api/broadcast';
const ID_PATTERN = /^[A-Za-z0-9]{8}$/;
const MAX_TEXT = 120;

export class LichessError extends Error {}

export interface BroadcastTour {
  id: string;
  name: string;
  location: string;
  /** [start, end] in ms, either may be missing. */
  dates: number[];
}

export interface BroadcastRound {
  id: string;
  name: string;
  startsAt: number | null;
  finished: boolean;
  /** Lichess marks the round that is being played. */
  ongoing: boolean;
}

export interface BroadcastGame {
  /** Null when the game has no moves yet (or the PGN did not parse). */
  record: GameRecord | null;
  white: string;
  black: string;
  result: string;
  board: string;
}

export async function searchBroadcasts(query: string): Promise<BroadcastTour[]> {
  const q = query.trim().slice(0, 60);
  if (q.length === 0) throw new LichessError('Napiš, co hledat (třeba „Czech“).');
  const raw = await getJson(`${API}/search?q=${encodeURIComponent(q)}`);
  const results = (raw as { currentPageResults?: unknown }).currentPageResults;
  if (!Array.isArray(results)) throw new LichessError('Lichess poslal nečekanou odpověď.');
  const tours: BroadcastTour[] = [];
  for (const r of results) {
    const tour = tourOf((r as { tour?: unknown })?.tour);
    if (tour) tours.push(tour);
  }
  return tours;
}

export async function fetchRounds(tourId: string): Promise<{ tour: BroadcastTour; rounds: BroadcastRound[] }> {
  if (!ID_PATTERN.test(tourId)) throw new LichessError('Neplatné id turnaje.');
  const raw = await getJson(`${API}/${tourId}`);
  const tour = tourOf((raw as { tour?: unknown }).tour);
  const list = (raw as { rounds?: unknown }).rounds;
  if (!tour || !Array.isArray(list)) throw new LichessError('Lichess poslal nečekanou odpověď.');
  const rounds: BroadcastRound[] = [];
  for (const r of list) {
    if (typeof r !== 'object' || r === null) continue;
    const x = r as Record<string, unknown>;
    if (typeof x.id !== 'string' || !ID_PATTERN.test(x.id)) continue;
    rounds.push({
      id: x.id,
      name: text(x.name, 'Kolo'),
      startsAt: typeof x.startsAt === 'number' && Number.isFinite(x.startsAt) ? x.startsAt : null,
      finished: x.finished === true,
      ongoing: x.ongoing === true,
    });
  }
  return { tour, rounds };
}

/** All games of a round; games without moves yet come back with `record: null`. */
export async function fetchRoundGames(roundId: string): Promise<BroadcastGame[]> {
  if (!ID_PATTERN.test(roundId)) throw new LichessError('Neplatné id kola.');
  let pgn: string;
  try {
    pgn = await getText(`${API}/round/${roundId}.pgn`);
  } catch (err) {
    if (err instanceof LichessError && err.message === NOT_FOUND) return []; // a round without games yet
    throw err;
  }
  if (pgn.length > 5_000_000) throw new LichessError('Kolo je moc velké na načtení.');
  return splitPgn(pgn).map((game) => {
    const headers = pgnHeaders(game);
    let record: GameRecord | null = null;
    try {
      record = recordFromPgn(stripComments(game));
    } catch (err) {
      if (!(err instanceof PgnError)) throw err;
    }
    return {
      record,
      white: text(headers.White, 'Bílý'),
      black: text(headers.Black, 'Černý'),
      result: text(headers.Result, '*'),
      board: text(headers.Board ?? headers.Round, ''),
    };
  });
}

/** Splits a multi-game PGN on the blank line before each `[Event` header. */
function splitPgn(pgn: string): string[] {
  return pgn
    .split(/\n(?=\[Event )/)
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
}

/**
 * Lichess annotates broadcast moves with several comments in a row (`{ [%eval] } { Mistake.
 * … } { [%clk] }`), which chess.js's PGN grammar rejects; the app uses none of them, so
 * the movetext goes in without comments. Headers (before the first blank line) are kept.
 */
function stripComments(game: string): string {
  const split = game.indexOf('\n\n');
  if (split < 0) return game.replace(/\{[^}]*\}/g, ' ');
  return game.slice(0, split) + game.slice(split).replace(/\{[^}]*\}/g, ' ');
}

function pgnHeaders(game: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of game.split('\n')) {
    const m = /^\[(\w+)\s+"([^"]*)"\]\s*$/.exec(line);
    if (!m) {
      if (line.trim() === '') break;
      continue;
    }
    headers[m[1]] = m[2];
  }
  return headers;
}

function tourOf(value: unknown): BroadcastTour | null {
  if (typeof value !== 'object' || value === null) return null;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== 'string' || !ID_PATTERN.test(t.id)) return null;
  const info = typeof t.info === 'object' && t.info !== null ? (t.info as Record<string, unknown>) : {};
  const dates = Array.isArray(t.dates) ? t.dates.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).slice(0, 2) : [];
  return { id: t.id, name: text(t.name, 'Turnaj'), location: text(info.location, ''), dates };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, MAX_TEXT) : fallback;
}

const NOT_FOUND = 'Tohle na Lichess není.';

async function request(url: string, accept: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: accept } });
  } catch (err) {
    console.warn('Lichess request failed', err);
    throw new LichessError('Nepodařilo se spojit s Lichess. Jsi online?');
  }
  if (response.status === 404) throw new LichessError(NOT_FOUND);
  if (response.status === 429) throw new LichessError('Lichess teď odmítá další dotazy — zkus to za chvíli.');
  if (!response.ok) throw new LichessError(`Lichess odpověděl chybou ${response.status}.`);
  return response;
}

async function getJson(url: string): Promise<unknown> {
  const response = await request(url, 'application/json');
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new LichessError('Lichess poslal nečekanou odpověď.');
  }
}

async function getText(url: string): Promise<string> {
  const response = await request(url, 'application/x-chess-pgn');
  return response.text();
}
