/**
 * Piece drop at game start (Phase 12 / R9): chessground's own `piece` elements rain into
 * the starting position when the child presses `Hrát!`. Web Animations API on the real
 * elements (their chessground `transform` is kept as the base, so a piece ends exactly
 * where the board has it), the far side first, ≈ 0.9 s in total; any pointer or key
 * finishes it at once. An announcement (`KŮZLATA vs. HADI`) fades over the board meanwhile.
 */

export interface DropHandle {
  /** Resolves when every piece has landed (or the drop was skipped / cancelled). */
  done: Promise<void>;
  /** Ends the drop immediately (pieces snap into place). */
  cancel: () => void;
}

export interface Announcement {
  line1: string;
  line2?: string;
}

export const PIECE_DROP_STORAGE_KEY = 'skm.pieceDrop';
const DROP_MS = 450;
const MAX_DELAY_MS = 450;
const ANNOUNCE_MS = 1100;
const REDUCED_MOTION_MS = 800;

export function readPieceDropSetting(storage: Storage | null): boolean {
  try {
    return storage?.getItem(PIECE_DROP_STORAGE_KEY) !== 'off'; // default on
  } catch {
    return true;
  }
}

export function writePieceDropSetting(storage: Storage | null, enabled: boolean): void {
  try {
    storage?.setItem(PIECE_DROP_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (err) {
    console.warn('Could not persist the piece-drop setting', err);
  }
}

/**
 * Drops every piece currently on `board` and shows `announcement` in `announceEl`.
 * Reduced motion: no piece moves; the announcement alone shows briefly.
 */
export function dropPieces(board: HTMLElement, announceEl: HTMLElement, announcement: Announcement): DropHandle {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pieces = Array.from(board.querySelectorAll<HTMLElement>('cg-board piece')).filter((p) => !p.classList.contains('ghost'));
  const height = board.getBoundingClientRect().height || 1;
  const animations: Animation[] = [];
  let settled = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  // Announcement: text in, hold, out. Its own animation so it survives a skip gracefully.
  announceEl.replaceChildren();
  const l1 = document.createElement('span');
  l1.className = 'announce-line';
  l1.textContent = announcement.line1;
  announceEl.append(l1);
  if (announcement.line2) {
    const l2 = document.createElement('span');
    l2.className = 'announce-sub';
    l2.textContent = announcement.line2;
    announceEl.append(l2);
  }
  announceEl.hidden = false;
  const announceMs = reduced ? REDUCED_MOTION_MS : ANNOUNCE_MS;
  const announceAnim = announceEl.animate(
    [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.7)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1.05)' },
    ],
    { duration: announceMs, easing: 'ease-out', fill: 'forwards' },
  );

  let timer = 0;
  const finish = (): void => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    for (const a of animations) {
      try {
        a.finish();
      } catch {
        a.cancel();
      }
    }
    announceAnim.cancel(); // a forwards-filled animation would otherwise outlive the drop
    announceEl.hidden = true;
    announceEl.replaceChildren();
    document.removeEventListener('pointerdown', finish, true);
    document.removeEventListener('keydown', finish, true);
    resolveDone();
  };

  if (!reduced) {
    for (const piece of pieces) {
      const base = piece.style.transform || '';
      const y = translateY(base);
      // Far side (top of the board) first, near side last, with a little jitter.
      const delay = Math.min(MAX_DELAY_MS, (y / height) * MAX_DELAY_MS * 0.8 + Math.random() * MAX_DELAY_MS * 0.2);
      const anim = piece.animate(
        [
          { opacity: 0, transform: `${base} translateY(-60vh) scale(0.6)` },
          { opacity: 1, transform: `${base} translateY(-40vh) scale(0.7)`, offset: 0.15, easing: 'cubic-bezier(0.4, 0, 0.8, 0.3)' },
          { opacity: 1, transform: `${base} translateY(0) scale(1)`, offset: 0.7 },
          { transform: `${base} scale(1.12, 0.86)`, offset: 0.82 },
          { transform: `${base} scale(0.97, 1.04)`, offset: 0.92 },
          { opacity: 1, transform: `${base} scale(1)` },
        ],
        { duration: DROP_MS, delay, easing: 'linear', fill: 'backwards' },
      );
      animations.push(anim);
    }
  }
  timer = window.setTimeout(finish, reduced ? REDUCED_MOTION_MS : DROP_MS + MAX_DELAY_MS + 30);
  document.addEventListener('pointerdown', finish, true);
  document.addEventListener('keydown', finish, true);

  return { done, cancel: finish };
}

/** The Y component of chessground's `translate(Xpx, Ypx)`; 0 when absent. */
function translateY(transform: string): number {
  const m = /translate\(\s*[-\d.]+px\s*,\s*([-\d.]+)px/.exec(transform);
  return m ? Number(m[1]) : 0;
}
