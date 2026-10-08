import type Phaser from 'phaser';

/**
 * A plain placeholder for a texture key that no art exists for yet (for example a town landmark): a small
 * building in the given colour. Real art loaded under the same key wins, because this only draws when the
 * key is missing.
 */
export function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  color: string,
  shape: 'house' | 'post' = 'house',
): string {
  if (scene.textures.exists(key)) return key;
  const t = scene.textures.createCanvas(key, 16, 16);
  if (!t) return key;
  const ctx = t.getContext();
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  if (shape === 'post') {
    // a box on a post (a mailbox)
    r(7, 8, 2, 8, '#241a2a');
    r(7, 8, 2, 7, '#7a4a28');
    r(2, 2, 12, 7, '#241a2a');
    r(3, 3, 10, 5, color);
    r(3, 3, 10, 1, '#f4ead2');
    r(12, 1, 1, 4, '#241a2a');
    t.refresh();
    return key;
  }
  r(1, 6, 14, 9, '#241a2a');
  r(2, 7, 12, 8, color);
  r(0, 3, 16, 4, '#241a2a');
  r(1, 4, 14, 2, '#7a4a28');
  r(3, 1, 10, 3, '#7a4a28');
  r(6, 10, 4, 5, '#241a2a');
  r(3, 9, 2, 2, '#f4ead2');
  r(11, 9, 2, 2, '#f4ead2');
  t.refresh();
  return key;
}
