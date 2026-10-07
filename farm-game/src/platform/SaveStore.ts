/** Storage backend for saves. Web uses IndexedDB; native (M8) will use Capacitor Preferences. */
export interface SaveStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryStore implements SaveStore {
  readonly data = new Map<string, string>();
  async read(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async write(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}
