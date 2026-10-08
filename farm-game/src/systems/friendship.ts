import { npcs } from '../data';
import type { NpcDef, NpcEvent } from '../data';
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

/** Is it this villager's birthday today? Chats and gifts count extra. */
export const isBirthday = (state: GameState, id: string): boolean => {
  const b = npcs[id]?.birthday;
  return !!b && b.season === state.time.season && b.day === state.time.day;
};

export const canChat = (state: GameState, id: string): boolean =>
  friendOf(state, id).talkedDay !== absoluteDay(state);
export const canGift = (state: GameState, id: string): boolean =>
  friendOf(state, id).giftedDay !== absoluteDay(state);

/** Friendship from outside chats and gifts (a finished job, an event). */
export function befriend(state: GameState, id: string, points: number): void {
  if (!npcs[id]) return;
  addPoints(state, id, points);
  gameEvents.emit('friendsChanged', undefined);
}

function addPoints(state: GameState, id: string, delta: number): void {
  const f = (state.friends[id] ??= blank());
  f.points = Math.max(0, Math.min(MAX_POINTS, f.points + delta));
  const best = Math.max(0, ...npcIds().map((n) => heartsOf(state, n)));
  state.stats['maxHearts'] = best;
}

/** Same line all day, a different one tomorrow, without touching the random stream. */
export function lineFor(state: GameState, id: string): string {
  const def = npcs[id] as NpcDef;
  if (isBirthday(state, id)) return 'Today is my birthday! A gift would make it perfect.';
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
  const chatPoints = isBirthday(state, id) ? CHAT_POINTS * 2 : CHAT_POINTS;
  addPoints(state, id, chatPoints);
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
  return { gained: chatPoints, gift };
}

export type GiftResult =
  { ok: true; reaction: Reaction; points: number } | { ok: false; reason: 'today' | 'invalid' };

/** Give one item. Once a day per villager; favourites are worth a lot, dislikes cost friendship. */
export function giveGift(state: GameState, id: string, ref: ItemRef): GiftResult {
  if (!canGift(state, id)) return { ok: false, reason: 'today' };
  if (!isGiftable(ref) || !removeStack(state, ref, 1)) return { ok: false, reason: 'invalid' };
  const reaction = reactionTo(id, ref);
  const base = GIFT_POINTS[reaction];
  const points = isBirthday(state, id) && base > 0 ? base * 3 : base;
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

const eventKey = (id: string, ev: string): string => `event.${id}.${ev}`;

/** The next heart event this villager has for you (earned, not yet seen), if any. */
export function pendingEvent(state: GameState, id: string): NpcEvent | null {
  const hearts = heartsOf(state, id);
  for (const ev of (npcs[id] as NpcDef).events ?? [])
    if (ev.hearts <= hearts && !state.stats[eventKey(id, ev.id)]) return ev;
  return null;
}

export type EventResult =
  | { ok: true; gold: number; item: string | null; qty: number }
  | { ok: false; reason: 'none' | 'full' };

/** Finish an event: mark it seen and hand over its reward. If the bag cannot hold it, nothing happens. */
export function completeEvent(state: GameState, id: string): EventResult {
  const ev = pendingEvent(state, id);
  if (!ev) return { ok: false, reason: 'none' };
  const qty = ev.reward.qty ?? 1;
  if (ev.reward.item && roomFor(state, ev.reward.item, qty) < qty)
    return { ok: false, reason: 'full' };
  state.stats[eventKey(id, ev.id)] = 1;
  if (ev.reward.item) addItem(state, ev.reward.item, qty);
  const gold = ev.reward.gold ?? 0;
  if (gold > 0) {
    state.money += gold;
    gameEvents.emit('moneyChanged', { delta: gold });
  }
  addStat(state, 'friendEvents');
  toast(`${(npcs[id] as NpcDef).name}: ${ev.title}`, 'good');
  gameEvents.emit('friendsChanged', undefined);
  return { ok: true, gold, item: ev.reward.item ?? null, qty: ev.reward.item ? qty : 0 };
}
