/** Player-facing text for perks, shared by the Skills tab and villager panels. */
/** What each perk key means to a player, for the "next reward" line. Unknown keys fall back to the key. */
export const PERK_TEXT: Record<string, (v: number) => string> = {
  qualityBonus: (v) => `+${Math.round(v * 100)}% better quality`,
  maxEnergy: (v) => `+${v} max energy`,
  sellBonus: (v) => `+${Math.round(v * 100)}% sell price`,
  forageDouble: (v) => `+${Math.round(v * 100)}% double finds`,
  forageQuality: (v) => `+${Math.round(v * 100)}% forage quality`,
  shopDiscount: (v) => `${Math.round(v * 100)}% off shop prices`,
  fishWindow: (v) => `+${Math.round(v * 100)}% catch zone`,
};

export const perkLine = (perks: Record<string, number>): string =>
  Object.entries(perks)
    .map(([k, v]) => (PERK_TEXT[k] ? PERK_TEXT[k]!(v) : `${k} +${v}`))
    .join(', ');
