// Art round 5: the menu sheets (bag, shop, bin, board, Options) on the phone profiles, at phone scale (page
// screenshot, `_phone`), and the canvas region alone (`_canvas`; tools/x1.py samples it down to 200 x 400). Waits on the game, never on a fixed timeout.
//
//   npm run build && node agents/probes/sheets-round5.mjs <outDir> [tag]
//   URL=http://localhost:5175/ node agents/probes/sheets-round5.mjs <outDir> [tag]   (against a dev server)
//
// PROFILES=i13,se,pixel7 SHEETS=bag,shop,bin,board,opts SCENARIO=lab
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const out = process.argv[2] ?? 'agents/out/art-shots/round5';
const tag = process.argv[3] ?? 'now';
const profiles = (process.env.PROFILES ?? 'i13,se,pixel7').split(',');
const sheets = (process.env.SHEETS ?? 'bag,shop,bin,board,opts').split(',');
const scenario = process.env.SCENARIO ?? 'lab';
mkdirSync(out, { recursive: true });
const fits = {};

const open = (sheet) => {
  const ui = window.__farm.game.scene.getScene('UI');
  if (sheet === 'bag' || sheet === 'opts') ui.menu.openTab(sheet);
  else window.__farm.gameEvents.emit('openPanel', { type: sheet });
};
const close = () => window.__farm.game.scene.getScene('UI').activeModal()?.close();

const { url, stop } = await serve(Number(process.env.PORT ?? 4891));
const browser = await launch();
try {
  for (const p of profiles) {
    const farm = await openScenario(browser, url, scenario, { profile: p, hand: 'right' });
    for (const s of sheets) {
      await farm.eval(open, s);
      await farm.panel();
      await farm.idle(12);
      await farm.shot(`${tag}_${s}_${p}_phone`, out);
      // 1x: the canvas region of the page shot, one sample per game pixel (WebGL keeps no readable buffer)
      const box = await farm.eval(() => {
        const r = window.__farm.game.canvas.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, fit: window.__farm.game.canvas.dataset.fit };
      });
      const clip = await farm.page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
      writeFileSync(join(out, `${tag}_${s}_${p}_canvas.png`), clip);
      fits[p] = box.fit;
      await farm.eval(close);
      await farm.panelClosed();
      await farm.idle(6);
    }
    console.log(p, 'done; console errors:', farm.errors.length ? farm.errors : 'none');
    await farm.close();
  }
  writeFileSync(join(out, `${tag}_fits.json`), JSON.stringify(fits, null, 1));
} finally {
  await browser.close();
  stop();
}
