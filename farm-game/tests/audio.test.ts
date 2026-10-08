import { describe, expect, it } from 'vitest';
import { SEASON_MUSIC } from '../src/platform/audio';
import { SEASONS } from '../src/state/GameState';

describe('seasonal music', () => {
  it('has a mood for every season, with sane tempo and chords', () => {
    for (const s of SEASONS) {
      const m = SEASON_MUSIC[s];
      expect(m, s).toBeDefined();
      expect(m!.bpm).toBeGreaterThan(40);
      expect(m!.bpm).toBeLessThan(110);
      expect(m!.melody).toBeGreaterThan(0);
      expect(m!.melody).toBeLessThanOrEqual(1);
      expect(m!.progression).toHaveLength(4);
    }
  });
  it('the seasons do not all sound the same', () => {
    const feel = SEASONS.map((s) => `${SEASON_MUSIC[s]!.bpm}/${SEASON_MUSIC[s]!.transpose}`);
    expect(new Set(feel).size).toBe(4);
  });
});
