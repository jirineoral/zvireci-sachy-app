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
  inaccuracy: 50, // cp lost
  mistake: 100,
  blunder: 300,
  winThrown: { from: 200, to: 50 }, // was winning by ≥ from, now below to
  greatGap: 150, // best move beats the second best by this much → "!"
  sacrificePawns: 2, // material given up to count as a sacrifice
  liveEval: 400, // |eval| beyond this the position is no longer "live" for "!"
  notLosing: -100, // "!!" requires the player not to be losing before the sacrifice
  decided: 900, // |eval| beyond this on both sides: only ?? can still apply
  mateScore: MATE_SCORE,
} as const;

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
}

export function classifyMove(input: ClassifyInput): Glyph | null {
  const t = THRESHOLDS;
  const { evalBefore, evalAfter } = input;
  const loss = evalBefore - evalAfter;
  const isBest = input.bestMove !== null && input.played === input.bestMove;
  const mateNow = evalAfter <= -(t.mateScore - 1000);
  const mateBefore = evalBefore <= -(t.mateScore - 1000);

  if (
    loss >= t.blunder ||
    (evalBefore >= t.winThrown.from && evalAfter < t.winThrown.to) ||
    (mateNow && !mateBefore)
  ) {
    return '??';
  }

  const decided =
    Math.abs(evalBefore) > t.decided &&
    Math.abs(evalAfter) > t.decided &&
    Math.sign(evalBefore) === Math.sign(evalAfter);
  if (!decided) {
    if (loss >= t.mistake) return '?';
    if (loss >= t.inaccuracy) return '?!';
  }

  const live = Math.abs(evalBefore) <= t.liveEval;
  // A sound sacrifice that is the engine's best move. The eval "before" already includes the
  // sacrifice's consequences (a mating sac reads as +M), so "already winning" cannot be the
  // filter here; "not losing" is.
  if (isBest && input.sacrificed >= t.sacrificePawns && evalBefore >= t.notLosing) return '!!';
  if (
    isBest &&
    input.secondBestEval !== null &&
    evalBefore - input.secondBestEval >= t.greatGap &&
    live
  ) {
    return '!';
  }
  if (!isBest && input.sacrificed >= t.sacrificePawns && loss < t.inaccuracy) return '!?';
  return null;
}

/**
 * Material the human gives up with `played` from the position `fenBefore`, measured after
 * the opponent's best reply (first move of the post-move PV). Positive = the human is
 * down material afterwards. Rules come from chess.js; this only counts pieces.
 */
export function sacrificeOf(
  fenBefore: string,
  human: Color,
  played: UciMove,
  opponentReply: UciMove | undefined,
): number {
  const clone = new Chess(fenBefore);
  const before = material(clone, human);
  try {
    clone.move(uciToMove(played));
    if (opponentReply) clone.move(uciToMove(opponentReply));
  } catch {
    return 0; // PV did not fit the position (should not happen); no sacrifice claimed
  }
  return before - material(clone, human);
}

export function uciToMove(uci: UciMove): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}
