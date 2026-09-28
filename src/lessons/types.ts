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
 *  - `legal`: every legal move of the piece on `from` (e.g. „kam smí král?“), or of all
 *    movable pieces without `from` (e.g. „zachraň krále z šachu“: every legal move does).
 *  - `safe`: every legal move of the piece on `from` to a square the opponent cannot take
 *    it on („uhni s jezdcem do bezpečí“).
 */
export type Completeness =
  | { kind: 'mate' }
  /** `depth`: the checker's search depth (default 18) — deeper for slow pawn endings. */
  | { kind: 'best'; marginCp?: number; depth?: number }
  | { kind: 'lands'; square: Square; from?: Square }
  | { kind: 'captures'; from?: Square }
  | { kind: 'legal'; from?: Square }
  | { kind: 'safe'; from: Square }
  /** The task names the promotion piece („proměň v dámu“): exactly that promotion is the answer. */
  | { kind: 'promote'; from: Square; to: Square; piece: 'q' | 'r' | 'b' | 'n' }
  /**
   * Endgames with at most 7 pieces: every move (of the movable pieces) that keeps the
   * position's result by the Lichess tablebase — a win stays a win, a draw stays a draw.
   * Checked at authoring time only (scripts/tablebase.mjs, cached), never at runtime.
   */
  | { kind: 'tablebase' };

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
  /**
   * Authoring note, never shown. From level 4 on, a position with at most 7 pieces is
   * checked against the tablebase: every accepted move must keep the result, and every
   * other move that keeps it must either have a `wrong` text („I to vyhrává, ale…“) or be
   * excluded by the task's wording — this note says how (e.g. „the task asks for a check“).
   */
  tbNarrow?: string;
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

/**
 * A fact the checker can verify mechanically for a choose step (so the marked answer is
 * the one true answer):
 *  - `state`: option ids among 'sach' | 'mat' | 'pat' | 'nic' — the side to move's state.
 *  - `castle`: option ids 'ano' | 'ne' — may the side to move castle on that side now?
 *  - `reachable`: square options — correct = those the piece on `from` may legally go to.
 *  - `outcome` (tablebase, ≤ 7 pieces): option ids among 'bily' | 'cerny' | 'remiza' — who
 *    wins with best play from this position (side to move as in the FEN).
 *  - `tbmoves` (tablebase, ≤ 7 pieces): each option stands for a move (option id → UCI);
 *    correct = exactly the options whose move keeps the position's result.
 *  - `keysquares` (king + pawn vs king, white pawn): square options — correct = the pawn's
 *    key squares, computed by an exact K+P vs K bitbase (scripts/kpk.mjs).
 */
export type ChooseFact =
  | { kind: 'keysquares' }
  | { kind: 'state' }
  | { kind: 'castle'; side: 'k' | 'q' }
  | { kind: 'reachable'; from: Square }
  | { kind: 'outcome' }
  | { kind: 'tbmoves'; moves: Record<string, string> };

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
  /** Lets the checker verify the correct option (see `ChooseFact`). */
  verify?: ChooseFact;
}

/**
 * A mini-game against a deliberately weak local move picker (src/lessons/mini.ts), with
 * its own win condition — not a chess game: no kings, no check. Always a `diagram`; the
 * child plays the side to move in the FEN.
 *  - `promote-first` (pěšcová válka): pawns only; the first pawn on the last rank wins,
 *    and so does taking all the opponent's pawns. Nobody able to move → a draw.
 *  - `capture-all-pawns` (seber všechny pěšce): the child's one piece against pawns; win
 *    by taking them all; lose when a pawn takes the piece or reaches the last rank.
 */
export interface MiniStep extends StepBase {
  kind: 'mini';
  goal: 'promote-first' | 'capture-all-pawns';
  /** 1 = random-ish (always beatable), 2 = a bit greedier. Never a real engine. */
  engineLevel: 1 | 2;
  /** Shown when the child wins. */
  success?: string;
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
  /**
   * A level test (lesson „Zkouška“): no hints, one attempt per task, the score at the end.
   * Every step but an optional first `show` is a task. Passing earns the badge `badge`
   * (also the id in progress `tests`) and the printable diploma.
   */
  test?: LevelTest;
}

export interface LevelTest {
  /** Tasks needed to pass. */
  passScore: number;
  /** Badge / test id stored in progress ('l1'). */
  badge: string;
  /** Shown at the end when the test was not passed (the outro is for a pass). */
  failOutro: string;
}

export interface CourseLevel {
  level: number;
  title: string;
  lessons: readonly Lesson[];
}
