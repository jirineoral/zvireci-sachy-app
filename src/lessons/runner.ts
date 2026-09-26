/**
 * Lessons: the lesson state machine. Pure and board-agnostic — no DOM, no chessground —
 * so it runs in node (scripts/test-lesson-runner.mjs) as well as in the app.
 *
 *   const runner = createLessonRunner(lesson, { animalId: 'kuzlata' });
 *   let view = runner.view;                       // what to render now
 *   view = runner.dispatch({ type: 'move', from: 'a1', to: 'a6' });
 *   view = runner.dispatch({ type: 'next' });
 *
 * The UI renders a `LessonView`: the board part through a `LessonBoard` adapter
 * (`renderToBoard` below), the rest (teacher text, feedback, choice buttons, Dál /
 * Zkusit znovu) through the lesson panel. Board events go back in as inputs:
 * a dropped piece → `{ type: 'move' }`, a clicked square → `{ type: 'square' }`.
 */
import { Chess, type Color, type Square } from 'chess.js';
import { plural } from '../czech';
import { attackersOf, findKing, moved, parsePlacement, placementOf, pseudoTargets, rankOf } from './geometry';
import { PIECE_NAMES, resolveText, tookVerb, type TextContext } from './text';
import type { ChooseStep, CollectStep, Lesson, LessonStep, MoveStep, PieceType, PracticePointer, Shape } from './types';

export type BoardColor = 'white' | 'black';

/** Inputs from the board and the panel. */
export type LessonInput =
  /** A piece dropped on the board. `promotion` when the UI asked; a pawn reaching the last rank otherwise becomes a queen. */
  | { type: 'move'; from: Square; to: Square; promotion?: PieceType }
  /** A square clicked (answers a `choose` step with square options). */
  | { type: 'square'; square: Square }
  /** A text answer button. */
  | { type: 'choose'; id: string }
  /** `Dál` (also finishes the lesson on its last step). */
  | { type: 'next' }
  /** `Zkusit znovu`: restart the current step. */
  | { type: 'retry' }
  /** Previous step. */
  | { type: 'back' };

export type Phase =
  /** Waiting for the child (a show step waits for `Dál`). */
  | 'task'
  /** A wrong answer was explained; `Zkusit znovu` resets the step. */
  | 'wrong'
  /** The step is solved; `Dál`. */
  | 'stepDone'
  /** The last step was left with `Dál`: show the outro and the practice pointers. */
  | 'lessonDone';

export interface ChoiceView {
  id: string;
  /** Set for text answers (buttons); square answers have `square` and are clicked on the board. */
  label?: string;
  square?: Square;
  state: 'idle' | 'wrong' | 'correct';
}

export interface Feedback {
  tone: 'good' | 'bad' | 'info';
  text: string;
}

export interface LessonView {
  lessonId: string;
  title: string;
  /** 0-based. */
  stepIndex: number;
  stepCount: number;
  stepKind: LessonStep['kind'];
  phase: Phase;
  // --- board ---
  fen: string;
  orientation: BoardColor;
  /** The colour chessground treats as "to move" (the movable side). */
  turnColor: BoardColor;
  /** Null = the board is locked. Dests include pseudo-legal moves (explained when illegal). */
  movable: { color: BoardColor; dests: Map<Square, Square[]> } | null;
  lastMove: [Square, Square] | null;
  /** Arrows/circles of the step plus the feedback's (e.g. a red arrow from the attacker). */
  shapes: Shape[];
  /** Stars still on the board. */
  stars: Square[];
  // --- panel ---
  /** The teacher's bubble, placeholders resolved. */
  text: string;
  feedback: Feedback | null;
  choices: ChoiceView[];
  /** Collect steps: moves used / limit (null = no limit). */
  movesUsed: number;
  maxMoves: number | null;
  canNext: boolean;
  canRetry: boolean;
  canBack: boolean;
  /** Set when `phase === 'lessonDone'`. */
  outro: string | null;
  practice: readonly PracticePointer[];
}

export interface LessonRunner {
  readonly view: LessonView;
  dispatch(input: LessonInput): LessonView;
  /** Jump to a step (0-based; clamped). */
  goTo(index: number): LessonView;
}

// ---------------------------------------------------------------------------------------
// The board adapter (implemented on chessground in src/ui/lesson-board.ts).

/**
 * What the runner needs from a board. The implementation owns the board element and
 * reports the child's actions through callbacks it was constructed with
 * (`onMove(from, to)` for a dropped piece, `onSquare(square)` for a click); the glue code
 * turns those into `LessonInput`s, dispatches them and calls `renderToBoard` with the
 * returned view. Nothing here may mutate chess.js game state: a lesson is not a game.
 */
export interface LessonBoard {
  /** Put a position on the board (any FEN, also kingless diagrams). */
  setPosition(fen: string, orientation: BoardColor, turnColor: BoardColor, lastMove: [Square, Square] | null): void;
  /** Which pieces may move where; null locks the board. */
  setMovable(movable: { color: BoardColor; dests: Map<Square, Square[]> } | null): void;
  /** Arrows and circles (replaces the previous ones). */
  drawShapes(shapes: readonly Shape[]): void;
  /** Stars to eat / look at (replaces the previous ones). */
  showStars(squares: readonly Square[]): void;
}

/** Pushes the board part of a view into the adapter. Choice squares become circles. */
export function renderToBoard(board: LessonBoard, view: LessonView): void {
  board.setPosition(view.fen, view.orientation, view.turnColor, view.lastMove);
  board.setMovable(view.movable);
  const choiceShapes: Shape[] = view.choices
    .filter((c) => c.square)
    .map((c) => ({ from: c.square!, brush: c.state === 'wrong' ? 'red' : c.state === 'correct' ? 'green' : 'blue' }));
  board.drawShapes([...view.shapes, ...choiceShapes]);
  board.showStars(view.stars);
}

/** Whether a move from→to is a pawn reaching the last rank (the UI asks which piece). */
export function needsPromotion(view: LessonView, from: Square, to: Square): boolean {
  const piece = parsePlacement(view.fen).get(from);
  return piece?.type === 'p' && (rankOf(to) === 7 || rankOf(to) === 0);
}

// ---------------------------------------------------------------------------------------

const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const SUCCESS_DEFAULT = 'Výborně!';
const COLLECT_DONE_DEFAULT = 'Všechny hvězdy jsou tvoje!';

interface StepState {
  phase: Phase;
  fen: string;
  lastMove: [Square, Square] | null;
  feedback: Feedback | null;
  feedbackShapes: Shape[];
  stars: Square[];
  movesUsed: number;
  choiceState: Record<string, 'wrong' | 'correct'>;
}

export function createLessonRunner(lesson: Lesson, ctx: TextContext, startStep = 0): LessonRunner {
  let index = clamp(startStep, 0, lesson.steps.length - 1);
  let state: StepState = initStep(lesson.steps[index]);
  let finished = false;

  const t = (s: string): string => resolveText(s, ctx);

  const build = (): LessonView => {
    const step = lesson.steps[index];
    const phase: Phase = finished ? 'lessonDone' : state.phase;
    const locked = phase !== 'task';
    const turn = turnOf(state.fen);
    let movable: LessonView['movable'] = null;
    if (!locked && step.kind === 'move') movable = { color: boardColor(turn), dests: moveDests(state.fen, step) };
    if (!locked && step.kind === 'collect') {
      const board = parsePlacement(state.fen);
      const piece = board.get(currentPieceSquare(step, state))!;
      movable = { color: boardColor(piece.color), dests: new Map([[currentPieceSquare(step, state), pseudoTargets(board, currentPieceSquare(step, state))]]) };
    }
    const choices: ChoiceView[] =
      step.kind === 'choose'
        ? step.options.map((o) => ({ id: o.id, label: o.label, square: o.square, state: state.choiceState[o.id] ?? 'idle' }))
        : [];
    const canNext = phase === 'stepDone' || (phase === 'task' && (step.kind === 'show' || step.kind === 'mini'));
    return {
      lessonId: lesson.id,
      title: lesson.title,
      stepIndex: index,
      stepCount: lesson.steps.length,
      stepKind: step.kind,
      phase,
      fen: state.fen,
      orientation: step.orientation ?? 'white',
      turnColor: movable?.color ?? boardColor(turn),
      movable,
      lastMove: state.lastMove,
      shapes: [...(step.shapes ?? []), ...state.feedbackShapes],
      stars: state.stars,
      text: t(step.text),
      feedback: !finished && state.feedback ? { tone: state.feedback.tone, text: t(state.feedback.text) } : null,
      choices: finished ? [] : choices,
      movesUsed: state.movesUsed,
      maxMoves: step.kind === 'collect' ? (step.maxMoves ?? null) : null,
      canNext: !finished && canNext,
      canRetry: !finished && (phase === 'wrong' || (phase === 'task' && state.movesUsed > 0)),
      canBack: !finished && index > 0,
      outro: finished ? t(lesson.outro) : null,
      practice: finished ? (lesson.practice ?? []) : [],
    };
  };

  let view = build();

  /** Returns the same view object when the input changed nothing (the UI can skip a redraw). */
  const dispatch = (input: LessonInput): LessonView => {
    const step = lesson.steps[index];
    const before = { index, state, finished };
    switch (input.type) {
      case 'next':
        if (!view.canNext) break;
        if (index === lesson.steps.length - 1) finished = true;
        else {
          index++;
          state = initStep(lesson.steps[index]);
        }
        break;
      case 'back':
        if (index === 0) break;
        finished = false;
        index--;
        state = initStep(lesson.steps[index]);
        break;
      case 'retry':
        if (finished) break;
        state = initStep(step);
        break;
      case 'move':
        if (state.phase !== 'task' || finished) break;
        if (step.kind === 'move') state = onMove(step, state, input.from, input.to, input.promotion);
        else if (step.kind === 'collect') state = onCollect(step, state, input.from, input.to);
        break;
      case 'square':
        if (step.kind !== 'choose' || state.phase !== 'task' || finished) break;
        {
          const option = step.options.find((o) => o.square === input.square);
          if (option) state = onChoose(step, state, option.id);
        }
        break;
      case 'choose':
        if (step.kind !== 'choose' || state.phase !== 'task' || finished) break;
        state = onChoose(step, state, input.id);
        break;
    }
    if (before.index === index && before.state === state && before.finished === finished) return view;
    view = build();
    return view;
  };

  return {
    get view() {
      return view;
    },
    dispatch,
    goTo(i: number): LessonView {
      index = clamp(i, 0, lesson.steps.length - 1);
      finished = false;
      state = initStep(lesson.steps[index]);
      view = build();
      return view;
    },
  };
}

function initStep(step: LessonStep): StepState {
  return {
    phase: 'task',
    fen: step.fen,
    lastMove: null,
    feedback: step.kind === 'mini' ? { tone: 'info', text: 'Tahle minihra se teprve chystá. Zatím pokračuj dál.' } : null,
    feedbackShapes: [],
    stars: step.kind === 'collect' ? [...step.stars] : [...(step.stars ?? [])],
    movesUsed: 0,
    choiceState: {},
  };
}

// --- move steps ----------------------------------------------------------------------

/** Legal moves plus pseudo-legal ones of the movable pieces (a move into check can be tried and explained). */
export function moveDests(fen: string, step: Pick<MoveStep, 'movable'>): Map<Square, Square[]> {
  const chess = new Chess(fen);
  const turn = chess.turn();
  const board = parsePlacement(fen);
  const ep = epSquareOf(fen);
  const allowed = (sq: Square): boolean => !step.movable || step.movable.includes(sq);
  const dests = new Map<Square, Square[]>();
  const add = (from: Square, to: Square): void => {
    const list = dests.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    dests.set(from, list);
  };
  for (const m of chess.moves({ verbose: true })) if (allowed(m.from)) add(m.from, m.to);
  for (const [sq, p] of board) {
    if (p.color !== turn || !allowed(sq)) continue;
    for (const to of pseudoTargets(board, sq, ep)) add(sq, to);
  }
  return dests;
}

function onMove(step: MoveStep, state: StepState, from: Square, to: Square, promotion?: PieceType): StepState {
  const dests = moveDests(state.fen, step);
  if (!dests.get(from)?.includes(to)) return state; // not offered by the board: ignore
  const board = parsePlacement(state.fen);
  const piece = board.get(from)!;
  const promo: PieceType | undefined = piece.type === 'p' && (rankOf(to) === 7 || rankOf(to) === 0) ? (promotion ?? 'q') : undefined;
  const uci = `${from}${to}${promo ?? ''}`;
  const chess = new Chess(state.fen);
  const legal = chess.moves({ verbose: true }).some((m) => m.from === from && m.to === to && (m.promotion ?? undefined) === promo);

  if (step.accept.includes(uci) && legal) {
    chess.move({ from, to, promotion: promo });
    return { ...state, phase: 'stepDone', fen: chess.fen(), lastMove: [from, to], feedback: { tone: 'good', text: step.success ?? SUCCESS_DEFAULT }, feedbackShapes: [] };
  }
  const why = explainWrongMove(state.fen, from, to, promo, step);
  if (legal) chess.move({ from, to, promotion: promo });
  return {
    ...state,
    phase: 'wrong',
    fen: legal ? chess.fen() : state.fen,
    lastMove: legal ? [from, to] : null,
    feedback: { tone: 'bad', text: why.text },
    feedbackShapes: why.shapes,
  };
}

/**
 * Why a move is not the answer. Order: the step's own text for this move → illegal (own
 * king attacked afterwards) → the moved piece can be taken → the step's `wrongDefault`.
 */
export function explainWrongMove(
  fen: string,
  from: Square,
  to: Square,
  promotion: PieceType | undefined,
  step: Pick<MoveStep, 'wrong' | 'wrongDefault'>,
): { text: string; shapes: Shape[] } {
  const uci = `${from}${to}${promotion ?? ''}`;
  const own = step.wrong?.[uci] ?? step.wrong?.[`${from}${to}`];
  if (own) return { text: own, shapes: [] };

  const board = parsePlacement(fen);
  const piece = board.get(from);
  if (!piece) return { text: step.wrongDefault, shapes: [] };
  const me = piece.color;
  const opp: Color = me === 'w' ? 'b' : 'w';
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true }).some((m) => m.from === from && m.to === to);

  if (!legal) {
    const after = moved(board, from, to, promotion);
    if (epSquareOf(fen) === to && piece.type === 'p') after.delete(`${to[0]}${from[1]}` as Square);
    const king = findKing(after, me);
    const attackers = king ? attackersOf(after, king, opp) : [];
    if (king && attackers.length > 0) {
      const a = attackers.find((sq) => after.get(sq)?.type === 'k') ?? attackers[0];
      const attacker = after.get(a)!;
      if (piece.type === 'k') {
        if (attacker.type === 'k') return { text: 'Tam nesmíš. Králové nikdy nestojí vedle sebe.', shapes: [{ from: a, brush: 'red' }] };
        const name = PIECE_NAMES[attacker.type];
        return { text: `Tam nesmíš. To pole hlídá ${name.fem ? 'soupeřova' : 'soupeřův'} ${name.nom}.`, shapes: [{ from: a, to, brush: 'red' }] };
      }
      const inCheckNow = chess.inCheck();
      return {
        text: inCheckNow ? 'Tvůj král je v šachu. Tenhle tah ho nezachrání.' : 'Tam nesmíš. Tvůj král by pak byl v šachu.',
        shapes: [{ from: a, to: king, brush: 'red' }],
      };
    }
    return { text: step.wrongDefault, shapes: [] };
  }

  chess.move({ from, to, promotion });
  const takers = chess.moves({ verbose: true }).filter((m) => m.to === to);
  if (takers.length > 0) {
    const cheapest = takers.reduce((a, b) => (VALUE[a.piece as PieceType] <= VALUE[b.piece as PieceType] ? a : b));
    const movedType = (promotion ?? piece.type) as PieceType;
    const afterBoard = parsePlacement(chess.fen());
    const defended = attackersOf(afterBoard, to, me).length > 0;
    if (!defended || VALUE[cheapest.piece as PieceType] < VALUE[movedType]) {
      const taker = cheapest.piece as PieceType;
      return {
        text: `Tady by ti ${PIECE_NAMES[taker].nom} ${tookVerb(taker)} ${PIECE_NAMES[movedType].acc}.`,
        shapes: [{ from: cheapest.from, to, brush: 'red' }],
      };
    }
  }
  return { text: step.wrongDefault, shapes: [] };
}

// --- collect steps -------------------------------------------------------------------

function currentPieceSquare(step: CollectStep, state: StepState): Square {
  return state.lastMove ? state.lastMove[1] : step.piece;
}

function onCollect(step: CollectStep, state: StepState, from: Square, to: Square): StepState {
  const at = currentPieceSquare(step, state);
  if (from !== at) return state;
  const board = parsePlacement(state.fen);
  if (!pseudoTargets(board, at).includes(to)) return state;
  const next = moved(board, at, to);
  const stars = state.stars.filter((s) => s !== to);
  const movesUsed = state.movesUsed + 1;
  const fen = `${placementOf(next)} ${turnOf(state.fen)} - - 0 1`;
  if (stars.length === 0) {
    return { ...state, phase: 'stepDone', fen, lastMove: [at, to], stars, movesUsed, feedback: { tone: 'good', text: step.success ?? COLLECT_DONE_DEFAULT } };
  }
  if (step.maxMoves !== undefined && movesUsed >= step.maxMoves) {
    return {
      ...state,
      phase: 'wrong',
      fen,
      lastMove: [at, to],
      stars,
      movesUsed,
      feedback: { tone: 'bad', text: `Došly ti tahy. Jde to na ${step.maxMoves} ${movesWord(step.maxMoves)}. Zkus to znovu.` },
    };
  }
  return { ...state, fen, lastMove: [at, to], stars, movesUsed, feedback: null };
}

export function movesWord(n: number): string {
  return plural(n, 'tah', 'tahy', 'tahů');
}

// --- choose steps --------------------------------------------------------------------

function onChoose(step: ChooseStep, state: StepState, id: string): StepState {
  if (!step.options.some((o) => o.id === id)) return state;
  if (step.correct.includes(id)) {
    return { ...state, phase: 'stepDone', choiceState: { ...state.choiceState, [id]: 'correct' }, feedback: { tone: 'good', text: step.explain } };
  }
  return { ...state, choiceState: { ...state.choiceState, [id]: 'wrong' }, feedback: { tone: 'bad', text: step.wrongExplain?.[id] ?? step.wrongDefault } };
}

// --- helpers --------------------------------------------------------------------------

function turnOf(fen: string): Color {
  return fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
}

function epSquareOf(fen: string): Square | null {
  const ep = fen.trim().split(/\s+/)[3];
  return ep && /^[a-h][36]$/.test(ep) ? (ep as Square) : null;
}

function boardColor(c: Color): BoardColor {
  return c === 'w' ? 'white' : 'black';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
