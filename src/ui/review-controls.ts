/**
 * Navigation for the post-game review: ⏮ ◀ ▶ ⏭ buttons plus ← → Home End on the keyboard
 * (ignored while a form control has focus, and entirely while the review is inactive).
 */
export interface ReviewControlElements {
  container: HTMLElement;
  first: HTMLButtonElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  last: HTMLButtonElement;
}

export interface ReviewControlHandlers {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  /** Keyboard shortcuts only fire while this returns true. */
  isActive: () => boolean;
}

export interface ReviewControlState {
  active: boolean;
  ply: number;
  plies: number;
}

export function bindReviewControls(els: ReviewControlElements, handlers: ReviewControlHandlers): void {
  els.first.addEventListener('click', handlers.onFirst);
  els.prev.addEventListener('click', handlers.onPrev);
  els.next.addEventListener('click', handlers.onNext);
  els.last.addEventListener('click', handlers.onLast);
  document.addEventListener('keydown', (event) => {
    if (!handlers.isActive()) return;
    const target = event.target;
    if (target instanceof Element && target.closest('select, input, textarea, dialog')) return;
    const actions: Record<string, () => void> = {
      ArrowLeft: handlers.onPrev,
      ArrowRight: handlers.onNext,
      Home: handlers.onFirst,
      End: handlers.onLast,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });
}

export function renderReviewControls(els: ReviewControlElements, state: ReviewControlState): void {
  els.container.hidden = !state.active;
  const atStart = state.ply <= 0;
  const atEnd = state.ply >= state.plies;
  els.first.disabled = atStart;
  els.prev.disabled = atStart;
  els.next.disabled = atEnd;
  els.last.disabled = atEnd;
}
