import { t } from '../../i18n';
import { rivalName } from '../../systems/rival';
/** Player-facing text for perks, shared by the Skills tab and villager panels. */
/** What each perk key means to a player, for the "next reward" line. Unknown keys fall back to the key. */
const pct = (v: number): number => Math.round(v * 100);
export const PERK_TEXT: Record<string, (v: number) => string> = {
  qualityBonus: (v) => t('perk.qualityBonus', { n: pct(v) }),
  maxEnergy: (v) => t('perk.maxEnergy', { n: v }),
  sellBonus: (v) => t('perk.sellBonus', { n: pct(v) }),
  forageDouble: (v) => t('perk.forageDouble', { n: pct(v) }),
  forageQuality: (v) => t('perk.forageQuality', { n: pct(v) }),
  upgradeDiscount: (v) => t('perk.upgradeDiscount', { n: pct(v) }),
  shopDiscount: (v) => t('perk.shopDiscount', { n: pct(v) }),
  fishWindow: (v) => t('perk.fishWindow', { n: pct(v) }),
  orderSlots: (v) => t('perk.orderSlots', { count: v }),
  xpBonus: (v) => t('perk.xpBonus', { n: pct(v) }),
  rivalLate: (v) => t('perk.rivalLate', { name: rivalName(), count: Math.round(v / 60) }),
  rivalPolite: () => t('perk.rivalPolite', { name: rivalName() }),
  rivalOff: () => t('perk.rivalOff', { name: rivalName() }),
  festivalPrize: (v) => t('perk.festivalPrize', { n: pct(v) }),
};

export const perkLine = (perks: Record<string, number>): string =>
  Object.entries(perks)
    .map(([k, v]) => (PERK_TEXT[k] ? PERK_TEXT[k]!(v) : `${k} +${v}`))
    .join(', ');
