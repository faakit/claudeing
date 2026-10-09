// Ambient anchor probe (art round 3, owner's bug "butterflies follow the screen"): on a spring farm morning, let
// petals and butterflies drift, freeze the motes, scroll the camera 64 px and check that every mote and butterfly
// keeps its world position. Writes before/after shots and prints the measured shifts. The same check runs in e2e.
//   URL=http://localhost:5175/ OUT=agents/out/ node agents/probes/ambient-anchor.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL_ = (process.env.URL ?? 'http://localhost:5173/') + '?debug';
const OUT = process.env.OUT ?? 'agents/out/';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 200, height: 400 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL_);
await page.waitForTimeout(2000);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const season = process.env.SEASON ?? 'spring';
await page.evaluate((season) => {
  const f = window.__farm;
  const s = f.getState();
  s.weather = 'sunny';
  Object.assign(s.time, { season, minutes: 700 });
  s.player.x = 15 * 16 + 8;
  s.player.y = 20 * 16 + 11;
  f.game.scene.getScene('Farm').scene.restart();
}, season);
await page.waitForTimeout(6000);
const read = () =>
  page.evaluate(() => {
    const w = window.__farm.game.scene.getScene('Farm');
    const cam = w.cameras.main;
    return { ...w.ambient.debugPositions(), scroll: [cam.scrollX, cam.scrollY] };
  });
await page.evaluate(() => {
  const w = window.__farm.game.scene.getScene('Farm');
  if (w.ambient.emitter) w.ambient.emitter.timeScale = 0;
  w.cameras.main.stopFollow();
});
await page.waitForTimeout(200);
const a = await read();
await page.screenshot({ path: `${OUT}ambient-anchor-before.png` });
await page.evaluate(() => {
  window.__farm.game.scene.getScene('Farm').cameras.main.scrollY += 64;
});
await page.waitForTimeout(400);
const b = await read();
await page.screenshot({ path: `${OUT}ambient-anchor-after.png` });
const shift = (xs, ys) =>
  Math.max(0, ...xs.map((m, i) => Math.hypot(m.x - ys[i].x, m.y - ys[i].y)));
console.log(
  JSON.stringify(
    {
      season,
      camera: [b.scroll[0] - a.scroll[0], b.scroll[1] - a.scroll[1]],
      motes: a.motes.length,
      moteShift: shift(a.motes, b.motes),
      flies: a.flies.length,
      flyShift: shift(a.flies, b.flies),
      errors,
    },
    null,
    1,
  ),
);
await browser.close();
