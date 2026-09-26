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
  /** Shows a hint; false when none was shown (not the solver's turn). */
  hint: () => boolean;
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
    hinted = false;
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
  hintBtn.addEventListener('click', () => {
    if (deps.hint()) hinted = true;
  });
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
        setMessage(hinted ? 'Vyřešeno s nápovědou.' : attempts === 0 ? 'Vyřešeno na první pokus!' : `Vyřešeno (na ${attempts + 1}. pokus).`);
      }
    },
  };
}

/**
 * Czech names of Lichess puzzle themes, most telling first. Tags missing here (length,
 * "crushing", "master", rare mate patterns…) are not shown at all.
 */
const THEME_NAMES: readonly (readonly [string, string])[] = [
  ['mateIn1', 'mat 1. tahem'],
  ['mateIn2', 'mat 2. tahem'],
  ['mateIn3', 'mat 3. tahem'],
  ['mateIn4', 'mat 4. tahem'],
  ['mateIn5', 'mat 5. tahem'],
  ['backRankMate', 'mat na poslední řadě'],
  ['smotheredMate', 'dušený mat'],
  ['arabianMate', 'arabský mat'],
  ['anastasiaMate', 'Anastasiin mat'],
  ['mate', 'mat'],
  ['fork', 'vidlička'],
  ['pin', 'vazba'],
  ['skewer', 'rentgen'],
  ['discoveredAttack', 'odtažný útok'],
  ['discoveredCheck', 'odtažný šach'],
  ['doubleCheck', 'dvojitý šach'],
  ['hangingPiece', 'nechráněná figurka'],
  ['trappedPiece', 'chycená figurka'],
  ['sacrifice', 'oběť'],
  ['attraction', 'vlákání'],
  ['deflection', 'odlákání'],
  ['capturingDefender', 'odstranění obránce'],
  ['clearance', 'uvolnění cesty'],
  ['interference', 'přerušení'],
  ['intermezzo', 'mezitah'],
  ['quietMove', 'tichý tah'],
  ['defensiveMove', 'obranný tah'],
  ['promotion', 'proměna'],
  ['advancedPawn', 'daleko postoupený pěšec'],
  ['enPassant', 'braní mimochodem'],
  ['castling', 'rošáda'],
  ['kingsideAttack', 'útok na krále'],
  ['queensideAttack', 'útok na dámském křídle'],
  ['attackingF2F7', 'útok na f2/f7'],
  ['exposedKing', 'odkrytý král'],
  ['pawnEndgame', 'pěšcová koncovka'],
  ['rookEndgame', 'věžová koncovka'],
  ['bishopEndgame', 'střelcová koncovka'],
  ['knightEndgame', 'jezdcová koncovka'],
  ['queenEndgame', 'dámská koncovka'],
  ['queenRookEndgame', 'koncovka s dámou a věží'],
  ['endgame', 'koncovka'],
  ['middlegame', 'střední hra'],
  ['opening', 'zahájení'],
];

/** The puzzle's themes as Czech names; "mat" and "koncovka" only when nothing more exact is known. */
function themeNames(themes: readonly string[]): string[] {
  const known = THEME_NAMES.filter(([tag]) => themes.includes(tag)).map(([tag]) => tag);
  const exactMate = known.some((t) => t.startsWith('mateIn') || t.endsWith('Mate'));
  const exactEndgame = known.some((t) => t.endsWith('Endgame'));
  return THEME_NAMES.filter(([tag]) => known.includes(tag) && !(tag === 'mate' && exactMate) && !(tag === 'endgame' && exactEndgame)).map(([, name]) => name);
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
