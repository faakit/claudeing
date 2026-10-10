import { MANIFEST } from './assets';
import type { SampleBank } from './bank';
import { playSample } from './voice';
import type { Voice } from './voice';

/** Repeats of one cue closer than this (seconds) count as a held tool. */
export const REPEAT_WINDOW = 0.35;

/** Random spread helper: uniform in [-1, 1]. */
const spread = (rng: () => number) => rng() * 2 - 1;

/**
 * Sound effects from files: several takes per cue (never the same take twice in a row), a little
 * random pitch and volume so repeated sounds do not fatigue, and a voice cap per cue (the oldest
 * copy fades out to make room) so rapid steps or watering never pile up.
 */
export class SfxPlayer {
  private voices = new Map<string, Voice[]>();
  private last = new Map<string, number>();
  private lastAt = new Map<string, number>();
  private maskedUntil = new Map<string, number>();
  readonly stats = { played: 0, fallback: 0, dropped: 0 };

  constructor(
    private ctx: BaseAudioContext,
    private bank: SampleBank,
    private dest: AudioNode,
    private rng: () => number = Math.random,
  ) {}

  /** Decode every sfx file (they are small). */
  preload(): Promise<unknown> {
    return Promise.all(
      Object.values(MANIFEST.sfx).flatMap((s) =>
        s.files.map((z) => this.bank.load(this.ctx, z.file, z.onset)),
      ),
    );
  }

  /** True if the cue played from a file; false means the caller should use the synth. */
  play(cue: string, now: number): boolean {
    const a = MANIFEST.sfx[cue];
    if (!a || a.files.length === 0) return false;
    // Too soon after the last copy (minGap), or masked by another cue: handled, by staying silent.
    const prevPlayed = this.lastAt.get(cue);
    if (
      (a.minGap && prevPlayed !== undefined && now - prevPlayed < a.minGap) ||
      (this.maskedUntil.get(cue) ?? -1) > now
    ) {
      this.stats.dropped++;
      return true;
    }
    const ready = a.files
      .map((z, i) => ({ z, i, d: this.bank.get(z.file, now) }))
      .filter((x) => x.d);
    if (ready.length === 0) {
      a.files.forEach((z) => void this.bank.load(this.ctx, z.file, z.onset));
      this.stats.fallback++;
      return false;
    }
    const prev = this.last.get(cue);
    const options = ready.length > 1 ? ready.filter((x) => x.i !== prev) : ready;
    const pick = options[Math.floor(this.rng() * options.length)]!;
    this.last.set(cue, pick.i);
    const live = (this.voices.get(cue) ?? []).filter((v) => v.end > now);
    while (live.length >= Math.max(1, a.voices)) live.shift()!.stop(now, 0.03);
    const rate = Math.pow(2, (spread(this.rng) * a.pitch) / 12);
    // A held Action repeats a tool every ~200 ms: repeats that close are played 4 dB softer, so a
    // row of watering is a steady pour at the level of one can, not a pile-up.
    const prevAt = this.lastAt.get(cue);
    const repeatDuck =
      prevAt !== undefined && now - prevAt < REPEAT_WINDOW
        ? Math.pow(10, (a.repeatDb ?? -4) / 20)
        : 1;
    this.lastAt.set(cue, now);
    for (const m of a.masks ?? []) this.maskedUntil.set(m, now + (a.maskFor ?? 0.08));
    const gain = a.gain * repeatDuck * Math.pow(10, (spread(this.rng) * a.vol) / 20);
    live.push(playSample(this.ctx, pick.d!, pick.z, this.dest, { when: now, rate, gain }));
    this.voices.set(cue, live);
    this.stats.played++;
    return true;
  }
}
