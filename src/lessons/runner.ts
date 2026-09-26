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
 *
 * Phase 21b: `mini` steps (a mini-game against the weak local picker in mini.ts — the UI
 * sends `{ type: 'reply' }` after a short pause while `view.mini.thinking`), and level
 * tests (`lesson.test`: one attempt per task, the first answer is final, a score).
 */
import { Chess, type Color, type Square } from 'chess.js';
import { plural } from '../czech';
import { attackersOf, findKing, moved, parsePlacement, placementOf, pseudoTargets, rankOf } from './geometry';
import { countPawns, miniOutcome, pickReply, type MiniResult } from './mini';
import { PIECE_NAMES, resolveText, tookVerb, type TextContext } from './text';
import type { ChooseStep, CollectStep, Completeness, Lesson, LessonStep, MiniStep, MoveStep, PieceType, PracticePointer, Shape } from './types';

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
  | { type: 'back' }
  /** Mini-game: the opponent's move (the UI sends it after a short pause while `mini.thinking`). */
  | { type: 'reply' }
  /** Start the whole lesson over (a level test after its result). */
  | { type: 'restart' };

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

/** A mini-game's scoreboard. */
export interface MiniView {
  goal: MiniStep['goal'];
  /** The child's pawns (pěšcová válka) / the pawns still to take (seber všechny pěšce). */
  mine: number;
  theirs: number;
  /** The opponent is about to move (the board is locked; the UI sends `reply`). */
  thinking: boolean;
  result: MiniResult['result'] | null;
}

/** A level test's score. `passed` is set once the test is finished. */
export interface TestView {
  correct: number;
  answered: number;
  total: number;
  passScore: number;
  passed: boolean | null;
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
  /** The side whose king is in check (the board highlights it), or null. */
  check: BoardColor | null;
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
  /** Set when `phase === 'lessonDone'` (a failed test gets its `failOutro`). */
  outro: string | null;
  practice: readonly PracticePointer[];
  /** Mini-game steps only. */
  mini: MiniView | null;
  /** Level tests only. */
  test: TestView | null;
}

export interface RunnerOptions {
  /** Random source of the mini-game opponent (tests pass a seeded one). */
  random?: () => number;
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
  /** Put a position on the board (any FEN, also kingless diagrams); `check` highlights that king. */
  setPosition(fen: string, orientation: BoardColor, turnColor: BoardColor, lastMove: [Square, Square] | null, check?: BoardColor | null): void;
  /** Which pieces may move where; null locks the board. */
  setMovable(movable: { color: BoardColor; dests: Map<Square, Square[]> } | null): void;
  /** Arrows and circles (replaces the previous ones). */
  drawShapes(shapes: readonly Shape[]): void;
  /** Stars to eat / look at (replaces the previous ones). */
  showStars(squares: readonly Square[]): void;
}

/** Pushes the board part of a view into the adapter. Choice squares become circles. */
export function renderToBoard(board: LessonBoard, view: LessonView): void {
  board.setPosition(view.fen, view.orientation, view.turnColor, view.lastMove, view.check);
  board.setMovable(view.movable);
  const choiceShapes: Shape[] = view.choices
    .filter((c) => c.square)
    .map((c) => ({ from: c.square!, brush: c.state === 'wrong' ? 'red' : c.state === 'correct' ? 'green' : 'blue' }));
  board.drawShapes([...view.shapes, ...choiceShapes]);
  board.showStars(view.stars);
}

/** Whether a move from→to is a pawn reaching the last rank (the UI asks which piece). */
export function needsPromotion(view: LessonView, from: Square, to: Square): boolean {
  if (view.stepKind === 'mini') return false; // a mini-game pawn on the last rank simply wins
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
  /** Mini-game steps: waiting for the opponent's reply / the final result. */
  mini: { awaiting: boolean; result: MiniResult | null } | null;
}

export function createLessonRunner(lesson: Lesson, ctx: TextContext, startStep = 0, options: RunnerOptions = {}): LessonRunner {
  let index = clamp(startStep, 0, lesson.steps.length - 1);
  let state: StepState = initStep(lesson.steps[index]);
  let finished = false;
  const random = options.random ?? Math.random;
  const test = lesson.test ?? null;
  /** Level tests: step index → answered correctly. */
  let results = new Map<number, boolean>();
  const taskCount = lesson.steps.filter((s) => s.kind !== 'show').length;

  const t = (s: string): string => resolveText(s, ctx);

  const testView = (): TestView | null => {
    if (!test) return null;
    const correct = [...results.values()].filter(Boolean).length;
    return { correct, answered: results.size, total: taskCount, passScore: test.passScore, passed: finished ? correct >= test.passScore : null };
  };

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
    let mini: MiniView | null = null;
    if (step.kind === 'mini') {
      const board = parsePlacement(state.fen);
      const child = turnOf(step.fen);
      const engine = otherColor(child);
      if (!locked && !state.mini?.awaiting) {
        const dests = new Map<Square, Square[]>();
        for (const [sq, p] of board) if (p.color === child) dests.set(sq, pseudoTargets(board, sq));
        movable = { color: boardColor(child), dests };
      }
      mini = {
        goal: step.goal,
        mine: countPawns(board, child),
        theirs: countPawns(board, engine),
        thinking: !finished && state.mini?.awaiting === true,
        result: state.mini?.result?.result ?? null,
      };
    }
    const choices: ChoiceView[] =
      step.kind === 'choose'
        ? step.options.map((o) => ({ id: o.id, label: o.label, square: o.square, state: state.choiceState[o.id] ?? 'idle' }))
        : [];
    // Nothing is locked: a mini-game can be left any time (except while the reply is pending).
    const canNext = phase === 'stepDone' || (phase === 'task' && step.kind === 'show') || (step.kind === 'mini' && !test && state.mini?.awaiting !== true);
    const tv = testView();
    return {
      lessonId: lesson.id,
      title: lesson.title,
      stepIndex: index,
      stepCount: lesson.steps.length,
      stepKind: step.kind,
      phase,
      fen: state.fen,
      orientation: step.orientation ?? 'white',
      turnColor: movable?.color ?? boardColor(step.kind === 'mini' ? turnOf(step.fen) : turn),
      movable,
      lastMove: state.lastMove,
      // No check highlight in a test: it would give „šach / mat / pat“ away.
      check: step.kind === 'mini' || step.diagram || test ? null : checkOf(state.fen),
      shapes: [...(step.shapes ?? []), ...state.feedbackShapes],
      stars: state.stars,
      text: t(step.text),
      feedback: !finished && state.feedback ? { tone: state.feedback.tone, text: t(state.feedback.text) } : null,
      choices: finished ? [] : choices,
      movesUsed: state.movesUsed,
      maxMoves: step.kind === 'collect' ? (step.maxMoves ?? null) : null,
      canNext: !finished && canNext,
      canRetry: !finished && !test && (phase === 'wrong' || (phase === 'task' && state.movesUsed > 0)),
      canBack: !finished && !test && index > 0,
      outro: finished ? t(tv && !tv.passed ? test!.failOutro : lesson.outro) : null,
      practice: finished && (!tv || tv.passed) ? (lesson.practice ?? []) : [],
      mini: finished ? null : mini,
      test: tv,
    };
  };

  /** Level tests: one attempt — the first answer is final, right or wrong (then explained). */
  const settleTest = (step: LessonStep, prev: StepState, next: StepState): StepState => {
    if (!test || next === prev || step.kind === 'show') return next;
    if (next.phase === 'stepDone') {
      results.set(index, true);
      return next;
    }
    const wrongChoice = step.kind === 'choose' && next.feedback?.tone === 'bad';
    if (next.phase !== 'wrong' && !wrongChoice) return next; // e.g. a collect move on the way
    results.set(index, false);
    if (step.kind === 'choose') {
      const choiceState = { ...next.choiceState };
      for (const c of step.correct) choiceState[c] = 'correct';
      return { ...next, phase: 'stepDone', choiceState, feedback: { tone: 'bad', text: `Tohle ne. ${step.explain}` } };
    }
    const solution: Shape[] =
      step.kind === 'move' ? [{ from: step.accept[0].slice(0, 2) as Square, to: step.accept[0].slice(2, 4) as Square, brush: 'green' }] : [];
    const why = next.feedback?.text ?? '';
    return { ...next, phase: 'stepDone', feedback: { tone: 'bad', text: `Tohle ne. ${why}`.trim() }, feedbackShapes: [...next.feedbackShapes, ...solution] };
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
        if (index === 0 || test) break;
        finished = false;
        index--;
        state = initStep(lesson.steps[index]);
        break;
      case 'retry':
        if (finished || test) break;
        state = initStep(step);
        break;
      case 'restart':
        index = 0;
        finished = false;
        results = new Map();
        state = initStep(lesson.steps[0]);
        break;
      case 'move':
        if (state.phase !== 'task' || finished) break;
        if (step.kind === 'move') state = settleTest(step, state, onMove(step, state, input.from, input.to, input.promotion));
        else if (step.kind === 'collect') state = settleTest(step, state, onCollect(step, state, input.from, input.to));
        else if (step.kind === 'mini') state = onMiniMove(step, state, input.from, input.to);
        break;
      case 'reply':
        if (step.kind === 'mini' && !finished) state = onMiniReply(step, state, random);
        break;
      case 'square':
        if (step.kind !== 'choose' || state.phase !== 'task' || finished) break;
        {
          const option = step.options.find((o) => o.square === input.square);
          if (option) state = settleTest(step, state, onChoose(step, state, option.id));
        }
        break;
      case 'choose':
        if (step.kind !== 'choose' || state.phase !== 'task' || finished) break;
        state = settleTest(step, state, onChoose(step, state, input.id));
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
      if (index === 0) results = new Map();
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
    feedback: null,
    feedbackShapes: [],
    stars: step.kind === 'collect' ? [...step.stars] : [...(step.stars ?? [])],
    movesUsed: 0,
    choiceState: {},
    mini: step.kind === 'mini' ? { awaiting: false, result: null } : null,
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
  const why = explainWrongMove(state.fen, from, to, promo, step, step.completeness);
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
 * king attacked afterwards) → stalemate → (mate tasks) check but not mate, with the
 * defence as an arrow → the moved piece can be taken → the step's `wrongDefault`.
 */
export function explainWrongMove(
  fen: string,
  from: Square,
  to: Square,
  promotion: PieceType | undefined,
  step: Pick<MoveStep, 'wrong' | 'wrongDefault'>,
  completeness?: Completeness,
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
  if (chess.isStalemate()) {
    return { text: 'Pozor, to je pat! Soupeř nemá žádný tah a není v šachu. To je remíza.', shapes: [] };
  }
  if (completeness?.kind === 'mate' && chess.inCheck()) {
    const replies = chess.moves({ verbose: true });
    const save = replies.find((m) => m.captured) ?? replies.find((m) => m.piece === 'k') ?? replies[0];
    return { text: 'To je šach, ale ne mat. Soupeř se ještě zachrání, podívej se na šipku.', shapes: save ? [{ from: save.from, to: save.to, brush: 'red' }] : [] };
  }
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

// --- mini-games ----------------------------------------------------------------------

function otherColor(c: Color): Color {
  return c === 'w' ? 'b' : 'w';
}

function onMiniMove(step: MiniStep, state: StepState, from: Square, to: Square): StepState {
  if (!state.mini || state.mini.awaiting || state.mini.result) return state;
  const board = parsePlacement(state.fen);
  const child = turnOf(step.fen);
  if (board.get(from)?.color !== child || !pseudoTargets(board, from).includes(to)) return state;
  const next = moved(board, from, to);
  const after: StepState = {
    ...state,
    fen: `${placementOf(next)} ${otherColor(child)} - - 0 1`,
    lastMove: [from, to],
    movesUsed: state.movesUsed + 1,
    feedback: null,
    feedbackShapes: [],
    mini: { awaiting: true, result: null },
  };
  const outcome = miniOutcome(step.goal, next, child, child);
  return outcome ? finishMini(step, after, outcome, otherColor(child)) : after;
}

function onMiniReply(step: MiniStep, state: StepState, random: () => number): StepState {
  if (!state.mini?.awaiting || state.mini.result) return state;
  const child = turnOf(step.fen);
  const engine = otherColor(child);
  const board = parsePlacement(state.fen);
  const reply = pickReply(step.goal, board, engine, step.engineLevel, random);
  if (!reply) {
    // Only in „seber všechny pěšce“ (pěšcová válka ends as a draw before this): the pawns pass.
    return {
      ...state,
      fen: `${placementOf(board)} ${child} - - 0 1`,
      mini: { awaiting: false, result: null },
      feedback: { tone: 'info', text: 'Soupeř nemůže táhnout. Hraješ znovu ty.' },
    };
  }
  const next = moved(board, reply[0], reply[1]);
  const after: StepState = { ...state, fen: `${placementOf(next)} ${child} - - 0 1`, lastMove: reply, mini: { awaiting: false, result: null }, feedback: null };
  const outcome = miniOutcome(step.goal, next, engine, child);
  if (!outcome) return after;
  return finishMini(step, after, outcome, child, board.get(reply[1])?.type);
}

/** `blocked` = the side to move next (the one without a move in a draw); `taken` = what the last move took. */
function finishMini(step: MiniStep, state: StepState, outcome: MiniResult, blocked: Color, taken?: PieceType): StepState {
  const mini = { awaiting: false, result: outcome };
  if (outcome.result === 'won') {
    const text = step.success ?? (outcome.reason === 'promoted' ? 'Tvůj pěšec doběhl na konec. Vyhráváš!' : 'Soupeři nezbyl žádný pěšec. Vyhráváš!');
    return { ...state, phase: 'stepDone', mini, feedback: { tone: 'good', text } };
  }
  let text: string;
  if (outcome.result === 'draw') text = blocked === turnOf(step.fen) ? 'Nemáš žádný tah. Je to remíza.' : 'Soupeř nemá žádný tah. Je to remíza.';
  else if (outcome.reason === 'piece-taken') text = `Pěšec ti vzal ${PIECE_NAMES[taken && taken !== 'p' ? taken : 'q'].acc}. Tentokrát vyhrál soupeř.`;
  else if (outcome.reason === 'promoted') text = 'Soupeřův pěšec doběhl na konec. Tentokrát vyhrál soupeř.';
  else text = 'Nezbyl ti žádný pěšec. Tentokrát vyhrál soupeř.';
  return { ...state, phase: 'wrong', mini, feedback: { tone: 'bad', text: `${text} Zkus to znovu!` } };
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

/** The side in check in a full, legal FEN (null for kingless or broken positions). */
function checkOf(fen: string): BoardColor | null {
  try {
    const chess = new Chess(fen);
    return chess.inCheck() ? boardColor(chess.turn()) : null;
  } catch {
    return null;
  }
}

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
