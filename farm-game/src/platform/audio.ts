/**
 * Procedural audio: every sound effect and the music are synthesized with Web Audio,
 * so the prototype ships with zero audio files. Real assets (M7) can replace `play`.
 */
export type Sfx =
  | 'till'
  | 'water'
  | 'refill'
  | 'plant'
  | 'harvest'
  | 'cut'
  | 'coin'
  | 'buy'
  | 'ui'
  | 'door'
  | 'stepGrass'
  | 'stepWood'
  | 'error'
  | 'sleep'
  | 'goal'
  | 'swing'
  | 'select';

// A major pentatonic keeps any random melody pleasant.
const PENTA = [0, 2, 4, 7, 9];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// Four-chord loop: C, Am, F, G (root MIDI, quality as semitone offsets).
const PROGRESSION: { root: number; chord: number[] }[] = [
  { root: 48, chord: [0, 4, 7, 11] },
  { root: 45, chord: [0, 3, 7, 10] },
  { root: 41, chord: [0, 4, 7, 11] },
  { root: 43, chord: [0, 4, 7, 9] },
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private dayBus!: GainNode;
  private nightBus!: GainNode;
  private noise!: AudioBuffer;
  private music = 0.6;
  private sfx = 0.8;
  private muted = false;
  private night = 0;
  private timer: number | null = null;
  private rainGain: GainNode | null = null;
  private nextBar = 0;
  private bar = 0;
  private seed = 7;

  /**
   * Create/resume the AudioContext. Must run inside a user gesture: browsers (iOS Safari
   * especially) keep audio locked until then. Safe to call any number of times.
   */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.build(this.ctx);
      this.primeSilently(this.ctx);
    }
    this.resume();
    this.applyVolumes();
  }

  /** Silence everything while the app is in the background (saves battery, honours phone calls). */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  /** Bring audio back after a suspension or interruption. No-op when already running. */
  resume(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'running') return;
    void ctx.resume().catch(() => undefined);
  }

  /** True when audio was interrupted/suspended and a user gesture is needed to restart it. */
  get needsGesture(): boolean {
    return this.ctx !== null && this.ctx.state !== 'running';
  }

  /** iOS only fully unlocks after something actually plays inside the gesture. */
  private primeSilently(ctx: AudioContext): void {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  }

  /**
   * Listen for any user gesture and unlock/resume on it. Uses release-type events as well as
   * press events because older iOS only counts touchend/click as activation.
   */
  installAutoUnlock(): void {
    const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
    const handler = () => {
      if (this.ctx?.state === 'running') return;
      this.unlock();
    };
    for (const e of events) window.addEventListener(e, handler, { passive: true });
  }

  private build(ctx: AudioContext): void {
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.dayBus = ctx.createGain();
    this.dayBus.connect(this.musicBus);
    this.nightBus = ctx.createGain();
    this.nightBus.connect(this.musicBus);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolumes(music: number, sfx: number, muted: boolean): void {
    this.music = music;
    this.sfx = sfx;
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.sfx * 0.9, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.music * 0.32, t, 0.05);
  }

  /** 0 = full day music, 1 = full night music. */
  setNight(amount: number): void {
    this.night = Math.max(0, Math.min(1, amount));
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.dayBus.gain.setTargetAtTime(1 - this.night, t, 0.6);
    this.nightBus.gain.setTargetAtTime(this.night, t, 0.6);
  }

  /** Continuous soft rain bed. 0 = silent. Created lazily on first use. */
  setRain(amount: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1400;
      f.Q.value = 0.4;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.sfxBus);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, amount)) * 0.22,
      ctx.currentTime,
      0.4,
    );
  }

  // ---- synth helpers ----
  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      to?: number;
      delay?: number;
      bus?: AudioNode;
      attack?: number;
    } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const peak = opts.gain ?? 0.3;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(opts.bus ?? this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private hiss(
    dur: number,
    opts: {
      type?: BiquadFilterType;
      freq?: number;
      to?: number;
      q?: number;
      gain?: number;
      delay?: number;
    } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1000, t0);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'till':
        this.tone(130, 0.14, { to: 50, gain: 0.5 });
        this.hiss(0.12, { type: 'lowpass', freq: 900, gain: 0.35 });
        break;
      case 'water':
        this.hiss(0.32, { freq: 2200, to: 3800, q: 0.7, gain: 0.22 });
        break;
      case 'refill':
        this.hiss(0.4, { freq: 900, to: 2400, q: 2, gain: 0.2 });
        this.tone(400, 0.3, { to: 900, gain: 0.12, type: 'triangle' });
        break;
      case 'plant':
        this.tone(392, 0.09, { gain: 0.25, type: 'triangle' });
        this.tone(587, 0.12, { gain: 0.25, type: 'triangle', delay: 0.07 });
        break;
      case 'harvest':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, 0.13, { gain: 0.22, type: 'triangle', delay: i * 0.05 }),
        );
        break;
      case 'cut':
        this.hiss(0.1, { type: 'highpass', freq: 3000, gain: 0.28 });
        this.tone(900, 0.06, { to: 400, gain: 0.1, type: 'square' });
        break;
      case 'coin':
        this.tone(988, 0.08, { gain: 0.2, type: 'square' });
        this.tone(1319, 0.22, { gain: 0.2, type: 'square', delay: 0.07 });
        break;
      case 'buy':
        this.tone(784, 0.08, { gain: 0.22, type: 'triangle' });
        this.tone(1047, 0.1, { gain: 0.22, type: 'triangle', delay: 0.07 });
        this.tone(1568, 0.2, { gain: 0.2, type: 'triangle', delay: 0.14 });
        break;
      case 'ui':
        this.tone(880, 0.04, { gain: 0.12, type: 'square' });
        break;
      case 'select':
        this.tone(660, 0.05, { gain: 0.12, type: 'triangle' });
        break;
      case 'door':
        this.hiss(0.18, { type: 'lowpass', freq: 500, gain: 0.35 });
        this.tone(110, 0.15, { to: 70, gain: 0.35 });
        break;
      case 'stepGrass':
        this.hiss(0.05, { type: 'highpass', freq: 2500 + Math.random() * 800, gain: 0.07 });
        break;
      case 'stepWood':
        this.tone(260 + Math.random() * 60, 0.04, { gain: 0.12, type: 'triangle', to: 180 });
        break;
      case 'error':
        this.tone(170, 0.16, { to: 110, gain: 0.22, type: 'sawtooth' });
        break;
      case 'sleep':
        [523, 659, 784, 1047, 784].forEach((f, i) =>
          this.tone(f, 0.7, { gain: 0.18, type: 'sine', delay: i * 0.22, attack: 0.04 }),
        );
        break;
      case 'goal':
        [659, 784, 1047, 1319].forEach((f, i) =>
          this.tone(f, 0.18, { gain: 0.2, type: 'square', delay: i * 0.08 }),
        );
        break;
      case 'swing':
        this.hiss(0.1, { freq: 1800, to: 700, q: 1.2, gain: 0.12 });
        break;
    }
  }

  // ---- music ----
  startMusic(): void {
    if (!this.ctx || this.timer !== null) return;
    this.nextBar = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  stopMusic(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const beat = 60 / 74;
    while (this.nextBar < ctx.currentTime + 0.6) {
      const { root, chord } = PROGRESSION[this.bar % PROGRESSION.length]!;
      const t = this.nextBar;
      const barLen = beat * 4;
      // Pad: soft triangle chord, in both day and night buses.
      for (const off of chord) {
        this.padNote(midi(root + 12 + off), t, barLen, this.dayBus, 0.05);
        this.padNote(midi(root + off), t, barLen, this.nightBus, 0.07);
      }
      // Bass on beats 1 and 3.
      for (const b of [0, 2])
        this.tone(midi(root - 12), beat * 1.6, {
          gain: 0.16,
          bus: this.dayBus,
          delay: t - ctx.currentTime + b * beat,
          attack: 0.02,
        });
      // Sparse pentatonic melody for the day; two bell notes for the night.
      for (let b = 0; b < 8; b++) {
        if (this.rnd() < 0.55) {
          const note =
            72 + PENTA[Math.floor(this.rnd() * PENTA.length)]! + (this.rnd() < 0.25 ? 12 : 0);
          this.tone(midi(note), beat * 1.2, {
            gain: 0.09,
            type: 'triangle',
            bus: this.dayBus,
            delay: t - ctx.currentTime + b * beat * 0.5,
            attack: 0.01,
          });
        }
      }
      if (this.bar % 2 === 0) {
        const note = 60 + PENTA[Math.floor(this.rnd() * PENTA.length)]!;
        this.tone(midi(note), beat * 3, {
          gain: 0.07,
          bus: this.nightBus,
          delay: t - ctx.currentTime + beat,
          attack: 0.03,
        });
      }
      this.nextBar += barLen;
      this.bar += 1;
    }
  }

  private padNote(freq: number, t0: number, dur: number, bus: AudioNode, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur * 1.05);
    osc.connect(g).connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur * 1.1);
  }
}

export const audio = new AudioEngine();
