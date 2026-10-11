import { GAME_HEIGHT } from '../../config';
import Phaser from 'phaser';
import { goals } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import type { DaySummary } from '../../state/GameState';
import { getState } from '../../state/store';
import { rankTitle } from '../../systems/day';
import { goalsDone, stat } from '../../systems/goals';
import { displayName, parseKey } from '../../systems/itemRef';
import { seasonLabel } from '../../systems/time';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';
import { summaryTip } from './summaryTips';
import { arrangeNotes } from './summaryNotes';
import { guidedMorning, guidedNotes } from '../../systems/tutorial';
import { fmtGold, t } from '../../i18n';

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
/** Sales lines on the morning sheet, and on a crowded one. */
const SALES_LINES = 6;
const SALES_LINES_BUSY = 2;

export class SummaryPanel extends WaitModal {
  private summary: DaySummary | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 260);
    // Shown under the night's blackout, over a hidden HUD: it keeps the taller cap it was laid out for.
    this.maxHeight = GAME_HEIGHT - 60;
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
    // Then the sales list shrinks to two lines (critique 12, F3: the season result was cut for the 7th sale).
    let withTip = !guidedMorning(getState());
    let maxNotes = this.notes(this.summary).length;
    let maxSales = SALES_LINES;
    let end = this.draw(this.summary, withTip, maxNotes, maxSales);
    while (end + 40 > MAX_SUMMARY_H && (withTip || maxNotes > 0)) {
      if (withTip) withTip = false;
      else if (maxSales > SALES_LINES_BUSY) maxSales = SALES_LINES_BUSY;
      else maxNotes -= 1;
      this.content.removeAll(true);
      end = this.draw(this.summary, withTip, maxNotes, maxSales);
    }
    this.content.removeAll(true);
    this.setHeight(end + 40);
    this.draw(this.summary, withTip, maxNotes, maxSales);
    this.button(8, this.panelH - 30, this.panelW - 16, 24, t('summary.wakeUp'), () => this.finish(), {
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
  private draw(
    sum: DaySummary,
    withTip = true,
    maxNotes = Infinity,
    maxSales = SALES_LINES,
  ): number {
    const s = getState();
    const lines = sum.shipped.slice(0, maxSales);
    const extra = sum.shipped.length - lines.length;
    this.panel();
    let y = 8;
    const text = (
      str: string,
      color: number,
      opts: { x?: number; align?: 'left' | 'center' | 'right'; wrap?: number; gap?: number } = {},
    ): number => {
      const l = this.label(opts.x ?? 8, y, str, color, 1, opts.align ?? 'left', opts.wrap);
      return l.textHeight + (opts.gap ?? 3);
    };
    const mid = this.panelW / 2;
    y +=
      this.label(
        mid,
        y,
        t('summary.dayComplete', { season: seasonLabel(sum.endedSeason), day: sum.endedDay }),
        C.gold,
        1,
        'center',
      ).textHeight + 3;
    y += text(
      sum.passedOut ? t('summary.passedOut') : t('summary.slept'),
      sum.passedOut ? C.warn : C.green,
      { x: mid, align: 'center', gap: 9 },
    );
    y += text(t('summary.sold'), C.gold, { gap: 4 });
    if (lines.length === 0) y += text(t('summary.nothingShipped'), C.creamDim, { wrap: 184, gap: 4 });
    for (const l of lines) {
      this.label(192, y, fmtGold(l.gold), C.gold, 1, 'right');
      y += text(`${displayName(parseKey(l.item))} x${l.qty}`, C.cream, { wrap: 130 });
    }
    if (extra > 0) y += text(t('summary.andMore', { n: extra }), C.creamDim);
    y += 3;
    this.label(192, y, `+${fmtGold(sum.total)}`, C.green, 1, 'right');
    y += text(t('summary.total'), C.cream, { gap: 8 });
    if (sum.withered > 0)
      y += text(t('summary.withered', { count: sum.withered }), C.warn, { wrap: 184, gap: 4 });
    y += text(
      t('summary.now', {
        season: seasonLabel(s.time.season),
        day: s.time.day,
        gold: fmt(s.money),
      }),
      C.cream,
      { wrap: 184 },
    );
    y += text(
      sum.weather === 'storm'
        ? t('summary.storm')
        : sum.weather === 'rain'
          ? t('summary.rain')
          : t('summary.sun'),
      sum.weather === 'sunny' ? C.creamDim : C.blue,
      { gap: 8 },
    );
    const guided = guidedMorning(s);
    if (!guided)
      y += text(
        t('sleep.tomorrow', { forecast: forecastText(s.forecast), extra: '' }),
        s.forecast === 'sunny' ? C.creamDim : C.blue,
        {
          gap: 8,
        },
      );
    const notes = this.notes(sum);
    for (const note of notes.slice(0, maxNotes)) y += text(note, C.cream, { wrap: 184, gap: 4 });
    if (notes.length > maxNotes)
      y += text(t('summary.andMore', { n: notes.length - maxNotes }), C.creamDim, { gap: 4 });
    if (withTip && !guided)
      y += text(t('summary.tip', { tip: summaryTip(s.time.season, s.time.day, s.time.year) }), C.creamDim, {
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
    this.label(this.panelW / 2, 10, t('yearEnd.title'), C.gold, 2, 'center');
    this.label(
      this.panelW / 2,
      30,
      t('yearEnd.results', { year: Math.max(1, s.time.year - 1) }),
      C.creamDim,
      1,
      'center',
    );
    const rows: [string, string][] = [
      [t('stats.earned'), fmtGold(earned)],
      [t('stats.harvested'), fmt(stat(s, 'harvested'))],
      [t('stats.planted'), fmt(stat(s, 'planted'))],
      [t('yearEnd.goals'), `${goalsDone(s)}/${goals.length}`],
    ];
    rows.forEach(([k, v], i) => {
      this.label(10, 50 + i * 13, k);
      this.label(190, 50 + i * 13, v, C.gold, 1, 'right');
    });
    this.label(this.panelW / 2, 112, t('yearEnd.rank'), C.creamDim, 1, 'center');
    this.label(this.panelW / 2, 124, rankTitle(earned).toUpperCase(), C.green, 2, 'center');
    this.label(this.panelW / 2, 150, t('yearEnd.newSpring'), C.cream, 1, 'center');
    this.button(8, this.panelH - 30, this.panelW - 16, 24, t('yearEnd.keepPlaying'), () => this.finish(), {
      textColor: C.green,
      rim: C.green,
    });
  }
}

export const forecastText = (w: string): string =>
  t(w === 'storm' ? 'forecast.storm' : w === 'rain' ? 'forecast.rain' : 'forecast.sunny');
