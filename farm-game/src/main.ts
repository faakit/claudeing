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

// Debug/test hook: lets automated checks drive and inspect the running game.
(window as unknown as { __farm: unknown }).__farm = { game, getState, gameEvents, inputHub };
