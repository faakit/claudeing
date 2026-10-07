import { game } from '../data';
import type { DaySummary, GameState } from '../state/GameState';
import { restoreEnergy } from './energy';
import { gameEvents } from './events';
import { checkGoals } from './goals';
import { growCrops, killOutOfSeason, spawnWeeds } from './farming';
import { sellPrice } from './economy';
import { advanceCalendar } from './time';
import { rollWeather, waterAllSoil } from './weather';

export interface EndDayOptions {
  /** True when the clock ran out (02:00) rather than the player choosing bed. */
  passedOut: boolean;
  /** Farmable tiles where weeds may appear. */
  weedCandidates: readonly [number, number][];
}

/**
 * Day rollover, in the order the design requires: crops grow, shipped items are paid
 * for, then the calendar moves on. The caller autosaves afterwards.
 */
export function endDay(state: GameState, opts: EndDayOptions): DaySummary {
  const endedDay = state.time.day;
  const endedSeason = state.time.season;

  growCrops(state);

  const shipped = Object.entries(state.shipping).map(([item, qty]) => ({
    item,
    qty,
    gold: sellPrice(item) * qty,
  }));
  const total = shipped.reduce((s, l) => s + l.gold, 0);
  state.money += total;
  state.shipping = {};
  if (total > 0) {
    gameEvents.emit('moneyChanged', { delta: total });
    state.stats['earned'] = (state.stats['earned'] ?? 0) + total;
  }

  const yearEnd = endedSeason === 'summer' && endedDay === game.seasonLength;
  const seasonChanged = advanceCalendar(state);
  const withered = seasonChanged ? killOutOfSeason(state) : 0;
  spawnWeeds(state, opts.weedCandidates);
  state.weather = rollWeather(state);
  if (state.weather === 'rain') waterAllSoil(state);
  restoreEnergy(state, opts.passedOut ? game.passOutEnergyFraction : 1);
  if (!opts.passedOut) state.stats['daysSlept'] = (state.stats['daysSlept'] ?? 0) + 1;
  checkGoals(state);

  const summary: DaySummary = {
    endedDay,
    endedSeason,
    shipped,
    total,
    withered,
    passedOut: opts.passedOut,
    weather: state.weather,
    yearEnd,
  };
  state.lastSummary = summary;
  gameEvents.emit('daySummary', summary);
  return summary;
}

export function rankTitle(earned: number): string {
  let title = game.ranks[0]?.title ?? '';
  for (const r of game.ranks) if (earned >= r.min) title = r.title;
  return title;
}
