import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic, registerHapticsDriver, setHapticsEnabled } from '../src/platform/haptics';

describe('haptics', () => {
  afterEach(() => {
    setHapticsEnabled(true);
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
});
