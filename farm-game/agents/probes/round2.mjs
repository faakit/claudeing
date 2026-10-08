// Depth round 2: screenshots of the new and changed sheets (board with days, basket kinds, derby, Move sheet,
// statue, shop rows). URL=http://localhost:5174/ OUT=<dir> node agents/probes/round2.mjs
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${process.env.URL ?? 'http://localhost:5173/'}?debug`);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });
const ui = (fn, arg) => page.evaluate(fn, arg);
const closeAll = () =>
  ui(() => {
    const u = window.__farm.game.scene.getScene('UI');
    for (const m of [...u.panels.values(), u.move, u.jar]) if (m.isOpen) m.close();
  });

// 1. Board on day 9 with days left and Clay's notice.
await ui(() => {
  const f = window.__farm;
  const s = f.getState();
  s.time.day = 9;
  s.time.minutes = 600;
  f.gameEvents.emit('openPanel', { type: 'board' });
});
await page.waitForTimeout(500);
await shot('r2-01-board');
await closeAll();
// 2. Harvest Fair basket with kinds.
await ui(() => {
  const f = window.__farm;
  const s = f.getState();
  s.time.season = 'fall';
  s.time.day = 16;
  s.inventory.slots[8] = { item: 'pumpkin', qty: 1, q: 2 };
  s.inventory.slots[9] = { item: 'pumpkin', qty: 1 };
  s.inventory.slots[10] = { item: 'cranberry', qty: 2 };
  s.inventory.slots[11] = { item: 'blackberry', qty: 3 };
  f.gameEvents.emit('openPanel', { type: 'festival' });
});
await page.waitForTimeout(500);
const box = await page.evaluate(() => {
  const c = document.querySelector('canvas').getBoundingClientRect();
  return { x: c.x, y: c.y, k: c.width / 200 };
});
const click = async (lx, ly) => {
  await page.mouse.click(box.x + lx * box.k, box.y + ly * box.k);
  await page.waitForTimeout(250);
};
await click(172, 150 + 58 + 11); // Add first row
await click(172, 150 + 58 + 28 + 11); // Add second row
await shot('r2-02-fair-basket');
await closeAll();
// 3. Derby page with named catches.
await ui(() => {
  const f = window.__farm;
  const s = f.getState();
  s.time.season = 'summer';
  s.time.day = 22;
  s.stats['fest.fishing_derby.y1.catch0'] = 100;
  s.stats['fest.fishing_derby.y1.fish0'] = 14;
  s.stats['fest.fishing_derby.y1.catch1'] = 35;
  s.stats['fest.fishing_derby.y1.fish1'] = 4;
  f.gameEvents.emit('openPanel', { type: 'festival' });
});
await page.waitForTimeout(500);
await shot('r2-03-derby');
await click(100, 150 + 194 + 12);
await shot('r2-04-derby-sure');
await closeAll();
// 4. The Move sheet for a coop with hens.
await ui(() => {
  const f = window.__farm;
  const s = f.getState();
  s.time.season = 'spring';
  s.time.day = 3;
  s.placed.farm = [
    {
      id: 90,
      type: 'coop',
      tx: 10,
      ty: 10,
      data: { house: { n: 3, fed: true, ready: 2, petted: true, joy: 3 } },
    },
  ];
  f.gameEvents.emit('placedChanged', { map: 'farm' });
  f.gameEvents.emit('placedPanel', { panel: 'move', id: 90 });
});
await page.waitForTimeout(500);
await shot('r2-05-move-sheet');
await closeAll();
// 5. The statue page after every project.
await ui(() => {
  const f = window.__farm;
  const s = f.getState();
  for (const id of [
    'canopy',
    'seedexchange',
    'fishladder',
    'library',
    'greenhouse',
    'bathhouse',
    'fairhall',
    'market',
  ])
    s.stats[`project.${id}`] = 1;
  s.stats['project.statue'] = 1;
  s.stats['project.statue.level'] = 2;
  s.stats['fund.statue'] = 12000;
  s.money = 80000;
  f.gameEvents.emit('openPanel', { type: 'projects' });
});
await page.waitForTimeout(400);
await shot('r2-06-projects-list');
await ui(() => {
  const p = window.__farm.game.scene.getScene('UI').panels.get('projects');
  p.id = 'statue';
  p.rebuild();
});
await page.waitForTimeout(300);
await shot('r2-07-statue');
await closeAll();
// 6. Shop seeds with own counts (spring: tulips).
await ui(() => {
  const f = window.__farm;
  const s = f.getState();
  s.inventory.slots[12] = { item: 'parsnip_seed', qty: 12 };
  s.inventory.slots[13] = { item: 'tulip_seed', qty: 5 };
  f.gameEvents.emit('openPanel', { type: 'shop' });
});
await page.waitForTimeout(400);
await shot('r2-08-shop');
console.log('errors', errors.length, errors.join(' | '));
await browser.close();
