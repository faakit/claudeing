import Phaser from 'phaser';
import { MomentClock, PanelTracker, chooseAmbience, chooseMusic, type Scene } from '../audio/director';
import { inputHub } from '../input/InputHub';
import { mapsData } from '../data';
import { audio } from '../platform/audio';
import { isNative } from '../platform/native';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { gameEvents } from '../systems/events';
import { festivalToday, hasEntered } from '../systems/festivals';
import { nightAmount } from '../ui/daylight';

/** How often the director looks at the game (music and ambience change slowly; 4 Hz is plenty). */
const DIRECTOR_MS = 250;

/** Which panel is open (for the shop music), from panel events and the modal count. */
const panels = new PanelTracker();
const moments = new MomentClock();
const SEASON_INDEX: Record<string, number> = { spring: 0, summer: 1, fall: 2, winter: 3 };

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
    panel: panels.current(performance.now()),
    year: s.time.year,
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
  let specials: number | null = null;
  const talked = new Set<string>();
  const absDay = () => {
    const t = getState().time;
    return (t.year - 1) * 112 + (SEASON_INDEX[t.season] ?? 0) * 28 + t.day - 1;
  };
  game.events.on(Phaser.Core.Events.POST_STEP, (time: number) => {
    panels.frame(runtime.modals);
    if (time - last < DIRECTOR_MS) return;
    last = time;
    const scene = describe();
    const m = chooseMusic(scene);
    audio.setMusic(m.slot, m.indoor, { rain: m.rain, year: m.year });
    audio.setAmbience(chooseAmbience(scene));
    // A special order delivered in full: its fanfare follows the order jingle the board plays.
    const done = runtime.inGame ? (getState().stats['specialsDone'] ?? 0) : null;
    if (specials !== null && done !== null && done > specials) audio.play('special');
    specials = done;
    if (scene.inGame && !runtime.blocked) {
      const m2 = moments.step(absDay(), scene.night, scene.outdoor && m.slot === scene.season);
      if (m2) audio.sting(m2);
    }
  });
  // Musical moments: villager motifs, new hearts, the season changing under the sleep screen.
  const now = () => performance.now();
  gameEvents.on('openPanel', ({ type }) => panels.open(type, now()));
  inputHub.on('menu', () => panels.open('menu', now()));
  gameEvents.on('placedPanel', () => panels.open('placed', now()));
  gameEvents.on('buyPlot', () => panels.open('plot', now()));
  gameEvents.on('startFishing', () => panels.open('fishing', now()));
  // A villager's motif on the first chat of the day with them (chats and gifts repeat talkTo).
  gameEvents.on('talkTo', ({ id }) => {
    panels.open('npc', now());
    const key = `${absDay()}:${id}`;
    if (talked.has(key)) return;
    talked.add(key);
    audio.motif(id);
  });
  gameEvents.on('heartUp', ({ id }) => audio.motif(id, true));
  gameEvents.on('daySummary', (sum) => {
    const now = getState().time.season;
    if (sum.endedSeason !== now) audio.seasonSting(now);
  });
  // Start downloading after the first frames are on screen: the title appears without waiting.
  game.events.once(Phaser.Core.Events.POST_RENDER, () => audio.preload(serviceWorkerSettled()));
}
