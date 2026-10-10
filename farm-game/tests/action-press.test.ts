import { describe, expect, it } from 'vitest';
import {
  PAINT_ARM_MS,
  PAINT_DEADZONE,
  PAINT_MAX_TILES,
  PAINT_STEP_PX,
  PAINT_TURN_PX,
  pathTiles,
  type PaintDir,
} from '../src/input/gesture';
import { logicalPerMm, PHONES } from '../src/ui/reach';
import { closedLoop, committed, drawPath, humanPath, play, types, wobble } from './paintModel';

/** Finger distance that aims at the middle of tile `n`'s band, on a first leg or a turned one. */
const at = (n: number, turned = false) =>
  (turned ? PAINT_TURN_PX : PAINT_DEADZONE) + PAINT_STEP_PX * (n - 1) + PAINT_STEP_PX / 2;
/** A 3x3 serpentine: right 3, down 1, left 2, down 1, right 2 (the turn tile starts each row). */
const A3 = at(3);
const U = at(1, true);
const R2 = at(2, true);
const SERP: [number, number][] = [
  [A3, 0],
  [A3, U],
  [A3 - R2, U],
  [A3 - R2, 2 * U],
  [A3, 2 * U],
];
const SERP_PATH = 'right right right down left left down right right';

describe('Action press: tap, swipe, flick, paint stay apart', () => {
  it('a still press acts exactly once however long it is held (owner decision, round 3)', () => {
    for (const ms of [50, 120, 200, 280])
      expect(types(play([[20, 2, 1]], ms)), `${ms}`).toEqual(['tap']);
    for (const ms of [320, 400, 700, 1500])
      expect(types(play([[20, 2, 1]], ms)), `${ms}`).toEqual(['arm', 'cancel', 'tap']);
  });

  it('a press that rolled 9-13 px after being still acts once; one that moved at once says no', () => {
    // still for 150 ms, then the pad rolls toward the thumb base
    for (const roll of [9.5, 11, 13])
      expect(
        types(
          play(
            [
              [150, roll * 0.3, roll * 0.4],
              [180, roll * 0.6, roll * 0.8],
            ],
            260,
          ),
        ),
        `${roll}`,
      ).toEqual(['tap']);
    // a swipe or flick cut short (moved at once): a "no", never a use
    expect(types(play([[40, 9, 0]], 150))).toEqual(['reject']);
    expect(types(play([[40, 6, 7]], 150))).toEqual(['reject']);
    expect(
      types(
        play(
          [
            [30, 0, 6],
            [60, 0, 12],
          ],
          150,
        ),
      ),
    ).toEqual(['reject']);
    // diagonal past 14 px, neither swipe nor flick: a "no"
    expect(
      types(
        play(
          [
            [30, 8, 7],
            [60, 16, 13],
          ],
          150,
        ),
      ),
    ).toEqual(['reject']);
  });

  it('a vertical swipe changes tool and never acts or arms', () => {
    const e = play(
      [
        [30, 0, -6],
        [60, 0, -15],
        [400, 0, -16],
      ],
      600,
    );
    expect(types(e)).toEqual(['step']);
  });

  it('a sideways flick opens the ring and never acts, at any speed from 60 to 200 ms', () => {
    for (const ms of [60, 120, 200]) {
      const moves: [number, number, number][] = [];
      for (let t = 0; t <= ms; t += 20) moves.push([t, -(20 * t) / ms, 1]);
      const e = play(moves, ms + 400);
      expect(types(e), `${ms}`).toEqual(['ring']);
    }
  });

  it('held still 300 ms arms painting; a drag sets the line; lifting commits it', () => {
    const e = play(
      [
        [PAINT_ARM_MS + 40, 6, 0],
        [PAINT_ARM_MS + 80, at(1), 1],
        [PAINT_ARM_MS + 120, at(2), 2],
        [PAINT_ARM_MS + 160, at(3), 3],
      ],
      PAINT_ARM_MS + 300,
    );
    expect(types(e)).toEqual(['arm', 'paint', 'paint', 'paint', 'commit']);
    expect(e.at(-1)).toEqual({
      type: 'commit',
      dir: 'right',
      tiles: 3,
      path: ['right', 'right', 'right'],
    });
  });

  it('a 3 mm wobble across a horizontal line never switches or turns it', () => {
    const e = play(
      [
        [PAINT_ARM_MS + 40, 20, 0],
        [PAINT_ARM_MS + 80, 30, 9],
        [PAINT_ARM_MS + 120, 34, -9],
        [PAINT_ARM_MS + 160, 40, 6],
      ],
      PAINT_ARM_MS + 300,
    );
    const paints = e.filter((x) => x.type === 'paint') as {
      dir: string | null;
      path: PaintDir[];
    }[];
    expect(paints.every((x) => x.dir === 'right' && x.path.every((d) => d === 'right'))).toBe(true);
  });

  it('dragged back to the start cancels with no action', () => {
    const e = types(
      play(
        [
          [PAINT_ARM_MS + 40, 30, 0],
          [PAINT_ARM_MS + 100, 3, 0],
        ],
        PAINT_ARM_MS + 200,
      ),
    );
    expect(e.at(-1)).toBe('cancel');
    expect(e).not.toContain('tap');
  });
});

describe('serpentine paint (owner decision, round 3)', () => {
  it('a 3x3 drawn right, down, left, down, right turns two U-turns into 9 contiguous tiles', () => {
    const e = play(drawPath(SERP), PAINT_ARM_MS + 3000);
    expect(committed(e)).toBe(SERP_PATH);
    const tiles = pathTiles({ tx: 0, ty: 0 }, (e.at(-1) as { path: PaintDir[] }).path);
    expect(new Set(tiles.map((t) => `${t.tx},${t.ty}`)).size).toBe(9);
    expect(tiles.every((t) => t.tx >= 1 && t.tx <= 3 && t.ty >= 0 && t.ty <= 2)).toBe(true);
  });

  it('a column serpentine (up, left, down, left, up) works the same', () => {
    const e = play(
      drawPath([
        [0, -A3],
        [-U, -A3],
        [-U, -A3 + R2],
        [-2 * U, -A3 + R2],
        [-2 * U, -A3],
      ]),
      PAINT_ARM_MS + 3000,
    );
    expect(committed(e)).toBe('up up up left down down left up up');
  });

  it('rows stay inside the first row (an overshoot never paints past the plot); a U-turn steps one row', () => {
    // every leg overshoots by most of a tile, and the U legs are drawn two tiles long
    const e = play(
      drawPath([
        [A3, 0],
        [A3, at(2, true)],
        [A3 - R2 - 14, at(2, true)],
        [A3 - R2 - 14, at(2, true) + at(2, true)],
        [A3 + 14, at(2, true) + at(2, true)],
      ]),
      PAINT_ARM_MS + 4000,
    );
    expect(committed(e)).toBe(SERP_PATH);
  });

  it('drift while drawing along the line never turns', () => {
    // up to 13 px (4 mm on an SE) of drift sideways while drawing three tiles along
    for (const drift of [5, 10, 13]) {
      const e = play(drawPath([[A3, drift]], { pxPerMs: 0.05 }), PAINT_ARM_MS + 3000);
      expect(committed(e), `${drift}`).toBe('right right right');
    }
    // a slow sideways drift of up to 3 mm at the end of the line, without a deliberate turn
    for (const p of PHONES) {
      const e = play(
        drawPath(
          [
            [A3, 0],
            [A3, 3 * logicalPerMm(p)],
          ],
          { pxPerMs: 0.03 },
        ),
        PAINT_ARM_MS + 4000,
      );
      expect(committed(e), p.id).toBe('right right right');
    }
  });

  it('a long row drawn as a thumb arc (3 mm of sag over 9 tiles) never turns', () => {
    for (const p of PHONES) {
      const len = at(9);
      const sag = 3 * logicalPerMm(p);
      const pts: [number, number][] = [];
      for (let k = 1; k <= 12; k++) {
        const x = (len * k) / 12;
        pts.push([-x, -sag * (1 - ((2 * x) / len - 1) ** 2)]);
      }
      const e = play(drawPath(pts), PAINT_ARM_MS + 4000);
      expect(committed(e), p.id).toBe(Array(9).fill('left').join(' '));
    }
  });

  it('a deliberate perpendicular move of 6 mm turns, on every phone', () => {
    for (const p of PHONES) {
      const e = play(
        drawPath([
          [A3, 0],
          [A3, 6 * logicalPerMm(p)],
        ]),
        PAINT_ARM_MS + 3000,
      );
      expect(committed(e), p.id).toMatch(/^right right right down/);
    }
  });

  it('backtracking un-paints tile by tile, round corners too; back to the start cancels', () => {
    const e = play(
      drawPath([
        [A3, 0],
        [A3, U],
        [A3 - R2, U],
        [A3, U],
        [A3, 0],
        [0, 0],
      ]),
      PAINT_ARM_MS + 4000,
    );
    const lengths = e.filter((x) => x.type === 'paint').map((x) => (x as { tiles: number }).tiles);
    const peak = lengths.indexOf(Math.max(...lengths));
    expect(Math.max(...lengths)).toBe(6);
    for (let i = peak + 1; i < lengths.length; i++) expect(lengths[i - 1]! - lengths[i]!).toBe(1);
    expect(e.at(-1)!.type).toBe('cancel');
    expect(types(e)).not.toContain('tap');
  });

  it('never revisits a tile or the farmer, and stops at the cap', () => {
    // right 3, up 1, back left past the farmer's column, then down: the farmer's tile is never painted
    const e = play(
      drawPath([
        [A3, 0],
        [A3, -U],
        [-20, -U],
        [-20, 40],
      ]),
      PAINT_ARM_MS + 4000,
    );
    const path = (e.at(-1) as { path: PaintDir[] }).path;
    const tiles = pathTiles({ tx: 0, ty: 0 }, path).map((t) => `${t.tx},${t.ty}`);
    expect(new Set(tiles).size).toBe(tiles.length);
    expect(tiles).not.toContain('0,0');
    // a long serpentine (5 wide, many rows) stops at the cap
    const zig: [number, number][] = [];
    const w = at(5);
    for (let r = 0; r < 6; r++) zig.push([r % 2 ? 4 : w, r * U], [r % 2 ? 4 : w, (r + 1) * U]);
    const z = play(drawPath(zig), PAINT_ARM_MS + 20000);
    expect((z.at(-1) as { tiles: number }).tiles).toBe(PAINT_MAX_TILES);
  });

  it('lateral wobble model (i13, SE, Fold): straight 3-tile lines are exact and never turn', () => {
    for (const id of ['i13', 'se', 'fold']) {
      const mm = logicalPerMm(PHONES.find((x) => x.id === id)!);
      for (const [sigma, need] of [
        [1, 0.95],
        [2, 0.95],
        [3, 0.85],
      ] as const) {
        let exact = 0;
        let turned = 0;
        for (let k = 0; k < 100; k++) {
          const e = play(
            drawPath([[A3, 0]], { lateral: wobble(sigma * mm, k * 7 + 1) }),
            PAINT_ARM_MS + 3000,
          );
          const got = committed(e);
          if (got === 'right right right') exact++;
          if (typeof got === 'string' && /up|down/.test(got)) turned++;
        }
        expect(exact / 100, `${id} straight sigma ${sigma}`).toBeGreaterThanOrEqual(need);
        expect(turned, `${id} straight sigma ${sigma} turns`).toBeLessThanOrEqual(
          sigma === 3 ? 1 : 0,
        );
      }
    }
  });

  it("the critic's 2D wobble model (corners cut 2 mm, 0-2 mm overshoot): a 3x3 serpentine at 1 mm", () => {
    for (const id of ['i13', 'pixel7', 'se', 'promax', 'fold']) {
      const mm = logicalPerMm(PHONES.find((x) => x.id === id)!);
      let exact = 0;
      let stray = 0;
      for (let k = 0; k < 100; k++) {
        const m = humanPath(SERP, { pxPerMm: mm, sigmaMm: 1, cornerMm: 2, seed: k * 31 + 7 });
        const c = play(m, m.at(-1)![0] + 150).at(-1);
        if (c?.type !== 'commit') continue;
        if (c.path.join(' ') === SERP_PATH) exact++;
        stray += pathTiles({ tx: 0, ty: 0 }, c.path).filter(
          (t) => t.tx < 1 || t.tx > 3 || t.ty < 0 || t.ty > 2,
        ).length;
      }
      expect(exact, `${id} exact`).toBeGreaterThanOrEqual(88);
      // a shown tile is never taken back at a corner (review 6), so a rare 2.5-sigma overshoot of the first row
      // (about 3 in 100 on an SE) widens the plot by one column
      expect(stray, `${id} stray`).toBeLessThanOrEqual(10);
    }
  });

  it('a shown tile never flickers: a 1-2 px wobble at its boundary, or a turn, never takes it back', () => {
    const b = at(3) - PAINT_STEP_PX / 2; // the third tile's boundary
    const moves: [number, number, number][] = [];
    let t = PAINT_ARM_MS + 40;
    for (let x = 0; x <= b + 1; x += 2) moves.push([(t += 16), x, 0]);
    for (const dx of [-1, 1, -2, 1, -2, 2, -1]) moves.push([(t += 16), b + dx, 0]);
    const e = play(moves, t + 100);
    const counts = e.filter((x) => x.type === 'paint').map((x) => (x as { tiles: number }).tiles);
    expect(counts).toEqual([1, 2, 3]);
  });

  it("the critic's closed-loop painter (turns when the preview shows the leg): every tile it saw is kept", () => {
    const legs = [
      { dx: -1, dy: 0, n: 3 },
      { dx: 0, dy: 1, n: 1 },
      { dx: 1, dy: 0, n: 2 },
      { dx: 0, dy: 1, n: 1 },
      { dx: -1, dy: 0, n: 2 },
    ];
    const want = 'left left left down right right down left left';
    for (const id of ['i13', 'se']) {
      const mm = logicalPerMm(PHONES.find((x) => x.id === id)!);
      for (const [sigma, need] of [
        [1, 100],
        [2, 80],
      ] as const) {
        let exact = 0;
        for (let k = 0; k < 100; k++) {
          const r = closedLoop(legs, { pxPerMm: mm, sigmaMm: sigma, seed: k * 31 + 7 });
          if (r.path?.join(' ') === want) exact++;
          if (sigma === 1) expect(r.ticks, `${id} ticks`).toBe(r.path?.length);
        }
        expect(exact, `${id} closed loop sigma ${sigma}`).toBeGreaterThanOrEqual(need);
      }
    }
  });
});
