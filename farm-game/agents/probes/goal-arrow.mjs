// After ~15 s of no input a bobbing arrow points at the current goal's target.
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
await page.waitForTimeout(15800);
await page.screenshot({ path: OUT + 'arrow_idle.png' });
await page.evaluate(() => {
  const s = window.__farm.getState();
  s.goalIndex = 5; // the "buy items" goal points at the town gate
});
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'arrow_edge.png' });
await browser.close();
