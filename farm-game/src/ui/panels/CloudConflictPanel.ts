/**
 * Two saves of one farm disagree (game/cloudSync.ts): the player picks one, in one sheet in the lower half of the
 * screen. Each save is a card with its day, gold and play time, its full-width button right under it; the one
 * further along says so. "Decide later" keeps both (uploads wait) and Options offers the choice again.
 */
import Phaser from 'phaser';
import type { CloudConflict } from '../../platform/cloudSave';
import { compareSaves, type SaveSummary } from '../../systems/cloudRules';
import { t } from '../../i18n';
import { C } from '../theme';
import { drawPanel, Modal } from '../widgets';
import { playedLine, saveLine } from './cloudText';

const W = 184;
const CARD_H = 66;
const CARD_Y = 46;
const SHEET_H = 220;

export class CloudConflictPanel extends Modal {
  private conflict: CloudConflict | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly onChoose: (choice: 'local' | 'cloud' | 'later') => void,
    private readonly now: () => number = Date.now,
  ) {
    super(scene, SHEET_H);
    this.dismissOnDim = false; // a choice, not a notice: the dim never decides
  }

  show(c: CloudConflict): void {
    this.conflict = c;
    if (this.isOpen) this.rebuild();
    else this.open();
  }

  protected build(): void {
    const c = this.conflict;
    this.panel();
    if (!c) return;
    const x = 8;
    this.label(x, 9, t('cloud.conflictTitle'), C.gold);
    // one or two lines (tests/cloud-ui.test.ts), above the first card
    this.label(
      x,
      20,
      t(c.verdict === 'cloud' ? 'cloud.conflictAhead' : 'cloud.conflictDiverged'),
      C.creamDim,
      1,
      'left',
      W,
    );
    const ahead = compareSaves(c.local, c.cloud);
    this.card(CARD_Y, t('cloud.phone'), c.local, ahead === 'local', t('cloud.keepPhone'), 'local');
    this.card(
      CARD_Y + CARD_H + 6,
      t('cloud.cloud'),
      c.cloud,
      ahead === 'cloud',
      t('cloud.useCloud'),
      'cloud',
    );
    this.button(x, SHEET_H - 30, W, 22, t('cloud.later'), () => this.choose('later'), {
      textColor: C.creamDim,
    });
  }

  private card(
    y: number,
    name: string,
    s: SaveSummary | null,
    ahead: boolean,
    action: string,
    choice: 'local' | 'cloud',
  ): void {
    const x = 8;
    const g = this.scene.add.graphics();
    drawPanel(g, x, y, W, CARD_H - 4, C.slot, ahead ? C.green : C.rim);
    this.content.add(g);
    this.label(x + 6, y + 5, name, C.cream);
    if (ahead) this.label(x + W - 6, y + 5, t('cloud.ahead'), C.green, 1, 'right');
    if (s) {
      this.label(x + 6, y + 16, saveLine(s), C.cream);
      this.label(x + 6, y + 27, playedLine(s, this.now()), C.creamDim);
    } else this.label(x + 6, y + 16, t('cloud.noSave'), C.creamDim);
    this.button(x + 4, y + 38, W - 8, 22, action, () => this.choose(choice), {
      textColor: choice === 'cloud' ? C.gold : C.cream,
    }).setEnabled(s !== null);
  }

  private choose(choice: 'local' | 'cloud' | 'later'): void {
    this.close();
    this.onChoose(choice);
  }
}
