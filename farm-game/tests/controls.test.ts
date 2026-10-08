import { describe, expect, it } from 'vitest';
import {
  actionDrag,
  GESTURE,
  holdMayStart,
  HOLD_ACTION_MS,
  PressTrack,
  worldRelease,
} from '../src/input/gesture';
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

    it(`${hand}: 500 jittered thumbs aimed inside Action (2.5 mm, iPhone 13) rarely press Interact`, () => {
      const g = gauss(left ? 7 : 3);
      let k = left ? 11 : 5;
      const u = () => ((k = (k * 69069 + 1) >>> 0) + 0.5) / 4294967296;
      const sigma = 2.5 * logicalPerMm(PHONES[0]!);
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
  it('the stick deadzone is wider than the tap tolerance', () => {
    expect(GESTURE.stickDeadzone).toBeGreaterThan(GESTURE.tapMaxMove);
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

describe('Action: hold, swipe, roll', () => {
  it('a swipe step needs a full mostly-vertical step', () => {
    expect(actionDrag(0, -13)).toBe('none');
    expect(actionDrag(2, -14)).toBe('swipeUp');
    expect(actionDrag(-3, 15)).toBe('swipeDown');
    expect(actionDrag(10, -14)).toBe('swipeUp'); // an arcing thumb still swipes
    expect(actionDrag(16, 2)).toBe('flick');
    expect(actionDrag(12, 11)).toBe('none'); // a diagonal smear is nothing
  });

  /** Replay a press: moves at given times (dy), sampled each 16 ms frame; when does the hold start? */
  function holdStart(moves: [number, number][], until = 1200): number | null {
    let dy = 0;
    let mark = 0;
    let movedAt = 0;
    for (let t = 0; t <= until; t += 16) {
      for (const [mt, mdy] of moves)
        if (mt <= t && mt > t - 16) {
          if (Math.abs(mdy - mark) >= 0.5) {
            movedAt = mt;
            mark = mdy;
          }
          dy = mdy;
        }
      if (Math.abs(dy) >= GESTURE.swipeStep) return null; // a tool step happened first
      if (holdMayStart(t, dy, t - movedAt)) return t;
    }
    return null;
  }

  it('a still press starts working after the hold delay', () => {
    expect(holdStart([])).toBe(Math.ceil(HOLD_ACTION_MS / 16) * 16);
  });

  it('a 2.5 mm or 3 mm roll of the pad (any direction) still starts the hold, soon after it settles', () => {
    const px = logicalPerMm(PHONES[0]!);
    for (const [mm, ux, uy] of [
      [2.5, 0, 1],
      [2.5, 0.6, 0.8],
      [3, 0.6, 0.8],
      [3, 0, -1],
    ] as const) {
      const dy = mm * px * uy;
      const at = holdStart([[40, dy]]);
      expect(at, `${mm} mm`).not.toBeNull();
      expect(at!).toBeLessThanOrEqual(HOLD_ACTION_MS + 16);
      void ux;
    }
  });

  it('a swipe (60 ms to 1 s for 18 px) reaches its tool step before any hold', () => {
    // moves arrive every 16 ms (a phone: up to a 1 s crawl) or every 40 ms (a slow harness: up to 500 ms)
    for (const every of [16, 40])
      for (const ms of every === 16 ? [60, 150, 300, 500, 1000] : [60, 150, 300, 500]) {
        const moves: [number, number][] = [];
        for (let t = 0; t < ms; t += every) moves.push([t, (-18 * t) / ms]);
        moves.push([ms, -18]);
        expect(holdStart(moves), `${ms} ms every ${every}`).toBeNull();
      }
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
