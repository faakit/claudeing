import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('' + (process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() =>
  window.__farm.gameEvents.emit('startFishing', { map: 'farm', fish: 'trout', bait: false }),
);
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'fish_wait.png' });
// click repeatedly until the reel starts (a tap during the bite hooks it)
for (let i = 0; i < 30; i++) {
  await page.mouse.click(195, 700);
  await page.waitForTimeout(120);
}
await page.mouse.move(195, 700);
await page.mouse.down();
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'fish_reel.png' });
await page.waitForTimeout(6000);
await page.screenshot({ path: OUT + 'fish_end.png' });
await page.mouse.up();
console.log(
  'state',
  await page.evaluate(() =>
    JSON.stringify({
      fishing: window.__farm.getState().skills,
      stats: window.__farm.getState().stats,
    }),
  ),
  errors,
);
await browser.close();
