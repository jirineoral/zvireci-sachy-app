/**
 * Course map (Phase 21a): the `Lekce` dialog. Levels → lessons with ticks, the next
 * lesson highlighted, nothing locked; „Vyber si trenéra“ (Sova by default, or the animal
 * the child plays). Renders the state it is handed; the caller owns progress and storage.
 * All text via textContent.
 */
import '../styles/lessons.css';
import { COURSE } from '../lessons/course';
import { nextLesson, type LessonProgress, type Teacher } from '../lessons/progress';
import type { Lesson } from '../lessons/types';
import type { TeacherInfo } from './lesson-panel';

export interface CourseMapDeps {
  dialog: HTMLDialogElement;
  progress: () => LessonProgress;
  /** The two teachers as they would look now; `animal` is null without a library character. */
  teachers: () => { owl: TeacherInfo; animal: TeacherInfo | null };
  /** The lesson running now (highlighted as current), or null. */
  currentLesson: () => Lesson | null;
  start: (lesson: Lesson) => void;
  /** „Tohle umím“ from the map. */
  markDone: (lesson: Lesson) => void;
  setTeacher: (teacher: Teacher) => void;
}

export interface CourseMap {
  open: () => void;
  render: () => void;
}

export function buildCourseMap(deps: CourseMapDeps): CourseMap {
  const { dialog } = deps;
  dialog.classList.add('course-map');
  dialog.replaceChildren();

  const h2 = el('h2', 'Lekce');
  const note = el('p', 'Projdi si lekce po jedné. Nic není zamčené: co už umíš, klidně přeskoč.', 'us-note');

  const teacherBox = document.createElement('fieldset');
  teacherBox.className = 'course-teacher';
  const legend = document.createElement('legend');
  legend.textContent = 'Vyber si trenéra';
  teacherBox.append(legend);
  const owlChoice = teacherChoice('owl');
  const animalChoice = teacherChoice('animal');
  const animalNote = el('span', '', 'course-teacher-note');
  teacherBox.append(owlChoice.label, animalChoice.label, animalNote);

  const levels = el('div', '', 'course-levels');
  const closeBtn = button('Zavřít', 'us-close');
  const actions = el('div', '', 'us-actions');
  actions.append(closeBtn);
  dialog.append(h2, note, teacherBox, levels, actions);

  function teacherChoice(value: Teacher): { label: HTMLLabelElement; input: HTMLInputElement; avatar: HTMLElement; name: HTMLElement } {
    const label = document.createElement('label');
    label.className = 'course-teacher-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'lesson-teacher';
    input.value = value;
    input.addEventListener('change', () => {
      if (input.checked) {
        deps.setTeacher(value);
        render();
      }
    });
    const avatar = el('span', '', 'lesson-avatar lesson-avatar-small');
    avatar.setAttribute('aria-hidden', 'true');
    const name = el('span', '', 'course-teacher-name');
    label.append(input, avatar, name);
    return { label, input, avatar, name };
  }

  const paintAvatar = (target: HTMLElement, t: TeacherInfo): void => {
    target.replaceChildren();
    if (t.image) {
      const img = document.createElement('img');
      img.src = t.image;
      img.alt = '';
      img.width = 32;
      img.height = 32;
      img.decoding = 'async';
      target.append(img);
    } else target.textContent = t.emoji;
  };

  const render = (): void => {
    const progress = deps.progress();
    const teachers = deps.teachers();
    const current = deps.currentLesson();
    const next = nextLesson(progress);

    paintAvatar(owlChoice.avatar, teachers.owl);
    owlChoice.name.textContent = `${teachers.owl.name} (výchozí)`;
    owlChoice.input.checked = progress.teacher === 'owl' || teachers.animal === null;
    if (teachers.animal) {
      paintAvatar(animalChoice.avatar, teachers.animal);
      animalChoice.name.textContent = `${teachers.animal.name} (zvířátko, za které hraješ)`;
      animalChoice.input.disabled = false;
      animalChoice.input.checked = progress.teacher === 'animal';
      animalNote.textContent = '';
    } else {
      animalChoice.avatar.textContent = '🐾';
      animalChoice.name.textContent = 'Tvoje zvířátko';
      animalChoice.input.disabled = true;
      animalChoice.input.checked = false;
      animalNote.textContent = 'Zvířátko může učit, když hraješ s figurkami Hlavy.';
    }

    levels.replaceChildren(
      ...COURSE.map((level) => {
        const section = el('section', '', 'course-level');
        const done = level.lessons.filter((l) => progress.done[l.id]).length;
        const h3 = el('h3', `Úroveň ${level.level}: ${level.title}`);
        const count = el('span', level.lessons.length ? ` · ${done} z ${level.lessons.length}` : '', 'course-count');
        h3.append(count);
        section.append(h3);
        if (level.lessons.length === 0) {
          section.append(el('p', 'Připravujeme.', 'us-note'));
          return section;
        }
        const list = el('ol', '', 'course-lessons');
        for (const lesson of level.lessons) {
          const li = document.createElement('li');
          li.className = 'course-lesson';
          const isDone = progress.done[lesson.id] === true;
          if (isDone) li.classList.add('is-done');
          if (next?.id === lesson.id) li.classList.add('is-next');
          if (current?.id === lesson.id) li.classList.add('is-current');
          const mark = el('span', isDone ? '✓' : '', 'course-mark');
          mark.setAttribute('aria-label', isDone ? 'hotovo' : '');
          const name = el('span', `${lesson.number}. ${lesson.title}`, 'course-name');
          const go = button(isDone ? 'Znovu' : next?.id === lesson.id ? 'Začít ▶' : 'Začít', 'course-start');
          go.setAttribute('aria-label', `${isDone ? 'Znovu' : 'Začít'}: ${lesson.title}`);
          go.addEventListener('click', () => {
            dialog.close();
            deps.start(lesson);
          });
          li.append(mark, name, go);
          if (!isDone) {
            const know = button('Tohle umím', 'course-know');
            know.setAttribute('aria-label', `Tohle umím: ${lesson.title}`);
            know.addEventListener('click', () => {
              deps.markDone(lesson);
              render();
            });
            li.append(know);
          }
          list.append(li);
        }
        section.append(list);
        return section;
      }),
    );
  };

  closeBtn.addEventListener('click', () => dialog.close());

  return {
    open(): void {
      render();
      if (!dialog.open) dialog.showModal();
    },
    render,
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
