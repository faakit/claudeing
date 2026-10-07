import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { FarmScene } from './scenes/FarmScene';
import { HouseScene } from './scenes/HouseScene';
import { TitleScene } from './scenes/TitleScene';
import { TownScene } from './scenes/TownScene';
import { UIScene } from './scenes/UIScene';
import { getState } from './state/store';
import { audio } from './platform/audio';
import { gameEvents } from './systems/events';
import { inputHub } from './input/InputHub';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1c2c',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, PreloadScene, TitleScene, FarmScene, HouseScene, TownScene, UIScene],
});

// Debug/test hook for automated checks and tinkering. Enabled in dev builds, or with ?debug in the URL.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __farm: unknown }).__farm = {
    game,
    getState,
    gameEvents,
    inputHub,
    audio,
  };
}
