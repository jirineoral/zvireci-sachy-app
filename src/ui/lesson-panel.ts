/**
 * Lesson panel (Phase 21a): sits under the status line while a lesson runs (like the
 * puzzle/endgame panels). Title, step x/y, the teacher's avatar and bubble, feedback,
 * answer buttons, and Zpět / Zkusit znovu / Dál / Tohle umím / Zpět do lekcí / Zpět do hry;
 * at the end the outro, practice pointers and the next lesson.
 *
 * The panel owns the lesson runner; the board is an adapter handed in with the lesson
 * (`LessonBoard`, src/ui/lesson-board.ts). The glue forwards the board's events to
 * `input()`. Everything else goes out through callbacks — no global state, no storage:
 * progress is the caller's (src/lessons/progress.ts). All text via textContent.
 */
import '../styles/lessons.css';
import { lessonAfter } from '../lessons/course';
import { createLessonRunner, needsPromotion, renderToBoard, type LessonBoard, type LessonInput, type LessonRunner, type LessonView } from '../lessons/runner';
import { animalSingular, type TextContext } from '../lessons/text';
import type { Lesson, PieceType, PracticePointer } from '../lessons/types';
import type { Teacher } from '../lessons/progress';

export interface TeacherInfo {
  name: string;
  /** Same-origin image URL (the animal's king), or null for the emoji placeholder. */
  image: string | null;
  emoji: string;
}

/** The owl has no drawing yet (B9): an emoji in a circle. */
export const OWL: TeacherInfo = { name: 'Sova', image: null, emoji: '🦉' };

/**
 * The teacher to show. `animalId` is the child's library character (null for classic /
 * own sets — then the owl teaches even if 'animal' was chosen); `image` resolves its picture.
 */
export function teacherInfo(teacher: Teacher, animalId: string | null, image: (id: string) => string | null): TeacherInfo {
  if (teacher !== 'animal' || animalId === null) return OWL;
  const name = animalSingular(animalId);
  return { name: name[0].toUpperCase() + name.slice(1), image: image(animalId), emoji: '🐾' };
}

export interface LessonPanelDeps {
  container: HTMLElement;
  /** The teacher (re-read on every start, so a change in the course map applies). */
  teacher: () => TeacherInfo;
  /** Which piece a promoting pawn becomes; null = cancelled. Absent → always a queen. */
  askPromotion?: (color: 'w' | 'b') => Promise<PieceType | null>;
  /** The last step was finished: mark the lesson done. */
  onLessonDone: (lesson: Lesson) => void;
  /** „Tohle umím“: mark done; the panel then calls `onBackToMap`. */
  onKnowIt: (lesson: Lesson) => void;
  /** „Zpět do lekcí“ (and after „Tohle umím“): show the course map. */
  onBackToMap: () => void;
  /** „Zpět do hry“: leave lessons (the caller restores the game board). */
  onLeave: () => void;
  /** A practice pointer at the end of the lesson was chosen. */
  onPractice: (pointer: PracticePointer) => void;
  /** „Další lekce“ at the end: the caller starts it (usually `panel.start(next, …)`). */
  onNextLesson: (lesson: Lesson) => void;
}

export interface LessonPanel {
  /** Shows the panel and runs the lesson on the given board. */
  start: (lesson: Lesson, board: LessonBoard, ctx: TextContext) => void;
  /** Board events from the adapter's handlers. */
  input: (event: LessonInput) => void;
  /** Hides the panel and forgets the lesson (does not touch the board). */
  close: () => void;
  readonly current: Lesson | null;
}

export function buildLessonPanel(deps: LessonPanelDeps): LessonPanel {
  const { container } = deps;
  container.replaceChildren();
  container.classList.add('lesson-panel');
  container.hidden = true;

  const title = el('div', '', 'lesson-title');
  const stepInfo = el('div', '', 'lesson-step');
  const head = el('div', '', 'lesson-head');
  head.append(title, stepInfo);

  const avatar = el('div', '', 'lesson-avatar');
  avatar.setAttribute('aria-hidden', 'true');
  const teacherName = el('div', '', 'lesson-teacher-name');
  const who = el('div', '', 'lesson-who');
  who.append(avatar, teacherName);
  const bubbleText = el('p', '', 'lesson-text');
  const feedback = el('p', '', 'lesson-feedback');
  feedback.setAttribute('role', 'status');
  const counter = el('p', '', 'lesson-counter');
  const bubble = el('div', '', 'lesson-bubble');
  bubble.append(bubbleText, feedback, counter);
  const teacherRow = el('div', '', 'lesson-teacher');
  teacherRow.append(who, bubble);

  const choices = el('div', '', 'lesson-choices');
  const practice = el('div', '', 'lesson-practice');

  const backStepBtn = button('◀ Zpět', 'lesson-prev');
  backStepBtn.setAttribute('aria-label', 'Předchozí krok');
  const retryBtn = button('Zkusit znovu', 'lesson-retry');
  const nextBtn = button('Dál ▶', 'lesson-next');
  const knowBtn = button('Tohle umím', 'lesson-know');
  const mapBtn = button('Zpět do lekcí', 'lesson-map');
  const leaveBtn = button('Zpět do hry', 'lesson-leave');
  const actions = el('div', '', 'lesson-actions');
  actions.append(backStepBtn, retryBtn, nextBtn);
  const secondary = el('div', '', 'lesson-actions lesson-actions-secondary');
  secondary.append(knowBtn, mapBtn, leaveBtn);

  container.append(head, teacherRow, choices, practice, actions, secondary);

  let lesson: Lesson | null = null;
  let runner: LessonRunner | null = null;
  let board: LessonBoard | null = null;
  let doneReported = false;
  let busy = false; // a promotion question is open

  const render = (view: LessonView): void => {
    if (!lesson || !board) return;
    renderToBoard(board, view);
    title.textContent = `Lekce ${lesson.number}: ${lesson.title}`;
    const finished = view.phase === 'lessonDone';
    stepInfo.textContent = finished ? 'Hotovo!' : `Krok ${view.stepIndex + 1} z ${view.stepCount}`;
    bubbleText.textContent = finished ? (view.outro ?? '') : view.text;
    feedback.textContent = view.feedback?.text ?? '';
    feedback.className = `lesson-feedback${view.feedback ? ` is-${view.feedback.tone}` : ''}`;
    counter.textContent =
      view.stepKind === 'collect' && !finished
        ? `Hvězdy: ${view.stars.length === 0 ? 'všechny snědené' : `zbývá ${view.stars.length}`}${view.maxMoves !== null ? ` · tahy ${view.movesUsed} z ${view.maxMoves}` : ''}`
        : '';
    counter.hidden = counter.textContent === '';

    choices.replaceChildren(
      ...view.choices
        .filter((c) => c.label !== undefined)
        .map((c) => {
          const b = button(c.label!, `lesson-choice is-${c.state}`);
          b.disabled = view.phase !== 'task' || c.state === 'wrong';
          b.addEventListener('click', () => dispatch({ type: 'choose', id: c.id }));
          return b;
        }),
    );
    choices.hidden = choices.childElementCount === 0;

    const next = finished ? lessonAfter(lesson.id) : null;
    practice.replaceChildren(
      ...view.practice.map((p) => {
        const b = button(p.label, 'lesson-practice-btn');
        b.addEventListener('click', () => deps.onPractice(p));
        return b;
      }),
      ...(next
        ? [
            (() => {
              const b = button(`Další lekce: ${next.title} ▶`, 'lesson-next-lesson');
              b.addEventListener('click', () => deps.onNextLesson(next));
              return b;
            })(),
          ]
        : []),
    );
    practice.hidden = practice.childElementCount === 0;

    backStepBtn.hidden = finished;
    backStepBtn.disabled = !view.canBack;
    retryBtn.hidden = !view.canRetry;
    nextBtn.hidden = finished;
    nextBtn.disabled = !view.canNext;
    nextBtn.textContent = view.stepIndex === view.stepCount - 1 && view.canNext ? 'Dokončit ✓' : 'Dál ▶';
    knowBtn.hidden = finished;

    if (finished && !doneReported) {
      doneReported = true;
      deps.onLessonDone(lesson);
    }
  };

  const dispatch = (event: LessonInput): void => {
    if (!runner || busy) return;
    const before = runner.view;
    const after = runner.dispatch(event);
    // A no-op click must not reset the board's selection; a refused move must snap back.
    if (after !== before || event.type === 'move') render(after);
  };

  const input = (event: LessonInput): void => {
    if (!runner || busy) return;
    if (event.type === 'move' && event.promotion === undefined && deps.askPromotion && needsPromotion(runner.view, event.from, event.to)) {
      const color = runner.view.turnColor === 'white' ? 'w' : 'b';
      busy = true;
      void deps
        .askPromotion(color)
        .then((piece) => {
          busy = false;
          if (piece === null) render(runner!.view); // cancelled: snap the pawn back
          else dispatch({ ...event, promotion: piece });
        })
        .catch((err: unknown) => {
          busy = false;
          console.error('Promotion prompt failed', err);
          render(runner!.view);
        });
      return;
    }
    dispatch(event);
  };

  backStepBtn.addEventListener('click', () => dispatch({ type: 'back' }));
  retryBtn.addEventListener('click', () => dispatch({ type: 'retry' }));
  nextBtn.addEventListener('click', () => dispatch({ type: 'next' }));
  knowBtn.addEventListener('click', () => {
    if (!lesson) return;
    deps.onKnowIt(lesson);
    deps.onBackToMap();
  });
  mapBtn.addEventListener('click', () => deps.onBackToMap());
  leaveBtn.addEventListener('click', () => {
    close();
    deps.onLeave();
  });

  const close = (): void => {
    container.hidden = true;
    lesson = null;
    runner = null;
    board = null;
  };

  return {
    start(l: Lesson, b: LessonBoard, ctx: TextContext): void {
      lesson = l;
      board = b;
      runner = createLessonRunner(l, ctx);
      doneReported = false;
      busy = false;
      const t = deps.teacher();
      teacherName.textContent = t.name;
      avatar.replaceChildren();
      if (t.image) {
        const img = document.createElement('img');
        img.src = t.image;
        img.alt = '';
        img.width = 56;
        img.height = 56;
        img.decoding = 'async';
        avatar.append(img);
      } else {
        avatar.textContent = t.emoji;
      }
      container.hidden = false;
      render(runner.view);
    },
    input,
    close,
    get current() {
      return lesson;
    },
  };
}

function el(tag: string, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = className;
  return b;
}
