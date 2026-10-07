// Phone-profile checks (portrait, one-handed) on the production build: safe-area insets (notch), canvas fit, real
// touch-target sizes, and the landscape "turn upright" overlay. Run `npm run build` first.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4178;
const BASE = `http://localhost:${PORT}/`;
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const MIN_TOUCH_CSS = 44;

// CSS-pixel viewport, device pixel ratio, and notch/home-indicator safe-area insets (portrait).
const PROFILES = [
  {
    name: 'iPhone 13/14 (notch)',
    w: 390,
    h: 844,
    dpr: 3,
    insets: { top: 47, left: 0, bottom: 34, right: 0 },
  },
  {
    name: 'iPhone 15 Pro Max',
    w: 430,
    h: 932,
    dpr: 3,
    insets: { top: 59, left: 0, bottom: 34, right: 0 },
  },
  { name: 'Pixel 7', w: 412, h: 915, dpr: 2.6, insets: { top: 24, left: 0, bottom: 0, right: 0 } },
  {
    name: 'Android punch-hole',
    w: 393,
    h: 851,
    dpr: 2.75,
    insets: { top: 36, left: 0, bottom: 0, right: 0 },
  },
  {
    name: 'iPhone SE (16:9, small)',
    w: 375,
    h: 667,
    dpr: 2,
    insets: { top: 20, left: 0, bottom: 0, right: 0 },
  },
  {
    name: 'Galaxy Fold (narrow)',
    w: 280,
    h: 653,
    dpr: 3,
    insets: { top: 0, left: 0, bottom: 0, right: 0 },
  },
];

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
process.on('exit', () => server.kill());
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* wait */
  }
  await new Promise((r) => setTimeout(r, 200));
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({ executablePath: CHROMIUM });
const rows = [];
try {
  for (const p of PROFILES) {
    const ctx = await browser.newContext({
      viewport: { width: p.w, height: p.h },
      deviceScaleFactor: p.dpr,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: p.insets });
    await page.goto(`${BASE}?debug`);
    await page.waitForTimeout(1500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);

    const m = await page.evaluate(() => {
      const c = document.querySelector('canvas').getBoundingClientRect();
      const ui = window.__farm.game.scene.getScene('UI');
      const k = ui.scale.displaySize.width / 200; // CSS px per logical px
      const sizes = [];
      for (const o of ui.children.list) {
        if (o.type !== 'Zone' || !o.input?.enabled) continue;
        const h = o.input.hitArea;
        const w = h.radius ? h.radius * 2 : h.width;
        const ht = h.radius ? h.radius * 2 : h.height;
        sizes.push({ w: w * k, h: ht * k });
      }
      return {
        rect: { l: c.left, t: c.top, r: c.right, b: c.bottom },
        k,
        sizes,
        vw: innerWidth,
        vh: innerHeight,
        errors: 0,
      };
    });
    const minTouch = Math.min(...m.sizes.flatMap((s) => [s.w, s.h]));
    rows.push({
      device: p.name,
      'css px per logical': m.k.toFixed(2),
      'smallest touch target (css px)': minTouch.toFixed(0),
      controls: m.sizes.length,
    });

    const inset = p.insets;
    const eps = 1.5;
    check(
      `${p.name}: canvas stays inside the notch safe area`,
      m.rect.l >= inset.left - eps &&
        m.rect.r <= m.vw - inset.right + eps &&
        m.rect.t >= inset.top - eps &&
        m.rect.b <= m.vh - inset.bottom + eps,
      JSON.stringify({ rect: m.rect, inset }),
    );
    check(
      `${p.name}: canvas keeps its 1:2 portrait shape`,
      Math.abs((m.rect.r - m.rect.l) / (m.rect.b - m.rect.t) - 1 / 2) < 0.02,
    );
    // Phones from ~680 CSS px wide up must meet the 44px guideline; smaller ones are reported only.
    // Modern phones must meet the 44px guideline (1px of rounding slack); small ones a looser bar;
    // very narrow devices (foldables closed) are reported in the table only.
    const required = p.w >= 390 ? MIN_TOUCH_CSS - 1 : p.w >= 360 ? 38 : 0;
    if (required > 0) {
      check(
        `${p.name}: every touch target >= ${required} css px`,
        minTouch >= required,
        `smallest ${minTouch.toFixed(1)}`,
      );
    }
    check(`${p.name}: no console errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // Landscape phones are asked to turn upright.
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(800);
  check(
    'landscape phone shows the turn-upright overlay',
    await page.evaluate(
      () => getComputedStyle(document.querySelector('#rotate')).display !== 'none',
    ),
  );
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
}
console.table(rows);
console.log(failed === 0 ? '\nMOBILE E2E OK' : `\nMOBILE E2E FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
