import { describe, expect, it } from 'vitest';
import { dominantDirection } from '../src/systems/direction';

describe('dominantDirection', () => {
  it('returns null inside the deadzone', () => {
    expect(dominantDirection(3, -4, 7)).toBeNull();
  });
  it('picks the stronger axis', () => {
    expect(dominantDirection(20, 5, 7)).toBe('right');
    expect(dominantDirection(-20, 5, 7)).toBe('left');
    expect(dominantDirection(2, -20, 7)).toBe('up');
    expect(dominantDirection(2, 20, 7)).toBe('down');
  });
  it('keeps the current axis near the diagonal (hysteresis)', () => {
    expect(dominantDirection(10, 11, 7, 1.25, 'right')).toBe('right');
    expect(dominantDirection(11, 10, 7, 1.25, 'down')).toBe('down');
  });
  it('switches axis once the other is clearly stronger', () => {
    expect(dominantDirection(10, 20, 7, 1.25, 'right')).toBe('down');
    expect(dominantDirection(20, 10, 7, 1.25, 'down')).toBe('right');
  });
});
