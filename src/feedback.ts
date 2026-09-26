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
}

export function classifyMove(input: ClassifyInput): Glyph | null {
  const t = THRESHOLDS;
  const { evalBefore, evalAfter } = input;
  const loss = evalBefore - evalAfter; // cp, for "!?"
  const isBest = input.bestMove !== null && input.played === input.bestMove;
  const chancesLost = winningChances(evalBefore) - winningChances(evalAfter);

  if (chancesLost >= t.blunder) return '??';
  if (chancesLost >= t.mistake) return '?';
  if (chancesLost >= t.inaccuracy) return '?!';

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
  if (!isBest && input.sacrificed >= t.sacrificePawns && loss < t.soundSacrifice) return '!?';
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
