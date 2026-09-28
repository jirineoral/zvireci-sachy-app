// Lichess tablebase lookups for authoring-time checks (docs/phase-22-plan.md: endgame tasks
// from level 4 on accept every move that keeps the win/draw). Never used at runtime.
//
// Responses are cached in scripts/tablebase-cache.json (committed), keyed by the FEN without
// the move counters, so re-runs are offline and the public API is not hammered. Requests are
// sequential, spaced out, and a 429 waits a minute before retrying (Lichess API etiquette).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_FILE = join(dirname(fileURLToPath(import.meta.url)), 'tablebase-cache.json');
const API = 'https://tablebase.lichess.ovh/standard?fen=';
const SPACING_MS = 1000;
export const TB_MAX_PIECES = 7;

let cache = null;
let dirty = false;
let last = 0;

function load() {
  if (cache) return cache;
  cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
  return cache;
}

/** Saves new responses (sorted keys, so the committed file diffs cleanly). */
export function saveTablebaseCache() {
  if (!dirty) return;
  const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  writeFileSync(CACHE_FILE, `${JSON.stringify(sorted, null, 0).replace(/},"/g, '},\n"')}\n`);
  dirty = false;
}

/** Placement, side, castling, e.p. — the move counters do not change the tablebase answer. */
export const tbKey = (fen) => fen.trim().split(/\s+/).slice(0, 4).join(' ');

export function pieceCount(fen) {
  return (fen.split(' ')[0].match(/[pnbrqk]/gi) ?? []).length;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * { category, moves: { uci: category } } — `category` from the side to move's view
 * ('win' | 'cursed-win' | 'draw' | 'blessed-loss' | 'loss' | 'unknown' ...); each move's
 * category is from the opponent's view after the move (as the API returns it).
 */
export async function probe(fen) {
  const key = tbKey(fen);
  const c = load();
  if (c[key]) return c[key];
  if (pieceCount(fen) > TB_MAX_PIECES) throw new Error(`tablebase: more than ${TB_MAX_PIECES} pieces: ${fen}`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = last + SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(API + encodeURIComponent(`${key} 0 1`), { headers: { 'User-Agent': 'zvireci-sachy lesson checker (authoring time)' } });
    if (res.status === 429) {
      console.log('tablebase: 429, waiting 60 s');
      await sleep(60_000);
      continue;
    }
    if (!res.ok) throw new Error(`tablebase: HTTP ${res.status} for ${key}`);
    const j = await res.json();
    const entry = { category: j.category, moves: Object.fromEntries(j.moves.map((m) => [m.uci, m.category])) };
    c[key] = entry;
    dirty = true;
    return entry;
  }
  throw new Error(`tablebase: gave up on ${key}`);
}

const MIRROR = { win: 'loss', 'cursed-win': 'blessed-loss', draw: 'draw', 'blessed-loss': 'cursed-win', loss: 'win' };

/** The moves that keep the position's result (win stays win, draw stays draw). */
export async function resultKeepingMoves(fen) {
  const r = await probe(fen);
  const want = MIRROR[r.category];
  if (!want) throw new Error(`tablebase: unexpected category ${r.category} for ${fen}`);
  return { category: r.category, keep: Object.entries(r.moves).filter(([, cat]) => cat === want).map(([u]) => u), all: r.moves };
}
