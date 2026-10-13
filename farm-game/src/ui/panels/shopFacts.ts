import { crops, game, items, placeables, trees } from '../../data';
import { measureText } from '../fontMetrics';
import { fmtGold, t, type Key } from '../../i18n';
import { seasonLabel, seasonWord } from '../../systems/time';

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
    // one shape on every row (critic U-4): "7d, sells 85¤", the legend saying d is days to ripen; a regrowing
    // crop adds ", again 3d" where it fits (the card always says it)
    base = late ? t('shop.tooLateNow') : glass ? t('shop.glassOnly', f) : t('shop.factsSells', f);
    alts = late
      ? []
      : glass
        ? [
            t('shop.glassOnly', { ...f, again: '' }),
            t('shop.glass', f),
            t('shop.glass', { ...f, again: '' }),
            t('shop.glassDays', f),
          ]
        : [t('shop.factsSells', { ...f, again: '' }), t('shop.seedShort', { ...f, again: '' })];
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
    ...alts.slice(0, 3).map((a) => t('shop.ownLong', { base: a, n: own })),
    short && t('shop.ownShort', { short, n: own }),
  ])
    if (line && measureText(line) <= room) return line;
  return t('shop.own', { n: own });
}

export type ShopTab = 'seeds' | 'farm' | 'home' | 'upgrades';

const TAB_IDS: ShopTab[] = ['seeds', 'farm', 'home', 'upgrades'];
/** The English widths; a language whose labels do not fit them gets widths sized to its labels. */
const TAB_WIDTHS = [44, 40, 40, 63];
/** The tab row: 190 px from x 5, the tabs 1 px apart. */
export const TABS_X = 5;
export const TAB_GAP = 1;
const TABS_W = 190;
/** A label keeps 2 px clear inside its button's 3 px frame on each side (critic U-2: "Melhorias" touched it). */
const PAD = 11;

/** Tabs with their labels and button widths (190 px in all, 1 px apart), in the current language. */
export function shopTabs(): [ShopTab, string, number][] {
  const labels = TAB_IDS.map((id) => t(`shop.tab.${id}` as Key));
  if (labels.every((l, i) => measureText(l) <= TAB_WIDTHS[i]! - PAD))
    return TAB_IDS.map((id, i) => [id, labels[i]!, TAB_WIDTHS[i]!]);
  const need = labels.map((l) => measureText(l) + PAD);
  const spare = Math.max(
    0,
    TABS_W - TAB_GAP * (TAB_IDS.length - 1) - need.reduce((a, b) => a + b, 0),
  );
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

/** One line of an item's card in the shop: its text and, for a warning, a colour. */
export interface CardLine {
  text: string;
  warn?: boolean;
}

/**
 * The facts on an item's card (QA: "add a description to the shop items"): what it does is the item's own
 * `description` (data, translated by the overlay), then what the shop row could only abbreviate, each line
 * labelled: when it grows, how long it takes, what a crop sells for, whether it can still ripen. Pure.
 */
export function shopCard(
  itemId: string,
  own: number,
  day: number,
  greenhouse = false,
  season?: string,
): CardLine[] {
  const def = items[itemId]!;
  const lines: CardLine[] = [];
  const crop = def.plants ? crops[def.plants] : undefined;
  if (crop) {
    const days = crop.stageDays.reduce((a, b) => a + b, 0);
    lines.push({
      text: t('shop.card.grows', { seasons: crop.seasons.map((x) => seasonLabel(x)).join(', ') }),
    });
    lines.push({ text: t('shop.card.ripe', { n: days }) });
    if (crop.regrowDays) lines.push({ text: t('shop.card.again', { n: crop.regrowDays }) });
    const sell = items[crop.harvestItem]?.sellPrice ?? 0;
    if (sell > 0) lines.push({ text: t('shop.card.sells', { gold: fmtGold(sell) }) });
    if (greenhouse && season && !crop.seasons.includes(season as never))
      lines.push({ text: t('shop.card.glass') });
    else if (!greenhouse && tooLate(itemId, day))
      lines.push({ text: t('shop.card.late'), warn: true });
  } else if (def.type === 'sapling') {
    const tree = trees[itemId];
    if (tree) {
      lines.push({ text: t('shop.card.fruit', { season: seasonLabel(tree.season) }) });
      const sell = items[tree.fruit]?.sellPrice ?? 0;
      if (sell > 0) lines.push({ text: t('shop.card.fruitSells', { gold: fmtGold(sell) }) });
    }
  } else if (def.type === 'animal') lines.push({ text: t('shop.needsHome') });
  if (own > 0) lines.push({ text: t('shop.own', { n: own }) });
  return lines;
}
