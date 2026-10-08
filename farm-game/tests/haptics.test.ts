import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  haptic,
  registerHapticsDriver,
  resetHapticGate,
  setHapticsEnabled,
} from '../src/platform/haptics';

describe('haptics', () => {
  afterEach(() => {
    setHapticsEnabled(true);
    resetHapticGate();
    vi.unstubAllGlobals();
  });

  it('uses navigator.vibrate on the web and respects the setting', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    haptic('tick');
    expect(vibrate).toHaveBeenCalledWith(8);
    setHapticsEnabled(false);
    haptic('error');
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('never throws when the browser blocks or lacks vibration', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(() => haptic('success')).not.toThrow();
    vi.stubGlobal('navigator', {});
    expect(() => haptic('success')).not.toThrow();
  });

  it('a registered native driver takes over from the web fallback', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const driver = vi.fn();
    registerHapticsDriver(driver);
    haptic('success');
    expect(driver).toHaveBeenCalledWith('success');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('throttles each kind: ticks at most 1 per 120 ms, errors 1 per 400 ms, held repeats 1 per 450 ms', () => {
    const driver = vi.fn();
    registerHapticsDriver(driver);
    expect(haptic('tick', { at: 1000 })).toBe(true);
    expect(haptic('tick', { at: 1100 })).toBe(false);
    expect(haptic('tick', { at: 1120 })).toBe(true);
    expect(haptic('error', { at: 1000 })).toBe(true);
    expect(haptic('error', { at: 1300 })).toBe(false);
    expect(haptic('error', { at: 1400 })).toBe(true);
    // a held action: the first use ticks, repeats every 200 ms tick only every 450 ms
    resetHapticGate();
    const sent = [0, 200, 400, 600, 800, 1000, 1200].map((t, i) =>
      haptic('tick', { at: 5000 + t, repeat: i > 0 }),
    );
    expect(sent).toEqual([true, false, false, true, false, false, true]);
  });

  it('pulses in the same instant merge: a weaker one is dropped, a stronger one replaces', () => {
    const driver = vi.fn();
    registerHapticsDriver(driver);
    expect(haptic('success', { at: 100 })).toBe(true);
    expect(haptic('tick', { at: 130 })).toBe(false);
    expect(haptic('error', { at: 140 })).toBe(true);
    expect(haptic('tick', { at: 300 })).toBe(true);
  });

  it('vibrate off means zero calls to the driver or navigator.vibrate', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const driver = vi.fn();
    registerHapticsDriver(driver);
    setHapticsEnabled(false);
    for (const k of ['tick', 'medium', 'success', 'error'] as const) haptic(k);
    expect(driver).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
