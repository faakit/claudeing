// Generates the app icon + splash source art as pixel art (rendered in headless Chromium), then
// downscales for PWA/Apple use. Output: resources/icon.png (1024), resources/splash.png (2732),
// public/icons/*.png. Re-run after changing the art: `node scripts/make-icons.mjs`.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
mkdirSync('resources', { recursive: true });
mkdirSync('public/icons', { recursive: true });

// 32x32 pixel art, drawn with rects. Palette matches the game's title screen.
const html = `<!doctype html><body style="margin:0;background:#000">
<canvas id="c" width="32" height="32"></canvas>
<script>
const g = document.getElementById('c').getContext('2d');
const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, 1, 1, c); };
const ell = (cx, cy, rx, ry, c) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.05) px(cx + x, cy + y, 1, 1, c); };
// dusk sky
['#2a1f4a','#3d2a5c','#5a3a6a','#8a4a6a','#c0645a','#e08a5a'].forEach((c, i) => px(0, i * 3, 32, i === 5 ? 8 : 4, c));
// sun with halo
disc(24, 12, 7, '#ffd27a'); disc(24, 12, 5, '#f4d35e'); disc(23, 11, 2, '#fff3b0');
// distant hills
for (let x = 0; x < 32; x++) px(x, Math.round(20 - Math.abs(((x + 4) % 18) - 9) * 0.55), 1, 12, '#3b2a52');
// meadow and tilled soil
px(0, 22, 32, 10, '#2c4a3a'); px(0, 22, 32, 1, '#3a6a44');
px(0, 25, 32, 7, '#5e4025');
for (let y = 26; y < 32; y += 2) px(0, y, 32, 1, '#7a5530');
// seedling drawn on its own layer, then outlined
const plant = document.createElement('canvas'); plant.width = plant.height = 32;
const pg = plant.getContext('2d');
const P = (x, y, w, h, c) => { pg.fillStyle = c; pg.fillRect(x, y, w, h); };
const PE = (cx, cy, rx, ry, c) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.05) P(cx + x, cy + y, 1, 1, c); };
P(15, 15, 2, 11, '#4f9a46'); P(16, 15, 1, 11, '#6fbf5a');
PE(11, 18, 4, 2, '#5fae4e'); PE(21, 14, 4, 2, '#5fae4e');
P(8, 17, 3, 1, '#9be37f'); P(18, 13, 3, 1, '#9be37f');
P(11, 19, 3, 1, '#3f8f4a'); P(21, 15, 3, 1, '#3f8f4a');
PE(16, 13, 2, 2, '#7fd36a'); P(15, 12, 2, 1, '#b8f09f');
const src = pg.getImageData(0, 0, 32, 32);
const a = (x, y) => (x < 0 || y < 0 || x > 31 || y > 31 ? 0 : src.data[(y * 32 + x) * 4 + 3]);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) px(x, y, 1, 1, '#241a2a');
g.drawImage(plant, 0, 0);
</script></body>`;

const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
await page.setContent(html);

async function render(size, { pad = 0, bg = null, solidOnly = false, file }) {
  const data = await page.evaluate(
    ([size, pad, bg, solidOnly]) => {
      const src = document.getElementById('c');
      const out = document.createElement('canvas');
      out.width = out.height = size;
      const g = out.getContext('2d');
      g.imageSmoothingEnabled = false; // keep the pixels crisp
      if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, size, size);
      }
      const inner = size - pad * 2;
      if (!solidOnly) g.drawImage(src, pad, pad, inner, inner);
      return out.toDataURL('image/png').split(',')[1];
    },
    [size, pad, bg, solidOnly],
  );
  const { writeFileSync } = await import('node:fs');
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('wrote', file, `${size}x${size}`);
}

await render(1024, { file: 'resources/icon.png' });
// Android adaptive icon layers: launchers mask the central ~61% of the 108dp canvas, so the art
// lives inside that safe zone on a transparent layer, over a solid background layer.
await render(1024, { pad: 41, file: 'resources/icon-foreground.png' });
await render(1024, {
  pad: 0,
  bg: '#2a1f4a',
  solidOnly: true,
  file: 'resources/icon-background.png',
});
await render(512, { file: 'public/icons/icon-512.png' });
await render(192, { file: 'public/icons/icon-192.png' });
await render(180, { file: 'public/icons/apple-touch-icon.png' });
// Maskable: art inside the central 80% safe zone on a solid background, so OS masks never crop it.
await render(512, { pad: 51, bg: '#2a1f4a', file: 'public/icons/icon-maskable-512.png' });
// Splash: art centered on the dusk color (Capacitor assets scales it for every device).
await render(2732, { pad: 1000, bg: '#1b1530', file: 'resources/splash.png' });
await render(2732, { pad: 1000, bg: '#1b1530', file: 'resources/splash-dark.png' });
await browser.close();
