import { makeRng } from './sequencer';

/**
 * Gain staging (see DECISIONS.md "Real audio"). Bus gain = setting x K. Files are mastered to fixed
 * levels (sfx families -20..-28 dB active RMS, instruments -20 dB at their attack), so these
 * constants set the mix between music, sound effects and ambience.
 */
export const K_MUSIC = 0.32;
export const K_SFX = 0.9;
/** Rain, birds, crickets ride under the sound-effects volume, a little lower. */
export const K_AMBIENCE = 0.8;
/** The synth fallback was tuned before the file mix existed; it keeps its own trim. */
export const K_SYNTH_SFX = 1;
/**
 * The sampled music is mastered quieter than the old synth music (whose levels K_MUSIC was set
 * for), so the sampler gets its own make-up gain: about +12.5 dB, measured with render.mjs so that
 * a day piece sits near -25 LUFS at the default 60% music volume, 4-6 dB under the tool sounds.
 */
export const SAMPLED_MUSIC_GAIN = 4.2;
export const REVERB_RETURN = 0.55;
export const REVERB_SECONDS = 1.4;

/** Every bus of the mixer. The same graph runs live and in offline renders. */
export interface Graph {
  master: GainNode;
  sfxBus: GainNode;
  synthBus: GainNode;
  ambienceBus: GainNode;
  musicBus: GainNode;
  /** Briefly lowers the music under a jingle (level up, goal...). */
  duck: GainNode;
  dayBus: GainNode;
  nightBus: GainNode;
  bothBus: GainNode;
  dayWet: GainNode;
  nightWet: GainNode;
  bothWet: GainNode;
}

/** Exponentially decaying stereo noise, darker as it fades: a plausible small room. */
export function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const rnd = makeRng(1234 + c);
    const data = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      const decay = Math.pow(10, (-60 * t) / seconds / 20);
      const smooth = 0.15 + 0.8 * (t / seconds); // a one-pole low-pass that closes over time
      lp += (rnd() * 2 - 1 - lp) * (1 - smooth);
      data[i] = t < 0.012 ? 0 : lp * decay * 0.35;
    }
  }
  return buf;
}

/** Soft-clip transfer curve: identity up to KNEE, then a tanh shoulder towards CEILING (linear). */
export const CLIP_KNEE = 0.71;
export const CLIP_CEILING = 0.85;
export function softClipCurve(n = 4097): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const span = CLIP_CEILING - CLIP_KNEE;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= CLIP_KNEE ? a : CLIP_KNEE + span * Math.tanh((a - CLIP_KNEE) / span));
  }
  return curve;
}

function softClipper(ctx: BaseAudioContext): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  ws.curve = softClipCurve();
  ws.oversample = '2x';
  return ws;
}

export function buildGraph(ctx: BaseAudioContext): Graph {
  const master = ctx.createGain();
  // A safety limiter at the very end: many sounds at once must never clip a phone speaker.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  // The compressor's 3 ms attack lets the front of a transient through (max sliders, festival, rain and
  // a burst of effects reached 0 dBTP). A soft clipper after it is the brick wall: linear up to -3 dBFS
  // (the compressor threshold), then a tanh knee that stays under -1.4 dBFS (-1 dBTP with 2x
  // oversampling). Music mixes peak below the knee, so it only acts on spiky effects and at extreme
  // settings. 4x oversampling cost a quarter of the offline render speed for no audible gain here.
  const out: AudioNode =
    typeof ctx.createWaveShaper === 'function' ? softClipper(ctx) : ctx.createGain();
  master.connect(limiter).connect(out).connect(ctx.destination);
  const mk = (dest: AudioNode, value = 1) => {
    const g = ctx.createGain();
    g.gain.value = value;
    g.connect(dest);
    return g;
  };
  const sfxBus = mk(master);
  const synthBus = mk(sfxBus, K_SYNTH_SFX);
  const ambienceBus = mk(sfxBus, K_AMBIENCE);
  const duck = mk(master);
  const musicBus = mk(duck);
  // One small reverb for all music: mono in, generated stereo impulse (no file).
  const reverbIn = ctx.createGain();
  reverbIn.channelCount = 1;
  reverbIn.channelCountMode = 'explicit';
  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx, REVERB_SECONDS);
  reverbIn.connect(conv).connect(mk(musicBus, REVERB_RETURN));
  return {
    master,
    sfxBus,
    synthBus,
    ambienceBus,
    musicBus,
    duck,
    dayBus: mk(musicBus),
    nightBus: mk(musicBus, 0),
    bothBus: mk(musicBus),
    dayWet: mk(reverbIn),
    nightWet: mk(reverbIn, 0),
    bothWet: mk(reverbIn),
  };
}
