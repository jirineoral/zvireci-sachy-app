/**
 * Lessons: progress in `localStorage['skm.lessons']` (docs/phase-21-plan.md, decision 5).
 * Browser-only, no account; it can be lost and nothing is locked, so a missing or garbled
 * value simply means "nothing done yet" (garbage → defaults, like skm.puzzles/skm.endgames).
 * Unknown lesson ids are dropped on read, so a renamed or removed lesson cannot grow the value.
 */
import { allLessons } from './course';
import type { Lesson } from './types';

export type Teacher = 'owl' | 'animal';

export interface LessonProgress {
  /** Finished (or „Tohle umím“) lessons. */
  done: Record<string, true>;
  /** Passed level tests, by level id ('l1', 'l2' …) — 21b. */
  tests: Record<string, true>;
  /** Earned badges, by badge id — 21b. */
  badges: Record<string, true>;
  /** The teacher in the bubble: the owl (default) or the child's animal. */
  teacher: Teacher;
}

export const LESSONS_STORAGE_KEY = 'skm.lessons';

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const MAX_KEYS = 200;

export function defaultLessonProgress(): LessonProgress {
  return { done: {}, tests: {}, badges: {}, teacher: 'owl' };
}

export function readLessonProgress(storage: Storage | null, known: readonly Lesson[] = allLessons()): LessonProgress {
  const fallback = defaultLessonProgress();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(LESSONS_STORAGE_KEY) ?? null;
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('not an object');
    const o = v as Record<string, unknown>;
    const ids = new Set(known.map((l) => l.id));
    return {
      done: idSet(o.done, (id) => ids.has(id)),
      tests: idSet(o.tests, (id) => ID_PATTERN.test(id)),
      badges: idSet(o.badges, (id) => ID_PATTERN.test(id)),
      teacher: o.teacher === 'animal' ? 'animal' : 'owl',
    };
  } catch {
    console.warn('Stored lesson progress is unreadable; starting over');
    return fallback;
  }
}

function idSet(value: unknown, ok: (id: string) => boolean): Record<string, true> {
  const out: Record<string, true> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out;
  let n = 0;
  for (const [id, flag] of Object.entries(value as Record<string, unknown>)) {
    if (flag !== true || !ok(id)) continue;
    out[id] = true;
    if (++n >= MAX_KEYS) break;
  }
  return out;
}

export function writeLessonProgress(storage: Storage | null, progress: LessonProgress): void {
  try {
    storage?.setItem(LESSONS_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('Could not persist lesson progress', err);
  }
}

/** Marks a lesson done (finished, or „Tohle umím“) and persists. Returns the new progress. */
export function markLessonDone(storage: Storage | null, progress: LessonProgress, lessonId: string): LessonProgress {
  const next: LessonProgress = { ...progress, done: { ...progress.done, [lessonId]: true } };
  writeLessonProgress(storage, next);
  return next;
}

export function setTeacher(storage: Storage | null, progress: LessonProgress, teacher: Teacher): LessonProgress {
  const next: LessonProgress = { ...progress, teacher };
  writeLessonProgress(storage, next);
  return next;
}

/** The first lesson in course order that is not done (the one the map highlights), or null. */
export function nextLesson(progress: LessonProgress, lessons: readonly Lesson[] = allLessons()): Lesson | null {
  return lessons.find((l) => !progress.done[l.id]) ?? null;
}
