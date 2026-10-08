import type { Decoded } from './bank';
import type { Zone } from './types';

export interface VoiceOptions {
  when: number;
  /** Playback rate (pitch shift); 1 = as recorded. */
  rate?: number;
  /** Peak linear gain. */
  gain: number;
  /** Note length in seconds; omitted = let the sample play out. */
  dur?: number;
  attack?: number;
  release?: number;
  /** Start this many seconds into the sample (after priming compensation). */
  skip?: number;
}

export interface Voice {
  src: AudioBufferSourceNode;
  env: GainNode;
  /** When the voice is silent and stopped. */
  end: number;
  /** Fade out quickly from `at` (voice stealing, piece changes). */
  stop(at: number, fade?: number): void;
}

/**
 * Play one decoded sample through a gain envelope into `dest`. Loops sustain samples between the
 * zone's loop points (shifted by the decoder priming offset) for as long as the note lasts.
 */
export function playSample(ctx: BaseAudioContext, d: Decoded, zone: Zone, dest: AudioNode, o: VoiceOptions): Voice {
  const rate = o.rate ?? 1;
  const src = ctx.createBufferSource();
  src.buffer = d.buffer;
  src.playbackRate.value = rate;
  const env = ctx.createGain();
  const attack = Math.max(0.002, o.attack ?? 0.002);
  const release = Math.max(0.01, o.release ?? 0.08);
  const t0 = o.when;
  const offset = d.offset + (o.skip ?? 0);
  const natural = (d.buffer.duration - offset) / rate;
  let end: number;
  if (zone.loop) {
    src.loop = true;
    src.loopStart = zone.loop[0] + d.offset;
    src.loopEnd = zone.loop[1] + d.offset;
  }
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(o.gain, t0 + attack);
  if (o.dur !== undefined && (zone.loop || o.dur < natural)) {
    const off = t0 + Math.max(attack, o.dur);
    env.gain.setValueAtTime(o.gain, off);
    env.gain.setTargetAtTime(0, off, release / 3);
    end = off + release * 1.6;
  } else end = t0 + natural;
  src.connect(env).connect(dest);
  src.start(t0, offset);
  src.stop(end + 0.02);
  return {
    src,
    env,
    end,
    stop(at: number, fade = 0.04) {
      if (at >= this.end) return;
      holdAt(env.gain, at);
      env.gain.setTargetAtTime(0, at, fade / 3);
      try {
        src.stop(at + fade * 2);
      } catch {
        /* already stopped */
      }
      this.end = at + fade * 2;
    },
  };
}

/** Freeze an automated value at `at` (so a new ramp starts from where the old one was, no jump). */
export function holdAt(p: AudioParam, at: number): void {
  const hold = (p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }).cancelAndHoldAtTime;
  if (hold) hold.call(p, at);
  else {
    p.cancelScheduledValues(at);
    p.setValueAtTime(p.value, at);
  }
}

/** Smoothly move a gain to `value` (time constant tau) from whatever it is doing now. */
export function glide(p: AudioParam, value: number, now: number, tau: number): void {
  holdAt(p, now);
  p.setTargetAtTime(value, now, tau);
}
