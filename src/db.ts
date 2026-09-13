/**
 * The app's one IndexedDB database (`skm`). Stores: `userSets` (Phase 7) and `games`
 * (Phase 9). Opening never throws to callers: a rejected promise is the signal to fall
 * back to session-only memory (private windows, blocked or full storage).
 */

export const DB_NAME = 'skm';
export const DB_VERSION = 2;
export const STORE_USER_SETS = 'userSets';
export const STORE_GAMES = 'games';

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
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('indexedDB.open failed'));
      request.onblocked = () => reject(new Error('indexedDB.open blocked'));
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
