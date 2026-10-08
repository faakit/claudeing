// Farm with unbought plots (dimmed, signed), a sign interaction and the buy sheet.
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
  const p = window.__farm.getState().player;
  p.x = 15 * 16 + 8;
  p.y = 20 * 16 + 11;
  p.facing = 'right';
});
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + 'plots_farm.png' });
await page.keyboard.down('KeyE');
await page.waitForTimeout(100);
await page.keyboard.up('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + 'plots_buy.png' });
await browser.close();
