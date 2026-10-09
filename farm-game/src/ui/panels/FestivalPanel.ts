import Phaser from 'phaser';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  accepts,
  basketScore,
  DERBY_SURE_BEFORE,
  derbyBest,
  derbyHint,
  derbyScore,
  enterBasket,
  festivalToday,
  finishDerby,
  goodOf,
  hasEntered,
  modeOf,
  placeFor,
  kindOf,
  rivalScores,
  scoreOf,
  slotsOf,
  varietyBonus,
  type EnterResult,
} from '../../systems/festivals';
import { displayName, iconKey, keyOf, refOf, type ItemRef } from '../../systems/itemRef';
import { formatClock } from '../../systems/time';
import { toast } from '../../systems/events';
import { rivalName } from '../../systems/rival';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';
import { placeText } from './festivalText';

const ROWS = 4;

/**
 * The day's festival. A single-entry show takes one item; a basket festival takes up to three different
 * goods (variety scores extra); the fishing derby counts the day's best catches, wherever you fish.
 * Every entry is ranked against three rivals on the spot.
 */
export class FestivalPanel extends Modal {
  private page = 0;
  private result = '';
  /** The early derby hand-in was asked once; the next tap hands in. */
  private sure = false;
  /** Keys of the stacks picked for the basket. */
  private basket: string[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  protected build(): void {
    const s = getState();
    const today = festivalToday(s);
    this.panel();
    if (!today) {
      this.label(8, 8, 'No festival today', C.gold);
      this.label(
        8,
        24,
        'Festivals are held once a season. Check the calendar!',
        C.creamDim,
        1,
        'left',
        184,
      );
      this.closeButton();
      return;
    }
    const { def, id } = today;
    this.label(8, 8, def.name, C.gold);
    this.label(8, 20, def.blurb, C.creamDim);
    // The best rival score is the rival farmer's.
    const sorted = [...rivalScores(s, def)].sort((a, b) => b - a);
    this.label(
      8,
      32,
      `Rivals: ${rivalName()} ${fmt(sorted[0] ?? 0)}, ${sorted.slice(1).map(fmt).join(', ')}`,
      C.warn,
      1,
      'left',
      184,
    );
    if (this.result || hasEntered(s, id)) {
      this.label(
        8,
        60,
        this.result || 'You have already entered. Good luck next season!',
        C.green,
        1,
        'left',
        184,
      );
    } else if (modeOf(def) === 'derby') this.buildDerby();
    else this.buildEntries();
    this.closeButton();
  }

  /** The derby: the day's best catches so far, and a button to hand in the score. */
  private buildDerby(): void {
    const s = getState();
    const today = festivalToday(s)!;
    const best = derbyBest(s);
    const slots = slotsOf(today.def);
    this.label(8, 50, 'Best catches so far:', C.cream);
    for (let i = 0; i < slots; i++) {
      const c = best[i];
      this.label(
        8,
        64 + i * 12,
        `${i + 1}. ${c ? `${c.ref ? `${displayName(c.ref)} ` : ''}${fmt(c.value)} points` : '-'}`,
        C.creamDim,
      );
    }
    const score = derbyScore(s);
    const place = placeFor(s, today.def, score);
    this.label(8, 64 + slots * 12 + 6, `Score ${fmt(score)}  ${placeText(place)}`, C.gold);
    this.label(
      8,
      64 + slots * 12 + 20,
      `${derbyHint(today.def)} Hand in before bed.`,
      C.creamDim,
      1,
      'left',
      184,
    );
    // Handing in ends the derby for the year, so before evening the first tap only asks.
    const early = s.time.minutes < DERBY_SURE_BEFORE && !this.sure;
    this.button(
      8,
      this.panelH - 56,
      this.panelW - 16,
      24,
      this.sure ? 'Sure? Tap to hand in' : 'Hand in my catches',
      () => {
        if (early) {
          this.sure = true;
          toast(
            `Handing in ends your derby. Fish until ${formatClock(DERBY_SURE_BEFORE)}?`,
            'info',
          );
          audio.play('select');
          return this.rebuild();
        }
        this.sure = false;
        this.after(finishDerby(getState()));
      },
      this.sure ? { textColor: C.warn } : undefined,
    ).setEnabled(best.length > 0);
  }

  /** Single entry or basket: a list of goods to enter, and for a basket a Present button. */
  private buildEntries(): void {
    const s = getState();
    const today = festivalToday(s)!;
    const def = today.def;
    const basketMode = modeOf(def) === 'basket';
    const slots = slotsOf(def);
    const kinds = new Map<string, ItemRef>();
    for (const st of s.inventory.slots) if (st && accepts(def, st)) kinds.set(keyOf(st), refOf(st));
    this.basket = this.basket.filter((k) => kinds.has(k));
    const list = [...kinds.values()].sort((a, b) => scoreOf(b) - scoreOf(a));
    const pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.page = Math.min(this.page, pages - 1);
    if (list.length === 0)
      this.label(
        8,
        60,
        'You have nothing to enter. Come back with the right goods next time.',
        C.creamDim,
        1,
        'left',
        184,
      );
    let y = 46;
    if (basketMode) {
      const picked = this.basket.map((k) => kinds.get(k)!);
      const score = basketScore(def, picked);
      const bonus = Math.round(varietyBonus(def, picked) * 100);
      this.label(
        8,
        y,
        `Basket ${picked.length}/${slots}  ${fmt(score)}${bonus ? ` +${bonus}%` : ''}  ${picked.length ? placeText(placeFor(s, def, score)) : ''}`,
        C.gold,
      );
      y += 12;
    }
    for (const ref of list.slice(this.page * ROWS, (this.page + 1) * ROWS)) {
      const key = keyOf(ref);
      const score = scoreOf(ref);
      const inBasket = this.basket.includes(key);
      // One of each good: a gold pumpkin and a plain one are the same good.
      const sameGood = !inBasket && this.basket.some((k) => goodOf(kinds.get(k)!) === goodOf(ref));
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        // The row names the good's kind, so "mix it up" is something you can see.
        sub: basketMode
          ? `${kindOf(def, ref)}  ${fmt(score)}${inBasket ? '  in basket' : ''}`
          : `Score ${fmt(score)}  ${placeText(placeFor(s, def, score))}`,
        subColor: inBasket ? C.green : C.creamDim,
        buttons: [
          basketMode
            ? {
                label: inBasket ? 'Out' : 'Add',
                width: 40,
                color: inBasket ? C.warn : C.green,
                enabled: inBasket || (this.basket.length < slots && !sameGood),
                onClick: () => {
                  this.basket = inBasket
                    ? this.basket.filter((k) => k !== key)
                    : [...this.basket, key];
                  audio.play('select');
                  this.rebuild();
                },
              }
            : {
                label: 'Enter',
                width: 40,
                color: C.green,
                onClick: () => this.after(enterBasket(getState(), [ref])),
              },
        ],
      });
    }
    const by = this.panelH - 56;
    if (pages > 1) {
      this.button(8, by - 24, 40, 20, '<', () => {
        this.page = (this.page + pages - 1) % pages;
        this.rebuild();
      });
      this.button(152, by - 24, 40, 20, '>', () => {
        this.page = (this.page + 1) % pages;
        this.rebuild();
      });
    }
    if (basketMode)
      this.button(8, by, this.panelW - 16, 24, 'Present the basket', () =>
        this.after(
          enterBasket(
            getState(),
            this.basket.map((k) => kinds.get(k)!),
          ),
        ),
      ).setEnabled(this.basket.length > 0);
  }

  private after(res: EnterResult): void {
    if (!res.ok) {
      audio.play('error');
      return;
    }
    audio.play(res.place <= 3 ? 'level' : 'coin');
    haptic('success');
    this.result =
      res.place <= 3
        ? `Place ${res.place} with ${fmt(res.score)} points! You won ${fmt(res.gold)}g.`
        : `Thanks for joining! ${fmt(res.gold)}g for taking part.`;
    this.basket = [];
    this.rebuild();
  }

  override open(): void {
    this.result = '';
    this.page = 0;
    this.basket = [];
    this.sure = false;
    super.open();
  }
}
