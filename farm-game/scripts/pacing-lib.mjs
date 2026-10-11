// Frame pacing: per-frame times instead of averages. Two series per recording:
//  - `raf`: the interval between animation frames (what the eye sees; a long one is a visible hitch);
//  - `work`: the game's own time per frame, from Phaser's pre-step to post-render (update + render submit).
// Headless Chromium renders with software GL, so absolute numbers are pessimistic. Compare before/after.

/** Page init script: an always-running rAF probe and, once the game exists, a step timer. */
export function pacingInit() {
  const rec = { on: false, raf: [], work: [], last: 0, stepAt: 0, hooked: false, marks: [] };
  window.__pace = rec;
  const tick = (now) => {
    if (rec.on) {
      if (rec.last) rec.raf.push(now - rec.last);
      rec.last = now;
    } else rec.last = 0;
    if (!rec.hooked && window.__farm?.game?.events) {
      rec.hooked = true;
      const ev = window.__farm.game.events;
      ev.on('prestep', () => (rec.stepAt = performance.now()));
      ev.on('postrender', () => {
        if (rec.on && rec.stepAt) rec.work.push(performance.now() - rec.stepAt);
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export const startPacing = (page) =>
  page.evaluate(() => {
    const r = window.__pace;
    r.raf = [];
    r.work = [];
    r.marks = [];
    r.last = 0;
    r.on = true;
  });

export const stopPacing = (page) =>
  page.evaluate(() => {
    const r = window.__pace;
    r.on = false;
    return { raf: r.raf.slice(), work: r.work.slice() };
  });

const pct = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : 0;

/** p50/p95/p99, the longest frame and the frames over 20 and 33 ms (whole series). */
export function frameStats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return {
    n: s.length,
    p50: pct(s, 0.5),
    p95: pct(s, 0.95),
    p99: pct(s, 0.99),
    max: s.length ? s[s.length - 1] : 0,
    over20: s.filter((x) => x > 20).length,
    over33: s.filter((x) => x > 33.4).length,
    over50: s.filter((x) => x > 50).length,
    over100: s.filter((x) => x > 100).length,
  };
}

/** One printable row: frame intervals, then the game's own work per frame. */
export function pacingRow(throttle, scene, raf, work) {
  const f = frameStats(raf);
  const w = frameStats(work);
  return {
    throttle,
    scene,
    frames: f.n,
    p50: f.p50.toFixed(1),
    p95: f.p95.toFixed(1),
    p99: f.p99.toFixed(1),
    max: f.max.toFixed(0),
    '>20': f.over20,
    '>33': f.over33,
    '>100': f.over100,
    'work p95': w.p95.toFixed(1),
    'work max': w.max.toFixed(0),
  };
}
