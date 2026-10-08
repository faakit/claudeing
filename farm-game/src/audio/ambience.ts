import { MANIFEST } from './assets';
import type { SampleBank } from './bank';
import { glide, playSample } from './voice';

interface Bed {
  src: AudioBufferSourceNode | null;
  gain: GainNode;
  target: number;
  quietSince: number;
  /** Slow random drift of the level, so a 10 s loop does not sound like one. */
  drift: number;
}

/**
 * Background ambience: seamless loop beds (rain, crickets, wind, cave) faded by intensity, and pools
 * of one-shots scattered at random times, positions and pitches (birds, drips), which repeat far
 * less audibly than any loop. Beds silent for a while are stopped to save the audio thread.
 */
export class Ambience {
  private beds = new Map<string, Bed>();
  private targets = new Map<string, number>();
  private nextShot = new Map<string, number>();
  private lastShot = new Map<string, number>();

  constructor(
    private ctx: BaseAudioContext,
    private bank: SampleBank,
    private dest: AudioNode,
    private rng: () => number = Math.random,
  ) {}

  /** Can this bed or pool play from files (decoded now)? */
  available(name: string): boolean {
    const a = MANIFEST.ambience[name];
    return !!a && a.files.some((z) => this.bank.get(z.file));
  }

  /** Has every file of this bed or pool failed to load? */
  failed(name: string): boolean {
    const a = MANIFEST.ambience[name];
    return !a || a.files.every((z) => this.bank.failed(z.file));
  }

  preload(name: string): Promise<unknown> {
    const a = MANIFEST.ambience[name];
    return Promise.all((a?.files ?? []).map((z) => this.bank.load(this.ctx, z.file, z.onset)));
  }

  set(name: string, target: number): void {
    const v = Math.max(0, Math.min(1, target));
    if (v > 0 && !this.targets.get(name)) void this.preload(name);
    this.targets.set(name, v);
  }

  tick(now: number, enabled: boolean): void {
    for (const [name, a] of Object.entries(MANIFEST.ambience)) {
      const target = enabled ? (this.targets.get(name) ?? 0) : 0;
      if (a.mode === 'loop') this.tickBed(name, target * a.gain, now);
      else this.tickShots(name, target, a.every ?? 4, now);
    }
  }

  private tickBed(name: string, target: number, now: number): void {
    let bed = this.beds.get(name);
    if (!bed) {
      if (target <= 0) return;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.dest);
      bed = { src: null, gain, target: 0, quietSince: now, drift: 1 };
      this.beds.set(name, bed);
    }
    if (!bed.src && target > 0) {
      const zone = MANIFEST.ambience[name]!.files[0]!;
      const d = this.bank.get(zone.file, now);
      if (d && zone.loop) {
        const src = this.ctx.createBufferSource();
        src.buffer = d.buffer;
        src.loop = true;
        src.loopStart = zone.loop[0] + d.offset;
        src.loopEnd = zone.loop[1] + d.offset;
        // Start somewhere random in the loop so two sessions never line up the same way.
        src.start(now, zone.loop[0] + d.offset + this.rng() * (zone.loop[1] - zone.loop[0]));
        src.connect(bed.gain);
        bed.src = src;
      }
    }
    bed.drift = Math.max(0.7, Math.min(1.1, bed.drift + (this.rng() - 0.5) * 0.04));
    const level = target * bed.drift;
    if (Math.abs(level - bed.target) > 0.01) {
      glide(bed.gain.gain, level, now, 1.2);
      bed.target = level;
    }
    if (target > 0) bed.quietSince = now;
    else if (now - bed.quietSince > 8 && bed.src) {
      bed.src.stop();
      bed.src.disconnect();
      bed.src = null;
    }
  }

  private tickShots(name: string, target: number, every: number, now: number): void {
    if (target <= 0) {
      this.nextShot.delete(name);
      return;
    }
    const due = this.nextShot.get(name);
    if (due === undefined) {
      this.nextShot.set(name, now + this.rng() * every);
      return;
    }
    if (now < due) return;
    this.nextShot.set(name, now + (every / target) * (0.4 + this.rng() * 1.2));
    const a = MANIFEST.ambience[name]!;
    const ready = a.files.map((z, i) => ({ z, i, d: this.bank.get(z.file, now) })).filter((x) => x.d);
    if (ready.length === 0) return;
    const prev = this.lastShot.get(name);
    const options = ready.length > 1 ? ready.filter((x) => x.i !== prev) : ready;
    const pick = options[Math.floor(this.rng() * options.length)]!;
    this.lastShot.set(name, pick.i);
    let dest: AudioNode = this.dest;
    let pan: StereoPannerNode | null = null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      pan = this.ctx.createStereoPanner();
      pan.pan.value = (this.rng() * 2 - 1) * 0.8;
      pan.connect(this.dest);
      dest = pan;
    }
    const rate = 0.92 + this.rng() * 0.16;
    const gain = a.gain * target * Math.pow(10, (-6 * this.rng()) / 20);
    let last = playSample(this.ctx, pick.d!, pick.z, dest, { when: now + 0.02, rate, gain });
    // A bird often answers itself.
    if (name === 'birds' && this.rng() < 0.3) {
      const when = now + 0.2 + this.rng() * 0.3;
      const answer = playSample(this.ctx, pick.d!, pick.z, dest, { when, rate: rate * 1.05, gain: gain * 0.7 });
      if (answer.end > last.end) last = answer;
    }
    if (pan) {
      const p = pan;
      last.src.addEventListener('ended', () => p.disconnect());
    }
  }
}
