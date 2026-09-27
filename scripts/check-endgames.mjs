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
//      > 7 pieces: local Stockfish (node_modules/stockfish/bin/stockfish-18-lite-single.js)
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

async function tablebaseResult(fen) {
  const url = `https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tablebase HTTP ${res.status}`);
  const data = await res.json();
  return { category: data.category, dtm: data.dtm, dtz: data.dtz };
}

async function checkWithTablebase(e) {
  const { category, dtm, dtz } = await tablebaseResult(e.fen);
  const ok = e.goal === 'win' ? category === 'win' : category === 'win' || category === 'draw';
  if (!ok) err(`tablebase category "${category}" does not match goal "${e.goal}"`);
  const dist = dtm ?? dtz;
  return `tablebase: ${category}${dist !== null && dist !== undefined ? `, dtm/dtz ${dist}` : ''}`;
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

// ---------------------------------------------------------------------------- main

console.log(`Checking ${ENDGAMES.length} endgame position(s)...\n`);
for (const e of ENDGAMES) {
  where = `${e.id} (${endgameType(e.typeId)?.title ?? e.typeId} #${e.order})`;
  const chess = checkBasics(e);
  if (!chess) continue;
  const n = pieceCount(chess);
  let detail;
  try {
    detail = n <= 7 ? await checkWithTablebase(e) : await checkWithEngine(e);
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
