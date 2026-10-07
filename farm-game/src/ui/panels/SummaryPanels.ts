import Phaser from 'phaser';
import { goals, items } from '../../data';
import { audio } from '../../platform/audio';
import type { DaySummary } from '../../state/GameState';
import { getState } from '../../state/store';
import { rankTitle } from '../../systems/day';
import { stat } from '../../systems/goals';
import { seasonLabel } from '../../systems/time';
import { C } from '../theme';
import { Modal } from '../widgets';

import { fmt } from './format';

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

  override confirm(): void {
    this.finish();
  }

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
    this.panelH = 124 + Math.max(1, lines.length + (extra > 0 ? 1 : 0)) * 11 + 34;
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
