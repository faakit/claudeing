import { ActionPress, PAINT_ARM_MS, type ActionEvent } from '../src/input/gesture';

/** Replay a press: [time, dx, dy] moves, frames every 16 ms, lift at `upAt`. Returns every event. */
export function play(moves: [number, number, number][], upAt: number): ActionEvent[] {
  const p = new ActionPress(0);
  const out: ActionEvent[] = [];
  let mi = 0;
  for (let t = 0; t <= upAt; t += 4) {
    while (mi < moves.length && moves[mi]![0] <= t) {
      out.push(...p.move(moves[mi]![1], moves[mi]![2], moves[mi]![0]));
      mi++;
    }
    if (t % 16 === 0) out.push(...p.update(t));
  }
  out.push(...p.up());
  return out;
}
export const types = (e: ActionEvent[]) => e.map((x) => x.type);
export const committed = (e: ActionEvent[]) => {
  const c = e.at(-1);
  return c?.type === 'commit' ? c.path.join(' ') : c?.type;
};

/**
 * Moves through polyline corners (dx, dy from Action), one sample per 16 ms at `pxPerMs`, after the arm. The
 * lateral wobble is continuous: its direction blends between the legs over 8 px around each corner.
 */
export function drawPath(
  corners: [number, number][],
  opts: { pxPerMs?: number; lateral?: (s: number) => number } = {},
): [number, number, number][] {
  const speed = opts.pxPerMs ?? 0.1; // about a paint step per 100 ms: a deliberate drag
  const pts: [number, number][] = [[0, 0], ...corners];
  const normal = (j: number): [number, number] => {
    const a = pts[Math.max(0, Math.min(j, pts.length - 2))]!;
    const b = pts[Math.max(1, Math.min(j + 1, pts.length - 1))]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  };
  const out: [number, number, number][] = [];
  let t = PAINT_ARM_MS + 40;
  let s = 0;
  for (let j = 0; j + 1 < pts.length; j++) {
    const a = pts[j]!;
    const b = pts[j + 1]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / (speed * 16)));
    const nj = normal(j);
    for (let k = 1; k <= n; k++) {
      const d = (len * k) / n;
      s += len / n;
      let nx = nj[0];
      let ny = nj[1];
      if (j > 0 && d < 4) {
        const w = 0.5 + d / 8;
        const np = normal(j - 1);
        nx = np[0] * (1 - w) + nj[0] * w;
        ny = np[1] * (1 - w) + nj[1] * w;
      } else if (j + 2 < pts.length && len - d < 4) {
        const w = 0.5 - (len - d) / 8;
        const nn = normal(j + 1);
        nx = nj[0] * (1 - w) + nn[0] * w;
        ny = nj[1] * (1 - w) + nn[1] * w;
      }
      const lat = opts.lateral?.(s) ?? 0;
      out.push([
        t,
        a[0] + ((b[0] - a[0]) * k) / n + nx * lat,
        a[1] + ((b[1] - a[1]) * k) / n + ny * lat,
      ]);
      t += 16;
    }
  }
  return out;
}

/** A wobble like the critic's: a sinusoid plus noise, peaking near 1.1 sigma (sigma in logical px). */
export function wobble(sigma: number, seed: number): (s: number) => number {
  let x = seed >>> 0;
  const u = () => ((x = (x * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const phase = u() * Math.PI * 2;
  const wave = 18 + u() * 20; // px of travel per wobble
  let noise = 0;
  return (s) => {
    noise = noise * 0.7 + (u() - 0.5) * 0.3 * sigma;
    return sigma * 0.95 * Math.sin(phase + (s / wave) * Math.PI * 2) + noise;
  };
}

/**
 * The controls critic's human model for painted paths (round 3): a continuous 2D wobble field over path length
 * (sinusoids of 12-25 mm wavelength plus smoothed noise), 50 mm/s slowing to 40% within 3 mm of each corner,
 * corners rounded with radius `cornerMm`, and the last leg running 0-2 mm past its target before the lift.
 * `corners` are intended polyline points in logical px from Action; `pxPerMm` converts.
 */
export function humanPath(
  corners: [number, number][],
  o: { pxPerMm: number; sigmaMm: number; cornerMm: number; seed: number; overshootMm?: number },
): [number, number, number][] {
  let x = o.seed >>> 0 || 1;
  const u = () => ((x = (x * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  const mm = o.pxPerMm;
  // the polyline, with the last leg run on past its target
  const pts: [number, number][] = [[0, 0], ...corners.map((c) => [c[0], c[1]] as [number, number])];
  const over = (o.overshootMm ?? u() * 2) * mm;
  const a = pts[pts.length - 2]!;
  const b = pts[pts.length - 1]!;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  pts[pts.length - 1] = [b[0] + ((b[0] - a[0]) / len) * over, b[1] + ((b[1] - a[1]) / len) * over];
  // dense resample (0.1 mm), corners rounded by a quarter arc of radius r
  const r = o.cornerMm * mm;
  const dense: [number, number][] = [[0, 0]];
  const corner: number[] = []; // dense indices of corner apexes
  for (let j = 1; j < pts.length; j++) {
    const p0 = pts[j - 1]!;
    const p1 = pts[j]!;
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const ux = (p1[0] - p0[0]) / L;
    const uy = (p1[1] - p0[1]) / L;
    const startCut = j > 1 ? Math.min(r, L / 2) : 0;
    const endCut = j < pts.length - 1 ? Math.min(r, L / 2) : 0;
    const step = 0.1 * mm;
    for (let d = startCut + step; d <= L - endCut; d += step)
      dense.push([p0[0] + ux * d, p0[1] + uy * d]);
    if (j < pts.length - 1) {
      const p2 = pts[j + 1]!;
      const L2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const vx = (p2[0] - p1[0]) / L2;
      const vy = (p2[1] - p1[1]) / L2;
      const c = Math.min(r, L / 2, L2 / 2);
      // quadratic Bezier from p1 - u*c through p1 to p1 + v*c (close to a quarter arc)
      const n = Math.max(2, Math.round((c * 1.6) / step));
      corner.push(dense.length + Math.floor(n / 2));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const s0 = [p1[0] - ux * c, p1[1] - uy * c];
        const s2 = [p1[0] + vx * c, p1[1] + vy * c];
        dense.push([
          (1 - t) * (1 - t) * s0[0]! + 2 * (1 - t) * t * p1[0] + t * t * s2[0]!,
          (1 - t) * (1 - t) * s0[1]! + 2 * (1 - t) * t * p1[1] + t * t * s2[1]!,
        ]);
      }
    }
  }
  // arc length of each dense point
  const sAt: number[] = [0];
  for (let i = 1; i < dense.length; i++)
    sAt.push(
      sAt[i - 1]! + Math.hypot(dense[i]![0] - dense[i - 1]![0], dense[i]![1] - dense[i - 1]![1]),
    );
  const total = sAt[sAt.length - 1]!;
  const cornerS = corner.map((i) => sAt[Math.min(i, sAt.length - 1)]!);
  // wobble field over s (mm): sinusoid + smoothed noise (running mean over 3 mm, rescaled to unit spread)
  const lam1 = (12 + u() * 13) * mm;
  const lam2 = (12 + u() * 13) * mm;
  const ph1 = u() * 2 * Math.PI;
  const ph2 = u() * 2 * Math.PI;
  const cell = 0.5 * mm;
  const raw1 = Array.from({ length: Math.ceil(total / cell) + 8 }, g);
  const raw2 = Array.from({ length: raw1.length }, g);
  const smooth = (raw: number[], s: number) => {
    const i = Math.floor(s / cell);
    let sum = 0;
    for (let k = 0; k < 6; k++) sum += raw[Math.min(raw.length - 1, i + k)]!;
    return (sum / 6) * Math.sqrt(6);
  };
  const sig = o.sigmaMm * mm;
  const field = (s: number): [number, number] => [
    sig * (0.8 * Math.sin((2 * Math.PI * s) / lam1 + ph1) + 0.3 * smooth(raw1, s)),
    sig * (0.8 * Math.sin((2 * Math.PI * s) / lam2 + ph2) + 0.3 * smooth(raw2, s)),
  ];
  // walk at 50 mm/s, 40% within 3 mm of a corner, one touchmove per 16 ms
  const out: [number, number, number][] = [];
  let t = PAINT_ARM_MS + 40;
  let s = 0;
  let di = 0;
  const off0 = field(0);
  while (s < total) {
    const near = cornerS.some((c) => Math.abs(c - s) < 3 * mm);
    s = Math.min(total, s + 50 * mm * 0.016 * (near ? 0.4 : 1));
    while (di < sAt.length - 1 && sAt[di + 1]! <= s) di++;
    const f = field(s);
    // the wobble starts where the finger armed (no jump at the start)
    out.push([t, dense[di]![0] + f[0] - off0[0], dense[di]![1] + f[1] - off0[1]]);
    t += 16;
  }
  return out;
}

/**
 * The controls critic's closed-loop painter (review 6, `r8-closed.mjs`): it moves 2 px at a time along each
 * leg until the live preview shows that leg's tiles, carries on 6 px (a person reacts to the tick, not
 * instantly), backs up while the preview shows too many, then turns. The same 2D wobble field (sinusoids of
 * 12-25 mm plus noise knots every 3 mm). Returns the final path and how many tiles were ever added (ticks).
 */
export function closedLoop(
  legs: { dx: number; dy: number; n: number }[],
  o: { pxPerMm: number; sigmaMm: number; seed: number },
): { path: string[] | null; ticks: number } {
  let x = o.seed >>> 0 || 1;
  const u = () => ((x = (x * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  const mm = o.pxPerMm;
  const sig = o.sigmaMm * mm;
  const lx = (12 + u() * 13) * mm;
  const ly = (12 + u() * 13) * mm;
  const px0 = u() * 6.283;
  const py0 = u() * 6.283;
  const knot = 3 * mm;
  const kx = Array.from({ length: 200 }, g);
  const ky = Array.from({ length: 200 }, g);
  const nz = (k: number[], s: number) => {
    const i = Math.floor(s / knot);
    const f = s / knot - i;
    return k[i]! * (1 - f) + k[i + 1]! * f;
  };
  const wob = (s: number) => ({
    x: sig * (0.8 * Math.sin((6.283 * s) / lx + px0) + 0.3 * nz(kx, s)),
    y: sig * (0.8 * Math.sin((6.283 * s) / ly + py0) + 0.3 * nz(ky, s)),
  });
  const press = new ActionPress(0);
  press.update(PAINT_ARM_MS + 20);
  const w0 = wob(0);
  let t = PAINT_ARM_MS + 40;
  let path: string[] = [];
  let ticks = 0;
  let pos = { x: 0, y: 0 };
  let sv = 0;
  const step = (dx: number, dy: number) => {
    pos = { x: pos.x + dx * 2, y: pos.y + dy * 2 };
    sv += 2;
    const w = wob(sv);
    for (const e of press.move(pos.x + w.x - w0.x, pos.y + w.y - w0.y, t))
      if (e.type === 'paint') {
        if (e.path.length > path.length) ticks += e.path.length - path.length;
        path = e.path;
      }
    t += 16;
  };
  let target = 0;
  for (const l of legs) {
    target += l.n;
    for (let guard = 0; path.length < target && guard <= 40; guard++) step(l.dx, l.dy);
    for (let q = 0; q < 3; q++) step(l.dx, l.dy);
    for (let back = 0; path.length > target && back < 12; back++) step(-l.dx, -l.dy);
  }
  const end = press.up().at(-1);
  return { path: end?.type === 'commit' ? end.path : null, ticks };
}
