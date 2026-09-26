/**
 * Puzzle panel (Phase 10): band select, next / hint / back, progress line. Sits under the
 * status line while puzzle mode is active. The panel owns the loaded set and the
 * progress; the controller owns the board.
 */
import { bandCounts, loadPuzzleSet, nextPuzzle, puzzleIsPlayable, readProgress, themeNames, themesInBand, writeProgress, PuzzleLoadError, type Puzzle, type PuzzleProgress, type PuzzleSet } from '../puzzles';

export interface PuzzlePanelDeps {
  container: HTMLElement;
  baseUrl: string;
  storage: Storage | null;
  /** Puts the puzzle on the board. */
  start: (puzzle: Puzzle) => Promise<void>;
  /** Shows a hint; false when none was shown (not the solver's turn). */
  hint: () => boolean;
  /** Leaves puzzle mode (a fresh pre-game). */
  leave: () => void;
}

/** Phase 21a: a lesson's practice pointer preselects the band and the theme. */
export interface PuzzleSelection {
  band?: string;
  /** A Lichess theme tag; null = all themes. */
  theme?: string | null;
}

export interface PuzzlePanel {
  /** Opens the panel (loading the set on first use) and starts a puzzle; `selection` preselects band/theme. */
  open: (selection?: PuzzleSelection) => void;
  /** Hides the panel without leaving (another mode took the board). */
  close: () => void;
  /** Called by the controller's puzzle events. */
  onResult: (result: 'wrong' | 'correct' | 'solved') => void;
}

export function buildPuzzlePanel(deps: PuzzlePanelDeps): PuzzlePanel {
  const { container } = deps;
  container.replaceChildren();
  container.hidden = true;

  const bandSelect = document.createElement('select');
  bandSelect.className = 'puzzle-band';
  const themeSelect = document.createElement('select');
  themeSelect.className = 'puzzle-theme';
  const nextBtn = button('Další úloha', 'puzzle-next');
  const hintBtn = button('Nápověda', 'puzzle-hint');
  const leaveBtn = button('Zpět do hry', 'puzzle-leave');
  const info = el('div', '', 'puzzle-info');
  const progress = el('div', '', 'puzzle-progress');
  const message = el('div', '', 'puzzle-msg');
  const row1 = document.createElement('div');
  row1.className = 'puzzle-row';
  row1.append(labelled('Obtížnost', bandSelect), labelled('Téma', themeSelect), nextBtn, hintBtn, leaveBtn);
  container.append(row1, info, progress, message);

  let set: PuzzleSet | null = null;
  let progressState: PuzzleProgress | null = null;
  let current: Puzzle | null = null;
  let attempts = 0;
  let hinted = false;
  let loading: Promise<void> | null = null;

  const setMessage = (text: string, isError = false): void => {
    message.textContent = text;
    message.classList.toggle('us-error', isError);
  };

  const renderProgress = (): void => {
    if (!set || !progressState) return;
    const c = bandCounts(set, progressState);
    progress.textContent = `Vyřešeno ${c.solved} z ${c.total} · ${c.label}`;
    const themes = current ? themeNames(current.themes).slice(0, 3) : [];
    info.textContent = current ? `Úloha ${current.id} · obtížnost ${current.rating}${themes.length ? ' · ' + themes.join(', ') : ''}` : '';
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
          renderThemes();
        })
        .catch((err: unknown) => {
          loading = null;
          throw err;
        });
    }
    return loading;
  };

  /** The theme select for the current band; a theme the band lacks falls back to "všechna témata". */
  const renderThemes = (): void => {
    if (!set || !progressState) return;
    const state = progressState;
    const themes = themesInBand(set, state.band);
    if (state.theme !== null && !themes.some((t) => t.tag === state.theme)) state.theme = null;
    themeSelect.replaceChildren(new Option('všechna témata', ''), ...themes.map((t) => new Option(`${t.label} (${t.count})`, t.tag)));
    themeSelect.value = state.theme ?? '';
  };

  const startNext = async (): Promise<void> => {
    if (!set || !progressState) return;
    let puzzle = nextPuzzle(set, progressState, current?.id ?? null);
    let guard = 0;
    while (puzzle && !puzzleIsPlayable(puzzle) && guard++ < 20) puzzle = nextPuzzle(set, progressState, puzzle.id);
    if (!puzzle) {
      setMessage('V téhle obtížnosti a tématu nejsou žádné úlohy.', true);
      return;
    }
    current = puzzle;
    attempts = 0;
    hinted = false;
    setMessage('');
    renderProgress();
    await deps.start(puzzle);
  };

  bandSelect.addEventListener('change', () => {
    if (!progressState) return;
    progressState.band = bandSelect.value;
    renderThemes();
    writeProgress(deps.storage, progressState);
    void startNext();
  });
  themeSelect.addEventListener('change', () => {
    if (!progressState) return;
    progressState.theme = themeSelect.value === '' ? null : themeSelect.value;
    writeProgress(deps.storage, progressState);
    void startNext();
  });
  nextBtn.addEventListener('click', () => void startNext());
  hintBtn.addEventListener('click', () => {
    if (deps.hint()) hinted = true;
  });
  leaveBtn.addEventListener('click', () => {
    container.hidden = true;
    current = null;
    deps.leave();
  });

  return {
    open(selection?: PuzzleSelection): void {
      container.hidden = false;
      setMessage('Načítám úlohy…');
      ensureLoaded()
        .then(() => {
          if (selection && set && progressState) {
            if (selection.band && set.bands.some((b) => b.id === selection.band)) progressState.band = selection.band;
            if (selection.theme !== undefined) progressState.theme = selection.theme;
            bandSelect.value = progressState.band;
            renderThemes();
            writeProgress(deps.storage, progressState);
          }
          return startNext();
        })
        .catch((err: unknown) => {
          setMessage(err instanceof PuzzleLoadError ? err.message : 'Úlohy se nepodařilo načíst.', true);
        });
    },
    close(): void {
      container.hidden = true;
      current = null;
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
        setMessage(hinted ? 'Vyřešeno s nápovědou.' : attempts === 0 ? 'Vyřešeno na první pokus!' : `Vyřešeno (na ${attempts + 1}. pokus).`);
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
