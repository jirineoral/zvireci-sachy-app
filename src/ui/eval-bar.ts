/**
 * Eval bar beside the board (Phase 9): white's share of the bar from the centipawn eval
 * (white POV), with the number as text. Mate scores (|cp| ≥ 9000, mate-normalised) show as
 * "M<n>". The bar follows the board's orientation so white's share sits at the bottom
 * when white is at the bottom.
 */
import { MATE_SCORE } from '../engine';
import { requireElement } from './dom';

export interface EvalBarView {
  visible: boolean;
  /** White-POV centipawns, or null when the position is not analysed. */
  cp: number | null;
  orientation: 'white' | 'black';
}

/** 0–1 share for white; logistic on 400 cp, clamped so both colours stay visible. */
export function whiteShare(cp: number): number {
  const p = 1 / (1 + Math.pow(10, -cp / 400));
  return Math.min(0.95, Math.max(0.05, p));
}

export function evalText(cp: number): string {
  const mateIn = MATE_SCORE - Math.abs(cp);
  if (mateIn <= 1000) return `${cp < 0 ? '−' : ''}M${mateIn}`;
  const pawns = cp / 100;
  return `${pawns > 0 ? '+' : pawns < 0 ? '−' : ''}${Math.abs(pawns).toFixed(1)}`;
}

export function renderEvalBar(el: HTMLElement, view: EvalBarView): void {
  el.hidden = !view.visible;
  if (!view.visible || view.cp === null) return;
  const fill = requireElement<HTMLElement>(el, '.eval-fill');
  const label = requireElement<HTMLElement>(el, '.eval-text');
  const share = whiteShare(view.cp);
  fill.style.height = `${(share * 100).toFixed(1)}%`;
  el.classList.toggle('flipped', view.orientation === 'black');
  label.textContent = evalText(view.cp);
  label.classList.toggle('on-white', view.cp >= 0);
}
