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
  const wide = shape === 'site'; // a broken place's site covers 2x2 tiles
  const t = scene.textures.createCanvas(key, wide ? 32 : 16, tall || wide ? 32 : 16);
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
    // a broken place by stage (`level` 0 untouched .. 3 restored), 2x2 tiles: a rockfall heaped over the spring's
    // mouth that comes down a stone a day, water showing more each day, and running out to the pool once it is
    // clear (until the art lands)
    const lv = Math.min(3, Math.max(0, level));
    r(6, 16, 20, 14, '#241a2a'); // the mouth: a dark hollow in the hillside
    r(7, 17, 18, 12, '#4c2c1c');
    // bottom stones first, the top ones last: each day the top comes off and the heap is visibly lower
    const rocks: [number, number, number, number][] = [
      [1, 22, 8, 8],
      [8, 23, 9, 7],
      [16, 22, 9, 8],
      [4, 15, 10, 8],
      [13, 14, 11, 9],
      [22, 16, 8, 7],
      [24, 23, 7, 7],
      [9, 6, 11, 9],
    ];
    for (const [x, y, w, h] of rocks.slice(0, [8, 5, 3, 1][lv])) {
      r(x, y, w, h, '#241a2a');
      r(x + 1, y + 1, w - 2, h - 2, '#8a8694');
      r(x + 1, y + 1, w - 2, 2, '#aeb0b4');
      r(x + 2, y + h - 3, w - 4, 1, color);
    }
    if (lv >= 1) {
      // water showing at the mouth's foot, more each day; once it is clear it runs out to the pool
      const wet = [0, 6, 12, 24][lv]!;
      r(32 - wet, 27, wet, 4, lv >= 3 ? '#3c74b4' : '#2e4a7a');
      r(32 - wet, 27, wet, 1, '#72aadc');
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
