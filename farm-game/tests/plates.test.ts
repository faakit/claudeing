import { describe, expect, it } from 'vitest';
import { HOTBAR_Y, controlPlates, dockLayout, liftClear } from '../src/ui/layout';

describe('world text keeps clear of the floating control plates (integration review)', () => {
  const L = dockLayout(false);
  const plates = controlPlates(L, true);
  const box = (cx: number, bottom: number, w = 20, h = 7) => ({
    x0: cx - w / 2,
    y0: bottom - h,
    x1: cx + w / 2,
    y1: bottom,
  });

  it('a label in the open stays put', () => {
    expect(liftClear(box(100, 200), plates, 74)).toBe(0);
  });

  it('a price label under the Menu plate rises just above its disc (the SE case on tap-retarget-walk)', () => {
    const b = box(L.menu.x, L.menu.y + 4);
    const dy = liftClear(b, plates, 74);
    expect(dy).toBeGreaterThan(0);
    // lifted, it clears every plate, and one px less would not
    expect(liftClear({ ...b, y0: b.y0 - dy, y1: b.y1 - dy }, plates, 74)).toBe(0);
    expect(liftClear({ ...b, y0: b.y0 - dy + 1, y1: b.y1 - dy + 1 }, plates, 74)).toBeGreaterThan(
      0,
    );
  });

  it('beside a disc (outside its round edge) nothing moves; Interact counts only while it shows', () => {
    expect(liftClear(box(L.menu.x + L.menu.r + 12, L.menu.y), plates, 74)).toBe(0);
    const onInteract = box(L.interact.x, L.interact.y);
    expect(liftClear(onInteract, plates, 74)).toBeGreaterThan(0);
    expect(liftClear(onInteract, controlPlates(L, false), 74)).toBe(0);
  });

  it('over the hotbar it clears the row and any disc above it, and never rises past the top', () => {
    const b = box(100, HOTBAR_Y + 10);
    const dy = liftClear(b, plates, 74);
    expect(b.y1 - dy).toBeLessThanOrEqual(HOTBAR_Y - 2);
    expect(liftClear(b, plates, b.y0 - 2)).toBe(0); // no room above: it stays
  });

  it('mirrors for the left hand', () => {
    const left = dockLayout(true);
    expect(
      liftClear(box(left.menu.x, left.menu.y), controlPlates(left, false), 74),
    ).toBeGreaterThan(0);
  });
});
