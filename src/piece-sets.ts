/**
 * Piece sets as data. Reads `public/piece-sets/sets.json`, swaps the set stylesheet
 * (a <link> appended after the bundled CSS, so the set's rules win) and sets the board
 * colours on the chessground wrapper. Pure view state: nothing here touches the game,
 * the board bridge or the engine.
 *
 * Fallbacks: a missing/invalid manifest or a stylesheet that fails to load leaves the
 * bundled cburnett styling (src/styles/pieces.css) in place, so the board stays playable.
 * The `cburnett` entry itself is the built-in set (`"stylesheet": null`): selecting it
 * removes the set <link>.
 */

export interface PieceSet {
  id: string;
  name: string;
  pair: string;
  board: { light: string; dark: string };
  /** Absolute stylesheet URL, or null for the built-in bundled styling. */
  stylesheet: string | null;
}

export interface PieceSetManager {
  /** Empty when the manifest could not be loaded. */
  readonly sets: readonly PieceSet[];
  /** Null when running on the built-in fallback without a manifest. */
  readonly currentId: string | null;
  select(id: string): void;
}

export interface PieceSetOptions {
  baseUrl: string;
  /** The chessground wrapper (`.cg-wrap`) that carries --board-light / --board-dark. */
  boardEl: HTMLElement;
  storage: Storage | null;
}

export const PIECE_SET_STORAGE_KEY = 'skm.pieceSetId';
const LINK_ATTR = 'data-piece-set';
const ID_PATTERN = /^[a-z0-9-]+$/;

export async function initPieceSets(opts: PieceSetOptions): Promise<PieceSetManager> {
  const sets = await loadManifest(opts.baseUrl);
  let currentId: string | null = null;

  const apply = (set: PieceSet): void => {
    currentId = set.id;
    applyStylesheet(set);
    opts.boardEl.style.setProperty('--board-light', set.board.light);
    opts.boardEl.style.setProperty('--board-dark', set.board.dark);
  };

  if (sets.length > 0) {
    const storedId = readStored(opts.storage);
    const initial = sets.find((s) => s.id === storedId);
    if (storedId !== null && !initial) {
      console.warn(`Stored piece set "${storedId}" is not in sets.json; using "${sets[0].id}"`);
    }
    apply(initial ?? sets[0]);
  }

  return {
    get sets() {
      return sets;
    },
    get currentId() {
      return currentId;
    },
    select(id: string): void {
      const set = sets.find((s) => s.id === id);
      if (!set) {
        console.warn(`Unknown piece set "${id}"`);
        return;
      }
      apply(set);
      writeStored(opts.storage, id);
    },
  };
}

async function loadManifest(baseUrl: string): Promise<PieceSet[]> {
  const url = `${baseUrl}piece-sets/sets.json`;
  let raw: unknown;
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = await response.json();
  } catch (err) {
    console.error(`Piece-set manifest ${url} could not be loaded; using built-in pieces`, err);
    return [];
  }
  if (!Array.isArray(raw)) {
    console.error('Piece-set manifest is not an array; using built-in pieces');
    return [];
  }
  const sets: PieceSet[] = [];
  for (const entry of raw) {
    const set = validateEntry(entry, baseUrl);
    if (set) sets.push(set);
    else console.warn('Ignoring invalid piece-set entry', entry);
  }
  if (sets.length === 0) console.error('Piece-set manifest has no valid entries; using built-in pieces');
  return sets;
}

function validateEntry(entry: unknown, baseUrl: string): PieceSet | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const e = entry as Record<string, unknown>;
  const board = e.board as Record<string, unknown> | undefined;
  if (typeof e.id !== 'string' || !ID_PATTERN.test(e.id)) return null;
  if (typeof e.name !== 'string' || e.name.length === 0) return null;
  if (!board || typeof board.light !== 'string' || typeof board.dark !== 'string') return null;
  if ('stylesheet' in e && e.stylesheet !== null) return null; // only `null` (built-in) or absent
  return {
    id: e.id,
    name: e.name,
    pair: typeof e.pair === 'string' ? e.pair : '',
    board: { light: board.light, dark: board.dark },
    stylesheet: 'stylesheet' in e ? null : `${baseUrl}piece-sets/${e.id}/pieces.css`,
  };
}

function applyStylesheet(set: PieceSet): void {
  const previous = Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[${LINK_ATTR}]`));
  if (set.stylesheet === null) {
    for (const link of previous) link.remove(); // built-in styling shows through
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = set.stylesheet;
  link.setAttribute(LINK_ATTR, set.id);
  link.addEventListener('load', () => {
    // Swap only once the new sheet is in, so pieces never flash to "missing".
    for (const old of previous) old.remove();
  });
  link.addEventListener('error', () => {
    console.error(`Piece-set stylesheet ${set.stylesheet} failed to load; keeping previous styling`);
    link.remove();
  });
  document.head.appendChild(link);
}

function readStored(storage: Storage | null): string | null {
  try {
    return storage?.getItem(PIECE_SET_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStored(storage: Storage | null, id: string): void {
  try {
    storage?.setItem(PIECE_SET_STORAGE_KEY, id);
  } catch (err) {
    console.warn('Could not persist piece set', err);
  }
}
