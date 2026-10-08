// The rival farmer: Clay by the town board, the board after Clay took a request, and the festival rivals line.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/rival.mjs
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
  s.time.day = 9;
  s.time.minutes = 600;
  s.player.map = 'town';
  s.player.x = 14 * 16 + 8;
  s.player.y = 12 * 16 + 11;
  s.player.facing = 'up';
  f.game.scene
    .getScenes(true)
    .find((x) => x.scene.key === 'Farm')
    .scene.start('Town');
});
await page.waitForTimeout(1500);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}rival-1-board-morning.png` });
await page.evaluate(() => {
  const f = window.__farm;
  f.game.scene.getScene('UI').panels.get('board').close();
  f.getState().time.minutes = 900;
  f.gameEvents.emit('openPanel', { type: 'board' });
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}rival-2-board-afternoon.png` });
await page.evaluate(() => {
  const f = window.__farm;
  f.game.scene.getScene('UI').panels.get('board').close();
  const s = f.getState();
  s.time.day = 14;
  s.inventory.slots[8] = { item: 'daffodil', qty: 2, q: 1 };
  f.gameEvents.emit('openPanel', { type: 'festival' });
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}rival-3-festival.png` });
console.log(errs);
await browser.close();
