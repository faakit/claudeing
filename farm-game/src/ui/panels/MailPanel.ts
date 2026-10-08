import Phaser from 'phaser';
import { game, items } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { toast } from '../../systems/events';
import { letterDate, readLetter, takeGift, unreadCount } from '../../systems/mail';
import { C } from '../theme';
import { Modal } from '../widgets';
import { giftLine, letterSub, letterTitle } from './mailText';

const ROWS = 5;

/** The mailbox: letters newest first, one page per letter with its gift. */
export class MailPanel extends Modal {
  private id: number | null = null;
  private page = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  override open(): void {
    this.id = null;
    this.page = 0;
    super.open();
  }

  protected build(): void {
    this.panel();
    const letter = this.id === null ? null : getState().mail.list.find((l) => l.id === this.id);
    if (letter) this.buildLetter(letter.id);
    else this.buildList();
    this.closeButton();
  }

  private buildList(): void {
    const s = getState();
    const waiting = unreadCount(s);
    this.label(8, 8, 'Mailbox', C.gold);
    this.label(192, 8, waiting > 0 ? `${waiting} waiting` : 'All read', C.creamDim, 1, 'right');
    const list = [...s.mail.list].reverse();
    if (list.length === 0)
      this.label(
        8,
        30,
        'No letters yet. The post comes in the morning.',
        C.creamDim,
        1,
        'left',
        184,
      );
    const pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.page = Math.min(this.page, pages - 1);
    let y = 24;
    for (const l of list.slice(this.page * ROWS, (this.page + 1) * ROWS)) {
      y = this.row(y, {
        icon:
          l.gift && !l.taken
            ? (items[l.gift.item]?.icon ?? 'ui_star')
            : l.read
              ? undefined
              : 'ui_star',
        title: letterTitle(l),
        sub: letterSub(l, letterDate(l.day, game.seasonLength)),
        subColor: !l.read || (l.gift && !l.taken) ? C.gold : C.creamDim,
        buttons: [
          {
            label: 'Read',
            width: 38,
            color: l.read ? C.cream : C.gold,
            onClick: () => {
              this.id = l.id;
              readLetter(getState(), l.id);
              this.rebuild();
            },
          },
        ],
      });
    }
    if (pages > 1) {
      const by = this.panelH - 54;
      this.button(8, by, 40, 20, '<', () => {
        this.page = (this.page + pages - 1) % pages;
        this.rebuild();
      });
      this.label(this.panelW / 2, by + 6, `${this.page + 1}/${pages}`, C.creamDim, 1, 'center');
      this.button(152, by, 40, 20, '>', () => {
        this.page = (this.page + 1) % pages;
        this.rebuild();
      });
    }
  }

  private buildLetter(id: number): void {
    const s = getState();
    const l = s.mail.list.find((x) => x.id === id)!;
    this.label(8, 8, letterTitle(l), C.gold, 1, 'left', 184);
    this.label(192, 22, letterDate(l.day, game.seasonLength), C.creamDim, 1, 'right');
    const body = this.label(8, 36, l.text, C.cream, 1, 'left', 184);
    if (l.gift)
      this.label(
        8,
        36 + body.textHeight + 8,
        giftLine(l),
        l.taken ? C.creamDim : C.green,
        1,
        'left',
        184,
      );
    const by = this.panelH - 56;
    if (l.gift && !l.taken)
      this.button(
        8,
        by,
        90,
        22,
        'Take gift',
        () => {
          const res = takeGift(getState(), id);
          if (res === 'ok') {
            audio.play('buy');
            haptic('success');
            toast(`Got ${l.gift!.qty} ${items[l.gift!.item]?.name ?? ''}`, 'good');
          } else {
            audio.play('error');
            if (res === 'full') toast('Make room in your bag first.', 'warn');
          }
          this.rebuild();
        },
        { textColor: C.green, rim: C.green },
      );
    this.button(102, by, 90, 22, 'Back', () => {
      this.id = null;
      this.rebuild();
    });
  }
}
