import { items, shops } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { buyItem, buyPrice, buyUpgrade, nextUpgrade, stockFor } from '../../systems/economy';
import { toast } from '../../systems/events';
import { countItem } from '../../systems/inventory';
import { seasonLabel } from '../../systems/time';
import { C } from '../theme';
import { Modal, ROW_H } from '../widgets';
import { fmt, SHOP_ID } from './format';
import Phaser from 'phaser';

export class ShopPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 240);
  }

  protected build(): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    const stock = stockFor(SHOP_ID, s.time.season);
    this.setHeight(34 + Math.max(1, stock.length) * ROW_H + 16 + shop.upgrades.length * ROW_H + 36);
    this.panel();
    this.label(8, 8, shop.name, C.gold);
    this.icon(this.panelW - 12, 12, 'ui_coin');
    this.label(this.panelW - 20, 8, fmt(s.money), C.gold, 1, 'right');
    this.label(8, 20, `${seasonLabel(s.time.season)} stock: seeds grow in-season`, C.creamDim);

    let y = 34;
    if (stock.length === 0) {
      this.label(8, y + 6, 'Nothing grows in winter. Rest up!', C.creamDim);
      y += ROW_H;
    }
    for (const id of stock) {
      const def = items[id]!;
      const price = buyPrice(id);
      const own = countItem(s, id);
      y = this.row(y, {
        icon: def.icon,
        title: def.name,
        sub: own > 0 ? `${def.description}  (own ${own})` : def.description,
        buttons: [
          {
            label: `${fmt(price)}g`,
            width: 44,
            onClick: () => this.buy(id, 1),
            color: s.money >= price ? C.gold : C.red,
          },
          {
            label: 'x5',
            width: 26,
            onClick: () => this.buy(id, 5),
            color: s.money >= price * 5 ? C.cream : C.creamDim,
          },
        ],
      });
    }
    this.label(8, y + 3, 'UPGRADES', C.gold);
    y += 16;
    for (const up of shop.upgrades) {
      const next = nextUpgrade(s, up);
      const lvl = s.upgrades[up.id];
      y = this.row(y, {
        icon: up.id === 'can' ? 'ui_drop' : 'ui_bolt',
        title: `${up.name} ${lvl + 1}/${up.levels.length + 1}`,
        sub: next ? next.label : 'Fully upgraded!',
        subColor: next ? C.creamDim : C.green,
        buttons: next
          ? [
              {
                label: `${fmt(next.price)}g`,
                width: 58,
                onClick: () => this.buyUp(up.id),
                color: s.money >= next.price ? C.gold : C.red,
              },
            ]
          : [],
      });
    }
    this.closeButton();
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
      haptic('error');
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
