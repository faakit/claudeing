import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));

import { ambientPlan } from '../src/fx/Ambient';
import { GLOW_SHAPES, glowPixel, parseLights } from '../src/fx/NightGlow';

describe('ambient life', () => {
  it('fits the season: petals, seeds, leaves, snow', () => {
    expect(ambientPlan('farm', true, 'spring', 700, 'sunny')?.frames).toEqual(['fx_petal']);
    expect(ambientPlan('farm', true, 'summer', 700, 'sunny')?.frames).toEqual(['fx_seed']);
    expect(ambientPlan('farm', true, 'fall', 700, 'sunny')?.frames).toContain('fx_leaf_o');
    expect(ambientPlan('farm', true, 'winter', 700, 'sunny')?.frames).toEqual(['fx_snow']);
  });
  it('keeps butterflies to fine days and nothing drifts in the rain or at night (fireflies glow instead)', () => {
    expect(ambientPlan('woods', true, 'spring', 700, 'sunny')!.butterflies).toBeGreaterThan(0);
    expect(ambientPlan('woods', true, 'fall', 700, 'sunny')!.butterflies).toBe(0);
    expect(ambientPlan('woods', true, 'spring', 1300, 'sunny')).toBeNull();
    expect(ambientPlan('farm', true, 'spring', 700, 'rain')).toBeNull();
  });
  it('is sparse: a touch of life, never weather', () => {
    for (const season of ['spring', 'summer', 'fall', 'winter'])
      for (const map of ['farm', 'town', 'woods']) {
        const p = ambientPlan(map, true, season, 700, 'sunny')!;
        expect(p.max, `${map} ${season}`).toBeLessThanOrEqual(36);
      }
  });
  it('drifts dust motes indoors only in the house and the mine', () => {
    expect(ambientPlan('mine', false, 'spring', 700, 'sunny')?.frames).toEqual(['fx_px']);
    expect(ambientPlan('house', false, 'spring', 700, 'sunny')).not.toBeNull();
  });
});

describe('night glow shapes', () => {
  it('steps down from the core in three rings with a dithered edge, nothing outside', () => {
    const lamp = GLOW_SHAPES.lamp!;
    expect(glowPixel(lamp, 0, 0)!.alpha).toBe(lamp.alphas[0]);
    expect(glowPixel(lamp, 3, 0)!.alpha).toBe(lamp.alphas[1]);
    expect(glowPixel(lamp, 8, 0)!.alpha).toBe(lamp.alphas[2]);
    expect(glowPixel(lamp, 13, 0)!.alpha).toBe(lamp.alphas[3]);
    expect(glowPixel(lamp, 30, 0)).toBeNull();
    // only the bulb is bright: every ring outside the core stays low, so nothing clips to white
    for (const sh of Object.values(GLOW_SHAPES))
      sh.alphas.slice(1).forEach((x) => expect(x).toBeLessThan(0.5));
    // across a ring edge, neighbouring pixels alternate (checker dither), never a smooth gradient
    const r = lamp.radii[1]!;
    const a = glowPixel(lamp, r, 0)!.alpha;
    const b = glowPixel(lamp, r, 1)!.alpha;
    expect(a).not.toBe(b);
  });
  it('spills window light as stripes on the ground below the pane, not as a disc on the wall', () => {
    const win = GLOW_SHAPES.window!;
    expect(glowPixel(win, 0, 1)).not.toBeNull(); // the pane
    expect(glowPixel(win, 0, 6)).toBeNull(); // the gap under the sill
    expect(glowPixel(win, 0, 10)).toBeNull(); // nothing on the wall below the window
    expect(glowPixel(win, 0, 12)).not.toBeNull(); // first stripe, on the ground
    expect(glowPixel(win, 0, 13)).toBeNull(); // stripes on every other row
    expect(glowPixel(win, 8, 22)).not.toBeNull(); // wider further down
    expect(glowPixel(win, 8, 12)).toBeNull();
  });
  it('every map light has a shape, and maps light their lamps and windows', () => {
    let count = 0;
    for (const id of ['farm', 'town', 'mine', 'house']) {
      const lights = parseLights(
        JSON.parse(readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')) as Parameters<
          typeof parseLights
        >[0],
      );
      for (const l of lights) expect(GLOW_SHAPES[l.kind], `${id} ${l.kind}`).toBeDefined();
      count += lights.length;
    }
    expect(count).toBeGreaterThan(20);
  });
});
