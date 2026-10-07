import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
).newPage();
page.on('console', (m) => console.log('console', m.type(), m.text()));
await page.goto('' + (process.env.URL ?? 'http://localhost:5173/') + '?debug');
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const st = () =>
  page.evaluate(() => {
    const s = window.__farm.getState();
    return JSON.stringify({
      p: s.player,
      f: s.forage,
      st: s.stats,
      sel: s.inventory.selected,
      toasts: 0,
    });
  });
await page.evaluate(() => {
  const p = window.__farm.getState().player;
  p.x = 13 * 16 + 8;
  p.y = 17 * 16 + 11;
  p.facing = 'down';
  const f = window.__farm;
  f.getState().forage.farm = { '13,18': 'wild_leek', '12,18': 'daffodil' };
  f.gameEvents.emit('forageChanged', { map: 'farm' });
  f.gameEvents.on('toast', (t) => console.log('TOAST', JSON.stringify(t)));
});
await page.keyboard.press('Digit1');
for (let i = 0; i < 2; i++) {
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');
  await page.waitForTimeout(600);
  console.log(await st());
}
await browser.close();
