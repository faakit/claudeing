// Screenshots for controls reviews: the dock (both hands, Interact showing), the target marker's yes/no states,
// and any extra scene a milestone adds. Writes agents/out/controls/<LABEL>/*.png. Run `npm run build` first.
//
//   LABEL=m1 PROFILES=i13,se node scripts/shots-controls.mjs
import { mkdirSync } from 'node:fs';
import { PROFILES, launch, openGame, sleep, startPreview } from './thumb-lib.mjs';

const label = process.env.LABEL ?? 'shots';
const out = `agents/out/controls/${label}/`;
mkdirSync(out, { recursive: true });
const which = (process.env.PROFILES ?? 'i13,se').split(',');
const { url, stop } = await startPreview(Number(process.env.SHOTS_PORT ?? 5182), {
  snapshot: true,
});
const browser = await launch();

const place = (page, tx, ty, facing, extra = '') =>
  page.evaluate(
    ({ tx, ty, facing, extra }) => {
      const f = window.__farm;
      const s = f.getState();
      s.player.x = tx * 16 + 8;
      s.player.y = ty * 16 + 11;
      s.player.facing = facing;
      s.time.minutes = 600;
      if (extra) new Function('s', 'f', extra)(s, f);
      f.gameEvents.emit('farmChanged', undefined);
      f.gameEvents.emit('inventoryChanged', undefined);
    },
    { tx, ty, facing, extra },
  );

try {
  for (const p of PROFILES.filter((x) => which.includes(x.id)))
    for (const hand of ['right', 'left']) {
      const { page, ctx } = await openGame(browser, url, p, { leftHanded: hand === 'left' });
      await place(page, 12, 10, 'up'); // the bin in reach: Interact shows
      await sleep(1200);
      await page.screenshot({ path: `${out}${p.id}-${hand}-dock.png` });
      if (hand === 'right') {
        await place(page, 10, 17, 'down', 's.farm.tiles = {}; s.inventory.selected = 0;');
        await sleep(900);
        await page.screenshot({ path: `${out}${p.id}-marker-work.png` });
        await place(
          page,
          10,
          17,
          'down',
          's.inventory.selected = 3; s.settings.controls && (s.settings.controls.autoTool = true);',
        );
        await sleep(600);
        await page.screenshot({ path: `${out}${p.id}-marker-none.png` });
      }
      await ctx.close();
    }
} finally {
  await browser.close();
  stop();
}
console.log(`screenshots in ${out}`);
