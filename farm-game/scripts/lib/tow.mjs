// Towing played like a person (M7 spike, feel lane), for the scenario e2e and agents/probes/tow-spike.mjs: real
// CDP touches with gaussian thumb scatter (SIGMA_MM, default 1.5 mm), a reaction before each decision (counted in
// frames: 27 frames, 450 ms at 60 Hz), and the critic's bar measured per run (feel-critique/review-6.md):
// landed, first input to landing, inputs, draws while towing, game JS per frame, the thumb zone of every tap, taps
// the game ignored (controls log 'silent'), stalls (idle with a tow goal and a free log for 1.5 s), and the log
// never off the water.
//
// Strategies (as the critic's tools/dry/tow2.mjs):
//   wait    tap the log; once hooked, tap the slip (or toward it, when it is off screen)
//   chain   tap the log, then 400 ms later, while the walk to hook scrolls the camera, tap toward the slip (or
//           `chainTile`: the e2e taps two tiles east of the spike's slip, the critic's T1 tap)
//   water   as wait, but tap the water by the slip
//   action  Action only: hook, home, tug
// Tug: the right hand taps the log, the left hand presses Action (TUG overrides).
import { mmPerCss, zoneAt } from '../thumb-lib.mjs';

/** Rows of the world a tap can reach (game px): below the HUD, above the floating controls (config WORLD_CLEAR). */
const CLEAR = { top: 74, bottom: 288 };

export async function playTow(farm, opts = {}) {
  const strategy = opts.strategy ?? 'wait';
  const hand = farm.hand;
  const tugBy = opts.tug ?? (hand === 'right' ? 'tap' : 'action');
  const reactFrames = opts.reactFrames ?? 27;
  const limitMs = opts.limitMs ?? 40000;
  let seed = opts.seed ?? 12345;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const sigma = (opts.sigmaMm ?? 1.5) / mmPerCss(farm.profile) / farm.geo.k;
  const taps = [];

  // the page records every frame until the log lands: draws and JS while towing, and any frame off the water
  const rec = farm.eval(async (limit) => {
    const w = window.__farm;
    const g = w.game;
    const lab = g.scene.getScene('Lab');
    const out = {
      draws: 0,
      jsMax: 0,
      js: [],
      gapMax: 0,
      over33: 0,
      offWater: [],
      frames: 0,
      slow: [],
    };
    let t0 = 0;
    let last = 0;
    const pre = () => (t0 = performance.now());
    const post = () => {
      const t = w.dev.tow();
      if (!t) return;
      const now = performance.now();
      if (['towing', 'hauling'].includes(t.phase)) {
        const js = now - t0;
        out.js.push(js);
        if (js > 25 && out.slow.length < 6)
          out.slow.push(
            `${js.toFixed(0)}ms ${t.phase}/${t.state} tugs ${t.tugs} snag ${t.log.snagged}`,
          );
        out.jsMax = Math.max(out.jsMax, js);
        out.draws = Math.max(out.draws, w.dev.frameStats().draws);
        if (last) {
          out.gapMax = Math.max(out.gapMax, now - last);
          if (now - last > 33.4) out.over33++;
        }
        out.frames++;
      }
      last = now;
      if (['drift', 'hooking', 'towing', 'hauling'].includes(t.phase)) {
        const tx = Math.floor(t.log.x / 16);
        const ty = Math.floor(t.log.y / 16);
        if (!lab.tow.world.water(tx, ty) && out.offWater.length < 5)
          out.offWater.push([t.phase, tx, ty]);
      }
    };
    g.events.on('prestep', pre);
    g.events.on('postrender', post);
    try {
      await w.dev.wait.until(() => w.dev.tow()?.landed > 0, 'landed', { timeout: limit });
    } catch {
      /* the player side reports the timeout */
    } finally {
      g.events.off('prestep', pre);
      g.events.off('postrender', post);
    }
    const s = [...out.js].sort((a, b) => a - b);
    out.jsP95 = s.length ? +s[Math.floor(0.95 * (s.length - 1))].toFixed(1) : 0;
    delete out.js;
    out.jsMax = +out.jsMax.toFixed(1);
    out.gapMax = +out.gapMax.toFixed(1);
    return out;
  }, limitMs + 5000);

  let lastL = null;
  const look = async () => (lastL = await lookNow());
  const lookNow = () =>
    farm.eval(() => {
      const w = window.__farm;
      const lab = w.game.scene.getScene('Lab');
      const c = lab.cameras.main;
      const t = w.dev.tow();
      return {
        t,
        walking: !!lab.walking,
        lock: lab.actionLock,
        cam: { x: c.x, y: c.y, sx: c.scrollX, sy: c.scrollY, w: c.width },
        lane: lab.tow?.lane ?? null,
      };
    });
  const toScreen = (L, wx, wy) => ({ x: wx - L.cam.sx + L.cam.x, y: wy - L.cam.sy + L.cam.y });
  // the floating controls (Action, Interact, Menu, the hotbar) cover some of the world: never aim a world tap there
  await farm.frames(3); // a left hand's mirrored layout is in place
  const controls = (await farm.targets()).map((c) => ({ ...c, w: c.w ?? 0, h: c.h ?? 0 }));
  // a person aims a world tap well clear of a button (2.5 sigma of their scatter), or it lands on the button
  const underControl = (s, m = Math.max(6, 2.5 * sigma)) =>
    controls.some(
      (c) => Math.abs(s.x - c.cx) <= c.w / 2 + m && Math.abs(s.y - c.cy) <= c.h / 2 + m,
    );
  const inClear = (s, m = 8) =>
    s.x >= m &&
    s.x <= 200 - m &&
    s.y >= CLEAR.top + m &&
    s.y <= CLEAR.bottom - m &&
    !underControl(s);
  const tap = async (lx, ly, what) => {
    const x = lx + gauss() * sigma;
    const y = ly + gauss() * sigma;
    const css = { x: farm.geo.left + x * farm.geo.k, y: farm.geo.top + y * farm.geo.k };
    const z = zoneAt(farm.profile, hand, css.x, css.y);
    const at = lastL?.cam
      ? [
          Math.floor((x - lastL.cam.x + lastL.cam.sx) / 16),
          Math.floor((y - lastL.cam.y + lastL.cam.sy) / 16),
        ]
      : null;
    taps.push({
      what,
      zone: z.zone,
      mm: z.d,
      off: +Math.hypot(x - lx, y - ly).toFixed(1),
      at,
      screen: [Math.round(x), Math.round(y)],
      phase: lastL?.t?.phase,
    });
    await farm.thumb.tap(x, y, 70);
  };
  const action = async (what) => {
    const a = (await farm.targets()).find((t) => t.text === 'ACTION');
    const before = (await look()).t.actions;
    await tap(a.cx, a.cy, what);
    // the press lands, and Action's lock ends, before the next decision (a missed press is just an input)
    await farm
      .until(
        (_s, w, n) => w.dev.tow()?.actions > n && w.game.scene.getScene('Lab').actionLock <= 0,
        before,
        'the Action press',
        1500,
      )
      .catch(() => {});
  };
  const tapTile = async (L, tx, ty, what) => {
    const s = toScreen(L, tx * 16 + 8, ty * 16 + 8);
    await tap(s.x, s.y, what);
  };
  /** Toward the slip: the slip (or its water) when it is in the clear world; else the lane's water nearest it. */
  const towardSlip = async (L) => {
    const slip = strategy === 'water' ? L.t.slip.water : L.t.slip.bank;
    const s = toScreen(L, slip.tx * 16 + 8, slip.ty * 16 + 8);
    if (inClear(s)) return tap(s.x, s.y, 'slip');
    let best = null;
    for (const [rx, ry, rw, rh] of L.lane.water)
      for (let ty = ry; ty < ry + rh; ty++)
        for (let tx = rx; tx < rx + rw; tx++) {
          const p = toScreen(L, tx * 16 + 8, ty * 16 + 8);
          if (!inClear(p, 12)) continue;
          const d = Math.abs(tx - L.t.slip.water.tx) + Math.abs(ty - L.t.slip.water.ty);
          if (!best || d < best.d) best = { d, p };
        }
    if (best) return tap(best.p.x, best.p.y, 'toward');
  };

  const t0 = Date.now();
  let status = 'timeout';
  let stalls = 0;
  let idleSince = null;
  let logTaps = 0;
  let chained = false;
  /** The chained tap meant the slip (the e2e's T1 tap): from then on an idle farmer is a stall, not a cue to tap. */
  let chainSlip = false;
  await farm.eval(() => window.__farm.controls?.clear?.());
  await farm.frames(reactFrames); // find the log
  while (Date.now() - t0 < limitMs) {
    const L = await look();
    const t = L.t;
    if (!t) {
      status = 'no tow';
      break;
    }
    if (t.landed > 0) {
      status = 'ok';
      break;
    }
    if (t.phase === 'drift' || (t.phase === 'hooking' && !L.walking)) {
      if (logTaps > 0) await farm.frames(reactFrames); // a missed first tap: look again, then retry
      logTaps++;
      if (strategy === 'action') {
        if (t.verb === 'hook') await action('a-hook');
        else await farm.frames(6);
      } else {
        const s = toScreen(L, t.log.x, t.log.y);
        if (inClear(s, 4)) {
          await tap(s.x, s.y, 'log');
          if (strategy === 'chain' && !chained) {
            chained = true;
            await farm.frames(24); // 400 ms: the walk to hook is scrolling the camera now
            const L2 = await look();
            if (opts.chainTile) {
              chainSlip = true;
              await tapTile(L2, opts.chainTile.tx, opts.chainTile.ty, 'chain');
            } else await towardSlip(L2);
          }
        } else await farm.frames(6);
      }
      await farm
        .until((_s, w) => w.dev.tow()?.phase !== 'drift', null, 'the hook walk', 1000)
        .catch(() => {});
      continue;
    }
    if (t.log.snagged) {
      idleSince = null;
      await farm.frames(reactFrames);
      const L2 = await look();
      if (!L2.t.log.snagged) continue;
      const n = L2.t.tugs;
      if (tugBy === 'action' || strategy === 'action') await action('tug');
      else {
        const s = toScreen(L2, L2.t.log.x, L2.t.log.y);
        await tap(s.x, s.y, 'tug');
      }
      await farm.until((_s, w, k) => w.dev.tow()?.tugs > k, n, 'the tug', 1500).catch(() => {});
      continue;
    }
    if (t.phase === 'towing' && !L.walking && !chainSlip) {
      // idle with a free hooked log: a goal he has not reached is a stall (the game should walk on by itself)
      if (t.goal) {
        idleSince ??= Date.now();
        if (Date.now() - idleSince > 1500) {
          stalls++;
          idleSince = null;
        }
        await farm.frames(6);
        continue;
      }
      idleSince = null;
      await farm.frames(reactFrames);
      const L2 = await look();
      if (L2.walking || L2.t.goal || L2.t.phase !== 'towing' || L2.t.log.snagged) continue;
      if (strategy === 'action') await action('a-home');
      else await towardSlip(L2);
      await farm.frames(6);
      continue;
    }
    if (t.phase === 'towing' && !L.walking && chainSlip && !t.goal) {
      // the chained tap meant the slip: an idle farmer short of it is a stall that needs another tap
      stalls++;
      chainSlip = false;
      continue;
    }
    idleSince = null;
    await farm.frames(6);
  }
  const r = await rec;
  const t = await farm.eval(() => window.__farm.dev.tow());
  const silent = await farm.eval(
    () => window.__farm.controls?.entries?.filter((e) => e.kind === 'silent').length ?? 0,
  );
  return {
    status,
    strategy,
    hand,
    profile: farm.profile.id,
    lane: t?.lane,
    laneTiles: t?.laneTiles,
    inputs: taps.length,
    ms: t?.ms ?? null,
    tugs: t?.tugs,
    stalls,
    silent,
    hard: taps.filter((x) => x.zone === 'hard').length,
    zones: taps.map((x) => `${x.what}:${x.zone}/${x.mm}`).join(' '),
    taps,
    ...r,
  };
}

/** The critic's bar for one run (review-6, final-dry-year): a list of what failed, empty when it passes. */
export function towBar(r, { maxMs = 20000, maxInputs = 6, maxDraws = 7 } = {}) {
  const bad = [];
  if (r.status !== 'ok') bad.push(`not landed (${r.status})`);
  if (r.ms === null || r.ms >= maxMs) bad.push(`ms ${r.ms}`);
  if (r.inputs > maxInputs) bad.push(`inputs ${r.inputs}`);
  if (r.draws > maxDraws) bad.push(`draws ${r.draws}`);
  if (r.stalls) bad.push(`stalls ${r.stalls}`);
  if (r.silent) bad.push(`silent ${r.silent}`);
  if (r.hard) bad.push(`hard taps ${r.hard}`);
  if (r.offWater.length) bad.push(`off water ${JSON.stringify(r.offWater)}`);
  return bad;
}
