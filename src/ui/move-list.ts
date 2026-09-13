import { GLYPH_CLASS, GLYPH_LABEL, type Glyph } from '../feedback';

/**
 * Renders SAN move history as numbered rows and keeps the newest row in view.
 * `glyphs[i]` (optional) is the feedback glyph for ply i, shown after its SAN.
 */
export function renderMoveList(el: HTMLElement, sanMoves: string[], glyphs: ReadonlyArray<Glyph | null> = []): void {
  el.replaceChildren();

  const cell = (ply: number): HTMLSpanElement => {
    const span = document.createElement('span');
    const san = sanMoves[ply];
    if (san === undefined) return span;
    span.append(san);
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

  el.scrollTop = el.scrollHeight;
}
