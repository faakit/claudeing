// Round-2 art review screenshots: every map view at day, dusk and night, the seasons, at 1x (200x400) and phone
// scale (390x844 CSS px, DPR 2). Usage (dev server running):
//   CHROMIUM_PATH=... URL=http://localhost:5175/ node art-src/tools/shots2.mjs <outDir> <prefix>
// Filters (comma lists): VIEWS=farm_house,town TIMES=day,night SEASONS=spring,winter SIZES=x1 QUERY=skin=walnut
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? 'agents/out/art-shots/round2';
const PREFIX = process.argv[3] ?? 'r2';
const QUERY = process.env.QUERY ? `&${process.env.QUERY}` : '';
const URL_ = (process.env.URL ?? 'http://localhost:5175/') + '?debug' + QUERY;
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const list = (v, all) => (v ? v.split(',') : all);
mkdirSync(OUT, { recursive: true });

const SIZES = {
  x1: { viewport: { width: 200, height: 400 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
};
const TIMES = { day: 630, dusk: 1170, night: 1350 };
/** [map, scene, tx, ty, facing] */
const VIEWS = {
  farm_house: ['farm', 'Farm', 14, 10, 'down'],
  farm_field: ['farm', 'Farm', 14, 22, 'down'],
  farm_pond: ['farm', 'Farm', 20, 37, 'up'],
  house: ['house', 'House', 5, 6, 'up'],
  town_center: ['town', 'Town', 11, 12, 'left'],
  town_river: ['town', 'Town', 13, 26, 'right'],
  woods_lake: ['woods', 'Woods', 11, 19, 'left'],
  woods_north: ['woods', 'Woods', 10, 7, 'up'],
  mine: ['mine', 'Mine', 10, 24, 'up'],
};
const seasonsFor = (view) =>
  ['farm_house', 'town_center', 'woods_lake'].includes(view)
    ? ['spring', 'summer', 'fall', 'winter']
    : ['spring'];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
const SEL = {
  views: list(process.env.VIEWS, Object.keys(VIEWS)),
  times: list(process.env.TIMES, Object.keys(TIMES)),
  seasons: process.env.SEASONS ? process.env.SEASONS.split(',') : null,
  sizes: list(process.env.SIZES, Object.keys(SIZES)),
};
for (const size of SEL.sizes) {
  const ctx = await browser.newContext({ ...SIZES[size], hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL_);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const f = window.__farm;
    f.getState().stats.moved = 1;
    const ui = f.game.scene.getScene('UI');
    ui.dragHint?.destroy();
    ui.dragHint = null;
  });
  await page.waitForTimeout(9000); // let the two welcome toasts pass
  for (const view of SEL.views) {
    const [map, scene, tx, ty, facing] = VIEWS[view];
    const seasons = (SEL.seasons ?? seasonsFor(view)).filter((s) => seasonsFor(view).includes(s));
    for (const season of seasons) {
      // Seasons other than spring only at day (plus night for winter, to see the glow on snow).
      const times = season === 'spring' ? SEL.times : SEL.times.filter((t) => t === 'day');
      for (const time of times) {
        await page.evaluate(
          ([map, scene, tx, ty, facing, season, minutes]) => {
            const f = window.__farm;
            const s = f.getState();
            s.time.minutes = minutes;
            s.time.season = season;
            s.weather = 'sunny';
            s.player.map = map;
            s.player.x = tx * 16 + 8;
            s.player.y = ty * 16 + 11;
            s.player.facing = facing;
            const active = f.game.scene.getScenes(true).find((x) => x.scene.key !== 'UI');
            active.scene.start(scene);
          },
          [map, scene, tx, ty, facing, season, TIMES[time]],
        );
        await page.waitForTimeout(1400);
        await page.screenshot({ path: `${OUT}/${PREFIX}_${view}_${season}_${time}_${size}.png` });
      }
    }
  }
  await ctx.close();
}
await browser.close();
if (errors.length) console.log('ERRORS\n' + [...new Set(errors)].join('\n'));
console.log('done');
