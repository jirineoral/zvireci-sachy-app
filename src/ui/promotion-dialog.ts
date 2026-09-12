import type { Color } from 'chess.js';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const CHOICES: ReadonlyArray<{ piece: PromotionPiece; role: string; label: string }> = [
  { piece: 'q', role: 'queen', label: 'Dáma' },
  { piece: 'r', role: 'rook', label: 'Věž' },
  { piece: 'b', role: 'bishop', label: 'Střelec' },
  { piece: 'n', role: 'knight', label: 'Jezdec' },
];

/**
 * Opens the modal promotion picker for the given side and resolves with the chosen
 * piece, or `null` when the dialog is dismissed (Escape, "Zrušit"). The rest of the page
 * is inert while it is open. The piece images come from the active piece set: the
 * buttons live inside a `.cg-wrap` so the same CSS applies as on the board.
 */
export function promptPromotion(
  dialog: HTMLDialogElement,
  color: Color,
): Promise<PromotionPiece | null> {
  return new Promise((resolve) => {
    const colorClass = color === 'w' ? 'white' : 'black';

    const pieces = document.createElement('div');
    pieces.className = 'cg-wrap promotion-pieces';
    for (const choice of CHOICES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'promotion-choice';
      button.dataset.piece = choice.piece;
      button.setAttribute('aria-label', choice.label);
      const piece = document.createElement('piece');
      piece.className = `${colorClass} ${choice.role}`;
      button.appendChild(piece);
      pieces.appendChild(button);
    }

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'promotion-cancel';
    cancel.textContent = 'Zrušit';

    const title = document.createElement('p');
    title.className = 'promotion-title';
    title.textContent = 'Proměna pěšce';

    dialog.replaceChildren(title, pieces, cancel);

    let choice: PromotionPiece | null = null;

    const onClick = (event: Event): void => {
      const button = (event.target as Element).closest<HTMLButtonElement>('.promotion-choice');
      if (!button) return;
      choice = button.dataset.piece as PromotionPiece;
      dialog.close();
    };
    const onCancelClick = (): void => dialog.close();
    const onClose = (): void => {
      pieces.removeEventListener('click', onClick);
      cancel.removeEventListener('click', onCancelClick);
      dialog.removeEventListener('close', onClose);
      dialog.replaceChildren();
      resolve(choice);
    };

    pieces.addEventListener('click', onClick);
    cancel.addEventListener('click', onCancelClick);
    dialog.addEventListener('close', onClose);

    dialog.showModal();
    pieces.querySelector<HTMLButtonElement>('button')?.focus();
  });
}
