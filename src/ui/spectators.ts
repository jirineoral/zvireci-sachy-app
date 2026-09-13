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

export interface SpectatorView {
  /** The human's colour: their king sits below the board. */
  humanColor: Color;
  bubbles: { white: string | null; black: string | null };
}

export function renderSpectators(els: SpectatorElements, view: SpectatorView): void {
  const bottomColor: Color = view.humanColor;
  const topColor: Color = bottomColor === 'w' ? 'b' : 'w';
  renderOne(els.top, topColor, view.bubbles[topColor === 'w' ? 'white' : 'black']);
  renderOne(els.bottom, bottomColor, view.bubbles[bottomColor === 'w' ? 'white' : 'black']);
}

function renderOne(el: HTMLElement, color: Color, text: string | null): void {
  const piece = requireElement<HTMLElement>(el, 'piece');
  piece.className = `king ${color === 'w' ? 'white' : 'black'}`;
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
