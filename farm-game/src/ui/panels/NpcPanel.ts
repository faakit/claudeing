import Phaser from 'phaser';
import { npcs, items } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  canGift,
  chat,
  completeEvent,
  giftBlock,
  giftsLeft,
  giveGift,
  heartBar,
  heartsOf,
  isBirthday,
  isGiftable,
  knownReaction,
  lineFor,
  MAX_HEARTS,
  pendingEvent,
} from '../../systems/friendship';
import { keyOf, displayName, iconKey, refOf, sellValue, type ItemRef } from '../../systems/itemRef';
import { countStack } from '../../systems/inventory';
import { gameEvents, toast } from '../../systems/events';
import { buyPart, partOffer } from '../../systems/valley';
import { C } from '../theme';
import { drawBar, Modal } from '../widgets';
import { nextHeartLine } from './heartText';
import { giftNote, giftSub } from './giftText';
import { fmtGold, fmtNum, t } from '../../i18n';

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
  /** How far a two-line blurb pushed the body down. */
  private dy = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 236);
  }

  /** Whose sheet this is (the guided start points inside it). */
  get npcId(): string {
    return this.id;
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
    // the blurb wraps beside the hearts bar (x 148; one line cut Clay's short), and the body moves down under it
    const blurbEnd = this.para(
      8,
      20,
      isBirthday(s, this.id) ? t('npc.birthdayToday') : def.blurb,
      isBirthday(s, this.id) ? C.gold : C.creamDim,
      136,
      0,
    );
    this.dy = Math.max(0, blurbEnd - 31);
    const hearts = heartsOf(s, this.id);
    for (let i = 0; i < MAX_HEARTS; i++)
      this.icon(150 + i * 9, 13, 'ui_heart').setTint(i < hearts ? 0xe0574a : 0x4a4560);
    const g = this.scene.add.graphics();
    this.content.add(g);
    const bar = heartBar(s, this.id);
    // under the hearts and inside the sheet's frame (the QA critic: 148 + 48 ran past the border on an SE)
    drawBar(g, 150, 20, 42, 5, bar ? bar.have / bar.need : 1, C.red);

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
    // a flow: the scene's line wraps as long as it needs, the counter under it, the button under that
    let y = this.para(8, 38 + this.dy, ev.title.toUpperCase(), C.warn, 184, 8);
    y = this.para(8, y, `"${ev.lines[this.evLine]}"`, C.cream, 184, 6);
    y = this.para(8, y, `${this.evLine + 1}/${ev.lines.length}`, C.creamDim, 184, 4);
    this.wantHeight = y + 62 + 2;
    this.button(
      8,
      this.panelH - 62,
      this.panelW - 16,
      24,
      // an opening scene (a place restored) gives nothing but the moment
      last
        ? ev.id.startsWith('opening.')
          ? t('common.close')
          : t('npc.accept')
        : t('common.next'),
      () => {
        if (!last) {
          this.evLine += 1;
          return this.rebuild();
        }
        const res = completeEvent(getState(), this.id);
        if (!res.ok) {
          audio.play('error');
          toast(t('common.makeRoom'), 'warn');
          return;
        }
        audio.play('level');
        haptic('success');
        this.mode = 'talk';
        this.gained = 0;
        this.reply = ev.id.startsWith('opening.')
          ? ''
          : res.gold > 0
            ? t('npc.takeGold', { n: fmtNum(res.gold) })
            : t('npc.hopeYouLike');
        this.rebuild();
      },
      { textColor: C.green, rim: C.green },
    );
  }

  private buildTalk(hearts: number): void {
    const s = getState();
    const def = npcs[this.id]!;
    // a part an asked place's fund needs (the sluice gate from Orin, until the forge is lit): said, and sold here
    const offer = partOffer(s, this.id);
    const offerName = offer ? (items[offer.item]?.name ?? offer.item) : '';
    const say =
      this.reply || (offer ? t('npc.partOffer', { part: offerName.toLowerCase() }) : this.line);
    // A flow from the line down (each part under the last, however far it wrapped), then the buttons: Portuguese
    // lines wrapped into the next part at their old fixed rows.
    let fy = this.para(8, 42 + this.dy, `"${say}"`, C.cream, 184, 8);
    fy = Math.max(fy, 66 + this.dy);
    if (this.gained > 0)
      fy = this.para(8, fy, t('npc.friendship', { n: this.gained }), C.green, 184, 5);
    // what the next heart brings (QA round: every heart is worth having, and the sheet says what)
    fy = this.para(
      8,
      fy,
      nextHeartLine(s, this.id),
      hearts < MAX_HEARTS ? C.creamDim : C.green,
      184,
      3,
    );
    if (hearts >= 3) {
      const loves = def.loves.map((i) => items[i]?.name ?? i).join(', ');
      fy = this.para(8, fy, t('npc.loves', { items: loves }), C.warn, 184, 3);
    } else fy = this.para(8, fy, t('npc.reachHearts'), C.creamDim, 184, 3);
    this.wantHeight = fy + 62 + 2;
    const y = this.panelH - 62;
    this.button(
      8,
      y,
      def.role === 'shop' ? 58 : 90,
      24,
      canGift(s, this.id) ? t('npc.gift') : t('npc.gifted'),
      () => {
        this.mode = 'gift';
        this.rebuild();
      },
    ).setEnabled(canGift(s, this.id));
    if (def.role === 'shop')
      this.button(72, y, 58, 24, t('npc.shop'), () => {
        this.close();
        gameEvents.emit('openPanel', { type: 'shop' });
      });
    if (offer) {
      this.button(104, y, 88, 24, `${offerName} ${fmtGold(offer.price)}`, () => {
        const res = buyPart(getState(), this.id);
        if (!res.ok) {
          audio.play('error');
          return void toast(
            res.reason === 'gold'
              ? t('npc.partNoGold', { gold: fmtGold(offer.price) })
              : t('npc.partBagFull'),
            'warn',
          );
        }
        audio.play('coin');
        haptic('success');
        toast(t('npc.partBought', { part: offerName }), 'good');
        gameEvents.emit('moneyChanged', { delta: -offer.price });
        this.rebuild();
      }).setEnabled(s.money >= offer.price);
      return;
    }
    // Beside a Shop button there is less room (critique 6, F8: "1 gift a day." ran off the edge).
    const x = def.role === 'shop' ? 136 : 104;
    this.label(
      x,
      y + 4,
      giftNote(giftBlock(s, this.id), giftsLeft(s, this.id), def.role === 'shop'),
      C.creamDim,
      1,
      'left',
      192 - x,
    );
  }

  private buildGift(): void {
    const s = getState();
    this.label(8, 36 + this.dy, t('npc.giftFor', { name: npcs[this.id]!.name }), C.cream);
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
    if (list.length === 0) this.label(8, 56, t('npc.nothingToGive'), C.creamDim, 1, 'left', 184);
    let y = 48 + this.dy;
    for (const ref of list.slice(this.page * ROWS, (this.page + 1) * ROWS)) {
      const known = knownReaction(s, this.id, ref);
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        sub: giftSub(countStack(s, ref), known),
        subColor: known ? KNOWN_COLOR[known] : C.creamDim,
        buttons: [
          {
            label: t('common.give'),
            width: 38,
            color: C.green,
            onClick: () => {
              const res = giveGift(getState(), this.id, ref);
              if (!res.ok) return audio.play('error');
              audio.play(res.reaction === 'dislike' ? 'error' : 'heart');
              haptic(res.reaction === 'dislike' ? 'error' : 'success');
              this.mode = 'talk';
              this.gained = Math.max(0, res.points);
              this.reply = t(REPLIES[res.reaction]);
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

/** A villager's reply to a gift (dictionary keys). */
const REPLIES = {
  love: 'npc.replyLove',
  like: 'npc.replyLike',
  neutral: 'npc.replyNeutral',
  dislike: 'npc.replyDislike',
} as const;
