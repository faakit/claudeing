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
    // A flow: each line starts under the last however far it wrapped (pt-BR's explanation takes three lines on
    // the SE and ran over the forecast at its fixed y).
    const mid = this.panelW / 2;
    let y = this.para(
      mid,
      30,
      t('sleep.itIs', { time: formatClock(s.time.minutes) }),
      C.cream,
      184,
      2,
      'center',
    );
    y = this.para(mid, y, t('sleep.explain'), C.creamDim, 184, 4, 'center');
    y = this.para(
      mid,
      y,
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
      184,
      6,
      'center',
    );
    y = Math.max(y, 94);
    this.button(8, y, this.panelW - 16, 24, t('sleep.sleep'), () => this.confirm(), {
      textColor: C.green,
      rim: C.green,
    });
    this.button(8, y + 28, this.panelW - 16, 22, t('sleep.notYet'), () => this.close());
    this.wantHeight = y + 28 + 22 + 10;
  }
}
