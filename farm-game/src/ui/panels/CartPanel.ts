import Phaser from 'phaser';
import { items } from '../../data';
import { audio } from '../../platform/audio';
import { getState } from '../../state/store';
import { buyFromCart, cartLeft, cartPrice, cartStock } from '../../systems/cart';
import { toast } from '../../systems/events';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';
import { cartSub, CART_INTRO } from './cartText';

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
        sub: cartSub(price, left),
        subColor: left > 0 ? C.creamDim : C.warn,
        buttons: [
          {
            label: 'Buy',
            width: 40,
            enabled: left > 0,
            color: s.money >= price && left > 0 ? C.gold : C.red,
            onClick: () => {
              const res = buyFromCart(getState(), id);
              if (res === 'ok') audio.play('buy');
              else {
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
    this.closeButton();
  }
}
