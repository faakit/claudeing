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
  shape: 'house' | 'post' | 'statue' | 'trophy' | 'site' = 'house',
  level = 1,
): string {
  if (scene.textures.exists(key)) return key;
  const tall = shape === 'statue';
  const t = scene.textures.createCanvas(key, 16, tall ? 32 : 16);
  if (!t) return key;
  const ctx = t.getContext();
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  if (shape === 'statue') {
    // a plinth and a figure that gets taller with each level (gilded from level 6), until the art lands
    const h = Math.min(24, 4 + level * 4);
    const body = level >= 6 ? '#e8c050' : color;
    r(2, 26, 12, 6, '#241a2a');
    r(3, 27, 10, 4, '#9a9284');
    r(5, 26 - h, 6, h, '#241a2a');
    r(6, 27 - h, 4, h - 1, body);
    r(6, 27 - h, 4, 1, '#f4ead2');
    t.refresh();
    return key;
  }
  if (shape === 'site') {
    // a broken place by stage (`level` 0 untouched .. 3 restored): the spring's mouth under a rockfall that comes
    // off a stone at a time, the water showing more each day (until the art lands)
    const lv = Math.min(3, Math.max(0, level));
    r(1, 6, 14, 10, '#241a2a'); // the mouth: a ring of old stones
    r(2, 7, 12, 8, '#7a7684');
    r(4, 9, 8, 5, lv >= 1 ? '#2e4a7a' : '#4c2c1c'); // the hollow: dry earth, then water
    if (lv >= 1) r(5, 9, Math.min(6, lv * 2), 1, '#72aadc');
    if (lv >= 3) r(10, 13, 6, 2, '#3c74b4'); // the water runs off toward the creek
    const fall = [
      [3, 1],
      [8, 2],
      [5, 6],
      [10, 6],
      [2, 8],
      [7, 9],
    ].slice(0, [6, 4, 2, 0][lv]);
    for (const [x, y] of fall) {
      r(x!, y!, 6, 5, '#241a2a');
      r(x! + 1, y! + 1, 4, 3, '#aeb0b4');
      r(x! + 1, y! + 3, 4, 1, color);
    }
    t.refresh();
    return key;
  }
  if (shape === 'trophy') {
    // a cup on a small stand
    r(4, 2, 8, 7, '#241a2a');
    r(5, 3, 6, 5, color);
    r(5, 3, 6, 1, '#f4ead2');
    r(2, 3, 2, 3, '#241a2a');
    r(12, 3, 2, 3, '#241a2a');
    r(7, 9, 2, 3, '#241a2a');
    r(4, 12, 8, 4, '#241a2a');
    r(5, 13, 6, 2, '#7a4a28');
    t.refresh();
    return key;
  }
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
