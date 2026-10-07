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
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('' + (process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const ev = (fn, arg) => page.evaluate(fn, arg);
// give the player stuff, put forage + sprinkler + jar nearby
await ev(() => {
  const f = window.__farm;
  const s = f.getState();
  s.player.x = 14 * 16 + 8;
  s.player.y = 17 * 16 + 11;
  s.player.facing = 'down';
  s.forage.farm = { '13,19': 'wild_leek', '15,19': 'daffodil', '12,18': 'mushroom' };
  s.placed.farm = [
    { id: 1, type: 'sprinkler', tx: 10, ty: 18, data: {} },
    {
      id: 2,
      type: 'preserve_jar',
      tx: 17,
      ty: 18,
      data: { jar: { out: { item: 'jam', of: 'tomato' }, days: 0 } },
    },
    { id: 3, type: 'quality_sprinkler', tx: 10, ty: 20, data: {} },
  ];
  s.nextPlacedId = 4;
  f.gameEvents.emit('forageChanged', { map: 'farm' });
  f.gameEvents.emit('placedChanged', { map: 'farm' });
});
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + 'farm.png' });
// menu tabs
for (const tab of ['craft', 'skills']) {
  await ev((t) => window.__farm.gameEvents.emit('openPanel', { type: t }), tab);
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + tab + '.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
// board
await ev(() => {
  const s = window.__farm.getState();
  s.inventory.slots[6] = { item: 'parsnip', qty: 9 };
  window.__farm.gameEvents.emit('openPanel', { type: 'board' });
});
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + 'board.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// jar panel
await ev(() => {
  const s = window.__farm.getState();
  s.inventory.slots[7] = { item: 'tomato', qty: 3, q: 1 };
  window.__farm.gameEvents.emit('placedPanel', { panel: 'jar', id: 1 });
});
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + 'jar.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// fishing
await ev(() =>
  window.__farm.gameEvents.emit('startFishing', { map: 'farm', fish: 'carp', bait: true }),
);
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'fish_wait.png' });
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + 'fish_bite.png' });
await page.mouse.click(195, 700);
await page.waitForTimeout(800);
await page.mouse.move(195, 700);
await page.mouse.down();
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + 'fish_reel.png' });
await page.mouse.up();
console.log('errors', JSON.stringify(errors));
await browser.close();
