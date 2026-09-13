import type { GameStatus } from '../game-status';

export type EngineIndicator = 'loading' | 'ready' | 'thinking' | 'evaluating' | 'failed';

export interface StatusView {
  status: GameStatus;
  engine: EngineIndicator;
}

const ENGINE_SUFFIX: Record<EngineIndicator, string> = {
  loading: ' — načítám engine…',
  ready: '',
  thinking: ' — přemýšlím…',
  evaluating: ' — hodnotím…',
  failed: ' — engine nedostupný, hrají dva hráči',
};

/** Renders the status line (side to move / result, plus the engine state). */
export function renderStatus(el: HTMLElement, view: StatusView): void {
  el.textContent = view.status.text + ENGINE_SUFFIX[view.engine];
  el.classList.toggle('game-over', view.status.over);
}
