import { game } from '../data';
import type { GameState, Weather } from '../state/GameState';
import { gameEvents } from './events';
import { random } from './rng';

/** Decide the weather for the day that is starting. Early days of a new game are always calm. */
export function rollWeather(state: GameState): Weather {
  const t = state.time;
  if (t.year === 1 && t.season === 'spring' && t.day <= game.calmDays) return 'sunny';
  return random(state) < game.rainChance[t.season] ? 'rain' : 'sunny';
}

/** Rain waters every tilled tile for free. */
export function waterAllSoil(state: GameState): void {
  for (const soil of Object.values(state.farm.tiles)) soil.watered = true;
  gameEvents.emit('farmChanged', undefined);
}

export const isRaining = (state: GameState): boolean => state.weather === 'rain';
