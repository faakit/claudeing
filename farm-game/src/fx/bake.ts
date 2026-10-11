import type Phaser from 'phaser';

/**
 * Draw a Graphics once into a texture (with the WebGL renderer, so it looks exactly like the live Graphics) and
 * reuse it as an image. A live Graphics with circles and triangles is re-tessellated every frame (earcut was about
 * a quarter of the frame's JS on the dock buttons alone); an image is one quad. `ox, oy` is where the drawing's
 * origin lands in the texture. Returns the texture key.
 */
export function bakeGraphics(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  ox: number,
  oy: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false);
  rt.draw(g, ox, oy);
  rt.saveTexture(key);
  g.destroy();
  return key;
}
