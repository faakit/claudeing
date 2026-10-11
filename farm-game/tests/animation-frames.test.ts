import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  ACT_FEET_ROW,
  ACT_FRAMES,
  actKey,
  artManifest,
  atlasFrameName,
  NPC_IDLE_FRAMES,
  PLAYER_WALK_FRAMES,
  TOOL_ANIMS,
  TOOL_ANIM_FRAMES,
  toolAnimFrames,
  toolFrameHeight,
} from '../src/art/manifest';

/** Decode an 8-bit RGBA or palette PNG (non-interlaced), enough for the packed atlases. */
function decodePng(buf: Buffer): { w: number; h: number; px: Uint8Array } {
  let p = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const kind = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      type = data[9]!;
      expect(data[8], 'bit depth').toBe(8);
    } else if (kind === 'PLTE') plte = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= bpp ? cur[x - bpp]! : 0;
      const b = prev[x]!;
      const c = x >= bpp ? prev[x - bpp]! : 0;
      let r = v;
      if (f === 1) r = v + a;
      else if (f === 2) r = v + b;
      else if (f === 3) r = v + ((a + b) >> 1);
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[x] = r & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (bpp === 1) {
        const i = cur[x]!;
        out.set([plte![i * 3]!, plte![i * 3 + 1]!, plte![i * 3 + 2]!, trns?.[i] ?? 255], o);
      } else {
        out.set(
          [
            cur[x * bpp]!,
            cur[x * bpp + 1]!,
            cur[x * bpp + 2]!,
            bpp === 4 ? cur[x * bpp + 3]! : 255,
          ],
          o,
        );
      }
    }
    prev.set(cur);
  }
  return { w, h, px: out };
}

const atlas = (g: string) => {
  const json = JSON.parse(readFileSync(`public/assets/sprites/${g}.json`, 'utf8')) as {
    frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  };
  return { frames: json.frames, img: decodePng(readFileSync(`public/assets/sprites/${g}.png`)) };
};
const chars = atlas('chars');

/** A frame as rows of 'rrggbbaa' strings ('' for transparent). */
function frame(name: string): string[][] {
  const f = chars.frames[name];
  expect(f, name).toBeTruthy();
  const { x, y, w, h } = f!.frame;
  const rows: string[][] = [];
  for (let j = 0; j < h; j++) {
    const row: string[] = [];
    for (let i = 0; i < w; i++) {
      const o = ((y + j) * chars.img.w + x + i) * 4;
      const px = chars.img.px;
      row.push(px[o + 3] ? `${px[o]},${px[o + 1]},${px[o + 2]}` : '');
    }
    rows.push(row);
  }
  return rows;
}

const palette = new Set(
  readFileSync('public/assets/palette.gpl', 'utf8')
    .split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => `${m[1]},${m[2]},${m[3]}`),
);

describe('animation frames (art round 4)', () => {
  it('packs an 8-frame walk per direction and every tool-use sequence the manifest names', () => {
    for (const d of ['down', 'up', 'right', 'left'])
      for (let i = 0; i < PLAYER_WALK_FRAMES; i++) frame(`player_walk_${d}_${i}`);
    let n = 0;
    for (const item of Object.keys(TOOL_ANIMS))
      for (const d of TOOL_ANIMS[item]!.dirs) {
        const keys = toolAnimFrames(item, d);
        expect(keys).toHaveLength(TOOL_ANIM_FRAMES);
        for (const k of keys) {
          const f = frame(k);
          expect([f[0]!.length, f.length], k).toEqual([
            32,
            toolFrameHeight(TOOL_ANIMS[item]!.tool, d),
          ]);
          n++;
        }
      }
    expect(n).toBeGreaterThanOrEqual(5 * 3 * TOOL_ANIM_FRAMES);
    expect(toolAnimFrames('watering_can', 'up')).toEqual([]);
  });

  it('keeps the head pixel-identical to the idle frame in every walk frame (bob: 0 or 1 px down)', () => {
    for (const d of ['down', 'up', 'right', 'left']) {
      const idle = frame(`player_idle_${d}_0`);
      const head = idle.slice(0, 16).map((r) => r.join('|'));
      for (let i = 0; i < PLAYER_WALK_FRAMES; i++) {
        const f = frame(`player_walk_${d}_${i}`).map((r) => r.join('|'));
        const at0 = f.slice(0, 16).every((r, j) => r === head[j]);
        const at1 = f.slice(1, 17).every((r, j) => r === head[j]);
        expect(at0 || at1, `player_walk_${d}_${i}`).toBe(true);
      }
    }
  });

  it('plants a foot on the bottom row in every walk frame (no drifting baseline)', () => {
    for (const d of ['down', 'up', 'right', 'left'])
      for (let i = 0; i < PLAYER_WALK_FRAMES; i++) {
        const f = frame(`player_walk_${d}_${i}`);
        expect(
          f[31]!.some((p) => p !== ''),
          `player_walk_${d}_${i}`,
        ).toBe(true);
      }
  });

  it('draws the tool-use head where the idle head is (32 px canvas, body at x 8..23; the body may sink 1 px)', () => {
    for (const d of ['down', 'right'] as const) {
      const idle = frame(`player_idle_${d}_0`);
      const k = `player_tool_scythe_${d}_2`;
      const f = frame(k);
      // the face rows (8..14) are untouched by the scythe's contact pose, moved down 0 or 1 px with the body
      const at = (dy: number) =>
        [8, 9, 10, 11, 12, 13, 14].every(
          (y) => f[y + dy]!.slice(8, 24).join('|') === idle[y]!.join('|'),
        );
      expect(at(0) || at(1), k).toBe(true);
    }
  });

  it('uses only palette colours in every atlas', () => {
    for (const g of ['chars', 'world', 'ui']) {
      const { img } = g === 'chars' ? chars : atlas(g);
      const off = new Set<string>();
      for (let o = 0; o < img.px.length; o += 4)
        if (img.px[o + 3]) {
          expect(img.px[o + 3], `${g} alpha`).toBe(255);
          const c = `${img.px[o]},${img.px[o + 1]},${img.px[o + 2]}`;
          if (!palette.has(c)) off.add(c);
        }
      expect([...off], g).toEqual([]);
    }
  });

  it('packs every round-4 frame the manifest names, at its size', () => {
    const all = { ...chars.frames, ...atlas('world').frames, ...atlas('ui').frames };
    const want = artManifest().filter((e) => /^art round [45]/.test(e.from));
    expect(want.length).toBeGreaterThan(150);
    for (const e of want) {
      const f = all[atlasFrameName(e)];
      expect(f, atlasFrameName(e)).toBeTruthy();
      if (e.exact) expect([f!.frame.w, f!.frame.h], atlasFrameName(e)).toEqual([e.w, e.h]);
    }
  });

  it('gives every villager a 4-frame idle per direction with the feet planted', () => {
    for (const id of ['mara', 'finn', 'orin', 'rosa', 'clay'])
      for (const d of ['down', 'up', 'right', 'left']) {
        const rest = frame(`npc_${id}_${d}_0`);
        for (let i = 1; i < NPC_IDLE_FRAMES; i++) {
          const f = frame(`npc_${id}_${d}_${i}`);
          // the bottom two rows (feet) never move
          expect(
            f.slice(-2).map((r) => r.join('|')),
            `npc_${id}_${d}_${i}`,
          ).toEqual(rest.slice(-2).map((r) => r.join('|')));
        }
      }
  });

  it('composes every Flow action frame on the idle head, pixel for pixel, with a foot on row 39', () => {
    let n = 0;
    for (const [anim, dirs] of Object.entries(ACT_FRAMES))
      for (const [d, count] of Object.entries(dirs)) {
        const idle = frame(`player_idle_${d}_0`);
        const top = idle.findIndex((r) => r.some((p) => p !== ''));
        const head = idle.slice(top, top + 10); // crown to eyes: the face and hair the critic checks
        for (let i = 0; i < count; i++) {
          const k = actKey(anim, d, i);
          const f = frame(k);
          expect([f[0]!.length, f.length], k).toEqual([32, 44]);
          let found = false;
          for (let oy = 0; oy + head.length <= f.length && !found; oy++)
            for (let ox = 0; ox + 16 <= 32 && !found; ox++)
              found = head.every((row, y) =>
                row.every((p, x) => p === '' || f[oy + y]![ox + x] === p),
              );
          expect(found, `${k}: the idle head`).toBe(true);
          expect(
            f.slice(ACT_FEET_ROW - 1, ACT_FEET_ROW + 1).some((r) => r.some((p) => p !== '')),
            `${k}: feet on row ${ACT_FEET_ROW}`,
          ).toBe(true);
          n++;
        }
      }
    expect(n).toBeGreaterThanOrEqual(60);
  });

  it('draws every action frame as one piece: no detached tool parts or specks (review 18)', () => {
    for (const [anim, dirs] of Object.entries(ACT_FRAMES))
      for (const [d, count] of Object.entries(dirs))
        for (let i = 0; i < count; i++) {
          const k = actKey(anim, d, i);
          const f = frame(k);
          const H = f.length;
          const W = f[0]!.length;
          const seen = f.map((r) => r.map(() => false));
          let pieces = 0;
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
              if (f[y]![x] === '' || seen[y]![x]) continue;
              pieces++;
              const stack: [number, number][] = [[y, x]];
              seen[y]![x] = true;
              while (stack.length) {
                const [cy, cx] = stack.pop()!;
                for (let dy = -1; dy <= 1; dy++)
                  for (let dx = -1; dx <= 1; dx++) {
                    const ny = cy + dy;
                    const nx = cx + dx;
                    if (ny < 0 || nx < 0 || ny >= H || nx >= W) continue;
                    if (f[ny]![nx] === '' || seen[ny]![nx]) continue;
                    seen[ny]![nx] = true;
                    stack.push([ny, nx]);
                  }
              }
            }
          expect(pieces, `${k}: pieces`).toBe(1);
        }
  });
});
