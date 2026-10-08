/**
 * A tiny fake of the Web Audio API, enough to run the audio engine's logic in unit tests (Node has
 * no AudioContext). It records what gets created and started, so tests can tell a sampled sound
 * from a synthesized fallback.
 */
export class FakeParam {
  value: number;
  events: [string, number, number][] = [];
  constructor(v = 1) {
    this.value = v;
  }
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t]);
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(['lin', v, t]);
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.events.push(['exp', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push(['target', v, t]);
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
  cancelAndHoldAtTime() {
    return this;
  }
}

export class FakeNode {
  outputs: FakeNode[] = [];
  channelCount = 2;
  channelCountMode = 'max';
  constructor(
    readonly ctx: FakeAudioContext,
    readonly kind: string,
  ) {
    ctx.created.push(this);
  }
  connect<T extends FakeNode>(n: T): T {
    this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs = [];
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

export class FakeBuffer {
  readonly duration: number;
  /** True for buffers that came from decodeAudioData (files), false for generated ones (noise). */
  decoded = false;
  private data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.duration = length / sampleRate;
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(c: number) {
    return this.data[c]!;
  }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  playbackRate = new FakeParam(1);
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  started: [number, number] | null = null;
  stoppedAt: number | null = null;
  private listeners: (() => void)[] = [];
  start(when = 0, offset = 0) {
    this.started = [when, offset];
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
  addEventListener(_: string, fn: () => void) {
    this.listeners.push(fn);
  }
}

export class FakeOsc extends FakeNode {
  type = 'sine';
  frequency = new FakeParam(440);
  start() {}
  stop() {}
}

export class FakeAudioContext {
  static instances = 0;
  created: FakeNode[] = [];
  currentTime = 0;
  sampleRate = 48000;
  state = 'running';
  destination: FakeNode;
  /** Bytes whose first byte is 0 fail to decode (a corrupt file). */
  constructor() {
    FakeAudioContext.instances++;
    this.destination = new FakeNode(this, 'destination');
  }
  createGain() {
    return new FakeGain(this, 'gain');
  }
  createBufferSource() {
    return new FakeSource(this, 'source');
  }
  createOscillator() {
    return new FakeOsc(this, 'osc');
  }
  createStereoPanner() {
    const n = new FakeNode(this, 'pan') as FakeNode & { pan: FakeParam };
    n.pan = new FakeParam(0);
    return n;
  }
  createBiquadFilter() {
    const n = new FakeNode(this, 'filter') as FakeNode & { type: string; frequency: FakeParam; Q: FakeParam };
    n.type = 'lowpass';
    n.frequency = new FakeParam(1000);
    n.Q = new FakeParam(1);
    return n;
  }
  createConvolver() {
    const n = new FakeNode(this, 'convolver') as FakeNode & { buffer: unknown };
    n.buffer = null;
    return n;
  }
  createDynamicsCompressor() {
    const n = new FakeNode(this, 'compressor') as FakeNode & Record<string, FakeParam>;
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0);
    return n;
  }
  createBuffer(ch: number, len: number, sr: number) {
    return new FakeBuffer(ch, len, sr);
  }
  decodeAudioData(data: ArrayBuffer, ok?: (b: FakeBuffer) => void, fail?: (e: Error) => void) {
    const bytes = new Uint8Array(data);
    if (bytes.length === 0 || bytes[0] === 0) {
      const e = new Error('bad');
      fail?.(e);
      return Promise.reject(e);
    }
    // A 1 s buffer with the "attack" at 25 ms, like a decoder that keeps MP3 priming silence.
    const b = new FakeBuffer(1, this.sampleRate, this.sampleRate);
    b.getChannelData(0).fill(0.5, Math.round(0.025 * this.sampleRate));
    b.decoded = true;
    ok?.(b);
    return Promise.resolve(b);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  count(kind: string) {
    return this.created.filter((n) => n.kind === kind).length;
  }
}

/** Bytes that decode fine in the fake. */
export const GOOD_BYTES = () => new Uint8Array([0xff, 0xfb, 1, 2]).buffer;
/** Bytes the fake refuses to decode. */
export const BAD_BYTES = () => new Uint8Array([0, 0, 0]).buffer;

/** Treat the fake as the real thing for code typed against the DOM. */
export const asCtx = (c: FakeAudioContext) => c as unknown as AudioContext;
