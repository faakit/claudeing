import { festivals, game, items } from '../data';
import type { FestivalDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { keyOf, refOf, sellValue, type ItemRef } from './itemRef';
import { removeStack } from './inventory';
import { sendLetter } from './mail';
import { perk } from './skills';

/** Today's festival, if the calendar says so. */
export function festivalToday(state: GameState): { id: string; def: FestivalDef } | null {
  for (const [id, def] of Object.entries(festivals))
    if (def.season === state.time.season && def.day === state.time.day) return { id, def };
  return null;
}

export const modeOf = (def: FestivalDef): 'single' | 'basket' | 'derby' => def.mode ?? 'single';
export const slotsOf = (def: FestivalDef): number =>
  modeOf(def) === 'single' ? 1 : (def.slots ?? 3);

const yearKey = (state: GameState, id: string): string => `fest.${id}.y${state.time.year}`;

export const hasEntered = (state: GameState, id: string): boolean =>
  !!state.stats[yearKey(state, id)];

/** May this stack be entered? */
export function accepts(def: FestivalDef, ref: ItemRef): boolean {
  const it = items[ref.item];
  if (!it) return false;
  const a = def.accept;
  return (
    !!a.items?.includes(ref.item) ||
    (!!a.types && a.types.includes(it.type)) ||
    (!!a.families && !!it.family && a.families.includes(it.family))
  );
}

/** What an entry scores: its sell value, so quality and rarity count. */
export const scoreOf = (ref: ItemRef): number => sellValue(ref);

/** Variety bonus of a basket: +15% for each kind of good (family, or type) beyond the first. */
export const VARIETY_BONUS = 0.15;

/** A basket's score: the sum of its goods, raised for variety (three different kinds score 30% more). */
export function basketScore(refs: readonly ItemRef[]): number {
  const kinds = new Set(refs.map((r) => items[r.item]?.family ?? items[r.item]?.type ?? r.item));
  const sum = refs.reduce((n, r) => n + scoreOf(r), 0);
  return Math.round(sum * (1 + VARIETY_BONUS * Math.max(0, kinds.size - 1)));
}

/** The rivals' scores this year: a baseline that grows 20% a year, nudged a little by season so years differ. */
export function rivalScores(state: GameState, def: FestivalDef): number[] {
  const grow = 1 + 0.2 * (state.time.year - 1);
  return def.rivals.map((r, i) =>
    Math.round(r * grow * (0.94 + ((state.time.year * 7 + i * 3) % 5) * 0.03)),
  );
}

/** 1-based place the score would take among the rivals (ties go to the player). */
export function placeFor(state: GameState, def: FestivalDef, score: number): number {
  return 1 + rivalScores(state, def).filter((r) => r > score).length;
}

export type EnterResult =
  | { ok: true; place: number; gold: number; score: number }
  | { ok: false; reason: 'no_festival' | 'entered' | 'invalid' };

/** Rank a score, pay the prize, remember the entry. Shared by every festival mode. */
function award(
  state: GameState,
  today: { id: string; def: FestivalDef },
  score: number,
): EnterResult {
  const place = placeFor(state, today.def, score);
  const gold =
    place <= 3
      ? Math.round(
          (today.def.prizes[place - 1] as number) *
            (1 + 0.25 * (state.time.year - 1)) *
            (1 + perk(state, 'festivalPrize')), // the Fair Hall project
        )
      : today.def.consolation;
  state.stats[yearKey(state, today.id)] = 1;
  state.money += gold;
  gameEvents.emit('moneyChanged', { delta: gold });
  addStat(state, 'festivals');
  if (place === 1) {
    addStat(state, 'festivalWins');
    // The rival farmer is the top score to beat; beating them earns a grudging letter.
    sendLetter(state, {
      from: game.rival.npc,
      title: `About the ${today.def.name}`,
      text: `First place at the ${today.def.name}. Fine, you earned it. Enjoy it while it lasts!`,
    });
  }
  toast(
    place <= 3
      ? `${today.def.name}: place ${place}! +${gold}g`
      : `${today.def.name}: thanks for joining! +${gold}g`,
    'good',
  );
  return { ok: true, place, gold, score };
}

/**
 * Hand in goods: one item for a single-entry festival, up to `slots` different items for a basket.
 * One entry per festival a year; the goods are given away. A derby is judged with `finishDerby`.
 */
export function enterBasket(state: GameState, refs: readonly ItemRef[]): EnterResult {
  const today = festivalToday(state);
  if (!today) return { ok: false, reason: 'no_festival' };
  if (hasEntered(state, today.id)) return { ok: false, reason: 'entered' };
  const list = refs.map(refOf);
  const distinct = new Set(list.map(keyOf)).size === list.length;
  const mode = modeOf(today.def);
  if (
    mode === 'derby' ||
    list.length === 0 ||
    list.length > slotsOf(today.def) ||
    !distinct ||
    list.some((r) => !accepts(today.def, r))
  )
    return { ok: false, reason: 'invalid' };
  // All or nothing: check every good is there before taking any.
  const have = (r: ItemRef) =>
    state.inventory.slots.some((s) => !!s && keyOf(refOf(s)) === keyOf(r) && s.qty > 0);
  if (!list.every(have)) return { ok: false, reason: 'invalid' };
  for (const r of list) removeStack(state, r, 1);
  return award(state, today, mode === 'single' ? scoreOf(list[0]!) : basketScore(list));
}

/** Enter a single item (a one-item basket at a basket festival). */
export const enterFestival = (state: GameState, ref: ItemRef): EnterResult =>
  enterBasket(state, [ref]);

// ---- the fishing derby: your best catches of the day count, and the fish stay yours ----

const catchKey = (state: GameState, id: string, i: number): string =>
  `${yearKey(state, id)}.catch${i}`;

/** Values of today's best derby catches, best first. */
export function derbyCatches(state: GameState): number[] {
  const today = festivalToday(state);
  if (!today || modeOf(today.def) !== 'derby') return [];
  const out: number[] = [];
  for (let i = 0; i < slotsOf(today.def); i++) {
    const v = state.stats[catchKey(state, today.id, i)];
    if (v) out.push(v);
  }
  return out;
}

export const derbyScore = (state: GameState): number =>
  derbyCatches(state).reduce((a, b) => a + b, 0);

/** Called for every fish caught: on derby day (before handing in) it may join the best catches. */
export function recordCatch(state: GameState, ref: ItemRef): boolean {
  const today = festivalToday(state);
  if (!today || modeOf(today.def) !== 'derby' || hasEntered(state, today.id)) return false;
  if (!accepts(today.def, ref)) return false;
  const before = derbyScore(state);
  const kept = [...derbyCatches(state), scoreOf(ref)]
    .sort((a, b) => b - a)
    .slice(0, slotsOf(today.def));
  kept.forEach((v, i) => (state.stats[catchKey(state, today.id, i)] = v));
  return derbyScore(state) > before;
}

/** Hand in the derby score (at least one catch). */
export function finishDerby(state: GameState): EnterResult {
  const today = festivalToday(state);
  if (!today) return { ok: false, reason: 'no_festival' };
  if (modeOf(today.def) !== 'derby') return { ok: false, reason: 'invalid' };
  if (hasEntered(state, today.id)) return { ok: false, reason: 'entered' };
  if (derbyCatches(state).length === 0) return { ok: false, reason: 'invalid' };
  return award(state, today, derbyScore(state));
}
