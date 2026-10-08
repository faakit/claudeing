import { crops, game, items, placeables, trees } from '../../data';
import { measureText } from '../fontMetrics';

/** True when a seed could not ripen before the season ends (so buying it now is a mistake). */
export function tooLate(itemId: string, day: number): boolean {
  const crop = items[itemId]?.plants ? crops[items[itemId]!.plants!] : undefined;
  if (!crop) return false;
  return crop.stageDays.reduce((a, b) => a + b, 0) > game.seasonLength - day;
}

/**
 * Room for the facts line in a shop row: the 200 px sheet less the icon column and the buttons
 * (a price button, plus x5 on cheap rows).
 */
export const shopFactsRoom = (withX5: boolean): number => 200 - 8 - 28 - 47 - (withX5 ? 29 : 0) - 2;

/**
 * The short line under an item in the shop: facts a buyer needs, never a long blurb. It always fits `room`
 * with the "own" count kept (critique 5 found "Parsnip Seeds 4 days 35g (ow.."). Pure so tests can size it.
 */
export function shopFacts(
  itemId: string,
  own: number,
  day: number,
  greenhouse = false,
  room = shopFactsRoom(true),
): string {
  const def = items[itemId]!;
  const crop = def.plants ? crops[def.plants] : undefined;
  let base: string;
  let short: string | null = null;
  if (crop) {
    const days = crop.stageDays.reduce((a, b) => a + b, 0);
    const sell = items[crop.harvestItem]?.sellPrice ?? 0;
    const late = !greenhouse && tooLate(itemId, day);
    base = late ? 'Too late now' : `${days} days  ${sell}g`;
    short = late ? 'Too late' : `${days}d ${sell}g`;
  } else if (def.type === 'animal') base = 'Needs a home';
  else if (def.type === 'sapling') base = `${seasonName(trees[itemId]?.season ?? '')} fruit`;
  else if (def.type === 'feed') base = 'Daily food';
  else if (def.type === 'fertilizer')
    base = (def.fertilizer?.growth ?? 0) > 0 ? 'Grows fast' : 'Finer crops';
  else if (def.type === 'bait') base = 'Faster bites';
  else if (def.type === 'material') base = 'For crafting';
  else if (placeables[itemId]?.behavior === 'decor')
    // For decorations `own` counts placed ones too, against the cap: "Decor 1/1".
    return `Decor ${own}/${String(placeables[itemId]?.params['max'] ?? 1)}`;
  else base = def.description;
  if (own <= 0) return base;
  for (const line of [`${base} (own ${own})`, short && `${short}, own ${own}`])
    if (line && measureText(line) <= room) return line;
  return `Own ${own}`;
}

export type ShopTab = 'seeds' | 'farm' | 'home' | 'upgrades';

/** Tabs with their button widths (184 px in all, 2 px apart). */
export const SHOP_TABS: [ShopTab, string, number][] = [
  ['seeds', 'Seeds', 42],
  ['farm', 'Farm', 40],
  ['home', 'Home', 40],
  ['upgrades', 'Upgrades', 56],
];

/** Which tab sells an item: animals, feed and saplings on Farm, decorations on Home, the rest on Seeds. */
export function shopTabOf(id: string): ShopTab {
  const t = items[id]?.type;
  if (t === 'animal' || t === 'feed' || t === 'sapling') return 'farm';
  if (placeables[id]?.behavior === 'decor') return 'home';
  return 'seeds';
}

const seasonName = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
