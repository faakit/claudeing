import Phaser from 'phaser';
import { npcs } from '../data';
import { WIPE_OPEN_MS } from '../fx/feel';
import { TowController } from '../game/TowController';
import { weirCourse } from '../game/weirTow';
import { t } from '../i18n';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { gameEvents } from '../systems/events';
import { houseIds, takeHomecoming, takeHouseLit, villagerOf } from '../systems/houses';
import { riverBack, riverMomentDue, valleyStage } from '../systems/valley';
import { glowFor } from '../ui/daylight';
import { WorldScene } from './WorldScene';

/** The mill wheel's frames (art lane: 32 x 32 over its tile at 21,30) and how long each shows. */
const WHEEL = { tx: 21, ty: 30, frames: 4, ms: 180 } as const;
/** Night glow strength from which a lit window counts as seen (audio's `houseLit`). */
const LIT_AT = 0.3;

/**
 * The town. Since M7 its river carries drift timber once the weir is open (the towing controller on the town river's
 * course, src/game/weirTow.ts), the Marls' house takes timber, and the morning they come home the mill wheel turns.
 */
export class TownScene extends WorldScene {
  constructor() {
    super('Town', 'town');
  }

  /** Towing on the river, while the river is back. */
  tow: TowController | null = null;
  private wheel: Phaser.GameObjects.Image | null = null;
  private wheelMs = 0;

  create(): void {
    super.create();
    const state = getState();
    if (riverBack(state)) {
      const course = weirCourse();
      if (course) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const scene = this;
        this.tow = new TowController(
          {
            scene: this,
            fx: this.fx,
            walkTo: (tile, face, done) => this.walkTo(tile, face, done),
            stopWalk: () => this.stopWalk(),
            get walking() {
              return scene.walking;
            },
            get walkGoal() {
              return scene.walkGoal;
            },
            walkable: (tx, ty) => this.walkable(tx, ty),
            get farmer() {
              return scene.farmerSprite;
            },
            get actionInFront() {
              return scene.actionInFront;
            },
          },
          course,
        );
        this.tapHook = (wx, wy) => this.tow?.onTap(wx, wy) ?? false;
        this.actionHook = () => this.tow?.onAction() ?? false;
      }
    }
    // the Marls home: the mill wheel turns (town stage `marls`)
    this.wheelMs = 0;
    if (valleyStage(state, 'town').variant === 'marls') this.wheel = this.makeWheel();
    // a family home: its banner, the first time in town on or after the morning they came (not on the river's)
    if (!riverMomentDue(state))
      for (const id of houseIds())
        if (takeHomecoming(state, id)) {
          const who = villagerOf(id);
          const name = who ? (npcs[who]?.name ?? who) : id;
          this.time.delayedCall(WIPE_OPEN_MS, () => {
            if (!this.sys.isActive()) return;
            this.valleyMoment(
              `${t('house.homeTitle')}\n${t('house.homeLine', { name })}`,
              'homecoming',
            );
          });
          break;
        }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tow?.destroy();
      this.tow = null;
      this.tapHook = null;
      this.actionHook = null;
      this.wheel?.destroy();
      this.wheel = null;
    });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!runtime.blocked) this.tow?.update(delta);
    // Calm (reduced motion): the wheel stands still on its first frame
    if (this.wheel && !getState().settings.reduceMotion) {
      this.wheelMs += delta;
      const f = Math.floor(this.wheelMs / WHEEL.ms) % WHEEL.frames;
      const key = `obj_millwheel_${f}`;
      if (this.wheel.texture.key !== key) this.wheel.setTexture(key);
    }
    // the first evening a rebuilt house's window is lit (once a house)
    const state = getState();
    if (glowFor('town', state.time.minutes, true) >= LIT_AT)
      for (const id of houseIds())
        if (takeHouseLit(state, id)) gameEvents.emit('houseLit', { house: id });
  }

  /** The mill wheel, turning: the art lane's frames, or placeholder spokes over the wheel's tile until they land. */
  private makeWheel(): Phaser.GameObjects.Image {
    for (let f = 0; f < WHEEL.frames; f++) {
      const key = `obj_millwheel_${f}`;
      if (this.textures.exists(key)) continue;
      const tex = this.textures.createCanvas(key, 32, 32);
      if (!tex) continue;
      const c = tex.getContext();
      c.fillStyle = '#2a1a24';
      // four spokes from the hub, turned an eighth of a quarter more each frame
      for (let s = 0; s < 4; s++) {
        const a = (s * Math.PI) / 2 + (f * Math.PI) / 8;
        for (let r = 3; r < 14; r++)
          c.fillRect(Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), 1, 1);
      }
      tex.refresh();
    }
    return this.add
      .image(WHEEL.tx * 16, WHEEL.ty * 16, 'obj_millwheel_0')
      .setOrigin(0, 0)
      .setDepth(0.07);
  }
}
