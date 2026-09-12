/** Renders SAN move history as numbered rows and keeps the newest row in view. */
export function renderMoveList(el: HTMLElement, sanMoves: string[]): void {
  el.replaceChildren();

  for (let i = 0; i < sanMoves.length; i += 2) {
    const row = document.createElement('li');

    const number = document.createElement('span');
    number.className = 'move-number';
    number.textContent = `${i / 2 + 1}.`;

    const white = document.createElement('span');
    white.textContent = sanMoves[i];

    const black = document.createElement('span');
    black.textContent = sanMoves[i + 1] ?? '';

    row.append(number, white, black);
    el.appendChild(row);
  }

  el.scrollTop = el.scrollHeight;
}
