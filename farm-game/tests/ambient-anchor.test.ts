import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));

import { Ambient, EmitArea, FLOCK, Flock, parseBlooms, type View } from '../src/fx/Ambient';
import type { GameState } from '../src/state/GameState';

const loadMap = (id: string) =>
  JSON.parse(readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')) as Parameters<
    typeof parseBlooms
  >[0];

describe('ambient life stays in the world when the camera moves (owner bug, round 3)', () => {
  it('maps list flower patches for butterflies outdoors, none indoors', () => {
    for (const id of ['farm', 'town', 'woods']) {
      const b = parseBlooms(loadMap(id));
      expect(b.length, id).toBeGreaterThan(4);
      const m = JSON.parse(readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')) as {
        width: number;
        height: number;
      };
      for (const p of b) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.y).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(m.width * 16);
        expect(p.y).toBeLessThan(m.height * 16);
      }
    }
    expect(parseBlooms(loadMap('mine'))).toEqual([]);
  });

  it('a butterfly flies the same path whether the camera sits still or scrolls', () => {
    const spots = parseBlooms(loadMap('farm'));
    const player = { x: spots[0]!.x + 10, y: spots[0]!.y + 10 };
    const still = new Flock(spots, 2, player, 42);
    const moving = new Flock(spots, 2, player, 42);
    for (let i = 0; i < 400; i++) {
      const v0: View = { x: player.x - 100, y: player.y - 150, width: 200, height: 300 };
      // a camera that wobbles and pans up to 40 px either way (the player stays put)
      const v1: View = { ...v0, x: v0.x + 40 * Math.sin(i / 9), y: v0.y + 30 * Math.cos(i / 13) };
      still.step(16, v0, player);
      moving.step(16, v1, player);
    }
    expect(moving.flies).toEqual(still.flies);
    // and they stay around their patches instead of crossing the screen
    for (const f of still.flies)
      expect(Math.hypot(f.x - f.home.x, f.y - f.home.y)).toBeLessThan(FLOCK.roam + 16);
  });

  it('re-homes a butterfly near the player, entering from off-screen, once the player is far away', () => {
    const spots = parseBlooms(loadMap('farm'));
    const start = { x: spots[0]!.x, y: spots[0]!.y };
    const flock = new Flock(spots, 1, start, 7);
    const far = { x: start.x, y: start.y + 400 };
    const v: View = { x: far.x - 100, y: far.y - 150, width: 200, height: 300 };
    flock.step(16, v, far);
    const f = flock.flies[0]!;
    expect(Math.hypot(f.home.x - far.x, f.home.y - far.y)).toBeLessThanOrEqual(FLOCK.far);
    const inside = f.x > v.x && f.x < v.x + v.width && f.y > v.y && f.y < v.y + v.height;
    expect(inside).toBe(false);
    for (let i = 0; i < 200; i++) flock.step(16, v, far);
    expect(Math.hypot(f.x - f.home.x, f.y - f.home.y)).toBeLessThan(FLOCK.roam + 16);
  });

  it('keeps the particle emitter at the world origin and moves only its emit zone with the view', () => {
    const view = { x: 0, y: 0, width: 200, height: 300 };
    const emitter = {
      x: 0,
      y: 0,
      setPosition: vi.fn(),
      setDepth() {
        return this;
      },
      destroy: vi.fn(),
      forEachAlive: vi.fn(),
    };
    const made: { x: number; y: number; cfg: { emitZone: { source: EmitArea } } }[] = [];
    const img = {
      setDepth: () => img,
      setPosition: () => img,
      setFlipX: () => img,
      setFrame: () => img,
      destroy: vi.fn(),
    };
    const scene = {
      cameras: { main: { worldView: view } },
      textures: { exists: () => true, get: () => ({ has: () => true }) },
      add: {
        particles: (x: number, y: number, _k: string, cfg: (typeof made)[0]['cfg']) => {
          made.push({ x, y, cfg });
          emitter.x = x;
          emitter.y = y;
          return emitter;
        },
        image: () => img,
      },
    };
    const state = {
      settings: { reduceMotion: false },
      time: { season: 'spring', minutes: 700 },
      weather: 'sunny',
      player: { x: 100, y: 150 },
    } as unknown as GameState;
    const amb = new Ambient(scene as never, 'farm', true, parseBlooms(loadMap('farm')));
    amb.update(0, state);
    expect(made).toHaveLength(1);
    expect([made[0]!.x, made[0]!.y]).toEqual([0, 0]);
    const area = made[0]!.cfg.emitZone.source;
    for (let i = 1; i <= 30; i++) {
      view.x = i * 7;
      view.y = i * 5;
      amb.update(i * 16, state);
      expect(area.x).toBe(view.x);
      expect(area.y).toBe(view.y - 12);
      const p = area.getRandomPoint({ x: 0, y: 0 });
      expect(p.x).toBeGreaterThanOrEqual(view.x);
      expect(p.x).toBeLessThanOrEqual(view.x + view.width);
    }
    expect(emitter.setPosition).not.toHaveBeenCalled();
    expect([emitter.x, emitter.y]).toEqual([0, 0]);
    // reduced motion clears everything
    amb.update(999, { ...state, settings: { reduceMotion: true } } as unknown as GameState);
    expect(emitter.destroy).toHaveBeenCalled();
    expect(amb.debugPositions()).toEqual({ motes: [], flies: [] });
  });
});
