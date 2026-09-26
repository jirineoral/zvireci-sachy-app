/**
 * The app's one IndexedDB database (`skm`). Stores: `userSets` (Phase 7) and `games`
 * (Phase 9). Opening never throws to callers: a rejected promise is the signal to fall
 * back to session-only memory (private windows, blocked or full storage).
 *
 * The connection is not held forever: another tab's upgrade (`versionchange`) or the
 * browser (`close`, e.g. storage cleared) ends it, and the next `transact` reopens.
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
        const db = request.result;
        if (settled) {
          db.close(); // too late: the caller already fell back
          return;
        }
        const current = opening;
        const forget = (): void => {
          if (opening === current) opening = null; // the next caller opens a fresh connection
        };
        // Another tab wants a newer version: step aside instead of blocking it.
        db.onversionchange = () => {
          db.close();
          forget();
        };
        db.onclose = forget;
        resolve(db);
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

/** Closes a connection the browser already considers unusable and forgets it. */
async function discardConnection(): Promise<void> {
  const current = opening;
  opening = null;
  try {
    (await current)?.close();
  } catch {
    // it never opened: nothing to close
  }
}

/**
 * One request in its own transaction. Resolves with the request's result only once the
 * transaction has committed (a write can succeed as a request and still be aborted — e.g.
 * QuotaExceededError arrives as an abort afterwards); rejects on abort / error. A
 * connection closed under us (InvalidStateError) is reopened once.
 */
export async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  try {
    return await transactOnce(await openDatabase(), storeName, mode, op);
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'InvalidStateError')) throw err;
    await discardConnection();
    return transactOnce(await openDatabase(), storeName, mode, op);
  }
}

function transactOnce<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode); // throws InvalidStateError on a closed connection
    const request = op(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error ?? request.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? request.error ?? new Error('IndexedDB transaction failed'));
  });
}
