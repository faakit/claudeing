import { createWebStore } from '../platform/webStore';
import { getState } from '../state/store';
import { runtime } from '../state/runtime';
import { saveGame } from '../systems/save';
import { gameEvents } from '../systems/events';

export const saveStore = createWebStore();

let saving: Promise<void> | null = null;

/** Write the current state. Safe to call often; overlapping saves coalesce. */
export async function saveNow(quiet = false): Promise<void> {
  if (!runtime.inGame) return;
  if (saving) return saving;
  const snapshot = JSON.parse(JSON.stringify(getState()));
  saving = saveGame(saveStore, snapshot)
    .then(() => {
      if (!quiet) gameEvents.emit('saved', undefined);
    })
    .catch(() => undefined)
    .finally(() => {
      saving = null;
    });
  return saving;
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
