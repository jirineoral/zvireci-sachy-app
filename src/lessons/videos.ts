/**
 * Lesson video manifest: which lesson ids have an explainer video on Cloudflare R2
 * (videa.zvirecisachy.cz), served as plain files behind a `<video>` element — no CORS,
 * no cookies (public/soukromi.html has the one-sentence disclosure).
 *
 * Only lessons listed here show the "▶ Video" button (src/ui/lesson-panel.ts) — a level
 * test (e.g. `l1-zkouska`) must never get one, so it is simply left out. Add a lesson's id
 * here once its video is uploaded; `durationSec` is optional and only used for the button
 * label ("▶ Video 2:13").
 *
 * URL scheme per lesson id (both orientations always uploaded together):
 *  - `${LESSON_VIDEO_BASE_URL}/lesson-video/<id>/<id>-16x9.mp4` / `<id>-9x16.mp4`
 *  - posters: `<id>-poster-16x9.jpg` / `<id>-poster-9x16.jpg`
 */

/** Cloudflare R2 origin for lesson videos; also allow-listed in vite.config.ts's CSP (media-src, img-src). */
export const LESSON_VIDEO_BASE_URL = 'https://videa.zvirecisachy.cz';

export interface LessonVideoInfo {
  /** Video length in seconds, for the button label. Omit if unknown. */
  durationSec?: number;
}

/** Lesson id -> video info. Level 1 only for now; more levels follow as they are recorded. */
export const LESSON_VIDEOS: Readonly<Record<string, LessonVideoInfo>> = {
  'l1-sachovnice': {},
  'l1-vez': {},
  'l1-strelec': {},
  'l1-dama': {},
  'l1-kral': {},
  'l1-jezdec': {},
  'l1-pesec': {},
  'l1-promena': {},
  'l1-pescova-valka': {},
  'l1-utok-obrana': {},
  'l1-hodnota': {},
  'l1-postaveni': {},
  'l1-sach': {},
  'l1-mat': {},
  'l1-pat': {},
  'l1-rosada': {},
  'l1-mimochodem': {},
};

export function hasLessonVideo(lessonId: string): boolean {
  return Object.prototype.hasOwnProperty.call(LESSON_VIDEOS, lessonId);
}

/** Button label: "▶ Video" or "▶ Video 2:13" when the duration is known. */
export function lessonVideoLabel(lessonId: string): string | null {
  const info = LESSON_VIDEOS[lessonId];
  if (!info) return null;
  if (info.durationSec === undefined) return '▶ Video';
  const m = Math.floor(info.durationSec / 60);
  const s = info.durationSec % 60;
  return `▶ Video ${m}:${String(s).padStart(2, '0')}`;
}

/** Which orientation to play: portrait viewport (taller than wide) gets the 9:16 cut, else 16:9. */
export function videoOrientation(viewportWidth: number, viewportHeight: number): '16x9' | '9x16' {
  return viewportHeight > viewportWidth ? '9x16' : '16x9';
}

export interface LessonVideoUrls {
  src: string;
  poster: string;
}

/** Resolves the mp4/poster URLs for a lesson id at the given orientation. Caller checks `hasLessonVideo` first. */
export function lessonVideoUrls(lessonId: string, orientation: '16x9' | '9x16'): LessonVideoUrls {
  return {
    src: `${LESSON_VIDEO_BASE_URL}/lesson-video/${lessonId}/${lessonId}-${orientation}.mp4`,
    poster: `${LESSON_VIDEO_BASE_URL}/lesson-video/${lessonId}/${lessonId}-poster-${orientation}.jpg`,
  };
}
