import Phaser from 'phaser';
import { items, shops } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { buyItem, buyPrice, buyUpgrade, nextUpgrade, stockFor } from '../../systems/economy';
import { toast } from '../../systems/events';
import { countItem } from '../../systems/inventory';
import { seasonLabel } from '../../systems/time';
import { C } from '../theme';
import { Modal } from '../widgets';

import { fmt, SHOP_ID } from './format';

// ============================================================ Shop

export class ShopPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 400, 226);
  }

  protected build(): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    const stock = stockFor(SHOP_ID, s.time.season);
    const rows = stock.length + shop.upgrades.length;
    this.panelH = 52 + Math.max(1, stock.length) * 28 + shop.upgrades.length * 28 + 22;
    this.root.setY(Math.round((270 - this.panelH) / 2));
    this.panel(this.panelW, this.panelH);
    this.label(14, 11, shop.name, C.gold, 2);
    this.label(this.panelW - 40, 10, `${fmt(s.money)}g`, C.gold, 1, 'right');
    this.icon(this.panelW - 34, 14, 'ui_coin');
    this.label(
      14,
      30,
      `${seasonLabel(s.time.season)} stock. Seeds only grow in their season.`,
      C.creamDim,
    );
    this.closeButton();
    void rows;

    let y = 44;
    if (stock.length === 0) {
      this.label(14, y + 8, 'Nothing grows in winter. Rest up and plan ahead!', C.creamDim);
      y += 28;
    }
    for (const id of stock) {
      const def = items[id]!;
      const price = buyPrice(id);
      this.icon(24, y + 12, def.icon);
      this.label(42, y + 3, def.name);
      this.label(42, y + 14, def.description, C.creamDim);
      const own = countItem(s, id);
      if (own > 0) this.label(250, y + 3, `Own ${own}`, C.creamDim, 1, 'right');
      this.button(262, y, 70, 24, `${price}g`, () => this.buy(id, 1), {
        textColor: s.money >= price ? C.gold : C.red,
      });
      this.button(338, y, 48, 24, 'x5', () => this.buy(id, 5), {
        textColor: s.money >= price * 5 ? C.cream : C.creamDim,
      });
      y += 28;
    }
    this.label(14, y + 2, 'UPGRADES', C.gold);
    y += 14;
    for (const up of shop.upgrades) {
      const next = nextUpgrade(s, up);
      const lvl = s.upgrades[up.id];
      this.icon(24, y + 12, up.id === 'can' ? 'ui_drop' : 'ui_bolt');
      this.label(42, y + 3, `${up.name}  Lv ${lvl + 1}/${up.levels.length + 1}`);
      this.label(42, y + 14, next ? next.label : 'Fully upgraded!', next ? C.creamDim : C.green);
      if (next) {
        this.button(262, y, 124, 24, `${fmt(next.price)}g`, () => this.buyUp(up.id), {
          textColor: s.money >= next.price ? C.gold : C.red,
        });
      }
      y += 28;
    }
  }

  private buy(id: string, qty: number): void {
    const res = buyItem(getState(), SHOP_ID, id, qty);
    const name = items[id]!.name;
    if (res === 'ok') {
      audio.play('buy');
      haptic('success');
      toast(`Bought ${qty} ${name}`, 'good');
    } else {
      audio.play('error');
      toast(
        res === 'no_money'
          ? 'Not enough gold.'
          : res === 'full'
            ? 'Inventory full!'
            : "Can't buy that now.",
        'warn',
      );
    }
    this.rebuild();
  }

  private buyUp(id: 'can' | 'stamina'): void {
    const up = shops[SHOP_ID]!.upgrades.find((u) => u.id === id)!;
    const res = buyUpgrade(getState(), up);
    if (res === 'ok') {
      audio.play('buy');
      haptic('success');
      toast(`${up.name} upgraded!`, 'good');
    } else {
      audio.play('error');
      toast(res === 'no_money' ? 'Not enough gold.' : 'Already maxed.', 'warn');
    }
    this.rebuild();
  }
}
