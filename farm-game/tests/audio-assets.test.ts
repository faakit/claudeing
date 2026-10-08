import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JINGLE_CUES, MANIFEST, allFiles, instrumentFiles } from '../src/audio/assets';
import { SFX_IDS, type Sfx } from '../src/platform/audio';

const AUDIO_DIR = fileURLToPath(new URL('../public/assets/audio', import.meta.url));

// Compile-time: SFX_IDS lists every member of the Sfx union (and nothing else).
type Missing = Exclude<Sfx, (typeof SFX_IDS)[number]>;
const complete: [Missing] extends [never] ? true : false = true;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [relative(AUDIO_DIR, p).split('\\').join('/')];
  });
}

describe('audio cue map', () => {
  it('lists every sound effect id exactly once', () => {
    expect(complete).toBe(true);
    expect(new Set(SFX_IDS).size).toBe(SFX_IDS.length);
  });

  it('resolves every sound effect to recorded takes or a sampled jingle (the synth covers the rest)', () => {
    for (const id of SFX_IDS) {
      const files = MANIFEST.sfx[id]?.files ?? [];
      const jingle = JINGLE_CUES.has(id);
      expect(files.length > 0 || jingle, id).toBe(true);
      expect(files.length > 0 && jingle, `${id} is both a file and a jingle`).toBe(false);
    }
    for (const id of Object.keys(MANIFEST.sfx)) expect(SFX_IDS as readonly string[], id).toContain(id);
    for (const id of JINGLE_CUES) expect(SFX_IDS as readonly string[], id).toContain(id);
  });

  it('gives frequent sounds several takes plus pitch and volume variation', () => {
    for (const id of ['stepGrass', 'stepWood', 'till', 'water', 'harvest', 'coin', 'ui', 'cut', 'plant', 'swing']) {
      const a = MANIFEST.sfx[id]!;
      expect(a.files.length, id).toBeGreaterThanOrEqual(2);
      expect(a.pitch, id).toBeGreaterThan(0);
      expect(a.vol, id).toBeGreaterThan(0);
      expect(a.voices, id).toBeGreaterThanOrEqual(1);
      expect(a.voices, id).toBeLessThanOrEqual(3);
    }
  });

  it('only references files that exist and look like MP3s', () => {
    for (const z of allFiles()) {
      const p = join(AUDIO_DIR, z.file);
      const head = readFileSync(p).subarray(0, 3);
      const mp3 = (head[0] === 0xff && (head[1]! & 0xe0) === 0xe0) || head.toString('latin1') === 'ID3';
      expect(mp3, z.file).toBe(true);
      expect(statSync(p).size, z.file).toBeGreaterThan(200);
    }
  });

  it('ships no unreferenced audio files', () => {
    const used = new Set(allFiles().map((z) => z.file));
    for (const f of walk(AUDIO_DIR)) expect(used.has(f), f).toBe(true);
  });

  it('keeps the whole audio payload under 4 MB', () => {
    const total = walk(AUDIO_DIR).reduce((n, f) => n + statSync(join(AUDIO_DIR, f)).size, 0);
    expect(total).toBeLessThan(4 * 1024 * 1024);
  });

  it('has sane sample metadata: instant attacks, loops inside the file', () => {
    for (const z of allFiles()) {
      expect(z.onset, z.file).toBeGreaterThanOrEqual(0);
      expect(z.onset, z.file).toBeLessThan(0.005);
      expect(z.dur, z.file).toBeGreaterThan(0.02);
      if (z.loop) {
        expect(z.loop[0], z.file).toBeGreaterThan(0);
        expect(z.loop[1], z.file).toBeGreaterThan(z.loop[0]);
        // the file keeps a little audio past the loop end (shift tolerance for decoders)
        expect(z.loop[1], z.file).toBeLessThan(z.dur);
      }
    }
    for (const [name, inst] of Object.entries(MANIFEST.instruments)) {
      if (inst.kind === 'sustain') for (const z of inst.zones ?? []) expect(z.loop, `${name} ${z.file}`).toBeDefined();
      if (inst.kind !== 'perc') for (const z of inst.zones ?? []) expect(z.root, z.file).toBeTypeOf('number');
      expect(instrumentFiles(name).length, name).toBeGreaterThan(0);
    }
  });

  it('makes every ambience loop a whole number of frames at both 44.1 and 48 kHz', () => {
    for (const [name, a] of Object.entries(MANIFEST.ambience)) {
      if (a.mode !== 'loop') {
        expect(a.every, name).toBeGreaterThan(0);
        continue;
      }
      const [s, e] = a.files[0]!.loop!;
      const body = e - s;
      // 300 = gcd(44100, 48000): a body of k/300 s is k*147 frames at 44.1 kHz and k*160 at 48 kHz.
      expect(Math.abs(body * 300 - Math.round(body * 300)), name).toBeLessThan(0.005);
    }
  });
});
