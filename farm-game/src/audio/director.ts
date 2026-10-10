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
  /** The panel that is open, if any ('shop' plays the shop music and ambience). */
  panel?: string | null;
  /** Game year (variation sections from year two). */
  year?: number;
}

export interface MusicChoice {
  slot: MusicSlot;
  /** Indoors the season music keeps playing (same clock, no restart) without percussion. */
  indoor: boolean;
  /** Rain or storm outside: the season piece's rainy-day arrangement. */
  rain: boolean;
  year: number;
}

/** Night amount from which the house plays the lullaby instead of the season piece. */
export const LULLABY_NIGHT = 0.6;

const SEASONS = new Set(['spring', 'summer', 'fall', 'winter']);

export function chooseMusic(s: Scene): MusicChoice {
  const mood = { rain: s.weather === 'rain' || s.weather === 'storm', year: s.year ?? 1 };
  if (!s.inGame) return { slot: 'title', indoor: false, ...mood, rain: false };
  if (s.panel === 'shop') return { slot: 'shop', indoor: true, ...mood };
  if (s.map === 'mine') return { slot: 'mine', indoor: true, ...mood };
  if (s.map === 'town' && s.festival && s.night < 0.5)
    return { slot: 'festival', indoor: false, ...mood };
  if (s.map === 'house' && s.night >= LULLABY_NIGHT)
    return { slot: 'lullaby', indoor: true, ...mood };
  const season = (SEASONS.has(s.season) ? s.season : 'spring') as MusicSlot;
  return { slot: season, indoor: !s.outdoor, ...mood };
}

/** Target intensities (0..1) for the ambience beds and one-shot pools. Rain is driven separately. */
export interface AmbienceTargets {
  birds: number;
  crickets: number;
  wind: number;
  cave: number;
  drips: number;
  thunder: number;
  /** Interiors: a wall clock (house, shop), the smithy's forge and anvil, shop creaks and pages. */
  clock: number;
  forge: number;
  anvil: number;
  shop: number;
}

export function chooseAmbience(s: Scene): AmbienceTargets {
  const none: AmbienceTargets = {
    birds: 0,
    crickets: 0,
    wind: 0,
    cave: 0,
    drips: 0,
    thunder: 0,
    clock: 0,
    forge: 0,
    anvil: 0,
    shop: 0,
  };
  if (!s.inGame) return none;
  // The General Store with the smithy next door: creaks and pages, the forge, now and then the anvil.
  if (s.panel === 'shop')
    return {
      ...none,
      shop: 0.8,
      forge: 0.7,
      anvil: 0.5,
      clock: 0.4,
      thunder: s.weather === 'storm' ? 0.5 : 0,
    };
  if (s.map === 'mine') return { ...none, cave: 1, drips: 1 };
  // Thunder carries indoors too, a little softer. The house has a wall clock, clearer at night.
  if (!s.outdoor)
    return {
      ...none,
      thunder: s.weather === 'storm' ? 0.6 : 0,
      clock: s.map === 'house' ? (s.night >= LULLABY_NIGHT ? 0.9 : 0.5) : 0,
    };
  const wet = s.weather !== 'sunny';
  const storm = s.weather === 'storm';
  const day = 1 - s.night;
  const winter = s.season === 'winter';
  return {
    // Birds sing by day (fewer in fall, none in winter or rain), fading out at dusk.
    birds: wet || winter ? 0 : Math.max(0, day * 2 - 1) * (s.season === 'fall' ? 0.6 : 1),
    // Crickets from dusk, warm seasons only, quieter in spring.
    crickets:
      wet || winter
        ? 0
        : Math.min(1, Math.max(0, s.night * 1.4 - 0.3)) * (s.season === 'spring' ? 0.6 : 1),
    // Winter always has a little wind, more at night; storms bring it in any season.
    wind: storm ? 0.8 : winter ? 0.5 + 0.4 * s.night : 0,
    cave: 0,
    drips: 0,
    thunder: storm ? 1 : 0,
    clock: 0,
    forge: 0,
    anvil: 0,
    shop: 0,
  };
}

/** The shop piece starts only after the store has been open this long (ms): no churn on quick visits. */
export const SHOP_DWELL_MS = 1500;

/**
 * Which panel is open, for the music. Any panel or sheet opening is reported to `open` (the shop by
 * name, the rest by any name); a frame with no modal clears it. The shop counts only after the dwell.
 */
export class PanelTracker {
  private panel: string | null = null;
  private since = 0;

  open(type: string, t: number): void {
    this.panel = type;
    this.since = t;
  }

  /** Call every frame with the number of open modals. */
  frame(modals: number): void {
    if (modals === 0) this.panel = null;
  }

  current(t: number): string | null {
    if (this.panel === 'shop' && t - this.since < SHOP_DWELL_MS) return null;
    return this.panel;
  }
}

export type Moment = 'dawn' | 'dusk';

/**
 * Dawn and dusk flourishes, rationed: only on the first day of each week (days 1, 8, 15, 22 of a
 * season), dawn the first time the player is outdoors that morning, dusk when the evening turns while
 * they are outdoors. Returns the sting to play (three variants each, by week), or null.
 */
export class MomentClock {
  private dawnDay = -1;
  private duskDay = -1;
  private lastNight: number | null = null;

  step(absDay: number, night: number, outdoor: boolean): string | null {
    const prev = this.lastNight;
    this.lastNight = night;
    if (absDay % 7 !== 0 || !outdoor) return null;
    const variant = (Math.floor(absDay / 7) % 3) + 1;
    if (night < 0.35 && this.dawnDay !== absDay) {
      this.dawnDay = absDay;
      return `dawn-${variant}`;
    }
    if (night >= 0.65 && prev !== null && prev < 0.65 && this.duskDay !== absDay) {
      this.duskDay = absDay;
      return `dusk-${variant}`;
    }
    return null;
  }
}
