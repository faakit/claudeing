// Shows the morning summary with long notes, to check that nothing overlaps.
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
await page.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
await page.waitForTimeout(3500);
await page.screenshot({ path: OUT + 'summary.png' });
await browser.close();
