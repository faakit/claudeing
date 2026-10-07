import Phaser from 'phaser';
import { PLAYER_TEXTURE, playerIdleFrame, SHADOW_TEXTURE } from '../art/placeholders';
import { getState } from '../state/store';
import { Label } from '../ui/font';
import { C } from '../ui/theme';
import { WorldScene } from './WorldScene';

const NPC_TILE = { tx: 13, ty: 8 };

export class TownScene extends WorldScene {
  private greeted = false;
  private npc!: Phaser.GameObjects.Sprite;

  constructor() {
    super('Town', 'town');
  }

  create(): void {
    super.create();
    this.greeted = false;
    const x = NPC_TILE.tx * 16 + 8;
    const y = NPC_TILE.ty * 16 + 14;
    this.add.image(x, y - 2, SHADOW_TEXTURE).setDepth(9 + y);
    // Shopkeeper: placeholder reuses the player sprite with a tint until real NPC art (M7).
    this.npc = this.add
      .sprite(x, y, PLAYER_TEXTURE, playerIdleFrame('down'))
      .setOrigin(0.5, 1)
      .setTint(0xffb08a)
      .setDepth(10 + y);
    this.tweens.add({
      targets: this.npc,
      scaleY: 1.03,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    const p = getState().player;
    const near = Math.hypot(p.x - this.npc.x, p.y - this.npc.y) < 44;
    if (near && !this.greeted) {
      this.greeted = true;
      const frame = p.x < this.npc.x ? 'left' : p.x > this.npc.x ? 'right' : 'down';
      this.npc.setFrame(playerIdleFrame(frame));
      const hello = new Label(this, this.npc.x, this.npc.y - 40, 'Welcome!', {
        align: 'center',
        color: C.gold,
      }).setDepth(9500);
      this.tweens.add({
        targets: hello,
        y: hello.y - 8,
        alpha: 0,
        delay: 1100,
        duration: 600,
        onComplete: () => hello.destroy(),
      });
    } else if (!near && this.greeted && Math.hypot(p.x - this.npc.x, p.y - this.npc.y) > 90) {
      this.greeted = false;
    }
  }
}
