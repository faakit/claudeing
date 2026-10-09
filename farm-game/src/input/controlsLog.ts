/**
 * Debug instrumentation for controls (PLAN-CONTROLS.md section 5): a short log of what touches and actions did,
 * exposed as `window.__farm.controls` with `?debug`. Never saved; capped so it cannot grow.
 */
import { RING } from '../ui/layout';
import { PAINT_DEADZONE, PAINT_STEP_PX, PAINT_TURN_PX } from './gesture';

export interface ActLog {
  kind: 'act';
  t: number;
  ok: boolean;
  /** What the marker and the Action icon showed the frame before. */
  marked: { slot: number | null; plan: string | null; tx: number; ty: number };
  /** What actually happened. */
  used: { slot: number; plan: string | null; tx: number; ty: number };
}
export interface TouchLog {
  /** 'press': how an Action press resolved (tap, rolled tap, reject), round 3. */
  kind: 'tap' | 'route' | 'paint' | 'silent' | 'press';
  t: number;
  detail: string;
}
export type ControlsEntry = ActLog | TouchLog;

const MAX = 400;

/** The paint gesture's geometry, for the benchmark and probes (logical px from Action). */
const paintGeometry = { step: PAINT_STEP_PX, deadzone: PAINT_DEADZONE, turn: PAINT_TURN_PX };

export const controlsLog = {
  entries: [] as ControlsEntry[],
  paintGeometry,
  /** The tool ring's arc (logical px, screen degrees), for the benchmark and probes. */
  ringGeometry: { radius: RING.radius, from: RING.from, to: RING.to, dead: RING.dead },
  push(e: ControlsEntry): void {
    this.entries.push(e);
    if (this.entries.length > MAX) this.entries.splice(0, this.entries.length - MAX);
  },
  clear(): void {
    this.entries.length = 0;
  },
  /** Acts where the result differed from what the marker and Action icon promised. */
  mismatches(): ActLog[] {
    return this.entries.filter(
      (e): e is ActLog =>
        e.kind === 'act' &&
        e.ok &&
        (e.marked.slot !== e.used.slot ||
          e.marked.plan !== e.used.plan ||
          e.marked.tx !== e.used.tx ||
          e.marked.ty !== e.used.ty),
    );
  },
};
