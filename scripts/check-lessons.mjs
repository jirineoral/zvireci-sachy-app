// Mechanical checks of the lesson data (docs/phase-21-plan.md, decision 4). Exits non-zero
// on any error. Run: npm run check:lessons   (node >= 22.18: native TypeScript stripping)
//
//  - FENs legal and consistent (kings, side to move, castling / e.p. rights, no pawns on
//    ranks 1/8, the side not to move not in check); kingless diagrams: placement only.
//  - move steps: every accepted move legal; the accepted set complete for its
//    `completeness` (all mates / all landings / all captures / all legal moves / Stockfish:
//    no other move within the margin); `wrong` keys are real non-accepted moves; no arrow
//    in the step gives the answer away.
//  - collect steps: solvable within `maxMoves` (BFS over position × eaten stars).
//  - choose steps: 2–4 options, correct ⊂ options, square options on the board.
//  - text lint: sentence length, informal „ty“ (no vykání), Czech piece letters/terms,
//    0-0 not O-O, „dvojný“ not „dvojitý“, „pěšec“ not „pěšák“, no gendered „jsi …l“,
//    no markup; piece lessons name the piece with its placeholder in step 1.
//  - practice pointers: puzzle band/theme exist with enough puzzles, endgame ids exist.
//  - choose steps with `verify`: the marked answer is the true one (šach/mat/pat/nic,
//    „smí rošádovat?“, squares the piece may go to).
//  - mini steps (21b): kingless diagrams with sane material for their goal, the child has a
//    move, and the weak opponent is beatable (a careful-beginner bot wins most games).
//  - level tests (21b): tasks only (an optional first `show`), one correct option per
//    choose, no arrows, collect tasks limited, pass score ≤ tasks, a badge id.
//  - tablebase (Phase 22, from level 4 on): in positions with at most 7 pieces every
//    accepted move keeps the result (Lichess tablebase, scripts/tablebase.mjs — cached in
//    scripts/tablebase-cache.json, authoring time only); every other result-keeping move is
//    explained in `wrong` or excluded by the wording (`tbNarrow`); `tablebase` completeness
//    and the `outcome` / `tbmoves` choose facts are computed from it.
//  - level 6: `best` may ask for a deeper search (`depth`, e.g. Lasker–Reichhelm, where depth
//    18 cannot tell the only win from draws); the `keysquares` choose fact is computed from an
//    exact K+P vs K bitbase (scripts/kpk.mjs).
import './ts-hooks.mjs';
import { childMove, simulate } from './mini-sim.mjs';
import { pieceCount, probe, resultKeepingMoves, saveTablebaseCache, TB_MAX_PIECES } from './tablebase.mjs';
import { keySquares } from './kpk.mjs';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { COURSE } = await import('../src/lessons/course.ts');
const { parsePlacement, pseudoTargets, attackersOf, findKing, moved, isSquare } = await import('../src/lessons/geometry.ts');
const { resolveText, placeholdersIn, PIECE_NAMES } = await import('../src/lessons/text.ts');
const { ENDGAMES } = await import('../src/endgames.ts');
const { miniMoves, seededRandom } = await import('../src/lessons/mini.ts');
const { THEME_LABELS } = await import('../src/puzzles.ts');

const MAX_SENTENCE_WORDS = 15;
const errors = [];
const warnings = [];
const notes = [];
let where = '';
const err = (msg) => errors.push(`${where}: ${msg}`);
const warn = (msg) => warnings.push(`${where}: ${msg}`);

// ---------------------------------------------------------------------------- FEN

function fenFields(fen) {
  return fen.trim().split(/\s+/);
}

function checkPlacementBasics(fen) {
  let board;
  try {
    board = parsePlacement(fen);
  } catch (e) {
    err(`bad FEN placement: ${e.message}`);
    return null;
  }
  for (const [sq, p] of board) if (p.type === 'p' && (sq[1] === '1' || sq[1] === '8')) err(`pawn on ${sq} (rank 1/8)`);
  const f = fenFields(fen);
  if (f.length !== 6) err(`FEN needs 6 fields: "${fen}"`);
  if (!['w', 'b'].includes(f[1])) err(`bad side to move "${f[1]}"`);
  return board;
}

function checkFullFen(fen) {
  const board = checkPlacementBasics(fen);
  if (!board) return false;
  const kings = { w: 0, b: 0 };
  for (const p of board.values()) if (p.type === 'k') kings[p.color]++;
  if (kings.w !== 1 || kings.b !== 1) {
    err(`needs exactly one king per side (w ${kings.w}, b ${kings.b}); a kingless position must be a diagram`);
    return false;
  }
  let chess;
  try {
    chess = new Chess(fen);
  } catch (e) {
    err(`chess.js rejects FEN: ${e.message}`);
    return false;
  }
  const [, turn, castling, ep] = fenFields(fen);
  const other = turn === 'w' ? 'b' : 'w';
  const otherKing = findKing(board, other);
  if (otherKing && attackersOf(board, otherKing, turn).length > 0) err(`the side not to move (${other}) is in check`);
  const home = { K: ['e1', 'h1', 'w'], Q: ['e1', 'a1', 'w'], k: ['e8', 'h8', 'b'], q: ['e8', 'a8', 'b'] };
  if (castling !== '-') {
    for (const c of castling) {
      const h = home[c];
      if (!h) { err(`bad castling flag "${c}"`); continue; }
      const k = board.get(h[0]);
      const r = board.get(h[1]);
      if (!(k && k.type === 'k' && k.color === h[2] && r && r.type === 'r' && r.color === h[2])) err(`castling right "${c}" without king and rook on their squares`);
    }
  }
  if (ep !== '-') {
    const rank = ep[1];
    const expect = turn === 'w' ? '6' : '3';
    const pawnSq = `${ep[0]}${turn === 'w' ? '5' : '4'}`;
    const origin = `${ep[0]}${turn === 'w' ? '7' : '2'}`;
    const pawn = board.get(pawnSq);
    if (rank !== expect || !pawn || pawn.type !== 'p' || pawn.color !== other || board.has(ep) || board.has(origin)) err(`inconsistent e.p. square ${ep}`);
  }
  // Pawn counts / promoted-piece plausibility.
  for (const color of ['w', 'b']) {
    const count = (t) => [...board.values()].filter((p) => p.color === color && p.type === t).length;
    const extra = Math.max(0, count('q') - 1) + Math.max(0, count('r') - 2) + Math.max(0, count('b') - 2) + Math.max(0, count('n') - 2);
    if (count('p') + extra > 8) err(`${color}: too many pawns + promoted pieces`);
  }
  return chess;
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

/** Stockfish MultiPV: { uci → score cp from the mover's view }. */
async function engineScores(fen, multipv, depth = 18) {
  if (!engine) {
    engine = startEngine();
    engine.send('uci');
    await engine.until((l) => l === 'uciok');
  }
  engine.send(`setoption name MultiPV value ${multipv}`);
  engine.send('isready');
  await engine.until((l) => l === 'readyok');
  const scores = {};
  engine.send(`position fen ${fen}`);
  engine.send(`go depth ${depth}`);
  await engine.until(
    (l) => l.startsWith('bestmove'),
    (l) => {
      const m = / depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/.exec(l);
      if (!m || Number(m[1]) !== depth) return;
      const v = Number(m[4]);
      scores[m[5]] = m[3] === 'cp' ? v : v > 0 ? 100000 - v : -100000 - v;
    },
  );
  return scores;
}

// ---------------------------------------------------------------------------- steps

const setEq = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const uciOf = (m) => `${m.from}${m.to}${m.promotion ?? ''}`;

/** Level from which endgame positions are held to the tablebase (docs/phase-22-plan.md). */
const TB_FROM_LEVEL = 4;
const tbApplies = (fen, level) => level >= TB_FROM_LEVEL && pieceCount(fen) <= TB_MAX_PIECES && fenFields(fen)[2] === '-';

/** Tablebase lookup that turns network trouble into a checker error instead of a crash. */
async function tbKeep(fen) {
  try {
    return await resultKeepingMoves(fen);
  } catch (e) {
    err(`tablebase: ${e.message}`);
    return null;
  }
}

async function checkMoveStep(step, level) {
  if (step.diagram) err('a move step cannot be a diagram');
  const chess = checkFullFen(step.fen);
  if (!chess) return;
  const turn = chess.turn();
  const board = parsePlacement(step.fen);
  for (const sq of step.movable ?? []) {
    const p = board.get(sq);
    if (!p || p.color !== turn) err(`movable ${sq} holds no piece of the side to move`);
  }
  const legal = chess.moves({ verbose: true });
  const allowed = (m) => !step.movable || step.movable.includes(m.from);
  const legalUci = legal.filter(allowed).map(uciOf);
  if (step.accept.length === 0) err('no accepted move');
  for (const u of step.accept) if (!legalUci.includes(u)) err(`accepted move ${u} is not legal (or not of a movable piece)`);

  const c = step.completeness;
  let expected = null;
  if (c.kind === 'mate') {
    expected = legal.filter(allowed).filter((m) => {
      const x = new Chess(step.fen);
      x.move(m);
      return x.isCheckmate();
    }).map(uciOf);
    for (const u of step.accept) if (!expected.includes(u)) err(`accepted move ${u} is not mate`);
  } else if (c.kind === 'lands') {
    expected = legal.filter(allowed).filter((m) => m.to === c.square && (!c.from || m.from === c.from)).map(uciOf);
  } else if (c.kind === 'captures') {
    expected = legal.filter(allowed).filter((m) => m.captured && (!c.from || m.from === c.from)).map(uciOf);
  } else if (c.kind === 'legal') {
    expected = legal.filter(allowed).filter((m) => !c.from || m.from === c.from).map(uciOf);
  } else if (c.kind === 'safe') {
    expected = legal.filter((m) => m.from === c.from).filter((m) => {
      const x = new Chess(step.fen);
      x.move(m);
      return !x.moves({ verbose: true }).some((r) => r.to === m.to);
    }).map(uciOf);
  } else if (c.kind === 'promote') {
    const u = `${c.from}${c.to}${c.piece}`;
    expected = legalUci.includes(u) ? [u] : [];
  } else if (c.kind === 'best') {
    const margin = c.marginCp ?? 50;
    const scores = await engineScores(step.fen, Math.min(legal.length, 100), c.depth ?? 18);
    const best = Math.max(...Object.values(scores));
    const near = Object.entries(scores).filter(([u]) => legalUci.includes(u)).filter(([, v]) => v >= best - margin).map(([u]) => u);
    expected = near;
    notes.push(`${where}: engine best ${best} cp (depth ${c.depth ?? 18}); within ${margin} cp: ${near.join(' ')}`);
  } else if (c.kind === 'tablebase') {
    if (pieceCount(step.fen) > TB_MAX_PIECES) err(`tablebase completeness needs at most ${TB_MAX_PIECES} pieces`);
    else {
      const tb = await tbKeep(step.fen);
      if (tb) {
        expected = tb.keep.filter((u) => legalUci.includes(u));
        notes.push(`${where}: tablebase ${tb.category}; result-keeping: ${expected.join(' ')}`);
      }
    }
  } else err(`unknown completeness ${JSON.stringify(c)}`);
  if (expected && !setEq([...new Set(expected)], [...new Set(step.accept)])) {
    err(`accepted ${JSON.stringify(step.accept)} but ${c.kind} gives ${JSON.stringify(expected)}`);
  }
  // Tablebase audit (from level 4): accepted moves keep the result; other result-keeping
  // moves are explained (`wrong`) or excluded by the wording (`tbNarrow`, or a mate task).
  if (c.kind !== 'tablebase' && tbApplies(step.fen, level)) {
    const tb = await tbKeep(step.fen);
    if (tb) {
      for (const u of step.accept) if (!tb.keep.includes(u)) err(`tablebase: accepted ${u} does not keep the ${tb.category} (it gives the opponent a ${tb.all[u]})`);
      const others = tb.keep.filter((u) => legalUci.includes(u) && !step.accept.includes(u));
      const unexplained = others.filter((u) => !(step.wrong ?? {})[u]);
      if (unexplained.length && !step.tbNarrow && c.kind !== 'mate') err(`tablebase: ${unexplained.join(' ')} also keep the ${tb.category} — accept them, explain them in \`wrong\`, or say in \`tbNarrow\` how the wording excludes them`);
      for (const [u, text] of Object.entries(step.wrong ?? {})) {
        if (tb.keep.includes(u) && !/vyhrává|vyhraje|remíz|drží|taky|také|i to/i.test(text)) warn(`tablebase: wrong[${u}] keeps the ${tb.category} — its text should say so („I to vyhrává, ale…“)`);
      }
      notes.push(`${where}: tablebase ${tb.category}; other result-keeping moves: ${others.join(' ') || '—'}${step.tbNarrow ? ` (narrowed: ${step.tbNarrow})` : ''}`);
    }
  }
  if (step.tbNarrow && !tbApplies(step.fen, level)) warn('tbNarrow on a step the tablebase audit does not cover');
  // Wrong-move texts must refer to real, non-accepted moves the board offers.
  const ep = fenFields(step.fen)[3] === '-' ? null : fenFields(step.fen)[3];
  const offered = [];
  for (const [sq, p] of board) if (p.color === turn && (!step.movable || step.movable.includes(sq))) for (const to of pseudoTargets(board, sq, ep)) offered.push(`${sq}${to}`);
  for (const u of Object.keys(step.wrong ?? {})) {
    if (step.accept.includes(u)) err(`wrong[${u}] is an accepted move`);
    if (!offered.includes(u.slice(0, 4)) && !legalUci.includes(u)) err(`wrong[${u}] is not a move the board offers`);
  }
  // A promotion is four answers (the dialog asks which piece).
  const answers = offered.flatMap((u) => (board.get(u.slice(0, 2))?.type === 'p' && /[18]$/.test(u) ? ['q', 'r', 'b', 'n'].map((x) => u + x) : [u]));
  if (answers.every((u) => step.accept.some((a) => a === u || (u.length === 4 && a.startsWith(u))))) warn('the board offers no wrong move at all (a trivial task)');
  for (const s of step.shapes ?? []) if (s.to && step.accept.some((a) => a.startsWith(`${s.from}${s.to}`))) err(`arrow ${s.from}-${s.to} gives the answer away`);
  // Illegal-but-offered moves must be explainable (own king attacked afterwards).
  for (const u of offered) {
    if (legalUci.some((l) => l.startsWith(u))) continue;
    const after = moved(board, u.slice(0, 2), u.slice(2, 4));
    const k = findKing(after, turn);
    if (!k || attackersOf(after, k, turn === 'w' ? 'b' : 'w').length === 0) warn(`pseudo move ${u} is illegal for a reason the runner cannot explain`);
  }
}

function checkCollectStep(step) {
  const board = checkPlacementBasics(step.fen);
  if (!board) return;
  if (!step.diagram) warn('collect steps are usually diagrams');
  const piece = board.get(step.piece);
  if (!piece) return err(`no piece on ${step.piece}`);
  if (fenFields(step.fen)[1] !== piece.color) err('FEN side to move must be the collecting piece\'s colour');
  for (const [sq, p] of board) if (sq !== step.piece && p.color !== piece.color) err(`obstacle ${sq} must be the piece's own colour`);
  if (step.stars.length === 0) err('no stars');
  if (new Set(step.stars).size !== step.stars.length) err('duplicate stars');
  for (const s of step.stars) if (board.has(s)) err(`star ${s} on an occupied square`);
  // BFS over (square, eaten mask).
  const n = step.stars.length;
  const full = (1 << n) - 1;
  const others = new Map(board);
  others.delete(step.piece);
  const start = `${step.piece}|0`;
  const dist = new Map([[start, 0]]);
  const queue = [[step.piece, 0]];
  let best = null;
  while (queue.length) {
    const [sq, mask] = queue.shift();
    const d = dist.get(`${sq}|${mask}`);
    if (mask === full) { best = d; break; }
    const b = new Map(others);
    b.set(sq, piece);
    for (const to of pseudoTargets(b, sq)) {
      const i = step.stars.indexOf(to);
      const m = i >= 0 ? mask | (1 << i) : mask;
      const key = `${to}|${m}`;
      if (!dist.has(key)) { dist.set(key, d + 1); queue.push([to, m]); }
    }
  }
  if (best === null) return err('the stars cannot all be collected');
  if (step.maxMoves !== undefined && best > step.maxMoves) err(`needs ${best} moves but maxMoves is ${step.maxMoves}`);
  if (step.maxMoves !== undefined && step.maxMoves > best) warn(`maxMoves ${step.maxMoves} > the minimum ${best}`);
  notes.push(`${where}: collect minimum ${best} move(s)${step.maxMoves !== undefined ? `, limit ${step.maxMoves}` : ''}`);
}

async function checkChooseStep(step) {
  if (step.diagram) checkPlacementBasics(step.fen); else checkFullFen(step.fen);
  const board = safeBoard(step.fen);
  if (step.options.length < 2 || step.options.length > 4) err(`${step.options.length} options (2–4)`);
  const ids = step.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) err('duplicate option ids');
  if (step.correct.length === 0) err('no correct option');
  for (const c of step.correct) if (!ids.includes(c)) err(`correct "${c}" is not an option`);
  if (step.correct.length === step.options.length) err('every option is correct');
  for (const o of step.options) {
    if (o.square !== undefined && !isSquare(o.square)) err(`option ${o.id}: bad square`);
    if (o.square === undefined && !o.label) err(`option ${o.id}: needs a label or a square`);
  }
  for (const k of Object.keys(step.wrongExplain ?? {})) {
    if (!ids.includes(k)) err(`wrongExplain["${k}"] is not an option`);
    if (step.correct.includes(k)) err(`wrongExplain["${k}"] is a correct option`);
  }
  for (const o of step.options) if (o.square && board?.get(o.square)?.type === 'k') warn(`option ${o.id} on a king`);
  if (step.verify) await checkChooseFact(step);
  for (const s of step.shapes ?? []) if (!s.to && step.correct.some((c) => step.options.find((o) => o.id === c)?.square === s.from)) err(`a circle on ${s.from} gives the answer away`);
}

/** `verify` on a choose step: compute the true answer with chess.js. */
async function checkChooseFact(step) {
  const v = step.verify;
  if (step.diagram) return err('verify needs a full (non-diagram) position');
  let chess;
  try { chess = new Chess(step.fen); } catch { return; }
  let truth;
  if (v.kind === 'state') {
    truth = [chess.isCheckmate() ? 'mat' : chess.isStalemate() ? 'pat' : chess.inCheck() ? 'sach' : 'nic'];
    for (const o of step.options) if (!['sach', 'mat', 'pat', 'nic'].includes(o.id)) err(`verify state: option id "${o.id}" (sach/mat/pat/nic)`);
    if (!step.options.some((o) => o.id === truth[0])) err(`verify state: the position is "${truth[0]}" but that is not an option`);
  } else if (v.kind === 'castle') {
    const flag = v.side === 'k' ? 'k' : 'q';
    truth = [chess.moves({ verbose: true }).some((m) => m.flags.includes(flag)) ? 'ano' : 'ne'];
    if (!step.options.every((o) => o.id === 'ano' || o.id === 'ne')) err('verify castle: options must be ano/ne');
  } else if (v.kind === 'reachable') {
    const to = chess.moves({ square: v.from, verbose: true }).map((m) => m.to);
    truth = step.options.filter((o) => o.square && to.includes(o.square)).map((o) => o.id);
  } else if (v.kind === 'keysquares') {
    const board = parsePlacement(step.fen);
    const pieces = [...board.entries()];
    const pawns = pieces.filter(([, p]) => p.type === 'p');
    if (pieces.length !== 3 || pawns.length !== 1 || pawns[0][1].color !== 'w') return err('verify keysquares: needs exactly two kings and one white pawn');
    const keys = keySquares(pawns[0][0]);
    truth = step.options.filter((o) => o.square && keys.includes(o.square)).map((o) => o.id);
    notes.push(`${where}: KPK key squares of ${pawns[0][0]}: ${keys.join(' ')}`);
  } else if (v.kind === 'outcome' || v.kind === 'tbmoves') {
    if (pieceCount(step.fen) > TB_MAX_PIECES) return err(`verify ${v.kind}: more than ${TB_MAX_PIECES} pieces`);
    if (v.kind === 'outcome') {
      for (const o of step.options) if (!['bily', 'cerny', 'remiza'].includes(o.id)) err(`verify outcome: option id "${o.id}" (bily/cerny/remiza)`);
      let r;
      try { r = await probe(step.fen); } catch (e) { return err(`tablebase: ${e.message}`); }
      const mover = chess.turn() === 'w' ? 'bily' : 'cerny';
      const other = mover === 'bily' ? 'cerny' : 'bily';
      const byCat = { win: mover, loss: other, draw: 'remiza', 'cursed-win': 'remiza', 'blessed-loss': 'remiza' };
      if (!byCat[r.category]) return err(`verify outcome: tablebase category ${r.category}`);
      truth = [byCat[r.category]];
      notes.push(`${where}: tablebase ${r.category} for the side to move`);
    } else {
      const legal = chess.moves({ verbose: true }).map(uciOf);
      for (const o of step.options) if (!v.moves[o.id]) err(`verify tbmoves: option ${o.id} has no move`);
      for (const [id, u] of Object.entries(v.moves)) if (!legal.includes(u)) err(`verify tbmoves: ${id} → ${u} is not legal`);
      const tb = await tbKeep(step.fen);
      if (!tb) return;
      truth = step.options.filter((o) => tb.keep.includes(v.moves[o.id])).map((o) => o.id);
      notes.push(`${where}: tablebase ${tb.category}; options keeping it: ${truth.join(' ') || '—'}`);
    }
  } else return err(`unknown verify kind ${v.kind}`);
  if (!setEq([...truth], [...step.correct])) err(`verify ${v.kind}: correct ${JSON.stringify(step.correct)} but the position says ${JSON.stringify(truth)}`);
}

// ---------------------------------------------------------------------------- mini

const MINI_GAMES = 300;
const MINI_MIN_WIN_RATE = 0.6;
const MINI_MAX_LOSS_RATE = 0.15;

function checkMiniStep(step) {
  if (!step.diagram) err('a mini step must be a diagram (no kings, not a chess position)');
  const board = checkPlacementBasics(step.fen);
  if (!board) return;
  const child = fenFields(step.fen)[1];
  const engine = child === 'w' ? 'b' : 'w';
  const pieces = (color) => [...board.values()].filter((p) => p.color === color);
  if ([...board.values()].some((p) => p.type === 'k')) err('no kings in a mini-game');
  if (![1, 2].includes(step.engineLevel)) err(`engineLevel ${step.engineLevel} (1 or 2)`);
  if (step.goal === 'promote-first') {
    for (const c of [child, engine]) {
      if (pieces(c).length === 0) err(`${c} has no pawns`);
      if (pieces(c).some((p) => p.type !== 'p')) err(`${c}: pěšcová válka is pawns only`);
    }
  } else if (step.goal === 'capture-all-pawns') {
    const mine = pieces(child);
    if (mine.length !== 1 || mine[0].type === 'p') err('seber všechny pěšce: the child has exactly one piece, not a pawn');
    if (pieces(engine).length === 0 || pieces(engine).some((p) => p.type !== 'p')) err('seber všechny pěšce: the opponent has pawns only');
  } else return err(`unknown goal ${step.goal}`);
  if (miniMoves(board, child).length === 0) err('the child has no move');
  if (miniMoves(board, engine).length === 0) warn('the opponent has no move at the start');
  if (childMove(step.goal, board, child, Math.random) === null) err('the sim child finds no move');
  const tally = { won: 0, lost: 0, draw: 0 };
  for (let seed = 1; seed <= MINI_GAMES; seed++) tally[simulate(step, seededRandom(seed))]++;
  const rate = tally.won / MINI_GAMES;
  if (tally.lost / MINI_GAMES > MINI_MAX_LOSS_RATE) err(`the opponent is too strong: a careful beginner loses ${Math.round((tally.lost / MINI_GAMES) * 100)} % (max ${MINI_MAX_LOSS_RATE * 100} %)`);
  notes.push(`${where}: careful beginner vs the level-${step.engineLevel} picker: won ${tally.won}, lost ${tally.lost}, draw ${tally.draw} of ${MINI_GAMES}`);
  if (rate < MINI_MIN_WIN_RATE) err(`the opponent is too strong: a careful beginner wins only ${Math.round(rate * 100)} % (min ${MINI_MIN_WIN_RATE * 100} %)`);
}

// ---------------------------------------------------------------------------- level tests

function checkTestLesson(lesson) {
  const t = lesson.test;
  if (!/^[a-z0-9-]{1,40}$/.test(t.badge)) err(`test badge id "${t.badge}"`);
  const tasks = lesson.steps.filter((s) => s.kind !== 'show');
  lesson.steps.forEach((s, i) => {
    if (s.kind === 'show' && i > 0) err(`test step ${s.id}: only the first step may be a show step`);
    if (s.kind === 'mini') err(`test step ${s.id}: no mini-games in a test`);
    if (s.kind === 'choose' && s.correct.length !== 1) err(`test step ${s.id}: exactly one correct option`);
    if (s.kind === 'collect' && s.maxMoves === undefined) err(`test step ${s.id}: a collect task needs maxMoves`);
    if (s.kind !== 'show' && (s.shapes ?? []).some((x) => x.to)) err(`test step ${s.id}: no arrows in a test (no hints)`);
  });
  if (!(Number.isInteger(t.passScore) && t.passScore >= 1 && t.passScore <= tasks.length)) err(`passScore ${t.passScore} of ${tasks.length} tasks`);
  if (tasks.length < 8 || tasks.length > 12) warn(`${tasks.length} test tasks (plan: ~10)`);
  lintText(t.failOutro, 'failOutro');
  notes.push(`${lesson.id}: test ${tasks.length} tasks, pass ${t.passScore}, badge ${t.badge}`);
}

function safeBoard(fen) {
  try { return parsePlacement(fen); } catch { return null; }
}

function checkShowStep(step) {
  if (step.diagram) {
    const b = checkPlacementBasics(step.fen);
    if (b && findKing(b, 'w') && findKing(b, 'b')) warn('a diagram with both kings: drop `diagram` to validate it fully');
  } else checkFullFen(step.fen);
}

// ---------------------------------------------------------------------------- text lint

const VYKANI = /^(táhněte|zkuste|vaše?|vaši|vašeho|vašem|vám|vás|vámi|jste|máte|můžete|klikněte|podívejte|najděte|vezměte|posuňte|seberte|vyberte|pamatujte|dejte|hrajte|zahrajte|víte|chcete|umíte)$/i;
const PLURAL_IMPERATIVE = /(ěte|ete|ejte|ějte|ňte|ďte|ťte)$/i;
const ENGLISH = /^(knight|bishop|rook|queen|king|pawn|check|checkmate|stalemate|castling|fork|pin)$/i;

function lintText(text, label, ctx = { animalId: 'kuzlata' }) {
  if (typeof text !== 'string' || text.trim() === '') return err(`${label}: empty text`);
  let resolved;
  try {
    resolved = resolveText(text, ctx);
  } catch (e) {
    return err(`${label}: ${e.message}`);
  }
  if (/[{}]/.test(resolved)) err(`${label}: unknown placeholder in "${text}"`);
  if (/[<>]/.test(text)) err(`${label}: markup characters in "${text}"`);
  const plain = resolveText(text, { animalId: null });
  for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
    const words = sentence.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? [];
    if (words.length > MAX_SENTENCE_WORDS) err(`${label}: sentence of ${words.length} words (max ${MAX_SENTENCE_WORDS}): "${sentence}"`);
  }
  const tokens = plain.match(/[\p{L}\p{N}-]+/gu) ?? [];
  for (const t of tokens) {
    if (VYKANI.test(t)) err(`${label}: vykání "${t}" — use „ty“`);
    else if (PLURAL_IMPERATIVE.test(t) && t.length > 4 && !/^(přete|dete|anebo)$/i.test(t)) warn(`${label}: "${t}" looks like a plural imperative`);
    if (ENGLISH.test(t)) err(`${label}: English term "${t}"`);
    if (/^[NBRQ]$/.test(t) || /^[NBRQ]x?[a-h][1-8]/.test(t)) err(`${label}: English piece letter in "${t}" (use K D V S J)`);
  }
  if (/O-O/.test(plain)) err(`${label}: O-O — write 0-0`);
  if (/dvojit/i.test(plain)) err(`${label}: „dvojitý“ — the term is „dvojný“`);
  if (/\bvyhr(u|y)\b/i.test(plain)) err(`${label}: „vyhru“ — the noun is „výhra“ (výhru, výhry)`);
  if (/pěšák/i.test(plain)) err(`${label}: „pěšák“ — the term is „pěšec“`);
  if (/anastasi|anastázi(?!in)/i.test(plain)) err(`${label}: the mate is spelled „Anastáziin mat“`);
  if (/\bjsi\s+\p{L}+l\b/u.test(plain) || /\p{L}+l\s+jsi\b/u.test(plain)) err(`${label}: gendered „jsi …l“ — the child may be a girl; rephrase`);
  if (/\b(jsi|bys|by\s+sis?)(\s+\p{L}+){0,2}\s+\p{L}+la\b/u.test(plain) || /\p{L}+la\s+(jsi|bys)\b/u.test(plain)) err(`${label}: gendered past tense („jsi …la“, „bys …la“) — rephrase without gender`);
}

function stepTexts(step) {
  const out = [['text', step.text]];
  if (step.success) out.push(['success', step.success]);
  if (step.wrongDefault) out.push(['wrongDefault', step.wrongDefault]);
  for (const [k, v] of Object.entries(step.wrong ?? {})) out.push([`wrong[${k}]`, v]);
  if (step.explain) out.push(['explain', step.explain]);
  for (const [k, v] of Object.entries(step.wrongExplain ?? {})) out.push([`wrongExplain[${k}]`, v]);
  for (const o of step.options ?? []) if (o.label) out.push([`option ${o.id}`, o.label]);
  for (const s of step.shapes ?? []) if (s.label) out.push([`shape label`, s.label]);
  return out;
}

// ---------------------------------------------------------------------------- practice

const puzzleData = JSON.parse(readFileSync(join(root, 'public/puzzles/puzzles.json'), 'utf8'));

function checkPractice(p) {
  if (p.kind === 'play') {
    if (!(Number.isInteger(p.level) && p.level >= 1 && p.level <= 7)) err(`practice: play level ${p.level} (1–7)`);
  } else if (p.kind === 'puzzles') {
    const band = puzzleData.bands.find((b) => b.id === p.band);
    if (!band) return err(`practice: unknown puzzle band "${p.band}"`);
    if (p.theme && !THEME_LABELS.has(p.theme)) err(`practice: theme "${p.theme}" has no Czech label, the puzzle panel cannot filter on it`);
    const pool = puzzleData.puzzles.filter((r) => r[3] >= band.min && r[3] <= band.max && (!p.theme || r[4].split(' ').includes(p.theme)));
    if (pool.length < (p.count ?? 1)) err(`practice: band ${p.band} theme ${p.theme} has only ${pool.length} puzzles`);
    notes.push(`${where}: practice puzzles ${p.band}/${p.theme ?? '*'}: ${pool.length} available`);
  } else if (p.kind === 'endgame') {
    if (!ENDGAMES.some((e) => e.id === p.id)) err(`practice: unknown endgame "${p.id}"`);
  } else err(`practice: unknown kind ${p.kind}`);
  lintText(p.label, 'practice label');
}

// ---------------------------------------------------------------------------- run

const lessonIds = new Set();
let stepCount = 0;
for (const level of COURSE) {
  level.lessons.forEach((lesson, i) => {
    where = lesson.id;
    if (lessonIds.has(lesson.id)) err('duplicate lesson id');
    lessonIds.add(lesson.id);
    if (!/^[a-z0-9-]{1,40}$/.test(lesson.id)) err('lesson id must match [a-z0-9-]{1,40}');
    if (lesson.level !== level.level) err(`level ${lesson.level} listed under level ${level.level}`);
    if (lesson.number !== i + 1) err(`number ${lesson.number}, expected ${i + 1}`);
    const maxSteps = lesson.test ? 13 : 8;
    if (lesson.steps.length < 4 || lesson.steps.length > maxSteps) err(`${lesson.steps.length} steps (4–${maxSteps})`);
    if (lesson.test) checkTestLesson(lesson);
    lintText(lesson.title, 'title');
    lintText(lesson.outro, 'outro');
    if (lesson.piece) {
      const name = PIECE_NAMES[lesson.piece].nom;
      if (!placeholdersIn(lesson.steps[0].text).includes(name)) err(`piece lesson: step 1 must name the piece with {${name}} (animal + chess name)`);
    }
    for (const p of lesson.practice ?? []) checkPractice(p);
  });
}

// `node scripts/check-lessons.mjs l4-` checks only the steps of lessons whose id starts with
// the prefix (quick authoring runs; the full run is what counts).
const only = process.argv[2];
for (const level of COURSE) {
  for (const lesson of level.lessons) {
    if (only && !lesson.id.startsWith(only)) continue;
    const stepIds = new Set();
    for (const [i, step] of lesson.steps.entries()) {
      where = `${lesson.id} #${i + 1} ${step.id} (${step.kind})`;
      stepCount++;
      if (stepIds.has(step.id)) err('duplicate step id');
      stepIds.add(step.id);
      for (const s of [...(step.shapes ?? []).flatMap((x) => [x.from, x.to].filter(Boolean)), ...(step.stars ?? [])]) if (!isSquare(s)) err(`bad square ${s}`);
      const b = safeBoard(step.fen);
      if (step.kind !== 'collect') for (const s of step.stars ?? []) if (b?.has(s)) err(`star ${s} on an occupied square`);
      if (step.kind === 'move') await checkMoveStep(step, lesson.level);
      else if (step.kind === 'collect') checkCollectStep(step);
      else if (step.kind === 'choose') await checkChooseStep(step);
      else if (step.kind === 'show') checkShowStep(step);
      else if (step.kind === 'mini') checkMiniStep(step);
      else err(`unknown step kind ${step.kind}`);
      for (const [label, text] of stepTexts(step)) lintText(text, label);
    }
  }
}

engine?.send('quit');
engine?.proc.kill();
saveTablebaseCache();

for (const n of notes) console.log(`  · ${n}`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`check-lessons: ${lessonIds.size} lessons, ${stepCount} steps — ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
