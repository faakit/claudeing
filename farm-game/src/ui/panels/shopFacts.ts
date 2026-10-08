import { crops, game, items, placeables, trees } from '../../data';

/** True when a seed could not ripen before the season ends (so buying it now is a mistake). */
export function tooLate(itemId: string, day: number): boolean {
  const crop = items[itemId]?.plants ? crops[items[itemId]!.plants!] : undefined;
  if (!crop) return false;
  return crop.stageDays.reduce((a, b) => a + b, 0) > game.seasonLength - day;
}

/** The short line under an item in the shop: facts a buyer needs, never a long blurb. Pure so tests can size it. */
export function shopFacts(itemId: string, own: number, day: number, greenhouse = false): string {
  const def = items[itemId]!;
  const crop = def.plants ? crops[def.plants] : undefined;
  let base: string;
  if (crop)
    base = !greenhouse && tooLate(itemId, day)
      ? 'Too late now'
      : `${crop.stageDays.reduce((a, b) => a + b, 0)} days  ${items[crop.harvestItem]?.sellPrice ?? 0}g`;
  else if (def.type === 'animal') base = 'Needs a home';
  else if (def.type === 'sapling') base = `${seasonName(trees[itemId]?.season ?? '')} fruit`;
  else if (def.type === 'feed') base = 'Daily food';
  else if (def.type === 'fertilizer')
    base = (def.fertilizer?.growth ?? 0) > 0 ? 'Grows fast' : 'Finer crops';
  else if (def.type === 'bait') base = 'Faster bites';
  else if (def.type === 'material') base = 'For crafting';
  else if (placeables[itemId]?.behavior === 'decor')
    base = `Decor max ${String(placeables[itemId]?.params['max'] ?? 1)}`;
  else base = def.description;
  return own > 0 ? `${base} (own ${own})` : base;
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
