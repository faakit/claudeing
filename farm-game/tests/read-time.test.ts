import { describe, expect, it } from 'vitest';
import { READ, readMs, STICKY_TOASTS } from '../src/ui/readTime';
import { tips } from '../src/data';

describe('reading time of self-dismissing text (owner: "a few dialogs are too quick to read")', () => {
  it('is 1.5 s plus 60 ms a character, between 2.5 s and 7 s', () => {
    expect(readMs('Hi')).toBe(READ.min);
    expect(readMs('x'.repeat(30))).toBe(1500 + 60 * 30);
    expect(readMs('x'.repeat(500))).toBe(READ.max);
    // whitespace does not count twice
    expect(readMs('a    b')).toBe(readMs('a b'));
  });

  it('a longer text (Portuguese runs ~25% longer) stays up longer by itself', () => {
    const en = 'Fill the channel in first.';
    const pt = 'Aterre a vala primeiro, por favor.';
    expect(readMs(pt)).toBeGreaterThan(readMs(en));
  });

  it('Calm mode gives half as long again, the cap included', () => {
    const text = 'New kinds of goods go in Menu > Book. Finish a page for gold.';
    expect(readMs(text, true)).toBe(Math.round(readMs(text) * 1.5));
    expect(readMs('x'.repeat(500), true)).toBe(READ.max * 1.5);
  });

  it('every first-time tip gets at least 3.5 s, and tips and refusals wait for a touch', () => {
    for (const tip of tips) expect(readMs(tip.text)).toBeGreaterThanOrEqual(3500);
    expect(STICKY_TOASTS).toEqual(expect.arrayContaining(['warn', 'tip']));
    expect(STICKY_TOASTS).not.toContain('info');
  });
});
