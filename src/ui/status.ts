import type { GameStatus } from '../game-status';

/** Renders the status line (side to move / result). */
export function renderStatus(el: HTMLElement, status: GameStatus): void {
  el.textContent = status.text;
  el.classList.toggle('game-over', status.over);
}
