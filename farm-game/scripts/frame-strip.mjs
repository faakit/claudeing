// Frame strips: every rendered frame of a short moment (a door, opening a sheet, a harvest), stitched into one
// PNG at 1x (or `SCALE`), so motion can be judged frame by frame. Headless, software GL.
// Usage: node scripts/frame-strip.mjs <url-base> <outDir> [moment ...]
//   moments: door, newgame, sheet, harvest, till, lean, walk, toast
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [base = 'http://localhost:5180', outDir = 'agents/out/feel/strips', ...wanted] =
  process.argv.slice(2);
const moments = wanted.length ? wanted : ['door', 'newgame', 'sheet', 'harvest', 'walk', 'toast'];
const SCALE = Number(process.env.SCALE ?? 1);
const CROP = process.env.CROP; // "x,y,w,h" in logical px
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

async function open(skipTitle = true) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/?debug&tutorial=0`);
  await page.waitForFunction(() => window.__farm?.game?.scene?.getScene('Title')?.sys.isActive());
  await page.waitForTimeout(800);
  if (skipTitle) {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__farm.game.scene.getScene('Farm')?.sys.isActive());
    await page.waitForTimeout(1200);
  }
  return { ctx, page };
}

/** Grab every frame from now for `frames` frames (dataURLs taken right after each render). */
const capture = (page, frames, every = 1) =>
  page.evaluate(
    ([frames, every]) =>
      new Promise((resolve) => {
        const out = [];
        const ev = window.__farm.game.events;
        let n = 0;
        const fn = () => {
          if (n++ % every === 0) out.push(window.__farm.game.canvas.toDataURL('image/png'));
          if (out.length >= frames) {
            ev.off('postrender', fn);
            resolve(out);
          }
        };
        ev.on('postrender', fn);
      }),
    [frames, every],
  );

async function stitch(page, urls, file, cols = 12) {
  const png = await page.evaluate(
    async ([urls, cols, scale, crop]) => {
      const imgs = await Promise.all(
        urls.map(
          (u) =>
            new Promise((r) => {
              const i = new Image();
              i.onload = () => r(i);
              i.src = u;
            }),
        ),
      );
      const [cx, cy, cw, ch] = crop
        ? crop.split(',').map(Number)
        : [0, 0, imgs[0].width, imgs[0].height];
      const w = cw * scale;
      const h = ch * scale;
      const rows = Math.ceil(imgs.length / cols);
      const c = document.createElement('canvas');
      c.width = Math.min(cols, imgs.length) * (w + 2);
      c.height = rows * (h + 2);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#ff00ff';
      g.fillRect(0, 0, c.width, c.height);
      imgs.forEach((im, k) =>
        g.drawImage(im, cx, cy, cw, ch, (k % cols) * (w + 2), Math.floor(k / cols) * (h + 2), w, h),
      );
      return c.toDataURL('image/png');
    },
    [urls, cols, SCALE, CROP],
  );
  fs.writeFileSync(path.join(outDir, file), Buffer.from(png.split(',')[1], 'base64'));
  console.log('wrote', path.join(outDir, file), `${urls.length} frames`);
}

const place = (page, tx, ty, facing = 'down') =>
  page.evaluate(
    ([tx, ty, facing]) => {
      const p = window.__farm.getState().player;
      p.x = tx * 16 + 8;
      p.y = ty * 16 + 11;
      p.facing = facing;
    },
    [tx, ty, facing],
  );

for (const m of moments) {
  if (m === 'newgame') {
    const { ctx, page } = await open(false);
    const shots = capture(page, 36, 2);
    await page.keyboard.press('Enter');
    await stitch(page, await shots, 'newgame.png');
    await ctx.close();
  } else if (m === 'door') {
    const { ctx, page } = await open();
    await place(page, 14, 8, 'up');
    await page.waitForTimeout(600);
    const shots = capture(page, 48, 2);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowUp');
    await stitch(page, await shots, 'door.png');
    await ctx.close();
  } else if (m === 'sheet') {
    const { ctx, page } = await open();
    const shots = capture(page, 36, 1);
    await page.evaluate(() => window.__farm.gameEvents.emit('openPanel', { type: 'menu' }));
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__farm.inputHub.emit('menu', undefined));
    await stitch(page, await shots, 'sheet.png');
    await ctx.close();
  } else if (m === 'harvest') {
    const { ctx, page } = await open();
    await page.evaluate(() => {
      const s = window.__farm.getState();
      s.farm.tiles['10,18'] = {
        watered: true,
        crop: { cropId: 'parsnip', stage: 4, daysInStage: 0, regrow: false },
      };
      s.player.x = 10 * 16 + 8;
      s.player.y = 17 * 16 + 11;
      s.player.facing = 'down';
      window.__farm.gameEvents.emit('farmChanged', undefined);
    });
    await page.waitForTimeout(500);
    const shots = capture(page, 30, 1);
    await page.keyboard.down('Space');
    await page.waitForTimeout(90);
    await page.keyboard.up('Space');
    await stitch(page, await shots, 'harvest.png');
    await ctx.close();
  } else if (m === 'walk') {
    const { ctx, page } = await open();
    await place(page, 8, 19, 'right');
    await page.waitForTimeout(400);
    const shots = capture(page, 48, 2);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowRight');
    await stitch(page, await shots, 'walk.png');
    await ctx.close();
  } else if (m === 'till') {
    const { ctx, page } = await open();
    await place(page, 10, 19, 'down');
    await page.evaluate(() => (window.__farm.getState().inventory.selected = 0));
    await page.waitForTimeout(500);
    const shots = capture(page, 30, 1);
    await page.keyboard.down('Space');
    await page.waitForTimeout(90);
    await page.keyboard.up('Space');
    await stitch(page, await shots, 'till.png');
    await ctx.close();
  } else if (m === 'lean') {
    const { ctx, page } = await open();
    await page.evaluate(() => {
      const s = window.__farm.getState();
      for (let x = 8; x < 13; x++)
        s.farm.tiles[`${x},20`] = {
          watered: true,
          crop: { cropId: 'parsnip', stage: 3, daysInStage: 0, regrow: false },
        };
      window.__farm.gameEvents.emit('farmChanged', undefined);
    });
    await place(page, 7, 20, 'right');
    await page.waitForTimeout(500);
    const shots = capture(page, 48, 2);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(900);
    await page.keyboard.up('ArrowRight');
    await stitch(page, await shots, 'lean.png');
    await ctx.close();
  } else if (m === 'toast') {
    const { ctx, page } = await open();
    const shots = capture(page, 30, 2);
    await page.evaluate(() =>
      window.__farm.gameEvents.emit('toast', { text: 'A toast eases in.', kind: 'info' }),
    );
    await stitch(page, await shots, 'toast.png');
    await ctx.close();
  }
}
await browser.close();
