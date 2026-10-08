import type { MusicSlot } from './types';

/** What the director needs to know about the game; plain data so it is unit tested without Phaser. */
export interface Scene {
  inGame: boolean;
  map: string;
  outdoor: boolean;
  season: string;
  /** 0 day .. 1 night (the same curve the day/night music crossfade uses). */
  night: number;
  weather: string;
  /** A festival is on today and the player has not entered it yet. */
  festival: boolean;
}

export interface MusicChoice {
  slot: MusicSlot;
  /** Indoors the season music keeps playing (same clock, no restart) without percussion. */
  indoor: boolean;
}

const SEASONS = new Set(['spring', 'summer', 'fall', 'winter']);

export function chooseMusic(s: Scene): MusicChoice {
  if (!s.inGame) return { slot: 'title', indoor: false };
  if (s.map === 'mine') return { slot: 'mine', indoor: true };
  if (s.map === 'town' && s.festival && s.night < 0.5) return { slot: 'festival', indoor: false };
  const season = (SEASONS.has(s.season) ? s.season : 'spring') as MusicSlot;
  return { slot: season, indoor: !s.outdoor };
}

/** Target intensities (0..1) for the ambience beds and one-shot pools. Rain is driven separately. */
export interface AmbienceTargets {
  birds: number;
  crickets: number;
  wind: number;
  cave: number;
  drips: number;
}

export function chooseAmbience(s: Scene): AmbienceTargets {
  const none: AmbienceTargets = { birds: 0, crickets: 0, wind: 0, cave: 0, drips: 0 };
  if (!s.inGame) return none;
  if (s.map === 'mine') return { ...none, cave: 1, drips: 1 };
  if (!s.outdoor) return none;
  const wet = s.weather !== 'sunny';
  const storm = s.weather === 'storm';
  const day = 1 - s.night;
  const winter = s.season === 'winter';
  return {
    // Birds sing by day (fewer in fall, none in winter or rain), fading out at dusk.
    birds: wet || winter ? 0 : Math.max(0, day * 2 - 1) * (s.season === 'fall' ? 0.6 : 1),
    // Crickets from dusk, warm seasons only, quieter in spring.
    crickets: wet || winter ? 0 : Math.min(1, Math.max(0, s.night * 1.4 - 0.3)) * (s.season === 'spring' ? 0.6 : 1),
    // Winter always has a little wind, more at night; storms bring it in any season.
    wind: storm ? 0.8 : winter ? 0.5 + 0.4 * s.night : 0,
    cave: 0,
    drips: 0,
  };
}
