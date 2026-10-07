import { describe, expect, it } from 'vitest';
import { adjustVolume, toggleMute } from '../src/systems/settings';
import { faceDirection } from '../src/systems/movement';
import { newState } from './helpers';

describe('settings & facing', () => {
  it('volume steps in 10% increments and clamps', () => {
    const s = newState();
    s.settings.music = 0.6;
    expect(adjustVolume(s, 'music', 0.1)).toBe(0.7);
    for (let i = 0; i < 20; i++) adjustVolume(s, 'music', 0.1);
    expect(s.settings.music).toBe(1);
    for (let i = 0; i < 20; i++) adjustVolume(s, 'sfx', -0.1);
    expect(s.settings.sfx).toBe(0);
  });
  it('avoids floating point drift (0.1 + 0.2 style)', () => {
    const s = newState();
    s.settings.sfx = 0;
    for (let i = 0; i < 3; i++) adjustVolume(s, 'sfx', 0.1);
    expect(s.settings.sfx).toBe(0.3);
  });
  it('toggles mute', () => {
    const s = newState();
    expect(toggleMute(s)).toBe(true);
    expect(toggleMute(s)).toBe(false);
  });
  it('faceDirection only changes facing', () => {
    const s = newState();
    const { x, y } = s.player;
    faceDirection(s.player, 'left');
    expect(s.player).toMatchObject({ facing: 'left', x, y });
  });
});

describe('vibration setting', () => {
  it('defaults on and toggles', async () => {
    const { toggleVibration } = await import('../src/systems/settings');
    const s = newState();
    expect(s.settings.vibrate).toBe(true);
    expect(toggleVibration(s)).toBe(false);
    expect(toggleVibration(s)).toBe(true);
  });
});
