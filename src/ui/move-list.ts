import { GLYPH_CLASS, GLYPH_LABEL, type Glyph } from '../feedback';

/**
 * Renders SAN move history as numbered rows and keeps the newest row in view.
 * `glyphs[i]` (optional) is the feedback glyph for ply i, shown after its SAN.
 * `currentPly` (review) highlights the move that led to the shown position (ply index
 * `currentPly - 1`) and scrolls it into view instead of the newest row.
 */
export function renderMoveList(
  el: HTMLElement,
  sanMoves: string[],
  glyphs: ReadonlyArray<Glyph | null> = [],
  currentPly: number | null = null,
): void {
  el.replaceChildren();
  let current: HTMLElement | null = null;

  const cell = (ply: number): HTMLSpanElement => {
    const span = document.createElement('span');
    const san = sanMoves[ply];
    if (san === undefined) return span;
    span.append(san);
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

  for (let i = 0; i < sanMoves.length; i += 2) {
    const row = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'move-number';
    number.textContent = `${i / 2 + 1}.`;
    row.append(number, cell(i), cell(i + 1));
    el.appendChild(row);
  }

  if (current) (current as HTMLElement).scrollIntoView({ block: 'nearest' });
  else el.scrollTop = el.scrollHeight;
}
