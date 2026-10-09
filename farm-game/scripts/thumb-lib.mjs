// Shared helpers for the one-thumb benchmark and the controls e2e: phone profiles, a preview server, a real-touch
// driver over CDP (the same path a phone's touch events take into Phaser) with a gesture ledger, the game's
// logical <-> CSS mapping, live touch targets, and the thumb-zone model (mirrors src/ui/reach.ts).
//
// Everything here is headless emulation. Nothing in it says how a real hand feels on a real phone.
import { spawn } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { chromium } from 'playwright-core';

export const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

/** Phones (see src/ui/reach.ts; keep in sync, a unit test reads both). */
export const PROFILES = [
  {
    id: 'i13',
    name: 'iPhone 13/14',
    w: 390,
    h: 844,
    dpr: 3,
    ppi: 460,
    chin: 4,
    insets: { top: 47, left: 0, bottom: 34, right: 0 },
    weight: 'primary',
  },
  {
    id: 'pixel7',
    name: 'Pixel 7',
    w: 412,
    h: 915,
    dpr: 2.625,
    ppi: 416,
    chin: 4,
    insets: { top: 24, left: 0, bottom: 0, right: 0 },
    weight: 'primary',
  },
  {
    id: 'se',
    name: 'iPhone SE (16:9)',
    w: 375,
    h: 667,
    dpr: 2,
    ppi: 326,
    chin: 13,
    insets: { top: 20, left: 0, bottom: 0, right: 0 },
    weight: 'hard',
  },
  {
    id: 'promax',
    name: 'iPhone 15 Pro Max',
    w: 430,
    h: 932,
    dpr: 3,
    ppi: 460,
    chin: 4,
    insets: { top: 59, left: 0, bottom: 34, right: 0 },
    weight: 'secondary',
  },
  {
    id: 'fold',
    name: 'Galaxy Fold cover (narrow)',
    w: 280,
    h: 653,
    dpr: 3,
    ppi: 387,
    chin: 4,
    insets: { top: 0, left: 0, bottom: 0, right: 0 },
    weight: 'secondary',
  },
];
export const mmPerCss = (p) => (25.4 / p.ppi) * p.dpr;

export const THUMB = {
  pivotOut: 12,
  pivotUp: 20,
  comfortMin: 25,
  comfortMax: 68,
  stretchMin: 15,
  stretchMax: 85,
};

/** Zone of a CSS point (viewport coords) for a hand ('right' | 'left'). */
export function zoneAt(p, hand, x, y) {
  const k = mmPerCss(p);
  const px = hand === 'right' ? p.w * k + THUMB.pivotOut : -THUMB.pivotOut;
  const py = p.h * k + p.chin - THUMB.pivotUp;
  const d = Math.hypot(x * k - px, y * k - py);
  let zone = 'hard';
  if (d >= THUMB.comfortMin && d <= THUMB.comfortMax) zone = 'comfort';
  else if (d >= THUMB.stretchMin && d <= THUMB.stretchMax) zone = 'stretch';
  return { zone, d: Math.round(d * 10) / 10 };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Start `vite preview` on a port (strict), resolve when it answers. Returns { url, stop }. With `snapshot`, it
 * serves a private copy of dist/ so a long benchmark is not disturbed by a rebuild meanwhile.
 */
export async function startPreview(port, { snapshot = false, from = 'dist' } = {}) {
  const args = ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'];
  if (snapshot) {
    const dir = `.bench-dist/${port}`;
    rmSync(dir, { recursive: true, force: true });
    cpSync(from, dir, { recursive: true });
    args.push('--outDir', dir);
  }
  const server = spawn(process.execPath, args, { stdio: 'ignore' });
  server.on('exit', (code) => {
    if (code) {
      console.error(`preview server exited (${code}): is port ${port} taken?`);
      process.exit(1);
    }
  });
  const stop = () => server.kill();
  process.on('exit', stop);
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* wait */
    }
    await sleep(200);
  }
  return { url, stop };
}

export const launch = () => chromium.launch({ executablePath: CHROMIUM });

/** New game on a phone profile with touch; returns page, CDP session and the canvas geometry. */
export async function openGame(browser, url, p, { leftHanded = false, query = '' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: p.dpr,
    isMobile: true,
    hasTouch: true,
  });
  // Count vibrate calls, so feedback checks can see haptics on the web path.
  await ctx.addInitScript(() => {
    // When each touch event reaches the page (to measure modelled reaction times honestly).
    window.__touchLog = [];
    for (const type of ['touchstart', 'touchmove', 'touchend'])
      window.addEventListener(
        type,
        () => {
          window.__lastTouchT = performance.now();
          window.__touchLog.push({ type, t: window.__lastTouchT });
          if (window.__touchLog.length > 200) window.__touchLog.shift();
        },
        true,
      );
    window.__vibrations = [];
    navigator.vibrate = (pattern) => {
      window.__vibrations.push({ t: performance.now(), pattern });
      return true;
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: p.insets });
  await page.goto(`${url}?debug${query}`);
  await page.waitForFunction(
    () => window.__farm?.game?.scene?.getScene('Title')?.sys.isActive(),
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__farm.game.scene.getScene('UI')?.sys.isActive(), null, {
    timeout: 20000,
  });
  await page.waitForTimeout(1200);
  await page.evaluate((left) => {
    const f = window.__farm;
    const s = f.getState();
    s.stats['tip.welcome'] = 1;
    s.stats.moved = 1; // hide the one-time drag hint so it never covers measurements
    if (s.settings.leftHanded !== left) {
      s.settings.leftHanded = left;
      f.gameEvents.emit('settingsChanged', undefined);
    }
  }, leftHanded);
  await page.waitForTimeout(300);
  const geo = await geometry(page);
  return { ctx, page, cdp, geo, errors };
}

export async function geometry(page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { left: c.left, top: c.top, k: c.width / 200, width: c.width, height: c.height };
  });
}

/** The live dock layout (mirrored for the left hand), straight from the UI scene. */
export const dock = (page) =>
  page.evaluate(() => {
    const L = window.__farm.game.scene.getScene('UI').layout;
    return JSON.parse(JSON.stringify(L));
  });

export const toCss = (geo, lx, ly) => ({ x: geo.left + lx * geo.k, y: geo.top + ly * geo.k });
export const toLogical = (geo, x, y) => ({ x: (x - geo.left) / geo.k, y: (y - geo.top) / geo.k });

/**
 * Real touch input through CDP, with a gesture ledger: taps, holds, drags, and thumb travel (in contact,
 * and in the air between touches). Coordinates are logical (200x400 canvas) px.
 */
export class Thumb {
  constructor(cdp, geo, profile, hand = 'right') {
    this.cdp = cdp;
    this.geo = geo;
    this.p = profile;
    this.hand = hand;
    this.reset();
  }
  reset() {
    this.taps = 0;
    this.holds = 0;
    this.drags = 0;
    this.contact = 0;
    this.air = 0;
    this.last = null;
    this.downT = 0;
    this.pathLen = 0;
    this.zones = { comfort: 0, stretch: 0, hard: 0 };
    this.corrections = 0;
    this.toolChanges = 0;
    /** Taps repeated because the first missed its target (aim spread). */
    this.retries = 0;
    /** Measured ms from the moment the bot "saw" its stop point to the stick release reaching the page. */
    this.releases = [];
  }
  ledger() {
    const k = mmPerCss(this.p);
    return {
      taps: this.taps,
      holds: this.holds,
      drags: this.drags,
      gestures: this.taps + this.holds + this.drags,
      contactMm: Math.round(this.contact * k),
      airMm: Math.round(this.air * k),
      travelMm: Math.round((this.contact + this.air) * k),
      corrections: this.corrections,
      toolChanges: this.toolChanges,
      retries: this.retries,
      releaseMs: this.releases.length
        ? Math.round(this.releases.reduce((a, b) => a + b, 0) / this.releases.length)
        : null,
      touchZones: { ...this.zones },
    };
  }
  async send(type, x, y) {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }],
    });
  }
  async down(lx, ly) {
    const { x, y } = toCss(this.geo, lx, ly);
    this.zones[zoneAt(this.p, this.hand, x, y).zone]++;
    if (this.last) this.air += Math.hypot(x - this.last.x, y - this.last.y);
    this.last = { x, y };
    this.downT = Date.now();
    this.pathLen = 0;
    await this.send('touchStart', x, y);
  }
  async move(lx, ly) {
    const { x, y } = toCss(this.geo, lx, ly);
    const d = Math.hypot(x - this.last.x, y - this.last.y);
    this.contact += d;
    this.pathLen += d;
    this.last = { x, y };
    await this.send('touchMove', x, y);
  }
  async up() {
    await this.send('touchEnd', 0, 0);
    const ms = Date.now() - this.downT;
    const moved = this.pathLen / this.geo.k;
    if (moved > 8) this.drags++;
    else if (ms > 250) this.holds++;
    else this.taps++;
  }
  async tap(lx, ly, holdMs = 60) {
    await this.down(lx, ly);
    await sleep(holdMs);
    await this.up();
  }
  async hold(lx, ly, ms) {
    await this.down(lx, ly);
    await sleep(ms);
    await this.up();
  }
  /**
   * Straight drag at a true speed: each move goes where the finger would be after the real elapsed time,
   * so a slow CDP round trip (about 40 ms a move headless) never turns a 300 ms swipe into a 1 s crawl.
   */
  async timedDrag(lx0, ly0, lx1, ly1, ms, keepDown = false) {
    await this.down(lx0, ly0);
    const t0 = Date.now();
    for (;;) {
      const f = Math.min(1, (Date.now() - t0) / ms);
      await this.move(lx0 + (lx1 - lx0) * f, ly0 + (ly1 - ly0) * f);
      if (f >= 1) break;
      await sleep(4);
    }
    if (!keepDown) await this.up();
  }
  /** Straight drag in `steps` moves over `ms`. */
  async drag(lx0, ly0, lx1, ly1, ms = 200, steps = 8, keepDown = false) {
    await this.down(lx0, ly0);
    for (let i = 1; i <= steps; i++) {
      await this.move(lx0 + ((lx1 - lx0) * i) / steps, ly0 + ((ly1 - ly0) * i) / steps);
      await sleep(ms / steps);
    }
    if (!keepDown) await this.up();
  }
}

/**
 * Every enabled, visible touch target in the UI scene, in logical px, with a readable name.
 * Full-screen dims (tap-outside-to-close) are skipped.
 */
export async function liveTargets(page) {
  return page.evaluate(() => {
    const ui = window.__farm.game.scene.getScene('UI');
    const visible = (o) => {
      for (let n = o; n; n = n.parentContainer) if (!n.visible || n.alpha === 0) return false;
      return true;
    };
    const textOf = (container) => {
      if (!container) return '';
      const out = [];
      const walk = (n) => {
        if (n.main?.text) out.push(n.main.text);
        else if (n.list) n.list.forEach(walk);
      };
      walk(container);
      return out.join(' ').trim();
    };
    const names = new Map();
    const [action, interact, menu] = ui.controls ?? [];
    if (action) names.set(action.zone, 'ACTION');
    if (interact) names.set(interact.zone, 'INTERACT');
    if (menu) names.set(menu.zone, 'MENU');
    (ui.hud?.hotbarZones ?? []).forEach((z, i) => names.set(z, `slot ${i + 1}`));
    const modalOpen = ui.allModals().some((m) => m.isOpen);
    const topDepth = (o) => {
      let n = o;
      while (n.parentContainer) n = n.parentContainer;
      return n.depth;
    };
    const res = [];
    for (const o of ui.input._list) {
      if (!o.input?.enabled || !visible(o)) continue;
      if (modalOpen && topDepth(o) < 200) continue;
      const b = o.getBounds();
      const h = o.input.hitArea;
      let shape = 'rect';
      let w = b.width;
      let ht = b.height;
      if (h && h.radius) {
        shape = 'circle';
        w = ht = h.radius * 2;
      }
      if (b.width >= 199 && b.height >= 300) continue; // backdrop dims
      const text =
        names.get(o) ?? (o.parentContainer?.zone === o ? textOf(o.parentContainer) : '') ?? '';
      res.push({
        x: b.x,
        y: b.y,
        w,
        h: ht,
        cx: b.x + b.width / 2,
        cy: b.y + b.height / 2,
        shape,
        depth: o.depth,
        text: text || (o.width === 23 ? 'bag cell' : 'surface'),
        type: o.type,
      });
    }
    return res;
  });
}

/** Screen (logical) centre of a world tile, from the live camera. */
export const tileScreen = (page, tx, ty) =>
  page.evaluate(
    ({ tx, ty }) => {
      const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
      const c = w.cameras.main;
      return { x: tx * 16 + 8 - c.scrollX + c.x, y: ty * 16 + 8 - c.scrollY + c.y };
    },
    { tx, ty },
  );
