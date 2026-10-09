import Phaser from 'phaser';
import { npcs, items } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  canGift,
  chat,
  completeEvent,
  giveGift,
  heartsOf,
  isBirthday,
  isGiftable,
  knownReaction,
  lineFor,
  MAX_HEARTS,
  nextPerk,
  pendingEvent,
  POINTS_PER_HEART,
  pointsOf,
} from '../../systems/friendship';
import { keyOf, displayName, iconKey, refOf, sellValue, type ItemRef } from '../../systems/itemRef';
import { countStack } from '../../systems/inventory';
import { gameEvents, toast } from '../../systems/events';
import { fitText } from '../font';
import { C } from '../theme';
import { drawBar, Modal } from '../widgets';
import { perkLine } from './perkText';
import { giftNote, giftSub } from './giftText';

const ROWS = 5;

/** A villager's sheet: friendship hearts, today's line, gifts, and (for the shopkeeper) a Shop button. */
export class NpcPanel extends Modal {
  private id = 'mara';
  private mode: 'talk' | 'gift' | 'event' = 'talk';
  private evLine = 0;
  private page = 0;
  private line = '';
  private gained = 0;
  private reply = '';

  constructor(scene: Phaser.Scene) {
    super(scene, 236);
  }

  openFor(id: string): void {
    if (!npcs[id]) return;
    this.id = id;
    this.mode = 'talk';
    this.page = 0;
    this.reply = '';
    const res = chat(getState(), id);
    this.gained = res.gained;
    this.line = lineFor(getState(), id);
    this.evLine = 0;
    if (pendingEvent(getState(), id)) this.mode = 'event';
    if (res.gained > 0) {
      haptic('success');
      audio.play('heart');
    }
    this.open();
  }

  protected build(): void {
    const s = getState();
    const def = npcs[this.id]!;
    this.panel();
    this.label(8, 8, def.name, C.gold);
    this.label(
      8,
      20,
      isBirthday(s, this.id) ? 'Birthday today!' : fitText(def.blurb, 150),
      isBirthday(s, this.id) ? C.gold : C.creamDim,
    );
    const hearts = heartsOf(s, this.id);
    for (let i = 0; i < MAX_HEARTS; i++)
      this.icon(150 + i * 9, 13, 'ui_heart').setTint(i < hearts ? 0xe0574a : 0x4a4560);
    const g = this.scene.add.graphics();
    this.content.add(g);
    const into = pointsOf(s, this.id) % POINTS_PER_HEART;
    drawBar(g, 148, 20, 48, 5, hearts >= MAX_HEARTS ? 1 : into / POINTS_PER_HEART, C.red);

    if (this.mode === 'event') this.buildEvent();
    else if (this.mode === 'talk') this.buildTalk(hearts);
    else this.buildGift();
    this.closeButton();
  }

  /** A heart event: a short scene, one line at a time, ending in a reward. */
  private buildEvent(): void {
    const s = getState();
    const ev = pendingEvent(s, this.id);
    if (!ev) {
      this.mode = 'talk';
      return this.buildTalk(heartsOf(s, this.id));
    }
    const last = this.evLine >= ev.lines.length - 1;
    this.label(8, 38, ev.title.toUpperCase(), C.warn);
    this.label(8, 56, `"${ev.lines[this.evLine]}"`, C.cream, 1, 'left', 184);
    this.label(8, 120, `${this.evLine + 1}/${ev.lines.length}`, C.creamDim);
    this.button(
      8,
      this.panelH - 62,
      this.panelW - 16,
      24,
      last ? 'Accept' : 'Next',
      () => {
        if (!last) {
          this.evLine += 1;
          return this.rebuild();
        }
        const res = completeEvent(getState(), this.id);
        if (!res.ok) {
          audio.play('error');
          toast('Make room in your bag first.', 'warn');
          return;
        }
        audio.play('level');
        haptic('success');
        this.mode = 'talk';
        this.gained = 0;
        this.reply = res.gold > 0 ? `Take this: ${res.gold} gold.` : 'I hope you like it!';
        this.rebuild();
      },
      { textColor: C.green, rim: C.green },
    );
  }

  private buildTalk(hearts: number): void {
    const s = getState();
    const def = npcs[this.id]!;
    this.label(8, 42, `"${this.reply || this.line}"`, C.cream, 1, 'left', 184);
    if (this.gained > 0) this.label(8, 88, `+${this.gained} friendship`, C.green);
    const next = nextPerk(s, this.id);
    this.label(
      8,
      104,
      next
        ? `At ${next.hearts} hearts: ${perkLine(next.perks)}`
        : 'Best friends! All perks unlocked.',
      next ? C.creamDim : C.green,
      1,
      'left',
      184,
    );
    if (hearts >= 3) {
      const loves = def.loves.map((i) => items[i]?.name ?? i).join(', ');
      this.label(8, 128, `Loves: ${loves}`, C.warn, 1, 'left', 184);
    } else
      this.label(8, 128, 'Reach 3 hearts to learn their favourites.', C.creamDim, 1, 'left', 184);
    const y = this.panelH - 62;
    this.button(
      8,
      y,
      def.role === 'shop' ? 58 : 90,
      24,
      canGift(s, this.id) ? 'Gift' : 'Gifted',
      () => {
        this.mode = 'gift';
        this.rebuild();
      },
    ).setEnabled(canGift(s, this.id));
    if (def.role === 'shop')
      this.button(72, y, 58, 24, 'Shop', () => {
        this.close();
        gameEvents.emit('openPanel', { type: 'shop' });
      });
    // Beside a Shop button there is less room (critique 6, F8: "1 gift a day." ran off the edge).
    const x = def.role === 'shop' ? 136 : 104;
    this.label(
      x,
      y + 4,
      giftNote(canGift(s, this.id), def.role === 'shop'),
      C.creamDim,
      1,
      'left',
      192 - x,
    );
  }

  private buildGift(): void {
    const s = getState();
    this.label(8, 36, `A gift for ${npcs[this.id]!.name}?`, C.cream);
    const kinds = new Map<string, ItemRef>();
    for (const st of s.inventory.slots) if (st && isGiftable(st)) kinds.set(keyOf(st), refOf(st));
    // Known favourites first, unknown next, known dislikes last: the list remembers past gifts.
    const rank = (r: ItemRef): number => {
      const known = knownReaction(s, this.id, r);
      if (known) return GIFT_ORDER.indexOf(known) * 2;
      return EVERYDAY.has(items[r.item]?.type ?? '') ? 5 : 3; // seeds, stone and bait go last
    };
    const list = [...kinds.values()].sort(
      (a, b) => rank(a) - rank(b) || sellValue(b) - sellValue(a),
    );
    const pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.page = Math.min(this.page, pages - 1);
    if (list.length === 0)
      this.label(
        8,
        56,
        'Nothing to give. Forage or harvest something!',
        C.creamDim,
        1,
        'left',
        184,
      );
    let y = 48;
    for (const ref of list.slice(this.page * ROWS, (this.page + 1) * ROWS)) {
      const known = knownReaction(s, this.id, ref);
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        sub: giftSub(countStack(s, ref), known),
        subColor: known ? KNOWN_COLOR[known] : C.creamDim,
        buttons: [
          {
            label: 'Give',
            width: 38,
            color: C.green,
            onClick: () => {
              const res = giveGift(getState(), this.id, ref);
              if (!res.ok) return audio.play('error');
              audio.play(res.reaction === 'dislike' ? 'error' : 'heart');
              haptic(res.reaction === 'dislike' ? 'error' : 'success');
              this.mode = 'talk';
              this.gained = Math.max(0, res.points);
              this.reply = REPLIES[res.reaction];
              this.rebuild();
            },
          },
        ],
      });
    }
    if (pages > 1) {
      const by = this.panelH - 52;
      this.button(8, by, 40, 20, '<', () => {
        this.page = (this.page + pages - 1) % pages;
        this.rebuild();
      });
      this.button(152, by, 40, 20, '>', () => {
        this.page = (this.page + 1) % pages;
        this.rebuild();
      });
    }
  }
}

const GIFT_ORDER = ['love', 'like', 'neutral', 'dislike'] as const;
/** Things nobody wants as a present; listed after real gifts. */
const EVERYDAY = new Set(['seed', 'material', 'fertilizer', 'bait', 'feed']);
const KNOWN_COLOR = { love: C.gold, like: C.green, neutral: C.creamDim, dislike: C.red } as const;

const REPLIES = {
  love: 'This is my favourite thing ever!',
  like: 'How thoughtful, thank you!',
  neutral: 'Oh! Thank you.',
  dislike: 'Um... thanks, I suppose.',
} as const;
