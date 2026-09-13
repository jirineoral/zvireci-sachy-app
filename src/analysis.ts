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
import { ANALYSIS, classifyMove, sacrificeOf, uciToMove, type Glyph } from './feedback';

export interface PositionEval {
  /** Best line score, white POV, mate-normalised centipawns. */
  evalCp: number;
  /** Best move (UCI) and its SAN in that position; null when none (game over). */
  bestUci: string | null;
  bestSan: string | null;
  /** Second-best score from the side to move's POV, if the engine reported one. */
  secondCpMover: number | null;
  bestCpMover: number;
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
    if (terminal !== null) return { evalCp: terminal, bestUci: null, bestSan: null, secondCpMover: null, bestCpMover: chess.turn() === 'w' ? terminal : -terminal };
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
    };
  };

  const result = (async (): Promise<GameAnalysis | null> => {
    const evals: PositionEval[] = [];
    for (let i = 0; i < total; i++) {
      if (cancelled) return null;
      onProgress({ done: i, total });
      const ev = await evaluate(positions[i]);
      if (ev === null || cancelled) return null;
      evals.push(ev);
    }
    onProgress({ done: total, total });

    // Stockfish answers a position with a single legal move at once, with a depth-1 score
    // (e.g. a forced recapture before a mate). Such a position is worth exactly what the
    // forced move leads to: take the next position's eval, walking backwards so chains of
    // forced moves resolve.
    for (let i = total - 2; i >= 0; i--) {
      const moves = positions[i].moves({ verbose: true });
      if (moves.length !== 1) continue;
      const only = moves[0];
      const next = evals[i + 1];
      evals[i] = {
        evalCp: next.evalCp,
        bestUci: `${only.from}${only.to}${only.promotion ?? ''}`,
        bestSan: only.san,
        secondCpMover: null,
        bestCpMover: positions[i].turn() === 'w' ? next.evalCp : -next.evalCp,
      };
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
      const reply = evAfter.bestUci ?? undefined;
      const glyph = classifyMove({
        evalBefore,
        evalAfter,
        bestMove: evBefore.bestUci,
        secondBestEval: evBefore.secondCpMover,
        played,
        sacrificed: sacrificeOf(before.fen(), mover, played, reply),
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
