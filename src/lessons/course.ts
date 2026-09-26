/**
 * Lessons: the course — levels in order, each with its lessons (docs/phase-21-plan.md,
 * decision 1). Levels 1–2: Phase 21; levels 3–7: Phase 22.
 */
import { LEVEL1 } from './level1';
import { LEVEL2 } from './level2';
import { LEVEL3 } from './level3';
import { LEVEL4 } from './level4';
import { LEVEL5 } from './level5';
import type { CourseLevel, Lesson } from './types';

export const COURSE: readonly CourseLevel[] = [
  { level: 1, title: 'Úplný začátečník', lessons: LEVEL1 },
  { level: 2, title: 'Začátečník', lessons: LEVEL2 },
  { level: 3, title: 'Mírně pokročilý', lessons: LEVEL3 },
  // Levels 4 and 5 are partial sets (docs/phase-22-plan.md, generation order), no level test yet.
  { level: 4, title: 'Středně pokročilý', lessons: LEVEL4 },
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
