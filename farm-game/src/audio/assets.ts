import manifestData from './manifest.json';
import musicData from './music.json';
import { pickZone } from './zones';
import type { AudioManifest, MusicData, MusicSlot, Zone } from './types';

/** The generated asset manifest (audio-src/tools/build.py) and the composed music, typed. */
export const MANIFEST = manifestData as unknown as AudioManifest;
export const MUSIC = musicData as unknown as MusicData;

/** A jingle (game cue) or a sting (engine moment) by name. */
export const jingleOrSting = (name: string) => MUSIC.jingles[name] ?? MUSIC.stings[name];

/** Sound effect cues played by the sampler as short in-key jingles instead of from a file. */
export const JINGLE_CUES = new Set(Object.keys(MUSIC.jingles));

/** The sample (and playback rate) that plays `midi` on an instrument; hits for percussion. */
export function sampleFor(inst: string, midi: number, perc: boolean): { zone: Zone; rate: number } | null {
  const a = MANIFEST.instruments[inst];
  if (!a) return null;
  if (perc || a.kind === 'perc') {
    const hits = a.hits ?? [];
    if (hits.length === 0) return null;
    return { zone: hits[((midi % hits.length) + hits.length) % hits.length]!, rate: 1 };
  }
  if (!a.zones || a.zones.length === 0) return null;
  const { zone, rate } = pickZone(a.zones, midi);
  return { zone, rate };
}

/** Every file an instrument needs. */
export function instrumentFiles(inst: string): Zone[] {
  const a = MANIFEST.instruments[inst];
  return a ? [...(a.zones ?? []), ...(a.hits ?? [])] : [];
}

/** Instruments a music slot uses (its piece's layers). */
export function slotInstruments(slot: MusicSlot): string[] {
  const piece = MUSIC.pieces[slot];
  return piece ? [...new Set(piece.layers.map((l) => l.inst))] : [];
}

/** Instruments the event jingles use (loaded early, with the sound effects). */
export function jingleInstruments(): string[] {
  return [
    ...new Set([...Object.values(MUSIC.jingles), ...Object.values(MUSIC.stings)].flatMap((j) => j.parts.map((p) => p.inst))),
  ];
}

/** Every file of every kind, in a sensible download order: sfx, jingles, title, then the rest. */
export function allFiles(): Zone[] {
  const seen = new Set<string>();
  const out: Zone[] = [];
  const add = (zs: Zone[]) =>
    zs.forEach((z) => {
      if (!seen.has(z.file)) {
        seen.add(z.file);
        out.push(z);
      }
    });
  Object.values(MANIFEST.sfx).forEach((s) => add(s.files));
  jingleInstruments().forEach((i) => add(instrumentFiles(i)));
  slotInstruments('title').forEach((i) => add(instrumentFiles(i)));
  Object.keys(MANIFEST.instruments).forEach((i) => add(instrumentFiles(i)));
  Object.values(MANIFEST.ambience).forEach((a) => add(a.files));
  return out;
}
