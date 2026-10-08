import Phaser from 'phaser';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  accepts,
  enterFestival,
  festivalToday,
  hasEntered,
  placeFor,
  rivalScores,
  scoreOf,
} from '../../systems/festivals';
import { displayName, iconKey, keyOf, refOf, type ItemRef } from '../../systems/itemRef';
import { C } from '../theme';
import { Modal } from '../widgets';
import { fmt } from './format';
import { rivalName } from '../../systems/rival';

const ROWS = 5;

/** The day's festival: pick one thing to enter; it is ranked against three rivals on the spot. */
export class FestivalPanel extends Modal {
  private page = 0;
  private result = '';

  constructor(scene: Phaser.Scene) {
    super(scene, 250);
  }

  protected build(): void {
    const s = getState();
    const today = festivalToday(s);
    this.panel();
    if (!today) {
      this.label(8, 8, 'No festival today', C.gold);
      this.label(
        8,
        24,
        'Festivals are held once a season. Check the calendar!',
        C.creamDim,
        1,
        'left',
        184,
      );
      this.closeButton();
      return;
    }
    const { def, id } = today;
    this.label(8, 8, def.name, C.gold);
    this.label(8, 20, def.blurb, C.creamDim);
    const rivals = rivalScores(s, def);
    // The best rival score is the rival farmer's.
    const sorted = [...rivals].sort((a, b) => b - a);
    this.label(
      8,
      32,
      `Rivals: ${rivalName()} ${fmt(sorted[0] ?? 0)}, ${sorted.slice(1).map(fmt).join(', ')}`,
      C.warn,
      1,
      'left',
      184,
    );
    if (this.result || hasEntered(s, id)) {
      this.label(
        8,
        60,
        this.result || 'You have already entered. Good luck next season!',
        C.green,
        1,
        'left',
        184,
      );
      this.closeButton();
      return;
    }
    const kinds = new Map<string, ItemRef>();
    for (const st of s.inventory.slots) if (st && accepts(def, st)) kinds.set(keyOf(st), refOf(st));
    const list = [...kinds.values()].sort((a, b) => scoreOf(b) - scoreOf(a));
    const pages = Math.max(1, Math.ceil(list.length / ROWS));
    this.page = Math.min(this.page, pages - 1);
    if (list.length === 0)
      this.label(
        8,
        60,
        'You have nothing to enter. Come back with the right goods next time.',
        C.creamDim,
        1,
        'left',
        184,
      );
    let y = 48;
    for (const ref of list.slice(this.page * ROWS, (this.page + 1) * ROWS)) {
      const score = scoreOf(ref);
      const place = placeFor(s, def, score);
      y = this.row(y, {
        icon: iconKey(ref),
        title: displayName(ref),
        sub: `Score ${fmt(score)}  ${place <= 3 ? `place ${place}` : 'no podium'}`,
        subColor: place === 1 ? C.gold : place <= 3 ? C.green : C.creamDim,
        buttons: [
          {
            label: 'Enter',
            width: 40,
            color: C.green,
            onClick: () => {
              const res = enterFestival(getState(), ref);
              if (!res.ok) return audio.play('error');
              audio.play(res.place <= 3 ? 'level' : 'coin');
              haptic('success');
              this.result =
                res.place <= 3
                  ? `Place ${res.place}! You won ${fmt(res.gold)}g.`
                  : `Thanks for joining! ${fmt(res.gold)}g for taking part.`;
              this.rebuild();
            },
          },
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
    this.closeButton();
  }

  override open(): void {
    this.result = '';
    this.page = 0;
    super.open();
  }
}
