import { festivals, items, mail, npcs } from '../data';
import type { LetterDef } from '../data';
import type { GameState, Letter } from '../state/GameState';
import { SEASONS } from '../state/GameState';
import { gameEvents } from './events';
import { heartsOf } from './friendship';
import { villagerHome } from './houses';
import { stat } from './goals';
import { addItem, removeStack, roomFor } from './inventory';
import { absoluteDay, seasonLabel } from './time';
import { t } from '../i18n';

/** The mailbox keeps this many letters; the oldest read ones go first. */
export const MAILBOX_SIZE = 24;

const sentKey = (id: string): string => `mail.${id}`;

/** Put a letter in the mailbox (unread). Returns it. */
export function sendLetter(
  state: GameState,
  l: { from: string; title: string; text: string; gift?: { item: string; qty: number } },
): Letter {
  const letter: Letter = {
    id: state.mail.next++,
    from: l.from,
    title: l.title,
    text: l.text,
    day: absoluteDay(state),
    read: false,
    taken: false,
    ...(l.gift ? { gift: { ...l.gift } } : {}),
  };
  state.mail.list.push(letter);
  // Keep the box small: drop the oldest read letters (never an unread one, never an untaken gift).
  while (state.mail.list.length > MAILBOX_SIZE) {
    const i = state.mail.list.findIndex((x) => x.read && (!x.gift || x.taken));
    if (i < 0) break;
    state.mail.list.splice(i, 1);
  }
  gameEvents.emit('mailChanged', undefined);
  return letter;
}

export const unreadCount = (state: GameState): number =>
  state.mail.list.filter((l) => !l.read || (l.gift && !l.taken)).length;

/** Does a data letter's condition hold today? */
export function letterDue(state: GameState, def: LetterDef): boolean {
  const w = def.when;
  if (w.day !== undefined && absoluteDay(state) < w.day) return false;
  if (w.stat !== undefined && stat(state, w.stat) < (w.min ?? 1)) return false;
  if (w.npc !== undefined && heartsOf(state, w.npc) < (w.hearts ?? 1)) return false;
  if (w.season !== undefined && state.time.season !== w.season) return false;
  if (w.date !== undefined && state.time.day !== w.date) return false;
  return true;
}

/** Send every data letter whose time has come (each only once, remembered as a `mail.<id>` stat). */
export function deliverDueLetters(state: GameState): number {
  let n = 0;
  for (const def of mail.letters) {
    if (state.stats[sentKey(def.id)] || !letterDue(state, def)) continue;
    state.stats[sentKey(def.id)] = 1;
    sendLetter(state, def);
    n += 1;
  }
  return n;
}

/** Letters written from the calendar: a festival notice and a birthday hint the day before. */
export function deliverCalendarLetters(state: GameState): number {
  let n = 0;
  const now = state.time;
  for (const [id, f] of Object.entries(festivals)) {
    if (f.season !== now.season || f.day !== now.day + 1) continue;
    const key = `mail.fest.${id}.y${now.year}`;
    if (state.stats[key]) continue;
    state.stats[key] = 1;
    sendLetter(state, {
      from: 'mara',
      title: t('mail.festTitle', { festival: f.name }),
      text: t('mail.festText', { festival: f.name, blurb: f.blurb }),
    });
    n += 1;
  }
  for (const [id, def] of Object.entries(npcs)) {
    const b = def.birthday;
    if (!b || b.season !== now.season || b.day !== now.day + 1 || !villagerHome(state, id))
      continue;
    const key = `mail.bday.${id}.y${now.year}`;
    if (state.stats[key]) continue;
    state.stats[key] = 1;
    // A birthday letter gives away one favourite, so a gift tomorrow is never a guess.
    const fav = items[def.loves[(now.year - 1) % Math.max(1, def.loves.length)] ?? '']?.name;
    const writer = Object.keys(npcs).find((n) => n !== id && !npcs[n]?.arrives) ?? id;
    sendLetter(state, {
      from: writer,
      title: t('mail.bdayTitle', { name: def.name }),
      text: t('mail.bdayText', {
        name: def.name,
        fav: fav ? t('mail.bdayFav', { item: fav }) : '',
      }),
    });
    n += 1;
  }
  return n;
}

/** Mark a letter read. */
export function readLetter(state: GameState, id: number): Letter | null {
  const l = state.mail.list.find((x) => x.id === id);
  if (!l) return null;
  if (!l.read) {
    l.read = true;
    gameEvents.emit('mailChanged', undefined);
  }
  return l;
}

/** Take the gift enclosed in a letter into the bag (all or nothing). */
export function takeGift(state: GameState, id: number): 'ok' | 'none' | 'full' {
  const l = state.mail.list.find((x) => x.id === id);
  if (!l?.gift || l.taken) return 'none';
  if (roomFor(state, l.gift.item, l.gift.qty) < l.gift.qty) return 'full';
  addItem(state, l.gift.item, l.gift.qty);
  // What comes with it (the journal in Ilse's tin) goes in too, or nothing does.
  const extras = items[l.gift.item]?.comesWith ?? [];
  const added: { item: string; qty: number }[] = [{ item: l.gift.item, qty: l.gift.qty }];
  for (const w of extras) {
    if (roomFor(state, w.item, w.qty) < w.qty) {
      for (const a of added) removeStack(state, { item: a.item }, a.qty);
      return 'full';
    }
    addItem(state, w.item, w.qty);
    added.push(w);
  }
  l.taken = true;
  l.read = true;
  gameEvents.emit('mailChanged', undefined);
  return 'ok';
}

/** "Spring 3" for a letter's absolute day. */
export function letterDate(day: number, seasonLength: number): string {
  const d = day - 1;
  const season = SEASONS[Math.floor(d / seasonLength) % SEASONS.length] ?? 'spring';
  return `${seasonLabel(season)} ${(d % seasonLength) + 1}`;
}

/** Where the mailbox stands, and whether a map tile is it. */
export const mailboxAt = (map: string, tx: number, ty: number): boolean =>
  mail.mailbox.map === map && mail.mailbox.tx === tx && mail.mailbox.ty === ty;
