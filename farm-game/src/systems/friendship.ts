import { npcs } from '../data';
import type { NpcDef, NpcEvent, NpcLine } from '../data';
import type { Friendship, GameState } from '../state/GameState';
import { gameEvents, toast } from './events';
import { addStat, checkGoals } from './goals';
import { addItem, removeStack, roomFor } from './inventory';
import { displayName, type ItemRef } from './itemRef';
import { items, mail, recipes } from '../data';
import { villagerHome } from './houses';
import { absoluteDay } from './time';
import { openingLine, openingScene, valleyHolds } from './valley';
import { isWet } from './weather';
import { isMature } from './farming';
import { t } from '../i18n';
import { heartProgress, heartsFor, MAX_HEARTS, MAX_POINTS, rescaleOldPoints } from './hearts';

export { HEART_AT, MAX_HEARTS, MAX_POINTS, pointsForHearts } from './hearts';

/** A chat's friendship: the first talk of a day. Once you are friends (2 hearts) talk alone counts for less. */
export const CHAT_POINTS = 10;
export const CHAT_POINTS_FRIEND = 6;
export const CHAT_FRIEND_HEARTS = 2;
export type Reaction = 'love' | 'like' | 'neutral' | 'dislike';
/** A gift's friendship by reaction (QA round: what they love matters far more than any present). */
export const GIFT_POINTS: Record<Reaction, number> = {
  love: 80,
  like: 40,
  neutral: 10,
  dislike: -20,
};
/** Gifts a villager takes a week (days 1-7, 8-14, ...); a birthday gift never counts toward it. */
export const GIFTS_PER_WEEK = 2;
/** The same present again within this many days is worth half ("Daffodils again?"). */
export const REPEAT_DAYS = 14;
/** A silver or gold present means more: x1.25, x1.5 (liked and loved gifts only). */
export const QUALITY_GIFT = [1, 1.25, 1.5] as const;
/** This save counts friendship on the QA-round curve (new games carry it; older saves are rescaled once). */
export const FRIEND_CURVE = 'friend.curve2';

export const npcIds = (): string[] => Object.keys(npcs);
/** The villagers in the valley now (a returning one counts from the morning they come home). */
export const npcsHome = (state: Pick<GameState, 'stats'>): string[] =>
  npcIds().filter((id) => villagerHome(state, id));

const blank = (): Friendship => ({ points: 0, talkedDay: 0, giftedDay: 0 });
export const friendOf = (state: GameState, id: string): Friendship => state.friends[id] ?? blank();

export const pointsOf = (state: GameState, id: string): number => friendOf(state, id).points;
export const heartsOf = (state: GameState, id: string): number => heartsFor(pointsOf(state, id));
/** Points into the current heart and what the next costs (the sheet's bar); null at five hearts. */
export const heartBar = (state: GameState, id: string): { have: number; need: number } | null =>
  heartProgress(pointsOf(state, id));

/**
 * Saves from before the QA round counted 50 points a heart: rescale them once (no version bump, the bait round's
 * marker pattern), keeping every villager's hearts and how far they were toward the next.
 */
export function friendCurveDefaults(state: GameState): GameState {
  if (state.stats[FRIEND_CURVE]) return state;
  state.stats[FRIEND_CURVE] = 1;
  for (const f of Object.values(state.friends)) f.points = rescaleOldPoints(f.points);
  return state;
}

/** The week of the calendar a day falls in (days 1-7 are week 0). */
const weekOf = (state: GameState): number => Math.floor((absoluteDay(state) - 1) / 7);
const weekKey = (id: string): string => `giftWeek.${id}`;
const weekCountKey = (id: string): string => `giftWeekN.${id}`;

/** Gifts given to this villager this week (birthday gifts not counted). */
export function giftsThisWeek(state: GameState, id: string): number {
  return state.stats[weekKey(id)] === weekOf(state) + 1 ? (state.stats[weekCountKey(id)] ?? 0) : 0;
}

/** Gifts this villager will still take this week, not counting a birthday's. */
export const giftsLeft = (state: GameState, id: string): number =>
  Math.max(0, GIFTS_PER_WEEK - giftsThisWeek(state, id));

/** Is it this villager's birthday today? Chats and gifts count extra. */
export const isBirthday = (state: GameState, id: string): boolean => {
  const b = npcs[id]?.birthday;
  return !!b && b.season === state.time.season && b.day === state.time.day;
};

export const canChat = (state: GameState, id: string): boolean =>
  friendOf(state, id).talkedDay !== absoluteDay(state);
/** Why a gift cannot be given now: one was given today, or this week's are given (a birthday is always open). */
export function giftBlock(state: GameState, id: string): 'today' | 'week' | null {
  if (friendOf(state, id).giftedDay === absoluteDay(state)) return 'today';
  if (giftsLeft(state, id) <= 0 && !isBirthday(state, id)) return 'week';
  return null;
}
/** One gift a day, and at most `GIFTS_PER_WEEK` a week (a birthday present is always welcome). */
export const canGift = (state: GameState, id: string): boolean => giftBlock(state, id) === null;

/** Friendship from outside chats and gifts (a finished job, an event). */
export function befriend(state: GameState, id: string, points: number): void {
  if (!npcs[id]) return;
  addPoints(state, id, points);
  gameEvents.emit('friendsChanged', undefined);
}

function addPoints(state: GameState, id: string, delta: number): void {
  const f = (state.friends[id] ??= blank());
  const before = heartsOf(state, id);
  f.points = Math.max(0, Math.min(MAX_POINTS, f.points + delta));
  const after = heartsOf(state, id);
  if (after > before) gameEvents.emit('heartUp', { id, hearts: after });
  const best = Math.max(0, ...npcsHome(state).map((n) => heartsOf(state, n)));
  state.stats['maxHearts'] = best;
}

/** The text of a line, whether plain or conditioned. */
export const lineText = (l: NpcLine): string => (typeof l === 'string' ? l : l.text);

/** The lines of a group the valley's state allows today (plain lines always; conditioned ones while `when` holds). */
export const linesNow = (state: GameState, group: readonly NpcLine[]): string[] =>
  group.filter((l) => typeof l === 'string' || valleyHolds(state, l.when)).map(lineText);

/**
 * Same line all day, a different one tomorrow, without touching the random stream. The pool is the rain group on
 * some wet days, else the friendship tier; a group with no line for today's valley falls back to the tier below
 * (rain to the tier, close to friend to stranger), and a stranger always has a plain line (validated).
 */
export function lineFor(state: GameState, id: string): string {
  const def = npcs[id] as NpcDef;
  if (isBirthday(state, id)) return t('npc.birthdayLine');
  // the morning a place of theirs opens, that is all they talk about (systems/valley.ts)
  const opened = openingLine(state, id);
  if (opened) return opened;
  const hearts = heartsOf(state, id);
  const tiers: NpcLine[][] = [
    ...(isWet(state.weather) && absoluteDay(state) % 3 === 0 ? [def.lines.rain] : []),
    ...(hearts >= 4 ? [def.lines.close] : []),
    ...(hearts >= 2 ? [def.lines.friend] : []),
    def.lines.stranger,
  ];
  const pool = tiers.map((g) => linesNow(state, g)).find((p) => p.length > 0) ?? [''];
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

/** Reactions are remembered per villager and item as stats (`gift.<npc>.<item>`), 1 = dislike .. 4 = love. */
const REACTION_CODE: Record<Reaction, number> = { dislike: 1, neutral: 2, like: 3, love: 4 };
const CODE_REACTION: Reaction[] = ['neutral', 'dislike', 'neutral', 'like', 'love'];
const giftKey = (id: string, item: string): string => `gift.${id}.${item}`;

/**
 * What the player knows about how a villager feels about an item: from an earlier gift, or (from 3
 * hearts) their favourites. Null when it is still a guess. The gift list shows this, so gifts are never
 * blind twice.
 */
export function knownReaction(state: GameState, id: string, ref: ItemRef): Reaction | null {
  const code = state.stats[giftKey(id, ref.item)];
  if (code) return CODE_REACTION[code] ?? null;
  if (heartsOf(state, id) >= 3 && reactionTo(id, ref) === 'love') return 'love';
  return null;
}

/** Items that make sense as presents: anything but tools, animals, placed machines and key items. */
export const isGiftable = (ref: ItemRef): boolean => {
  const t = items[ref.item]?.type;
  return t !== undefined && t !== 'tool' && t !== 'animal' && t !== 'placeable' && t !== 'key';
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
  const base = heartsOf(state, id) >= CHAT_FRIEND_HEARTS ? CHAT_POINTS_FRIEND : CHAT_POINTS;
  const chatPoints = isBirthday(state, id) ? base * 2 : base;
  addPoints(state, id, chatPoints);
  addStat(state, 'talked');
  let gift: ChatResult['gift'] = null;
  if (heartsOf(state, id) >= def.giftHearts) {
    const g = def.gifts[absoluteDay(state) % Math.max(1, def.gifts.length)];
    if (g && roomFor(state, g.item, g.qty) >= g.qty) {
      addItem(state, g.item, g.qty);
      gift = g;
      toast(
        t('npc.gaveYou', { name: def.name, count: g.qty, item: items[g.item]?.name ?? g.item }),
        'good',
      );
    }
  }
  gameEvents.emit('friendsChanged', undefined);
  checkGoals(state);
  return { gained: chatPoints, gift };
}

export type GiftResult =
  | { ok: true; reaction: Reaction; points: number; repeat: boolean }
  | { ok: false; reason: 'today' | 'week' | 'invalid' };

const lastGiftKey = (id: string, item: string): string => `giftDay.${id}.${item}`;

/** Was this item given to this villager in the last `REPEAT_DAYS` days? */
export function isRepeatGift(state: GameState, id: string, item: string): boolean {
  const last = state.stats[lastGiftKey(id, item)];
  return last !== undefined && absoluteDay(state) - last < REPEAT_DAYS;
}

/** What a gift is worth now: the reaction, then its quality, half for a repeat, x3 on a birthday (welcome ones). */
export function giftPoints(state: GameState, id: string, ref: ItemRef): number {
  const base = GIFT_POINTS[reactionTo(id, ref)];
  if (base <= 0) return base;
  let points = base * (QUALITY_GIFT[ref.q ?? 0] ?? 1);
  if (isRepeatGift(state, id, ref.item)) points /= 2;
  if (isBirthday(state, id)) points *= 3;
  return Math.round(points);
}

/**
 * Give one item: once a day and twice a week per villager (a birthday present is extra). Favourites are worth a
 * lot, the same present twice in two weeks half as much, and dislikes cost friendship.
 */
export function giveGift(state: GameState, id: string, ref: ItemRef): GiftResult {
  const block = giftBlock(state, id);
  if (block) return { ok: false, reason: block };
  if (!isGiftable(ref)) return { ok: false, reason: 'invalid' };
  const reaction = reactionTo(id, ref);
  const repeat = GIFT_POINTS[reaction] > 0 && isRepeatGift(state, id, ref.item);
  const points = giftPoints(state, id, ref);
  if (!removeStack(state, ref, 1)) return { ok: false, reason: 'invalid' };
  (state.friends[id] ??= blank()).giftedDay = absoluteDay(state);
  if (!isBirthday(state, id)) {
    const n = giftsThisWeek(state, id);
    state.stats[weekKey(id)] = weekOf(state) + 1;
    state.stats[weekCountKey(id)] = n + 1;
  }
  state.stats[lastGiftKey(id, ref.item)] = absoluteDay(state);
  state.stats[giftKey(id, ref.item)] = REACTION_CODE[reaction];
  addPoints(state, id, points);
  addStat(state, 'gifted');
  if (reaction === 'love' || reaction === 'like') addStat(state, 'likedGifts');
  const said = repeat
    ? t('npc.reactAgain', { item: displayName(ref) })
    : REACTION_TEXT[reaction](displayName(ref));
  toast(`${npcs[id]?.name}: ${said}`, reaction === 'dislike' ? 'warn' : 'good');
  gameEvents.emit('friendsChanged', undefined);
  checkGoals(state);
  return { ok: true, reaction, points, repeat };
}

export const REACTION_TEXT: Record<Reaction, (name: string) => string> = {
  love: (n) => t('npc.reactLove', { item: n }),
  like: (n) => t('npc.reactLike', { item: n }),
  neutral: () => t('npc.reactNeutral'),
  dislike: () => t('npc.reactDislike'),
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

/** Everything one heart level with a villager brings (QA round: every heart is worth having, and says so). */
export interface HeartRewards {
  hearts: number;
  perks: Record<string, number>;
  /** A heart scene plays (their `events`). */
  scene: boolean;
  /** A letter arrives (a `mail.json` letter on that heart). */
  letter: boolean;
  /** They start handing over a small gift on your first chat of the day. */
  dailyGift: boolean;
  /** Their favourites show on their sheet and in the gift list. */
  favourites: boolean;
  /** Recipes they teach (ids). */
  recipes: string[];
}

/** The heart at which a villager's loved gifts are known to you (systems/friendship.ts `knownReaction`). */
export const FAVOURITES_HEARTS = 3;

/** What reaching `hearts` with this villager brings. */
export function heartRewards(id: string, hearts: number): HeartRewards {
  const def = npcs[id] as NpcDef;
  return {
    hearts,
    perks: def.perks[String(hearts)] ?? {},
    scene: (def.events ?? []).some((e) => e.hearts === hearts),
    letter: mail.letters.some((l) => l.when.npc === id && (l.when.hearts ?? 1) === hearts),
    dailyGift: def.giftHearts === hearts && def.gifts.length > 0,
    favourites: hearts === FAVOURITES_HEARTS,
    recipes: Object.entries(recipes)
      .filter(([, r]) => r.friend?.npc === id && r.friend.hearts === hearts)
      .map(([rid]) => rid),
  };
}

/** The next heart's rewards with this villager, or null at five hearts. */
export function nextHeart(state: GameState, id: string): HeartRewards | null {
  const hearts = heartsOf(state, id);
  return hearts >= MAX_HEARTS ? null : heartRewards(id, hearts + 1);
}

/** Sum of a perk across every villager's reached heart levels. Used by `perk()` in skills.ts. */
export function friendPerk(state: GameState, key: string): number {
  let total = 0;
  for (const id of npcsHome(state)) {
    const hearts = heartsOf(state, id);
    for (const [h, perks] of Object.entries((npcs[id] as NpcDef).perks))
      if (Number(h) <= hearts) total += perks[key] ?? 0;
  }
  return total;
}

const eventKey = (id: string, ev: string): string => `event.${id}.${ev}`;

/** The next heart event this villager has for you (earned, not yet seen), if any. */
export function pendingEvent(state: GameState, id: string): NpcEvent | null {
  // a place's opening morning: its villager's three lines, as a scene (systems/valley.ts)
  const opening = openingScene(state, id);
  if (opening && !state.stats[eventKey(id, opening.id)]) return opening;
  const hearts = heartsOf(state, id);
  for (const ev of (npcs[id] as NpcDef).events ?? [])
    if (ev.hearts <= hearts && !state.stats[eventKey(id, ev.id)] && valleyHolds(state, ev.when))
      return ev;
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
  // a retelling of a scene this save already saw (Finn's "The Heron" for "A secret spot") pays and counts nothing twice
  const retold = !!ev.replaces && !!state.stats[eventKey(id, ev.replaces)];
  if (ev.reward.item && !retold) addItem(state, ev.reward.item, qty);
  const gold = retold ? 0 : (ev.reward.gold ?? 0);
  if (gold > 0) {
    state.money += gold;
    gameEvents.emit('moneyChanged', { delta: gold });
  }
  // an opening scene is the place's, not a heart event (the heart-event goal never counts it)
  if (!ev.id.startsWith('opening.') && !retold) addStat(state, 'friendEvents');
  toast(`${(npcs[id] as NpcDef).name}: ${ev.title}`, 'good');
  gameEvents.emit('friendsChanged', undefined);
  const item = retold ? null : (ev.reward.item ?? null);
  return { ok: true, gold, item, qty: item ? qty : 0 };
}

/**
 * A friend's help on the farm (perk `waterHelp`, Rosa at five hearts): on a dry morning she waters up to that many
 * dry, growing crops, in a fixed order (no random draw). Returns how many she watered.
 */
export function waterHelp(state: GameState): number {
  const n = Math.floor(friendPerk(state, 'waterHelp'));
  if (n <= 0 || isWet(state.weather)) return 0;
  let done = 0;
  for (const key of Object.keys(state.farm.tiles).sort()) {
    if (done >= n) break;
    const soil = state.farm.tiles[key]!;
    if (!soil.crop || soil.watered || isMature(soil.crop)) continue;
    soil.watered = true;
    done += 1;
  }
  if (done > 0) gameEvents.emit('farmChanged', undefined);
  return done;
}
