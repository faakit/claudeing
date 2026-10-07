import Phaser from 'phaser';
import { getState } from '../../state/store';
import { formatClock } from '../../systems/time';
import { C } from '../theme';
import { Modal } from '../widgets';

// ============================================================ Sleep confirm

export class SleepPanel extends Modal {
  constructor(
    scene: Phaser.Scene,
    private readonly onSleep: () => void,
  ) {
    super(scene, 250, 104);
  }

  override confirm(): void {
    this.close();
    this.onSleep();
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
