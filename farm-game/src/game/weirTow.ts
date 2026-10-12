/**
 * The town river as a towing course (docs/MILESTONES.md M7, WORLD-PLAN 3.3): the waiting drift logs
 * (systems/drift.ts) enter at their lane's north edge whenever the town is built and drift down their lane at the
 * day's speed (half in winter) to where it rests; the reed bed and the two rock spurs catch them, the mill wheel and
 * the Heron are in their way. A towed log is pulled down the west bank and turns east along the bottom rows toward
 * the slip on the south bank. Landing gives its timber (systems/drift landLog).
 *
 * The lanes (valley.json `weir.drift.lanes`): `west` rests at the head under the north bank and catches on the reed
 * bed on the way down; `middle` drifts onto the first spur and waits caught there; `east` runs out of reach until the
 * second spur turns it west, then rests by the mill wheel near the slip.
 */
import { TILE_SIZE } from '../config';
import { t } from '../i18n';
import { getState } from '../state/store';
import {
  driftDef,
  driftSpeed,
  HOOK_ITEM,
  landLog,
  lanePath,
  laneRest,
  riverWorld,
  waitingLogs,
} from '../systems/drift';
import { gameEvents, toast } from '../systems/events';
import { driftAlong, type Log } from '../systems/towing';
import { owns } from '../systems/valley';
import type { Rect, TowCourse, TowLogSpec } from './TowController';

/** The way a log lies where it enters: along its lane's first stretch (north-south when it rests at the head). */
const axisOf = (path: [number, number][]): 'h' | 'v' => {
  const [a, b] = path;
  if (!a || !b) return 'v';
  return Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? 'h' : 'v';
};

/** The town river's course, or null without drift data (it reads the live game state). */
export function weirCourse(): TowCourse | null {
  const d = driftDef();
  if (!d) return null;
  const world = riverWorld(d);
  const slip = {
    bank: { tx: d.slip.bank[0], ty: d.slip.bank[1] },
    water: { tx: d.slip.water[0], ty: d.slip.water[1] },
  };
  const paths = new Map<number, [number, number][]>();
  let refusedAt = -Infinity;
  const pathOf = (spec: TowLogSpec): [number, number][] => {
    let p = paths.get(spec.key);
    if (!p) paths.set(spec.key, (p = lanePath(d, spec.lane, spec.long)));
    return p;
  };
  const river: Rect = d.river;
  return {
    id: 'weir',
    // the west bank from the head to the bottom and along to the slip
    tiles: d.river[3] + Math.abs(d.slip.water[0] - d.river[0]),
    world,
    water: [river],
    slip,
    snags: d.snags.map(([tx, ty]) => ({ tx, ty })),
    rocks: false,
    respawn: false,
    logs: () =>
      waitingLogs(getState()).map((w) => {
        const path = lanePath(d, w.lane, w.long);
        const [x, y] = path[0] ?? [d.river[0] * TILE_SIZE + 24, d.river[1] * TILE_SIZE + 8];
        return { key: w.slot, lane: w.lane, long: w.long, axis: axisOf(path), x, y };
      }),
    drift(log: Log, spec, w, dtMs) {
      const r = driftAlong(w, log, pathOf(spec), driftSpeed(getState()), dtMs);
      return r === 'moved' ? 'moved' : 'rest';
    },
    along(log: Log) {
      // down the west bank, then along the bottom rows toward the slip
      const ty = Math.floor(log.y / TILE_SIZE);
      if (ty < d.turnRow) return { x: 0, y: 1 };
      return { x: Math.sign(slip.water.tx * TILE_SIZE + 8 - log.x) || 1, y: 0 };
    },
    rest: (spec) => laneRest(d, spec.lane, spec.long),
    canHook: () => owns(getState(), HOOK_ITEM),
    refuse() {
      const now = Date.now();
      if (now - refusedAt < 4000) return;
      refusedAt = now;
      toast(t('tow.needHook'), 'info');
    },
    landed(spec) {
      const res = landLog(getState(), spec.key);
      if (!res.ok) {
        if (res.reason === 'bag') toast(t('tow.bagFull'), 'warn');
        return null;
      }
      gameEvents.emit('inventoryChanged', undefined);
      return res.timber;
    },
  };
}
