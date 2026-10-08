import Phaser from 'phaser';
import { chooseAmbience, chooseMusic, type Scene } from '../audio/director';
import { mapsData } from '../data';
import { audio } from '../platform/audio';
import { isNative } from '../platform/native';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { festivalToday, hasEntered } from '../systems/festivals';
import { nightAmount } from '../ui/daylight';

/** How often the director looks at the game (music and ambience change slowly; 4 Hz is plenty). */
const DIRECTOR_MS = 250;

function describe(): Scene {
  if (!runtime.inGame)
    return { inGame: false, map: '', outdoor: false, season: 'spring', night: 0, weather: 'sunny', festival: false };
  const s = getState();
  const fest = festivalToday(s);
  return {
    inGame: true,
    map: s.player.map,
    outdoor: !!mapsData.maps[s.player.map]?.outdoor,
    season: s.time.season,
    night: nightAmount(s.time.minutes),
    weather: s.weather,
    festival: !!fest && !hasEntered(s, fest.id),
  };
}

/**
 * Resolve once the offline worker controls the page, so a first visit downloads the audio once,
 * through its cache, instead of twice in parallel. Resolves at once where there is no worker (dev,
 * native apps) and never waits more than 8 s.
 */
function serviceWorkerSettled(): Promise<unknown> {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (!import.meta.env.PROD || isNative() || !sw || sw.controller) return Promise.resolve();
  return Promise.race([
    sw.ready.then(() =>
      sw.controller ? undefined : new Promise((resolve) => sw.addEventListener('controllerchange', resolve, { once: true })),
    ),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ]);
}

/**
 * The one place that tells the audio engine where the player is: title, season (indoors or out),
 * mine or festival for the music; birds, crickets, wind and cave for the ambience. Season changes
 * happen during the sleep blackout, so the music changes under it too. Rain, the day/night
 * crossfade and the season mood are still fed by the UI scene as before.
 */
export function wireAudio(game: Phaser.Game): void {
  let last = -Infinity;
  game.events.on(Phaser.Core.Events.POST_STEP, (time: number) => {
    if (time - last < DIRECTOR_MS) return;
    last = time;
    const scene = describe();
    const m = chooseMusic(scene);
    audio.setMusic(m.slot, m.indoor);
    audio.setAmbience(chooseAmbience(scene));
  });
  // Start downloading after the first frames are on screen: the title appears without waiting.
  game.events.once(Phaser.Core.Events.POST_RENDER, () => audio.preload(serviceWorkerSettled()));
}
