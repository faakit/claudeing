import { game } from '../data';
import '../mechanics'; // registers the built-in day hooks
import type { DaySummary, GameState } from '../state/GameState';
import { runDayPipeline } from './dayHooks';
import { gameEvents } from './events';

export interface EndDayOptions {
  /** Tiles where forageables may appear, by map id (from each map's "forage" zones). */
  forageSpots?: Readonly<Record<string, readonly [number, number][]>>;
  /** Tiles where ore nodes may appear, by map id. */
  oreSpots?: Readonly<Record<string, readonly [number, number][]>>;
  /** True when the clock ran out (02:00) rather than the player choosing bed. */
  passedOut: boolean;
  /** Farmable tiles where weeds may appear. */
  weedCandidates: readonly [number, number][];
}

/**
 * Day rollover. The steps live in registered hooks (see systems/dayHooks.ts and mechanics/); this
 * builds the summary and runs the pipeline in phase order: crops grow, shipped goods are paid,
 * the calendar advances, then the new day sets itself up. The caller autosaves afterwards.
 */
export function endDay(state: GameState, opts: EndDayOptions): DaySummary {
  const summary: DaySummary = {
    endedDay: state.time.day,
    endedSeason: state.time.season,
    shipped: [],
    total: 0,
    withered: 0,
    passedOut: opts.passedOut,
    weather: state.weather,
    yearEnd: false,
    notes: [],
  };
  runDayPipeline(state, {
    passedOut: opts.passedOut,
    weedCandidates: opts.weedCandidates,
    forageSpots: opts.forageSpots ?? {},
    oreSpots: opts.oreSpots ?? {},
    notes: summary.notes as string[],
    scratch: {},
    summary,
  });
  state.lastSummary = summary;
  gameEvents.emit('daySummary', summary);
  return summary;
}

export function rankTitle(earned: number): string {
  let title = game.ranks[0]?.title ?? '';
  for (const r of game.ranks) if (earned >= r.min) title = r.title;
  return title;
}
