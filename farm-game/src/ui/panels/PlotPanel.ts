import Phaser from 'phaser';
import { plots } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { toast } from '../../systems/events';
import { buyPlot, plotSize } from '../../systems/plots';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmtGold, t } from '../../i18n';

/** A land sign: what the plot is, what it costs, and a big Buy button. */
export class PlotPanel extends Modal {
  private id = '';

  constructor(scene: Phaser.Scene) {
    super(scene, 150);
  }

  openFor(id: string): void {
    if (!plots[id]) return;
    this.id = id;
    this.open();
  }

  protected build(): void {
    const s = getState();
    const p = plots[this.id]!;
    this.panel();
    this.label(8, 8, p.name, C.gold);
    this.label(8, 22, t('plot.size', { n: plotSize(this.id) }), C.cream);
    this.label(
      8,
      36,
      t('plot.more'),
      C.creamDim,
      1,
      'left',
      184,
    );
    this.label(
      8,
      66,
      t('plot.price', { price: fmtGold(p.price), have: fmtGold(s.money) }),
      s.money >= p.price ? C.green : C.red,
    );
    this.button(
      8,
      this.panelH - 62,
      this.panelW - 16,
      24,
      t('plot.buy', { gold: fmtGold(p.price) }),
      () => this.buy(),
      {
        textColor: s.money >= p.price ? C.green : C.creamDim,
        rim: s.money >= p.price ? C.green : C.creamDim,
      },
    ).setEnabled(s.money >= p.price);
    this.closeButton(t('common.notNow'));
  }

  private buy(): void {
    const res = buyPlot(getState(), this.id);
    if (res === 'ok') {
      audio.play('buy');
      haptic('success');
      toast(t('plot.yours', { name: plots[this.id]!.name }), 'good');
      this.close();
    } else {
      audio.play('error');
      toast(res === 'no_money' ? t('common.notEnoughGold') : t('common.cantBuy'), 'warn');
    }
  }
}
