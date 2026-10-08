// A heart event scene with Rosa.
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
  s.friends.rosa = { points: 120, talkedDay: 0, giftedDay: 0 };
  window.__farm.gameEvents.emit('talkTo', { id: 'rosa' });
});
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + 'event_1.png' });
await browser.close();
