import { describe, expect, it, vi } from 'vitest';
import { TypedEmitter } from '../src/systems/events';

describe('TypedEmitter', () => {
  it('delivers payloads to every subscriber and stops after unsubscribe', () => {
    const em = new TypedEmitter();
    const a = vi.fn();
    const b = vi.fn();
    const offA = em.on('toast', a);
    em.on('toast', b);
    em.emit('toast', { text: 'hi' });
    offA();
    em.emit('toast', { text: 'again' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenLastCalledWith({ text: 'again' });
  });

  it('emitting an event with no listeners is a no-op', () => {
    expect(() => new TypedEmitter().emit('farmChanged', undefined)).not.toThrow();
  });

  it('events are independent', () => {
    const em = new TypedEmitter();
    const money = vi.fn();
    em.on('moneyChanged', money);
    em.emit('toast', { text: 'x' });
    expect(money).not.toHaveBeenCalled();
  });
});
