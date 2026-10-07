import { describe, expect, it, vi } from 'vitest';
import { InputHub } from '../src/input/InputHub';

describe('InputHub', () => {
  it('uses the most recently pressed key and falls back on release', () => {
    const hub = new InputHub();
    hub.pressKey('left');
    hub.pressKey('up');
    expect(hub.direction).toBe('up');
    hub.releaseKey('up');
    expect(hub.direction).toBe('left');
    hub.releaseKey('left');
    expect(hub.direction).toBeNull();
  });

  it('lets the joystick override the keyboard', () => {
    const hub = new InputHub();
    hub.pressKey('left');
    hub.setStick('down');
    expect(hub.direction).toBe('down');
    hub.setStick(null);
    expect(hub.direction).toBe('left');
  });

  it('clearHeld drops everything (no stuck keys after blur)', () => {
    const hub = new InputHub();
    hub.pressKey('left');
    hub.setStick('up');
    hub.clearHeld();
    expect(hub.direction).toBeNull();
  });

  it('emits events and supports unsubscribe', () => {
    const hub = new InputHub();
    const fn = vi.fn();
    const off = hub.on('tap', fn);
    hub.emit('tap', { x: 1, y: 2 });
    off();
    hub.emit('tap', { x: 3, y: 4 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ x: 1, y: 2 });
  });
});
