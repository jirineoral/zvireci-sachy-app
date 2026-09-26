// A plain "child" for the lesson mini-games (src/lessons/mini.ts), used by
// scripts/check-lessons.mjs (is the opponent beatable?) and scripts/test-lesson-runner.mjs
// (drive the runner through a won game). It plays like a careful beginner: promote when it
// can, take what is free, push the most advanced pawn to a square no enemy pawn attacks.
// No lookahead beyond one move — if this wins most games, a child who tries can too.
// Needs './ts-hooks.mjs' imported first.
const { miniMoves, miniOutcome, pickReply } = await import('../src/lessons/mini.ts');
const { attacks, moved, parsePlacement, rankOf } = await import('../src/lessons/geometry.ts');

const other = (c) => (c === 'w' ? 'b' : 'w');
/** Can `color` take whatever stands on `sq`? */
const attackedBy = (board, sq, color) => miniMoves(board, color).some(([, to]) => to === sq);

/** The careful beginner's move for `color`, or null without a move. */
export function childMove(goal, board, color, random) {
  const moves = miniMoves(board, color);
  if (moves.length === 0) return null;
  const opp = other(color);
  const last = color === 'w' ? 7 : 0;
  const safe = ([from, to]) => !attackedBy(moved(board, from, to), to, opp);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const promote = moves.filter(([from, to]) => rankOf(to) === last && board.get(from)?.type === 'p');
  if (goal === 'promote-first' && promote.length) return promote[0];
  const captures = moves.filter(([, to]) => board.has(to));
  const safeCaptures = captures.filter(safe);
  if (safeCaptures.length) {
    // In the queen game: the most advanced pawn first.
    safeCaptures.sort(([, a], [, b]) => (color === 'w' ? rankOf(a) - rankOf(b) : rankOf(b) - rankOf(a)));
    return safeCaptures[0];
  }
  if (goal === 'promote-first' && captures.length) return pick(captures);
  const quietSafe = moves.filter((m) => !board.has(m[1]) && safe(m));
  if (goal === 'promote-first' && quietSafe.length) {
    quietSafe.sort(([a], [b]) => (color === 'w' ? rankOf(b) - rankOf(a) : rankOf(a) - rankOf(b)));
    return quietSafe[0];
  }
  if (quietSafe.length) {
    // The queen game: chase the most advanced pawn — attack it or the square it goes to next.
    const pawns = [...board].filter(([, p]) => p.color === opp && p.type === 'p').map(([sq]) => sq);
    pawns.sort((a, b) => (opp === 'b' ? rankOf(a) - rankOf(b) : rankOf(b) - rankOf(a)));
    const target = pawns[0];
    const ahead = target && `${target[0]}${rankOf(target) + 1 + (opp === 'b' ? -1 : 1)}`;
    const hits = (m) => {
      const after = moved(board, m[0], m[1]);
      const reach = attacks(after, m[1]);
      return (reach.includes(target) ? 2 : 0) + (reach.includes(ahead) ? 1 : 0);
    };
    const best = Math.max(...quietSafe.map(hits));
    return pick(quietSafe.filter((m) => hits(m) === best));
  }
  return pick(moves);
}

/** Plays one game of `step` (a MiniStep) with the careful beginner; returns 'won' | 'lost' | 'draw'. */
export function simulate(step, random) {
  let board = parsePlacement(step.fen);
  const child = step.fen.split(' ')[1];
  const engine = other(child);
  for (let ply = 0; ply < 400; ply++) {
    const m = childMove(step.goal, board, child, random);
    if (!m) return 'draw';
    board = moved(board, m[0], m[1]);
    let out = miniOutcome(step.goal, board, child, child);
    if (out) return out.result;
    const r = pickReply(step.goal, board, engine, step.engineLevel, random);
    if (!r) continue; // the pawns pass
    board = moved(board, r[0], r[1]);
    out = miniOutcome(step.goal, board, engine, child);
    if (out) return out.result;
  }
  return 'draw';
}
