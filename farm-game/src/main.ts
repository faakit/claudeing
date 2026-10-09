import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { FarmScene } from './scenes/FarmScene';
import { HouseScene } from './scenes/HouseScene';
import { TitleScene } from './scenes/TitleScene';
import { TownScene } from './scenes/TownScene';
import { MineScene } from './scenes/MineScene';
import { WoodsScene } from './scenes/WoodsScene';
import { UIScene } from './scenes/UIScene';
import { getState } from './state/store';
import { audio } from './platform/audio';
import { wireAudio } from './game/audioWiring';
import { wireLifecycle } from './game/lifecycleWiring';
import { refreshOnRotate, suppressBrowserGestures } from './platform/display';
import { installWebLifecycle, lifecycle } from './platform/lifecycle';
import { initNative, isNative } from './platform/native';
import { gameEvents } from './systems/events';
import { inputHub } from './input/InputHub';
import { setHapticsEnabled } from './platform/haptics';
import { controlsLog } from './input/controlsLog';

suppressBrowserGestures();
audio.installAutoUnlock();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#2a1a24',
  // All sound goes through platform/audio.ts and its own AudioContext; Phaser must not make a second one.
  audio: { noAudio: true },
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    FarmScene,
    HouseScene,
    TownScene,
    WoodsScene,
    MineScene,
    UIScene,
  ],
});

// Offline play + installability. Registration can fail in sandboxed frames or insecure origins;
// the game works the same without it.
// Not in the native apps: their bundle is already local, and a cache-first worker could keep
// serving an old game after an app update.
if (import.meta.env.PROD && !isNative() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

refreshOnRotate(() => game.scale.refresh());
wireLifecycle(game);
wireAudio(game);
installWebLifecycle(lifecycle, document, window);
initNative();

// Debug/test hook for automated checks and tinkering. Enabled in dev builds, or with ?debug in the URL.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __farm: unknown }).__farm = {
    game,
    getState,
    gameEvents,
    inputHub,
    audio,
    haptics: { setHapticsEnabled },
    controls: controlsLog,
  };
}
