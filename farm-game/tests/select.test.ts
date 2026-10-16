// The map behind `npm run verify:changed` (scripts/lib/select.mjs): which browser suites a change needs.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain .mjs script without types
import { SUITES, blocksUsing, scenarioBlocks, select } from '../scripts/lib/select.mjs';

type Pick = { suites: string[]; blocks: string[] | null; why: string[] };
const pick = select as (files: string[], src?: string) => Pick;
const src = readFileSync('scripts/e2e-scenarios.mjs', 'utf8');

describe('verify:changed selection', () => {
  it('words and unit tests need no browser', () => {
    expect(pick(['docs/EXTENDING.md', 'agents/TOOLING.md', 'tests/sim.test.ts']).suites).toEqual(
      [],
    );
  });

  it('a suite script selects that suite', () => {
    expect(pick(['scripts/e2e-onboarding.mjs']).suites).toEqual(['e2e:onboarding']);
    expect(pick(['scripts/e2e.mjs']).suites).toEqual(['e2e']);
    expect(pick(['scripts/perf.mjs']).suites).toEqual(['perf']);
  });

  it('a scenario fixture selects only the scenario blocks that open it', () => {
    const r = pick(['src/dev/scenarios/tut-job-board.json'], src);
    expect(r.suites).toEqual(['e2e:scenarios']);
    expect(r.blocks).toContain('guidedDepth');
    expect(r.blocks).toContain('everyScenario');
    expect(r.blocks).not.toContain('towing');
  });

  it('every block a fixture selects is one e2e:scenarios runs, helpers resolved to their callers', () => {
    const blocks: string[] = scenarioBlocks(src);
    expect(blocks).toContain('smoke');
    expect(blocks).toContain('sheetTaps');
    const all = readdirSync('src/dev/scenarios')
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5));
    for (const name of all)
      for (const b of blocksUsing(src, name) as string[]) expect(blocks).toContain(b);
    expect(blocksUsing(src, 'ripe-plot').length).toBeGreaterThan(0);
    // stoneWalk is a helper: its scenario selects the blocks that call it
    expect(blocksUsing(src, 'tut-stone-before-site')).toEqual(['guidedDepth', 'stoneWalks']);
  });

  it('game code selects the broad suites; the guided start adds the onboarding bot', () => {
    expect(pick(['src/systems/farming.ts']).suites).toEqual(['e2e', 'e2e:scenarios']);
    expect(pick(['src/data/tutorial.json']).suites).toContain('e2e:onboarding');
    expect(pick(['src/input/InputHub.ts']).suites).toContain('e2e:controls');
    expect(pick(['src/fx/Wipe.ts']).suites).toContain('perf');
  });

  it('scenario blocks never narrow a suite something else selects whole', () => {
    const r = pick(['src/dev/scenarios/tut-job-board.json', 'src/systems/farming.ts'], src);
    expect(r.blocks).toBeNull();
    expect(r.suites).toContain('e2e:scenarios');
  });

  it('anything unknown (dependencies, config, public assets) selects every suite', () => {
    expect(pick(['package.json']).suites).toEqual(SUITES);
    expect(pick(['public/assets/audio/sfx/hoe.ogg']).suites).toEqual(SUITES);
    expect(pick(['scripts/thumb-lib.mjs']).suites).toEqual(SUITES);
  });
});
