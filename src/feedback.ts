/**
 * Move feedback: turns two engine analyses (before and after the human's move) into one
 * of six glyphs, chess.com style. Pure functions; all thresholds live in THRESHOLDS.
 * Scores are centipawns from the HUMAN's point of view (mates near ±MATE_SCORE).
 */
import { Chess, type Color } from 'chess.js';
import { MATE_SCORE, type UciMove } from './engine';

export type Glyph = '!!' | '!' | '!?' | '?!' | '?' | '??';

export const GLYPH_LABEL: Record<Glyph, string> = {
  '!!': 'Brilantní tah',
  '!': 'Skvělý tah',
  '!?': 'Zajímavý tah',
  '?!': 'Nepřesnost',
  '?': 'Chyba',
  '??': 'Hrubá chyba',
};

/** CSS class suffix per glyph (colours in app.css). */
export const GLYPH_CLASS: Record<Glyph, string> = {
  '!!': 'brilliant',
  '!': 'great',
  '!?': 'interesting',
  '?!': 'inaccuracy',
  '?': 'mistake',
  '??': 'blunder',
};

export const THRESHOLDS = {
  // ?! ? ?? judge the drop in winning chances (Lichess's formula and cut-offs), not raw
  // centipawns: in a decided position (two rooks up, or a mate either way) a lost knight
  // or a mate two moves later/sooner changes nothing and is not a mistake, while throwing
  // a won game away or walking into mate from an open position still is.
  inaccuracy: 0.1, // winning chances lost, on the -1…1 scale of winningChances()
  mistake: 0.2,
  blunder: 0.3,
  greatGap: 150, // best move beats the second best by this much (cp) → "!"
  sacrificePawns: 2, // material given up to count as a sacrifice
  soundSacrifice: 50, // cp at most lost by a non-best sacrifice for "!?"
  liveEval: 400, // |eval| beyond this the position is no longer "live" for "!"
  notLosing: -100, // "!!" requires the player not to be losing before the sacrifice
  mateScore: MATE_SCORE,
} as const;

/**
 * Winning chances in -1…1 for a mover-POV score (Lichess: 2 / (1 + e^(-0.00368208·cp)) - 1),
 * with the score capped at ±1000 cp first, so every mate and every crushing eval read as
 * "won" / "lost" alike.
 */
export function winningChances(cp: number): number {
  const capped = Math.max(-1000, Math.min(1000, cp));
  return 2 / (1 + Math.exp(-0.00368208 * capped)) - 1;
}

/** Fixed analysis limits (same for every difficulty level, so verdicts are comparable). */
export const ANALYSIS = { depth: 12, movetimeMs: 700 } as const;

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material of one side in pawns, read from chess.js (no rule logic of ours). */
export function material(chess: Chess, color: Color): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const square of row) {
      if (square && square.color === color) total += PIECE_VALUE[square.type] ?? 0;
    }
  }
  return total;
}

export interface ClassifyInput {
  evalBefore: number; // human to move, human POV
  evalAfter: number; // opponent to move, human POV
  bestMove: UciMove | null; // engine's best move in the position before
  secondBestEval: number | null; // eval of the second-best move before (human POV), if known
  played: UciMove;
  sacrificed: number; // pawns of material the human gives up (see sacrificeOf)
  obvious: boolean; // a take-back or the only move that keeps the material (see isObviousMove)
}

export function classifyMove(input: ClassifyInput): Glyph | null {
  const t = THRESHOLDS;
  const { evalBefore, evalAfter } = input;
  const loss = evalBefore - evalAfter; // cp, for "!?"
  const isBest = input.bestMove !== null && input.played === input.bestMove;
  const chancesLost = winningChances(evalBefore) - winningChances(evalAfter);

  // The engine's own best move is never a mistake: when the two searches (before / after)
  // disagree, the drop is search noise, and the feedback would suggest the very same move.
  if (!isBest) {
    if (chancesLost >= t.blunder) return '??';
    if (chancesLost >= t.mistake) return '?';
    if (chancesLost >= t.inaccuracy) return '?!';
  }

  const live = Math.abs(evalBefore) <= t.liveEval;
  // A sound sacrifice that is the engine's best move. The eval "before" already includes the
  // sacrifice's consequences (a mating sac reads as +M), so "already winning" cannot be the
  // filter here; "not losing" is — and the second-best move must not win anyway (a piece
  // given back in a won position is no brilliancy).
  if (
    isBest &&
    input.sacrificed >= t.sacrificePawns &&
    evalBefore >= t.notLosing &&
    (input.secondBestEval === null || input.secondBestEval <= t.liveEval)
  ) {
    return '!!';
  }
  // "!" = the one good move, but not the obvious take-back (its alternatives just lose the
  // material, so the gap to the second best is large by nature).
  if (
    isBest &&
    !input.obvious &&
    input.secondBestEval !== null &&
    evalBefore - input.secondBestEval >= t.greatGap &&
    live
  ) {
    return '!';
  }
  // A sound sacrifice other than the best move, in a live game the player is not losing.
  if (!isBest && input.sacrificed >= t.sacrificePawns && loss < t.soundSacrifice && evalBefore >= t.notLosing && live) return '!?';
  return null;
}

/** Material balance in pawns from `color`'s side: own minus the opponent's. */
function balance(chess: Chess, color: Color): number {
  return material(chess, color) - material(chess, color === 'w' ? 'b' : 'w');
}

/**
 * Net material the human gives up with `played` from `fenBefore`: the balance (own minus
 * opponent's) before, minus the balance after `played` and the engine's line that follows
 * (`line[0]` the opponent's reply, `line[1]` the human's next move, …). The balance is read
 * after each of the human's next two moves in the line and the best one counts, so taking
 * and being taken back cancels out (an ordinary trade is 0) while a piece left for the
 * opponent stays given up. With no human move in the line, it is read after the reply.
 * Rules come from chess.js; this only counts pieces.
 */
export function sacrificeOf(fenBefore: string, human: Color, played: UciMove, line: readonly UciMove[]): number {
  const clone = new Chess(fenBefore);
  const before = balance(clone, human);
  try {
    clone.move(uciToMove(played));
  } catch {
    return 0; // should not happen; no sacrifice claimed
  }
  let after = balance(clone, human);
  let best: number | null = null;
  for (let i = 0; i < Math.min(line.length, 4) && !clone.isGameOver(); i++) {
    try {
      clone.move(uciToMove(line[i]));
    } catch {
      break; // the PV did not fit (should not happen); count what was played so far
    }
    after = balance(clone, human);
    if (i % 2 === 1) best = best === null ? after : Math.max(best, after); // after a human move
  }
  return before - (best ?? after);
}

/** Balance after the first `plies` moves of `line` from `fen` (fewer if the line is shorter). */
function balanceAlong(fen: string, color: Color, line: readonly UciMove[], plies: number): number {
  const chess = new Chess(fen);
  for (const uci of line.slice(0, plies)) {
    if (chess.isGameOver()) break;
    try {
      chess.move(uciToMove(uci));
    } catch {
      break;
    }
  }
  return balance(chess, color);
}

/**
 * True when the engine's best line just keeps the material balance while its second-best
 * line loses material (within the next four plies): the best move just saves a piece —
 * the only sensible move, not a "great" one. `bestLine` / `secondLine` are the engine's
 * lines from `fenBefore` (human to move).
 */
function onlyMoveKeepingMaterial(fenBefore: string, bestLine: readonly UciMove[], secondLine: readonly UciMove[] | null): boolean {
  if (secondLine === null || secondLine.length === 0 || bestLine.length === 0) return false;
  const human = new Chess(fenBefore).turn();
  const now = balance(new Chess(fenBefore), human);
  const best = balanceAlong(fenBefore, human, bestLine, 4);
  const second = balanceAlong(fenBefore, human, secondLine, 4);
  return best <= now + 1 && best - second >= THRESHOLDS.sacrificePawns;
}

/** The opponent's move just before the human's: the position it was played in and the move. */
export interface PreviousMove {
  fen: string;
  move: UciMove;
}

/**
 * True when `played` is the obvious move rather than a find: it captures on the square the
 * opponent just moved to (a take-back, or taking what was just put en prise), or answers a
 * capture by restoring exactly the material balance of before it, or it is the engine's best move that merely keeps the material while the
 * second best loses some (see onlyMoveKeepingMaterial). Its alternatives just lose
 * material, so the gap to the second best is large by nature; no "!" for it.
 */
export function isObviousMove(
  prev: PreviousMove | null,
  fenBefore: string,
  played: UciMove,
  bestLine: readonly UciMove[],
  secondLine: readonly UciMove[] | null,
): boolean {
  return isObviousReply(prev, played) || (bestLine[0] === played && onlyMoveKeepingMaterial(fenBefore, bestLine, secondLine));
}

function isObviousReply(prev: PreviousMove | null, played: UciMove): boolean {
  if (prev === null) return false;
  const chess = new Chess(prev.fen);
  const mover = chess.turn() === 'w' ? 'b' : 'w'; // the human moves after the opponent
  const balancePrev = balance(chess, mover);
  try {
    const opponent = chess.move(uciToMove(prev.move));
    const mine = chess.move(uciToMove(played));
    if (!mine.captured) return false;
    if (mine.to === opponent.to) return true; // takes (back) on the square the opponent just moved to
    if (!opponent.captured) return false;
  } catch {
    return false;
  }
  return balance(chess, mover) === balancePrev;
}

export function uciToMove(uci: UciMove): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}
