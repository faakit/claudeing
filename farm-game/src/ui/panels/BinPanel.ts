import Phaser from 'phaser';
import { items } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { isShippable, sellPrice, shipItem, shippingValue, unshipItem } from '../../systems/economy';
import { countItem } from '../../systems/inventory';
import { C } from '../theme';
import { Modal } from '../widgets';

import { fmt } from './format';

// ============================================================ Shipping bin

export class BinPanel extends Modal {
  private page = 0;
  private static readonly ROWS = 6;

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
    else {
      audio.play('coin');
      haptic('tick');
    }
    this.rebuild();
  }
}
