// Art round 3 shots: the new art in place. Tulips at every stage and a scarecrow on the farm, the Founder's Statue
// at levels 1 to 5 in the town square, the new items in the bag, and the tool-use poses next to the walking sprite.
//   URL=http://localhost:5175/ OUT=agents/out/art-shots/round3/ node agents/probes/art-round3.mjs [prefix]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const URL_ = (process.env.URL ?? 'http://localhost:5173/') + '?debug';
const OUT = process.env.OUT ?? 'agents/out/';
const PREFIX = process.argv[2] ?? 'r3';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
const fresh = async (scale = 1) => {
  const ctx = await browser.newContext({
    viewport: scale === 1 ? { width: 200, height: 400 } : { width: 390, height: 844 },
    deviceScaleFactor: scale,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL_);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  return { ctx, page };
};
const go = (page, map, scene, tx, ty, facing = 'down') =>
  page.evaluate(
    ([map, scene, tx, ty, facing]) => {
      const f = window.__farm;
      const s = f.getState();
      Object.assign(s.time, { minutes: 640, season: 'spring' });
      s.weather = 'sunny';
      Object.assign(s.player, { map, x: tx * 16 + 8, y: ty * 16 + 11, facing });
      const active = f.game.scene.getScenes(true).find((x) => x.scene.key !== 'UI');
      active.scene.start(scene);
    },
    [map, scene, tx, ty, facing],
  );

// 1. farm: tulips at stages 0-4 (two rows) and a scarecrow
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => {
    const s = window.__farm.getState();
    for (let i = 0; i < 10; i++)
      s.farm.tiles[`${9 + (i % 5)},${17 + Math.floor(i / 5)}`] = {
        watered: i >= 5,
        crop: { cropId: 'tulip', stage: i % 5, daysInStage: 0, regrow: false },
      };
    s.placed.farm = [{ id: 1, type: 'scarecrow', tx: 15, ty: 17, data: {} }];
    s.nextPlacedId = 2;
  });
  await go(page, 'farm', 'Farm', 12, 20, 'up');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}${PREFIX}_farm_tulips.png` });
  await ctx.close();
}

// 2. town square: the statue at each level
for (const level of [1, 2, 3, 4, 5]) {
  const { ctx, page } = await fresh();
  await page.evaluate((level) => {
    const s = window.__farm.getState();
    s.stats['project.statue'] = 1;
    s.stats['project.statue.level'] = level;
  }, level);
  await go(page, 'town', 'Town', 12, 16, 'left');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}${PREFIX}_statue_l${level}.png` });
  await ctx.close();
}

// 3. the bag with the new items
{
  const { ctx, page } = await fresh(2);
  await page.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    const pick = [
      'tulip_seed',
      'tulip',
      'parsnip_soup',
      'baked_potato',
      'fish_stew',
      'berry_tart',
      'kale_salad',
      'pumpkin_pie',
      'glimmer_trout',
      'sun_carp',
      'old_whiskers',
      'ice_pike',
      'scarecrow',
      'carp',
      'catfish',
      'salmon',
    ];
    s.inventory.slots = s.inventory.slots.map((v, i) =>
      i < 4 ? v : pick[i - 4] ? { item: pick[i - 4], qty: 1 + (i % 5) } : v,
    );
    f.gameEvents.emit('inventoryChanged', undefined);
    f.gameEvents.emit('openPanel', { type: 'menu' });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${PREFIX}_bag_phone.png` });
  await ctx.close();
}

// 4. tool poses (hoe facing down, can and rod facing right and left)
for (const [tool, facing] of [
  ['hoe', 'down'],
  ['watering_can', 'right'],
  ['fishing_rod', 'right'],
  ['fishing_rod', 'left'],
]) {
  const { ctx, page } = await fresh();
  await go(page, 'farm', 'Farm', 12, 15, facing);
  await page.waitForTimeout(1200);
  await page.evaluate((tool) => {
    const w = window.__farm.game.scene.getScene('Farm');
    w.toolPose(tool);
    w.poseUntil = w.time.now + 60000;
    w.syncSprite(false);
  }, tool);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${OUT}${PREFIX}_pose_${tool}_${facing}.png`,
    clip: { x: 60, y: 120, width: 80, height: 100 },
  });
  await ctx.close();
}

await browser.close();
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no page errors');
