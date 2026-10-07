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
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('' + (process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  s.player.x = 15 * 16 + 8;
  s.player.y = 11 * 16 + 11;
  s.player.facing = 'right';
  s.placed.farm = [
    { id: 1, type: 'coop', tx: 12, ty: 12, data: { house: { n: 3, fed: true, ready: 2, joy: 3 } } },
    {
      id: 2,
      type: 'barn',
      tx: 12,
      ty: 15,
      data: { house: { n: 1, fed: false, ready: 0, joy: 0 } },
    },
  ];
  s.nextPlacedId = 3;
  f.gameEvents.emit('placedChanged', { map: 'farm' });
});
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + 'v_farm.png' });
await page.keyboard.press('KeyE'); // Rosa is at 16,12 facing right from 15,11? move
await page.waitForTimeout(600);
await page.screenshot({ path: OUT + 'v_rosa.png' });
await page.evaluate(() => {
  const f = window.__farm;
  f.getState().inventory.slots[8] = { item: 'parsnip', qty: 3 };
  f.getState().inventory.slots[9] = { item: 'wild_berry', qty: 2 };
});
console.log(
  await page.evaluate(() =>
    JSON.stringify({
      f: window.__farm.getState().friends,
      open: window.__farm.game.scene.getScene('UI').npc.isOpen,
    }),
  ),
);
await page.evaluate(() => {
  const u = window.__farm.game.scene.getScene('UI');
  u.npc.mode = 'gift';
  u.npc.rebuild();
});
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + 'v_gift.png' });
await page.keyboard.press('Escape');
await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'shop' }));
await page.waitForTimeout(500);
await page.evaluate(() => {
  const u = window.__farm.game.scene.getScene('UI');
  const sp = u.panels.get('shop');
  sp.tab = 'farm';
  sp.rebuild();
});
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'v_shop.png' });
console.log(errs);
await browser.close();
