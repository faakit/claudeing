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
import { WendheadScene } from './scenes/WendheadScene';
import { UIScene } from './scenes/UIScene';
import { runtime } from './state/runtime';
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
import { displayFit } from './platform/displayFit';
import { chooseLanguage, initLanguage } from './game/language';
import { getLocale } from './i18n';
import { saveNow } from './game/persistence';
import { wireCloudSave } from './game/cloudWiring';

suppressBrowserGestures();
audio.installAutoUnlock();
// The language first (?lang=, then the stored choice, then the device), before anything draws text.
void initLanguage();

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
  // Sized by fitCanvas below: whole device pixels per game pixel where that costs <= 10% (platform/displayFit.ts).
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER, zoom: 1 },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    FarmScene,
    HouseScene,
    TownScene,
    WoodsScene,
    MineScene,
    WendheadScene,
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
  // The worker is cache-first, so the first launch after a deploy runs the old build while the new one installs.
  // When the new worker takes over and the player is still on the title (no game running), reload into it once;
  // mid-game it waits for the next launch.
  const hadWorker = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker || reloading || !game.scene.isActive('Title')) return;
    reloading = true;
    window.location.reload();
  });
}

/**
 * Size and place the canvas: a whole number of device pixels per game pixel when that gives up at most 10% of the
 * fitted size, else the fitted size; either way on the device-pixel grid, centred, the margin walnut (index.html).
 * Input maps through the canvas bounds, so touch stays exact at any size.
 */
function fitCanvas(): void {
  const parent = document.getElementById('game');
  const canvas = game.canvas as HTMLCanvasElement | undefined;
  if (!parent || !canvas) return;
  const box = parent.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return;
  const f = displayFit(
    box.width,
    box.height,
    window.devicePixelRatio || 1,
    GAME_WIDTH,
    GAME_HEIGHT,
  );
  if (Math.abs(game.scale.zoom - f.cssW / GAME_WIDTH) > 1e-9)
    game.scale.setZoom(f.cssW / GAME_WIDTH);
  canvas.style.position = 'absolute';
  canvas.style.left = `${f.cssLeft}px`;
  canvas.style.top = `${f.cssTop}px`;
  canvas.style.margin = '0';
  canvas.dataset['fit'] = `${f.mode} ${f.devScale.toFixed(3)}`;
  game.scale.updateBounds();
}
game.events.once(Phaser.Core.Events.READY, fitCanvas);
refreshOnRotate(() => {
  game.scale.refresh();
  fitCanvas();
});
wireLifecycle(game);
wireAudio(game);
installWebLifecycle(lifecycle, document, window);
initNative(lifecycle, { beforeExit: () => saveNow(true) });
wireCloudSave();

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
    // Read-only use: why the world is frozen (open modal count, a busy flow, the app suspended).
    runtime,
    // The language: read it, or pick one as Menu > Opts does (remembered outside a scenario sandbox).
    i18n: { getLocale, choose: chooseLanguage },
  };
  // Dev tools (?scenario=, the lab map, clock and frame control, the dev menu: src/dev): a lazy chunk fetched
  // only here, never part of what a player loads. `npm run build:store` leaves it out of the build entirely.
  if (import.meta.env.VITE_DEVTOOLS !== '0')
    void import('./dev/devtools').then((m) => m.installDevTools(game)).catch(() => undefined);
}
