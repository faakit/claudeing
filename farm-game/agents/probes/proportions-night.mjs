// Proportions pass (art round 3): the player under big crowns at night and by day, facing forage at the wood's
// edge, so the overhead fade over the player, the target marker and the forage can be checked. Also a grown fruit
// tree with ripe fruit and its ready star, and the player standing behind it.
//   URL=http://localhost:5175/ OUT=agents/out/art-shots/round3/proportions/ node agents/probes/proportions-night.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL_ = (process.env.URL ?? 'http://localhost:5173/') + '?debug';
const OUT = process.env.OUT ?? 'agents/out/';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function shot(name, setup, arg) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await page.goto(URL_);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.evaluate(setup, arg);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}${name}.png` });
  await ctx.close();
}
const woods = ([minutes]) => {
  const f = window.__farm;
  const s = f.getState();
  Object.assign(s.time, { minutes, season: 'spring' });
  s.weather = 'sunny';
  // the forage clearing's north edge, under the grove at the top of the woods
  Object.assign(s.player, { map: 'woods', x: 5 * 16 + 8, y: 4 * 16 + 11, facing: 'up' });
  s.forage.woods = { '5,3': 'mushroom', '6,3': 'wild_leek', '4,4': 'daffodil' };
  f.game.scene
    .getScenes(true)
    .find((x) => x.scene.key !== 'UI')
    .scene.start('Woods');
};
await shot('night_under_crowns', woods, [1290]);
await shot('day_under_crowns', woods, [640]);
await shot(
  'fruit_tree_behind',
  () => {
    const f = window.__farm;
    const s = f.getState();
    s.time.minutes = 640;
    s.placed.farm = [
      {
        id: 1,
        type: 'apple_sapling',
        tx: 12,
        ty: 13,
        data: { tree: { age: 20, timer: 0, fruit: 2 } },
      },
      {
        id: 2,
        type: 'cherry_sapling',
        tx: 14,
        ty: 13,
        data: { tree: { age: 20, timer: 0, fruit: 0 } },
      },
      {
        id: 3,
        type: 'plum_sapling',
        tx: 10,
        ty: 13,
        data: { tree: { age: 6, timer: 0, fruit: 0 } },
      },
    ];
    s.nextPlacedId = 4;
    Object.assign(s.player, { x: 12 * 16 + 8, y: 12 * 16 + 11, facing: 'down' });
    f.gameEvents.emit('placedChanged', { map: 'farm' });
  },
  null,
);
await browser.close();
console.log(errors.length ? errors.join(' | ') : 'no page errors');
