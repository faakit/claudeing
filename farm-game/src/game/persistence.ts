import { lifecycle } from '../platform/lifecycle';
import { PLAY_STAT, SAVED_AT_STAT } from '../systems/cloudRules';
import { createSaveStore } from '../platform/store';
import { getState } from '../state/store';
import { runtime } from '../state/runtime';
import { saveGame } from '../systems/save';
import { gameEvents } from '../systems/events';

export const saveStore = createSaveStore();

/** Saves run strictly one after another, each writing the snapshot taken when it was requested. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Snapshot the current state and write it. Every call persists the state as of *that call*
 * (a save requested mid-save queues behind it instead of being dropped). Resolves true only
 * when the data really reached persistent storage, so callers never claim a save that failed.
 */
export function saveNow(quiet = false): Promise<boolean> {
  if (!runtime.inGame) return Promise.resolve(false);
  // When it was written: cloud save tells two copies of a farm apart by it (systems/cloudRules.ts).
  getState().stats[SAVED_AT_STAT] = Date.now();
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

/** Resolves once every save asked for so far has finished (cloud save uploads what they wrote). */
export const afterSaves = (): Promise<unknown> => chain.catch(() => undefined);

/** One second of play: counted while a game is open and the app is in front (the menu counts, the title not). */
export function tickPlayTime(): void {
  if (!runtime.inGame || runtime.suspended || lifecycle.isPaused) return;
  const s = getState();
  s.stats[PLAY_STAT] = (s.stats[PLAY_STAT] ?? 0) + 1;
}

let wired = false;
/** Autosave when the app is backgrounded or closed (via the shared lifecycle) and every minute of play. */
export function wireAutosave(): void {
  if (wired) return;
  wired = true;
  lifecycle.on('pause', () => void saveNow(true));
  window.setInterval(() => {
    if (!runtime.blocked) void saveNow(true);
  }, 60_000);
  window.setInterval(tickPlayTime, 1000);
}
