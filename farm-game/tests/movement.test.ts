import { describe, expect, it } from 'vitest';
import { PLAYER_HITBOX, PLAYER_SPEED } from '../src/config';
import { spawnPosition, type PlayerState } from '../src/state/GameState';
import { boxBlocked, createGrid, stepPlayer } from '../src/systems/movement';

const TS = 16;
/** '#' = solid, '.' = open */
function gridFrom(rows: string[]) {
  return createGrid(
    rows[0]!.length,
    rows.length,
    TS,
    rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))),
  );
}
function playerAt(tx: number, ty: number, dx = 0): PlayerState {
  const p = spawnPosition(tx, ty);
  return { map: 'test', x: p.x + dx, y: p.y, facing: 'down' };
}
function run(p: PlayerState, dir: PlayerState['facing'], frames: number, grid = ARENA) {
  for (let i = 0; i < frames; i++) stepPlayer(p, dir, 16, grid);
}

const ARENA = gridFrom(['#####', '#...#', '#...#', '#...#', '#####']);

describe('collision', () => {
  it('treats out-of-map as solid', () => {
    expect(boxBlocked(ARENA, -50, -50, PLAYER_HITBOX)).toBe(true);
  });

  it('moves at PLAYER_SPEED in open space', () => {
    const p = playerAt(1, 1);
    const x0 = p.x;
    stepPlayer(p, 'right', 100, ARENA); // clamped to MAX_FRAME_MS (50)
    expect(p.x - x0).toBeCloseTo(PLAYER_SPEED * 0.05);
  });

  it('stops flush against a wall and cannot cross it', () => {
    const p = playerAt(1, 1);
    run(p, 'right', 200);
    expect(p.x).toBeCloseTo(4 * TS - PLAYER_HITBOX.halfW);
    run(p, 'up', 200);
    expect(p.y).toBeCloseTo(1 * TS + PLAYER_HITBOX.h);
    run(p, 'left', 200);
    expect(p.x).toBeCloseTo(1 * TS + PLAYER_HITBOX.halfW);
    run(p, 'down', 200);
    expect(p.y).toBeCloseTo(4 * TS);
    expect(boxBlocked(ARENA, p.x, p.y, PLAYER_HITBOX)).toBe(false);
  });

  it('never tunnels through a wall on a huge frame delta', () => {
    const p = playerAt(3, 3);
    for (let i = 0; i < 20; i++) stepPlayer(p, 'right', 5000, ARENA);
    expect(boxBlocked(ARENA, p.x, p.y, PLAYER_HITBOX)).toBe(false);
  });

  it('turns to face a wall without moving', () => {
    const p = playerAt(3, 1);
    run(p, 'right', 50);
    const r = stepPlayer(p, 'right', 16, ARENA);
    expect(r.moving).toBe(false);
    expect(p.facing).toBe('right');
  });

  it('does nothing without input', () => {
    const p = playerAt(2, 2);
    const before = { ...p };
    expect(stepPlayer(p, null, 16, ARENA).moving).toBe(false);
    expect(p).toEqual(before);
  });
});

describe('corner assist', () => {
  // One-tile doorway in the top wall at column 2.
  const DOOR = gridFrom(['##.##', '#...#', '#...#', '#####']);

  it('slides into a doorway when slightly misaligned', () => {
    const p = playerAt(2, 2, 3); // 3px right of the doorway center
    run(p, 'up', 120, DOOR);
    expect(p.y).toBeLessThan(1 * TS); // made it through into the doorway tile
  });

  it('does not slide when far off the doorway', () => {
    const p = playerAt(0, 2);
    p.x = 1 * TS + 6; // hitbox flush with col 1, doorway is col 2
    run(p, 'up', 120, DOOR);
    expect(p.y).toBeGreaterThanOrEqual(1 * TS + PLAYER_HITBOX.h - 0.01);
  });
});
