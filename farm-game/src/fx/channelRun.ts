/**
 * Pure timing for the channels' juice (fx/ChannelFx.ts): which way the water enters each channel tile, when it gets
 * there on the morning's run, how much of a tile it has filled, and where the spade's soil lands. No Phaser here,
 * so every rule is unit tested (tests/channel-fx.test.ts). Everything is in whole pixels.
 */

/** The side of a tile the water comes in from. */
export type Side = 'n' | 's' | 'e' | 'w';

export interface RunStep {
  key: string;
  tx: number;
  ty: number;
  /** Tiles from the creek (0 = beside it). */
  depth: number;
  /** The side the water enters from (the creek or the channel upstream). */
  from: Side;
}

const N4: [number, number, Side][] = [
  [1, 0, 'e'],
  [-1, 0, 'w'],
  [0, 1, 's'],
  [0, -1, 'n'],
];
const parse = (k: string): [number, number] => k.split(',').map(Number) as [number, number];

/**
 * The water's way down the reached channels: a breadth-first walk from the tiles beside the creek, in the same
 * reading order as `systems/channels.flowReach`, giving each tile its depth and the side its water comes in from.
 * Only tiles in `reach` are walked (the flow already stops where it runs out).
 */
export function runSteps(
  reach: readonly string[],
  isSource: (x: number, y: number) => boolean,
): RunStep[] {
  const inReach = new Set(reach);
  const seen = new Set<string>();
  const out: RunStep[] = [];
  let frontier: RunStep[] = [];
  for (const k of reach) {
    const [x, y] = parse(k);
    const src = N4.find(([dx, dy]) => isSource(x + dx, y + dy));
    if (!src) continue;
    seen.add(k);
    frontier.push({ key: k, tx: x, ty: y, depth: 0, from: src[2] });
  }
  while (frontier.length) {
    frontier.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    const next: RunStep[] = [];
    for (const s of frontier) {
      out.push(s);
      for (const [dx, dy, side] of N4) {
        const k = `${s.tx + dx},${s.ty + dy}`;
        if (!inReach.has(k) || seen.has(k)) continue;
        seen.add(k);
        // the neighbour east of s gets its water from its west side, and so on
        next.push({
          key: k,
          tx: s.tx + dx,
          ty: s.ty + dy,
          depth: s.depth + 1,
          from: OPPOSITE[side],
        });
      }
    }
    frontier = next;
  }
  return out;
}

const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

/**
 * The morning's run is one continuous front: it crosses a tile in `RUN_STEP_MS` (about 250 px/s), and the tile
 * downstream starts as this one fills, so the water never shows gaps. A long channel runs faster, so a whole run
 * takes at most `RUN_MAX_MS`.
 */
export const RUN_STEP_MS = 65;
export const RUN_MAX_MS = 1500;
/** On a fresh cut, the water fills the new tile a little slower (it is the moment the eye is on). */
export const DIG_FILL_MS = 220;

/** The ms the front takes per tile for a run whose deepest tile is `maxDepth`. */
export function runStepMs(maxDepth: number): number {
  return Math.max(16, Math.min(RUN_STEP_MS, Math.floor(RUN_MAX_MS / (Math.max(0, maxDepth) + 1))));
}

/**
 * Has the run come into view enough to start (feel critic, C1-1: it must not spend itself on a sliver at the edge)?
 * Yes once its entry and the next two tiles of its way lie wholly inside the view inset by `inset` px, or half or
 * more of its tiles do. `view` is the camera's world view in px; `steps` in run order.
 */
export function runSeen(
  steps: readonly RunStep[],
  view: { x: number; y: number; width: number; height: number },
  inset = 16,
  size = 16,
): boolean {
  if (!steps.length) return false;
  const inside = (s: RunStep): boolean =>
    s.tx * size >= view.x + inset &&
    (s.tx + 1) * size <= view.x + view.width - inset &&
    s.ty * size >= view.y + inset &&
    (s.ty + 1) * size <= view.y + view.height - inset;
  if (steps.slice(0, 3).every(inside)) return true;
  return seenCount(steps, view, inset, size) * 2 >= steps.length;
}

/** How many of the run's tiles lie wholly inside the view inset by `inset` px. */
export function seenCount(
  steps: readonly RunStep[],
  view: { x: number; y: number; width: number; height: number },
  inset = 16,
  size = 16,
): number {
  return steps.filter(
    (s) =>
      s.tx * size >= view.x + inset &&
      (s.tx + 1) * size <= view.x + view.width - inset &&
      s.ty * size >= view.y + inset &&
      (s.ty + 1) * size <= view.y + view.height - inset,
  ).length;
}

/** When each tile starts to fill (ms after the run starts). */
export function runStart(step: RunStep, stepMs: number): number {
  return step.depth * stepMs;
}

/** The whole run's length (the last tile full). */
export function runLength(steps: readonly RunStep[]): number {
  const deepest = steps.reduce((m, s) => Math.max(m, s.depth), 0);
  return steps.length ? (deepest + 1) * runStepMs(deepest) : 0;
}

/**
 * The part of a 16 px tile the water covers at `p` (0..1) coming in from `from`, in whole pixels, plus the line of
 * its leading edge (the foam), which is null once the tile is full.
 */
export function fillRect(
  from: Side,
  p: number,
  size = 16,
  /** Ease out (a single cut filling) or linear (a tile of the morning's front, which must not stall at edges). */
  ease = true,
): {
  x: number;
  y: number;
  w: number;
  h: number;
  edge: { x: number; y: number; w: number; h: number } | null;
} {
  const n = Math.max(
    0,
    Math.min(
      size,
      Math.round((ease ? easeOutQuad : (t: number) => t)(Math.max(0, Math.min(1, p))) * size),
    ),
  );
  const full = n >= size;
  switch (from) {
    case 'w':
      return {
        x: 0,
        y: 0,
        w: n,
        h: size,
        edge: full || !n ? null : { x: n - 1, y: 0, w: 1, h: size },
      };
    case 'e':
      return {
        x: size - n,
        y: 0,
        w: n,
        h: size,
        edge: full || !n ? null : { x: size - n, y: 0, w: 1, h: size },
      };
    case 'n':
      return {
        x: 0,
        y: 0,
        w: size,
        h: n,
        edge: full || !n ? null : { x: 0, y: n - 1, w: size, h: 1 },
      };
    case 's':
      return {
        x: 0,
        y: size - n,
        w: size,
        h: n,
        edge: full || !n ? null : { x: 0, y: size - n, w: size, h: 1 },
      };
  }
}

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * The soil the morning's channels watered, by the channel tile whose water reaches it first (so each darkens as
 * the run passes beside it). Soil beside no step is left out.
 */
export function wetBeside(
  steps: readonly RunStep[],
  watered: readonly string[],
): Map<string, string[]> {
  const want = new Set(watered);
  const out = new Map<string, string[]>();
  for (const s of [...steps].sort((a, b) => a.depth - b.depth)) {
    for (const [dx, dy] of N4) {
      const k = `${s.tx + dx},${s.ty + dy}`;
      if (!want.has(k)) continue;
      want.delete(k);
      const list = out.get(s.key) ?? [];
      list.push(k);
      out.set(s.key, list);
    }
  }
  return out;
}

/** A clod of soil off the spade: where it starts and lands (px from the cut's centre), its arc and flight time. */
export interface Clod {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Peak height of the arc (px). */
  h: number;
  ms: number;
  /** 1 or 2 px. */
  size: number;
  color: number;
}

/**
 * Earth colours from the shared palette (wood, sand, soil): light enough to read on the dark tilled rows a channel
 * usually runs between, and on grass.
 */
export const CLOD_COLORS = [0xb47c4c, 0xdcb47c, 0x7c442c] as const;

/**
 * The soil thrown by one cut, facing `dir`: it flies out to both banks beside the cut (more to one side, as a spade
 * throws), never forward over the next tile or back onto the farmer. `rnd` is a 0..1 source (seeded in tests).
 */
export function clods(dir: 'up' | 'down' | 'left' | 'right', rnd: () => number, count = 7): Clod[] {
  const across = dir === 'left' || dir === 'right'; // a channel running east-west throws north and south
  const out: Clod[] = [];
  for (let i = 0; i < count; i++) {
    // two thirds to the spade's throwing side (the farmer's right hand: north of a westward cut, and so on)
    const side = i % 3 === 2 ? -1 : 1;
    const along = Math.round((rnd() - 0.5) * 10);
    const out1 = Math.round(8 + rnd() * 5) * side; // lands on the bank, 8-13 px from the cut's centre line
    const lateral = throwSign(dir) * out1;
    out.push({
      x0: across ? along : 0,
      y0: across ? 0 : along,
      x1: across ? along + Math.round((rnd() - 0.5) * 4) : lateral,
      y1: across ? lateral : along + Math.round((rnd() - 0.5) * 4),
      h: Math.round(7 + rnd() * 7),
      ms: Math.round(240 + rnd() * 120),
      size: rnd() < 0.7 ? 2 : 1,
      color: CLOD_COLORS[i % CLOD_COLORS.length]!,
    });
  }
  return out;
}

/** Which way "the throwing side" lies for a cut facing `dir` (+1 is south or east of the cut). */
function throwSign(dir: 'up' | 'down' | 'left' | 'right'): number {
  return dir === 'left' || dir === 'up' ? -1 : 1;
}

/** Where a clod is `t` ms into its flight: a parabola between its ends, whole pixels; null once it has landed. */
export function clodAt(c: Clod, t: number): { x: number; y: number } | null {
  if (t >= c.ms) return null;
  const u = Math.max(0, t / c.ms);
  return {
    x: Math.round(c.x0 + (c.x1 - c.x0) * u),
    y: Math.round(c.y0 + (c.y1 - c.y0) * u - 4 * c.h * u * (1 - u)),
  };
}
