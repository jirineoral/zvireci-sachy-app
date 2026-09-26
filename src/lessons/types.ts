/**
 * Lessons (Phase 21 / R6): the step model. Positions and texts are code, reviewed in git
 * (docs/phase-21-plan.md, decision 3) and checked mechanically by `npm run check:lessons`
 * (decision 4). Only type declarations live here, so the file is erased by any TypeScript
 * loader (the node check script strips it too).
 *
 * Conventions for the data:
 *  - Squares are chess.js squares ('e4'); moves are UCI ('e2e4', 'e7e8q').
 *  - `fen` is a full FEN. A step whose position has no kings (a piece alone on the board
 *    to show how it moves) sets `diagram: true`; the checker then validates only the
 *    placement. `move` steps are never diagrams: they need a legal, consistent position.
 *  - Texts are Czech, informal „ty“, short sentences, one idea per step. A piece's first
 *    mention may be a placeholder — `{věž}`, `{Věž}` (capitalised), `{střelec}`, `{dáma}`,
 *    `{král}`, `{jezdec}`, `{pěšec}` — which `resolveText` (text.ts) expands to the chess
 *    name plus how the piece looks in the child's animal set:
 *    „věž (u tebe kůzle s hradem na hlavě)“. Nominative only (the expansion is appended).
 */
import type { Square } from 'chess.js';

/** Chess.js piece symbols; never shown to the child (texts use Czech names/letters). */
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type Brush = 'green' | 'red' | 'blue' | 'yellow';

/** An arrow (`to` set) or a circle on `from`. `label` is a short text drawn on the shape. */
export interface Shape {
  from: Square;
  to?: Square;
  brush?: Brush;
  label?: string;
}

interface StepBase {
  /** Stable within the lesson (progress/analytics may refer to it). */
  id: string;
  fen: string;
  /** No kings: only the placement is validated (show/collect/choose only). */
  diagram?: boolean;
  /** The teacher's bubble (2–3 short sentences). */
  text: string;
  /** Arrows/circles drawn from the start of the step. Must not give a task's answer away. */
  shapes?: Shape[];
  /** Stars drawn on squares (show/choose only; a collect step has its own `stars`). */
  stars?: Square[];
  /** Board orientation; default white at the bottom. */
  orientation?: 'white' | 'black';
}

/** Text, arrows, highlighted squares; `Dál`. */
export interface ShowStep extends StepBase {
  kind: 'show';
}

/**
 * What "all correct answers" means for a move step; the checker verifies that `accept`
 * is exactly that set (so a second solution is never rejected).
 *  - `mate`: every mating move.
 *  - `best`: Stockfish finds no other move within `marginCp` (default 50) of the best.
 *  - `lands`: every legal move of the movable pieces (or of `from`) ending on `square`.
 *  - `captures`: every legal capture of the movable pieces (or of `from`).
 *  - `legal`: every legal move of the piece on `from` (e.g. „kam smí král?“).
 */
export type Completeness =
  | { kind: 'mate' }
  | { kind: 'best'; marginCp?: number }
  | { kind: 'lands'; square: Square; from?: Square }
  | { kind: 'captures'; from?: Square }
  | { kind: 'legal'; from: Square };

/**
 * Play the move. The board offers the movable pieces' *pseudo-legal* moves too, so a move
 * into check can be tried and explained („tvůj král by byl v šachu“) instead of silently
 * refused. Wrong-move explanation order (runner.ts): `wrong[uci]` → illegal (king in
 * check, kings side by side) → the moved piece can be taken („tady by ti … vzal …“) →
 * `wrongDefault`. Never a bare „špatně“.
 */
export interface MoveStep extends StepBase {
  kind: 'move';
  /** Every correct answer, UCI (with the promotion letter where relevant). */
  accept: string[];
  completeness: Completeness;
  /** Squares whose pieces may be moved; default all pieces of the side to move. */
  movable?: Square[];
  /** Shown after a correct move. */
  success?: string;
  /** Explanations of specific wrong moves (UCI → text). */
  wrong?: Record<string, string>;
  /** Why an unlisted wrong move is wrong — mandatory, explains the idea. */
  wrongDefault: string;
}

/** One piece eats all the stars; other pieces are obstacles (own colour, never taken). */
export interface CollectStep extends StepBase {
  kind: 'collect';
  /** The square of the piece that moves. */
  piece: Square;
  stars: Square[];
  /** Fail when the stars are not all eaten after this many moves. */
  maxMoves?: number;
  success?: string;
}

/** A text answer (a button) or a square answer (circled on the board, clicked there). */
export type ChooseOption = { id: string; label: string; square?: undefined } | { id: string; square: Square; label?: undefined };

/** Pick one of 2–4 answers. */
export interface ChooseStep extends StepBase {
  kind: 'choose';
  options: ChooseOption[];
  /** Ids of the correct options (any of them completes the step). */
  correct: string[];
  /** Shown after a correct answer: why it is right. */
  explain: string;
  /** Why a specific wrong answer is wrong (option id → text). */
  wrongExplain?: Record<string, string>;
  /** Why a wrong answer is wrong when `wrongExplain` has no entry. */
  wrongDefault: string;
}

/** Declared for 21b (pěšcová válka, seber všechny pěšce); the runner does not run it yet. */
export interface MiniStep extends StepBase {
  kind: 'mini';
  goal: 'promote-first' | 'capture-all-pawns';
  /** The engine's strength must stay beatable for a child. */
  engineLevel: 1 | 2;
}

export type LessonStep = ShowStep | MoveStep | CollectStep | ChooseStep | MiniStep;

/** Where to practise after the lesson (rendered as a button/link by the panel). */
export type PracticePointer =
  | { kind: 'play'; level: number; label: string }
  | { kind: 'puzzles'; band: string; theme?: string; count?: number; label: string }
  | { kind: 'endgame'; id: string; label: string };

export interface Lesson {
  /** Globally unique, e.g. 'l1-veze'. Stored in progress; never rename a shipped id. */
  id: string;
  level: number;
  /** 1-based order within the level. */
  number: number;
  title: string;
  /** Piece lessons: the piece taught (the checker requires its placeholder in step 1). */
  piece?: PieceType;
  steps: LessonStep[];
  /** Shown at the end of the lesson. */
  outro: string;
  practice?: PracticePointer[];
}

export interface CourseLevel {
  level: number;
  title: string;
  lessons: readonly Lesson[];
}
