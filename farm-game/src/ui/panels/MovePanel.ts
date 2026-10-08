import Phaser from 'phaser';
import { placeables } from '../../data';
import { audio } from '../../platform/audio';
import { getState } from '../../state/store';
import { gameEvents, toast } from '../../systems/events';
import { findPlaced, occupantsOf, pickUpPlaced } from '../../systems/placeables';
import { C } from '../theme';
import { Modal } from '../widgets';
import { moveText } from './moveText';

/**
 * Moving a building that has animals or stock: a sheet with a deliberate Move button, so a chore tap
 * never lifts a coop full of hens (critique 5, F3). Everything inside comes along with it.
 */
export class MovePanel extends Modal {
  private id = -1;

  constructor(scene: Phaser.Scene) {
    super(scene, 130);
  }

  openFor(id: number): void {
    this.id = id;
    this.open();
  }

  protected build(): void {
    const found = findPlaced(getState(), this.id);
    this.panel();
    const name = found ? (placeables[found.obj.type]?.name ?? 'Building') : 'Building';
    this.label(8, 8, `Move the ${name}?`, C.gold);
    this.label(
      8,
      22,
      found ? moveText(occupantsOf(found.obj)) : 'It is gone.',
      C.creamDim,
      1,
      'left',
      184,
    );
    this.button(8, this.panelH - 56, this.panelW - 16, 24, 'Move it', () => this.move(), {
      textColor: C.green,
      rim: C.green,
    }).setEnabled(!!found);
    this.closeButton('Leave it');
  }

  /** The Move button only: Enter (the sheet's confirm key) must not do the risky thing (critique 6, F8). */
  private move(): void {
    const st = getState();
    const found = findPlaced(st, this.id);
    if (!found) return this.close();
    const res = pickUpPlaced(st, found.map, found.obj);
    if (res === 'full') {
      audio.play('error');
      return void toast('Inventory full!', 'warn');
    }
    if (res === 'busy') {
      audio.play('error');
      return void toast("It's busy. Wait until it's done.", 'warn');
    }
    gameEvents.emit('placedChanged', { map: found.map });
    toast('In your bag. Place it anywhere on your land.', 'good');
    this.close();
  }
}
