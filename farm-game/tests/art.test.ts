import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// The generators only use Phaser for types; a stub lets them run against a fake scene in Node.
vi.mock('phaser', () => ({ default: {} }));

import { PLACEHOLDER_TILES, TILESET_KEY } from '../src/config';
import { animals, crops, items, nodes, npcs, placeables, tools } from '../src/data';
import index from '../src/art/atlases.json';
import { atlasFrames, planArt, type AtlasFrame } from '../src/art/artPlan';
import {
  ATLAS_FILES,
  artManifest,
  atlasFrameName,
  manifestByTexture,
  TILESET_FILE,
} from '../src/art/manifest';
import { generateGameArt } from '../src/art/gameArt';
import { generatePlaceholderTextures } from '../src/art/placeholders';

/** A fake Phaser scene that records every texture and frame the generators create. */
function generatedTextures(): Map<string, Set<string>> {
  const made = new Map<string, Set<string>>();
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'getImageData')
          return (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
          });
        if (prop === 'canvas') return {};
        return () => undefined;
      },
      set: () => true,
    },
  );
  (globalThis as unknown as { ImageData: unknown }).ImageData = class {
    constructor(public data: Uint8ClampedArray) {}
  };
  const textures = {
    exists: (k: string) => made.has(k),
    createCanvas: (key: string) => {
      if (made.has(key)) return null;
      const frames = new Set<string>();
      made.set(key, frames);
      return {
        getContext: () => ctx,
        add: (name: string) => frames.add(name),
        refresh: () => undefined,
        canvas: {},
      };
    },
    get: (key: string) => ({ refresh: () => undefined, key }),
    remove: (key: string) => made.delete(key),
  };
  const scene = { textures } as never;
  generatePlaceholderTextures(scene);
  generateGameArt(scene);
  return made;
}

function shippedFrames(): Map<string, AtlasFrame> {
  const frames = new Map<string, AtlasFrame>();
  for (const g of index.atlases as (keyof typeof ATLAS_FILES)[]) {
    const a = ATLAS_FILES[g];
    const path = `public/${a.json}`;
    expect(existsSync(path), `${path} listed in atlases.json`).toBe(true);
    expect(existsSync(`public/${a.png}`)).toBe(true);
    atlasFrames(a.key, JSON.parse(readFileSync(path, 'utf8')), frames);
  }
  return frames;
}

describe('art manifest', () => {
  const entries = artManifest();

  it('lists every texture key the data names', () => {
    const keys = new Set(entries.map((e) => e.texture));
    for (const it of Object.values(items)) expect(keys).toContain(it.icon);
    for (const t of Object.values(tools)) expect(keys).toContain(t.icon);
    for (const p of Object.values(placeables)) expect(keys).toContain(p.sprite);
    for (const a of Object.values(animals)) expect(keys).toContain(a.sprite);
    for (const id of Object.keys(nodes)) expect(keys).toContain(`node_${id}`);
    for (const id of Object.keys(npcs)) expect(keys).toContain(`npc_${id}`);
    const cropFrames = new Set(entries.filter((e) => e.texture === 'crops').map((e) => e.frame));
    for (const [id, c] of Object.entries(crops))
      for (let s = 0; s <= c.stageDays.length; s++) expect(cropFrames).toContain(`crop_${id}_${s}`);
    expect(entries.filter((e) => e.texture === TILESET_KEY)).toHaveLength(PLACEHOLDER_TILES.length);
  });

  it('every key resolves to an atlas frame or a generated fallback', () => {
    const generated = generatedTextures();
    const frames = shippedFrames();
    const plans = planArt(
      manifestByTexture(entries.filter((e) => e.group !== 'tiles')),
      frames,
      true,
    );
    const unresolved: string[] = [];
    for (const p of plans) {
      expect(p.rejected, `${p.texture} has atlas frames of the wrong size`).toEqual([]);
      for (const { entry, src } of p.frames) {
        if (src) continue;
        const gen = generated.get(entry.texture);
        const ok = gen && (!entry.frame || gen.has(entry.frame));
        if (!ok) unresolved.push(atlasFrameName(entry));
      }
    }
    expect(unresolved).toEqual([]);
    expect(generated.has(TILESET_KEY) || index.tileset).toBe(true);
  });

  it('ships no atlas frame the game never asks for', () => {
    const names = new Set(entries.map(atlasFrameName));
    const orphans = [...shippedFrames().keys()].filter((n) => !names.has(n));
    expect(orphans).toEqual([]);
  });

  it('the tileset image keeps the placeholder tile order and size', () => {
    if (!index.tileset) return;
    const png = readFileSync(`public/${TILESET_FILE}`);
    // PNG IHDR: width and height are big-endian at bytes 16 and 20.
    expect(png.readUInt32BE(16)).toBe(16 * PLACEHOLDER_TILES.length);
    expect(png.readUInt32BE(20) % 16).toBe(0);
  });
});
