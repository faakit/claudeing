import { items, placeables, shops } from '../../data';
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
  placeLimit,
  stockFor,
} from '../../systems/economy';
import { toast } from '../../systems/events';
import { countItem } from '../../systems/inventory';
import { perk } from '../../systems/skills';
import { ownsGreenhouse } from '../../systems/plots';
import { C } from '../theme';
import { Modal, ROW_H } from '../widgets';
import { fmt, SHOP_ID } from './format';
import {
  shopCard,
  shopFacts,
  shopFactsRoom,
  shopTabOf,
  shopTabs,
  TAB_GAP,
  TABS_X,
  tooLate,
  type ShopTab,
} from './shopFacts';
import { measureText } from '../fontMetrics';
import Phaser from 'phaser';
import { fmtGold, t } from '../../i18n';

const ROWS = 5;
/** The list's height: five rows of the body face, the legend, the pager and Close. */
const SHEET_H = 284;

export class ShopPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, SHEET_H);
  }

  private tab: ShopTab = 'seeds';
  private page = 0;
  /** The item whose card is open (a tap on its row), or null for the list. */
  card: string | null = null;
  /** Where the list's first row starts in the sheet (e2e taps a row by it). */
  firstRowY = 0;

  override open(): void {
    this.card = null;
    super.open();
  }

  protected build(): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    this.panel();
    if (this.card && items[this.card]) {
      this.buildCard(this.card);
      return;
    }
    this.label(8, 8, shop.name, C.gold);
    this.icon(this.panelW - 12, 12, 'ui_coin');
    this.label(this.panelW - 20, 8, fmt(s.money), C.gold, 1, 'right');
    let tx = TABS_X;
    shopTabs().forEach(([id, text, w]) => {
      const x = tx;
      tx += w + TAB_GAP;
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

    let y = 42;
    if (this.tab !== 'upgrades') {
      // what a row's tap does and, on Seeds, what "7d" means (QA: the facts on a row were not explained; critic
      // U-4); the card says them in full
      const legend = this.tab === 'seeds' ? t('shop.legendDays') : t('shop.legend');
      y = this.para(8, y, legend, C.creamDim, 184, 4);
    }
    this.firstRowY = y;
    if (this.tab === 'upgrades') {
      this.buildUpgrades(y);
    } else {
      // The Home tab starts with the house upgrades (a bigger bag), then decorations.
      let rows = ROWS;
      if (this.tab === 'home') {
        const home = shop.upgrades.filter((u) => u.tab === 'home');
        for (const up of home) y = this.upgradeRow(y, up);
        rows = ROWS - home.length; // the bag and the kitchen take two of the page's rows
      }
      const stock = stockFor(SHOP_ID, s.time.season, s).filter((id) => shopTabOf(id) === this.tab);
      if (stock.length === 0) {
        this.label(8, y + 6, t('shop.winter'), C.creamDim);
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
    const lim = placeLimit(s, id);
    const own = lim ? lim.have : countItem(s, id);
    const gone = (def.type === 'animal' && own > 0) || (!!lim && lim.have >= lim.max);
    const greenhouse = ownsGreenhouse(s);
    const x5 = !(def.type === 'animal' || price > X5_MAX_PRICE);
    return this.row(y, {
      onTap: () => {
        this.card = id;
        this.rebuild();
      },
      icon: def.icon,
      // what you own is a badge on the icon, so every row's facts have one shape (critic U-4); a decoration's line
      // counts against its cap ("Decor 1/12") and keeps it
      count: placeables[id]?.behavior === 'decor' ? 0 : own,
      title: def.name,
      sub: shopFacts(
        id,
        placeables[id]?.behavior === 'decor' ? own : 0,
        s.time.day,
        greenhouse,
        shopFactsRoom(x5),
        s.time.season,
      ),
      subColor: !greenhouse && tooLate(id, s.time.day) ? C.red : undefined,
      buttons: [
        {
          label: fmtGold(price),
          width: 44,
          onClick: () => this.buy(id, 1),
          color: s.money >= price ? C.gold : C.red,
          enabled: !(lim && lim.have >= lim.max),
        },
        // No x5 on animals or anything dear: one tap must never spend thousands by accident.
        ...(!x5
          ? []
          : [
              {
                label: 'x5',
                width: 26,
                onClick: () => this.buy(id, 5),
                color: s.money >= price * 5 && !gone ? C.cream : C.creamDim,
                enabled: !lim || lim.have + 5 <= lim.max,
              },
            ]),
      ],
    });
  }

  /**
   * An item's card: its icon, name and price, what it does (the item's description), the facts the row could only
   * abbreviate, and Buy (and x5 on a cheap item) on the thumb's side, Back on the other. Close still closes the shop.
   */
  private buildCard(id: string): void {
    const s = getState();
    const def = items[id]!;
    const price = priceFor(s, id);
    const lim = placeLimit(s, id);
    const own = lim ? lim.have : countItem(s, id);
    this.icon(24, 26, def.icon, 2);
    this.label(46, 10, def.name, C.gold, 1, 'left', 146);
    let y = 24;
    if (measureText(def.name) > 146) y += 13;
    this.label(46, y, t('shop.card.price', { gold: fmtGold(price) }), C.creamDim);
    y = Math.max(46, y + 18);
    y = this.para(8, y, def.description, C.cream, 184, 6);
    const greenhouse = ownsGreenhouse(s);
    for (const line of shopCard(id, own, s.time.day, greenhouse, s.time.season))
      y = this.para(8, y, line.text, line.warn ? C.red : C.creamDim, 184, 2);
    // buttons: Buy (and x5) on the thumb's side, Back on the other, above Close
    const by = this.panelH - 56;
    this.wantHeight = Math.max(this.wantHeight, y + 4 + 56);
    const x5 = !(def.type === 'animal' || price > X5_MAX_PRICE);
    const full = !!lim && lim.have >= lim.max;
    const left = this.leftHanded;
    const buyW = x5 ? 92 : 124;
    const buyX = left ? 8 : this.panelW - 8 - buyW;
    this.button(
      buyX,
      by,
      buyW,
      22,
      t('shop.card.buy', { gold: fmtGold(price) }),
      () => this.buy(id, 1),
      {
        textColor: s.money >= price ? C.gold : C.red,
      },
    ).setEnabled(!full);
    if (x5)
      this.button(left ? buyX + buyW + 4 : buyX - 32, by, 28, 22, 'x5', () => this.buy(id, 5), {
        textColor: s.money >= price * 5 ? C.cream : C.creamDim,
      }).setEnabled(!lim || lim.have + 5 <= lim.max);
    this.button(left ? this.panelW - 8 - 56 : 8, by, 56, 22, t('shop.card.back'), () => {
      this.card = null;
      this.rebuild();
    });
    this.closeButton();
  }

  private buildUpgrades(y: number): void {
    const s = getState();
    const shop = shops[SHOP_ID]!;
    for (const up of shop.upgrades.filter((u) => u.tab !== 'home')) y = this.upgradeRow(y, up);
    if (perkDiscount(s) > 0)
      this.para(
        8,
        y + 6,
        t('shop.friendDiscount', { n: Math.round(perkDiscount(s) * 100) }),
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
        title: `${up.name} ${lvl}/${up.levels.length}`,
        sub: next ? next.label : t('shop.maxed'),
        subColor: next ? C.creamDim : C.green,
        buttons: next
          ? [
              {
                label: fmtGold(next.price),
                width: 58,
                onClick: () => this.buyUp(up.id),
                color: s.money >= next.price && !missing ? C.gold : C.red,
              },
            ]
          : [],
      });
      if (next?.needs) {
        // Bars are part of the price: show them on their own line so the effect text stays readable.
        // wrapped inside the sheet (pt-BR ran 11 px past the edge), the next row under however many lines
        y =
          this.para(
            28,
            y - 1,
            t('shop.needs', {
              n: next.needs.qty,
              item: items[next.needs.item]?.name ?? next.needs.item,
              have,
            }),
            missing ? C.red : C.green,
            this.panelW - 36,
            0,
          ) - 1;
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
      toast(t('shop.bought', { n: qty, item: name }), 'good');
    } else {
      audio.play('error');
      haptic('error');
      toast(
        res === 'no_money'
          ? t('common.notEnoughGold')
          : res === 'full'
            ? t('common.inventoryFull')
            : res === 'limit'
              ? t('shop.limit')
              : t('shop.cantBuyNow'),
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
      toast(t('shop.upgraded', { name: up.name }), 'good');
    } else {
      audio.play('error');
      toast(
        res === 'no_money'
          ? t('common.notEnoughGold')
          : res === 'no_items'
            ? t('shop.youNeed', {
                n: nextUpgrade(getState(), up)?.needs?.qty ?? '',
                item:
                  items[nextUpgrade(getState(), up)?.needs?.item ?? '']?.name ??
                  t('shop.moreGoods'),
              })
            : t('shop.alreadyMaxed'),
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
