// Verifies every position in src/endgames.ts (docs/phase-23-plan.md). Exits non-zero on
// any failure. Run: npm run check:endgames   (node >= 22.18: native TypeScript stripping)
//
//  - FEN legal (chess.js), side to move === `human`, no pawns on ranks 1/8.
//  - not already checkmate/stalemate (a solved-before-you-move position teaches nothing,
//    and a stalemate trap misclassified as a legal start is a bug).
//  - goal verified for the side to move:
//      <= 7 pieces on the board: Lichess tablebase (https://tablebase.lichess.ovh/standard)
//        — `goal: 'win'` needs category "win"; `goal: 'draw'` needs "draw" or "win"
//        (a won draw-goal position is fine, e.g. an alternate win the child might find).
//        Prints dtm (falls back to dtz) so difficulty can be ordered by distance to mate.
//      > 7 pieces, goal win: first a 3-ply lookahead into the tablebase (a human move after
//        which every reply leads, at once or after one more human move, to a <= 7-piece
//        tablebase win) — exact, and prints every first move proven that way.
//      > 7 pieces otherwise (or lookahead inconclusive): local Stockfish (node_modules/stockfish/bin/stockfish-18-lite-single.js)
//        at depth 20 — `goal: 'win'` needs a mate score or cp >= 400; `goal: 'draw'` needs
//        |cp| <= 150 (matches the band already used for the shipped draw positions).
//        Prints the centipawn/mate score (no DTM available without a tablebase).
import './ts-hooks.mjs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ENDGAMES, endgameType } = await import('../src/endgames.ts');

const errors = [];
let where = '';
const err = (msg) => errors.push(`${where}: ${msg}`);

// ---------------------------------------------------------------------------- basics

function checkBasics(e) {
  let chess;
  try {
    chess = new Chess(e.fen);
  } catch (ex) {
    err(`illegal FEN: ${ex.message}`);
    return null;
  }
  if (chess.turn() !== e.human) err(`side to move is ${chess.turn()}, human is ${e.human}`);
  const board = chess.board().flat().filter(Boolean);
  for (const p of board) if (p.type === 'p' && (p.square[1] === '1' || p.square[1] === '8')) err(`pawn on rank 1/8 at ${p.square}`);
  if (chess.isCheckmate()) err('already checkmate before the human moves');
  if (chess.isStalemate()) err('already stalemate before the human moves');
  return chess;
}

function pieceCount(chess) {
  return chess.board().flat().filter(Boolean).length;
}

// ---------------------------------------------------------------------------- tablebase

// Be polite to the public API: sequential requests, at most ~3 per second, cached per run.
const tbCache = new Map();
let lastTbRequest = 0;
async function tablebaseResult(fen) {
  const key = fen.split(' ').slice(0, 4).join(' ');
  if (tbCache.has(key)) return tbCache.get(key);
  const url = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`;
  let res;
  for (let attempt = 0; ; attempt++) {
    const wait = lastTbRequest + 350 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastTbRequest = Date.now();
    res = await fetch(url);
    // Rate limited: the API asks clients to back off for a minute.
    if (res.status !== 429 || attempt >= 3) break;
    console.log('  (tablebase rate limit, waiting 60 s)');
    await new Promise((r) => setTimeout(r, 60_000));
  }
  if (!res.ok) throw new Error(`tablebase HTTP ${res.status}`);
  const data = await res.json();
  const result = { category: data.category, dtm: data.dtm, dtz: data.dtz, moves: data.moves };
  tbCache.set(key, result);
  return result;
}

/**
 * Among the human's legal moves, how many keep the goal (win for `goal: 'win'`,
 * draw-or-better for `goal: 'draw'`)? A low count relative to the total is "only-move-ish" —
 * the ladder's difficulty signal for draw goals (few safe moves = precise defence needed),
 * reported alongside DTM for wins.
 */
function safeMoveCount(moves, goal) {
  if (!moves) return null;
  // `category` on each candidate move is from the reply side's perspective (the position
  // after the human's move, i.e. the engine's turn) — "loss" there is good for the human.
  const safe = moves.filter((m) => m.category === 'loss' || (goal === 'draw' && m.category === 'draw')).length;
  return { safe, total: moves.length };
}

async function checkWithTablebase(e) {
  const { category, dtm, dtz, moves } = await tablebaseResult(e.fen);
  const ok = e.goal === 'win' ? category === 'win' : category === 'win' || category === 'draw';
  if (!ok) err(`tablebase category "${category}" does not match goal "${e.goal}"`);
  const dist = dtm ?? dtz;
  const distStr = dist !== null && dist !== undefined ? `, dtm/dtz ${dist}` : '';
  const safe = safeMoveCount(moves, e.goal);
  const safeStr = safe ? `, ${safe.safe}/${safe.total} replies keep the goal` : '';
  return `tablebase: ${category}${distStr}${safeStr}`;
}

// ---------------------------------------------------------------------------- engine

let engine = null;
function startEngine() {
  const proc = spawn(process.execPath, [join(root, 'node_modules/stockfish/bin/stockfish-18-lite-single.js')], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buffer = '';
  const waiters = [];
  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      for (const w of [...waiters]) w(line);
    }
  });
  const send = (cmd) => proc.stdin.write(`${cmd}\n`);
  const until = (pred, onLine) =>
    new Promise((resolve) => {
      const w = (line) => {
        onLine?.(line);
        if (pred(line)) {
          waiters.splice(waiters.indexOf(w), 1);
          resolve(line);
        }
      };
      waiters.push(w);
    });
  return { proc, send, until };
}

/** Stockfish eval at `depth` for the side to move: { cp } or { mate }. */
async function engineEval(fen, depth = 20) {
  if (!engine) {
    engine = startEngine();
    engine.send('uci');
    await engine.until((l) => l === 'uciok');
  }
  engine.send('isready');
  await engine.until((l) => l === 'readyok');
  let best = null;
  engine.send(`position fen ${fen}`);
  engine.send(`go depth ${depth}`);
  await engine.until(
    (l) => l.startsWith('bestmove'),
    (l) => {
      const m = / depth (\d+) .*score (cp|mate) (-?\d+)/.exec(l);
      if (!m || Number(m[1]) !== depth) return;
      best = m[2] === 'cp' ? { cp: Number(m[3]) } : { mate: Number(m[3]) };
    },
  );
  return best;
}

async function checkWithEngine(e) {
  const evalResult = await engineEval(e.fen, 20);
  if (!evalResult) {
    err('engine returned no evaluation at depth 20');
    return 'engine: (no eval)';
  }
  const isWinning = evalResult.mate !== undefined ? evalResult.mate > 0 : evalResult.cp >= 400;
  const isDrawish = evalResult.mate === undefined && Math.abs(evalResult.cp) <= 150;
  if (e.goal === 'win' && !isWinning) err(`engine eval does not show a clear win: ${JSON.stringify(evalResult)}`);
  if (e.goal === 'draw' && !(isDrawish || isWinning)) err(`engine eval does not show a draw/win: ${JSON.stringify(evalResult)}`);
  const label = evalResult.mate !== undefined ? `mate ${evalResult.mate}` : `cp ${evalResult.cp}`;
  return `engine eval (no DTM): ${label}`;
}

// ---------------------------------------------------------------------------- lookahead

/**
 * Exact proof for a > 7-piece `goal: 'win'` position (e.g. a pawn breakthrough) without
 * trusting an engine score: the human move M wins if after *every* reply either the
 * position has <= 7 pieces and the tablebase says the human wins, or the human has a
 * move into a <= 7-piece position that the tablebase says is lost for the opponent.
 * Returns the SAN of every first move proven this way (empty = not provable at this depth;
 * the caller then falls back to Stockfish). Single-PV Stockfish at depth 20 misjudges some
 * breakthroughs (the win needs ~10 plies of pawn races), hence this check.
 */
async function provenWinningMoves(fen) {
  const proven = [];
  const root = new Chess(fen);
  for (const m of root.moves()) {
    const afterM = new Chess(fen);
    afterM.move(m);
    if (afterM.isCheckmate()) {
      proven.push(m);
      continue;
    }
    if (afterM.isGameOver()) continue;
    let ok = true;
    for (const r of afterM.moves()) {
      const afterR = new Chess(afterM.fen());
      afterR.move(r);
      if (afterR.isGameOver()) {
        ok = false;
        break;
      }
      if (pieceCount(afterR) <= 7) {
        if ((await tablebaseResult(afterR.fen())).category !== 'win') ok = false;
      } else {
        let refuted = false;
        for (const m2 of afterR.moves()) {
          const afterM2 = new Chess(afterR.fen());
          afterM2.move(m2);
          if (afterM2.isCheckmate()) refuted = true;
          else if (pieceCount(afterM2) <= 7 && (await tablebaseResult(afterM2.fen())).category === 'loss') refuted = true;
          if (refuted) break;
        }
        if (!refuted) ok = false;
      }
      if (!ok) break;
    }
    if (ok) proven.push(m);
  }
  return proven;
}

// ---------------------------------------------------------------------------- main

console.log(`Checking ${ENDGAMES.length} endgame position(s)...\n`);
for (const e of ENDGAMES) {
  where = `${e.id} (${endgameType(e.typeId)?.title ?? e.typeId} #${e.order})`;
  const chess = checkBasics(e);
  if (!chess) continue;
  const n = pieceCount(chess);
  let detail;
  try {
    if (n <= 7) detail = await checkWithTablebase(e);
    else {
      const proven = e.goal === 'win' ? await provenWinningMoves(e.fen) : [];
      detail = proven.length
        ? `lookahead + tablebase: win, proven by ${proven.join(', ')} (${proven.length}/${chess.moves().length} moves)`
        : await checkWithEngine(e);
    }
  } catch (ex) {
    err(`verification failed: ${ex.message}`);
    detail = '(verification error)';
  }
  console.log(`${where}: ${n} pieces, goal ${e.goal} — ${detail}`);
}
if (engine) engine.proc.stdin.end(), engine.proc.kill();

console.log('');
if (errors.length) {
  console.error(`${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`All ${ENDGAMES.length} position(s) OK.`);
}
