import Phaser from 'phaser';
import { plots } from '../../data';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { toast } from '../../systems/events';
import { buyPlot, plotSize } from '../../systems/plots';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';

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
    this.label(8, 22, `${plotSize(this.id)} tiles of workable land.`, C.cream);
    this.label(
      8,
      36,
      'More land means more crops, but you need the energy to work it.',
      C.creamDim,
      1,
      'left',
      184,
    );
    this.label(
      8,
      66,
      `Price ${fmt(p.price)}g   You have ${fmt(s.money)}g`,
      s.money >= p.price ? C.green : C.red,
    );
    this.button(
      8,
      this.panelH - 62,
      this.panelW - 16,
      24,
      `Buy for ${fmt(p.price)}g`,
      () => this.buy(),
      {
        textColor: s.money >= p.price ? C.green : C.creamDim,
        rim: s.money >= p.price ? C.green : C.creamDim,
      },
    ).setEnabled(s.money >= p.price);
    this.closeButton('Not now');
  }

  private buy(): void {
    const res = buyPlot(getState(), this.id);
    if (res === 'ok') {
      audio.play('buy');
      haptic('success');
      toast(`${plots[this.id]!.name} is yours!`, 'good');
      this.close();
    } else {
      audio.play('error');
      toast(res === 'no_money' ? 'Not enough gold.' : "Can't buy that.", 'warn');
    }
  }
}
