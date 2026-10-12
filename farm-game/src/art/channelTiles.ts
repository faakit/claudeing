/**
 * Channel tiles (art-src/tools/channeltiles.py): which tileset tile draws a channel cell, by its four neighbours.
 * Pure (no Phaser), so tests can check every mask has a tile and that the scene paints what the rules say.
 *
 * Names in public/assets/tilesets/tiles.json:
 *   `chan:<wet|dry>:<mask>`  the ditch itself, in the map's detail layer;
 *   `culvert:<mask>`         stone headwalls over a path the channel passes under (shade layer, the path stays);
 *   `chanmouth:<n|e|s|w>`    the cut through the creek's bank, on the creek cell (shade layer), from that side.
 * mask: N 1, E 2, S 4, W 8, a bit set where that neighbour is a channel (a culvert counts) or creek water.
 *
 * The tiles sit at the end of the tileset, after every baked map tile, so their slots move whenever the maps ask
 * for new baked tiles: always look them up by name (`tileGid`), never hard-code a gid.
 */

export type ChannelLook = 'wet' | 'dry';
export type Side = 'n' | 'e' | 's' | 'w';

/** The four sides with their mask bit and offset, in mask order. */
export const SIDES: readonly { side: Side; bit: number; dx: number; dy: number }[] = [
  { side: 'n', bit: 1, dx: 0, dy: -1 },
  { side: 'e', bit: 2, dx: 1, dy: 0 },
  { side: 's', bit: 4, dx: 0, dy: 1 },
  { side: 'w', bit: 8, dx: -1, dy: 0 },
];

/** The side of a neighbour that faces back (a creek cell east of a channel sees the channel on its west). */
export const OPPOSITE: Record<Side, Side> = { n: 's', e: 'w', s: 'n', w: 'e' };

/** Rows of a horizontal run (or columns of a vertical one) the water fills, for fx that follow the water. */
export const CHANNEL_WATER_BAND: readonly [number, number] = [6, 12];

/** The cell's mask: a bit for each side whose neighbour is a channel or creek water. */
export function channelMask(
  tx: number,
  ty: number,
  isChannel: (x: number, y: number) => boolean,
  isCreek: (x: number, y: number) => boolean,
): number {
  let m = 0;
  for (const s of SIDES)
    if (isChannel(tx + s.dx, ty + s.dy) || isCreek(tx + s.dx, ty + s.dy)) m |= s.bit;
  return m;
}

export const channelTileName = (look: ChannelLook, mask: number): string =>
  `chan:${look}:${mask & 15}`;

/** The culvert's headwalls: only the sides where a channel meets the path (none: nothing drawn). */
export function culvertTileName(
  tx: number,
  ty: number,
  isChannel: (x: number, y: number) => boolean,
): string | null {
  let m = 0;
  for (const s of SIDES) if (isChannel(tx + s.dx, ty + s.dy)) m |= s.bit;
  return m ? `culvert:${m}` : null;
}

export const mouthTileName = (side: Side): string => `chanmouth:${side}`;

export interface TileIndex {
  tiles?: Record<string, number>;
}

/** A tile's gid (tileset slot + 1, the map's one tileset starts at gid 1), or null when it is not in the tileset. */
export function tileGid(index: TileIndex | undefined, name: string): number | null {
  const slot = index?.tiles?.[name];
  return slot === undefined || slot < 0 ? null : slot + 1;
}

/** Ground decals in the shade layer that a channel cuts away (flowers, tufts, pebbles), and gets back when filled. */
const DECAL_PREFIX = [
  'patch_',
  'bloom_',
  'rose_',
  'tallgrass',
  'fern_flat',
  'pebbles',
  'seasonal_',
  'lush_',
  'gv_',
  'grass_',
  'shade_',
];

export const isGroundDecal = (name: string | undefined): boolean =>
  !!name && DECAL_PREFIX.some((p) => name.startsWith(p));

/** gid -> the first tile name using that slot (a decal test needs the name). */
export function namesBySlot(index: TileIndex | undefined): Map<number, string> {
  const out = new Map<number, string>();
  for (const [name, slot] of Object.entries(index?.tiles ?? {}))
    if (slot >= 0 && !out.has(slot + 1)) out.set(slot + 1, name);
  return out;
}
