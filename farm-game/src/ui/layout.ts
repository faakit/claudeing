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

/** Where a sheet row's parts go: the buttons on the thumb's side, the icon and text on the other. */
export interface RowLayout {
  iconX: number;
  textX: number;
  maxText: number;
  /** Left edge of each button, in the order given (the first is the primary, nearest the thumb). */
  buttonXs: number[];
}

/**
 * Lay out one sheet row (`Modal.row`). Right-handed: icon and text on the left, buttons from the right edge
 * inward. Left-handed (mirrored sheets): buttons from the left edge inward, icon and text after them, so the
 * left thumb reaches the buttons without crossing the sheet.
 */
export function rowLayout(
  panelW: number,
  widths: readonly number[],
  leftHanded: boolean,
): RowLayout {
  const gap = 3;
  const margin = 8;
  const total = widths.reduce((w, b) => w + b + gap, 0);
  const buttonXs: number[] = [];
  if (!leftHanded) {
    let x = panelW - margin;
    for (const w of widths) {
      x -= w;
      buttonXs.push(x);
      x -= gap;
    }
    return { iconX: 15, textX: 28, maxText: panelW - margin - 28 - total - 2, buttonXs };
  }
  let x = margin;
  for (const w of widths) {
    buttonXs.push(x);
    x += w + gap;
  }
  const start = margin + total;
  return {
    iconX: start + 7,
    textX: start + 20,
    maxText: panelW - margin - (start + 20) - 2,
    buttonXs,
  };
}

/** The tool ring: 8 hotbar slots and "Bag" on an arc around Action, on the side away from the screen edge. */
export const RING = {
  /**
   * Distance of the item centres from Action's centre. Round 3: 56 -> 60 and a wider arc, so 7 items sit
   * 9 mm apart even on an SE (8 mm before): enough that a 2 mm scatter picks right 88%+ and a neighbour < 2%.
   */
  radius: 60,
  /** Item disc radius. */
  itemR: 12,
  /** Arc (screen angles, y down, right-handed): from a little right of straight up (285) round the left to low. */
  from: 285,
  to: 105,
  /**
   * Fingers nearer the centre than this pick nothing (a rest there leaves the tap menu). 36 px is well past a
   * flick's 14-26 px and well short of the items at 60 (round 3; was 22, which let a slide resting short of
   * the items pick the one it pointed at).
   */
  dead: 36,
} as const;

/** Half-width of a pick sector, in item steps (0.5 would leave no gap between neighbours). */
export const RING_SECTOR = 0.4;
/**
 * A finger resting on a ring item sits about 1.5 mm toward the thumb base (0.9 mm toward the holding side,
 * 1.2 mm down: the controls critic's thumb model); ring picks correct for all of it (taps on the world correct
 * for 0.7 mm, see `compensateTouch`). In CSS-reference mm.
 */
export const RING_PULL_MM = { side: 0.9, down: 1.2 } as const;

/** Centre of ring item `i` of `n` (logical px). Left-handed mirrors the arc. */
export function ringItem(
  centre: { x: number; y: number },
  i: number,
  n: number,
  leftHanded: boolean,
): { x: number; y: number } {
  const t = n <= 1 ? 0.5 : i / (n - 1);
  let deg = RING.from + (RING.to - RING.from) * t;
  if (leftHanded) deg = 180 - deg;
  const r = (deg * Math.PI) / 180;
  return { x: centre.x + Math.cos(r) * RING.radius, y: centre.y + Math.sin(r) * RING.radius };
}

/**
 * Which ring item a finger at (dx, dy) from Action's centre points at: by angle (a whole sector, much bigger
 * than the drawn disc), or null inside the dead centre or outside the arc.
 */
export function ringPick(dx: number, dy: number, n: number, leftHanded: boolean): number | null {
  if (Math.hypot(dx, dy) < RING.dead || n < 1) return null;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (leftHanded) deg = 180 - deg;
  deg = ((deg % 360) + 360) % 360;
  const step = n > 1 ? (RING.from - RING.to) / (n - 1) : 30;
  // position along the arc, 0 at `from`, n-1 at `to`
  const along = (RING.from - deg) / step;
  const i = Math.round(along) + 0; // never -0
  // Gaps between sectors: a finger between two items picks neither (a miss lands on nothing).
  if (i < 0 || i >= n || Math.abs(along - i) > RING_SECTOR) return null;
  return i;
}
