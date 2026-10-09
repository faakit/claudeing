import Phaser from 'phaser';
import { CROPS_TEXTURE, cropFrame } from '../art/gameArt';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { crops, mapsData } from '../data';
import { saveStore } from '../game/persistence';
import { audio } from '../platform/audio';
import { hideSplash } from '../platform/native';
import { setHapticsEnabled } from '../platform/haptics';
import { createInitialState, type GameState } from '../state/GameState';
import { runtime } from '../state/runtime';
import { setState } from '../state/store';
import { hasNewerSave, loadGame } from '../systems/save';
import { seasonLabel } from '../systems/time';
import { Label } from '../ui/font';
import { CH as C } from '../ui/theme';
import { Button } from '../ui/widgets';

/** Title screen: animated dusk farm backdrop, Continue / New Game. */
export class TitleScene extends Phaser.Scene {
  private loaded: GameState | null = null;
  private confirmNew = false;
  private newerSave = false;
  private buttons: Button[] = [];
  private note!: Label;
  /** Enter on the title runs the main button (Continue if there is a save, else New Game). */
  private primary: (() => void) | null = null;

  constructor() {
    super('Title');
  }

  create(): void {
    runtime.inGame = false;
    hideSplash(); // first real screen is up: drop the native splash
    this.confirmNew = false;
    this.buttons = [];
    this.cameras.main.setBackgroundColor('#1e2848');
    this.drawBackdrop();

    const title = new Label(this, GAME_WIDTH / 2, 52, 'TINY', {
      scale: 6,
      align: 'center',
      color: C.gold,
    });
    const title2 = new Label(this, GAME_WIDTH / 2, 98, 'ACRE', {
      scale: 6,
      align: 'center',
      color: C.gold,
    });
    for (const t of [title, title2]) {
      this.tweens.add({
        targets: t,
        y: t.y + 3,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    new Label(this, GAME_WIDTH / 2, 150, 'a cozy little farming game', {
      align: 'center',
      color: C.cream,
    });
    new Label(this, GAME_WIDTH - 4, GAME_HEIGHT - 10, 'prototype v0.2', {
      align: 'right',
      color: C.creamDim,
    });
    this.note = new Label(this, GAME_WIDTH / 2, 176, '', {
      align: 'center',
      color: C.creamDim,
      maxWidth: 180,
    });

    void loadGame(saveStore).then(async (res) => {
      this.loaded = res?.state ?? null;
      if (!this.loaded && (await hasNewerSave(saveStore))) {
        // Never silently overwrite progress we cannot read: say so and make New Game ask first.
        this.newerSave = true;
        this.note.setText('Your save is from a newer version. Update the game to continue it.');
      }
      if (res?.fromBackup) this.note.setText('Recovered from your backup save.');
      this.buildButtons();
    });
    this.input.once('pointerdown', () => audio.unlock());
    this.input.keyboard?.once('keydown', () => audio.unlock());
    this.input.keyboard?.on('keydown-ENTER', () => this.primary?.());
  }

  private buildButtons(): void {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];
    this.primary = this.loaded
      ? () => this.start(this.loaded as GameState)
      : this.newerSave
        ? null
        : () => this.start(createInitialState());
    let y = 200;
    const w = 150;
    const x = (GAME_WIDTH - w) / 2;
    if (this.loaded) {
      const t = this.loaded.time;
      this.buttons.push(
        new Button(this, x, y, w, 30, 'Continue', () => this.start(this.loaded as GameState), {
          textColor: C.green,
          rim: C.green,
        }),
      );
      new Label(
        this,
        GAME_WIDTH / 2,
        y + 36,
        `${seasonLabel(t.season)} ${t.day}, year ${t.year}  ${this.loaded.money}g`,
        { align: 'center', color: C.creamDim },
      );
      y += 62;
    }
    this.buttons.push(
      new Button(
        this,
        x,
        y,
        w,
        30,
        this.confirmNew ? 'Erase save? Tap again' : 'New Game',
        () => {
          if ((this.loaded || this.newerSave) && !this.confirmNew) {
            this.confirmNew = true;
            this.buildButtons();
            return;
          }
          this.start(createInitialState());
        },
        { textColor: this.confirmNew ? C.warn : C.cream },
      ),
    );
  }

  private start(state: GameState): void {
    audio.unlock();
    setState(state);
    audio.setVolumes(state.settings.music, state.settings.sfx, state.settings.muted);
    setHapticsEnabled(state.settings.vibrate);
    audio.startMusic();
    runtime.inGame = true;
    runtime.busy = false;
    runtime.modals = 0;
    const scene = mapsData.maps[state.player.map]?.scene ?? 'Farm';
    this.scene.start(scene);
    this.scene.launch('UI');
  }

  /**
   * Dusk over the valley, on the palette: sky bands from night navy to orange with dithered seams, a low sun,
   * plum hills, a field of crops at 1x (no scaling or rotation, so pixels stay square) and the valley's rose-pink
   * wildflowers along the front. The crops sway by stepping 1 px, never by rotating.
   */
  private drawBackdrop(): void {
    const g = this.add.graphics();
    const bands = [0x1e2848, 0x2e4a7a, 0x8c5ca4, 0xe07a8a, 0xe48c24];
    const bandH = 68;
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * bandH, GAME_WIDTH, bandH));
    // dithered seam between two bands: a checker row of each colour
    for (let i = 1; i < bands.length; i++)
      for (let x = 0; x < GAME_WIDTH; x++) {
        g.fillStyle(x % 2 ? bands[i - 1]! : bands[i]!, 1).fillRect(x, i * bandH, 1, 1);
        g.fillStyle(x % 2 ? bands[i]! : bands[i - 1]!, 1).fillRect(x, i * bandH - 1, 1, 1);
      }
    g.fillStyle(0xf4cc3c, 1).fillCircle(96, 292, 22); // low sun, setting in the notch between the hills
    g.fillStyle(0xfff0a0, 1).fillCircle(92, 288, 9);
    g.fillStyle(0x4a2a40, 1);
    g.fillTriangle(-30, 340, 50, 262, 130, 340).fillTriangle(60, 340, 140, 252, 230, 340);
    g.fillStyle(0x1f4a40, 1).fillRect(0, 336, GAME_WIDTH, 64);
    g.fillStyle(0x2e6a3e, 1).fillRect(0, 336, GAME_WIDTH, 2);
    // soil with crops in every growth stage
    g.fillStyle(0x4c2c1c, 1).fillRect(0, 366, GAME_WIDTH, 34);
    g.fillStyle(0x7c442c, 1).fillRect(0, 366, GAME_WIDTH, 2);
    const ids = Object.keys(crops);
    for (let i = 0; i < 12; i++) {
      const id = ids[i % ids.length]!;
      const total = crops[id]!.stageDays.length;
      const stage = (i * 3) % (total + 1);
      const x0 = 10 + i * 16;
      const img = this.add.image(x0, 390, CROPS_TEXTURE, cropFrame(id, stage)).setOrigin(0.5, 1);
      this.time.addEvent({
        delay: 700 + (i % 5) * 130,
        loop: true,
        callback: () => img.setX(img.x === x0 ? x0 + 1 : x0),
      });
    }
    // the valley's rose-pink wildflowers along the field's edge
    for (let i = 0; i < 16; i++) {
      const x = 4 + i * 12 + ((i * 7) % 5);
      const y = 350 + ((i * 5) % 9);
      g.fillStyle(0x2e6a3e, 1).fillRect(x, y + 1, 1, 3);
      g.fillStyle(0xe07a8a, 1)
        .fillRect(x - 1, y, 3, 1)
        .fillRect(x, y - 1, 1, 3);
      g.fillStyle(0xf4cc3c, 1).fillRect(x, y, 1, 1);
    }
    // fireflies, blinking in steps
    for (let i = 0; i < 14; i++) {
      const f = this.add
        .rectangle(
          Math.round(Math.random() * GAME_WIDTH),
          Math.round(260 + Math.random() * 90),
          1,
          1,
          0xfff0a0,
        )
        .setAlpha(0);
      this.time.addEvent({
        delay: 300 + Math.random() * 500,
        loop: true,
        callback: () => f.setAlpha([0, 0.5, 1, 0.5][Math.floor(Math.random() * 4)]!),
      });
    }
  }
}
