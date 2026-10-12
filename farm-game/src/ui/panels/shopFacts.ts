import { crops, game, items, placeables, trees } from '../../data';
import { measureText } from '../fontMetrics';
import { fmtGold, t, type Key } from '../../i18n';
import { seasonWord } from '../../systems/time';

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
  season?: string,
): string {
  const def = items[itemId]!;
  const crop = def.plants ? crops[def.plants] : undefined;
  let base: string;
  let short: string | null = null;
  /** Shorter ways to say `base` when it does not fit beside the buttons. */
  let alts: string[] = [];
  if (crop) {
    const days = crop.stageDays.reduce((a, b) => a + b, 0);
    const sell = items[crop.harvestItem]?.sellPrice ?? 0;
    const late = !greenhouse && tooLate(itemId, day);
    // With a greenhouse every season's seeds are sold; say which ones only grow under glass.
    const glass = greenhouse && !!season && !crop.seasons.includes(season as never);
    const again = crop.regrowDays ? t('shop.again', { n: crop.regrowDays }) : '';
    const f = { days, sell: fmtGold(sell), again };
    base = late ? t('shop.tooLateNow') : glass ? t('shop.glassOnly', f) : t('shop.seedFacts', f);
    alts = late
      ? []
      : glass
        ? [
            t('shop.glassOnly', { ...f, again: '' }),
            t('shop.glass', f),
            t('shop.glass', { ...f, again: '' }),
            t('shop.glassDays', f),
          ]
        : [t('shop.seedShort', f), t('shop.seedShort', { ...f, again: '' })];
    short = late
      ? t('shop.tooLate')
      : glass
        ? t('shop.glassDays', f)
        : t('shop.seedShort', { ...f, again: '' });
  } else if (def.type === 'animal') base = t('shop.needsHome');
  else if (def.type === 'sapling') {
    const season = trees[itemId]?.season;
    base = t('shop.saplingFruit', { season: season ? seasonWord(season) : '' });
  } else if (def.type === 'feed') base = t('shop.dailyFood');
  else if (def.type === 'fertilizer')
    base = (def.fertilizer?.growth ?? 0) > 0 ? t('shop.growsFast') : t('shop.finerCrops');
  else if (def.type === 'material') base = t('shop.forCrafting');
  else if (placeables[itemId]?.behavior === 'decor')
    // For decorations `own` counts placed ones too, against the cap: "Decor 1/1".
    return t('shop.decor', { n: own, max: String(placeables[itemId]?.params['max'] ?? 1) });
  else base = def.description;
  if (own <= 0) return [base, ...alts].find((l) => measureText(l) <= room) ?? base;
  for (const line of [
    t('shop.ownLong', { base, n: own }),
    short && t('shop.ownShort', { short, n: own }),
  ])
    if (line && measureText(line) <= room) return line;
  return t('shop.own', { n: own });
}

export type ShopTab = 'seeds' | 'farm' | 'home' | 'upgrades';

const TAB_IDS: ShopTab[] = ['seeds', 'farm', 'home', 'upgrades'];
/** The English widths; a language whose labels do not fit them gets widths sized to its labels. */
const TAB_WIDTHS = [42, 40, 40, 56];
const TABS_W = 184;

/** Tabs with their labels and button widths (184 px in all, 2 px apart), in the current language. */
export function shopTabs(): [ShopTab, string, number][] {
  const labels = TAB_IDS.map((id) => t(`shop.tab.${id}` as Key));
  if (labels.every((l, i) => measureText(l) <= TAB_WIDTHS[i]! - 6))
    return TAB_IDS.map((id, i) => [id, labels[i]!, TAB_WIDTHS[i]!]);
  const need = labels.map((l) => measureText(l) + 6);
  const spare = Math.max(0, TABS_W - 2 * (TAB_IDS.length - 1) - need.reduce((a, b) => a + b, 0));
  const each = Math.floor(spare / TAB_IDS.length);
  return TAB_IDS.map((id, i) => [id, labels[i]!, need[i]! + each]);
}

/** Which tab sells an item: animals, feed and saplings on Farm, decorations on Home, the rest on Seeds. */
export function shopTabOf(id: string): ShopTab {
  const t = items[id]?.type;
  if (t === 'animal' || t === 'feed' || t === 'sapling') return 'farm';
  if (placeables[id]?.behavior === 'decor') return 'home';
  return 'seeds';
}
