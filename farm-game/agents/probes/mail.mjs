// Mailbox: the marker on the farm when mail waits, the letter list and a letter with a gift.
//   URL=http://localhost:5174/ OUT=agents/out/ CHROMIUM_PATH=... node agents/probes/mail.mjs
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
  s.stats.caught = 1;
  s.stats.mined = 1;
});
await page.evaluate(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false }));
await page.waitForTimeout(3000);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const f = window.__farm;
  const s = f.getState();
  s.player.map = 'farm';
  s.player.x = 15 * 16 + 8;
  s.player.y = 10 * 16 + 11;
  s.player.facing = 'right';
  f.game.scene
    .getScenes(true)
    .find((x) => x.scene.key === 'House')
    .scene.start('Farm');
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}mail-1-marker.png` });
// open with the real Interact key, facing the mailbox at (13,9) from (14,9)
await page.evaluate(() => {
  const p = window.__farm.getState().player;
  p.x = 14 * 16 + 8;
  p.y = 9 * 16 + 11;
  p.facing = 'left';
});
await page.waitForTimeout(300);
await page.keyboard.down('KeyE');
await page.waitForTimeout(120);
await page.keyboard.up('KeyE');
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}mail-2-list.png` });
const open = await page.evaluate(
  () => window.__farm.game.scene.getScene('UI').panels.get('mail').isOpen,
);
await page.evaluate(() => {
  const s = window.__farm.getState();
  const panel = window.__farm.game.scene.getScene('UI').panels.get('mail');
  panel.id = s.mail.list[0].id;
  panel.rebuild();
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}mail-3-letter.png` });
console.log(open, JSON.stringify(await page.evaluate(() => window.__farm.getState().mail.list.map((l) => l.title))), errs);
await browser.close();
