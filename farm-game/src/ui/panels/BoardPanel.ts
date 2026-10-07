import Phaser from 'phaser';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { deliverOrder, ensureOrders, haveFor, orderLabel } from '../../systems/orders';
import { iconKey, parseKey } from '../../systems/itemRef';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';

/** The town's request board: three orders a day, paid well above the shipping bin. */
export class BoardPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 196);
  }

  protected build(): void {
    const s = getState();
    ensureOrders(s);
    this.panel();
    this.label(8, 8, "Today's Requests", C.gold);
    this.label(192, 8, `Gold ${fmt(s.money)}`, C.gold, 1, 'right');
    this.label(8, 20, 'New requests every morning.', C.creamDim);
    let y = 34;
    for (const o of s.orders.list) {
      const have = haveFor(s, o);
      const ready = !o.done && have >= o.qty;
      y = this.row(y, {
        icon: iconKey(parseKey(o.item)),
        title: o.done ? `${orderLabel(o)} (done)` : orderLabel(o),
        sub: o.done ? 'Thank you!' : `Have ${Math.min(have, 99)}/${o.qty}  Pays ${fmt(o.reward)}g`,
        subColor: o.done ? C.green : ready ? C.gold : C.creamDim,
        buttons: [
          {
            label: o.done ? 'Done' : 'Give',
            width: 40,
            enabled: ready,
            color: ready ? C.green : C.creamDim,
            onClick: () => {
              if (deliverOrder(getState(), o.id) === 'ok') {
                audio.play('coin');
                haptic('success');
              } else audio.play('error');
              this.rebuild();
            },
          },
        ],
      });
    }
    if (s.orders.list.length === 0)
      this.label(8, 50, 'Nothing today. Check back tomorrow!', C.creamDim, 1, 'left', 184);
    this.closeButton();
  }
}
