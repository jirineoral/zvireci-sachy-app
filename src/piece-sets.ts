/**
 * Piece sets as data. Reads `public/piece-sets/sets.json`, swaps the set stylesheet
 * (a <link> appended after the bundled CSS, so the set's rules win) and sets the board
 * colours on the chessground wrapper. Pure view state: nothing here touches the game,
 * the board bridge or the engine.
 *
 * Phase 5A: the player chooses a drawing style (a *family* of sets), an *animal* and a
 * colour. A family holds one set per "which animal is white" (`whiteAnimal`); the set to
 * display is resolved from (family, animal, human colour) — see `resolve()`. Families with
 * a single member cannot honour the animal choice; the caller shows the implied animal.
 *
 * Fallbacks: a missing/invalid manifest or a stylesheet that fails to load leaves the
 * bundled cburnett styling (src/styles/pieces.css) in place, so the board stays playable.
 * The `cburnett` entry itself is the built-in set (`"stylesheet": null`): selecting it
 * removes the set <link>.
 */
import type { Color } from 'chess.js';

export type Animal = 'kuzlata' | 'zabky';
export const ANIMALS: readonly Animal[] = ['kuzlata', 'zabky'];
export const ANIMAL_LABEL: Record<Animal, string> = { kuzlata: 'kůzlata', zabky: 'žáby' };

export interface PieceSet {
  id: string;
  name: string;
  /** Drawing style this set belongs to; sets of one family differ only in `whiteAnimal`. */
  family: string;
  /** Which animal the white pieces are; null for sets without animals (classic). */
  whiteAnimal: Animal | null;
  pair: string;
  board: { light: string; dark: string };
  /** Absolute stylesheet URL, or null for the built-in bundled styling. */
  stylesheet: string | null;
}

export interface PieceFamily {
  id: string;
  /** Label of the family = `name` of its first entry. */
  name: string;
  sets: readonly PieceSet[];
}

/** What the "Hraju za" control should show for the current family and colour. */
export interface AnimalChoice {
  /** False when the family has no set for the other animal (or no animals at all). */
  enabled: boolean;
  /** The animal the player actually is with the current set, or null (classic). */
  effective: Animal | null;
}

export interface PieceSetManager {
  /** Empty when the manifest could not be loaded. */
  readonly families: readonly PieceFamily[];
  /** Null when running on the built-in fallback without a manifest. */
  readonly familyId: string | null;
  readonly animal: Animal;
  readonly currentSet: PieceSet | null;
  animalChoice(): AnimalChoice;
  setFamily(id: string): void;
  setAnimal(animal: Animal): void;
  /** The colour the human plays; changes which set of the family is shown. */
  setHumanColor(color: Color): void;
}

export interface PieceSetOptions {
  baseUrl: string;
  /** The chessground wrapper (`.cg-wrap`) that carries --board-light / --board-dark. */
  boardEl: HTMLElement;
  storage: Storage | null;
  humanColor: Color;
}

export const FAMILY_STORAGE_KEY = 'skm.pieceFamily';
export const ANIMAL_STORAGE_KEY = 'skm.animal';
/** Pre-5A key; migrated to the family key once and removed. */
const LEGACY_SET_STORAGE_KEY = 'skm.pieceSetId';
const LINK_ATTR = 'data-piece-set';
const ID_PATTERN = /^[a-z0-9-]+$/;
const DEFAULT_ANIMAL: Animal = 'kuzlata';

export function otherAnimal(animal: Animal): Animal {
  return animal === 'kuzlata' ? 'zabky' : 'kuzlata';
}

/**
 * The set of `family` to show for a player who is `animal` and plays `color`: the entry
 * whose white pieces are the right animal, else the family's first entry.
 */
export function resolve(family: PieceFamily, animal: Animal, color: Color): PieceSet {
  const wantedWhite = color === 'w' ? animal : otherAnimal(animal);
  return family.sets.find((s) => s.whiteAnimal === wantedWhite) ?? family.sets[0];
}

export function animalChoiceFor(family: PieceFamily, set: PieceSet, color: Color): AnimalChoice {
  const whites = new Set(family.sets.map((s) => s.whiteAnimal).filter((a): a is Animal => a !== null));
  if (set.whiteAnimal === null) return { enabled: false, effective: null };
  const effective = color === 'w' ? set.whiteAnimal : otherAnimal(set.whiteAnimal);
  return { enabled: whites.size >= 2, effective };
}

export async function initPieceSets(opts: PieceSetOptions): Promise<PieceSetManager> {
  const families = groupFamilies(await loadManifest(opts.baseUrl));
  let familyId: string | null = null;
  let animal: Animal = readAnimal(opts.storage);
  let humanColor: Color = opts.humanColor;
  let currentSet: PieceSet | null = null;

  const family = (): PieceFamily | null => families.find((f) => f.id === familyId) ?? null;

  const apply = (): void => {
    const f = family();
    if (!f) return;
    const set = resolve(f, animal, humanColor);
    if (set === currentSet) return;
    currentSet = set;
    applyStylesheet(set);
    opts.boardEl.style.setProperty('--board-light', set.board.light);
    opts.boardEl.style.setProperty('--board-dark', set.board.dark);
  };

  if (families.length > 0) {
    const stored = readFamily(opts.storage, families);
    if (stored.legacyAnimal && !readStoredRaw(opts.storage, ANIMAL_STORAGE_KEY)) animal = stored.legacyAnimal;
    familyId = stored.familyId ?? families[0].id;
    apply();
  }

  return {
    get families() {
      return families;
    },
    get familyId() {
      return familyId;
    },
    get animal() {
      return animal;
    },
    get currentSet() {
      return currentSet;
    },
    animalChoice(): AnimalChoice {
      const f = family();
      if (!f || !currentSet) return { enabled: false, effective: null };
      return animalChoiceFor(f, currentSet, humanColor);
    },
    setFamily(id: string): void {
      if (!families.some((f) => f.id === id)) {
        console.warn(`Unknown piece-set family "${id}"`);
        return;
      }
      familyId = id;
      apply();
      writeStored(opts.storage, FAMILY_STORAGE_KEY, id);
    },
    setAnimal(next: Animal): void {
      if (!ANIMALS.includes(next)) {
        console.warn(`Unknown animal "${String(next)}"`);
        return;
      }
      animal = next;
      apply();
      writeStored(opts.storage, ANIMAL_STORAGE_KEY, next);
    },
    setHumanColor(color: Color): void {
      humanColor = color;
      apply();
    },
  };
}

function groupFamilies(sets: PieceSet[]): PieceFamily[] {
  const byId = new Map<string, PieceSet[]>();
  for (const set of sets) {
    const list = byId.get(set.family) ?? [];
    list.push(set);
    byId.set(set.family, list);
  }
  return Array.from(byId, ([id, members]) => ({ id, name: members[0].name, sets: members }));
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
  if ('family' in e && (typeof e.family !== 'string' || !ID_PATTERN.test(e.family))) return null;
  if ('whiteAnimal' in e && !isAnimal(e.whiteAnimal)) return null;
  return {
    id: e.id,
    name: e.name,
    family: typeof e.family === 'string' ? e.family : e.id,
    whiteAnimal: isAnimal(e.whiteAnimal) ? e.whiteAnimal : null,
    pair: typeof e.pair === 'string' ? e.pair : '',
    board: { light: board.light, dark: board.dark },
    stylesheet: 'stylesheet' in e ? null : `${baseUrl}piece-sets/${e.id}/pieces.css`,
  };
}

function isAnimal(value: unknown): value is Animal {
  return typeof value === 'string' && (ANIMALS as readonly string[]).includes(value);
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

/** Stored family id validated against the manifest; migrates the pre-5A `skm.pieceSetId`. */
function readFamily(
  storage: Storage | null,
  families: readonly PieceFamily[],
): { familyId: string | null; legacyAnimal: Animal | null } {
  const stored = readStoredRaw(storage, FAMILY_STORAGE_KEY);
  if (stored !== null) {
    if (families.some((f) => f.id === stored)) return { familyId: stored, legacyAnimal: null };
    console.warn(`Stored piece-set family "${stored.slice(0, 40)}" is not in sets.json; using "${families[0].id}"`);
    return { familyId: null, legacyAnimal: null };
  }
  const legacyId = readStoredRaw(storage, LEGACY_SET_STORAGE_KEY);
  if (legacyId === null) return { familyId: null, legacyAnimal: null };
  removeStored(storage, LEGACY_SET_STORAGE_KEY);
  for (const family of families) {
    const set = family.sets.find((s) => s.id === legacyId);
    if (set) {
      writeStored(storage, FAMILY_STORAGE_KEY, family.id);
      return { familyId: family.id, legacyAnimal: set.whiteAnimal };
    }
  }
  console.warn(`Stored piece set "${legacyId.slice(0, 40)}" is not in sets.json; using "${families[0].id}"`);
  return { familyId: null, legacyAnimal: null };
}

function readAnimal(storage: Storage | null): Animal {
  const stored = readStoredRaw(storage, ANIMAL_STORAGE_KEY);
  if (stored === null) return DEFAULT_ANIMAL;
  if (isAnimal(stored)) return stored;
  console.warn(`Stored animal "${stored.slice(0, 40)}" is unknown; using "${DEFAULT_ANIMAL}"`);
  return DEFAULT_ANIMAL;
}

function readStoredRaw(storage: Storage | null, key: string): string | null {
  try {
    const value = storage?.getItem(key) ?? null;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch (err) {
    console.warn(`Could not persist ${key}`, err);
  }
}

function removeStored(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // nothing to do: the legacy key simply stays behind
  }
}
