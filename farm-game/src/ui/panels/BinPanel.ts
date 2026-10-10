import Phaser from 'phaser';
import { fish } from '../../data';
import { audio } from '../../platform/audio';
import { toast } from '../../systems/events';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  isProduce,
  isShippable,
  shipAllProduce,
  shipStack,
  shippingValue,
  unshipStack,
} from '../../systems/economy';
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
import { boardWants, requestWants, wantedByBoard } from '../../systems/orders';
import { npcs } from '../../data';
import { binWantedSub, boardWantsLine, keptLine } from './binText';

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
      // Goods an open request wants read in the warning colour (critique 9, F2).
      const want = have > 0 ? wantedByBoard(s, ref) : 0;
      const wanted = want > 0;
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        sub: wanted
          ? binWantedSub(want, have, inBin)
          : `${fmt(sellValue(ref))}g  have ${have}  bin ${inBin}`,
        subColor: wanted ? C.warn : inBin ? C.gold : C.creamDim,
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
    // Left-handed: Ship all on the left (by the thumb), the page arrows on the right.
    const left = this.leftHanded;
    const pagerX = left ? this.panelW - 60 : 8;
    if (pages > 1) {
      this.button(
        pagerX,
        footerY,
        24,
        20,
        '<',
        () => ((this.page = (this.page + pages - 1) % pages), this.rebuild()),
      );
      this.button(
        pagerX + 28,
        footerY,
        24,
        20,
        '>',
        () => ((this.page = (this.page + 1) % pages), this.rebuild()),
      );
    }
    this.label(this.panelW - 8, 8, `In bin: ${fmt(shippingValue(s))}g`, C.gold, 1, 'right');
    // One tap ships every crop, fish, wild good and product (one-thumb: low in the sheet, by the thumb).
    const produce = list.some((r) => countStack(s, r) > 0 && isProduce(r.item));
    this.button(left ? 8 : this.panelW - 8 - 92, footerY, 92, 20, 'Ship all produce', () => {
      // Goods the open requests want stay in the bag (critique 9, F2); the row's "All" still ships them.
      const res = shipAllProduce(getState(), boardWants(getState()));
      if (res.count === 0) audio.play('error');
      else {
        audio.play('coin');
        haptic('tick');
      }
      const sp = getState().special;
      const spKind = sp ? `${sp.item}|` : '';
      const kept = keptLine(
        res.kept,
        sp
          ? {
              kind: spKind,
              giver: npcs[sp.giver]?.name ?? sp.giver,
              requests: Math.min(
                res.kept.get(spKind) ?? 0,
                requestWants(getState()).get(spKind) ?? 0,
              ),
            }
          : undefined,
      );
      if (kept) toast(kept, 'warn');
      this.rebuild();
    }).setEnabled(produce);
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
      // Shipping what an open request wants: say so, once the bag holds fewer than it asks for.
      else if (delta > 0) {
        const want = wantedByBoard(s, ref);
        const left = s.inventory.slots.reduce(
          (n, st) =>
            st && st.item === ref.item && (st.of ?? '') === (ref.of ?? '') ? n + st.qty : n,
          0,
        );
        if (want > left) toast(boardWantsLine(want, ref), 'warn');
      }
    }
    this.rebuild();
  }
}
