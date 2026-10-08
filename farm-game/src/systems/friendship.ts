import { npcs } from '../data';
import type { NpcDef } from '../data';
import type { Friendship, GameState } from '../state/GameState';
import { gameEvents, toast } from './events';
import { addStat, checkGoals } from './goals';
import { addItem, removeStack, roomFor } from './inventory';
import { displayName, type ItemRef } from './itemRef';
import { items } from '../data';
import { absoluteDay } from './time';
import { isWet } from './weather';

export const POINTS_PER_HEART = 50;
export const MAX_HEARTS = 5;
const MAX_POINTS = POINTS_PER_HEART * MAX_HEARTS;

export const CHAT_POINTS = 10;
export type Reaction = 'love' | 'like' | 'neutral' | 'dislike';
export const GIFT_POINTS: Record<Reaction, number> = {
  love: 80,
  like: 45,
  neutral: 15,
  dislike: -20,
};

export const npcIds = (): string[] => Object.keys(npcs);

const blank = (): Friendship => ({ points: 0, talkedDay: 0, giftedDay: 0 });
export const friendOf = (state: GameState, id: string): Friendship => state.friends[id] ?? blank();

export const pointsOf = (state: GameState, id: string): number => friendOf(state, id).points;
export const heartsOf = (state: GameState, id: string): number =>
  Math.min(MAX_HEARTS, Math.floor(pointsOf(state, id) / POINTS_PER_HEART));

export const canChat = (state: GameState, id: string): boolean =>
  friendOf(state, id).talkedDay !== absoluteDay(state);
export const canGift = (state: GameState, id: string): boolean =>
  friendOf(state, id).giftedDay !== absoluteDay(state);

function addPoints(state: GameState, id: string, delta: number): void {
  const f = (state.friends[id] ??= blank());
  f.points = Math.max(0, Math.min(MAX_POINTS, f.points + delta));
  const best = Math.max(0, ...npcIds().map((n) => heartsOf(state, n)));
  state.stats['maxHearts'] = best;
}

/** Same line all day, a different one tomorrow, without touching the random stream. */
export function lineFor(state: GameState, id: string): string {
  const def = npcs[id] as NpcDef;
  const hearts = heartsOf(state, id);
  const pool =
    isWet(state.weather) && absoluteDay(state) % 3 === 0
      ? def.lines.rain
      : hearts >= 4
        ? def.lines.close
        : hearts >= 2
          ? def.lines.friend
          : def.lines.stranger;
  const seed = absoluteDay(state) + id.length * 7;
  return pool[seed % pool.length] as string;
}

export function reactionTo(id: string, ref: ItemRef): Reaction {
  const def = npcs[id] as NpcDef;
  if (def.loves.includes(ref.item) || (ref.of && def.loves.includes(ref.of))) return 'love';
  if (def.likes.includes(ref.item) || (ref.of && def.likes.includes(ref.of))) return 'like';
  if (def.dislikes.includes(ref.item)) return 'dislike';
  return 'neutral';
}

/** Items that make sense as presents: anything but tools, animals and placed machines. */
export const isGiftable = (ref: ItemRef): boolean => {
  const t = items[ref.item]?.type;
  return t !== undefined && t !== 'tool' && t !== 'animal' && t !== 'placeable';
};

export interface ChatResult {
  /** Points earned (0 when you already chatted today). */
  gained: number;
  /** What the villager handed over, if anything. */
  gift: { item: string; qty: number } | null;
}

/** The first chat of each day is worth friendship; from a few hearts up the villager also gives a gift. */
export function chat(state: GameState, id: string): ChatResult {
  if (!canChat(state, id)) return { gained: 0, gift: null };
  const def = npcs[id] as NpcDef;
  const f = (state.friends[id] ??= blank());
  f.talkedDay = absoluteDay(state);
  addPoints(state, id, CHAT_POINTS);
  addStat(state, 'talked');
  let gift: ChatResult['gift'] = null;
  if (heartsOf(state, id) >= def.giftHearts) {
    const g = def.gifts[absoluteDay(state) % Math.max(1, def.gifts.length)];
    if (g && roomFor(state, g.item, g.qty) >= g.qty) {
      addItem(state, g.item, g.qty);
      gift = g;
      toast(`${def.name} gave you ${g.qty} ${items[g.item]?.name ?? g.item}`, 'good');
    }
  }
  gameEvents.emit('friendsChanged', undefined);
  checkGoals(state);
  return { gained: CHAT_POINTS, gift };
}

export type GiftResult =
  { ok: true; reaction: Reaction; points: number } | { ok: false; reason: 'today' | 'invalid' };

/** Give one item. Once a day per villager; favourites are worth a lot, dislikes cost friendship. */
export function giveGift(state: GameState, id: string, ref: ItemRef): GiftResult {
  if (!canGift(state, id)) return { ok: false, reason: 'today' };
  if (!isGiftable(ref) || !removeStack(state, ref, 1)) return { ok: false, reason: 'invalid' };
  const reaction = reactionTo(id, ref);
  const points = GIFT_POINTS[reaction];
  (state.friends[id] ??= blank()).giftedDay = absoluteDay(state);
  addPoints(state, id, points);
  addStat(state, 'gifted');
  toast(
    `${npcs[id]?.name}: ${REACTION_TEXT[reaction](displayName(ref))}`,
    reaction === 'dislike' ? 'warn' : 'good',
  );
  gameEvents.emit('friendsChanged', undefined);
  checkGoals(state);
  return { ok: true, reaction, points };
}

export const REACTION_TEXT: Record<Reaction, (name: string) => string> = {
  love: (n) => `I love ${n}!!`,
  like: (n) => `${n}, how nice!`,
  neutral: () => 'Oh. Thank you.',
  dislike: () => 'Um... thanks, I guess.',
};

/** Next friendship perk the player has not reached yet, for the panel. */
export function nextPerk(
  state: GameState,
  id: string,
): { hearts: number; perks: Record<string, number> } | null {
  const hearts = heartsOf(state, id);
  const next = Object.entries((npcs[id] as NpcDef).perks)
    .map(([h, p]) => ({ hearts: Number(h), perks: p }))
    .filter((e) => e.hearts > hearts)
    .sort((a, b) => a.hearts - b.hearts)[0];
  return next ?? null;
}

/** Sum of a perk across every villager's reached heart levels. Used by `perk()` in skills.ts. */
export function friendPerk(state: GameState, key: string): number {
  let total = 0;
  for (const id of npcIds()) {
    const hearts = heartsOf(state, id);
    for (const [h, perks] of Object.entries((npcs[id] as NpcDef).perks))
      if (Number(h) <= hearts) total += perks[key] ?? 0;
  }
  return total;
}
