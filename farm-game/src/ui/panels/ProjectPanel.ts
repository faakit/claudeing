import Phaser from 'phaser';
import { projects } from '../../data';
import { ensureTexture } from '../../game/fallbackTexture';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { toast } from '../../systems/events';
import {
  canGiveItems,
  donateGold,
  donateItems,
  goldGiven,
  isProjectDone,
  itemNeeds,
  needLabel,
  nextLocked,
  priceOf,
  projectLevel,
  projectProgress,
  type FundResult,
} from '../../systems/projects';
import { C } from '../theme';
import { drawBar, Modal } from '../widgets';
import { fmt } from './format';
import {
  GIVE_STEPS,
  GLORY_LINE,
  repeatNow,
  LIST_NAV_FROM_BOTTOM,
  LIST_ROWS,
  LIST_TOP,
  PROJECT_SHEET_H,
  PROJECTS_INTRO,
  projectLists,
  projectSub,
  repeatSub,
} from './projectText';

/** The town fund: a list of projects, and a page per project to give gold and goods to. */
export class ProjectPanel extends Modal {
  private id: string | null = null;
  private page = 0;
  private showFinished = false;

  constructor(scene: Phaser.Scene) {
    super(scene, PROJECT_SHEET_H);
  }

  override open(): void {
    this.id = null;
    this.page = 0;
    this.showFinished = false;
    super.open();
  }

  protected build(): void {
    this.panel();
    if (this.id && projects[this.id]) this.buildDetail(this.id);
    else this.buildList();
    this.closeButton();
  }

  private landmarkIcon(id: string): string {
    const l = projects[id]?.landmark;
    return l ? ensureTexture(this.scene, l.sprite, l.color) : 'ui_coin';
  }

  private buildList(): void {
    const s = getState();
    this.label(8, 8, 'Town Projects', C.gold);
    this.label(192, 8, `Gold ${fmt(s.money)}`, C.gold, 1, 'right');
    this.label(8, 20, PROJECTS_INTRO, C.creamDim);
    // Open projects first; finished ones on their own pages, so nine projects never push a row under
    // Close or off the screen (critique 6, F1).
    const { open, finished } = projectLists(s);
    const list = this.showFinished ? finished : open;
    const pages = Math.max(1, Math.ceil(list.length / LIST_ROWS));
    this.page = Math.min(this.page, pages - 1);
    let y = LIST_TOP;
    for (const id of list.slice(this.page * LIST_ROWS, (this.page + 1) * LIST_ROWS)) {
      const p = projects[id]!;
      const done = isProjectDone(s, id) && !p.repeat;
      y = this.row(y, {
        icon: this.landmarkIcon(id),
        title: p.name,
        sub: p.repeat
          ? repeatSub(projectLevel(s, id), goldGiven(s, id), priceOf(s, id))
          : projectSub(goldGiven(s, id), p.gold, done, p.perks),
        subColor: done ? C.green : C.creamDim,
        buttons: done
          ? []
          : [
              {
                label: 'Open',
                width: 40,
                color: C.gold,
                onClick: () => {
                  this.id = id;
                  this.rebuild();
                },
              },
            ],
      });
    }
    const locked = nextLocked(s);
    if (locked && !this.showFinished && this.page === pages - 1)
      this.label(
        8,
        y + 4,
        `More after the ${projects[locked.after]?.name ?? 'next one'}.`,
        C.creamDim,
      );
    const by = this.panelH - LIST_NAV_FROM_BOTTOM;
    if (pages > 1) {
      this.button(8, by, 30, 20, '<', () => {
        this.page = (this.page + pages - 1) % pages;
        this.rebuild();
      });
      this.button(162, by, 30, 20, '>', () => {
        this.page = (this.page + 1) % pages;
        this.rebuild();
      });
    }
    if (finished.length > 0)
      this.button(
        42,
        by,
        116,
        20,
        this.showFinished ? `Open ones (${open.length})` : `Finished (${finished.length})`,
        () => {
          this.showFinished = !this.showFinished;
          this.page = 0;
          this.rebuild();
        },
      );
  }

  private buildDetail(id: string): void {
    const s = getState();
    const p = projects[id]!;
    this.icon(15, 15, this.landmarkIcon(id));
    this.label(28, 8, p.name, C.gold);
    this.label(192, 8, `Gold ${fmt(s.money)}`, C.gold, 1, 'right');
    const blurb = this.label(8, 26, p.blurb, C.cream, 1, 'left', 184);
    let y = 26 + blurb.textHeight + 4;
    const glory = !!p.repeat && projectLevel(s, id) >= p.repeat.perkLevels;
    const reward = this.label(
      8,
      y,
      glory
        ? GLORY_LINE
        : `${p.repeat && projectLevel(s, id) > 0 ? 'Next level' : 'When done'}: ${p.reward}${p.repeat && projectLevel(s, id) > 0 ? ` Now ${repeatNow(p, projectLevel(s, id))}.` : ''}`,
      C.green,
      1,
      'left',
      184,
    );
    y += reward.textHeight + 6;
    const g = this.scene.add.graphics();
    this.content.add(g);
    drawBar(g, 8, y, 184, 7, projectProgress(s, id), C.gold);
    y += 11;
    const price = priceOf(s, id);
    const left = price - goldGiven(s, id);
    this.label(
      8,
      y,
      `${p.repeat ? `Level ${projectLevel(s, id) + 1}  ` : ''}Gold ${fmt(goldGiven(s, id))}/${fmt(price)}`,
      left > 0 ? C.cream : C.green,
    );
    y += 12;
    for (const n of itemNeeds(s, id)) {
      this.label(8, y, needLabel(s, n), n.given >= n.need ? C.green : C.creamDim);
      y += 11;
    }
    // Give buttons sit low, next to the thumb: three gold steps, then goods.
    const by = this.panelH - 82;
    // Each button says what it really gives: near the end, "+10,000g" becomes the amount still needed.
    // Once the gold is all in, the three buttons give way to a plain line (no "+0g" buttons).
    if (left <= 0) this.label(100, by + 6, 'All the gold is in!', C.green, 1, 'center');
    else
      GIVE_STEPS.forEach((step, i) => {
        const amount = Math.min(step, left);
        const repeat = i > 0 && Math.min(GIVE_STEPS[i - 1]!, left) === amount;
        this.button(8 + i * 62, by, 58, 22, `+${fmt(amount)}g`, () =>
          this.after(donateGold(getState(), id, step)),
        ).setEnabled(amount > 0 && !repeat && s.money >= amount);
      });
    const needsItems = itemNeeds(s, id).some((n) => n.given < n.need);
    this.button(8, by + 26, 90, 22, 'Give goods', () =>
      this.after(donateItems(getState(), id)),
    ).setEnabled(needsItems && canGiveItems(s, id));
    this.button(102, by + 26, 90, 22, 'Back', () => {
      this.id = null;
      this.rebuild();
    });
  }

  private after(res: FundResult): void {
    if (res.ok) {
      audio.play(res.finished ? 'level' : 'buy');
      haptic('success');
      // A repeatable project stays open on its page for the next level (critique 7, F9).
      if (res.finished && !projects[this.id ?? '']?.repeat) this.id = null;
    } else {
      audio.play('error');
      haptic('error');
      if (res.reason === 'no_money') toast('Not enough gold.', 'warn');
    }
    this.rebuild();
  }
}
