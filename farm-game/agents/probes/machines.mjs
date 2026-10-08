// Keg, bee house and jar on the farm, with goods ready; the keg shows in the machine picker.
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
  const f = window.__farm;
  const s = f.getState();
  s.player.x = 13 * 16 + 8;
  s.player.y = 12 * 16 + 11;
  s.player.facing = 'down';
  s.placed.farm = [
    {
      id: 1,
      type: 'keg',
      tx: 12,
      ty: 14,
      data: { jar: { out: { item: 'wine', of: 'tomato' }, days: 0 } },
    },
    { id: 2, type: 'bee_house', tx: 14, ty: 14, data: { hive: { timer: 0, ready: 2 } } },
    { id: 3, type: 'preserve_jar', tx: 16, ty: 14, data: {} },
  ];
  s.nextPlacedId = 4;
  s.inventory.slots[8] = { item: 'tomato', qty: 3 };
  f.gameEvents.emit('placedChanged', { map: 'farm' });
});
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + 'machines_farm.png' });
await page.evaluate(() => window.__farm.gameEvents.emit('placedPanel', { panel: 'jar', id: 3 }));
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'machines_picker.png' });
await browser.close();
