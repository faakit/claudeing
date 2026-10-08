// A storm morning: HUD label, heavy rain, and the sleep sheet with tomorrow's forecast.
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
  s.weather = 'storm';
  s.forecast = 'rain';
  s.time.season = 'summer';
});
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + 'storm_day.png' });
await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'sleep' }));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'storm_sleep.png' });
await browser.close();
