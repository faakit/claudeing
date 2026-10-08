// Festival modes: the Harvest Fair basket (two goods picked) and the Fishing Derby with two catches.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/festival-modes.mjs
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
  const f = window.__farm;
  const s = f.getState();
  s.time.season = 'fall';
  s.time.day = 16;
  s.inventory.slots[6] = { item: 'pumpkin', qty: 3, q: 2 };
  s.inventory.slots[7] = { item: 'apple', qty: 2 };
  s.inventory.slots[8] = { item: 'yam', qty: 4 };
  s.inventory.slots[9] = { item: 'corn', qty: 2, q: 1 };
  f.gameEvents.emit('openPanel', { type: 'festival' });
  const p = f.game.scene.getScene('UI').panels.get('festival');
  p.basket = ['pumpkin|2|', 'apple|0|'];
  p.rebuild();
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}festival-1-basket.png` });
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  f.game.scene.getScene('UI').panels.get('festival').close();
  s.time.season = 'summer';
  s.time.day = 22;
  s.stats['fest.fishing_derby.y1.catch0'] = 100;
  s.stats['fest.fishing_derby.y1.catch1'] = 55;
  f.gameEvents.emit('openPanel', { type: 'festival' });
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}festival-2-derby.png` });
console.log(errs);
await browser.close();
