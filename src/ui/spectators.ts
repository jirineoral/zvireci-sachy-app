/**
 * The two kings watching the game beside the board (Phase 5B). Each spectator is a
 * `.cg-wrap` holding a `<piece class="king white|black">`, so the active piece set
 * styles it exactly like the board and the promotion dialog. The spectator above the
 * board is the side whose pieces start at the top (follows orientation); each has a
 * speech bubble used by the review. All text goes through `textContent`.
 */
import type { Color } from 'chess.js';
import { requireElement } from './dom';

export interface SpectatorElements {
  top: HTMLElement;
  bottom: HTMLElement;
}

export type Outcome = 'win' | 'loss' | 'draw';

export interface SpectatorView {
  /** The human's colour: their king sits below the board. */
  humanColor: Color;
  bubbles: { white: string | null; black: string | null };
  /**
   * Phase 17: how the played game ended for the human, or null. Win/loss hide the
   * opponent's king (B18) and animate the human's; a draw makes both nod.
   */
  outcome: Outcome | null;
}

export function renderSpectators(els: SpectatorElements, view: SpectatorView): void {
  const bottomColor: Color = view.humanColor;
  const topColor: Color = bottomColor === 'w' ? 'b' : 'w';
  const o = view.outcome;
  const hideOpponent = o === 'win' || o === 'loss';
  renderOne(els.top, topColor, hideOpponent ? null : view.bubbles[topColor === 'w' ? 'white' : 'black'], o === 'draw' ? 'king-nod' : null, hideOpponent);
  renderOne(els.bottom, bottomColor, view.bubbles[bottomColor === 'w' ? 'white' : 'black'], o === 'win' ? 'king-jump' : o === 'loss' ? 'king-sit' : o === 'draw' ? 'king-nod' : null, false);
}

function renderOne(el: HTMLElement, color: Color, text: string | null, mood: string | null, hidden: boolean): void {
  const piece = requireElement<HTMLElement>(el, 'piece');
  const className = `king ${color === 'w' ? 'white' : 'black'}${mood ? ' ' + mood : ''}`;
  if (piece.className !== className) piece.className = className; // unchanged class = the animation keeps running
  el.classList.toggle('spectator-gone', hidden);
  const bubble = requireElement<HTMLElement>(el, '.bubble');
  if (text === null) {
    bubble.hidden = true;
    bubble.textContent = '';
    return;
  }
  if (bubble.textContent !== text) {
    // Restart the fade-in so a new line is noticed even when the bubble stays visible.
    bubble.classList.remove('bubble-in');
    bubble.textContent = text;
    void bubble.offsetWidth;
    bubble.classList.add('bubble-in');
  }
  bubble.hidden = false;
}
