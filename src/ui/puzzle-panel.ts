/**
 * Puzzle panel (Phase 10): band select, next / hint / back, progress line. Sits under the
 * status line while puzzle mode is active. The panel owns the loaded set and the
 * progress; the controller owns the board.
 */
import { bandCounts, loadPuzzleSet, nextPuzzle, puzzleIsPlayable, readProgress, writeProgress, PuzzleLoadError, type Puzzle, type PuzzleProgress, type PuzzleSet } from '../puzzles';

export interface PuzzlePanelDeps {
  container: HTMLElement;
  baseUrl: string;
  storage: Storage | null;
  /** Puts the puzzle on the board. */
  start: (puzzle: Puzzle) => Promise<void>;
  hint: () => void;
  /** Leaves puzzle mode (a fresh pre-game). */
  leave: () => void;
}

export interface PuzzlePanel {
  /** Opens the panel (loading the set on first use) and starts a puzzle. */
  open: () => void;
  /** Called by the controller's puzzle events. */
  onResult: (result: 'wrong' | 'correct' | 'solved') => void;
}

export function buildPuzzlePanel(deps: PuzzlePanelDeps): PuzzlePanel {
  const { container } = deps;
  container.replaceChildren();
  container.hidden = true;

  const bandSelect = document.createElement('select');
  bandSelect.className = 'puzzle-band';
  const nextBtn = button('Další úloha', 'puzzle-next');
  const hintBtn = button('Nápověda', 'puzzle-hint');
  const leaveBtn = button('Zpět do hry', 'puzzle-leave');
  const info = el('div', '', 'puzzle-info');
  const progress = el('div', '', 'puzzle-progress');
  const message = el('div', '', 'puzzle-msg');
  const row1 = document.createElement('div');
  row1.className = 'puzzle-row';
  row1.append(labelled('Obtížnost', bandSelect), nextBtn, hintBtn, leaveBtn);
  container.append(row1, info, progress, message);

  let set: PuzzleSet | null = null;
  let progressState: PuzzleProgress | null = null;
  let current: Puzzle | null = null;
  let attempts = 0;
  let loading: Promise<void> | null = null;

  const setMessage = (text: string, isError = false): void => {
    message.textContent = text;
    message.classList.toggle('us-error', isError);
  };

  const renderProgress = (): void => {
    if (!set || !progressState) return;
    const c = bandCounts(set, progressState);
    progress.textContent = `Vyřešeno ${c.solved} z ${c.total} · ${c.label}`;
    info.textContent = current ? `Úloha ${current.id} · rating ${current.rating}${current.themes.length ? ' · ' + current.themes.slice(0, 3).join(', ') : ''}` : '';
  };

  const ensureLoaded = (): Promise<void> => {
    if (set) return Promise.resolve();
    if (!loading) {
      loading = loadPuzzleSet(deps.baseUrl)
        .then((loaded) => {
          set = loaded;
          progressState = readProgress(deps.storage, loaded);
          bandSelect.replaceChildren(...loaded.bands.map((b) => new Option(`${b.label} (${b.min}–${b.max})`, b.id)));
          bandSelect.value = progressState.band;
        })
        .catch((err: unknown) => {
          loading = null;
          throw err;
        });
    }
    return loading;
  };

  const startNext = async (): Promise<void> => {
    if (!set || !progressState) return;
    let puzzle = nextPuzzle(set, progressState, current?.id ?? null);
    let guard = 0;
    while (puzzle && !puzzleIsPlayable(puzzle) && guard++ < 20) puzzle = nextPuzzle(set, progressState, puzzle.id);
    if (!puzzle) {
      setMessage('V téhle obtížnosti nejsou žádné úlohy.', true);
      return;
    }
    current = puzzle;
    attempts = 0;
    setMessage('');
    renderProgress();
    await deps.start(puzzle);
  };

  bandSelect.addEventListener('change', () => {
    if (!progressState) return;
    progressState.band = bandSelect.value;
    writeProgress(deps.storage, progressState);
    void startNext();
  });
  nextBtn.addEventListener('click', () => void startNext());
  hintBtn.addEventListener('click', () => deps.hint());
  leaveBtn.addEventListener('click', () => {
    container.hidden = true;
    current = null;
    deps.leave();
  });

  return {
    open(): void {
      container.hidden = false;
      setMessage('Načítám úlohy…');
      ensureLoaded()
        .then(() => startNext())
        .catch((err: unknown) => {
          setMessage(err instanceof PuzzleLoadError ? err.message : 'Úlohy se nepodařilo načíst.', true);
        });
    },
    onResult(result): void {
      if (!current || !set || !progressState) return;
      if (result === 'wrong') {
        attempts++;
        setMessage('');
        return;
      }
      if (result === 'solved') {
        if (!(current.id in progressState.solved)) progressState.solved[current.id] = attempts + 1;
        writeProgress(deps.storage, progressState);
        renderProgress();
        setMessage(attempts === 0 ? 'Vyřešeno na první pokus!' : `Vyřešeno (na ${attempts + 1}. pokus).`);
      }
    },
  };
}

function el(tag: string, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text: string, className: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = className;
  return b;
}

function labelled(text: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.append(text + ' ', control);
  return label;
}
