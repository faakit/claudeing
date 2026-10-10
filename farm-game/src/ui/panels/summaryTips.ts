import type { Season } from '../../state/GameState';

/** Morning tips. A tip with `seasons` only shows then, so nobody reads about winter on Spring 1. */
export const SUMMARY_TIPS: { text: string; seasons?: Season[] }[] = [
  { text: 'Water your crops every day. Unwatered crops do not grow.' },
  { text: 'Seeds only grow in their season. Plan your next planting.' },
  { text: 'Corn regrows after harvest. Great value in summer.', seasons: ['spring', 'summer'] },
  {
    text: 'Winter has no wild crops, but kale grows in the cold. Plan ahead!',
    seasons: ['fall', 'winter'],
  },
  { text: 'Hold Action, then drag, to work a whole row of tiles.' },
  { text: 'Upgrade the watering can to spend less time at the pond.' },
  { text: 'Passing out at 2 AM only restores half your energy. Sleep earlier!' },
  { text: 'Weeds sprout in the field. Cut them with the scythe for fiber.' },
  { text: 'Crops left in the field when the season changes will wither.' },
  { text: 'The shipping bin pays the next morning, so ship before bed.' },
  { text: 'Villagers post small jobs each morning. They pay on the spot.' },
];

/** Today's tip: rotates by day, skipping tips for other seasons. */
export function summaryTip(season: Season, day: number, year: number): string {
  const pool = SUMMARY_TIPS.filter((t) => !t.seasons || t.seasons.includes(season));
  return pool[(day + year) % pool.length]?.text ?? '';
}
