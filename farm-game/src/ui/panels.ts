import Phaser from 'phaser';
import { game, goals, items, shops } from '../data';
import { saveNow } from '../game/persistence';
import { audio } from '../platform/audio';
import type { DaySummary } from '../state/GameState';
import { getState } from '../state/store';
import { waterCapacity } from '../systems/actions';
import { rankTitle } from '../systems/day';
import {
  buyItem,
  buyPrice,
  buyUpgrade,
  isShippable,
  nextUpgrade,
  sellPrice,
  shipItem,
  shippingValue,
  stockFor,
  unshipItem,
} from '../systems/economy';
import { maxEnergy } from '../systems/energy';
import { toast } from '../systems/events';
import { goalProgress, stat } from '../systems/goals';
import { countItem, isToolSlot, selectSlot, swapSlots } from '../systems/inventory';
import { formatClock, seasonLabel } from '../systems/time';
import { C } from './theme';
import { Button, drawBar, drawSlot, Modal } from './widgets';

const SHOP_ID = 'town_general_store';
const fmt = (n: number): string => n.toLocaleString('en-US');

// ============================================================ Menu

type Tab = 'items' | 'goals' | 'options';

export class MenuPanel extends Modal {
  private tab: Tab = 'items';
  private cursor: number | null = null;
  private confirmQuit = false;

  constructor(
    scene: Phaser.Scene,
    private readonly onQuit: () => void,
  ) {
    super(scene, 420, 236);
  }

  protected build(): void {
    this.panel();
    (['items', 'goals', 'options'] as Tab[]).forEach((t, i) => {
      const active = t === this.tab;
      this.button(
        10 + i * 78,
        8,
        74,
        20,
        t === 'items' ? 'Items' : t === 'goals' ? 'Goals' : 'Options',
        () => {
          this.tab = t;
          this.cursor = null;
          this.confirmQuit = false;
          this.rebuild();
        },
        { rim: active ? C.gold : C.creamDim, textColor: active ? C.gold : C.cream },
      );
    });
    this.closeButton();
    if (this.tab === 'items') this.buildItems();
    else if (this.tab === 'goals') this.buildGoals();
    else this.buildOptions();
  }

  private buildItems(): void {
    const s = getState();
    const size = 28;
    const gap = 3;
    const x0 = 14;
    const y0 = 38;
    const g = this.scene.add.graphics();
    this.content.add(g);
    s.inventory.slots.forEach((stack, i) => {
      const x = x0 + (i % 8) * (size + gap);
      const y = y0 + Math.floor(i / 8) * (size + gap);
      drawSlot(g, x, y, size, i === this.cursor, i < game.hotbarSlots);
      if (i === s.inventory.selected)
        g.lineStyle(1, C.gold, 1).strokeRect(x - 1.5, y - 1.5, size + 3, size + 3);
      if (stack) {
        this.icon(x + size / 2, y + size / 2, items[stack.item]!.icon);
        if (!isToolSlot(i) && stack.qty > 1)
          this.label(x + size - 3, y + size - 9, String(stack.qty), C.cream, 1, 'right');
      }
      const zone = this.scene.add.zone(x, y, size, size).setOrigin(0, 0).setInteractive();
      zone.on('pointerup', () => this.tapSlot(i));
      this.content.add(zone);
    });

    const cur = this.cursor !== null ? s.inventory.slots[this.cursor] : null;
    const dx = 278;
    if (cur) {
      const def = items[cur.item]!;
      this.icon(dx + 8, 46, def.icon);
      this.label(dx + 22, 42, def.name, C.gold);
      this.label(dx, 58, def.description, C.cream, 1, 'left', 130);
      if (def.sellPrice) this.label(dx, 96, `Sells for ${def.sellPrice}g`, C.creamDim);
      if (def.buyPrice) this.label(dx, 108, `Costs ${def.buyPrice}g in town`, C.creamDim);
    } else {
      this.label(dx, 42, 'Backpack', C.gold);
      this.label(
        dx,
        58,
        'Blue-edged slots are your hotbar. Tap a slot, then another to swap. Tap the same slot to equip it.',
        C.creamDim,
        1,
        'left',
        130,
      );
    }
    this.label(
      14,
      y0 + 3 * (size + gap) + 6,
      `Energy ${s.energy}/${maxEnergy(s)}    Water ${s.water}/${waterCapacity(s)}    Gold ${fmt(s.money)}`,
      C.creamDim,
    );
    this.label(
      14,
      y0 + 3 * (size + gap) + 20,
      'Keys: WASD move, Space use tool, E interact, 1-8 hotbar, Esc menu',
      C.creamDim,
    );
    this.label(
      14,
      y0 + 3 * (size + gap) + 34,
      'Tip: hold the Action button to keep working a row of tiles.',
      C.creamDim,
    );
  }

  private tapSlot(i: number): void {
    const s = getState();
    if (this.cursor === null) {
      if (s.inventory.slots[i]) this.cursor = i;
    } else if (this.cursor === i) {
      if (i < game.hotbarSlots) selectSlot(s, i);
      this.cursor = null;
    } else {
      if (!swapSlots(s, this.cursor, i)) audio.play('error');
      this.cursor = null;
    }
    audio.play('select');
    this.rebuild();
  }

  private buildGoals(): void {
    const s = getState();
    const prog = goalProgress(s);
    this.label(14, 40, 'CURRENT GOAL', C.gold);
    if (prog) {
      this.label(14, 54, prog.goal.text, C.cream, 1, 'left', 390);
      const g = this.scene.add.graphics();
      drawBar(g, 14, 70, 300, 7, prog.value / prog.goal.target, C.gold);
      this.content.add(g);
      this.label(322, 69, `${fmt(prog.value)}/${fmt(prog.goal.target)}`, C.gold);
      this.label(14, 82, `Reward: +${prog.goal.reward}g`, C.green);
    } else {
      this.label(14, 54, 'Every goal is done. You are a Harvest Legend!', C.green);
    }
    this.label(14, 104, 'COMPLETED', C.gold);
    const done = goals.slice(Math.max(0, s.goalIndex - 5), s.goalIndex);
    if (done.length === 0) this.label(14, 118, 'Nothing yet. You can do it!', C.creamDim);
    done.forEach((d, i) => this.label(14, 118 + i * 11, `+ ${d.text}`, C.creamDim, 1, 'left', 250));
    const stats: [string, number][] = [
      ['Gold earned', stat(s, 'earned')],
      ['Crops harvested', stat(s, 'harvested')],
      ['Seeds planted', stat(s, 'planted')],
      ['Days slept', stat(s, 'daysSlept')],
    ];
    this.label(280, 104, 'STATS', C.gold);
    stats.forEach(([name, v], i) => {
      this.label(280, 118 + i * 11, name, C.creamDim);
      this.label(406, 118 + i * 11, fmt(v), C.cream, 1, 'right');
    });
  }

  private buildOptions(): void {
    const s = getState();
    const volumeRow = (y: number, name: string, key: 'music' | 'sfx') => {
      this.label(14, y + 8, name);
      const step = (d: number) => {
        s.settings[key] = Math.round(Math.max(0, Math.min(1, s.settings[key] + d)) * 10) / 10;
        audio.setVolumes(s.settings.music, s.settings.sfx, s.settings.muted);
        if (key === 'sfx') audio.play('coin');
        this.rebuild();
      };
      this.button(90, y, 26, 24, '-', () => step(-0.1));
      const g = this.scene.add.graphics();
      drawBar(g, 124, y + 7, 110, 10, s.settings[key], C.green);
      this.content.add(g);
      this.button(242, y, 26, 24, '+', () => step(0.1));
      this.label(278, y + 8, `${Math.round(s.settings[key] * 100)}%`, C.creamDim);
    };
    volumeRow(40, 'Music', 'music');
    volumeRow(70, 'Sound', 'sfx');
    this.button(14, 104, 120, 24, s.settings.muted ? 'Sound: OFF' : 'Sound: ON', () => {
      s.settings.muted = !s.settings.muted;
      audio.setVolumes(s.settings.music, s.settings.sfx, s.settings.muted);
      this.rebuild();
    });
    this.button(142, 104, 120, 24, 'Fullscreen', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    });
    const saveBtn: Button = this.button(14, 138, 120, 24, 'Save now', () => {
      void saveNow().then(() => saveBtn.setLabel('Saved!'));
    });
    this.button(
      142,
      138,
      120,
      24,
      this.confirmQuit ? 'Tap again!' : 'Quit to title',
      () => {
        if (!this.confirmQuit) {
          this.confirmQuit = true;
          this.rebuild();
          return;
        }
        void saveNow().then(() => {
          this.close();
          this.onQuit();
        });
      },
      { textColor: this.confirmQuit ? C.warn : C.cream },
    );
    this.label(14, 176, 'Your game saves automatically every time you sleep,', C.creamDim);
    this.label(14, 188, 'change maps, or leave the page.', C.creamDim);
  }
}

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
      toast(`${up.name} upgraded!`, 'good');
    } else {
      audio.play('error');
      toast(res === 'no_money' ? 'Not enough gold.' : 'Already maxed.', 'warn');
    }
    this.rebuild();
  }
}

// ============================================================ Shipping bin

export class BinPanel extends Modal {
  private page = 0;
  private static readonly ROWS = 7;

  constructor(scene: Phaser.Scene) {
    super(scene, 380, 226);
  }

  protected build(): void {
    const s = getState();
    this.panel();
    this.label(14, 11, 'Shipping Bin', C.gold, 2);
    this.label(14, 30, 'Sold tomorrow morning at full price.', C.creamDim);
    this.closeButton();

    const ids = new Set<string>();
    s.inventory.slots.forEach((st) => st && isShippable(st.item) && ids.add(st.item));
    Object.keys(s.shipping).forEach((id) => ids.add(id));
    const list = [...ids].sort((a, b) => sellPrice(b) - sellPrice(a));
    const pages = Math.max(1, Math.ceil(list.length / BinPanel.ROWS));
    this.page = Math.min(this.page, pages - 1);

    if (list.length === 0) {
      this.label(14, 70, 'Nothing to ship yet. Harvest some crops first!', C.creamDim);
    }
    list.slice(this.page * BinPanel.ROWS, (this.page + 1) * BinPanel.ROWS).forEach((id, i) => {
      const y = 44 + i * 24;
      const def = items[id]!;
      const have = countItem(s, id);
      const inBin = s.shipping[id] ?? 0;
      this.icon(24, y + 11, def.icon);
      this.label(40, y + 2, def.name);
      this.label(40, y + 12, `${sellPrice(id)}g each`, C.creamDim);
      this.label(176, y + 7, `Have ${have}`, C.creamDim, 1, 'right');
      this.label(236, y + 7, `Bin ${inBin}`, inBin ? C.gold : C.creamDim, 1, 'right');
      this.button(244, y, 28, 22, '-1', () => this.move(id, -1), {
        textColor: inBin ? C.cream : C.creamDim,
      });
      this.button(276, y, 28, 22, '+1', () => this.move(id, 1), {
        textColor: have ? C.cream : C.creamDim,
      });
      this.button(308, y, 56, 22, 'All', () => this.move(id, have), {
        textColor: have ? C.gold : C.creamDim,
      });
    });
    if (pages > 1) {
      this.button(14, 204, 26, 18, '<', () => {
        this.page = (this.page + pages - 1) % pages;
        this.rebuild();
      });
      this.button(44, 204, 26, 18, '>', () => {
        this.page = (this.page + 1) % pages;
        this.rebuild();
      });
    }
    this.label(14 + (pages > 1 ? 84 : 0), 208, `In the bin: ${fmt(shippingValue(s))}g`, C.gold);
    this.button(this.panelW - 74, 200, 62, 22, 'Done', () => this.close(), { textColor: C.green });
  }

  private move(id: string, delta: number): void {
    const s = getState();
    const moved = delta > 0 ? shipItem(s, id, delta) : unshipItem(s, id, -delta);
    if (moved === 0) audio.play('error');
    else audio.play('coin');
    this.rebuild();
  }
}

// ============================================================ Sleep confirm

export class SleepPanel extends Modal {
  constructor(
    scene: Phaser.Scene,
    private readonly onSleep: () => void,
  ) {
    super(scene, 250, 104);
  }

  protected build(): void {
    const s = getState();
    this.panel();
    this.label(this.panelW / 2, 12, 'Go to bed?', C.gold, 2, 'center');
    this.label(this.panelW / 2, 34, `It is ${formatClock(s.time.minutes)}.`, C.cream, 1, 'center');
    this.label(
      this.panelW / 2,
      46,
      'Crops grow, the bin is emptied for gold,',
      C.creamDim,
      1,
      'center',
    );
    this.label(this.panelW / 2, 57, 'and you wake up fully rested.', C.creamDim, 1, 'center');
    this.button(
      18,
      74,
      100,
      22,
      'Sleep',
      () => {
        this.close();
        this.onSleep();
      },
      { textColor: C.green, rim: C.green },
    );
    this.button(132, 74, 100, 22, 'Not yet', () => this.close());
  }
}

// ============================================================ Day summary & year end

const TIPS = [
  'Water your crops every day. Unwatered crops do not grow.',
  'Seeds only grow in their season. Plan your next planting.',
  'Corn regrows after harvest. Great value in summer.',
  'Hold the Action button to work a whole row of tiles.',
  'Upgrade the watering can to spend less time at the pond.',
  'Passing out at 2 AM only restores half your energy. Sleep earlier!',
  'Weeds sprout in the field. Cut them with the scythe for fiber.',
  'Crops left in the field when the season changes will wither.',
  'The shipping bin pays the next morning, so ship before bed.',
];

abstract class WaitModal extends Modal {
  private resolve: (() => void) | null = null;

  protected finish(): void {
    this.close();
    this.resolve?.();
    this.resolve = null;
  }

  show(): Promise<void> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}

export class SummaryPanel extends WaitModal {
  private summary: DaySummary | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 300, 220);
  }

  present(summary: DaySummary): Promise<void> {
    this.summary = summary;
    if (summary.total > 0) {
      audio.play('coin');
      this.scene.time.delayedCall(140, () => audio.play('coin'));
      this.scene.time.delayedCall(300, () => audio.play('buy'));
    }
    return this.show();
  }

  protected build(): void {
    const sum = this.summary;
    if (!sum) return;
    const s = getState();
    const lines = sum.shipped.slice(0, 6);
    const extra = sum.shipped.length - lines.length;
    this.panelH = 112 + Math.max(1, lines.length + (extra > 0 ? 1 : 0)) * 11 + 34;
    this.root.setY(Math.round((270 - this.panelH) / 2));
    this.panel(this.panelW, this.panelH);
    this.label(
      this.panelW / 2,
      10,
      `${seasonLabel(sum.endedSeason)} ${sum.endedDay} complete`,
      C.gold,
      2,
      'center',
    );
    this.label(
      this.panelW / 2,
      30,
      sum.passedOut ? 'You passed out from exhaustion...' : 'You slept soundly.',
      sum.passedOut ? C.warn : C.green,
      1,
      'center',
    );
    this.label(14, 48, 'SOLD THIS MORNING', C.gold);
    let y = 60;
    if (lines.length === 0) {
      this.label(14, y, 'Nothing shipped. Use the bin by the house!', C.creamDim);
      y += 11;
    }
    for (const l of lines) {
      this.label(14, y, `${items[l.item]?.name ?? l.item} x${l.qty}`);
      this.label(this.panelW - 14, y, `${fmt(l.gold)}g`, C.gold, 1, 'right');
      y += 11;
    }
    if (extra > 0) {
      this.label(14, y, `...and ${extra} more`, C.creamDim);
      y += 11;
    }
    y += 4;
    this.label(14, y, 'Total', C.cream);
    this.label(this.panelW - 14, y, `+${fmt(sum.total)}g`, C.green, 1, 'right');
    y += 14;
    if (sum.withered > 0) {
      this.label(
        14,
        y,
        `${sum.withered} crop${sum.withered > 1 ? 's' : ''} withered with the new season.`,
        C.warn,
        1,
        'left',
        270,
      );
      y += 11;
    }
    this.label(
      14,
      y,
      `Now: ${seasonLabel(s.time.season)} ${s.time.day}. Gold: ${fmt(s.money)}`,
      C.cream,
    );
    y += 14;
    this.label(
      14,
      y,
      `Tip: ${TIPS[(s.time.day + s.time.year) % TIPS.length]}`,
      C.creamDim,
      1,
      'left',
      270,
    );
    this.button(this.panelW / 2 - 55, this.panelH - 30, 110, 22, 'Wake up', () => this.finish(), {
      textColor: C.green,
      rim: C.green,
    });
  }
}

export class YearEndPanel extends WaitModal {
  constructor(scene: Phaser.Scene) {
    super(scene, 300, 190);
  }

  present(): Promise<void> {
    return this.show();
  }

  protected build(): void {
    const s = getState();
    const earned = stat(s, 'earned');
    this.panel();
    this.label(this.panelW / 2, 12, 'END OF SUMMER', C.gold, 2, 'center');
    this.label(this.panelW / 2, 32, `Year ${s.time.year} results`, C.creamDim, 1, 'center');
    const rows: [string, string][] = [
      ['Gold earned selling crops', `${fmt(earned)}g`],
      ['Crops harvested', fmt(stat(s, 'harvested'))],
      ['Seeds planted', fmt(stat(s, 'planted'))],
      ['Goals completed', `${s.goalIndex}/${goals.length}`],
    ];
    rows.forEach(([k, v], i) => {
      this.label(18, 52 + i * 13, k);
      this.label(this.panelW - 18, 52 + i * 13, v, C.gold, 1, 'right');
    });
    this.label(this.panelW / 2, 110, 'Your rank', C.creamDim, 1, 'center');
    this.label(this.panelW / 2, 122, rankTitle(earned).toUpperCase(), C.green, 2, 'center');
    this.label(this.panelW / 2, 144, 'Fall crops await. Keep farming!', C.cream, 1, 'center');
    this.button(this.panelW / 2 - 55, 160, 110, 22, 'Keep playing', () => this.finish(), {
      textColor: C.green,
      rim: C.green,
    });
  }
}
