// A tilled and watered patch with crops, to judge the soil art.
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
  const f = window.__farm;
  const s = f.getState();
  s.player.x = 12 * 16 + 8;
  s.player.y = 16 * 16 + 11;
  s.player.facing = 'down';
  for (let y = 17; y < 22; y++)
    for (let x = 9; x < 13; x++)
      s.farm.tiles[`${x},${y}`] = {
        watered: y % 2 === 0,
        crop:
          y < 20 ? { cropId: 'parsnip', stage: (x + y) % 4, daysInStage: 0, regrow: false } : null,
      };
  f.gameEvents.emit('farmChanged', undefined);
});
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + 'soil.png' });
await browser.close();
