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
import { loadGame } from '../systems/save';
import { seasonLabel } from '../systems/time';
import { Label } from '../ui/font';
import { C } from '../ui/theme';
import { Button } from '../ui/widgets';

/** Title screen: animated dusk farm backdrop, Continue / New Game. */
export class TitleScene extends Phaser.Scene {
  private loaded: GameState | null = null;
  private confirmNew = false;
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
    this.cameras.main.setBackgroundColor('#1b1530');
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

    void loadGame(saveStore).then((res) => {
      this.loaded = res?.state ?? null;
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
          if (this.loaded && !this.confirmNew) {
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

  private drawBackdrop(): void {
    const g = this.add.graphics();
    const bands = [0x2a1f4a, 0x3d2a5c, 0x5a3a6a, 0x8a4a6a, 0xc0645a, 0xe08a5a];
    bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 46, GAME_WIDTH, 50));
    g.fillStyle(0xf4d35e, 1).fillCircle(150, 300, 26); // low sun
    g.fillStyle(0xffe9a0, 0.5).fillCircle(150, 300, 33);
    g.fillStyle(0x3b2a52, 1);
    g.fillTriangle(-30, 340, 50, 262, 130, 340).fillTriangle(60, 340, 140, 252, 230, 340);
    g.fillStyle(0x2c4a3a, 1).fillRect(0, 336, GAME_WIDTH, 64);
    g.fillStyle(0x3a6a44, 1).fillRect(0, 336, GAME_WIDTH, 3);
    // soil with crops in every growth stage, swaying gently
    g.fillStyle(0x5e4025, 1).fillRect(0, 366, GAME_WIDTH, 34);
    g.fillStyle(0x7a5530, 1).fillRect(0, 366, GAME_WIDTH, 2);
    const ids = Object.keys(crops);
    for (let i = 0; i < 12; i++) {
      const id = ids[i % ids.length]!;
      const total = crops[id]!.stageDays.length;
      const stage = (i * 3) % (total + 1);
      const img = this.add
        .image(10 + i * 16, 390, CROPS_TEXTURE, cropFrame(id, stage))
        .setOrigin(0.5, 1)
        .setScale(1.3);
      this.tweens.add({
        targets: img,
        angle: { from: -3, to: 3 },
        duration: 1400 + (i % 5) * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 60,
      });
    }
    // fireflies
    for (let i = 0; i < 14; i++) {
      const f = this.add
        .rectangle(Math.random() * GAME_WIDTH, 260 + Math.random() * 100, 2, 2, 0xf4ead2)
        .setAlpha(0);
      this.tweens.add({
        targets: f,
        alpha: { from: 0, to: 0.9 },
        x: f.x + (Math.random() - 0.5) * 40,
        y: f.y - 12 - Math.random() * 20,
        duration: 1800 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
