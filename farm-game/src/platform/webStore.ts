import { MemoryStore, type SaveStore } from './SaveStore';

const DB_NAME = 'farm-game';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IndexedDbStore implements SaveStore {
  private db: Promise<IDBDatabase> = openDb();

  private async run<T>(
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async read(key: string): Promise<string | null> {
    return ((await this.run('readonly', (s) => s.get(key))) as string | undefined) ?? null;
  }
  async write(key: string, value: string): Promise<void> {
    await this.run('readwrite', (s) => s.put(value, key));
  }
  async remove(key: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(key));
  }
}

class LocalStorageStore implements SaveStore {
  async read(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }
  async write(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }
  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

/**
 * Tries IndexedDB, then localStorage, then memory. Storage can be blocked (private
 * windows, sandboxed frames), and the game must still run, just without persistence.
 */
export function createWebStore(): SaveStore & { readonly persistent: boolean } {
  const chain: SaveStore[] = [];
  try {
    if (typeof indexedDB !== 'undefined') chain.push(new IndexedDbStore());
  } catch {
    /* unavailable */
  }
  try {
    if (typeof localStorage !== 'undefined') chain.push(new LocalStorageStore());
  } catch {
    /* unavailable */
  }
  const memory = new MemoryStore();
  let persistent = chain.length > 0;

  const attempt = async <T>(fn: (s: SaveStore) => Promise<T>): Promise<T> => {
    for (const store of chain) {
      try {
        return await fn(store);
      } catch {
        /* try the next backend */
      }
    }
    persistent = false;
    return fn(memory);
  };

  return {
    get persistent() {
      return persistent;
    },
    read: (k) => attempt((s) => s.read(k)),
    write: (k, v) => attempt((s) => s.write(k, v)),
    remove: (k) => attempt((s) => s.remove(k)),
  };
}
