import type { Color } from 'chess.js';
import { DIFFICULTIES, type DifficultyLevel } from '../difficulty';

export interface ControlsElements {
  difficulty: HTMLSelectElement;
  side: HTMLSelectElement;
  feedback: HTMLSelectElement;
  undo: HTMLButtonElement;
}

export interface ControlsState {
  difficulty: DifficultyLevel;
  humanColor: Color;
  feedbackEnabled: boolean;
  undoEnabled: boolean;
  /** Greys the selects while the promotion dialog is open. */
  disabled: boolean;
}

const SIDES: ReadonlyArray<{ value: Color; label: string }> = [
  { value: 'w', label: 'bílá' },
  { value: 'b', label: 'černá' },
];

/** Fills the two <select>s once from the data tables. */
export function populateControls(els: ControlsElements): void {
  els.difficulty.replaceChildren(
    ...DIFFICULTIES.map((d) => new Option(d.label, String(d.level))),
  );
  els.side.replaceChildren(...SIDES.map((s) => new Option(s.label, s.value)));
  els.feedback.replaceChildren(new Option('zapnuto', 'on'), new Option('vypnuto', 'off'));
}

export function renderControls(els: ControlsElements, state: ControlsState): void {
  els.difficulty.value = String(state.difficulty);
  els.side.value = state.humanColor;
  els.feedback.value = state.feedbackEnabled ? 'on' : 'off';
  els.difficulty.disabled = state.disabled;
  els.side.disabled = state.disabled;
  els.feedback.disabled = state.disabled;
  els.undo.disabled = !state.undoEnabled;
}
