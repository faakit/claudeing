import { festivals } from '../data';
import type { FestivalDef } from '../data';
import { items } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { refOf, sellValue, type ItemRef } from './itemRef';
import { removeStack } from './inventory';
import { perk } from './skills';

/** Today's festival, if the calendar says so. */
export function festivalToday(state: GameState): { id: string; def: FestivalDef } | null {
  for (const [id, def] of Object.entries(festivals))
    if (def.season === state.time.season && def.day === state.time.day) return { id, def };
  return null;
}

const entryKey = (state: GameState, id: string): string => `fest.${id}.y${state.time.year}`;

export const hasEntered = (state: GameState, id: string): boolean =>
  !!state.stats[entryKey(state, id)];

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

/** Hand in one item. One entry per festival; the better it scores, the better the place and the prize. */
export function enterFestival(state: GameState, ref: ItemRef): EnterResult {
  const today = festivalToday(state);
  if (!today) return { ok: false, reason: 'no_festival' };
  if (hasEntered(state, today.id)) return { ok: false, reason: 'entered' };
  const r = refOf(ref);
  if (!accepts(today.def, r) || !removeStack(state, r, 1)) return { ok: false, reason: 'invalid' };
  const score = scoreOf(r);
  const place = placeFor(state, today.def, score);
  const gold =
    place <= 3
      ? Math.round(
          (today.def.prizes[place - 1] as number) *
            (1 + 0.25 * (state.time.year - 1)) *
            (1 + perk(state, 'festivalPrize')), // the Fair Hall project
        )
      : today.def.consolation;
  state.stats[entryKey(state, today.id)] = 1;
  state.money += gold;
  gameEvents.emit('moneyChanged', { delta: gold });
  addStat(state, 'festivals');
  if (place === 1) addStat(state, 'festivalWins');
  toast(
    place <= 3
      ? `${today.def.name}: place ${place}! +${gold}g`
      : `${today.def.name}: thanks for joining! +${gold}g`,
    'good',
  );
  return { ok: true, place, gold, score };
}
