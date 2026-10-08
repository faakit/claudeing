import Phaser from 'phaser';
import { TILESET_KEY } from '../config';
import index from './atlases.json';
import { atlasFrames, planArt, type AtlasFrame, type TexturePlan } from './artPlan';
import { artKeys } from './registry';
import { ATLAS_FILES, artManifest, manifestByTexture, TILESET_FILE } from './manifest';

/**
 * Packed art from `public/assets/` (built by `art-src/tools/`). `atlases.json` says which files exist, so a
 * missing atlas is never requested. Anything the atlases do not define keeps its code-generated placeholder.
 */
type Group = keyof typeof ATLAS_FILES;
const groups = (index.atlases as string[]).filter((g): g is Group => g in ATLAS_FILES);

/** Queue the atlas files (call from a scene's preload). The tileset loads straight under its tilemap key. */
export function queueArtLoads(scene: Phaser.Scene): void {
  for (const g of groups) {
    const a = ATLAS_FILES[g];
    scene.load.atlas(a.key, a.png, a.json);
  }
  if (index.tileset) scene.load.image(TILESET_KEY, TILESET_FILE);
}

/** Frames of all loaded atlases. */
function loadedFrames(scene: Phaser.Scene): Map<string, AtlasFrame> {
  const frames = new Map<string, AtlasFrame>();
  for (const g of groups) {
    const key = ATLAS_FILES[g].key;
    const json = scene.cache.json.get(key) as Parameters<typeof atlasFrames>[1] | undefined;
    if (json) atlasFrames(key, json, frames);
    else if (scene.textures.exists(key)) {
      // The atlas loader does not keep the JSON; read the frames back from the texture.
      const tex = scene.textures.get(key);
      for (const name of tex.getFrameNames()) {
        const f = tex.get(name);
        frames.set(name, { atlas: key, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight });
      }
    }
  }
  return frames;
}

function alias(scene: Phaser.Scene, plan: TexturePlan): void {
  const atlas = scene.textures.get(plan.frames[0]!.src!.atlas);
  const source = atlas.source[0]!;
  const gl = source.glTexture;
  if (!gl) return paint(scene, plan);
  scene.textures.remove(plan.texture);
  const tex = scene.textures.create(plan.texture, gl, source.width, source.height);
  if (!tex) return;
  const single = plan.frames.length === 1 && !plan.frames[0]!.entry.frame;
  if (single) {
    const s = plan.frames[0]!.src!;
    tex.add('__BASE', 0, s.x, s.y, s.w, s.h);
    return;
  }
  tex.add('__BASE', 0, 0, 0, source.width, source.height);
  for (const { entry, src } of plan.frames)
    tex.add(entry.frame!, 0, src!.x, src!.y, src!.w, src!.h);
}

/** Paint atlas frames over the generated canvas texture (partial coverage, or the Canvas renderer). */
function paint(scene: Phaser.Scene, plan: TexturePlan): void {
  let tex = scene.textures.get(plan.texture) as Phaser.Textures.CanvasTexture;
  if (!(tex instanceof Phaser.Textures.CanvasTexture)) return;
  const single = plan.frames.length === 1 && !plan.frames[0]!.entry.frame;
  for (const { entry, src } of plan.frames) {
    if (!src) continue;
    const img = scene.textures.get(src.atlas).getSourceImage() as CanvasImageSource;
    if (single && (tex.width !== src.w || tex.height !== src.h)) {
      scene.textures.remove(plan.texture);
      const fresh = scene.textures.createCanvas(plan.texture, src.w, src.h);
      if (!fresh) return;
      tex = fresh;
    }
    const target = single ? { x: 0, y: 0 } : tex.get(entry.frame!);
    // A frame painted into the generated grid must keep its cell size (taller art needs the WebGL alias path).
    if (
      !single &&
      ('cutWidth' in target ? target.cutWidth !== src.w || target.cutHeight !== src.h : false)
    )
      continue;
    const tx = 'cutX' in target ? target.cutX : target.x;
    const ty = 'cutY' in target ? target.cutY : target.y;
    const ctx = tex.getContext();
    ctx.clearRect(tx, ty, src.w, src.h);
    ctx.drawImage(img, src.x, src.y, src.w, src.h, tx, ty, src.w, src.h);
  }
  tex.refresh();
}

/**
 * Swap atlas art in behind the texture keys (call after the placeholders are generated). Returns the plans,
 * and logs an error for any manifest key that resolves to nothing, so e2e catches a missing texture.
 */
export function applyArt(scene: Phaser.Scene): TexturePlan[] {
  const entries = artManifest();
  const canAlias = scene.game.renderer.type === Phaser.WEBGL;
  const plans = planArt(
    manifestByTexture(entries.filter((e) => e.group !== 'tiles')),
    loadedFrames(scene),
    canAlias,
  );
  artKeys.clear();
  for (const p of plans) {
    if (p.mode !== 'generated') artKeys.add(p.texture);
    if (p.rejected.length) console.warn(`[art] ${p.texture}: ${p.rejected.join('; ')}`);
    if (p.mode === 'alias') alias(scene, p);
    else if (p.mode === 'paint') paint(scene, p);
  }
  const missing = entries.filter((e) => {
    if (e.optional) return false;
    if (!scene.textures.exists(e.texture)) return true;
    if (e.group === 'tiles' || !e.frame) return false;
    return !scene.textures.get(e.texture).has(e.frame);
  });
  if (missing.length)
    console.error(`[art] missing textures: ${missing.map((e) => e.frame ?? e.texture).join(', ')}`);
  return plans;
}
