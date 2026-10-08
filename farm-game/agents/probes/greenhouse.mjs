// Greenhouse: the marked site on the farm before the project, then the glass with winter melons.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/greenhouse.mjs
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.URL ?? 'http://localhost:5173/'}?debug`);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const s = window.__farm.getState();
  s.player.x = 20 * 16 + 8;
  s.player.y = 30 * 16 + 11 - 16;
  s.stats.moved = 1;
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}greenhouse-1-site.png` });
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  s.stats['project.greenhouse'] = 1;
  s.time.season = 'winter';
  for (let x = 17; x < 25; x++)
    for (let y = 26; y < 28; y++)
      s.farm.tiles[`${x},${y}`] = {
        watered: true,
        crop: { cropId: 'melon', stage: (x + y) % 4, daysInStage: 0, regrow: false },
      };
  f.gameEvents.emit('placedChanged', { map: 'farm' });
  f.gameEvents.emit('farmChanged', undefined);
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}greenhouse-2-built.png` });
console.log(errs);
await browser.close();
