/**
 * Houses rebuilt with timber, and the families who come home to them (WORLD-PLAN 5.2, MILESTONES M7). Pure, no
 * Phaser.
 *
 * `house.<id>` counts the timber delivered (Interact, or Action with timber, at its door: it takes what you carry, up
 * to what it still needs). Timber goes in only once the house's place is restored. Finished (`house.<id>.done` holds
 * the day), its family arrives the next morning (`arrived.<family>` holds that day). A villager with `arrives` is not
 * drawn, scheduled or counted before then (`villagerHome`).
 */
import { npcs, valley, type HouseDef } from '../data';
import type { GameState } from '../state/GameState';
import { countItem, removeItem } from './inventory';
import { absoluteDay } from './time';
import { gameEvents, toast } from './events';
import { t } from '../i18n';
import { TIMBER_ITEM } from './drift';

type Stats = Pick<GameState, 'stats'>;
const st = (s: Stats, k: string): number => s.stats[k] ?? 0;

export const houseIds = (): string[] => Object.keys(valley.houses ?? {});
export const houseDef = (id: string): HouseDef | undefined => valley.houses?.[id];
export const houseStat = (id: string): string => `house.${id}`;
export const arrivedStat = (family: string): string => `arrived.${family}`;

/** Timber delivered so far. */
export const timberIn = (s: Stats, id: string): number => st(s, houseStat(id));
export const houseDone = (s: Stats, id: string): boolean => {
  const h = houseDef(id);
  return !!h && timberIn(s, id) >= h.timber;
};
/** Its place is restored, so it takes timber. */
export const houseOpen = (s: Stats, id: string): boolean => {
  const h = houseDef(id);
  return !!h && st(s, `place.${h.place}`) >= 3;
};
/** Its family is home. */
export const familyHome = (s: Stats, id: string): boolean => {
  const h = houseDef(id);
  return !!h && st(s, arrivedStat(h.family)) > 0;
};

/** The house standing on this map tile's door, if any. */
export function houseAt(map: string, tx: number, ty: number): string | null {
  for (const [id, h] of Object.entries(valley.houses ?? {}))
    if (h.map === map && h.door && h.door[0] === tx && h.door[1] === ty) return id;
  return null;
}

/**
 * The scaffolding sprite now (index 0-3 into `sprites`), or null for none: no timber yet, or the family home (the
 * town's `marls` stage shows the finished house). Stages by share of the timber: 0-2 while building, 3 built.
 */
export function houseStage(s: Stats, id: string): number | null {
  const h = houseDef(id);
  if (!h) return null;
  const n = timberIn(s, id);
  if (n <= 0 || familyHome(s, id)) return null;
  if (n >= h.timber) return 3;
  if (h.timber <= 1) return 0;
  return Math.min(2, Math.floor(((n - 1) * 3) / (h.timber - 1)));
}

export type DeliverRefusal = 'closed' | 'done' | 'none';

/**
 * Give the house the timber you carry, up to what it still needs. Refused (nothing changes) before its place is
 * restored, once it is finished, or with no timber in the bag.
 */
export function deliverTimber(
  s: GameState,
  id: string,
):
  | { ok: true; given: number; total: number; need: number; done: boolean }
  | { ok: false; reason: DeliverRefusal } {
  const h = houseDef(id);
  if (!h || !houseOpen(s, id)) return { ok: false, reason: 'closed' };
  if (houseDone(s, id)) return { ok: false, reason: 'done' };
  const carried = countItem(s, TIMBER_ITEM);
  if (carried <= 0) return { ok: false, reason: 'none' };
  const given = Math.min(carried, h.timber - timberIn(s, id));
  removeItem(s, TIMBER_ITEM, given);
  const total = timberIn(s, id) + given;
  s.stats[houseStat(id)] = total;
  const done = total >= h.timber;
  if (done) s.stats[`${houseStat(id)}.done`] = absoluteDay(s);
  s.stats['timberGiven'] = st(s, 'timberGiven') + given;
  return { ok: true, given, total, need: h.timber, done };
}

/**
 * The morning's homecomings: a family whose house was finished on an earlier day and whose place is restored comes
 * home (`arrived.<family>` = today). Returns the houses whose family arrived.
 */
export function arrivals(s: GameState): string[] {
  const today = absoluteDay(s);
  const out: string[] = [];
  for (const [id, h] of Object.entries(valley.houses ?? {})) {
    if (st(s, arrivedStat(h.family)) > 0 || !houseDone(s, id) || !houseOpen(s, id)) continue;
    const doneDay = st(s, `${houseStat(id)}.done`);
    if (doneDay >= today) continue; // the morning after it is finished
    s.stats[arrivedStat(h.family)] = today;
    out.push(id);
  }
  return out;
}

/** The villager who comes home to this house (Senna to the Marls'), if any. */
export function villagerOf(house: string): string | null {
  for (const [id, n] of Object.entries(npcs)) if (n.arrives?.house === house) return id;
  return null;
}

/**
 * Is this villager in the valley? Everyone who stayed is; a returning villager only from the morning their family
 * arrives (not drawn, scheduled, written to or counted before).
 */
export function villagerHome(s: Stats | undefined, id: string): boolean {
  const a = npcs[id]?.arrives;
  if (!a) return true;
  const h = houseDef(a.house);
  return !!s && !!h && st(s, arrivedStat(h.family)) > 0;
}

/** The arrival's banner is due (the first time in town on or after the arrival day). Once per family. */
export const homecomingDue = (s: Stats, id: string): boolean => {
  const h = houseDef(id);
  return !!h && familyHome(s, id) && !st(s, `${arrivedStat(h.family)}.seen`);
};
export function takeHomecoming(s: GameState, id: string): boolean {
  if (!homecomingDue(s, id)) return false;
  s.stats[`${arrivedStat(houseDef(id)!.family)}.seen`] = 1;
  return true;
}

/** The lit window's first evening (audio's `houseLit`): once per house. */
export function takeHouseLit(s: GameState, id: string): boolean {
  if (!familyHome(s, id) || st(s, `${houseStat(id)}.lit`)) return false;
  s.stats[`${houseStat(id)}.lit`] = 1;
  return true;
}

/** What the house's door says now (boarded, waiting for the family, home). */
export function houseText(s: Stats, id: string): string {
  const h = houseDef(id);
  if (!h) return '';
  if (familyHome(s, id)) return h.home ?? h.name;
  if (houseDone(s, id)) return h.built ?? h.name;
  return h.boarded ?? h.name;
}

/** Give a house the timber you carry; a toast says how it stands. True when it took some. */
export function giveTimber(state: GameState, id: string): boolean {
  const h = houseDef(id);
  if (!h) return false;
  const res = deliverTimber(state, id);
  if (!res.ok) {
    if (res.reason === 'none')
      toast(
        t('house.needs', { name: h.name, count: h.timber - (state.stats[`house.${id}`] ?? 0) }),
        'info',
      );
    return false;
  }
  gameEvents.emit('inventoryChanged', undefined);
  toast(
    res.done
      ? t('house.done', { name: h.name })
      : t('house.given', { n: res.given, name: h.name, total: res.total, need: res.need }),
    'good',
  );
  return true;
}

/**
 * THE VALLEY's rows for the houses being rebuilt (Menu > Goal): a house whose place is restored and whose family is
 * not home yet, with its timber ("The Marls' house: 2 of 6 timber").
 */
export function houseRows(s: Stats): { place: string; name: string; next: string }[] {
  const out: { place: string; name: string; next: string }[] = [];
  for (const [id, h] of Object.entries(valley.houses ?? {})) {
    if (!houseOpen(s, id) || familyHome(s, id) || !h.map) continue;
    out.push({
      place: `house.${id}`,
      name: h.name,
      next: houseDone(s, id)
        ? t('house.rowDone')
        : t('house.row', { n: timberIn(s, id), of: h.timber }),
    });
  }
  return out;
}
