import Phaser from 'phaser';
import { items } from '../../data';
import { audio } from '../../platform/audio';
import { getState } from '../../state/store';
import { buyFromCart, cartLeft, cartPrice, cartStock, cartTag, cartUse } from '../../systems/cart';
import { gameEvents } from '../../systems/events';
import { toast } from '../../systems/events';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';
import { cartBought, cartSub, CART_INTRO } from './cartText';

/** The traveling cart's sheet: a few rows, one Buy button each, low on the screen. */
export class CartPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 196);
  }

  protected build(): void {
    const s = getState();
    this.panel();
    this.label(8, 8, 'Traveling Cart', C.gold);
    this.label(192, 8, `Gold ${fmt(s.money)}`, C.gold, 1, 'right');
    this.label(8, 20, CART_INTRO, C.creamDim);
    let y = 34;
    const stock = cartStock(s);
    if (stock.length === 0) this.label(8, 40, 'The cart has moved on.', C.creamDim);
    for (const id of stock) {
      const price = cartPrice(id);
      const left = cartLeft(s, id);
      y = this.row(y, {
        icon: items[id]?.icon,
        title: items[id]?.name ?? id,
        sub: cartSub(price, left, cartTag(id)),
        subColor: left > 0 ? C.creamDim : C.warn,
        buttons: [
          {
            label: 'Buy',
            width: 40,
            enabled: left > 0,
            color: s.money >= price && left > 0 ? C.gold : C.red,
            onClick: () => {
              const res = buyFromCart(getState(), id);
              if (res === 'ok') {
                audio.play('buy');
                toast(cartBought(items[id]?.name ?? id, cartUse(id)), 'good');
              } else {
                audio.play('error');
                toast(
                  res === 'no_money'
                    ? 'Not enough gold.'
                    : res === 'full'
                      ? 'Inventory full!'
                      : 'Sold out.',
                  'warn',
                );
              }
              this.rebuild();
            },
          },
        ],
      });
    }
    // Back to the board it was opened from (critique 8, F4).
    this.button(
      8,
      this.panelH - 28,
      this.panelW - 16,
      22,
      'Back to the board',
      () => {
        this.close();
        gameEvents.emit('openPanel', { type: 'board' });
      },
      { textColor: C.warn },
    );
  }
}
