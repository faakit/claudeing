/**
 * Audio engine. Real audio first, synthesized audio as the fallback that never goes silent:
 *  - sound effects play recorded takes from public/assets/audio (src/audio/sfx.ts);
 *  - music is composed note data played live on sampled instruments (src/audio/music.ts);
 *  - ambience beds and one-shots follow the place, time and weather (src/audio/ambience.ts).
 * Any cue, instrument or bed whose file is missing or fails to load or decode plays the original
 * Web Audio synthesis instead (`playSynth`, the synth music scheduler, the noise rain bed).
 * Unlock, interruption, lifecycle pause, volume and mute work the same for both paths because
 * everything goes through the same gain buses.
 */
import { Ambience } from '../audio/ambience';
import { JINGLE_CUES, jingleOrSting, allFiles, instrumentFiles, jingleInstruments, slotInstruments, MANIFEST } from '../audio/assets';
import { SampleBank } from '../audio/bank';
import type { AmbienceTargets } from '../audio/director';
import { MusicPlayer } from '../audio/music';
import { K_MUSIC, K_SFX, buildGraph } from '../audio/graph';
import { SfxPlayer } from '../audio/sfx';
import { midiToHz, parseNotes } from '../audio/theory';
import type { MusicSlot } from '../audio/types';

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
  | 'select'
  | 'level'
  | 'heart'
  | 'order'
  // One-thumb controls (soft, under 80 ms, at or below the ui click; see docs/EXTENDING.md):
  | 'tick'
  | 'target'
  | 'ringOpen'
  | 'ringClose'
  | 'confirm'
  // A special order delivered in full: a bigger fanfare than an ordinary order.
  | 'special';

/** Every cue id, for tests and tooling (keep in sync with the union above; a test checks it). */
export const SFX_IDS: readonly Sfx[] = [
  'till',
  'water',
  'refill',
  'plant',
  'harvest',
  'cut',
  'coin',
  'buy',
  'ui',
  'door',
  'stepGrass',
  'stepWood',
  'error',
  'sleep',
  'goal',
  'swing',
  'select',
  'level',
  'heart',
  'order',
  'tick',
  'target',
  'ringOpen',
  'ringClose',
  'confirm',
  'special',
];

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

/** How the synth fallback music feels in each season: tempo, key shift, melody density, chord loop. */
export interface SeasonMusic {
  bpm: number;
  transpose: number;
  melody: number;
  progression: { root: number; chord: number[] }[];
}
const MINOR_LOOP: { root: number; chord: number[] }[] = [
  { root: 45, chord: [0, 3, 7, 10] },
  { root: 41, chord: [0, 4, 7, 11] },
  { root: 48, chord: [0, 4, 7, 11] },
  { root: 43, chord: [0, 4, 7, 9] },
];
export const SEASON_MUSIC: Record<string, SeasonMusic> = {
  spring: { bpm: 74, transpose: 0, melody: 0.55, progression: PROGRESSION },
  summer: { bpm: 84, transpose: 2, melody: 0.7, progression: PROGRESSION },
  fall: { bpm: 66, transpose: -2, melody: 0.45, progression: MINOR_LOOP },
  winter: { bpm: 56, transpose: 5, melody: 0.28, progression: MINOR_LOOP },
};

const TICK_MS = 100;
const SEASON_SLOTS = new Set<string>(['spring', 'summer', 'fall', 'winter']);

/** Where audio files are served from (relative, like the rest of the build). */
const AUDIO_BASE = `${import.meta.env.BASE_URL ?? './'}assets/audio/`;

class AudioEngine {
  private season: SeasonMusic = SEASON_MUSIC['spring']!;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private synthBus!: GainNode;
  private ambienceBus!: GainNode;
  private musicBus!: GainNode;
  private duck!: GainNode;
  private dayBus!: GainNode;
  private nightBus!: GainNode;
  private bothBus!: GainNode;
  private dayWet!: GainNode;
  private nightWet!: GainNode;
  private bothWet!: GainNode;
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
  private synthMusicOn = false;
  private musicStopped = false;
  private slot: MusicSlot | null = null;
  /** The season piece to come back to (kept decoded while in the mine, house or festival). */
  private homeSlot: MusicSlot = 'spring';
  private indoor = false;
  private ambienceTargets: Partial<AmbienceTargets> = {};
  private mood: { rain: boolean; year: number } = { rain: false, year: 1 };
  private lastEvict = 0;
  readonly bank = new SampleBank(AUDIO_BASE);
  private sfxPlayer: SfxPlayer | null = null;
  private musicPlayer: MusicPlayer | null = null;
  private ambience: Ambience | null = null;
  private fetchStarted = false;

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
      this.startLoop();
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

  /**
   * Start downloading the audio files (compressed bytes only; decoding waits for the unlock).
   * `afterServiceWorker` lets a first visit's offline worker fetch and cache them once instead of
   * the page downloading the same files in parallel.
   */
  preload(afterServiceWorker: Promise<unknown> = Promise.resolve()): void {
    if (this.fetchStarted) return;
    this.fetchStarted = true;
    void afterServiceWorker.then(() => this.bank.fetchAll(allFiles().map((z) => z.file)));
  }

  private build(ctx: AudioContext): void {
    const g = buildGraph(ctx);
    this.master = g.master;
    this.sfxBus = g.sfxBus;
    this.synthBus = g.synthBus;
    this.ambienceBus = g.ambienceBus;
    this.musicBus = g.musicBus;
    this.duck = g.duck;
    this.dayBus = g.dayBus;
    this.nightBus = g.nightBus;
    this.bothBus = g.bothBus;
    this.dayWet = g.dayWet;
    this.nightWet = g.nightWet;
    this.bothWet = g.bothWet;
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.sfxPlayer = new SfxPlayer(ctx, this.bank, this.sfxBus);
    this.ambience = new Ambience(ctx, this.bank, this.ambienceBus);
    // The music steps back under each thunderclap (-6 dB, back over about three seconds).
    this.ambience.onShot = (name, when, dur) => {
      if (name !== 'thunder') return;
      this.duck.gain.cancelScheduledValues(when);
      this.duck.gain.setTargetAtTime(0.5, when, 0.15);
      this.duck.gain.setTargetAtTime(1, when + Math.min(dur, 3), 0.8);
    };
    this.musicPlayer = new MusicPlayer(
      ctx,
      this.bank,
      {
        dry: { day: this.dayBus, night: this.nightBus, both: this.bothBus },
        wet: { day: this.dayWet, night: this.nightWet, both: this.bothWet },
        sfx: this.sfxBus,
      },
      (m, when, dur, vel, dest) => this.tone(midiToHz(m), Math.max(0.15, dur), {
        type: 'triangle',
        gain: 0.12 * vel,
        bus: dest,
        delay: when - ctx.currentTime,
        attack: 0.01,
      }),
    );
    this.setNight(this.night);
    // Decode in priority order: sound effects and jingles first, then the music being played.
    void this.sfxPlayer.preload();
    jingleInstruments().forEach((i) =>
      instrumentFiles(i).forEach((z) => void this.bank.load(ctx, z.file, z.onset)),
    );
    if (this.slot) this.musicPlayer.setSlot(this.slot, this.indoor, ctx.currentTime);
    for (const [k, v] of Object.entries(this.ambienceTargets)) this.ambience.set(k, v ?? 0);
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
    this.sfxBus.gain.setTargetAtTime(this.sfx * K_SFX, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.music * K_MUSIC, t, 0.05);
  }

  /** 0 = full day music, 1 = full night music. */
  setNight(amount: number): void {
    this.night = Math.max(0, Math.min(1, amount));
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.dayBus.gain.setTargetAtTime(1 - this.night, t, 0.6);
    this.nightBus.gain.setTargetAtTime(this.night, t, 0.6);
    this.dayWet.gain.setTargetAtTime(1 - this.night, t, 0.6);
    this.nightWet.gain.setTargetAtTime(this.night, t, 0.6);
  }

  /** Rain bed. 0 = silent. The recorded loop when it can play, else the synthesized noise bed. */
  setRain(amount: number): void {
    const v = Math.max(0, Math.min(1, amount));
    const ctx = this.ctx;
    if (!ctx || !this.ambience) return;
    if (!this.ambience.failed('rain')) this.ambience.set('rain', v);
    // The synthesized bed covers while the recording loads, and for good if it cannot load.
    this.synthRain(this.ambience.available('rain') ? 0 : v);
  }

  private synthRain(amount: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.rainGain) {
      if (amount <= 0) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1400;
      f.Q.value = 0.4;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.synthBus);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(amount * 0.22, ctx.currentTime, 0.4);
  }

  /** Birds, crickets, wind, cave, drips (0..1 each), as chosen by the director. */
  setAmbience(t: Partial<AmbienceTargets>): void {
    this.ambienceTargets = { ...this.ambienceTargets, ...t };
    if (!this.ambience) return;
    for (const [k, v] of Object.entries(t)) this.ambience.set(k, v ?? 0);
  }

  // ---- synth helpers (the fallback sounds) ----
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
    const t0 = ctx.currentTime + Math.max(0, opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const peak = Math.max(0.0002, opts.gain ?? 0.3);
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(opts.bus ?? this.synthBus);
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
    src.connect(f).connect(g).connect(this.synthBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  /** Play a cue: the recorded take or sampled jingle when available, else the synthesized sound. */
  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    if (JINGLE_CUES.has(name)) {
      // Let a fanfare through: dip the music for a moment (-6 dB, back over about a second).
      this.duck.gain.cancelScheduledValues(now);
      this.duck.gain.setTargetAtTime(0.5, now, 0.05);
      this.duck.gain.setTargetAtTime(1, now + 0.9, 0.35);
      if (this.musicPlayer?.jingle(name, now)) return;
    } else if (this.sfxPlayer?.play(name, now)) return;
    this.playSynth(name);
  }

  /**
   * A musical moment that is not a game-code cue: a villager's motif, the dawn and dusk flourishes, a
   * season-change sting, a festival opener. Played on the sampler in the current piece's key (or the
   * key of `key`'s piece), `delay` seconds from now; the music dips a little under it. Falls back to a
   * synth rendition of the same notes.
   */
  sting(name: string, o: { key?: MusicSlot; delay?: number; volume?: number; duckDb?: number; lead?: boolean } = {}): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || !jingleOrSting(name)) return;
    const when = ctx.currentTime + (o.delay ?? 0);
    const duck = Math.pow(10, (o.duckDb ?? -3) / 20);
    this.duck.gain.setTargetAtTime(duck, when, 0.08);
    this.duck.gain.setTargetAtTime(1, when + 1.2, 0.5);
    const key = this.musicPlayer?.jingleKey(o.key) ?? 0;
    if (this.musicPlayer?.jingle(name, ctx.currentTime, o.volume ?? 1, { key, delay: o.delay ?? 0, lead: o.lead })) return;
    this.synthJingle(name, key, o.delay ?? 0, o.volume ?? 1);
  }

  /**
   * A villager's motif when their sheet opens; `heart` for the warmer version at a new heart. The lead
   * moves to an instrument the playing piece is not using, so it stands out from the music.
   */
  motif(npc: string, heart = false): void {
    this.sting(`motif-${npc}${heart ? '-heart' : ''}`, { delay: heart ? 0.8 : 0.05, duckDb: heart ? -5 : -4, lead: true });
  }

  /** The season-change sting, under the sleep screen, in the new season's key. */
  seasonSting(season: string): void {
    if (SEASON_SLOTS.has(season)) this.sting(`season-${season}`, { key: season as MusicSlot, delay: 2.4, duckDb: -6 });
  }

  private synthJingle(name: string, key: number, delay: number, volume: number): void {
    const j = jingleOrSting(name);
    if (!j) return;
    const spb = 60 / j.bpm;
    for (const part of j.parts)
      for (const n of parseNotes(part.notes))
        if (n.midi !== null)
          this.tone(midiToHz(n.midi + key), Math.max(0.12, n.beats * spb), {
            type: 'triangle',
            gain: 0.1 * volume * (j.volume ?? 1) * (part.gain ?? 1),
            delay: delay + n.beat * spb,
            attack: 0.01,
          });
  }

  /** The original synthesized sound for a cue (the fallback). */
  playSynth(name: Sfx): void {
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
      case 'level':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
          this.tone(f, 0.22, { gain: 0.18, type: 'triangle', delay: i * 0.07 }),
        );
        break;
      case 'heart':
        this.tone(784, 0.12, { gain: 0.16, type: 'sine' });
        this.tone(1175, 0.3, { gain: 0.16, type: 'sine', delay: 0.1 });
        break;
      case 'order':
        this.tone(1047, 0.06, { gain: 0.16, type: 'square' });
        this.tone(1319, 0.06, { gain: 0.16, type: 'square', delay: 0.06 });
        this.tone(1568, 0.28, { gain: 0.18, type: 'square', delay: 0.12 });
        this.hiss(0.08, { type: 'highpass', freq: 5000, gain: 0.1 });
        break;
      case 'swing':
        this.hiss(0.1, { freq: 1800, to: 700, q: 1.2, gain: 0.12 });
        break;
      case 'tick':
        this.tone(1500 + Math.random() * 200, 0.02, { gain: 0.05, type: 'triangle' });
        break;
      case 'target':
        this.tone(620, 0.04, { to: 760, gain: 0.05, type: 'sine' });
        break;
      case 'ringOpen':
        this.tone(520, 0.06, { to: 780, gain: 0.05, type: 'triangle' });
        break;
      case 'ringClose':
        this.tone(780, 0.06, { to: 520, gain: 0.05, type: 'triangle' });
        break;
      case 'confirm':
        this.tone(1047, 0.04, { gain: 0.06, type: 'triangle' });
        this.tone(1568, 0.05, { gain: 0.06, type: 'triangle', delay: 0.03 });
        break;
      case 'special':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
          this.tone(f, i === 6 ? 0.6 : 0.14, { gain: 0.18, type: 'triangle', delay: i * 0.09 }),
        );
        break;
    }
  }

  // ---- music ----
  /** Season mood for the synth fallback; also follows the season if a season piece is playing. */
  setSeason(season: string): void {
    this.season = SEASON_MUSIC[season] ?? SEASON_MUSIC['spring']!;
    if (SEASON_SLOTS.has(season)) this.homeSlot = season as MusicSlot;
    if (this.slot && SEASON_SLOTS.has(this.slot) && SEASON_SLOTS.has(season))
      this.setMusic(season as MusicSlot, this.indoor);
  }

  /** Choose the piece (title, a season, mine, festival...), whether we are indoors, and the weather and year. */
  setMusic(slot: MusicSlot, indoor: boolean, mood?: { rain?: boolean; year?: number }): void {
    const entering = slot !== this.slot && this.slot !== null;
    if (mood) this.mood = { rain: !!mood.rain, year: mood.year ?? this.mood.year };
    if (this.ctx && this.musicPlayer) this.musicPlayer.setMood(this.mood, this.ctx.currentTime);
    this.slot = slot;
    this.indoor = indoor;
    if (SEASON_SLOTS.has(slot)) {
      this.season = SEASON_MUSIC[slot] ?? this.season;
      this.homeSlot = slot;
    }
    if (this.ctx && this.musicPlayer) this.musicPlayer.setSlot(slot, indoor, this.ctx.currentTime);
    // Each festival opens with its own short fanfare (by season), in the festival's key.
    if (entering && slot === 'festival') this.sting(`open-${this.homeSlot}`, { key: 'festival' });
  }

  /** Music on (it plays whenever audio is unlocked, a slot is chosen and music is not stopped). */
  startMusic(): void {
    this.musicStopped = false;
    if (!this.slot) this.setMusic('spring', false);
  }

  stopMusic(): void {
    this.musicStopped = true;
    if (this.ctx && this.musicPlayer) this.musicPlayer.stop(this.ctx.currentTime);
  }

  private startLoop(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicPlayer || !this.ambience) return;
    const now = ctx.currentTime;
    const musicOn = !this.muted && this.music > 0 && !this.musicStopped && this.slot !== null;
    if (this.slot && this.musicPlayer.slot !== this.slot && !this.musicStopped)
      this.musicPlayer.setSlot(this.slot, this.indoor, now);
    // No instrument of this piece can play at all: the synthesized music takes over.
    const synth = musicOn && this.slot !== null && this.musicPlayer.status(this.slot) === 'none';
    if (synth !== this.synthMusicOn) {
      this.synthMusicOn = synth;
      this.nextBar = now + 0.1;
    }
    this.musicPlayer.tick(now, {
      enabled: musicOn && !synth,
      day: this.night < 0.99,
      night: this.night > 0.01,
    });
    if (this.synthMusicOn) this.schedule();
    this.ambience.tick(now, !this.muted && this.sfx > 0);
    if (now - this.lastEvict > 30) {
      this.lastEvict = now;
      this.evict(now);
    }
  }

  /** Drop decoded audio nobody needs right now (kept compressed; decoding again takes ms). */
  private evict(now: number): void {
    const keep = new Set<string>();
    Object.values(MANIFEST.sfx).forEach((s) => s.files.forEach((z) => keep.add(z.file)));
    jingleInstruments().forEach((i) => instrumentFiles(i).forEach((z) => keep.add(z.file)));
    for (const s of [this.slot, this.homeSlot])
      if (s) slotInstruments(s).forEach((i) => instrumentFiles(i).forEach((z) => keep.add(z.file)));
    for (const [k, v] of Object.entries(this.ambienceTargets))
      if ((v ?? 0) > 0 || k === 'rain') MANIFEST.ambience[k]?.files.forEach((z) => keep.add(z.file));
    const others = allFiles()
      .map((z) => z.file)
      .filter((f) => !keep.has(f));
    this.bank.evict(others, now - 120);
  }

  /** Debug: render the real mix offline (see src/audio/render.ts and audio-src/tools/render.mjs). */
  async renderOffline(o: import('../audio/render').RenderOptions): Promise<import('../audio/render').RenderResult> {
    const m = await import('../audio/render');
    return m.renderOffline(AUDIO_BASE, o);
  }

  /** Numbers for tests and the debug hook. */
  debugInfo(): Record<string, unknown> {
    return {
      state: this.ctx?.state ?? 'none',
      sampleRate: this.ctx?.sampleRate ?? 0,
      slot: this.slot,
      indoor: this.indoor,
      synthMusic: this.synthMusicOn,
      decoded: this.bank.decodedCount,
      residentMB: Math.round((this.bank.residentBytes() / 1e6) * 10) / 10,
      music: this.musicPlayer?.stats,
      sfx: this.sfxPlayer?.stats,
    };
  }

  // ---- synth fallback music ----
  private rnd(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const beat = 60 / this.season.bpm;
    if (this.nextBar < ctx.currentTime - 0.05) this.nextBar = ctx.currentTime + 0.05; // never burst late bars
    while (this.nextBar < ctx.currentTime + 0.6) {
      const prog = this.season.progression;
      const { chord } = prog[this.bar % prog.length]!;
      const root = prog[this.bar % prog.length]!.root + this.season.transpose;
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
        if (this.rnd() < this.season.melody) {
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
