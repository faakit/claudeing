import { crops, game, items } from '../../data';

/** True when a seed could not ripen before the season ends (so buying it now is a mistake). */
export function tooLate(itemId: string, day: number): boolean {
  const crop = items[itemId]?.plants ? crops[items[itemId]!.plants!] : undefined;
  if (!crop) return false;
  return crop.stageDays.reduce((a, b) => a + b, 0) > game.seasonLength - day;
}

/** The short line under an item in the shop: facts a buyer needs, never a long blurb. Pure so tests can size it. */
export function shopFacts(itemId: string, own: number, day: number): string {
  const def = items[itemId]!;
  const crop = def.plants ? crops[def.plants] : undefined;
  let base: string;
  if (crop)
    base = tooLate(itemId, day)
      ? 'Too late now'
      : `${crop.stageDays.reduce((a, b) => a + b, 0)} days  ${items[crop.harvestItem]?.sellPrice ?? 0}g`;
  else if (def.type === 'animal') base = 'Needs a home';
  else if (def.type === 'feed') base = 'Daily food';
  else if (def.type === 'fertilizer')
    base = (def.fertilizer?.growth ?? 0) > 0 ? 'Grows fast' : 'Finer crops';
  else if (def.type === 'bait') base = 'Faster bites';
  else if (def.type === 'material') base = 'For crafting';
  else base = def.description;
  return own > 0 ? `${base} (own ${own})` : base;
}
