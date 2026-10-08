import Phaser from 'phaser';
import { fish } from '../../data';
import { audio } from '../../platform/audio';
import { toast } from '../../systems/events';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { isShippable, shipStack, shippingValue, unshipStack } from '../../systems/economy';
import { countStack } from '../../systems/inventory';
import {
  displayName,
  iconKey,
  keyOf,
  parseKey,
  sellValue,
  type ItemRef,
} from '../../systems/itemRef';
import { C } from '../theme';
import { Modal, ROW_H } from '../widgets';
import { fmt } from './format';

const ROWS = 6;

export class BinPanel extends Modal {
  private page = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  protected build(): void {
    const s = getState();
    this.panel();
    this.label(8, 8, 'Shipping Bin', C.gold);
    this.label(8, 20, 'Sold tomorrow morning at full price.', C.creamDim);

    // Every distinct stack the player holds or has already put in the bin.
    const refs = new Map<string, ItemRef>();
    for (const st of s.inventory.slots)
      if (st && isShippable(st)) refs.set(keyOf(st), parseKey(keyOf(st)));
    for (const k of Object.keys(s.shipping)) refs.set(k, parseKey(k));
    const list = [...refs.values()].sort((a, b) => sellValue(b) - sellValue(a));
    const pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.page = Math.min(this.page, pages - 1);

    if (list.length === 0)
      this.label(
        8,
        50,
        'Nothing to ship yet. Harvest some crops first!',
        C.creamDim,
        1,
        'left',
        184,
      );
    let y = 34;
    for (const ref of list.slice(this.page * ROWS, (this.page + 1) * ROWS)) {
      const have = countStack(s, ref);
      const inBin = s.shipping[keyOf(ref)] ?? 0;
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        sub: `${fmt(sellValue(ref))}g  have ${have}  bin ${inBin}`,
        subColor: inBin ? C.gold : C.creamDim,
        buttons: [
          {
            label: 'All',
            width: 28,
            onClick: () => this.move(ref, have),
            color: have ? C.gold : C.creamDim,
          },
          {
            label: '+',
            width: 22,
            onClick: () => this.move(ref, 1),
            color: have ? C.cream : C.creamDim,
          },
          {
            label: '-',
            width: 22,
            onClick: () => this.move(ref, -1),
            color: inBin ? C.cream : C.creamDim,
          },
        ],
      });
    }
    const footerY = 34 + ROWS * ROW_H + 4;
    if (pages > 1) {
      this.button(
        8,
        footerY,
        24,
        20,
        '<',
        () => ((this.page = (this.page + pages - 1) % pages), this.rebuild()),
      );
      this.button(
        36,
        footerY,
        24,
        20,
        '>',
        () => ((this.page = (this.page + 1) % pages), this.rebuild()),
      );
    }
    this.label(
      this.panelW - 8,
      footerY + 6,
      `In bin: ${fmt(shippingValue(s))}g`,
      C.gold,
      1,
      'right',
    );
    this.closeButton('Done');
  }

  private move(ref: ItemRef, delta: number): void {
    const s = getState();
    const moved = delta > 0 ? shipStack(s, ref, delta) : unshipStack(s, ref, -delta);
    if (moved === 0) audio.play('error');
    else {
      audio.play('coin');
      haptic('tick');
      // A legend is once a game: say it can still come back out tonight (critique 7, F7).
      if (delta > 0 && fish.some((f) => f.legend && f.item === ref.item))
        toast('A legend in the bin! Take it back out before bed to keep it.', 'warn');
    }
    this.rebuild();
  }
}
