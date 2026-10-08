/**
 * Dock geometry, pure (no Phaser): where the thumb controls sit and which one a touch belongs to.
 * Right-handed is the reference; left-handed mirrors x. Tests prove reach (see `reach.ts`) and that
 * hit areas never steal from each other.
 */
import { DOCK_Y, GAME_WIDTH } from '../config';

export type DockId = 'action' | 'interact' | 'menu';

export interface DockSpot {
  id: DockId;
  /** Centre, logical px. */
  x: number;
  y: number;
  /** Drawn radius. */
  r: number;
  /** Touch radius: a finger-friendly margin beyond the drawn disc. */
  hit: number;
  /** Where touch margins overlap (off every drawn disc), the higher priority wins. */
  priority: number;
}

export interface DockLayout {
  action: DockSpot;
  interact: DockSpot;
  menu: DockSpot;
  /** A natural place to start a joystick drag in the dock (open space, no button). */
  stickHome: { x: number; y: number };
  /** Where the first-run "drag to walk" hint sits (in the world view, inside the joystick zone). */
  dragHint: { x: number; y: number };
}

/** Margin of the touch circle beyond the drawn button. */
export const HIT_MARGIN = 8;

/**
 * Right-handed reference positions. Action rests where the thumb lands, 12 px in from the right edge so
 * its disc stays clear of Android's edge-swipe "back" strip. Interact is a short slide down-left, far enough
 * that Action owns its whole touch circle without covering any of Interact's disc. Menu sits in the open dock beyond Interact: inside the comfortable
 * arc (owner decision 4), away from the Action thumb's resting arc, and it acts only on a clean release.
 */
const REF = {
  action: { x: 160, y: DOCK_Y + 36, r: 28 },
  interact: { x: 98, y: DOCK_Y + 54, r: 20 },
  menu: { x: 58, y: DOCK_Y + 18, r: 16 },
  stickHome: { x: 56, y: DOCK_Y + 58 },
  dragHint: { x: 60, y: DOCK_Y - 40 },
} as const;

export function dockLayout(leftHanded: boolean): DockLayout {
  const mx = (x: number) => (leftHanded ? GAME_WIDTH - x : x);
  const spot = (id: DockId, s: { x: number; y: number; r: number }): DockSpot => ({
    id,
    x: mx(s.x),
    y: s.y,
    r: s.r,
    hit: s.r + HIT_MARGIN,
    priority: id === 'action' ? 2 : 1,
  });
  return {
    action: spot('action', REF.action),
    interact: spot('interact', REF.interact),
    menu: spot('menu', REF.menu),
    stickHome: { x: mx(REF.stickHome.x), y: REF.stickHome.y },
    dragHint: { x: mx(REF.dragHint.x), y: REF.dragHint.y },
  };
}

/**
 * Which dock button owns a touch at (x, y). A point on a button's drawn disc always belongs to that
 * button; in the margins where touch circles overlap, the higher priority wins (Action), then the button
 * whose edge is relatively nearer (distance divided by drawn radius).
 */
export function resolveTouch(
  x: number,
  y: number,
  spots: readonly (DockSpot & { enabled?: boolean })[],
): DockId | null {
  let best: { id: DockId; drawn: boolean; priority: number; score: number } | null = null;
  for (const s of spots) {
    if (s.enabled === false) continue;
    const d = Math.hypot(x - s.x, y - s.y);
    if (d > s.hit) continue;
    const c = { id: s.id, drawn: d <= s.r, priority: s.priority, score: d / s.r };
    const better =
      !best ||
      (c.drawn !== best.drawn
        ? c.drawn
        : c.drawn || c.priority === best.priority
          ? c.score < best.score
          : c.priority > best.priority);
    if (better) best = c;
  }
  return best?.id ?? null;
}
