// The Book tab with a few goods discovered.
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
  for (const k of [
    'parsnip',
    'potato',
    'carp',
    'perch',
    'egg',
    'milk',
    'wild_leek',
    'daffodil',
    'apple',
    'cherry',
    'plum',
    'peach',
  ])
    s.stats['got.' + k] = 1;
  s.stats['page.orchard'] = 1;
  window.__farm.game.scene.getScene('UI').menu.openTab('book');
});
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'almanac.png' });
await browser.close();
