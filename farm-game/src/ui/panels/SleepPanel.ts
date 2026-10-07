import Phaser from 'phaser';
import { getState } from '../../state/store';
import { formatClock } from '../../systems/time';
import { C } from '../theme';
import { Modal } from '../widgets';

export class SleepPanel extends Modal {
  constructor(
    scene: Phaser.Scene,
    private readonly onSleep: () => void,
  ) {
    super(scene, 138);
  }

  override confirm(): void {
    this.close();
    this.onSleep();
  }

  protected build(): void {
    const s = getState();
    this.panel();
    this.label(this.panelW / 2, 8, 'Go to bed?', C.gold, 2, 'center');
    this.label(this.panelW / 2, 28, `It is ${formatClock(s.time.minutes)}.`, C.cream, 1, 'center');
    this.label(
      this.panelW / 2,
      41,
      'Crops grow, the bin is sold, and you wake up fully rested.',
      C.creamDim,
      1,
      'center',
      184,
    );
    this.button(8, 78, this.panelW - 16, 24, 'Sleep', () => this.confirm(), {
      textColor: C.green,
      rim: C.green,
    });
    this.button(8, 106, this.panelW - 16, 22, 'Not yet', () => this.close());
  }
}
