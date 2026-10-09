import { describe, expect, it } from 'vitest';
import { JOYSTICK, SETTLE_BACK_PX, TURN_HOLD_MS } from '../src/config';
import { dominantDirection } from '../src/systems/direction';
import { spawnPosition, type Direction, type PlayerState } from '../src/state/GameState';
import {
  createGrid,
  createMoveState,
  settleTarget,
  stepMove,
  type MoveState,
} from '../src/systems/movement';
import { playerTile } from '../src/systems/world';

const TS = 16;
function gridFrom(rows: string[]) {
  return createGrid(
    rows[0]!.length,
    rows.length,
    TS,
    rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))),
  );
}
const OPEN = gridFrom([
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '##########',
]);

function at(tx: number, ty: number, facing: Direction = 'down'): PlayerState {
  return { map: 't', ...spawnPosition(tx, ty), facing };
}

/** Push `dir` for `ms` (16 ms frames), then release and let any settle finish. */
function push(p: PlayerState, m: MoveState, dir: Direction | null, ms: number, grid = OPEN) {
  let moved = 0;
  for (let t = 16; t <= ms; t += 16) if (stepMove(p, m, dir, 16, grid).moving) moved++;
  return moved;
}
const release = (p: PlayerState, m: MoveState, grid = OPEN) => push(p, m, null, 400, grid);

describe('turn in place', () => {
  it('a 60 or 90 ms flick in a new direction turns and ends on the same spot', () => {
    for (const ms of [60, 90]) {
      const p = at(4, 3, 'down');
      const start = { x: p.x, y: p.y };
      const m = createMoveState();
      push(p, m, 'right', ms);
      expect(p.facing).toBe('right');
      release(p, m);
      expect(p.x, `${ms} ms`).toBeCloseTo(start.x, 5);
      expect(p.y).toBeCloseTo(start.y, 5);
    }
  });

  it('flicks up to 150 ms in a new direction never change tile', () => {
    for (const ms of [60, 100, 140, 150]) {
      const p = at(4, 3, 'down');
      const m = createMoveState();
      push(p, m, 'left', ms);
      release(p, m);
      expect(playerTile(p), `${ms} ms`).toEqual({ tx: 4, ty: 3 });
      expect(p.facing).toBe('left');
    }
  });

  it('a 60 ms push the way you already face walks at once', () => {
    const p = at(4, 3, 'right');
    const m = createMoveState();
    const x0 = p.x;
    stepMove(p, m, 'right', 16, OPEN);
    expect(p.x).toBeGreaterThan(x0);
  });

  it('a held push in a new direction starts walking after the turn hold', () => {
    const p = at(4, 3, 'down');
    const m = createMoveState();
    const x0 = p.x;
    push(p, m, 'right', TURN_HOLD_MS - 10);
    expect(p.x).toBe(x0);
    push(p, m, 'right', 200);
    expect(p.x).toBeGreaterThan(x0 + 8);
  });

  it('changing direction while walking adds no delay', () => {
    const p = at(4, 3, 'right');
    const m = createMoveState();
    push(p, m, 'right', 160);
    const y0 = p.y;
    stepMove(p, m, 'down', 16, OPEN);
    expect(p.y).toBeGreaterThan(y0);
  });
});

describe('short pushes are steps, never rubber bands', () => {
  /** Push, release, settle; report tiles moved and the largest slide back from the furthest point. */
  function nudge(dir: Direction, facing: Direction, ms: number) {
    const p = at(4, 3, facing);
    const m = createMoveState();
    const axis = dir === 'left' || dir === 'right' ? 'x' : 'y';
    const sign = dir === 'right' || dir === 'down' ? 1 : -1;
    const start = p[axis];
    let furthest = 0;
    for (let t = 16; t <= ms; t += 16) {
      // whole 16 ms frames inside the push (a 150 ms push spans 9 frames)
      stepMove(p, m, dir, 16, OPEN);
      furthest = Math.max(furthest, (p[axis] - start) * sign);
    }
    for (let t = 0; t < 400; t += 16) {
      stepMove(p, m, null, 16, OPEN);
      furthest = Math.max(furthest, (p[axis] - start) * sign);
    }
    const moved = ((p[axis] - start) * sign) / TS;
    return { tiles: Math.round(moved), slideBack: furthest - (p[axis] - start) * sign };
  }

  it('a push the way you face of 100 ms or more is exactly one tile (up to ~250 ms)', () => {
    for (const ms of [100, 130, 160, 200, 240])
      expect(nudge('right', 'right', ms).tiles, `${ms}`).toBe(1);
  });

  it('a new-direction push of 150 ms or less stays; longer ones step one tile', () => {
    for (const ms of [60, 100, 150]) expect(nudge('down', 'right', ms).tiles, `${ms}`).toBe(0);
    for (const ms of [200, 260, 300]) expect(nudge('down', 'right', ms).tiles, `${ms}`).toBe(1);
  });

  it('no push under 250 ms slides back more than 4 px', () => {
    for (const facing of ['right', 'up'] as const)
      for (let ms = 16; ms < 250; ms += 16)
        expect(nudge('right', facing, ms).slideBack, `${facing} ${ms}`).toBeLessThanOrEqual(4);
  });
});

describe('settle on release', () => {
  it('released less than SETTLE_BACK_PX past a centre: back to it; further: on to the next', () => {
    const c = spawnPosition(4, 3);
    expect(settleTarget(c.x + 10, 'x', 1, OPEN, c.y)).toBe(c.x);
    expect(settleTarget(c.x + 14, 'x', 1, OPEN, c.y)).toBe(c.x + 16);
    expect(settleTarget(c.x - 10, 'x', -1, OPEN, c.y)).toBe(c.x);
    expect(settleTarget(c.y + 11, 'y', 1, OPEN, c.x)).toBe(c.y);
    expect(settleTarget(c.x, 'x', 1, OPEN, c.y)).toBeNull();
    expect(SETTLE_BACK_PX).toBe(13);
  });

  it('after every release the player rests on a tile centre', () => {
    for (const ms of [100, 150, 230, 300, 410, 520]) {
      for (const dir of ['right', 'down', 'left', 'up'] as const) {
        const p = at(4, 3, dir);
        const m = createMoveState();
        push(p, m, dir, ms);
        release(p, m);
        const t = playerTile(p);
        const c = spawnPosition(t.tx, t.ty);
        expect(Math.abs(p.x - c.x), `${dir} ${ms}`).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y - c.y), `${dir} ${ms}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a person who lets go 120-180 ms after the sprite looked centred lands on that tile', () => {
    for (const reaction of [120, 150, 180]) {
      const p = at(2, 3, 'right');
      const m = createMoveState();
      const target = spawnPosition(5, 3).x;
      let t = 0;
      while (p.x < target) {
        stepMove(p, m, 'right', 16, OPEN);
        t += 16;
      }
      push(p, m, 'right', reaction);
      release(p, m);
      expect(playerTile(p).tx, `${reaction} ms`).toBe(5);
      void t;
    }
  });

  it('settles in at most 120 ms', () => {
    const p = at(4, 3, 'right');
    const m = createMoveState();
    p.x += SETTLE_BACK_PX - 0.01; // just short of the back window
    m.moving = true;
    m.axis = 'x';
    m.sign = 1;
    let frames = 0;
    stepMove(p, m, null, 16, OPEN);
    while (m.settle !== null && frames < 50) {
      stepMove(p, m, null, 16, OPEN);
      frames++;
    }
    expect((frames + 1) * 16).toBeLessThanOrEqual(128);
  });

  it('never settles into a blocked tile', () => {
    const wall = gridFrom(['#######', '#..#..#', '#######']);
    const c = spawnPosition(2, 1);
    // 13 px past the centre would mean "forward", but the next tile is a wall: back instead
    expect(settleTarget(c.x + 13, 'x', 1, wall, c.y)).toBe(c.x);
  });
});

describe('diagonal drags', () => {
  it('a thumb held at 40-50 degrees with ~1 mm of drift flips axis at most once a second (mean)', () => {
    for (const deg of [40, 45, 50]) {
      let total = 0;
      for (let seed = 1; seed <= 30; seed++) {
        let s = seed * 7919;
        const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
        const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
        let jx = 0;
        let jy = 0;
        let cur: Direction | null = null;
        let flips = 0;
        const a = (deg * Math.PI) / 180;
        for (let f = 0; f < 600; f++) {
          // drift is a slow random walk of the pad (3 logical px ~ 1 mm on an iPhone 13), 10 s at 60 fps
          jx = jx * 0.9 + g() * 3 * 0.44;
          jy = jy * 0.9 + g() * 3 * 0.44;
          const d = dominantDirection(
            18 * Math.cos(a) + jx,
            -18 * Math.sin(a) + jy,
            4.5,
            JOYSTICK.axisBias,
            cur,
          );
          if (cur && d !== cur) flips++;
          cur = d;
        }
        total += flips / 10;
      }
      // 1.25 (the old bias) flipped 2.0 to 2.4 times a second in this model
      expect(total / 30, `${deg} deg`).toBeLessThanOrEqual(1);
    }
  });
});
