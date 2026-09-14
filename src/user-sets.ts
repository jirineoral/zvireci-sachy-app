/**
 * User piece sets (MVP M1/M2): twelve optional PNG blobs plus a name, kept in IndexedDB
 * (`skm` / `userSets`, see db.ts). Browser-local storage only — nothing leaves the device.
 * When IndexedDB cannot be opened (private window, blocked or full storage) the store
 * degrades to an in-memory map for the session and says so through `persistent === false`.
 */
import { STORE_USER_SETS as STORE, openDatabase, requestToPromise } from './db';

export const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const;
export type PieceCode = (typeof PIECE_CODES)[number];

export const PIECE_LABELS: Record<PieceCode, string> = {
  wK: 'bílý král',
  wQ: 'bílá dáma',
  wR: 'bílá věž',
  wB: 'bílý střelec',
  wN: 'bílý jezdec',
  wP: 'bílý pěšec',
  bK: 'černý král',
  bQ: 'černá dáma',
  bR: 'černá věž',
  bB: 'černý střelec',
  bN: 'černý jezdec',
  bP: 'černý pěšec',
};

export interface UserSet {
  id: string;
  name: string;
  createdAt: number;
  /** Missing codes show the built-in classic piece. */
  pieces: Partial<Record<PieceCode, Blob>>;
}

export interface UserSetStore {
  /** False when IndexedDB is unavailable: sets live only until the tab closes. */
  readonly persistent: boolean;
  list(): Promise<UserSet[]>;
  save(set: UserSet): Promise<void>;
  remove(id: string): Promise<void>;
}

export function newSetId(): string {
  return `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Opens the store; never throws — falls back to memory with a console.warn. */
export async function openUserSetStore(): Promise<UserSetStore> {
  try {
    const db = await openDatabase();
    return new IdbStore(db);
  } catch (err) {
    console.warn('IndexedDB unavailable; user piece sets will last only for this session', err);
    return new MemoryStore();
  }
}

class IdbStore implements UserSetStore {
  readonly persistent = true;
  constructor(private readonly db: IDBDatabase) {}

  async list(): Promise<UserSet[]> {
    const tx = this.db.transaction(STORE, 'readonly');
    const all = await requestToPromise(tx.objectStore(STORE).getAll());
    return all.filter(isUserSet).sort((a, b) => a.createdAt - b.createdAt);
  }

  async save(set: UserSet): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    await requestToPromise(tx.objectStore(STORE).put(set));
  }

  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(STORE, 'readwrite');
    await requestToPromise(tx.objectStore(STORE).delete(id));
  }
}

class MemoryStore implements UserSetStore {
  readonly persistent = false;
  private readonly sets = new Map<string, UserSet>();

  async list(): Promise<UserSet[]> {
    return Array.from(this.sets.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  async save(set: UserSet): Promise<void> {
    this.sets.set(set.id, set);
  }

  async remove(id: string): Promise<void> {
    this.sets.delete(id);
  }
}

/** Shape check for records read back from storage (a user may have edited the database). */
function isUserSet(value: unknown): value is UserSet {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !/^[a-z0-9]+$/.test(v.id)) return false;
  if (typeof v.name !== 'string' || v.name.length > 60 || typeof v.createdAt !== 'number') return false;
  if (typeof v.pieces !== 'object' || v.pieces === null) return false;
  return Object.entries(v.pieces as Record<string, unknown>).every(
    ([code, blob]) => (PIECE_CODES as readonly string[]).includes(code) && blob instanceof Blob,
  );
}
