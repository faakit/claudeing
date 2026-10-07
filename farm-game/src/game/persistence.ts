import { createWebStore } from '../platform/webStore';
import { getState } from '../state/store';
import { runtime } from '../state/runtime';
import { saveGame } from '../systems/save';
import { gameEvents } from '../systems/events';

export const saveStore = createWebStore();

/** Saves run strictly one after another, each writing the snapshot taken when it was requested. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Snapshot the current state and write it. Every call persists the state as of *that call*
 * (a save requested mid-save queues behind it instead of being dropped). Resolves true only
 * when the data really reached persistent storage, so callers never claim a save that failed.
 */
export function saveNow(quiet = false): Promise<boolean> {
  if (!runtime.inGame) return Promise.resolve(false);
  const snapshot = JSON.parse(JSON.stringify(getState()));
  const run = async (): Promise<boolean> => {
    try {
      await saveGame(saveStore, snapshot);
    } catch {
      return false;
    }
    if (!saveStore.persistent) return false; // memory-only fallback: nothing survives a reload
    if (!quiet) gameEvents.emit('saved', undefined);
    return true;
  };
  const result = chain.then(run, run);
  chain = result;
  return result;
}

let wired = false;
/** Autosave on tab hide / page close, and every minute of play. */
export function wireAutosave(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void saveNow(true);
  });
  window.addEventListener('pagehide', () => void saveNow(true));
  window.setInterval(() => {
    if (!runtime.blocked) void saveNow(true);
  }, 60_000);
}
