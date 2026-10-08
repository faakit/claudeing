// Home: the shop's Home tab (Bigger Bag + decorations), the bag grid after two bag upgrades, and a row of
// decorations placed on the farm.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/home.mjs
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.URL ?? 'http://localhost:5173/'}?debug`);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const s = window.__farm.getState();
  s.money = 20000;
  s.stats.moved = 1;
  s.stats.tilled = 1;
});
await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'shop' }));
await page.waitForTimeout(400);
await page.evaluate(() => {
  const shop = window.__farm.game.scene.getScene('UI').panels.get('shop');
  shop.tab = 'home';
  shop.rebuild();
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}home-1-shop.png` });
await page.evaluate(() => {
  const shop = window.__farm.game.scene.getScene('UI').panels.get('shop');
  shop.page = 1;
  shop.rebuild();
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}home-2-shop-p2.png` });
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  f.game.scene.getScene('UI').panels.get('shop').close();
  s.upgrades.bag = 2;
  while (s.inventory.slots.length < 40) s.inventory.slots.push(null);
  s.inventory.slots[36] = { item: 'ruby', qty: 3 };
  const list = [];
  let id = 50;
  for (let x = 8; x <= 13; x++) list.push({ id: id++, type: 'fence', tx: x, ty: 14, data: {} });
  for (let y = 15; y <= 18; y++) list.push({ id: id++, type: 'stone_path', tx: 14, ty: y, data: {} });
  list.push({ id: id++, type: 'garden_lamp', tx: 15, ty: 15, data: {} });
  list.push({ id: id++, type: 'flower_pot', tx: 15, ty: 17, data: {} });
  list.push({ id: id++, type: 'garden_fountain', tx: 16, ty: 16, data: {} });
  s.placed.farm = list;
  s.nextPlacedId = id;
  s.player.x = 14 * 16 + 8;
  s.player.y = 17 * 16 + 11;
  f.gameEvents.emit('placedChanged', { map: 'farm' });
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}home-3-decor.png` });
await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'menu' }));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}home-4-bag.png` });
console.log(errs);
await browser.close();
