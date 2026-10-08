import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultControlSettings, STATE_VERSION } from '../src/state/GameState';
import { migrate } from '../src/systems/save';
import {
  cycleStickSize,
  sanitizeControlSettings,
  sanitizeLastSeed,
  toggleControl,
} from '../src/systems/settings';
import { measureText } from '../src/ui/fontMetrics';
import { controlLabels } from '../src/ui/panels/ControlsTab';
import { newState } from './helpers';

describe('control settings (save v16)', () => {
  it('a real v15 save migrates with the owner defaults on and keeps everything else', () => {
    const raw = JSON.parse(readFileSync('tests/fixtures/save-v15.json', 'utf8'));
    expect(raw.version).toBe(15);
    const s = migrate(raw);
    expect(s.version).toBe(STATE_VERSION);
    expect(s.settings.controls).toEqual(defaultControlSettings());
    expect(s.settings.controls.autoTool && s.settings.controls.tapToMove).toBe(true);
    expect(s.controls.lastSeed).toBeNull();
    // what the player had is untouched
    expect(s.settings.leftHanded).toBe(true);
    expect(s.settings.vibrate).toBe(false);
    expect(s.time.day).toBe(3);
    expect(Object.keys(s.farm.tiles)).toEqual(['10,18']);
  });

  it('garbage control settings are clamped to defaults field by field', () => {
    expect(sanitizeControlSettings(null)).toEqual(defaultControlSettings());
    expect(sanitizeControlSettings([1, 2])).toEqual(defaultControlSettings());
    expect(
      sanitizeControlSettings({
        autoTool: 'yes',
        tapToMove: false,
        paint: 0,
        stickSize: 'xl',
        twoSpeed: true,
      }),
    ).toEqual({ ...defaultControlSettings(), tapToMove: false, twoSpeed: true });
    expect(sanitizeLastSeed('parsnip_seed')).toBe('parsnip_seed');
    expect(sanitizeLastSeed('parsnip')).toBeNull(); // not a seed
    expect(sanitizeLastSeed('nope')).toBeNull();
    expect(sanitizeLastSeed(7)).toBeNull();
  });

  it('a damaged v16 save loads with sane controls', () => {
    const s = JSON.parse(JSON.stringify(newState()));
    s.settings.controls = 'broken';
    s.controls = { lastSeed: { evil: true } };
    const out = migrate(s);
    expect(out.settings.controls).toEqual(defaultControlSettings());
    expect(out.controls.lastSeed).toBeNull();
  });

  it('settings survive a save and load', () => {
    const s = newState();
    toggleControl(s, 'autoTool');
    cycleStickSize(s);
    s.controls.lastSeed = 'parsnip_seed';
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.settings.controls.autoTool).toBe(false);
    expect(back.settings.controls.stickSize).toBe('l');
    expect(back.controls.lastSeed).toBe('parsnip_seed');
  });

  it('every Controls button label fits its half-width button, in every state', () => {
    const s = newState();
    for (const flip of [false, true]) {
      if (flip) {
        for (const k of ['autoTool', 'tapToMove', 'paint', 'twoSpeed'] as const)
          toggleControl(s, k);
        s.settings.leftHanded = !s.settings.leftHanded;
        s.settings.vibrate = !s.settings.vibrate;
      }
      for (let i = 0; i < 3; i++) {
        cycleStickSize(s);
        for (const l of controlLabels(s)) expect(measureText(l), l).toBeLessThanOrEqual(86);
      }
    }
  });
});
