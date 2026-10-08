import { MANIFEST } from './assets';
import type { SampleBank } from './bank';
import { playSample } from './voice';
import type { Voice } from './voice';

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
  readonly stats = { played: 0, fallback: 0 };

  constructor(
    private ctx: BaseAudioContext,
    private bank: SampleBank,
    private dest: AudioNode,
    private rng: () => number = Math.random,
  ) {}

  /** Decode every sfx file (they are small). */
  preload(): Promise<unknown> {
    return Promise.all(
      Object.values(MANIFEST.sfx).flatMap((s) => s.files.map((z) => this.bank.load(this.ctx, z.file, z.onset))),
    );
  }

  /** True if the cue played from a file; false means the caller should use the synth. */
  play(cue: string, now: number): boolean {
    const a = MANIFEST.sfx[cue];
    if (!a || a.files.length === 0) return false;
    const ready = a.files.map((z, i) => ({ z, i, d: this.bank.get(z.file, now) })).filter((x) => x.d);
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
    const gain = a.gain * Math.pow(10, (spread(this.rng) * a.vol) / 20);
    live.push(playSample(this.ctx, pick.d!, pick.z, this.dest, { when: now, rate, gain }));
    this.voices.set(cue, live);
    this.stats.played++;
    return true;
  }
}
