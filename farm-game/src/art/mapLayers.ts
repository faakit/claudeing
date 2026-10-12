import type Phaser from 'phaser';
import { TILESET_KEY } from '../config';
import index from './atlases.json';
import { NO_HOLE, wantHole, type HoleWant } from '../fx/SeeThrough';

/** Texture key of a season's tileset (palette swaps of the spring tiles, built by art-src/tools/seasons.py). */
export const seasonTilesetKey = (season: string): string => `${TILESET_KEY}_${season}`;

/** Texture key of a season's dry tileset (art/dryTiles.ts; `tiles_<season>_dry.png` once the art lane bakes it). */
export const dryTilesetKey = (season: string): string =>
  season === 'spring' ? `${TILESET_KEY}_dry` : `${seasonTilesetKey(season)}_dry`;

/**
 * The tileset texture for a map: outdoors, the season's own tileset when it was built and loaded (then no colour
 * tint is needed); otherwise the spring one. On the dry palette, the season's dry tileset when it is resident
 * (art/dryTiles.ts makes it). `tinted` says whether the old full-screen season tint still applies.
 */
export function tilesetFor(
  textures: { exists(key: string): boolean },
  season: string,
  outdoor: boolean,
  palette: 'dry' | null = null,
): { key: string; tinted: boolean } {
  if (outdoor && palette === 'dry') {
    const dry = dryTilesetKey(season);
    if (textures.exists(dry)) return { key: dry, tinted: false };
  }
  if (!outdoor || season === 'spring') return { key: TILESET_KEY, tinted: false };
  const key = seasonTilesetKey(season);
  return textures.exists(key) ? { key, tinted: false } : { key: TILESET_KEY, tinted: true };
}

/**
 * The art layers baked into each map by scripts/generate-maps.mjs (see scripts/map-art.mjs): ground detail and
 * transitions, shadows and flora, props, roofs, and an overhead layer you walk behind (tree crowns, lamp tops,
 * ridge caps). Purely visual; collision comes from the map's collision layer. Drawn only when the art tileset
 * exists: the generated placeholder tileset has none of these tiles.
 */
export const MAP_ART_LAYERS = [
  { name: 'detail', depth: 0.02 },
  { name: 'shade', depth: 0.03 },
  { name: 'props', depth: 0.06 },
  { name: 'roof', depth: 0.1 },
  { name: 'overhead', depth: 5000 },
  // lamp-post tops: above the player, never cut away (they hide nothing)
  { name: 'lamps', depth: 5000 },
] as const;

export class MapArt {
  private overhead: Phaser.Tilemaps.TilemapLayer | null = null;
  private readonly layers = new Map<string, Phaser.Tilemaps.TilemapLayer>();
  private wanted: HoleWant = NO_HOLE;
  private masked = false;
  private last = '';
  private readonly alpha = new Map<number, Uint8Array | null>();
  private probe: CanvasRenderingContext2D | null = null;

  constructor(
    map: Phaser.Tilemaps.Tilemap,
    private readonly tileset: Phaser.Tilemaps.Tileset,
    overheadTint = 0xffffff,
  ) {
    if (!index.tileset) return;
    for (const { name, depth } of MAP_ART_LAYERS) {
      if (map.getLayerIndex(name) === null) continue;
      const layer = map.createLayer(name, tileset);
      if (!layer) continue;
      layer.setDepth(depth);
      this.layers.set(name, layer);
      if (name === 'overhead') {
        this.overhead = layer;
        if (overheadTint !== 0xffffff) layer.setTint(overheadTint);
      }
    }
  }

  /** Put one tile (a tileset gid) into an art layer, e.g. Ilse's gate opened; false without that layer. */
  setTile(layer: string, tx: number, ty: number, gid: number): boolean {
    const l = this.layers.get(layer);
    if (!l || gid <= 0) return false;
    l.putTileAt(gid, tx, ty); // a layer tile index is the gid (tileset firstgid 1)
    return true;
  }

  /**
   * Call every frame. Says which parts of the see-through hole (`src/fx/SeeThrough.ts`) the overhead layer wants:
   * the body part only while a crown or an eave covers the player's lower body (they are behind it), the target
   * part while one covers the target tile's centre (see `wantHole`). Recomputed only when the player's pixel, the
   * target or `still` changes. The tiles themselves always stay fully opaque (review 9: no translucent disc).
   */
  want(
    px: number,
    py: number,
    target: { tx: number; ty: number } | undefined,
    still: boolean,
  ): HoleWant {
    if (!this.overhead) return NO_HOLE;
    const key = `${Math.round(px)},${Math.round(py)},${target?.tx},${target?.ty},${still}`;
    if (key !== this.last) {
      this.last = key;
      this.wanted = wantHole(this.wanted, px, py, target, this.opaque, still, (t) =>
        this.crownUnderBody(px, py).has(t.ty * 100000 + t.tx),
      );
    }
    return this.wanted;
  }

  /**
   * Put the hole on the overhead layer while this layer wants it, and keep it there while the hole is still
   * open (closing), so a crown never pops back whole; clear it once the hole has closed.
   */
  hole(mask: Phaser.Display.Masks.GeometryMask, open: boolean): void {
    const layer = this.overhead;
    if (!layer) return;
    const want = this.wanted.body || this.wanted.target;
    if (want && !this.masked) {
      layer.setMask(mask);
      this.masked = true;
    } else if (!want && !open && this.masked) {
      layer.clearMask();
      this.masked = false;
    }
  }

  /**
   * The overhead tiles of the crown (or crowns) over the player's lower body (the `bodyCover` box): every drawn
   * overhead tile 4-connected to one under that box, as `ty * 100000 + tx` keys (at most 256 tiles; a forest's
   * canopy counts as one crown).
   */
  crownUnderBody(px: number, py: number): Set<number> {
    const out = new Set<number>();
    const layer = this.overhead;
    if (!layer) return out;
    const drawn = (tx: number, ty: number) => (layer.getTileAt(tx, ty)?.index ?? -1) > 0;
    const queue: [number, number][] = [];
    const x0 = Math.floor((Math.round(px) - 5) / 16);
    const x1 = Math.floor((Math.round(px) + 4) / 16);
    const y0 = Math.floor((Math.round(py) - 12) / 16);
    const y1 = Math.floor((Math.round(py) - 1) / 16);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (drawn(tx, ty) && !out.has(ty * 100000 + tx)) {
          out.add(ty * 100000 + tx);
          queue.push([tx, ty]);
        }
    while (queue.length && out.size < 256) {
      const [tx, ty] = queue.shift()!;
      for (const [nx, ny] of [
        [tx + 1, ty],
        [tx - 1, ty],
        [tx, ty + 1],
        [tx, ty - 1],
      ] as const) {
        const k = ny * 100000 + nx;
        if (out.has(k) || !drawn(nx, ny)) continue;
        out.add(k);
        queue.push([nx, ny]);
      }
    }
    return out;
  }

  /** Is the overhead art opaque at this world pixel? Tiles' alpha is read once per tile id. */
  private readonly opaque = (x: number, y: number): boolean => {
    const tile = this.overhead?.getTileAt(Math.floor(x / 16), Math.floor(y / 16));
    if (!tile || tile.index <= 0) return false;
    const a = this.alphaOf(tile);
    if (!a) return true;
    const lx = tile.flipX ? 15 - (x & 15) : x & 15;
    const ly = tile.flipY ? 15 - (y & 15) : y & 15;
    return a[ly * 16 + lx] === 1;
  };

  /** A tile's 16 x 16 opacity (1 where its pixel is not clear), or null when it cannot be read (then: opaque). */
  private alphaOf(tile: Phaser.Tilemaps.Tile): Uint8Array | null {
    const known = this.alpha.get(tile.index);
    if (known !== undefined) return known;
    let a: Uint8Array | null = null;
    try {
      const set = (tile.tileset as Phaser.Tilemaps.Tileset | null) ?? this.tileset;
      const xy = set.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null;
      const src = set.image?.getSourceImage() as CanvasImageSource | undefined;
      if (xy && src && typeof document !== 'undefined') {
        if (!this.probe) {
          const c = document.createElement('canvas');
          c.width = 16;
          c.height = 16;
          this.probe = c.getContext('2d', { willReadFrequently: true });
        }
        const ctx = this.probe;
        if (ctx) {
          ctx.clearRect(0, 0, 16, 16);
          ctx.drawImage(src, xy.x, xy.y, 16, 16, 0, 0, 16, 16);
          const d = ctx.getImageData(0, 0, 16, 16).data;
          a = new Uint8Array(256);
          for (let i = 0; i < 256; i++) a[i] = d[i * 4 + 3]! > 0 ? 1 : 0;
        }
      }
    } catch {
      a = null;
    }
    this.alpha.set(tile.index, a);
    return a;
  }
}
