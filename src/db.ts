/**
 * The app's one IndexedDB database (`skm`). Stores: `userSets` (Phase 7) and `games`
 * (Phase 9). Opening never throws to callers: a rejected promise is the signal to fall
 * back to session-only memory (private windows, blocked or full storage).
 */

export const DB_NAME = 'skm';
export const DB_VERSION = 2;
export const STORE_USER_SETS = 'userSets';
export const STORE_GAMES = 'games';
const OPEN_TIMEOUT_MS = 4000;

let opening: Promise<IDBDatabase> | null = null;

/** Opens (and upgrades) the database once per page; concurrent callers share the promise. */
export function openDatabase(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('indexedDB is not defined'));
        return;
      }
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(err);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_USER_SETS)) db.createObjectStore(STORE_USER_SETS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_GAMES)) {
          const games = db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
          games.createIndex('playedAt', 'playedAt');
        }
      };
      // An open queued behind another tab's pending delete/upgrade fires no event at all;
      // do not let the whole app wait on it — fall back to memory after a few seconds.
      let settled = false;
      const timer = window.setTimeout(() => {
        settled = true;
        reject(new Error('indexedDB.open timed out'));
      }, OPEN_TIMEOUT_MS);
      request.onsuccess = () => {
        window.clearTimeout(timer);
        if (settled) request.result.close(); // too late: the caller already fell back
        else resolve(request.result);
      };
      request.onerror = () => {
        window.clearTimeout(timer);
        reject(request.error ?? new Error('indexedDB.open failed'));
      };
      request.onblocked = () => {
        window.clearTimeout(timer);
        reject(new Error('indexedDB.open blocked'));
      };
    });
    opening.catch(() => {
      opening = null; // let a later caller try again (e.g. after the user allows storage)
    });
  }
  return opening;
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}
