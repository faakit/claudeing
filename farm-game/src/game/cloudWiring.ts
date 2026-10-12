/**
 * The game's one CloudSync (game/cloudSync.ts) and its triggers: sleep (the day summary), app pause and resume,
 * coming back online. With no provider (web, iOS, an unconfigured Android build) all of this is inert.
 */
import { createCloudProvider } from '../platform/cloud';
import { lifecycle } from '../platform/lifecycle';
import { gameEvents } from '../systems/events';
import { seasonLabel } from '../systems/time';
import { fmtGold, t } from '../i18n';
import { CloudSync } from './cloudSync';
import { afterSaves, saveStore } from './persistence';

export const cloudSync = new CloudSync({
  store: saveStore,
  provider: createCloudProvider(),
  afterSaves,
  describe: (s) =>
    t('title.saveLine', {
      season: seasonLabel(s.season),
      day: s.dayOfSeason,
      year: s.year,
      gold: fmtGold(s.money),
    }),
  onConflict: () => gameEvents.emit('cloudConflict', undefined),
});

let wired = false;
export function wireCloudSave(): void {
  if (wired) return;
  wired = true;
  cloudSync.onChange(() => gameEvents.emit('cloudChanged', undefined));
  void cloudSync.init();
  lifecycle.on('pause', () => void cloudSync.save('pause'));
  lifecycle.on('resume', () => void cloudSync.save('resume'));
  gameEvents.on('daySummary', () => void cloudSync.save('sleep'));
  window.addEventListener('online', () => void cloudSync.save('online'));
}
