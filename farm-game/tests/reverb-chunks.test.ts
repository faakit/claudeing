import { describe, expect, it } from 'vitest';
import { fillImpulse, impulse } from '../src/audio/graph';

/** A tiny stand-in for an AudioContext's buffers (only what the impulse needs). */
function fakeCtx(sampleRate = 8000) {
  return {
    sampleRate,
    createBuffer(channels: number, length: number) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, getChannelData: (c: number) => data[c]! };
    },
  } as unknown as BaseAudioContext;
}

describe('reverb impulse built in chunks (feel round 4: no long frame after the unlocking tap)', () => {
  it('gives the same samples as building it in one go', () => {
    const ctx = fakeCtx();
    const whole = impulse(ctx, 1.4);
    const parts = ctx.createBuffer(2, whole.length, ctx.sampleRate);
    const steps = fillImpulse(ctx, 1.4, parts, 1000);
    let yields = 0;
    while (!steps.next().done) yields++;
    expect(yields).toBeGreaterThan(10);
    for (let c = 0; c < 2; c++) expect(parts.getChannelData(c)).toEqual(whole.getChannelData(c));
  });
});
