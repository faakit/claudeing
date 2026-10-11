// Game-feel checks on the production build (run `npm run build` first): the camera never shimmers the farmer and
// rests centred, a map change completes inside its wipe and takes input while it opens, a sheet frees the world
// on the frame it starts to close, Calm mode drops the slide, and nothing visible is drawn at a fractional scale
// or a free rotation. Headless Chromium on an iPhone 13 profile; software GL.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.E2E_FEEL_PORT ?? Number(process.env.E2E_PORT ?? 4173) + 25);
const URL_ = `http://localhost:${PORT}/?debug&tutorial=0`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' },
);
server.on('exit', (code) => {
  if (code) {
    console.error(`preview server exited (${code}): is port ${PORT} taken?`);
    process.exit(1);
  }
});
process.on('exit', () => server.kill());
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(URL_)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 200));
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL_);
  await page.waitForFunction(() => window.__farm?.game?.scene?.getScene('Title')?.sys.isActive());
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__farm.game.scene.getScene('Farm')?.sys.isActive());
  await page.waitForTimeout(1500);
  const world = () => 'window.__farm.game.scene.getScenes(true).find((s) => s.grid)';
  const place = (tx, ty, facing = 'down') =>
    page.evaluate(
      ([tx, ty, facing]) => {
        const s = window.__farm.getState();
        s.player.x = tx * 16 + 8;
        s.player.y = ty * 16 + 11;
        s.player.facing = facing;
        s.time.minutes = 600;
        s.energy = 200;
      },
      [tx, ty, facing],
    );

  // --- Camera: a per-frame record of the farmer's screen position while walking and after stopping.
  await page.evaluate((w) => {
    window.__cam = [];
    window.__farm.game.events.on('postrender', () => {
      const sc = eval(w);
      if (!sc) return;
      const cam = sc.cameras.main;
      window.__cam.push([
        Math.floor(sc.sprite.x) - cam.scrollX,
        Math.floor(sc.sprite.y) - cam.scrollY,
      ]);
    });
  }, world());
  const walk = async (key, ms, axis) => {
    await page.evaluate(() => (window.__cam = []));
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    const during = await page.evaluate(() => window.__cam.length);
    await page.keyboard.up(key);
    await page.waitForTimeout(1200);
    const xs = await page.evaluate(() => window.__cam);
    // Steady part: from 300 ms into the walk to the release.
    const steady = xs.slice(Math.floor(during * (300 / ms)), during).map((p) => p[axis]);
    let rev = 0;
    let last = 0;
    for (let i = 1; i < steady.length; i++) {
      const d = Math.sign(steady[i] - steady[i - 1]);
      if (d !== 0) {
        if (last !== 0 && d !== last) rev++;
        last = d;
      }
    }
    return { rev, rest: xs.at(-1) };
  };
  await place(8, 20, 'right');
  await page.waitForTimeout(800);
  const centre = await page.evaluate(() => window.__cam.at(-1));
  for (const [key, axis] of [
    ['ArrowRight', 0],
    ['ArrowLeft', 0],
    ['ArrowDown', 1],
    ['ArrowUp', 1],
  ]) {
    const r = await walk(key, 1000, axis);
    check(
      `camera: walking ${key.slice(5)} never hops the farmer back on screen`,
      r.rev === 0,
      `${r.rev} reversals`,
    );
    check(
      `camera: after walking ${key.slice(5)} the farmer rests centred (within 1 px)`,
      Math.abs(r.rest[0] - centre[0]) <= 1 && Math.abs(r.rest[1] - centre[1]) <= 1,
      `rest ${r.rest} centre ${centre}`,
    );
  }
  const nudge = await walk('ArrowRight', 120, 0);
  check(
    'camera: a one-tile nudge rests centred too',
    Math.abs(nudge.rest[0] - centre[0]) <= 1,
    `rest ${nudge.rest} centre ${centre}`,
  );

  // --- A map change: the wipe covers, the next map builds, the wipe opens; under 450 ms in all at 1x.
  await place(14, 8, 'up');
  await page.waitForTimeout(600);
  const door = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const f = window.__farm;
        const ui = f.game.scene.getScene('UI');
        const t0 = performance.now();
        let peak = 0;
        let tapped = null;
        const s = f.getState();
        s.player.y = 7 * 16 + 11; // onto the farmhouse door
        const fn = () => {
          peak = Math.max(peak, ui.wipe.level);
          const house = f.game.scene.getScene('House');
          // A tap while the wipe opens must be taken (it walks), never swallowed.
          if (
            !tapped &&
            house.sys.isActive() &&
            ui.wipe.level > 0 &&
            ui.wipe.level < 16 &&
            !ui.wipe.covered
          ) {
            const n = f.controls.entries.length;
            const last0 = f.controls.entries.at(-1);
            f.inputHub.emit('tap', { x: 70, y: 150 });
            const last = f.controls.entries.at(-1);
            tapped = { route: f.controls.entries.length > n || last !== last0, kind: last?.kind };
          }
          if (house.sys.isActive() && !ui.wipe.busy) {
            f.game.events.off('postrender', fn);
            resolve({ ms: performance.now() - t0, peak, tapped });
          }
        };
        f.game.events.on('postrender', fn);
        setTimeout(() => resolve({ ms: -1, peak, tapped }), 3000);
      }),
  );
  check('door: the wipe covers the world fully', door.peak === 16, `peak level ${door.peak}`);
  check(
    'door: step to clear view in under 450 ms',
    door.ms > 0 && door.ms < 450,
    `${door.ms.toFixed(0)} ms`,
  );
  check(
    'door: a tap while the wipe opens is taken, not swallowed',
    door.tapped?.route === true,
    JSON.stringify(door.tapped),
  );

  // --- Sheets: the world takes input on the frame a sheet starts to close, while it slides away.
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'menu' }));
  await page.waitForTimeout(400);
  const closing = await page.evaluate(() => {
    const f = window.__farm;
    const menu = f.game.scene.getScene('UI').panels.get('menu');
    f.inputHub.emit('menu', undefined);
    return { blocked: f.runtime.blocked, visible: menu.root.visible, open: menu.isOpen };
  });
  check(
    'sheet: closing frees the world at once while the sheet slides away',
    !closing.blocked && closing.visible && !closing.open,
    JSON.stringify(closing),
  );
  await page.waitForTimeout(400);
  const gone = await page.evaluate(
    () => window.__farm.game.scene.getScene('UI').panels.get('menu').root.visible,
  );
  check('sheet: the slide finishes and the sheet hides', !gone);

  // --- Calm mode: a sheet is simply there (no slide).
  const calm = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const f = window.__farm;
        f.getState().settings.reduceMotion = true;
        const menu = f.game.scene.getScene('UI').panels.get('menu');
        f.gameEvents.emit('openPanel', { type: 'menu' });
        f.game.events.once('postrender', () => {
          const y = menu.root.y;
          menu.close();
          f.getState().settings.reduceMotion = false;
          resolve({ y, want: 400 - menu.panelH });
        });
      }),
  );
  check('Calm: a sheet opens without sliding', calm.y === calm.want, JSON.stringify(calm));

  // --- Pixel integrity through a till, a harvest and a sheet: no fractional scale (whole-pixel display sizes
  // are allowed for squash and stretch), no rotation off a quarter turn, on anything visible.
  await page.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    s.player.map = 'farm';
    s.player.x = 10 * 16 + 8;
    s.player.y = 17 * 16 + 11;
    s.player.facing = 'down';
    s.farm.tiles['10,18'] = {
      watered: true,
      crop: { cropId: 'parsnip', stage: 4, daysInStage: 0, regrow: false },
    };
    f.game.scene
      .getScenes(true)
      .find((x) => x.scene.key !== 'UI')
      .scene.start('Farm');
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__bad = [];
    const scan = () => {
      for (const sc of window.__farm.game.scene.getScenes(true)) {
        const walk = (list, parentScale = 1) => {
          for (const o of list) {
            if (!o.visible || o.alpha === 0) continue;
            if (o.type === 'Container') {
              walk(o.list, parentScale * o.scaleX);
              continue;
            }
            if (o.type !== 'Image' && o.type !== 'Sprite') continue;
            if (o.texture?.key === '__WHITE' || o.texture?.key === 'fx_px') continue;
            const sx = o.scaleX * parentScale;
            const sy = o.scaleY * parentScale;
            const dw = o.frame.width * Math.abs(sx);
            const dh = o.frame.height * Math.abs(sy);
            const wholeScale = Number.isInteger(Math.abs(sx)) && Number.isInteger(Math.abs(sy));
            const wholeSize =
              Math.abs(dw - Math.round(dw)) < 1e-6 && Math.abs(dh - Math.round(dh)) < 1e-6;
            const quarter = Math.abs(((o.angle % 90) + 90) % 90) < 1e-6;
            if (!(wholeScale || wholeSize) || !quarter)
              window.__bad.push(
                `${sc.scene.key}:${o.texture.key}/${o.frame.name} scale ${sx.toFixed(3)}x${sy.toFixed(3)} angle ${o.angle}`,
              );
          }
        };
        walk(sc.children.list);
      }
    };
    window.__farm.game.events.on('postrender', scan);
    window.__scan = scan;
  });
  await page.keyboard.down('Space');
  await page.waitForTimeout(90);
  await page.keyboard.up('Space');
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'menu' }));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__farm.inputHub.emit('menu', undefined));
  await page.waitForTimeout(400);
  const bad = await page.evaluate(() => {
    window.__farm.game.events.off('postrender', window.__scan);
    return [...new Set(window.__bad)];
  });
  check(
    'pixels: nothing visible at a fractional scale or a free rotation',
    bad.length === 0,
    bad.slice(0, 6).join(' | '),
  );
  const hit = await page.evaluate(() => window.__farm.game.scene.getScene('Farm').tweens.timeScale);
  check('harvest: the hit-stop lets go (tweens run again)', hit === 1, `timeScale ${hit}`);

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
}
if (failed) {
  console.error(`E2E FEEL FAILED (${failed})`);
  process.exit(1);
}
console.log('e2e feel: all checks passed');
