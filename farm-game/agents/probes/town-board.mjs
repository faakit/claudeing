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
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('' + (process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
// walk to town via state teleport
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  s.player.map = 'town';
  s.player.x = 14 * 16 + 8;
  s.player.y = 12 * 16 + 11;
  s.player.facing = 'up';
  f.game.scene
    .getScenes(true)
    .find((x) => x.scene.key === 'Farm')
    .scene.start('Town');
});
await page.waitForTimeout(1500);
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + 'town_board.png' });
console.log(
  await page.evaluate(() => window.__farm.game.scene.getScene('UI').panels.get('board').isOpen),
  errs,
);
await browser.close();
