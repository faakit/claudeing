import Phaser from 'phaser';
import { getState } from '../../state/store';
import { formatClock } from '../../systems/time';
import { forecastText } from './SummaryPanels';
import { C } from '../theme';
import { Modal } from '../widgets';

export class SleepPanel extends Modal {
  constructor(
    scene: Phaser.Scene,
    private readonly onSleep: () => void,
  ) {
    super(scene, 154);
  }

  override confirm(): void {
    this.close();
    this.onSleep();
  }

  protected build(): void {
    const s = getState();
    this.panel();
    this.label(this.panelW / 2, 6, 'Go to bed?', C.gold, 2, 'center');
    this.label(this.panelW / 2, 30, `It is ${formatClock(s.time.minutes)}.`, C.cream, 1, 'center');
    this.label(
      this.panelW / 2,
      42,
      'Crops grow, the bin is sold, and you wake up fully rested.',
      C.creamDim,
      1,
      'center',
      184,
    );
    this.label(
      this.panelW / 2,
      66,
      `Tomorrow: ${forecastText(s.forecast)}${s.forecast === 'storm' ? '. Pick ripe fruit first!' : s.forecast === 'rain' ? '. No watering needed.' : ''}`,
      s.forecast === 'sunny' ? C.creamDim : C.blue,
      1,
      'center',
      184,
    );
    this.button(8, 94, this.panelW - 16, 24, 'Sleep', () => this.confirm(), {
      textColor: C.green,
      rim: C.green,
    });
    this.button(8, 122, this.panelW - 16, 22, 'Not yet', () => this.close());
  }
}
