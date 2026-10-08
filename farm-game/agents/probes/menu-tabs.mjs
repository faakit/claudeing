// Screenshots the Goals and Opts menu tabs (hints, accessibility toggles).
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
for (const tab of ['goals', 'opts']) {
  await page.evaluate((t) => {
    const ui = window.__farm.game.scene.getScene('UI');
    ui.menu.openTab(t);
  }, tab);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}menu_${tab}.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
await browser.close();
