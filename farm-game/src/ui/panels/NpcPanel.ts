import Phaser from 'phaser';
import { npcs, items } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  canGift,
  chat,
  giveGift,
  heartsOf,
  isGiftable,
  lineFor,
  MAX_HEARTS,
  nextPerk,
  POINTS_PER_HEART,
  pointsOf,
} from '../../systems/friendship';
import { keyOf, displayName, iconKey, refOf, type ItemRef } from '../../systems/itemRef';
import { countStack } from '../../systems/inventory';
import { gameEvents } from '../../systems/events';
import { fitText } from '../font';
import { C } from '../theme';
import { drawBar, Modal } from '../widgets';
import { perkLine } from './perkText';

const ROWS = 5;

/** A villager's sheet: friendship hearts, today's line, gifts, and (for the shopkeeper) a Shop button. */
export class NpcPanel extends Modal {
  private id = 'mara';
  private mode: 'talk' | 'gift' = 'talk';
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
    this.label(8, 20, fitText(def.blurb, 136), C.creamDim);
    const hearts = heartsOf(s, this.id);
    for (let i = 0; i < MAX_HEARTS; i++)
      this.icon(150 + i * 9, 13, 'ui_heart').setTint(i < hearts ? 0xe0574a : 0x4a4560);
    const g = this.scene.add.graphics();
    this.content.add(g);
    const into = pointsOf(s, this.id) % POINTS_PER_HEART;
    drawBar(g, 148, 20, 48, 5, hearts >= MAX_HEARTS ? 1 : into / POINTS_PER_HEART, C.red);

    if (this.mode === 'talk') this.buildTalk(hearts);
    else this.buildGift();
    this.closeButton();
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
    this.label(
      def.role === 'shop' ? 138 : 104,
      y + 4,
      canGift(s, this.id) ? 'One gift a day.' : 'Come back tomorrow.',
      C.creamDim,
      1,
      'left',
      90,
    );
  }

  private buildGift(): void {
    const s = getState();
    this.label(8, 36, `A gift for ${npcs[this.id]!.name}?`, C.cream);
    const kinds = new Map<string, ItemRef>();
    for (const st of s.inventory.slots) if (st && isGiftable(st)) kinds.set(keyOf(st), refOf(st));
    const list = [...kinds.values()];
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
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        sub: `Have ${countStack(s, ref)}`,
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

const REPLIES = {
  love: 'This is my favourite thing ever!',
  like: 'How thoughtful, thank you!',
  neutral: 'Oh! Thank you.',
  dislike: 'Um... thanks, I suppose.',
} as const;
