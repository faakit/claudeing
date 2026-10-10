/**
 * Loads audio files: fetches the compressed bytes once, decodes on demand into AudioBuffers and can
 * drop decoded buffers again (they are 10-20x bigger than the MP3s). Every failure is remembered so
 * callers can fall back to the synthesized sound instead of waiting forever.
 */

export interface Decoded {
  buffer: AudioBuffer;
  /**
   * Seconds to add to every time stored in the manifest (start, loop points): some decoders keep
   * the MP3 encoder's priming silence at the start of the buffer.
   */
  offset: number;
}

type FetchState = 'fetching' | 'fetched' | 'failed';

/** Decoders differ (older Safari only has the callback form), so wrap both in one promise. */
function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (b: AudioBuffer) => {
      if (!settled) {
        settled = true;
        resolve(b);
      }
    };
    const fail = (e: unknown) => {
      if (!settled) {
        settled = true;
        reject(e instanceof Error ? e : new Error('decode failed'));
      }
    };
    try {
      const p = ctx.decodeAudioData(data, ok, fail) as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') p.then(ok, fail);
    } catch (e) {
      fail(e);
    }
  });
}

/** First sample above -40 dB of the peak, in seconds (the same rule the build script uses). */
export function detectOnset(data: Float32Array, sampleRate: number): number {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]!);
    if (a > peak) peak = a;
  }
  const thr = peak * 0.01;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]!) > thr) return i / sampleRate;
  return 0;
}

/** Decoder priming compensation, clamped to a sane range (a real attack is never 80 ms late). */
export function onsetOffset(detected: number, expected: number): number {
  return Math.max(0, Math.min(0.08, detected - expected));
}

export class SampleBank {
  private bytes = new Map<string, ArrayBuffer>();
  private state = new Map<string, FetchState>();
  private fetches = new Map<string, Promise<boolean>>();
  private decoded = new Map<string, Decoded>();
  private decoding = new Map<string, Promise<Decoded | null>>();
  private failedDecode = new Set<string>();
  private lastUse = new Map<string, number>();

  constructor(
    private base: string,
    private fetcher: (url: string) => Promise<ArrayBuffer> = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.arrayBuffer();
    },
  ) {}

  /** Download the compressed file (once). Resolves false if it cannot be had. */
  fetch(file: string): Promise<boolean> {
    const known = this.fetches.get(file);
    if (known) return known;
    this.state.set(file, 'fetching');
    const p = this.fetcher(this.base + file).then(
      (buf) => {
        this.bytes.set(file, buf);
        this.state.set(file, 'fetched');
        return true;
      },
      () => {
        this.state.set(file, 'failed');
        return false;
      },
    );
    this.fetches.set(file, p);
    return p;
  }

  /** Fetch many with limited concurrency, in the given order. */
  async fetchAll(files: string[], concurrency = 4): Promise<void> {
    let next = 0;
    const worker = async () => {
      while (next < files.length) await this.fetch(files[next++]!);
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  }

  /** Decode (fetching first if needed). `expectedOnset` comes from the manifest. Null = unusable. */
  load(ctx: BaseAudioContext, file: string, expectedOnset: number): Promise<Decoded | null> {
    const hit = this.decoded.get(file);
    if (hit) return Promise.resolve(hit);
    if (this.failedDecode.has(file)) return Promise.resolve(null);
    const busy = this.decoding.get(file);
    if (busy) return busy;
    const p = (async () => {
      if (!(await this.fetch(file))) return null;
      const bytes = this.bytes.get(file)!;
      try {
        // decodeAudioData detaches its input: decode a copy so the bytes can be decoded again later.
        const buffer = await decode(ctx, bytes.slice(0));
        const out: Decoded = {
          buffer,
          offset: onsetOffset(
            detectOnset(buffer.getChannelData(0), buffer.sampleRate),
            expectedOnset,
          ),
        };
        this.decoded.set(file, out);
        return out;
      } catch {
        this.failedDecode.add(file);
        return null;
      } finally {
        this.decoding.delete(file);
      }
    })();
    this.decoding.set(file, p);
    return p;
  }

  /** The decoded sample if it is ready right now. */
  get(file: string, now = 0): Decoded | undefined {
    const d = this.decoded.get(file);
    if (d) this.lastUse.set(file, now);
    return d;
  }

  /** Is it decoded? Does not count as a use (status checks must not keep samples resident). */
  has(file: string): boolean {
    return this.decoded.has(file);
  }

  /** True once the file can never play (fetch or decode failed). */
  failed(file: string): boolean {
    return this.state.get(file) === 'failed' || this.failedDecode.has(file);
  }

  /** Drop decoded buffers not used since `before` (keeps the small compressed bytes). */
  evict(files: Iterable<string>, before: number): number {
    let n = 0;
    for (const f of files) {
      if (this.decoded.has(f) && (this.lastUse.get(f) ?? 0) < before) {
        this.decoded.delete(f);
        n++;
      }
    }
    return n;
  }

  /** Decoded bytes held (float32 per sample and channel), for the residency report. */
  residentBytes(): number {
    let n = 0;
    for (const d of this.decoded.values()) n += d.buffer.length * d.buffer.numberOfChannels * 4;
    return n;
  }

  get decodedCount(): number {
    return this.decoded.size;
  }
}
