/**
 * Towing (the Weir's verb, docs/MILESTONES.md M7): drift timber is hooked from the bank with a rope, towed along
 * the bank by walking, freed with a tug when it snags, and landed at a slip. Pure rules: the map comes in as
 * predicates and every position is in world px, so tests need no Phaser. The lab spike (src/dev/towSpike.ts) is
 * the first user; the M7 builder adopts these rules for the real weir.
 *
 * A log is a short (1 tile) or long (2 tiles) piece lying along the lane's axis. It only ever sits on open water
 * (never a bank, never a snag tile), so it can never cross the bank or overlap the farmer.
 */

export const TILE = 16;
/** The rope's length in tiles, and in px from the farmer's hands to the log's centre. */
export const ROPE_TILES = 3;
export const ROPE_PX = ROPE_TILES * TILE;
/** How fast a towed log closes on its place at the rope's end (per 60 Hz frame; frame-rate independent). */
export const FOLLOW_RATE = 0.16;
/** Tugs that free a snagged log: one for a short log, two for a long one. */
export const TUGS = { short: 1, long: 2 } as const;
/** Timber a landed log gives. */
export const TIMBER = { short: 1, long: 3 } as const;
/** Half the log's thickness across its axis (px). */
const HALF_THICK = 3;

export interface TowWorld {
  /** Open water a log may float on. */
  water(tx: number, ty: number): boolean;
  /** A rock, reed bed or bank corner in the water that catches a log. */
  snag(tx: number, ty: number): boolean;
}

export interface Log {
  /** Centre, world px. */
  x: number;
  y: number;
  long: boolean;
  /** The axis it lies along ('h': east-west). */
  axis: 'h' | 'v';
  hooked: boolean;
  /** Caught on a snag tile: which, the way the log was moving, and the tugs so far. */
  snag: { tx: number; ty: number; dx: number; dy: number; tugs: number } | null;
  landed: boolean;
}

export const makeLog = (x: number, y: number, long = false, axis: 'h' | 'v' = 'h'): Log => ({
  x,
  y,
  long,
  axis,
  hooked: false,
  snag: null,
  landed: false,
});

/** Half extents of a log's footprint (px). */
export function halfExtents(log: Pick<Log, 'long' | 'axis'>): { hx: number; hy: number } {
  const half = (log.long ? 2 : 1) * (TILE / 2) - 1;
  return log.axis === 'h' ? { hx: half, hy: HALF_THICK } : { hx: HALF_THICK, hy: half };
}

/** The tiles under a log's footprint at (x, y). */
function footprint(log: Log, x: number, y: number): [number, number][] {
  const { hx, hy } = halfExtents(log);
  const tx0 = Math.floor((x - hx) / TILE);
  const tx1 = Math.floor((x + hx) / TILE);
  const ty0 = Math.floor((y - hy) / TILE);
  const ty1 = Math.floor((y + hy) / TILE);
  const out: [number, number][] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) out.push([tx, ty]);
  return out;
}

/** Can the log lie at (x, y)? 'ok', or what is in the way: a snag (that tile) or the bank. */
export function placeAt(
  world: TowWorld,
  log: Log,
  x: number,
  y: number,
): { ok: true } | { ok: false; snag: [number, number] | null } {
  let land = false;
  for (const [tx, ty] of footprint(log, x, y)) {
    if (world.snag(tx, ty)) return { ok: false, snag: [tx, ty] };
    if (!world.water(tx, ty)) land = true;
  }
  return land ? { ok: false, snag: null } : { ok: true };
}

/**
 * Move a log toward (nx, ny) as far as the water lets it: the whole step, else along one axis (it slides along a
 * bank). Running into a snag catches it there. Returns what happened.
 */
function moveLog(
  world: TowWorld,
  log: Log,
  nx: number,
  ny: number,
): 'moved' | 'blocked' | 'snagged' {
  const dx = nx - log.x;
  const dy = ny - log.y;
  if (dx === 0 && dy === 0) return 'moved';
  const tries: [number, number][] = [
    [nx, ny],
    [nx, log.y],
    [log.x, ny],
  ];
  for (const [x, y] of tries) {
    if (x === log.x && y === log.y) continue;
    const r = placeAt(world, log, x, y);
    if (r.ok) {
      log.x = x;
      log.y = y;
      return 'moved';
    }
    if (r.snag) {
      // the way it was going: the larger part of the step (a tug pops it on that way)
      const horiz = Math.abs(x - log.x) >= Math.abs(y - log.y);
      log.snag = {
        tx: r.snag[0],
        ty: r.snag[1],
        dx: horiz ? Math.sign(x - log.x) : 0,
        dy: horiz ? 0 : Math.sign(y - log.y),
        tugs: 0,
      };
      return 'snagged';
    }
  }
  return 'blocked';
}

/** How much the motion along one axis must outweigh the other before a log turns to lie along it. */
const TURN_RATIO = 2.5;

/**
 * A log turns to lie along the lane's current where it is (a lane that bends from east-west to north-south turns
 * the log with it), when that way clearly dominates and the turned log fits on open water there. Returns true when
 * it turned.
 */
export function alignAxis(world: TowWorld, log: Log, dx: number, dy: number): boolean {
  const want: 'h' | 'v' | null =
    Math.abs(dy) > TURN_RATIO * Math.abs(dx)
      ? 'v'
      : Math.abs(dx) > TURN_RATIO * Math.abs(dy)
        ? 'h'
        : null;
  if (!want || want === log.axis) return false;
  const turned = { ...log, axis: want };
  if (!placeAt(world, turned, log.x, log.y).ok) return false;
  log.axis = want;
  return true;
}

/** A drifting log (not hooked) goes with the current, `flow` px/s, until something stops it. */
export function drift(
  world: TowWorld,
  log: Log,
  flow: { x: number; y: number },
  dtMs: number,
): 'moved' | 'blocked' | 'snagged' {
  if (log.hooked || log.landed || log.snag) return 'blocked';
  const r = moveLog(world, log, log.x + (flow.x * dtMs) / 1000, log.y + (flow.y * dtMs) / 1000);
  if (r === 'moved') alignAxis(world, log, flow.x, flow.y);
  return r;
}

/** Is the log within the rope's reach of the farmer's hands? */
export const inReach = (hands: { x: number; y: number }, log: Log, slackPx = 0): boolean =>
  Math.hypot(log.x - hands.x, log.y - hands.y) <= ROPE_PX - slackPx;

export type TowState = 'slack' | 'taut' | 'snagged' | 'free';

/**
 * One frame of a hooked log on the rope: while the rope is shorter than the distance, the log closes on the point
 * at the rope's end on the line to the farmer's hands (eased, so it lags and swings round a turn), sliding along
 * the bank, and catches on a snag. A slack rope leaves the log where it is. `along` is the lane's downstream
 * direction where the log is (a unit vector): a log held against the inside of a bend moves that way instead, and
 * the log turns to lie along it (systems/towing alignAxis).
 */
export function follow(
  world: TowWorld,
  log: Log,
  hands: { x: number; y: number },
  dtMs: number,
  along?: { x: number; y: number } | null,
): TowState {
  if (!log.hooked || log.landed) return 'free';
  if (log.snag) return 'snagged';
  const dx = log.x - hands.x;
  const dy = log.y - hands.y;
  const d = Math.hypot(dx, dy);
  if (d <= ROPE_PX) return 'slack';
  const tx = hands.x + (dx / d) * ROPE_PX;
  const ty = hands.y + (dy / d) * ROPE_PX;
  const k = 1 - Math.pow(1 - FOLLOW_RATE, Math.max(0, dtMs) / (1000 / 60));
  const step = Math.hypot(tx - log.x, ty - log.y) * k;
  const x0 = log.x;
  const y0 = log.y;
  let r = moveLog(world, log, log.x + (tx - log.x) * k, log.y + (ty - log.y) * k);
  const got = Math.hypot(log.x - x0, log.y - y0);
  if (r !== 'snagged' && along && got < step / 2) {
    // held against the bank on the inside of a bend: the rest of the pull carries it on downstream along the lane,
    // until the rope can draw it straight again (it never cuts across the bank)
    const rest = step - got;
    const r2 = moveLog(world, log, log.x + along.x * rest, log.y + along.y * rest);
    if (r2 !== 'blocked') r = r2;
  }
  // it lies along the lane where it is (it turns with a bend, not with every pull of the rope)
  if (r === 'moved' && along) alignAxis(world, log, along.x, along.y);
  return r === 'snagged' ? 'snagged' : 'taut';
}

/**
 * A tug on a snagged log. A short log comes free on the first tug, a long one on the second; freed, it pops past
 * the snag (on along the way it was going, or round it a row out) onto the nearest open water. Returns where it
 * lands, or null when it held (or was not snagged).
 */
export function tug(world: TowWorld, log: Log): { freed: boolean; x: number; y: number } | null {
  const s = log.snag;
  if (!s) return null;
  s.tugs++;
  if (s.tugs < (log.long ? TUGS.long : TUGS.short)) return { freed: false, x: log.x, y: log.y };
  const { hx, hy } = halfExtents(log);
  const cx = s.tx * TILE + TILE / 2;
  const cy = s.ty * TILE + TILE / 2;
  // past the snag along the way it was moving (whichever way the log lies); then the same a row (or column) either
  // side
  const candidates: [number, number][] = [];
  if (s.dx !== 0 || s.dy === 0) {
    const x = cx + (s.dx || 1) * (TILE / 2 + hx + 1);
    candidates.push([x, log.y], [x, log.y + TILE], [x, log.y - TILE], [log.x, log.y + TILE]);
  } else {
    const y = cy + s.dy * (TILE / 2 + hy + 1);
    candidates.push([log.x, y], [log.x + TILE, y], [log.x - TILE, y], [log.x + TILE, log.y]);
  }
  for (const [x, y] of candidates)
    if (placeAt(world, log, x, y).ok) {
      log.snag = null;
      log.x = x;
      log.y = y;
      return { freed: true, x, y };
    }
  // nowhere to pop to: it comes loose where it is (never stuck for good)
  log.snag = null;
  return { freed: true, x: log.x, y: log.y };
}

/** How fast the farmer hauls a log in to the slip once he stands at it (px/s). */
export const HAUL_PX_S = 110;

/**
 * How near the slip counts as at it (tiles, either axis): standing this near, a free log is hauled in, and a tow
 * tap this near the slip (bank or water) means the slip. A thumb taps near the slip while the camera scrolls, and
 * the log should still land (critic T1 ruling).
 */
export const SLIP_REACH = 2;

const near = (a: { tx: number; ty: number }, b: { tx: number; ty: number }, r: number): boolean =>
  Math.abs(a.tx - b.tx) <= r && Math.abs(a.ty - b.ty) <= r;

/** The farmer stands at the slip (within SLIP_REACH of its bank tile): he hauls the log in. */
export const atSlipBank = (
  farmer: { tx: number; ty: number },
  bank: { tx: number; ty: number },
  reach = SLIP_REACH,
): boolean => near(farmer, bank, reach);

/** A tow tap on this tile means the slip: within SLIP_REACH of the slip's bank tile or of its water tile. */
export const meansSlip = (
  t: { tx: number; ty: number },
  slip: { bank: { tx: number; ty: number }; water: { tx: number; ty: number } },
): boolean => near(t, slip.bank, SLIP_REACH) || near(t, slip.water, SLIP_REACH);

/**
 * One frame of hauling a hooked log in, hand over hand, toward the slip's water tile (its centre), sliding along
 * the bank as a towed log does; a snag still catches it.
 */
export function haul(
  world: TowWorld,
  log: Log,
  slip: { tx: number; ty: number },
  dtMs: number,
): 'moved' | 'arrived' | 'blocked' | 'snagged' {
  if (!log.hooked || log.landed) return 'blocked';
  if (log.snag) return 'snagged';
  const tx = slip.tx * TILE + TILE / 2;
  const ty = slip.ty * TILE + TILE / 2;
  const dx = tx - log.x;
  const dy = ty - log.y;
  const d = Math.hypot(dx, dy);
  const step = (HAUL_PX_S * Math.max(0, dtMs)) / 1000;
  if (d <= step) {
    if (placeAt(world, log, tx, ty).ok) {
      log.x = tx;
      log.y = ty;
      return 'arrived';
    }
  }
  const r = moveLog(world, log, log.x + (dx / d) * step, log.y + (dy / d) * step);
  return atSlip(log, slip) ? 'arrived' : r;
}

/** Has a hooked log reached the slip's water tile? (Its centre in the tile.) */
export function atSlip(log: Log, slip: { tx: number; ty: number }): boolean {
  return (
    log.hooked &&
    !log.landed &&
    Math.floor(log.x / TILE) === slip.tx &&
    Math.floor(log.y / TILE) === slip.ty
  );
}

/** Land a log at the slip: it leaves the water; returns the timber it gives. */
export function land(log: Log): number {
  log.landed = true;
  log.hooked = false;
  log.snag = null;
  return log.long ? TIMBER.long : TIMBER.short;
}

// ---- reading taps while towing ----

const N4: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Where a tap means "walk there": a walkable tile as it is; a water tile resolves to the nearest walkable bank
 * beside the water (a thumb taps where the log should go, which is often the river). Null when nothing is near.
 */
export function bankFor(
  tx: number,
  ty: number,
  walkable: (tx: number, ty: number) => boolean,
  water: (tx: number, ty: number) => boolean,
  maxSteps = 6,
): { tx: number; ty: number } | null {
  if (walkable(tx, ty)) return { tx, ty };
  if (!water(tx, ty)) return null;
  let frontier: [number, number][] = [[tx, ty]];
  const seen = new Set([`${tx},${ty}`]);
  for (let step = 0; step <= maxSteps && frontier.length; step++) {
    for (const [x, y] of frontier)
      for (const [dx, dy] of N4) if (walkable(x + dx, y + dy)) return { tx: x + dx, ty: y + dy };
    const next: [number, number][] = [];
    for (const [x, y] of frontier)
      for (const [dx, dy] of N4) {
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k) || !water(x + dx, y + dy)) continue;
        seen.add(k);
        next.push([x + dx, y + dy]);
      }
    frontier = next;
  }
  return null;
}

/**
 * Where to stand to hook a log: the walkable tile nearest the farmer from which the log is comfortably in reach
 * (a tile's margin inside the rope, since the log drifts while the farmer walks). Null when no bank reaches it.
 */
export function hookStand(
  log: Log,
  from: { tx: number; ty: number },
  walkable: (tx: number, ty: number) => boolean,
  handsUp = 6,
): { tx: number; ty: number } | null {
  const ltx = Math.floor(log.x / TILE);
  const lty = Math.floor(log.y / TILE);
  let best: { tx: number; ty: number; cost: number } | null = null;
  for (let ty = lty - ROPE_TILES; ty <= lty + ROPE_TILES; ty++)
    for (let tx = ltx - ROPE_TILES; tx <= ltx + ROPE_TILES; tx++) {
      if (!walkable(tx, ty)) continue;
      const hands = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 3 - handsUp };
      if (!inReach(hands, log, TILE * 0.75)) continue;
      const cost = Math.abs(tx - from.tx) + Math.abs(ty - from.ty);
      if (!best || cost < best.cost) best = { tx, ty, cost };
    }
  return best ? { tx: best.tx, ty: best.ty } : null;
}

// ---- what Action means near the water ----

/**
 * What Action does in towing's context (critic ruling, T2): the tow only claims Action while its context is live.
 * - `tug`: the log is caught on a snag;
 * - `home`: a free hooked log: walk it to the slip along the bank (a tap still goes where it is tapped);
 * - `busy`: hooked, already on the way home or hauling in: Action does nothing else meanwhile;
 * - `hook`: no log hooked, one in view and the farmer within NEAR_WATER tiles of the lane, and nothing in front of
 *   him that Action would act on (a ripe crop or a forage good there wins);
 * - null: not towing's: Action does what it always does.
 */
export type TowVerb = 'tug' | 'home' | 'busy' | 'hook' | null;

/** How near the lane's water (tiles) an unhooked log in view lets Action hook it. */
export const NEAR_WATER = 4;

export function actionVerb(c: {
  hooked: boolean;
  snagged: boolean;
  /** Walking to the slip, or hauling the log in at it. */
  homing: boolean;
  logInView: boolean;
  /** Tiles from the farmer to the nearest lane water tile (either axis). */
  waterDist: number;
  /** Action would act on something in front of the farmer (crop, forage, soil...). */
  front: boolean;
}): TowVerb {
  if (c.snagged) return 'tug';
  if (c.hooked) return c.homing ? 'busy' : 'home';
  if (!c.logInView || c.waterDist > NEAR_WATER || c.front) return null;
  return 'hook';
}
