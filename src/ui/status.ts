import type { GameStatus } from '../game-status';

export type EngineIndicator = 'loading' | 'ready' | 'thinking' | 'evaluating' | 'failed';

export interface StatusView {
  status: GameStatus;
  engine: EngineIndicator;
  /** Set up but not started: invite the player instead of announcing whose move it is. */
  preGame?: boolean;
  /** Whole-game analysis running: "done/total". */
  analysing?: string | null;
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
  const text = view.preGame ? 'Vyber si, za koho hraješ, a dej Hrát!' : view.status.text;
  const suffix = view.analysing ? ` — analyzuji… ${view.analysing}` : ENGINE_SUFFIX[view.engine];
  el.textContent = text + suffix;
  el.classList.toggle('game-over', view.status.over);
}
