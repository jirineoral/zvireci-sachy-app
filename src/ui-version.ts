/**
 * U1 §8.1: new defaults reach only genuinely new users. Settings are written only when the
 * player changes them, so "key absent" does not mean "new user"; the `skm.uiVersion`
 * marker records the decision once per browser:
 *
 *  - existing user (any `skm.*` localStorage key other than `skm.noAnalytics`, or any saved
 *    game in IndexedDB `games`): the values in effect so far are written for the keys whose
 *    default changed (only where absent — nothing stored is ever overwritten);
 *  - new user (none of that): the beginner defaults are written (U1 Q3, Q5).
 *
 * The code defaults themselves are unchanged, so a browser without the marker (blocked
 * storage, an IndexedDB that timed out) behaves exactly as before. Only reads IndexedDB.
 */
import { DEFAULT_DIFFICULTY } from './difficulty';
import { STORE_GAMES, transact } from './db';

export const UI_VERSION_KEY = 'skm.uiVersion';
export const UI_VERSION = '2';

/** The keys whose default differs between existing users (`old`) and new users (`fresh`). */
const DEFAULTS: readonly { key: string; old: string; fresh: string }[] = [
  { key: 'skm.color', old: 'random', fresh: 'w' },
  { key: 'skm.difficulty', old: String(DEFAULT_DIFFICULTY), fresh: '1' },
  // puzzles.ts: band = the stored one, else the second band ("lehké").
  { key: 'skm.puzzles', old: JSON.stringify({ band: 'lehke', theme: null, solved: {} }), fresh: JSON.stringify({ band: 'zacatecnik', theme: null, solved: {} }) },
];

/** Keys that do not count as "has used the app". */
const NOT_USAGE = new Set(['skm.noAnalytics', UI_VERSION_KEY]);

export type UiUser = 'known' | 'existing' | 'new' | 'unknown';

/** Synchronous part: decided from localStorage alone, or null when IndexedDB must be asked. */
export function classifyFromStorage(storage: Storage | null): UiUser | null {
  if (!storage) return 'unknown';
  try {
    if (storage.getItem(UI_VERSION_KEY) !== null) return 'known';
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('skm.') && !NOT_USAGE.has(key)) return 'existing';
    }
  } catch {
    return 'unknown';
  }
  return null;
}

/** Writes the defaults for `kind` where nothing is stored yet, then the marker. */
export function applyDefaults(storage: Storage | null, kind: 'existing' | 'new'): void {
  if (!storage) return;
  try {
    // The marker first: a write that fails halfway leaves the code defaults (the old ones)
    // in force, never a half-new state that a later visit would misread as "existing".
    storage.setItem(UI_VERSION_KEY, UI_VERSION);
    for (const d of DEFAULTS) {
      if (storage.getItem(d.key) === null) storage.setItem(d.key, kind === 'new' ? d.fresh : d.old);
    }
  } catch (err) {
    console.warn('Could not record the UI version', err);
  }
}

const IDB_WAIT_MS = 2500;

/** Any saved game? null when IndexedDB did not answer in time (undecided). */
async function hasSavedGames(): Promise<boolean | null> {
  if (typeof indexedDB === 'undefined') return false; // nothing can have been saved there
  let timer: number | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => resolve(null), IDB_WAIT_MS);
  });
  const count = transact<number>(STORE_GAMES, 'readonly', (s) => s.count())
    .then((n) => n > 0)
    .catch((err: unknown): null => {
      // A transient failure (Safari's "connection lost", a blocked open) must not turn a
      // player known only by saved games into a new one: decide on a later visit.
      console.warn('Saved games could not be counted', err);
      return null;
    });
  try {
    return await Promise.race([count, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Decides once per browser and writes the marker. The synchronous verdict is returned at
 * once in `sync`; `done` resolves with the final one (after the IndexedDB check, if needed).
 */
export function initUiVersion(storage: Storage | null): { sync: UiUser | null; done: Promise<UiUser> } {
  const sync = classifyFromStorage(storage);
  if (sync === 'existing') applyDefaults(storage, 'existing');
  if (sync !== null) return { sync, done: Promise.resolve(sync) };
  const done = hasSavedGames().then((games): UiUser => {
    if (games === null) return 'unknown'; // decide on a later visit
    // Another tab may have decided meanwhile. (Keys this page wrote while waiting do not
    // count: that is the new user's first visit.)
    try {
      if (storage?.getItem(UI_VERSION_KEY) !== null) return 'known';
    } catch {
      return 'unknown';
    }
    const kind = games ? 'existing' : 'new';
    applyDefaults(storage, kind);
    return kind;
  });
  return { sync, done };
}
