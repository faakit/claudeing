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
import { summaryTip } from './summaryTips';
import { arrangeNotes } from './summaryNotes';
import { guidedMorning, guidedNotes } from '../../systems/tutorial';

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

/** Tallest the morning sheet may be (Modal caps sheets 60px below the top). */
const MAX_SUMMARY_H = 340;

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
    if (!this.summary) return;
    // Text wraps to a length we cannot know up front, so lay it out once to measure the real height,
    // then again at that height. Nothing is placed at a fixed y, so lines can never overlap.
    this.setHeight(400);
    // A busy morning (jobs, letters, a festival, many sales) first drops the tip, then the last notes,
    // rather than run under the Wake up button. Weather and the forecast come before the notes, so
    // they are never the part that is cut.
    // The first guided morning stays short (the guide shows the rest one thing at a time).
    let withTip = !guidedMorning(getState());
    let maxNotes = this.notes(this.summary).length;
    let end = this.draw(this.summary, withTip, maxNotes);
    while (end + 40 > MAX_SUMMARY_H && (withTip || maxNotes > 0)) {
      if (withTip) withTip = false;
      else maxNotes -= 1;
      this.content.removeAll(true);
      end = this.draw(this.summary, withTip, maxNotes);
    }
    this.content.removeAll(true);
    this.setHeight(end + 40);
    this.draw(this.summary, withTip, maxNotes);
    this.button(8, this.panelH - 30, this.panelW - 16, 24, 'Wake up', () => this.finish(), {
      textColor: C.green,
      rim: C.green,
    });
  }

  /** Morning notes; a guided first morning keeps only one (the letter, which the guide points at next). */
  private notes(sum: DaySummary): string[] {
    const all = arrangeNotes(sum.notes ?? []);
    return guidedMorning(getState()) ? guidedNotes(all) : all;
  }

  /** Draw the summary top to bottom; returns the y just below the last line. */
  private draw(sum: DaySummary, withTip = true, maxNotes = Infinity): number {
    const s = getState();
    const lines = sum.shipped.slice(0, 6);
    const extra = sum.shipped.length - lines.length;
    this.panel();
    let y = 8;
    const text = (
      t: string,
      color: number,
      opts: { x?: number; align?: 'left' | 'center' | 'right'; wrap?: number; gap?: number } = {},
    ): number => {
      const l = this.label(opts.x ?? 8, y, t, color, 1, opts.align ?? 'left', opts.wrap);
      return l.textHeight + (opts.gap ?? 3);
    };
    const mid = this.panelW / 2;
    y +=
      this.label(
        mid,
        y,
        `${seasonLabel(sum.endedSeason)} ${sum.endedDay} complete`,
        C.gold,
        1,
        'center',
      ).textHeight + 3;
    y += text(
      sum.passedOut ? 'You passed out from exhaustion...' : 'You slept soundly.',
      sum.passedOut ? C.warn : C.green,
      { x: mid, align: 'center', gap: 9 },
    );
    y += text('SOLD THIS MORNING', C.gold, { gap: 4 });
    if (lines.length === 0)
      y += text('Nothing shipped. Use the bin by the house!', C.creamDim, { wrap: 184, gap: 4 });
    for (const l of lines) {
      this.label(192, y, `${fmt(l.gold)}g`, C.gold, 1, 'right');
      y += text(`${displayName(parseKey(l.item))} x${l.qty}`, C.cream, { wrap: 130 });
    }
    if (extra > 0) y += text(`...and ${extra} more`, C.creamDim);
    y += 3;
    this.label(192, y, `+${fmt(sum.total)}g`, C.green, 1, 'right');
    y += text('Total', C.cream, { gap: 8 });
    if (sum.withered > 0)
      y += text(
        `${sum.withered} crop${sum.withered > 1 ? 's' : ''} withered with the new season.`,
        C.warn,
        { wrap: 184, gap: 4 },
      );
    y += text(`Now: ${seasonLabel(s.time.season)} ${s.time.day}. Gold: ${fmt(s.money)}`, C.cream, {
      wrap: 184,
    });
    y += text(
      sum.weather === 'storm'
        ? 'A storm! Crops are watered.'
        : sum.weather === 'rain'
          ? 'It is raining. Crops are watered!'
          : 'The sun is out today.',
      sum.weather === 'sunny' ? C.creamDim : C.blue,
      { gap: 8 },
    );
    const guided = guidedMorning(s);
    if (!guided)
      y += text(
        `Tomorrow: ${forecastText(s.forecast)}`,
        s.forecast === 'sunny' ? C.creamDim : C.blue,
        {
          gap: 8,
        },
      );
    const notes = this.notes(sum);
    for (const note of notes.slice(0, maxNotes)) y += text(note, C.cream, { wrap: 184, gap: 4 });
    if (notes.length > maxNotes)
      y += text(`...and ${notes.length - maxNotes} more`, C.creamDim, { gap: 4 });
    if (withTip && !guided)
      y += text(`Tip: ${summaryTip(s.time.season, s.time.day, s.time.year)}`, C.creamDim, {
        wrap: 184,
      });
    return y;
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
    this.label(this.panelW / 2, 10, 'END OF YEAR', C.gold, 2, 'center');
    this.label(
      this.panelW / 2,
      30,
      `Year ${Math.max(1, s.time.year - 1)} results`,
      C.creamDim,
      1,
      'center',
    );
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
    this.label(this.panelW / 2, 150, 'A new spring awaits. Keep farming!', C.cream, 1, 'center');
    this.button(8, this.panelH - 30, this.panelW - 16, 24, 'Keep playing', () => this.finish(), {
      textColor: C.green,
      rim: C.green,
    });
  }
}

export const forecastText = (w: string): string =>
  w === 'storm' ? 'a storm is coming' : w === 'rain' ? 'rain' : 'sunny';
