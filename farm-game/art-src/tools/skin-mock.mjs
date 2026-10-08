// UI skin comparison: farm HUD, bag and shop at 390x844 in the plum and walnut skins.
// Usage (dev server running): CHROMIUM_PATH=... URL=http://localhost:5175/ node art-src/tools/skin-mock.mjs <outDir>
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? 'agents/out/art-shots';
const BASE = process.env.URL ?? 'http://localhost:5175/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const skin of ['plum', 'walnut']) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?debug&skin=${skin}`);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const s = window.__farm.getState();
    s.time.minutes = 600;
    s.player.x = 12 * 16 + 8;
    s.player.y = 15 * 16 + 11;
    const pick = [
      'parsnip_seed',
      'tomato',
      'cauliflower',
      'pumpkin',
      'egg',
      'milk',
      'honey',
      'wool',
      'jam',
      'wine',
    ];
    s.inventory.slots = s.inventory.slots.map((v, i) =>
      i < 4 ? v : pick[i - 4] ? { item: pick[i - 4], qty: 1 + (i % 5) } : v,
    );
    window.__farm.gameEvents.emit('inventoryChanged', undefined);
  });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/skin_${skin}_farm.png` });
  await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'menu' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/skin_${skin}_bag.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'shop' }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/skin_${skin}_shop.png` });
  await ctx.close();
}
await browser.close();
console.log('done');
