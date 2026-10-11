/**
 * Thumb-control geometry, pure (no Phaser): where the floating controls sit and which one a touch belongs to.
 * "Dock" in the names is historical: there is no band behind the controls any more, each floats on its own solid
 * plate over the world (DECISIONS.md "Floating controls"). Right-handed is the reference; left-handed mirrors x.
 * Tests prove reach (see `reach.ts`), that hit areas never steal from each other, and that no control's touch
 * circle reaches the hotbar's touch row.
 */
import { CONTROLS_Y, GAME_HEIGHT, GAME_WIDTH } from '../config';

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
  /** A natural place to start a joystick drag (open world between the controls, no button). */
  stickHome: { x: number; y: number };
  /** Where the first-run "drag to walk" hint sits (in the world view, inside the joystick zone). */
  dragHint: { x: number; y: number };
}

/** Margin of the touch circle beyond the drawn button. */
export const HIT_MARGIN = 8;

/**
 * The solid soil lip under every floating plate (round buttons and hotbar slots), in px below the face: the face
 * sinks onto it when pressed. Inside the touch circle, so it never changes what a touch hits.
 */
export const PLATE_LIP = 2;

/**
 * The floating hotbar: a slim row of solid slot frames hugging the bottom edge, no band behind it. The pitch is the
 * touch floor (24 game px is 38.8 CSS px on the SE and 45.8 on the iPhone 13 at their fitted scales), so the row
 * cannot be narrower; the faces are 2 px narrower than the pitch so the world shows between them.
 */
export const HOTBAR = {
  /** Drawn face, square. */
  slot: 22,
  /** Slot to slot (and the width of each slot's touch zone, so the zones meet and no tap falls between them). */
  pitch: 24,
  /** Px left free under the lip, above the canvas's bottom edge. */
  bottom: 2,
} as const;
/** Top of the slot faces (374): the face, its lip, then `HOTBAR.bottom` px to the edge. */
export const HOTBAR_Y = GAME_HEIGHT - HOTBAR.bottom - PLATE_LIP - HOTBAR.slot;
/** Top of the slots' touch zones: they run from here to the canvas's bottom edge (the selected face rises 2 px). */
export const HOTBAR_HIT_Y = HOTBAR_Y - 1;
/** Left edge of slot `i`'s face, for a row of `n` slots centred on the canvas. */
export const hotbarSlotX = (i: number, n: number): number =>
  Math.round((GAME_WIDTH - (n * HOTBAR.pitch - (HOTBAR.pitch - HOTBAR.slot))) / 2) +
  i * HOTBAR.pitch;

/**
 * Right-handed reference positions, where the thumbs already were with the old dock (floating controls kept them
 * to the pixel). Action rests where the thumb lands, 12 px in from the right edge so its disc stays clear of
 * Android's edge-swipe "back" strip. Interact is a short slide down-left, far enough that Action owns its whole
 * touch circle without covering any of Interact's disc. Menu sits beyond Interact: inside the comfortable arc (owner
 * decision 4), away from the Action thumb's resting arc, and it acts only on a clean release. Every touch circle
 * ends above the hotbar's touch row (unit test).
 */
const REF = {
  action: { x: 160, y: CONTROLS_Y + 36, r: 28 },
  interact: { x: 98, y: CONTROLS_Y + 54, r: 20 },
  menu: { x: 58, y: CONTROLS_Y + 18, r: 16 },
  stickHome: { x: 56, y: CONTROLS_Y + 58 },
  dragHint: { x: 60, y: CONTROLS_Y - 40 },
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
 * Which round control owns a touch at (x, y). A point on a button's drawn disc always belongs to that
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
   * Distance of the item centres from Action's centre. Round 3: 56 -> 64 and a wider arc, so 7 items sit
   * about 10 mm apart even on an SE (8 mm before): a 2 mm scatter picks right 90%+ there and a neighbour ~1%.
   * The lowest item stays inside the canvas (unit test).
   */
  radius: 64,
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

/**
 * A pick goes to the nearest item when it is clearly nearer than the next one (by this share of the spacing
 * between items: a finger between two items picks neither) and within `RING_REACH` px of it (about 9 mm).
 */
export const RING_GAP = 0.15;
export const RING_REACH = 30;
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
 * Which ring item a finger at (dx, dy) from Action's centre picks: the nearest item centre, if it is clearly
 * nearer than the next one and within reach (a zone much bigger than the drawn disc); null inside the dead
 * centre, between two items, or away from the arc. Round 3: by distance rather than by angle, so a finger that
 * lands short of the ring keeps the same tolerance in mm (an angle shrinks toward the centre).
 */
export function ringPick(dx: number, dy: number, n: number, leftHanded: boolean): number | null {
  if (Math.hypot(dx, dy) < RING.dead || n < 1) return null;
  const at = (i: number) => ringItem({ x: 0, y: 0 }, i, n, leftHanded);
  const spacing = n > 1 ? Math.hypot(at(1).x - at(0).x, at(1).y - at(0).y) : RING.radius;
  let best = -1;
  let d1 = Infinity;
  let d2 = Infinity;
  for (let i = 0; i < n; i++) {
    const c = at(i);
    const d = Math.hypot(dx - c.x, dy - c.y);
    if (d < d1) {
      d2 = d1;
      d1 = d;
      best = i;
    } else if (d < d2) d2 = d;
  }
  if (d1 > RING_REACH || d2 - d1 < RING_GAP * spacing) return null;
  return best;
}

/** A button's place in a sheet, sheet-local logical px. */
export interface SheetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The menu's tab strip and its Close button as one two-row grid at the bottom of the sheet (round 5: six 30 px
 * tabs in one row crowded "Make", "Skill" and "Opts"). The tabs fill the rows left to right and Close takes the
 * cells left on the bottom row, on the thumb's side (the left end for the left hand). With six tabs every cell is
 * 48 px wide. The tabs keep their reading order for either hand. `rowsY` are the top edges of the two rows (the
 * old tab row and the old Close row).
 */
export function menuTabGrid(
  tabs: number,
  leftHanded: boolean,
  width = GAME_WIDTH,
  rowsY: [number, number] = [0, 30],
  margin = 2,
  gap = 1,
  h = 22,
): { tabs: SheetRect[]; close: SheetRect } {
  const cols = Math.max(2, Math.ceil((tabs + 2) / 2));
  const cell = (width - 2 * margin - (cols - 1) * gap) / cols;
  const rect = (row: number, col: number, span = 1): SheetRect => {
    const x0 = Math.round(margin + col * (cell + gap));
    const x1 = Math.round(margin + (col + span) * (cell + gap) - gap);
    return { x: x0, y: rowsY[row]!, w: x1 - x0, h };
  };
  // The tabs keep their reading order for either hand; only Close moves to the thumb's side of the bottom row.
  const bottomTabs = Math.max(0, tabs - cols);
  const span = cols - bottomTabs;
  const out: SheetRect[] = [];
  for (let i = 0; i < tabs; i++) {
    if (i < cols) out.push(rect(0, i));
    else out.push(rect(1, i - cols + (leftHanded ? span : 0)));
  }
  return { tabs: out, close: rect(1, leftHanded ? 0 : bottomTabs, span) };
}
