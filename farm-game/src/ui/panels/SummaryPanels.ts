import Phaser from 'phaser';
import { goals } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import type { DaySummary } from '../../state/GameState';
import { getState } from '../../state/store';
import { rankTitle } from '../../systems/day';
import { stat } from '../../systems/goals';
import { displayName, parseKey } from '../../systems/itemRef';
import { seasonLabel } from '../../systems/time';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';

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

/** A modal the player must acknowledge: no tap-outside dismiss. */
abstract class WaitModal extends Modal {
  private resolve: (() => void) | null = null;

  protected constructor(scene: Phaser.Scene, h: number) {
    super(scene, h);
    this.dismissOnDim = false;
  }

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
    super(scene, 260);
  }

  present(summary: DaySummary): Promise<void> {
    this.summary = summary;
    if (summary.total > 0) {
      audio.play('coin');
      haptic('success');
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
    const bodyRows = Math.max(1, lines.length + (extra > 0 ? 1 : 0));
    this.setHeight(
      150 + bodyRows * 11 + 40 + (sum.withered > 0 ? 22 : 0) + (sum.notes?.length ?? 0) * 11,
    );
    this.panel();
    this.label(
      this.panelW / 2,
      8,
      `${seasonLabel(sum.endedSeason)} ${sum.endedDay} complete`,
      C.gold,
      1,
      'center',
    );
    this.label(
      this.panelW / 2,
      22,
      sum.passedOut ? 'You passed out from exhaustion...' : 'You slept soundly.',
      sum.passedOut ? C.warn : C.green,
      1,
      'center',
    );
    this.label(8, 40, 'SOLD THIS MORNING', C.gold);
    let y = 52;
    if (lines.length === 0) {
      this.label(8, y, 'Nothing shipped. Use the bin by the house!', C.creamDim, 1, 'left', 184);
      y += 11;
    }
    for (const l of lines) {
      this.label(8, y, `${displayName(parseKey(l.item))} x${l.qty}`, C.cream, 1, 'left', 130);
      this.label(192, y, `${fmt(l.gold)}g`, C.gold, 1, 'right');
      y += 11;
    }
    if (extra > 0) {
      this.label(8, y, `...and ${extra} more`, C.creamDim);
      y += 11;
    }
    y += 3;
    this.label(8, y, 'Total', C.cream);
    this.label(192, y, `+${fmt(sum.total)}g`, C.green, 1, 'right');
    y += 14;
    if (sum.withered > 0) {
      this.label(
        8,
        y,
        `${sum.withered} crop${sum.withered > 1 ? 's' : ''} withered with the new season.`,
        C.warn,
        1,
        'left',
        184,
      );
      y += 22;
    }
    for (const note of sum.notes ?? []) {
      this.label(8, y, note, C.cream, 1, 'left', 184);
      y += 11;
    }
    this.label(
      8,
      y,
      `Now: ${seasonLabel(s.time.season)} ${s.time.day}. Gold: ${fmt(s.money)}`,
      C.cream,
    );
    y += 11;
    this.label(
      8,
      y,
      sum.weather === 'rain' ? 'It is raining. Crops are watered!' : 'The sun is out today.',
      sum.weather === 'rain' ? C.blue : C.creamDim,
    );
    y += 14;
    this.label(
      8,
      y,
      `Tip: ${TIPS[(s.time.day + s.time.year) % TIPS.length]}`,
      C.creamDim,
      1,
      'left',
      184,
    );
    this.button(8, this.panelH - 30, this.panelW - 16, 24, 'Wake up', () => this.finish(), {
      textColor: C.green,
      rim: C.green,
    });
  }
}

export class YearEndPanel extends WaitModal {
  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  present(): Promise<void> {
    return this.show();
  }

  protected build(): void {
    const s = getState();
    const earned = stat(s, 'earned');
    this.panel();
    this.label(this.panelW / 2, 10, 'END OF SUMMER', C.gold, 2, 'center');
    this.label(this.panelW / 2, 30, `Year ${s.time.year} results`, C.creamDim, 1, 'center');
    const rows: [string, string][] = [
      ['Gold earned', `${fmt(earned)}g`],
      ['Crops harvested', fmt(stat(s, 'harvested'))],
      ['Seeds planted', fmt(stat(s, 'planted'))],
      ['Goals completed', `${s.goalIndex}/${goals.length}`],
    ];
    rows.forEach(([k, v], i) => {
      this.label(10, 50 + i * 13, k);
      this.label(190, 50 + i * 13, v, C.gold, 1, 'right');
    });
    this.label(this.panelW / 2, 112, 'Your rank', C.creamDim, 1, 'center');
    this.label(this.panelW / 2, 124, rankTitle(earned).toUpperCase(), C.green, 2, 'center');
    this.label(this.panelW / 2, 150, 'Fall crops await. Keep farming!', C.cream, 1, 'center');
    this.button(8, this.panelH - 30, this.panelW - 16, 24, 'Keep playing', () => this.finish(), {
      textColor: C.green,
      rim: C.green,
    });
  }
}
