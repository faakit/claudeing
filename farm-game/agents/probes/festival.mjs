// Fall festival day: the board's banner button and the festival sheet with ranked entries.
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
await page.goto((process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const s = window.__farm.getState();
  s.time.season = 'fall';
  s.time.day = 16;
  s.inventory.slots[8] = { item: 'pumpkin', qty: 2, q: 2 };
  s.inventory.slots[9] = { item: 'potato', qty: 5 };
  s.inventory.slots[10] = { item: 'parsnip', qty: 5 };
  window.__farm.gameEvents.emit('openPanel', { type: 'board' });
});
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'festival_board.png' });
await page.keyboard.press('Escape');
await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'festival' }));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'festival.png' });
await browser.close();
