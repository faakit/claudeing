// Screenshots every menu tab (layout check after moving the tab row to the bottom).
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
for (const tab of ['bag', 'goals', 'craft', 'skills', 'opts']) {
  await page.evaluate((t) => window.__farm.game.scene.getScene('UI').menu.openTab(t), tab);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}tab_${tab}.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}
await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'shop' }));
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}tab_shop.png` });
await browser.close();
