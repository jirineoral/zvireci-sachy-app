/**
 * Lesson panel (Phase 21a): sits under the status line while a lesson runs (like the
 * puzzle/endgame panels). Title, step x/y, the teacher's avatar and bubble, feedback,
 * answer buttons, and Krok zpět / Zkusit znovu / Dál / Tohle umím / Seznam lekcí / Konec lekcí;
 * at the end the outro, practice pointers and the next lesson.
 *
 * Phase 21b: mini-games (a scoreboard; the opponent's reply is sent after a short pause)
 * and level tests (the score while answering; at the end the result, the badge, „Diplom“
 * and „Zkusit zkoušku znovu“; no „Tohle umím“).
 *
 * The panel owns the lesson runner; the board is an adapter handed in with the lesson
 * (`LessonBoard`, src/ui/lesson-board.ts). The glue forwards the board's events to
 * `input()`. Everything else goes out through callbacks — no global state, no storage:
 * progress is the caller's (src/lessons/progress.ts). All text via textContent.
 */
import '../styles/lessons.css';
import { plural } from '../czech';
import { COURSE, lessonAfter } from '../lessons/course';
import { createLessonRunner, needsPromotion, renderToBoard, type Feedback, type LessonBoard, type LessonInput, type LessonRunner, type LessonView, type TestView } from '../lessons/runner';
import { animalSingular, type TextContext } from '../lessons/text';
import type { Lesson, PieceType, PracticePointer } from '../lessons/types';
import type { Teacher } from '../lessons/progress';
import { hasAudio, speak, stopSpeaking, voiceEnabled } from '../lessons/voice';
import { hasLessonVideo, lessonVideoLabel } from '../lessons/videos';
import { openLessonVideo } from '../video-player';

export interface TeacherInfo {
  name: string;
  /** Same-origin image URL (the animal's king), or null for the emoji placeholder. */
  image: string | null;
  emoji: string;
}

/** The owl teacher (assets/source/sovi_trenerka.png → public/lessons/sova.webp, 512 px); the emoji if the image fails. */
export const OWL: TeacherInfo = { name: 'Sova', image: `${import.meta.env.BASE_URL}lessons/sova.webp`, emoji: '🦉' };

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
  /** The last step was finished: mark the lesson done (a test: only when `result.passed`). */
  onLessonDone: (lesson: Lesson, result: TestView | null) => void;
  /** „Diplom“ after a passed test. */
  onDiploma?: (level: number) => void;
  /** „Tohle umím“: mark done; the panel then calls `onBackToMap`. */
  onKnowIt: (lesson: Lesson) => void;
  /** „Seznam lekcí“ (and after „Tohle umím“): show the course map. */
  onBackToMap: () => void;
  /** „Konec lekcí“: leave lessons (the caller restores the game board). */
  onLeave: () => void;
  /** A practice pointer at the end of the lesson was chosen. */
  onPractice: (pointer: PracticePointer) => void;
  /** „Další lekce“ at the end: the caller starts it (usually `panel.start(next, …)`). */
  onNextLesson: (lesson: Lesson) => void;
  /** Sound effects: a new feedback message just appeared ('good' → a step answered correctly, 'bad' → a wrong try). 'info' (e.g. "the opponent cannot move") stays silent. */
  onFeedback?: (tone: Feedback['tone']) => void;
  /** "Sova čte nahlas" (`skm.speak`): read the step's text aloud automatically when it appears, not just on the 🔊 button. */
  autoSpeak?: () => boolean;
  /** U1: a new step is showing; `boardTask` = the child has to act on the board (not read or tap an answer). */
  onStep?: (boardTask: boolean) => void;
}

export interface LessonPanel {
  /** Shows the panel and runs the lesson on the given board. */
  start: (lesson: Lesson, board: LessonBoard, ctx: TextContext) => void;
  /** Board events from the adapter's handlers. */
  input: (event: LessonInput) => void;
  /** Hides the panel and forgets the lesson (does not touch the board). */
  close: () => void;
  /** Re-reads `deps.teacher()` (the teacher was switched in the course map). */
  refreshTeacher: () => void;
  /** Re-renders the current step (Zvuky/Sova čte nahlas toggled elsewhere — the 🔊 button's visibility depends on both). No-op with no lesson running. */
  refresh: () => void;
  readonly current: Lesson | null;
}

export function buildLessonPanel(deps: LessonPanelDeps): LessonPanel {
  const { container } = deps;
  container.replaceChildren();
  container.classList.add('lesson-panel');
  container.hidden = true;

  const title = el('div', '', 'lesson-title');
  const stepInfo = el('div', '', 'lesson-step');
  const videoBtn = button('▶ Video', 'lesson-video-btn');
  videoBtn.hidden = true;
  videoBtn.addEventListener('click', () => {
    if (!lesson) return;
    stopSpeaking(); // the owl must not talk over the lesson video
    openLessonVideo(lesson.id, videoBtn);
  });
  const head = el('div', '', 'lesson-head');
  head.append(title, videoBtn, stepInfo);

  const avatar = el('div', '', 'lesson-avatar');
  avatar.setAttribute('aria-hidden', 'true');
  const teacherName = el('div', '', 'lesson-teacher-name');
  const who = el('div', '', 'lesson-who');
  who.append(avatar, teacherName);
  const bubbleText = el('p', '', 'lesson-text');
  // "Sova čte nahlas" (U1 pilot, level 1): hidden whenever the current text has no recorded
  // audio (other levels, a different piece set, or a dynamically composed explanation).
  const speakBtn = button('🔊 Přečíst', 'lesson-speak');
  speakBtn.hidden = true;
  const textRow = el('div', '', 'lesson-text-row');
  textRow.append(bubbleText, speakBtn);
  const feedback = el('p', '', 'lesson-feedback');
  feedback.setAttribute('role', 'status');
  const counter = el('p', '', 'lesson-counter');
  const bubble = el('div', '', 'lesson-bubble');
  bubble.append(textRow, feedback, counter);
  const teacherRow = el('div', '', 'lesson-teacher');
  teacherRow.append(who, bubble);

  const choices = el('div', '', 'lesson-choices');
  const result = el('div', '', 'lesson-result');
  result.setAttribute('role', 'status');
  const practice = el('div', '', 'lesson-practice');

  const backStepBtn = button('◀ Krok zpět', 'lesson-prev');
  backStepBtn.setAttribute('aria-label', 'Předchozí krok');
  const retryBtn = button('Zkusit znovu', 'lesson-retry');
  const nextBtn = button('Dál ▶', 'lesson-next');
  const knowBtn = button('Tohle umím', 'lesson-know');
  const mapBtn = button('Seznam lekcí', 'lesson-map');
  const leaveBtn = button('Konec lekcí', 'lesson-leave');
  const actions = el('div', '', 'lesson-actions');
  actions.append(backStepBtn, retryBtn, nextBtn);
  const secondary = el('div', '', 'lesson-actions lesson-actions-secondary');
  secondary.append(knowBtn, mapBtn, leaveBtn);

  container.append(head, teacherRow, choices, result, practice, actions, secondary);

  let lesson: Lesson | null = null;
  let runner: LessonRunner | null = null;
  let board: LessonBoard | null = null;
  let doneReported = false;
  let busy = false; // a promotion question is open
  let replyTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFeedbackSig: string | null = null; // sound: fire only when a *new* feedback message appears
  let spokenText = ''; // "sova čte nahlas": the text the 🔊 button and auto-read currently target
  let lastSpokenText: string | null = null; // stop/replay only when this text actually changes
  let lastStepSig: string | null = null; // U1: onStep fires once per step shown

  const cancelReply = (): void => {
    if (replyTimer !== null) clearTimeout(replyTimer);
    replyTimer = null;
  };

  /** Mini-game: the opponent answers after a short pause, so the child sees both moves. */
  const scheduleReply = (view: LessonView): void => {
    if (!view.mini?.thinking || replyTimer !== null) return;
    const r = runner;
    replyTimer = setTimeout(() => {
      replyTimer = null;
      if (runner === r && !busy) dispatch({ type: 'reply' });
    }, MINI_REPLY_MS);
  };

  const render = (view: LessonView): void => {
    if (!lesson || !board) return;
    renderToBoard(board, view);
    title.textContent = `Lekce ${lesson.number}: ${lesson.title}`;
    videoBtn.hidden = !hasLessonVideo(lesson.id);
    videoBtn.textContent = lessonVideoLabel(lesson.id) ?? '▶ Video';
    const finished = view.phase === 'lessonDone';
    stepInfo.textContent = finished ? 'Hotovo!' : `Krok ${view.stepIndex + 1} z ${view.stepCount}`;
    bubbleText.textContent = finished ? (view.outro ?? '') : view.text;
    feedback.textContent = view.feedback?.text ?? '';
    feedback.className = `lesson-feedback${view.feedback ? ` is-${view.feedback.tone}` : ''}`;
    const feedbackSig = view.feedback ? `${view.feedback.tone}|${view.feedback.text}` : null;
    if (feedbackSig !== null && feedbackSig !== lastFeedbackSig && view.feedback!.tone !== 'info') deps.onFeedback?.(view.feedback!.tone);
    lastFeedbackSig = feedbackSig;
    counter.textContent = finished ? '' : counterText(view);
    counter.hidden = counter.textContent === '';
    renderResult(view);

    // "Sova čte nahlas": prefer the newest feedback ('good'/'bad'), else the step/outro text.
    spokenText = !finished && view.feedback && view.feedback.tone !== 'info' ? view.feedback.text : bubbleText.textContent ?? '';
    const hasClip = spokenText !== '' && hasAudio(spokenText);
    const canSpeak = hasClip && voiceEnabled();
    speakBtn.hidden = !canSpeak; // also hidden while Zvuky is off: a silent button helps no one
    if (spokenText !== lastSpokenText) {
      lastSpokenText = spokenText;
      stopSpeaking();
      if (canSpeak && deps.autoSpeak?.()) speak(spokenText);
    }

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

    const failedTest = finished && view.test?.passed === false;
    const next = finished && !failedTest ? lessonAfter(lesson.id) : null;
    practice.replaceChildren(
      ...(finished && view.test
        ? [
            ...(view.test.passed && deps.onDiploma
              ? [
                  (() => {
                    const b = button('Diplom 🖨', 'lesson-diploma');
                    b.addEventListener('click', () => deps.onDiploma?.(lesson!.level));
                    return b;
                  })(),
                ]
              : []),
            (() => {
              const b = button('Zkusit zkoušku znovu', view.test.passed ? 'lesson-restart' : 'lesson-restart lesson-next-lesson');
              b.addEventListener('click', () => dispatch({ type: 'restart' }));
              return b;
            })(),
          ]
        : []),
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
    knowBtn.hidden = finished || lesson.test !== undefined;

    if (finished && !doneReported) {
      doneReported = true;
      deps.onLessonDone(lesson, view.test);
    }
    if (!finished) doneReported = false; // a restarted test reports again
    scheduleReply(view);
    const stepSig = `${lesson.id}:${view.stepIndex}:${finished}`;
    if (stepSig !== lastStepSig) {
      lastStepSig = stepSig;
      deps.onStep?.(!finished && view.phase === 'task' && view.stepKind !== 'show' && !view.choices.some((c) => c.label !== undefined));
    }
  };

  const renderResult = (view: LessonView): void => {
    result.replaceChildren();
    result.hidden = true;
    if (view.phase !== 'lessonDone' || !view.test || !lesson) return;
    const t = view.test;
    const levelTitle = COURSE.find((l) => l.level === lesson!.level)?.title ?? '';
    result.append(el('div', `Výsledek: ${t.correct} z ${t.total}`, 'lesson-score'));
    if (t.passed) {
      const badge = el('div', '', 'lesson-badge');
      badge.append(el('span', '🏅', 'lesson-badge-icon'), el('span', `Odznak: Úroveň ${lesson.level} · ${levelTitle}`));
      result.append(badge);
    } else {
      result.append(el('div', `Na odznak potřebuješ aspoň ${t.passScore} ${plural(t.passScore, 'správnou odpověď', 'správné odpovědi', 'správných odpovědí')}.`, 'lesson-score-note'));
    }
    result.className = `lesson-result ${t.passed ? 'is-passed' : 'is-failed'}`;
    result.hidden = false;
  };

  const dispatch = (event: LessonInput): void => {
    if (!runner || busy) return;
    if (event.type !== 'reply') cancelReply();
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

  speakBtn.addEventListener('click', () => speak(spokenText));
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

  const paintTeacher = (): void => {
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
  };

  const close = (): void => {
    cancelReply();
    stopSpeaking();
    lastSpokenText = null;
    container.hidden = true;
    lesson = null;
    runner = null;
    board = null;
  };

  return {
    start(l: Lesson, b: LessonBoard, ctx: TextContext): void {
      cancelReply();
      stopSpeaking();
      lastSpokenText = null;
      lesson = l;
      board = b;
      runner = createLessonRunner(l, ctx);
      doneReported = false;
      busy = false;
      lastStepSig = null;
      paintTeacher();
      container.hidden = false;
      render(runner.view);
    },
    input,
    close,
    refresh: () => {
      if (runner) render(runner.view);
    },
    refreshTeacher: paintTeacher,
    get current() {
      return lesson;
    },
  };
}

const MINI_REPLY_MS = 550;

/** The line under the teacher's text: stars and moves, a mini-game's score, a test's score. */
function counterText(view: LessonView): string {
  if (view.stepKind === 'collect') {
    const stars = `Hvězdy: ${view.stars.length === 0 ? 'všechny snědené' : `zbývá ${view.stars.length}`}`;
    const moves = view.maxMoves !== null ? ` · tahy ${view.movesUsed} z ${view.maxMoves}` : '';
    return `${stars}${moves}${view.test ? ` · správně ${view.test.correct} z ${view.test.answered}` : ''}`;
  }
  if (view.mini) {
    const m = view.mini;
    const score =
      m.goal === 'promote-first'
        ? `Tvoji pěšci: ${m.mine} · soupeřovi: ${m.theirs}`
        : `Zbývá sebrat: ${m.theirs} ${plural(m.theirs, 'pěšce', 'pěšce', 'pěšců')}`;
    return m.thinking ? `${score} · soupeř táhne…` : score;
  }
  if (view.test && view.test.answered > 0) return `Správně ${view.test.correct} z ${view.test.answered}`;
  return '';
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
