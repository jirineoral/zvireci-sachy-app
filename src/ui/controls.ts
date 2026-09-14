import { DIFFICULTIES, type DifficultyLevel } from '../difficulty';

export interface ControlsElements {
  difficulty: HTMLSelectElement;
  feedback: HTMLSelectElement;
  undo: HTMLButtonElement;
}

export interface ControlsState {
  difficulty: DifficultyLevel;
  /** Campaign: the strength comes from elsewhere; the select only shows the nearest level. */
  difficultyLocked: boolean;
  feedbackEnabled: boolean;
  undoEnabled: boolean;
  /** Greys the selects while the promotion dialog is open. */
  disabled: boolean;
}

/** Fills the <select>s once from the data tables. */
export function populateControls(els: ControlsElements): void {
  setDifficultyLabels(els.difficulty, null);
  els.feedback.replaceChildren(new Option('zapnuto', 'on'), new Option('vypnuto', 'off'));
}

/**
 * Relabels the levels after the player's character (`labels[i]` = level i + 1; a level
 * beyond the character's list — the 7th, Velmistr — keeps the ladder's own name);
 * null restores the ladder's own names. The values (levels) never change.
 */
export function setDifficultyLabels(select: HTMLSelectElement, labels: readonly string[] | null): void {
  const current = select.value;
  select.replaceChildren(
    ...DIFFICULTIES.map((d) => new Option(labels?.[d.level - 1] ? `${d.level} · ${labels[d.level - 1]}` : d.label, String(d.level))),
  );
  if (current) select.value = current;
}

export function renderControls(els: ControlsElements, state: ControlsState): void {
  els.difficulty.value = String(state.difficulty);
  els.feedback.value = state.feedbackEnabled ? 'on' : 'off';
  els.difficulty.disabled = state.disabled || state.difficultyLocked;
  els.difficulty.title = state.difficultyLocked ? 'Obtížnost řídí kampaň' : '';
  els.feedback.disabled = state.disabled;
  els.undo.disabled = !state.undoEnabled;
}
