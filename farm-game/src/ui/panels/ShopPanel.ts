import { items, shops } from '../../data';
import type { UpgradeDef } from '../../data';
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
import { SHOP_TABS, shopFacts, shopTabOf, tooLate, type ShopTab } from './shopFacts';
import Phaser from 'phaser';

const ROWS = 5;

export class ShopPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  private tab: ShopTab = 'seeds';
  private page = 0;

  protected build(): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    this.panel();
    this.label(8, 8, shop.name, C.gold);
    this.icon(this.panelW - 12, 12, 'ui_coin');
    this.label(this.panelW - 20, 8, fmt(s.money), C.gold, 1, 'right');
    let tx = 8;
    SHOP_TABS.forEach(([id, text, w]) => {
      const x = tx;
      tx += w + 2;
      this.button(
        x,
        20,
        w,
        18,
        text,
        () => {
          this.tab = id;
          this.page = 0;
          this.rebuild();
        },
        {
          rim: this.tab === id ? C.gold : C.creamDim,
          textColor: this.tab === id ? C.gold : C.cream,
        },
      );
    });

    let y = 44;
    if (this.tab === 'upgrades') {
      this.buildUpgrades(y);
    } else {
      // The Home tab starts with the house upgrades (a bigger bag), then decorations.
      let rows = ROWS;
      if (this.tab === 'home') {
        for (const up of shop.upgrades.filter((u) => u.tab === 'home')) y = this.upgradeRow(y, up);
        rows = ROWS - 1;
      }
      const stock = stockFor(SHOP_ID, s.time.season).filter((id) => shopTabOf(id) === this.tab);
      if (stock.length === 0) {
        this.label(8, y + 6, 'Nothing grows in winter. Rest up!', C.creamDim);
        y += ROW_H;
      }
      const pages = Math.max(1, Math.ceil(stock.length / rows));
      this.page = Math.min(this.page, pages - 1);
      for (const id of stock.slice(this.page * rows, (this.page + 1) * rows))
        y = this.stockRow(y, id);
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
      sub: shopFacts(id, own, s.time.day),
      subColor: tooLate(id, s.time.day) ? C.red : undefined,
      buttons: [
        {
          label: `${fmt(price)}g`,
          width: 44,
          onClick: () => this.buy(id, 1),
          color: s.money >= price ? C.gold : C.red,
        },
        // No x5 on animals or anything dear: one tap must never spend thousands by accident.
        ...(def.type === 'animal' || price > X5_MAX_PRICE
          ? []
          : [
              {
                label: 'x5',
                width: 26,
                onClick: () => this.buy(id, 5),
                color: s.money >= price * 5 && !gone ? C.cream : C.creamDim,
              },
            ]),
      ],
    });
  }

  private buildUpgrades(y: number): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    for (const up of shop.upgrades.filter((u) => u.tab !== 'home')) y = this.upgradeRow(y, up);
    if (perkDiscount(s) > 0)
      this.label(
        8,
        y + 6,
        `Friendship discount: ${Math.round(perkDiscount(s) * 100)}% off goods`,
        C.green,
      );
  }

  /** One upgrade with its price, and a second line for the bars or goods it also needs. */
  private upgradeRow(y: number, up: UpgradeDef): number {
    const s = getState();
    {
      const next = nextUpgrade(s, up);
      const lvl = upgradeLevel(s, up);
      const have = next?.needs ? countItem(s, next.needs.item) : 0;
      const missing = !!next?.needs && have < next.needs.qty;
      y = this.row(y, {
        icon:
          up.icon ??
          (up.id === 'can'
            ? 'ui_drop'
            : up.id === 'stamina'
              ? 'ui_bolt'
              : items[up.id === 'hoe' ? 'hoe' : 'fishing_rod']!.icon),
        title: `${up.name} ${lvl + 1}/${up.levels.length + 1}`,
        sub: next ? next.label : 'Fully upgraded!',
        subColor: next ? C.creamDim : C.green,
        buttons: next
          ? [
              {
                label: `${fmt(next.price)}g`,
                width: 58,
                onClick: () => this.buyUp(up.id),
                color: s.money >= next.price && !missing ? C.gold : C.red,
              },
            ]
          : [],
      });
      if (next?.needs) {
        // Bars are part of the price: show them on their own line so the effect text stays readable.
        this.label(
          28,
          y - 1,
          `Needs ${next.needs.qty} ${items[next.needs.item]?.name} (have ${have})`,
          missing ? C.red : C.green,
        );
        y += 10;
      }
    }
    return y;
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
      toast(
        res === 'no_money'
          ? 'Not enough gold.'
          : res === 'no_items'
            ? `You need ${nextUpgrade(getState(), up)?.needs?.qty ?? ''} ${items[nextUpgrade(getState(), up)?.needs?.item ?? '']?.name ?? 'more goods'}.`
            : 'Already maxed.',
        'warn',
      );
    }
    this.rebuild();
  }
}

/** The x5 button is only offered on cheap rows. */
const X5_MAX_PRICE = 300;

const perkDiscount = (s: ReturnType<typeof getState>): number =>
  Math.min(0.3, perk(s, 'shopDiscount'));
