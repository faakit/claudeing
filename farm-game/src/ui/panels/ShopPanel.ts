import { items, shops } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  buyItem,
  buyUpgrade,
  nextUpgrade,
  priceFor,
  upgradeLevel,
  stockFor,
} from '../../systems/economy';
import { toast } from '../../systems/events';
import { countItem } from '../../systems/inventory';
import { perk } from '../../systems/skills';
import { C } from '../theme';
import { Modal, ROW_H } from '../widgets';
import { fmt, SHOP_ID } from './format';
import Phaser from 'phaser';

export class ShopPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  private tab: 'seeds' | 'farm' | 'upgrades' = 'seeds';

  protected build(): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    this.panel();
    this.label(8, 8, shop.name, C.gold);
    this.icon(this.panelW - 12, 12, 'ui_coin');
    this.label(this.panelW - 20, 8, fmt(s.money), C.gold, 1, 'right');
    const tabs: [typeof this.tab, string][] = [
      ['seeds', 'Seeds'],
      ['farm', 'Animals'],
      ['upgrades', 'Upgrades'],
    ];
    tabs.forEach(([id, text], i) =>
      this.button(
        8 + i * 62,
        20,
        60,
        18,
        text,
        () => {
          this.tab = id;
          this.rebuild();
        },
        {
          rim: this.tab === id ? C.gold : C.creamDim,
          textColor: this.tab === id ? C.gold : C.cream,
        },
      ),
    );

    let y = 44;
    if (this.tab === 'upgrades') {
      this.buildUpgrades(y);
    } else {
      const farmTypes = ['animal', 'feed'];
      const stock = stockFor(SHOP_ID, s.time.season).filter(
        (id) => farmTypes.includes(items[id]!.type) === (this.tab === 'farm'),
      );
      if (stock.length === 0) {
        this.label(8, y + 6, 'Nothing grows in winter. Rest up!', C.creamDim);
        y += ROW_H;
      }
      for (const id of stock) y = this.stockRow(y, id);
    }
    this.closeButton();
  }

  private stockRow(y: number, id: string): number {
    const s = getState();
    const def = items[id]!;
    const price = priceFor(s, id);
    const own = countItem(s, id);
    const gone = def.type === 'animal' && own > 0;
    return this.row(y, {
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
          color: s.money >= price * 5 && !gone ? C.cream : C.creamDim,
        },
      ],
    });
  }

  private buildUpgrades(y: number): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    for (const up of shop.upgrades) {
      const next = nextUpgrade(s, up);
      const lvl = upgradeLevel(s, up);
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
    if (perkDiscount(s) > 0)
      this.label(
        8,
        y + 6,
        `Friendship discount: ${Math.round(perkDiscount(s) * 100)}% off goods`,
        C.green,
      );
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

  private buyUp(id: string): void {
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

const perkDiscount = (s: ReturnType<typeof getState>): number =>
  Math.min(0.3, perk(s, 'shopDiscount'));
