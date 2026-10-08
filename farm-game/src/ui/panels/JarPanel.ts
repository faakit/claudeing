import Phaser from 'phaser';
import { placeables } from '../../data';
import { audio } from '../../platform/audio';
import { getState } from '../../state/store';
import { gameEvents } from '../../systems/events';
import { addStat } from '../../systems/goals';
import { displayName, iconKey, keyOf, refOf, type ItemRef } from '../../systems/itemRef';
import { canPickUp, findPlaced, removePlaced } from '../../systems/placeables';
import { idleMachines, jarDays, loadAll, loadJar, preserveOf } from '../../systems/preserves';
import { addItem, countStack, roomFor } from '../../systems/inventory';
import { toast } from '../../systems/events';
import { C } from '../theme';
import { Modal } from '../widgets';

const ROWS = 6;

/** Pick what to put in a jar: every fruit or vegetable you carry, with what it will become. */
export class JarPanel extends Modal {
  private id = -1;
  private page = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  openFor(id: number): void {
    this.id = id;
    this.page = 0;
    this.open();
  }

  protected build(): void {
    const s = getState();
    this.panel();
    const found = findPlaced(s, this.id);
    this.label(8, 8, found ? (placeables[found.obj.type]?.name ?? 'Machine') : 'Machine', C.gold);
    this.label(
      8,
      20,
      found ? `Ready ${jarDays(found.obj)} mornings after loading.` : 'Gone?',
      C.creamDim,
    );
    const kinds = new Map<string, ItemRef>();
    for (const st of s.inventory.slots)
      if (st && preserveOf(st, found?.obj.type)) kinds.set(keyOf(st), refOf(st));
    const list = [...kinds.values()];
    const pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.page = Math.min(this.page, pages - 1);
    if (list.length === 0)
      this.label(
        8,
        50,
        'Bring fruit for jam, or vegetables for pickles.',
        C.creamDim,
        1,
        'left',
        184,
      );
    let y = 34;
    // With several empty machines of this kind, "All" fills them in one tap.
    const idle = found ? idleMachines(s, found.map, found.obj.type).length : 0;
    for (const ref of list.slice(this.page * ROWS, (this.page + 1) * ROWS)) {
      const out = preserveOf(ref, found?.obj.type) as ItemRef;
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        sub: `Makes ${displayName(out)} (have ${countStack(s, ref)})`,
        buttons: [
          {
            label: 'Load',
            width: 38,
            color: C.green,
            onClick: () => {
              const obj = findPlaced(getState(), this.id)?.obj;
              if (obj && loadJar(getState(), obj, ref) === 'ok') {
                addStat(getState(), 'jarsLoaded');
                gameEvents.emit('placedChanged', { map: found?.map ?? 'farm' });
                audio.play('plant');
                this.close();
              } else audio.play('error');
            },
          },
          ...(idle > 1 && countStack(s, ref) > 1
            ? [
                {
                  label: 'All',
                  width: 26,
                  color: C.gold,
                  onClick: () => {
                    const st = getState();
                    if (!found) return;
                    const n = loadAll(st, found.map, found.obj.type, ref);
                    if (n > 0) {
                      addStat(st, 'jarsLoaded', n);
                      gameEvents.emit('placedChanged', { map: found.map });
                      audio.play('plant');
                      toast(`Loaded ${n} machines.`, 'good');
                      this.close();
                    } else audio.play('error');
                  },
                },
              ]
            : []),
        ],
      });
    }
    if (pages > 1) {
      const by = this.panelH - 52;
      this.button(8, by, 40, 20, '<', () => {
        this.page = (this.page + pages - 1) % pages;
        this.rebuild();
      });
      this.button(152, by, 40, 20, '>', () => {
        this.page = (this.page + 1) % pages;
        this.rebuild();
      });
    }
    if (found && canPickUp(found.obj))
      this.button(60, this.panelH - 52, 80, 20, 'Pick up', () => {
        const st = getState();
        if (roomFor(st, found.obj.type, 1) < 1) return void toast('Inventory full!', 'warn');
        removePlaced(st, found.map, found.obj.id);
        addItem(st, found.obj.type, 1);
        gameEvents.emit('placedChanged', { map: found.map });
        this.close();
      });
    this.closeButton();
  }
}
