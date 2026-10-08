import Phaser from 'phaser';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { deliverOrder, ensureOrders, haveFor, orderLabel } from '../../systems/orders';
import { orderSub } from './boardText';
import { iconKey, parseKey } from '../../systems/itemRef';
import { C } from '../theme';
import { Modal } from '../widgets';
import { gameEvents } from '../../systems/events';
import { festivalToday, hasEntered } from '../../systems/festivals';
import { fmt } from './format';
import { items } from '../../data';
import { countItem } from '../../systems/inventory';
import { giveToSpecial, specialLabel, specialSub } from '../../systems/specials';
import { applyRival, rivalActive, rivalName, rivalNotice, rivalPicks } from '../../systems/rival';

/** The town's request board: three orders a day, paid well above the shipping bin. */
export class BoardPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 196);
  }

  protected build(): void {
    const s = getState();
    ensureOrders(s);
    applyRival(s);
    // Rows, then the festival and projects buttons, then Close: the sheet grows with the board.
    const fest = festivalToday(s);
    const festOpen = !!fest && !hasEntered(s, fest.id);
    const rows = Math.max(1, s.orders.list.length);
    const sp = s.special;
    this.setHeight(34 + (sp ? 26 : 0) + rows * 26 + (festOpen ? 26 : 0) + 26 + 34);
    this.panel();
    this.label(8, 8, 'Requests', C.gold);
    this.label(192, 8, `Gold ${fmt(s.money)}`, C.gold, 1, 'right');
    this.label(8, 20, rivalNotice(s), C.creamDim);
    let y = 34;
    if (sp) {
      // The special order sits on top, in gold: a big seasonal request with a deadline.
      const have = countItem(s, sp.item);
      y = this.row(y, {
        icon: items[sp.item]?.icon,
        title: specialLabel(sp),
        sub: specialSub(sp),
        subColor: C.gold,
        buttons: [
          {
            label: 'Give',
            width: 34,
            enabled: have > 0,
            color: have > 0 ? C.green : C.creamDim,
            onClick: () => {
              const res = giveToSpecial(getState());
              if (res.ok) {
                audio.play(res.finished ? 'order' : 'buy');
                haptic('success');
              } else audio.play('error');
              this.rebuild();
            },
          },
        ],
      });
    }
    // The requests Clay is after today are marked, so the race is about a known target.
    const eyed = new Set(
      rivalActive(s) && s.stats['rival.day'] !== s.orders.day ? rivalPicks(s).map((o) => o.id) : [],
    );
    for (const o of s.orders.list) {
      const have = haveFor(s, o);
      const ready = !o.done && have >= o.qty;
      y = this.row(y, {
        icon: iconKey(parseKey(o.item)),
        title: o.done && !o.rival ? `${orderLabel(o)} (done)` : orderLabel(o),
        sub: o.rival
          ? `${rivalName()} filled this one.`
          : o.done
            ? 'Thank you!'
            : orderSub(s, o, have, eyed.has(o.id)),
        subColor:
          o.rival || (eyed.has(o.id) && !ready)
            ? C.warn
            : o.done
              ? C.green
              : ready
                ? C.gold
                : C.creamDim,
        buttons: [
          {
            label: o.rival ? 'Gone' : o.done ? 'Done' : 'Give',
            width: 36,
            enabled: ready,
            color: ready ? C.green : C.creamDim,
            onClick: () => {
              if (deliverOrder(getState(), o.id) === 'ok') {
                audio.play('order');
                haptic('success');
              } else audio.play('error');
              this.rebuild();
            },
          },
        ],
      });
    }
    if (s.orders.list.length === 0) {
      this.label(8, 40, 'Nothing today. Check back tomorrow!', C.creamDim, 1, 'left', 184);
      y += 26;
    }
    if (fest && festOpen) {
      this.button(
        8,
        y + 2,
        this.panelW - 16,
        22,
        `Enter the ${fest.def.name}!`,
        () => {
          this.close();
          gameEvents.emit('openPanel', { type: 'festival' });
        },
        { textColor: C.gold, rim: C.gold },
      );
      y += 26;
    }
    this.button(8, y + 2, this.panelW - 16, 22, 'Town projects', () => {
      this.close();
      gameEvents.emit('openPanel', { type: 'projects' });
    });
    this.closeButton();
  }
}
