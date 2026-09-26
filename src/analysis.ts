/**
 * Whole-game analysis (Phase 9): evaluates every position of a game with the local engine
 * and derives, per ply, the eval (white POV), the engine's best move and a feedback glyph
 * for the side that moved — with the same `classifyMove` rules as the live feedback, so a
 * reviewed import reads like a game played here. Sequential, cancelable, progress-reporting.
 * The caller guarantees the engine has no other job (review mode) and has set the analysis
 * options (Skill 20, MultiPV 2).
 */
import { Chess } from 'chess.js';
import { MATE_SCORE, type Engine, type PvLine } from './engine';
import { ANALYSIS, classifyMove, isObviousMove, sacrificeOf, uciToMove, type Glyph } from './feedback';

export interface PositionEval {
  /** Best line score, white POV, mate-normalised centipawns. */
  evalCp: number;
  /** Best move (UCI) and its SAN in that position; null when none (game over). */
  bestUci: string | null;
  bestSan: string | null;
  /** Second-best score from the side to move's POV, if the engine reported one. */
  secondCpMover: number | null;
  bestCpMover: number;
  /** The engine's best line from this position (UCI), empty when none; the second best, if reported. */
  pv: string[];
  secondPv: string[] | null;
}

export interface PlyAnalysis {
  glyph: Glyph | null;
  betterSan: string | null;
  evalCp: number; // after the ply, white POV
  bestSan: string | null; // in the position after the ply
}

export interface GameAnalysis {
  startEvalCp: number;
  startBestSan: string | null;
  plies: PlyAnalysis[];
}

export interface AnalysisProgress {
  done: number;
  total: number;
}

export interface AnalysisHandle {
  result: Promise<GameAnalysis | null>;
  /** Stops after the current position; `result` resolves null. */
  cancel: () => void;
}

function toWhitePov(cpMover: number, moverIsWhite: boolean): number {
  return moverIsWhite ? cpMover : -cpMover;
}

/** Terminal positions get a definite score without asking the engine. */
function terminalEval(chess: Chess): number | null {
  if (chess.isCheckmate()) return toWhitePov(-MATE_SCORE, chess.turn() === 'w');
  if (chess.isGameOver()) return 0;
  return null;
}

export function analyseGame(engine: Engine, startFen: string, sans: readonly string[], onProgress: (p: AnalysisProgress) => void): AnalysisHandle {
  let cancelled = false;
  const positions: Chess[] = [];
  const walker = new Chess(startFen);
  positions.push(new Chess(walker.fen()));
  for (const san of sans) {
    walker.move(san);
    positions.push(new Chess(walker.fen()));
  }
  const total = positions.length;

  const evaluate = async (chess: Chess): Promise<PositionEval | null> => {
    const terminal = terminalEval(chess);
    if (terminal !== null) return { evalCp: terminal, bestUci: null, bestSan: null, secondCpMover: null, bestCpMover: chess.turn() === 'w' ? terminal : -terminal, pv: [], secondPv: null };
    const lines: PvLine[] | null = await engine.analyse(chess.fen(), { depth: ANALYSIS.depth, movetimeMs: ANALYSIS.movetimeMs, multiPv: 2 }).result;
    if (lines === null) return null; // cancelled
    const best = lines.find((l) => l.multipv === 1);
    if (!best) return null;
    const second = lines.find((l) => l.multipv === 2);
    const bestUci = best.pv[0] ?? null;
    let bestSan: string | null = null;
    if (bestUci) {
      try {
        bestSan = new Chess(chess.fen()).move(uciToMove(bestUci)).san;
      } catch {
        bestSan = null;
      }
    }
    return {
      evalCp: toWhitePov(best.scoreCp, chess.turn() === 'w'),
      bestUci,
      bestSan,
      secondCpMover: second ? second.scoreCp : null,
      bestCpMover: best.scoreCp,
      pv: best.pv,
      secondPv: second ? second.pv : null,
    };
  };

  // Stockfish answers a position with a single legal move at once, with a depth-1 score
  // (e.g. a forced recapture before a mate). Such a position is worth exactly what the
  // forced move leads to.
  const forcedEval = (chess: Chess, next: PositionEval): PositionEval => {
    const only = chess.moves({ verbose: true })[0];
    const uci = `${only.from}${only.to}${only.promotion ?? ''}`;
    return {
      evalCp: next.evalCp,
      bestUci: uci,
      bestSan: only.san,
      secondCpMover: null,
      bestCpMover: chess.turn() === 'w' ? next.evalCp : -next.evalCp,
      pv: [uci, ...next.pv],
      secondPv: null,
    };
  };

  /** The final position has no successor in the game: follow its forced moves (if any) here. */
  const evaluateLast = async (chess: Chess, depth = 0): Promise<PositionEval | null> => {
    const moves = chess.moves({ verbose: true });
    if (moves.length !== 1 || depth >= 8 || chess.isGameOver()) return evaluate(chess);
    const child = new Chess(chess.fen());
    child.move(moves[0].san);
    const next = await evaluateLast(child, depth + 1);
    return next === null ? null : forcedEval(chess, next);
  };

  const result = (async (): Promise<GameAnalysis | null> => {
    const evals: PositionEval[] = [];
    for (let i = 0; i < total; i++) {
      if (cancelled) return null;
      onProgress({ done: i, total });
      const ev = await (i === total - 1 ? evaluateLast(positions[i]) : evaluate(positions[i]));
      if (ev === null || cancelled) return null;
      evals.push(ev);
    }
    onProgress({ done: total, total });

    // Forced moves (see forcedEval): take the next position's eval, walking backwards so
    // chains of forced moves resolve. The final position was handled by evaluateLast.
    for (let i = total - 2; i >= 0; i--) {
      if (positions[i].moves().length === 1) evals[i] = forcedEval(positions[i], evals[i + 1]);
    }

    const plies: PlyAnalysis[] = [];
    for (let i = 0; i < sans.length; i++) {
      const before = positions[i];
      const mover = before.turn();
      const moverIsWhite = mover === 'w';
      const evBefore = evals[i];
      const evAfter = evals[i + 1];
      const played = uciOf(before, sans[i]);
      // Mover POV values for the classifier.
      const evalBefore = evBefore.bestCpMover;
      const evalAfter = moverIsWhite ? evAfter.evalCp : -evAfter.evalCp;
      // A forced move (one legal move) is neither good nor bad: no glyph.
      const glyph =
        before.moves().length === 1
          ? null
          : classifyMove({
              evalBefore,
              evalAfter,
              bestMove: evBefore.bestUci,
              secondBestEval: evBefore.secondCpMover,
              played,
              sacrificed: sacrificeOf(before.fen(), mover, played, evAfter.pv),
              obvious: isObviousMove(
                i > 0 ? { fen: positions[i - 1].fen(), move: uciOf(positions[i - 1], sans[i - 1]) } : null,
                before.fen(),
                played,
                evBefore.pv,
                evBefore.secondPv,
              ),
            });
      const wantsBetter = glyph === '?!' || glyph === '?' || glyph === '??';
      plies.push({
        glyph,
        betterSan: wantsBetter && evBefore.bestSan !== sans[i] ? evBefore.bestSan : null,
        evalCp: evAfter.evalCp,
        bestSan: evAfter.bestSan,
      });
    }
    return { startEvalCp: evals[0].evalCp, startBestSan: evals[0].bestSan, plies };
  })();

  return {
    result,
    cancel: () => {
      cancelled = true;
    },
  };
}

function uciOf(before: Chess, san: string): string {
  const move = new Chess(before.fen()).move(san);
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}
