import { describe, expect, it } from 'vitest';
import { GESTURE, PressTrack, worldRelease } from '../src/input/gesture';
import { dockLayout, resolveTouch } from '../src/ui/layout';
import { logicalPerMm, PHONES, THUMB, zoneAt } from '../src/ui/reach';
import { markerActs, markerKind, MARKER_COLORS } from '../src/ui/targetMarker';
import { cycleSlot } from '../src/systems/inventory';
import { isProduce, shipAllProduce } from '../src/systems/economy';
import { countItem } from '../src/systems/inventory';
import { newState } from './helpers';

/** Deterministic Gaussian samples (Box-Muller over a small LCG), so the jitter tests never flake. */
function gauss(seed: number): () => number {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  return () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
}

describe('dock hit areas', () => {
  for (const left of [false, true]) {
    const L = dockLayout(left);
    const spots = [L.action, L.interact, L.menu];
    const hand = left ? 'left' : 'right';

    it(`${hand}: no drawn discs overlap`, () => {
      for (const a of spots)
        for (const b of spots)
          if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
    });

    it(`${hand}: 0% of Action's drawn disc resolves to Interact, even with Interact showing`, () => {
      let n = 0;
      for (let dx = -L.action.r; dx <= L.action.r; dx += 0.5)
        for (let dy = -L.action.r; dy <= L.action.r; dy += 0.5) {
          if (Math.hypot(dx, dy) > L.action.r) continue;
          expect(resolveTouch(L.action.x + dx, L.action.y + dy, spots)).toBe('action');
          n++;
        }
      expect(n).toBeGreaterThan(9000);
    });

    it(`${hand}: a touch on Interact's or Menu's disc presses that button`, () => {
      expect(resolveTouch(L.interact.x, L.interact.y, spots)).toBe('interact');
      expect(resolveTouch(L.menu.x, L.menu.y, spots)).toBe('menu');
      // a hidden Interact gives its whole area back
      const hidden = spots.map((s) => ({ ...s, enabled: s.id !== 'interact' }));
      expect(resolveTouch(L.interact.x, L.interact.y, hidden)).toBe(null);
    });

    for (const phone of PHONES)
      it(`${hand} ${phone.id}: 500 jittered thumbs aimed inside Action (2.5 mm) rarely press Interact`, () => {
        const g = gauss(left ? 7 : 3);
        let k = left ? 11 : 5;
        const u = () => ((k = (k * 69069 + 1) >>> 0) + 0.5) / 4294967296;
        const sigma = 2.5 * logicalPerMm(phone);
        let toInteract = 0;
        let i = 0;
        while (i < 500) {
          // a true centre uniformly inside Action's drawn disc (edges included: the worst case)
          const cx = (u() * 2 - 1) * L.action.r;
          const cy = (u() * 2 - 1) * L.action.r;
          if (Math.hypot(cx, cy) > L.action.r) continue;
          i++;
          const hit = resolveTouch(
            L.action.x + cx + g() * sigma,
            L.action.y + cy + g() * sigma,
            spots,
          );
          if (hit === 'interact') toInteract++;
        }
        // Action owns its whole touch circle; only a touch that lands beyond it, near Interact, goes there.
        expect(toInteract / 500).toBeLessThanOrEqual(0.01);
        // and a touch that lands anywhere in Action's touch circle never does
        for (let a = 0; a < 360; a += 3) {
          const r = L.action.hit - 0.01;
          const rad = (a * Math.PI) / 180;
          expect(
            resolveTouch(L.action.x + Math.cos(rad) * r, L.action.y + Math.sin(rad) * r, spots),
          ).toBe('action');
        }
      });
  }
});

describe('dock reach (thumb model, both hands)', () => {
  for (const p of PHONES)
    for (const hand of ['right', 'left'] as const) {
      const L = dockLayout(hand === 'left');
      it(`${p.id} ${hand}: Action and Interact are comfortable`, () => {
        expect(zoneAt(p, hand, L.action.x, L.action.y).zone).toBe('comfort');
        expect(zoneAt(p, hand, L.interact.x, L.interact.y).zone).toBe('comfort');
      });
      it(`${p.id} ${hand}: Menu is in reach (comfortable on the primary and small phones)`, () => {
        const z = zoneAt(p, hand, L.menu.x, L.menu.y).zone;
        if (p.weight === 'secondary') expect(z).not.toBe('hard');
        else expect(z).toBe('comfort');
      });
    }

  it('Action keeps 12 px from the screen edge (Android back-swipe strip)', () => {
    const r = dockLayout(false).action;
    expect(200 - (r.x + r.r)).toBeGreaterThanOrEqual(12);
    const l = dockLayout(true).action;
    expect(l.x - l.r).toBeGreaterThanOrEqual(12);
  });
});

describe('world touches: tap or stick, never both', () => {
  it('one threshold: a touch is still exactly until the stick would engage', () => {
    const t = new PressTrack(0, 0, 0);
    t.move(GESTURE.stickDeadzone - 0.01, 0);
    expect(t.still).toBe(true);
    t.move(GESTURE.stickDeadzone, 0);
    expect(t.still).toBe(false);
  });

  it('a still touch is a tap whatever its duration; a stick touch never is', () => {
    for (const ms of [60, 120, 300, 900]) {
      const t = new PressTrack(50, 200, 0);
      t.move(53, 204); // a rolling pad, 5 px
      expect(worldRelease(t, false), `${ms} ms`).toBe('tap');
    }
    const wobble = new PressTrack(50, 200, 0);
    wobble.move(58, 200); // 8 px: still a tap
    expect(worldRelease(wobble, false)).toBe('tap');
    const away = new PressTrack(50, 200, 0);
    away.move(61, 200); // strayed 11 px and came back: never a tap
    away.move(50, 200);
    expect(worldRelease(away, false)).toBe('none');
    expect(worldRelease(new PressTrack(1, 1, 0), true)).toBe('none');
  });
});

describe('target marker', () => {
  it('says what Action will do, by plan kind', () => {
    expect(markerKind({ planKind: 'till', interactable: false })).toBe('work');
    expect(markerKind({ planKind: 'harvest', interactable: false })).toBe('harvest');
    expect(markerKind({ planKind: 'forage', interactable: true })).toBe('harvest');
    expect(markerKind({ planKind: null, interactable: true })).toBe('interact');
    expect(markerKind({ planKind: null, interactable: false })).toBe('none');
  });

  it('yes and no differ in shape, not only colour (readable in greyscale)', () => {
    expect(markerActs('work')).toBe(true);
    expect(markerActs('none')).toBe(false);
    // and "nothing" is the dimmest colour
    const lum = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
    expect(lum(MARKER_COLORS.none)).toBeLessThan(lum(MARKER_COLORS.work));
  });
});

describe('tool swipe skips empty slots', () => {
  it('hoe -> seeds is one swipe down on a fresh game', () => {
    const s = newState();
    s.inventory.slots[6] = null;
    s.inventory.slots[7] = null;
    s.inventory.slots[5] = { item: 'parsnip_seed', qty: 10 };
    s.inventory.selected = 0;
    cycleSlot(s, -1, true);
    expect(s.inventory.selected).toBe(5);
    cycleSlot(s, 1, true);
    expect(s.inventory.selected).toBe(0); // wraps past the empty 7 and 8
    cycleSlot(s, -1); // keyboard / wheel cycling still visits every slot
    expect(s.inventory.selected).toBe(7);
  });
});

describe('ship all produce', () => {
  it('ships every crop, fish and wild good, never seeds, tools or crafting stock', () => {
    const s = newState();
    s.inventory.slots[9] = { item: 'parsnip', qty: 9 };
    s.inventory.slots[10] = { item: 'wild_leek', qty: 3 };
    s.inventory.slots[11] = { item: 'parsnip', qty: 2, q: 2 };
    s.inventory.slots[12] = { item: 'parsnip_seed', qty: 5 };
    const res = shipAllProduce(s);
    expect(res.count).toBe(14);
    expect(res.gold).toBeGreaterThan(0);
    expect(countItem(s, 'parsnip')).toBe(0);
    expect(countItem(s, 'parsnip_seed')).toBeGreaterThanOrEqual(5);
    expect(isProduce('parsnip_seed')).toBe(false);
    expect(shipAllProduce(s).count).toBe(0);
  });
});

describe('benchmark phones match the reach model', () => {
  it('scripts/thumb-lib.mjs and src/ui/reach.ts describe the same phones and thumb', async () => {
    // @ts-expect-error plain .mjs script without types
    const lib = (await import('../scripts/thumb-lib.mjs')) as {
      PROFILES: { id: string; w: number; h: number; dpr: number; ppi: number; chin: number }[];
      THUMB: Record<string, number>;
    };
    expect(lib.THUMB).toEqual({ ...THUMB });
    for (const p of PHONES) {
      const q = lib.PROFILES.find((x) => x.id === p.id);
      expect(q, p.id).toMatchObject({ w: p.w, h: p.h, dpr: p.dpr, ppi: p.ppi, chin: p.chin });
    }
  });
});

describe('mirrored sheet rows (left hand)', () => {
  it('right-handed rows keep the old geometry', async () => {
    const { rowLayout } = await import('../src/ui/layout');
    const r = rowLayout(200, [28, 22, 22], false);
    expect(r.buttonXs).toEqual([
      200 - 8 - 28,
      200 - 8 - 28 - 3 - 22,
      200 - 8 - 28 - 3 - 22 - 3 - 22,
    ]);
    expect(r.textX).toBe(28);
  });

  it('left-handed rows put the primary button at the left edge and the text after the buttons', async () => {
    const { rowLayout } = await import('../src/ui/layout');
    for (const widths of [[44], [28, 22, 22], [44, 30]]) {
      const l = rowLayout(200, widths, true);
      const r = rowLayout(200, widths, false);
      expect(l.buttonXs[0]).toBe(8);
      const lastRight = l.buttonXs[widths.length - 1]! + widths[widths.length - 1]!;
      expect(l.iconX - 7).toBeGreaterThan(lastRight); // the icon never sits on a button
      expect(l.textX + l.maxText).toBeLessThanOrEqual(192);
      expect(l.maxText).toBe(r.maxText); // the same room for text either way
    }
  });
});

describe('tool ring', () => {
  it('every ring item is comfortable for both hands on all five phones, and inside the screen', async () => {
    const { ringItem } = await import('../src/ui/layout');
    for (const p of PHONES)
      for (const hand of ['right', 'left'] as const) {
        const L = dockLayout(hand === 'left');
        for (let i = 0; i < 9; i++) {
          const c = ringItem(L.action, i, 9, hand === 'left');
          expect(zoneAt(p, hand, c.x, c.y).zone, `${p.id} ${hand} item ${i}`).toBe('comfort');
          expect(c.x - 12).toBeGreaterThanOrEqual(0);
          expect(c.x + 12).toBeLessThanOrEqual(200);
          expect(c.y + 12).toBeLessThanOrEqual(400);
        }
      }
  });

  it('a finger picks the item it points at, by angle; the dead centre picks nothing', async () => {
    const { ringItem, ringPick, RING } = await import('../src/ui/layout');
    for (const left of [false, true]) {
      const c = { x: 0, y: 0 };
      for (let i = 0; i < 9; i++) {
        const it = ringItem(c, i, 9, left);
        expect(ringPick(it.x, it.y, 9, left), `${left} ${i}`).toBe(i);
        // a sloppy finger 6 degrees off still picks it
        const a = Math.atan2(it.y, it.x) + (6 * Math.PI) / 180;
        expect(ringPick(Math.cos(a) * 40, Math.sin(a) * 40, 9, left)).toBe(i);
        // half way between two items picks neither (a miss lands on nothing, not on a neighbour)
        if (i < 8) {
          const b = ringItem(c, i + 1, 9, left);
          const mid = Math.atan2(it.y + b.y, it.x + b.x);
          expect(ringPick(Math.cos(mid) * 50, Math.sin(mid) * 50, 9, left)).toBeNull();
        }
      }
      expect(ringPick(5, 5, 9, left)).toBeNull();
      expect(ringPick(left ? -RING.radius : RING.radius, 0, 9, left)).toBeNull(); // toward the edge: nothing
    }
  });

  it('vertical swipes on Action never open the ring', async () => {
    const { ActionPress } = await import('../src/input/gesture');
    for (let ay = 14; ay <= 30; ay += 2)
      for (let ax = 0; ax <= ay; ax += 2) {
        const p = new ActionPress(0);
        const ev = [...p.move(ax / 2, -ay / 2), ...p.move(ax, -ay)];
        expect(ev.some((e) => e.type === 'ring')).toBe(false);
      }
  });
});

describe('tool ring accuracy (model)', () => {
  it('with 7 items, a slide picks its item >= 98% at 1.2 mm and >= 90% (SE, Fold 85%) at 2 mm; a neighbour <= 2%', async () => {
    const { ringItem, ringPick, RING_PULL_MM } = await import('../src/ui/layout');
    const { canvasRect } = await import('../src/ui/reach');
    let seed = 11;
    const u = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
    const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
    for (const p of PHONES)
      for (const left of [false, true]) {
        const px = logicalPerMm(p);
        const ref = 6.3 / canvasRect(p).k; // the game's CSS-reference mm, in logical px
        const c0 = { x: left ? 40 : 160, y: 336 };
        for (const [mm, need] of [
          [1.2, 0.98],
          [2, p.id === 'se' || p.id === 'fold' ? 0.85 : 0.9],
        ] as const) {
          let right = 0;
          let wrong = 0;
          const n = 7;
          const N = 2100;
          for (let r = 0; r < N; r++) {
            const i = r % n;
            const it = ringItem(c0, i, n, left);
            // the critic's thumb: 0.9 mm toward the holding side and 1.2 mm down, plus the scatter
            const x = it.x + g() * mm * px + (left ? -0.9 : 0.9) * px;
            const y = it.y + g() * mm * px + 1.2 * px;
            const cx = x + (left ? 1 : -1) * RING_PULL_MM.side * ref;
            const cy = y - RING_PULL_MM.down * ref;
            const got = ringPick(cx - c0.x, cy - c0.y, n, left);
            if (got === i) right++;
            else if (got !== null) wrong++;
          }
          expect(right / N, `${p.id} ${left} ${mm}`).toBeGreaterThanOrEqual(need);
          expect(wrong / N, `${p.id} ${left} ${mm} wrong`).toBeLessThanOrEqual(0.02);
        }
      }
  });

  it('a slide resting short of the items (22-35 px out) picks nothing', async () => {
    const { ringPick } = await import('../src/ui/layout');
    for (const left of [false, true])
      for (let d = 22; d <= 35; d++)
        for (let deg = 0; deg < 360; deg += 15) {
          const a = (deg * Math.PI) / 180;
          expect(ringPick(Math.cos(a) * d, Math.sin(a) * d, 7, left)).toBeNull();
        }
  });
});
