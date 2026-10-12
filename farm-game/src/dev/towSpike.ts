/**
 * The towing spike (docs/MILESTONES.md M7, "Spike first"): the lab's tow lanes as a course for the real towing
 * controller (src/game/TowController.ts), which the feel critic gave its go on. Two lanes (scripts/generate-lab-map.mjs
 * writes them into the lab map): `spike`, the first short lane on the showcase's south shore, and `long`, about 17
 * tiles from a head below the farmer, west, then south to a slip above the floating controls. One log at a time; a
 * landed log comes round again, and so does one that drifts to its lane's end.
 *
 * Debug builds only: the lab scene runs it when the scenario sets the stat `lab.towSpike` (`lab.towLane` 2 picks the
 * long lane, `lab.towLong` a long log, two tugs). No hook needed in the lab, and a landing gives nothing.
 */
import { TILE_SIZE } from '../config';
import {
  inRect,
  TowController,
  type TowCourse,
  type TowHost,
  type TowLogSpec,
} from '../game/TowController';
import { drift, TIMBER, type Log, type TowWorld } from '../systems/towing';
import { labMap, type TowLaneDef } from './labDef';

export type { TowHost, TowMetrics } from '../game/TowController';

const WATER_ID = 5;

/** A lab lane as a towing course. */
export function labCourse(laneId: string, long: boolean): TowCourse {
  const L = labMap;
  const id = L.tow[laneId] ? laneId : 'spike';
  const lane: TowLaneDef = L.tow[id]!;
  const snags = new Set(lane.snags.map(([x, y]) => `${x},${y}`));
  const world: TowWorld = {
    water: (tx, ty) =>
      tx >= 0 && ty >= 0 && tx < L.w && ty < L.h && L.ground[ty * L.w + tx] === WATER_ID,
    snag: (tx, ty) => snags.has(`${tx},${ty}`),
  };
  /** The current where a tile is (px/s). */
  const flowAt = (tx: number, ty: number): { x: number; y: number } => {
    for (const f of lane.flow) if (inRect(f.rect, tx, ty)) return { x: f.x, y: f.y };
    return { x: 0, y: 0 };
  };
  const sp = lane.spawn;
  const spec: TowLogSpec = {
    key: 0,
    lane: id,
    long,
    axis: sp.axis,
    x: sp.tx * TILE_SIZE + 8,
    y: sp.ty * TILE_SIZE + 8,
  };
  return {
    id,
    tiles: lane.tiles,
    world,
    water: lane.water,
    slip: {
      bank: { tx: lane.slip.bank[0], ty: lane.slip.bank[1] },
      water: { tx: lane.slip.water[0], ty: lane.slip.water[1] },
    },
    snags: lane.snags.map(([tx, ty]) => ({ tx, ty })),
    rocks: true,
    respawn: true,
    logs: () => [spec],
    drift(log: Log, _spec, w, dtMs) {
      const tx = Math.floor(log.x / TILE_SIZE);
      const ty = Math.floor(log.y / TILE_SIZE);
      drift(w, log, flowAt(tx, ty), dtMs);
      return lane.end.some((r) => inRect(r, tx, ty)) ? 'end' : 'moved';
    },
    along(log: Log) {
      const f = flowAt(Math.floor(log.x / TILE_SIZE), Math.floor(log.y / TILE_SIZE));
      const d = Math.hypot(f.x, f.y);
      return d ? { x: f.x / d, y: f.y / d } : null;
    },
    rest: () => null,
    canHook: () => true,
    refuse: () => {},
    landed: (_s, log) => (log.long ? TIMBER.long : TIMBER.short),
  };
}

/** The spike: the controller on a lab lane. */
export class TowSpike extends TowController {
  constructor(host: TowHost, long = false, laneId = 'spike') {
    super(host, labCourse(laneId, long));
  }
}
