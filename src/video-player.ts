/**
 * Lesson video player (in-app explainer clips, videa.zvirecisachy.cz): a small overlay
 * with a native `<video controls playsinline preload="none">`, its own module so the
 * lesson panel (src/ui/lesson-panel.ts) only needs one button and one call into
 * `openLessonVideo`. Never touches lesson state — no progress, no runner.
 *
 * The `<dialog>` is built lazily on first use and reused; each open swaps `src`/`poster`
 * for the requested lesson and the viewport's orientation. Closing (✕, Escape, or the
 * dialog's own `cancel`/`close`) pauses the video, clears its `src` so the browser drops
 * the network connection and decoder, and returns focus to the button that opened it.
 */
import './styles/video-player.css';
import { hasLessonVideo, lessonVideoUrls, videoOrientation } from './lessons/videos';

let dialog: HTMLDialogElement | null = null;
let video: HTMLVideoElement | null = null;
let opener: HTMLElement | null = null;

function build(): { dialog: HTMLDialogElement; video: HTMLVideoElement } {
  if (dialog && video) return { dialog, video };

  const d = document.createElement('dialog');
  d.className = 'video-player-dialog';
  d.setAttribute('aria-label', 'Video k lekci');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'video-player-close';
  closeBtn.textContent = '✕ Zavřít';
  closeBtn.addEventListener('click', () => d.close());

  const v = document.createElement('video');
  v.controls = true;
  v.playsInline = true;
  v.preload = 'none';
  v.className = 'video-player-video';

  d.append(closeBtn, v);
  d.addEventListener('close', () => {
    v.pause();
    v.removeAttribute('src');
    v.load(); // releases the network/decoder resources
    opener?.focus();
    opener = null;
  });
  // A click on the backdrop (outside the video/close button) closes too.
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });

  document.body.append(d);
  dialog = d;
  video = v;
  return { dialog: d, video: v };
}

/**
 * Opens the video overlay for `lessonId` (no-op if it has no video). `trigger` gets focus
 * back once the overlay closes. Does not start the lesson or change any progress.
 */
export function openLessonVideo(lessonId: string, trigger: HTMLElement): void {
  if (!hasLessonVideo(lessonId)) return;
  const { dialog: d, video: v } = build();
  const orientation = videoOrientation(window.innerWidth, window.innerHeight);
  const urls = lessonVideoUrls(lessonId, orientation);
  v.poster = urls.poster;
  v.src = urls.src;
  // Reserves the right box shape before the poster/metadata arrives (or if they never do).
  v.style.aspectRatio = orientation === '9x16' ? '9 / 16' : '16 / 9';
  opener = trigger;
  if (!d.open) d.showModal();
}
