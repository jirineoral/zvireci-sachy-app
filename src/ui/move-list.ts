import { GLYPH_CLASS, GLYPH_LABEL, type Glyph } from '../feedback';
import { czechSan } from '../notation';

/**
 * Renders SAN move history as numbered rows and keeps the newest row in view. Moves are
 * shown with Czech piece letters; each move is a direct `<span class="san">` child of its row.
 * `glyphs[i]` (optional) is the feedback glyph for ply i, shown after its SAN.
 * `currentPly` (review) highlights the move that led to the shown position (ply index
 * `currentPly - 1`) and scrolls it into view instead of the newest row.
 * `blackFirst`: the list starts with black's move (a puzzle, a FEN) — row one reads "1… dxc2".
 */
export function renderMoveList(
  el: HTMLElement,
  sanMoves: string[],
  glyphs: ReadonlyArray<Glyph | null> = [],
  currentPly: number | null = null,
  blackFirst = false,
): void {
  el.replaceChildren();
  let current: HTMLElement | null = null;

  const cell = (ply: number): HTMLSpanElement => {
    const span = document.createElement('span');
    const san = sanMoves[ply];
    if (san === undefined || ply < 0) return span;
    span.className = 'san';
    span.dataset.san = czechSan(san);
    span.append(czechSan(san));
    if (currentPly !== null && ply === currentPly - 1) {
      span.classList.add('current');
      current = span;
    }
    const glyph = glyphs[ply];
    if (glyph) {
      const mark = document.createElement('span');
      mark.className = `glyph glyph-${GLYPH_CLASS[glyph]}`;
      mark.textContent = glyph;
      mark.title = GLYPH_LABEL[glyph];
      span.append(mark);
    }
    return span;
  };

  // With black first, a virtual ply −1 fills the white column of the first row.
  const offset = blackFirst ? 1 : 0;
  for (let i = -offset; i < sanMoves.length; i += 2) {
    const row = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'move-number';
    number.textContent = i < 0 ? '1…' : `${(i + offset) / 2 + 1}.`;
    row.append(number, cell(i), cell(i + 1));
    el.appendChild(row);
  }

  if (current) (current as HTMLElement).scrollIntoView({ block: 'nearest' });
  else el.scrollTop = el.scrollHeight;
}
