// One-thumb conveniences: the gift list that remembers reactions, a jar sheet with "All", and no welcome
// toast after changing maps.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/thumb.mjs
import { chromium } from 'playwright-core';
const OUT = process.env.OUT ?? 'agents/out/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
).newPage();
const errs = [];
const toasts = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${process.env.URL ?? 'http://localhost:5173/'}?debug`);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(5000); // both welcome toasts
await page.evaluate(() => {
  window.__seen = [];
  window.__farm.gameEvents.on('toast', (t) => window.__seen.push(t.text));
  const f = window.__farm;
  const s = f.getState();
  s.player.map = 'woods';
  s.player.x = 10 * 16 + 8;
  s.player.y = 10 * 16 + 11;
  f.game.scene
    .getScenes(true)
    .find((x) => x.scene.key === 'Farm')
    .scene.start('Woods');
});
await page.waitForTimeout(5000);
toasts.push(...(await page.evaluate(() => window.__seen)));
// gift list: one known love, one known dislike, the rest unknown
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  s.time.minutes = 600;
  s.inventory.slots[8] = { item: 'pumpkin', qty: 2 };
  s.inventory.slots[9] = { item: 'stone', qty: 5 };
  s.inventory.slots[10] = { item: 'wild_berry', qty: 1 };
  s.inventory.slots[11] = { item: 'egg', qty: 3 };
  s.stats['gift.rosa.pumpkin'] = 4;
  s.stats['gift.rosa.stone'] = 1;
  const ui = f.game.scene.getScene('UI');
  ui.npc.openFor('rosa');
  ui.npc.mode = 'gift';
  ui.npc.rebuild();
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}thumb-1-gifts.png` });
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  const ui = f.game.scene.getScene('UI');
  ui.npc.close();
  s.placed.woods = [1, 2, 3].map((i) => ({ id: 100 + i, type: 'preserve_jar', tx: 3 + i, ty: 3, data: {} }));
  s.nextPlacedId = 200;
  s.inventory.slots[12] = { item: 'tomato', qty: 6 };
  ui.jar.openFor(101);
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}thumb-2-jar-all.png` });
console.log(JSON.stringify(toasts), errs);
await browser.close();
