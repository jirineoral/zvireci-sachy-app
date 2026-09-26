/**
 * Lessons: the course — levels in order, each with its lessons (docs/phase-21-plan.md,
 * decision 1). 21a ships level 1, lessons 1–7; the rest of level 1 is 21b, level 2 is 21c.
 */
import { LEVEL1 } from './level1';
import { LEVEL2 } from './level2';
import { LEVEL5 } from './level5';
import type { CourseLevel, Lesson } from './types';

export const COURSE: readonly CourseLevel[] = [
  { level: 1, title: 'Úplný začátečník', lessons: LEVEL1 },
  { level: 2, title: 'Začátečník', lessons: LEVEL2 },
  { level: 5, title: 'Pokročilý', lessons: LEVEL5 },
];

export function allLessons(): Lesson[] {
  return COURSE.flatMap((l) => [...l.lessons]);
}

export function findLesson(id: string): Lesson | null {
  return allLessons().find((l) => l.id === id) ?? null;
}

/** The lesson after `id` in course order, or null at the end. */
export function lessonAfter(id: string): Lesson | null {
  const all = allLessons();
  const i = all.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < all.length ? all[i + 1] : null;
}
