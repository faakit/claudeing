// Shared helpers for the controls measurements: phone profiles, a real-touch driver over CDP, the game's
// logical <-> CSS mapping, an enumerator for every live touch target, and a thumb-zone model.
//
// Everything here is headless emulation. Nothing in it says how a real hand feels on a real phone.
import { chromium } from 'playwright-core';

export const URL = process.env.URL ?? 'http://localhost:5179/';
export const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
export const OUT = process.env.OUT ?? 'agents/out/controls/';

/**
 * Phone profiles. `ppi` and `dpr` give the physical size of a CSS px (mm), which the thumb model needs:
 * reach is physical, not pixels. `chin` is the body below the screen in mm (home button on the SE).
 */
export const PROFILES = [
  {
    id: 'se',
    name: 'iPhone SE (16:9)',
    w: 375,
    h: 667,
    dpr: 2,
    ppi: 326,
    chin: 13,
    insets: { top: 20, left: 0, bottom: 0, right: 0 },
  },
  {
    id: 'i13',
    name: 'iPhone 13/14',
    w: 390,
    h: 844,
    dpr: 3,
    ppi: 460,
    chin: 4,
    insets: { top: 47, left: 0, bottom: 34, right: 0 },
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
  },
];
export const mmPerCss = (p) => (25.4 / p.ppi) * p.dpr;

/**
 * One-handed portrait thumb model (see PLAN-CONTROLS.md, "Reach model", for sources and limits).
 * The thumb pivots near its base (CMC joint), which sits just off the holding edge of the phone, a little
 * above the bottom of the body. Reach is an annulus around that pivot: too close and the thumb has to fold
 * (stretch), too far and the grip must shift (stretch, then hard). Distances in mm.
 */
export const THUMB = {
  pivotOut: 12, // mm outside the holding edge of the screen
  pivotUp: 20, // mm above the bottom of the phone body
  comfortMin: 25, // Karlson: the corner by the thumb base is awkward because it is too close
  comfortMax: 68, // Le et al. CHI 2018: comfortable thumb area ~36 cm2, a quarter disc of r ~68 mm
  stretchMin: 15,
  stretchMax: 85,
};

/** Zone of a CSS point (viewport coords) for a hand ('right' | 'left'). */
export function zoneAt(p, hand, x, y) {
  const k = mmPerCss(p);
  const xm = x * k;
  const ym = y * k;
  const wm = p.w * k;
  const bottom = p.h * k + p.chin;
  const px = hand === 'right' ? wm + THUMB.pivotOut : -THUMB.pivotOut;
  const py = bottom - THUMB.pivotUp;
  const d = Math.hypot(xm - px, ym - py);
  let zone = 'hard';
  if (d >= THUMB.comfortMin && d <= THUMB.comfortMax) zone = 'comfort';
  else if (d >= THUMB.stretchMin && d <= THUMB.stretchMax) zone = 'stretch';
  return { zone, d: Math.round(d * 10) / 10 };
}

export async function launch() {
  return chromium.launch({ executablePath: CHROMIUM });
}

/** New game on a phone profile with touch; returns page, CDP session and the canvas geometry. */
export async function openGame(browser, p, { leftHanded = false, query = '' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: p.dpr,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: p.insets });
  await page.goto(`${URL}?debug${query}`);
  await page.waitForFunction(
    () => window.__farm?.game?.scene?.getScene('Title')?.sys.isActive(),
    null,
    {
      timeout: 20000,
    },
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
    // frame clock + touch log for latency measurements
    window.__frame = () => f.game.loop.frame;
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

export const toCss = (geo, lx, ly) => ({ x: geo.left + lx * geo.k, y: geo.top + ly * geo.k });
export const toLogical = (geo, x, y) => ({ x: (x - geo.left) / geo.k, y: (y - geo.top) / geo.k });

/**
 * Real touch input through CDP (the same path a phone's touch events take into Phaser), with a gesture
 * ledger: taps, holds, drags, and thumb travel (in contact, and in the air between touches).
 */
export class Thumb {
  constructor(cdp, geo, profile) {
    this.cdp = cdp;
    this.geo = geo;
    this.p = profile;
    this.reset();
  }
  reset() {
    this.taps = 0;
    this.holds = 0;
    this.drags = 0;
    this.contact = 0; // css px travelled while touching
    this.air = 0; // css px between lifting and the next touch
    this.last = null;
    this.downAt = null;
    this.downT = 0;
    this.pathLen = 0;
    this.log = [];
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
    };
  }
  async send(type, x, y) {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 }],
    });
  }
  /** Logical coordinates in, CSS out. */
  async down(lx, ly) {
    const { x, y } = toCss(this.geo, lx, ly);
    if (this.last) this.air += Math.hypot(x - this.last.x, y - this.last.y);
    this.last = { x, y };
    this.downAt = { x, y };
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
    const moved = this.pathLen / this.geo.k; // logical
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

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Every enabled, visible touch target in the UI scene, in logical px, with a readable name.
 * Full-screen dims (tap-outside-to-close) are reported separately.
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
      // An open sheet's dim swallows every touch below it: only the sheet's own targets count.
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
      res.push({
        x: b.x,
        y: b.y,
        w,
        h: ht,
        cx: b.x + b.width / 2,
        cy: b.y + b.height / 2,
        shape,
        depth: o.depth,
        text:
          names.get(o) ?? (o.parentContainer?.zone === o ? textOf(o.parentContainer) : '') ?? '',
        type: o.type,
      });
      if (!res[res.length - 1].text)
        res[res.length - 1].text = o.width === 23 ? 'bag cell' : 'surface';
    }
    return res;
  });
}
