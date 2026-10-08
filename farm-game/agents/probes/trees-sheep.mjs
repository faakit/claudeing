// Fruit trees (sapling and grown, with fruit), a shed with sheep, a loom, and the shop's farm tab.
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (
  await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 2,
  })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto((process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  s.player.x = 13 * 16 + 8;
  s.player.y = 12 * 16 + 11;
  s.player.facing = 'down';
  s.placed.farm = [
    {
      id: 1,
      type: 'cherry_sapling',
      tx: 11,
      ty: 14,
      data: { tree: { age: 2, timer: 0, fruit: 0 } },
    },
    {
      id: 2,
      type: 'apple_sapling',
      tx: 12,
      ty: 14,
      data: { tree: { age: 12, timer: 0, fruit: 2 } },
    },
    {
      id: 3,
      type: 'shed',
      tx: 16,
      ty: 13,
      data: { house: { n: 2, fed: true, petted: false, ready: 1, joy: 2 } },
    },
    {
      id: 4,
      type: 'loom',
      tx: 17,
      ty: 15,
      data: { jar: { out: { item: 'cloth', of: 'wool' }, days: 0 } },
    },
  ];
  s.nextPlacedId = 5;
  f.gameEvents.emit('placedChanged', { map: 'farm' });
});
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + 'trees_farm.png' });
await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'shop' }));
await page.waitForTimeout(400);
await page.evaluate(() => {
  const sp = window.__farm.game.scene.getScene('UI').panels.get('shop');
  sp.tab = 'farm';
  sp.rebuild();
});
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'trees_shop.png' });
console.log(errors);
await browser.close();
