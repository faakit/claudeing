import { atlasFrameName, type ArtEntry } from './manifest';

/** Where one atlas frame lives (from the packed atlas JSON). */
export interface AtlasFrame {
  atlas: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TexturePlan {
  texture: string;
  /**
   * alias: every frame comes from one atlas, so the key becomes a view onto the atlas's GPU texture.
   * paint: some frames come from atlases; they are painted over the generated canvas, the rest stays generated.
   * generated: nothing in the atlases; the code-drawn placeholder is used as is.
   */
  mode: 'alias' | 'paint' | 'generated';
  frames: { entry: ArtEntry; src: AtlasFrame | null }[];
  /** Atlas frames that were found but rejected (wrong size), for a console warning. */
  rejected: string[];
}

/** An atlas frame may stand in for an entry when it has the exact size, or (objects) the width and at least the height. */
export function frameFits(e: ArtEntry, f: AtlasFrame): boolean {
  if (e.exact) return f.w === e.w && f.h === e.h;
  return f.w >= e.w && f.h >= e.h && f.w <= 64 && f.h <= 64;
}

/**
 * Decide, per texture key, whether atlas art replaces the generated placeholder. Pure, so the unit test can
 * check that every manifest key resolves. `canAlias` is false on the Canvas renderer (no shared GPU texture).
 */
export function planArt(
  byTexture: Map<string, ArtEntry[]>,
  frames: Map<string, AtlasFrame>,
  canAlias: boolean,
): TexturePlan[] {
  const plans: TexturePlan[] = [];
  for (const [texture, entries] of byTexture) {
    const rejected: string[] = [];
    const list = entries.map((entry) => {
      const f = frames.get(atlasFrameName(entry)) ?? null;
      if (f && !frameFits(entry, f)) {
        rejected.push(`${atlasFrameName(entry)} is ${f.w}x${f.h}, wants ${entry.w}x${entry.h}`);
        return { entry, src: null };
      }
      return { entry, src: f };
    });
    const found = list.filter((l) => l.src);
    const atlases = new Set(found.map((l) => l.src!.atlas));
    let mode: TexturePlan['mode'] = 'generated';
    if (found.length === list.length && atlases.size === 1 && canAlias) mode = 'alias';
    else if (found.length > 0) mode = 'paint';
    plans.push({ texture, mode, frames: list, rejected });
  }
  return plans;
}

/** Phaser JSON-hash atlas data -> frame map. */
export function atlasFrames(
  atlasKey: string,
  json: { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> },
  into = new Map<string, AtlasFrame>(),
): Map<string, AtlasFrame> {
  for (const [name, f] of Object.entries(json.frames))
    into.set(name, { atlas: atlasKey, x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h });
  return into;
}
