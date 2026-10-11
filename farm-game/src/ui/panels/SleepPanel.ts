import Phaser from 'phaser';
import { getState } from '../../state/store';
import { formatClock } from '../../systems/time';
import { forecastText } from './SummaryPanels';
import { C } from '../theme';
import { Modal } from '../widgets';
import { t } from '../../i18n';

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
    this.label(this.panelW / 2, 6, t('sleep.title'), C.gold, 2, 'center');
    this.label(
      this.panelW / 2,
      30,
      t('sleep.itIs', { time: formatClock(s.time.minutes) }),
      C.cream,
      1,
      'center',
    );
    this.label(
      this.panelW / 2,
      42,
      t('sleep.explain'),
      C.creamDim,
      1,
      'center',
      184,
    );
    this.label(
      this.panelW / 2,
      66,
      t('sleep.tomorrow', {
        forecast: forecastText(s.forecast),
        extra:
          s.forecast === 'storm'
            ? t('sleep.stormExtra')
            : s.forecast === 'rain'
              ? t('sleep.rainExtra')
              : '',
      }),
      s.forecast === 'sunny' ? C.creamDim : C.blue,
      1,
      'center',
      184,
    );
    this.button(8, 94, this.panelW - 16, 24, t('sleep.sleep'), () => this.confirm(), {
      textColor: C.green,
      rim: C.green,
    });
    this.button(8, 122, this.panelW - 16, 22, t('sleep.notYet'), () => this.close());
  }
}
