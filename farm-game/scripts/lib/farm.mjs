// The shared test library: open a scenario on a phone profile and hand, touch tiles and buttons by name, wait on
// game events (never fixed timeouts), take named screenshots and frame strips. Use it for e2e checks, probes and
// critic reviews instead of copying setup code. Built on scripts/thumb-lib.mjs (profiles, real CDP touches).
//
//   import { serve, launch, openScenario, checker } from './lib/farm.mjs';
//   const { url, stop } = await serve(4830);            // vite preview of dist/ (or URL=http://localhost:5195/)
//   const browser = await launch();
//   const farm = await openScenario(browser, url, 'ripe-plot', { profile: 'i13', hand: 'right' });
//   const act = await farm.act();                       // press Action, resolve on the action's result
//   await farm.tapButton('INTERACT');                   // a real touch on the live button
//   await farm.panel('bin');                            // the bin sheet is open and settled
//   await farm.shot('bin-open');                        // agents/out/shots/bin-open.png (SHOTS=<dir> to move)
//
// Headless emulation only: it proves flows and layout, never how a real hand feels on a real phone.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROFILES,
  Thumb,
  dock,
  geometry,
  launch as launchChromium,
  liveTargets,
  startPreview,
} from '../thumb-lib.mjs';

export { PROFILES, Thumb, dock, liveTargets };

/** A Chromium (CHROMIUM_PATH). */
export const launch = launchChromium;

/** The phone profile by id ('i13', 'pixel7', 'se', 'promax', 'fold'). */
export function profile(id) {
  const p = PROFILES.find((x) => x.id === id);
  if (!p) throw new Error(`unknown profile "${id}" (have ${PROFILES.map((x) => x.id).join(', ')})`);
  return p;
}

/**
 * Serve the game: `vite preview` of dist/ on `port` (run `npm run build` first), or the running server at
 * env URL (e.g. the dev server, URL=http://localhost:5195/). Returns { url, stop }.
 */
export async function serve(port) {
  if (process.env.URL) return { url: process.env.URL.replace(/\/?$/, '/'), stop: () => {} };
  return startPreview(port);
}

/** PASS/FAIL lines and a count, the format every suite prints. */
export function checker(prefix = '') {
  const c = {
    failed: 0,
    passed: 0,
    check(name, ok, detail = '') {
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${prefix}${name}${ok ? '' : `  ${detail}`}`);
      if (ok) c.passed++;
      else c.failed++;
      return ok;
    },
  };
  return c;
}

const SHOTS = process.env.SHOTS ?? 'agents/out/shots';

/** A game page opened on a scenario. Every wait resolves on game state, never on a fixed delay. */
export class Farm {
  constructor({ ctx, page, cdp, geo, p, hand, errors, scenario }) {
    Object.assign(this, { ctx, page, cdp, geo, profile: p, hand, errors, scenario });
    this.thumb = new Thumb(cdp, geo, p, hand);
  }

  /** Evaluate in the page (shorthand for page.evaluate). */
  eval(fn, arg) {
    return this.page.evaluate(fn, arg);
  }

  /** The game state, as plain JSON. */
  state() {
    return this.eval(() => JSON.parse(JSON.stringify(window.__farm.getState())));
  }

  /** Change the state in the page: `fn(state, farmHook)` runs there. */
  mutate(fn, arg) {
    return this.eval(
      ({ src, arg }) => {
        const f = new Function(`return (${src})`)();
        return f(window.__farm.getState(), window.__farm, arg);
      },
      { src: fn.toString(), arg },
    );
  }

  /**
   * Start a dev wait in the page (`window.__farm.dev.wait[name](...args)`), run `trigger`, then resolve with the
   * wait's result. Starting first means a quick event can never slip past between the trigger and the wait.
   */
  async during(name, args = [], trigger = null) {
    const id = await this.eval(
      ([n, a]) => {
        const k = `w${Math.random().toString(36).slice(2)}`;
        const p = window.__farm.dev.wait[n](...a);
        (window.__devWaits ??= {})[k] = p;
        p.catch(() => {});
        return k;
      },
      [name, args],
    );
    if (trigger) await trigger();
    return this.eval((k) => window.__devWaits[k].finally(() => delete window.__devWaits[k]), id);
  }

  /**
   * Wait until `fn(state, farmHook, arg)` (run in the page once per frame) returns something truthy; resolves
   * with it. `what` names the wait in the timeout message.
   */
  until(fn, arg, what = 'a condition', timeout = 10000) {
    return this.eval(
      ({ src, arg, what, timeout }) => {
        const f = new Function(`return (${src})`)();
        const w = window.__farm;
        return w.dev.wait.until(() => f(w.getState(), w, arg), what, { timeout });
      },
      { src: fn.toString(), arg, what, timeout },
    );
  }

  /** Wait until the world is ready (optionally a given scene: 'Farm', 'Town', 'Lab'...). */
  ready(scene) {
    return this.during('sceneReady', scene ? [scene] : []);
  }

  /** Wait until a sheet is open and settled ('bin', 'npc', 'menu', 'fishing'...; any when omitted). */
  panel(name) {
    return this.during('panelOpen', name ? [name] : []);
  }

  panelClosed() {
    return this.during('panelClosed');
  }

  /** Wait until nothing moves for a few frames (walks, routes, swings, sheets, doors). */
  idle(frames = 3) {
    return this.during('idle', [frames]);
  }

  /** Wait n rendered frames. */
  frames(n = 1) {
    return this.during('frames', [n]);
  }

  /** The next game event of that name (`trigger` runs after the wait starts). */
  event(name, trigger) {
    return this.during('event', [name], trigger);
  }

  /** A key press with a short real hold (as a finger or a key would). */
  async press(key, holdMs = 60) {
    await this.page.keyboard.down(key);
    await new Promise((r) => setTimeout(r, holdMs));
    await this.page.keyboard.up(key);
  }

  /** Press Action (Space) and resolve with its result: { ok, marked, used }. */
  act(key = 'Space') {
    return this.during('actionDone', [], () => this.press(key));
  }

  /** Press Interact (E), then wait until the world is idle again. */
  async interact() {
    await this.press('KeyE');
    await this.idle();
  }

  /** Select a hotbar slot (0-based) the way a keyboard does. */
  async select(slot) {
    await this.press(`Digit${slot + 1}`);
    await this.frames(1);
  }

  /** Logical screen point of a world tile's centre (live camera). */
  tileScreen(tx, ty) {
    return this.eval(([x, y]) => window.__farm.dev.tileToScreen(x, y), [tx, ty]);
  }

  /** A real touch tap on a world tile. */
  async tapTile(tx, ty, holdMs = 60) {
    const p = await this.tileScreen(tx, ty);
    if (!p) throw new Error('no world scene to tap');
    await this.thumb.tap(p.x, p.y, holdMs);
  }

  /** Every live touch target (name, centre, size), as thumb-lib reads them. */
  targets() {
    return liveTargets(this.page);
  }

  /**
   * A real touch tap on a button by name: 'ACTION', 'INTERACT', 'MENU', 'slot 3', or a button's text (a string
   * matches case-insensitively as a substring; a RegExp is tested as is).
   */
  async tapButton(name, holdMs = 60) {
    const all = await this.targets();
    const test =
      name instanceof RegExp
        ? (t) => name.test(t)
        : (t) => t.toLowerCase().includes(name.toLowerCase());
    const hit = all.find((t) => t.text === name) ?? all.find((t) => test(t.text));
    if (!hit)
      throw new Error(
        `no button "${name}" (have: ${[...new Set(all.map((t) => t.text))].join(', ')})`,
      );
    await this.thumb.tap(hit.cx, hit.cy, holdMs);
    return hit;
  }

  /** The open sheet's name (once settled), or null. */
  openSheet() {
    return this.eval(() => window.__farm.dev.openSheet());
  }

  /** Save a named screenshot (PNG) under SHOTS (default agents/out/shots). Returns the path. */
  async shot(name, dir = SHOTS) {
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${name}.png`);
    await this.page.screenshot({ path });
    return path;
  }

  /**
   * A frame strip: freeze the engine and save `count` screenshots, `every` frames apart (16.7 ms each), so an
   * animation is captured exactly and repeatably. The loop resumes afterwards. Returns the paths.
   */
  async strip(name, count = 6, every = 4, dir = SHOTS) {
    mkdirSync(dir, { recursive: true });
    const paths = [];
    await this.eval(() => window.__farm.dev.loop.pause());
    try {
      for (let i = 0; i < count; i++) {
        if (i) await this.eval((n) => window.__farm.dev.loop.step(n), every);
        const path = join(dir, `${name}-${String(i).padStart(2, '0')}.png`);
        await this.page.screenshot({ path });
        paths.push(path);
      }
    } finally {
      await this.eval(() => window.__farm.dev.loop.resume());
    }
    return paths;
  }

  /** Switch this page to another scenario (no reload) and wait until it is ready. */
  async load(name) {
    this.scenario = name;
    await this.eval((n) => window.__farm.dev.load(n), name);
    if (await this.onTitle()) return; // a title scenario (dev.title) stops on the title screen
    // A scenario restarts the world scene behind the map-change wipe; input is ignored until it has opened.
    await this.eval(() => window.__farm.dev.wait.sceneReady());
  }

  /** The title screen is up (a `dev.title` scenario, such as title-first-launch, stops there). */
  onTitle() {
    return this.eval(() => window.__farm.game.scene.isActive('Title'));
  }

  close() {
    return this.ctx.close();
  }
}

/**
 * Open a scenario on a phone profile, touch enabled, safe-area insets set. Resolves once the scenario's world is
 * ready. `hand: 'left'` turns on left-handed mode. `query` adds URL parameters (e.g. '&skin=plum').
 */
export async function openScenario(browser, url, scenario, opts = {}) {
  const p = typeof opts.profile === 'object' ? opts.profile : profile(opts.profile ?? 'i13');
  const hand = opts.hand ?? 'right';
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: p.dpr,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(() => {
    window.__vibrations = [];
    navigator.vibrate = (pattern) => {
      window.__vibrations.push({ t: performance.now(), pattern });
      return true;
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // the dry tileset's safety net (src/art/dryTiles.ts) is a warning in the game and a failure here
    if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('safety net')))
      errors.push(m.text());
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: p.insets });
  await page.goto(`${url}?debug&scenario=${encodeURIComponent(scenario)}${opts.query ?? ''}`);
  await page.waitForFunction(
    () => window.__farm?.dev && window.__farm.dev.readyState !== 'installing',
    null,
    {
      timeout: opts.timeout ?? 30000,
    },
  );
  const err = await page.evaluate(() => window.__farm.dev.error);
  if (err) throw new Error(`scenario "${scenario}" did not start: ${err}`);
  if (hand === 'left')
    await page.evaluate(() => {
      const f = window.__farm;
      if (!f.getState().settings.leftHanded) {
        f.getState().settings.leftHanded = true;
        f.gameEvents.emit('settingsChanged', undefined);
      }
    });
  const geo = await geometry(page);
  const farm = new Farm({ ctx, page, cdp, geo, p, hand, errors, scenario });
  if (!(await farm.onTitle())) await farm.ready();
  return farm;
}
