/**
 * Pure maths for the 5x7 pixel font: glyph shapes and text measuring. No Phaser here, so unit tests
 * can prove that UI strings fit their boxes.
 *
 * Each glyph is 9 rows of 5 bits (bit 4 = leftmost); rows 7-8 hold descenders (g j p q y).
 */
export const GLYPHS: Record<string, string> = {
  A: '0e 11 11 1f 11 11 11',
  B: '1e 11 11 1e 11 11 1e',
  C: '0e 11 10 10 10 11 0e',
  D: '1e 11 11 11 11 11 1e',
  E: '1f 10 10 1e 10 10 1f',
  F: '1f 10 10 1e 10 10 10',
  G: '0e 11 10 17 11 11 0f',
  H: '11 11 11 1f 11 11 11',
  I: '0e 04 04 04 04 04 0e',
  J: '07 02 02 02 02 12 0c',
  K: '11 12 14 18 14 12 11',
  L: '10 10 10 10 10 10 1f',
  M: '11 1b 15 15 11 11 11',
  N: '11 11 19 15 13 11 11',
  O: '0e 11 11 11 11 11 0e',
  P: '1e 11 11 1e 10 10 10',
  Q: '0e 11 11 11 15 12 0d',
  R: '1e 11 11 1e 14 12 11',
  S: '0f 10 10 0e 01 01 1e',
  T: '1f 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0e',
  V: '11 11 11 11 11 0a 04',
  W: '11 11 11 15 15 15 0a',
  X: '11 11 0a 04 0a 11 11',
  Y: '11 11 0a 04 04 04 04',
  Z: '1f 01 02 04 08 10 1f',
  a: '00 00 0e 01 0f 11 0f',
  b: '10 10 1e 11 11 11 1e',
  c: '00 00 0e 10 10 11 0e',
  d: '01 01 0f 11 11 11 0f',
  e: '00 00 0e 11 1f 10 0e',
  f: '06 09 08 1c 08 08 08',
  g: '00 00 0e 11 11 11 0f 01 0e',
  h: '10 10 16 19 11 11 11',
  i: '04 00 0c 04 04 04 0e',
  j: '02 00 06 02 02 02 02 12 0c',
  k: '10 10 12 14 18 14 12',
  l: '0c 04 04 04 04 04 0e',
  m: '00 00 1a 15 15 11 11',
  n: '00 00 16 19 11 11 11',
  o: '00 00 0e 11 11 11 0e',
  p: '00 00 1e 11 11 11 1e 10 10',
  q: '00 00 0f 11 11 11 0f 01 01',
  r: '00 00 16 19 10 10 10',
  s: '00 00 0f 10 0e 01 1e',
  t: '08 08 1c 08 08 09 06',
  u: '00 00 11 11 11 13 0d',
  v: '00 00 11 11 11 0a 04',
  w: '00 00 11 11 15 15 0a',
  x: '00 00 11 0a 04 0a 11',
  y: '00 00 11 11 11 11 0f 01 0e',
  z: '00 00 1f 02 04 08 1f',
  '0': '0e 11 13 15 19 11 0e',
  '1': '04 0c 04 04 04 04 0e',
  '2': '0e 11 01 02 04 08 1f',
  '3': '1f 02 04 02 01 11 0e',
  '4': '02 06 0a 12 1f 02 02',
  '5': '1f 10 1e 01 01 11 0e',
  '6': '06 08 10 1e 11 11 0e',
  '7': '1f 01 02 04 08 08 08',
  '8': '0e 11 11 0e 11 11 0e',
  '9': '0e 11 11 0f 01 02 0c',
  '!': '04 04 04 04 04 00 04',
  '"': '0a 0a 00 00 00 00 00',
  "'": '04 04 08 00 00 00 00',
  ',': '00 00 00 00 0c 0c 08',
  '.': '00 00 00 00 00 0c 0c',
  ':': '00 0c 0c 00 0c 0c 00',
  ';': '00 0c 0c 00 0c 0c 08',
  '-': '00 00 00 0e 00 00 00',
  '+': '00 04 04 1f 04 04 00',
  '/': '01 01 02 04 08 10 10',
  '%': '18 19 02 04 08 13 03',
  '(': '02 04 08 08 08 04 02',
  ')': '08 04 02 02 02 04 08',
  '?': '0e 11 01 02 04 00 04',
  '<': '02 04 08 10 08 04 02',
  '>': '08 04 02 01 02 04 08',
  '=': '00 00 1f 00 1f 00 00',
  '*': '00 0a 04 1f 04 0a 00',
  '#': '0a 0a 1f 0a 1f 0a 0a',
  _: '00 00 00 00 00 00 1f',
  $: '04 0f 14 0e 05 1e 04',
  '&': '0c 12 14 08 15 12 0d',
  '[': '0e 08 08 08 08 08 0e',
  ']': '0e 02 02 02 02 02 0e',
  '|': '04 04 04 04 04 04 04',
  '~': '00 00 08 15 02 00 00',
  '^': '04 0a 11 00 00 00 00',
};

export const GAP = 1; // blank column between glyphs in the atlas

export interface Glyph {
  ch: string;
  rows: number[];
  min: number;
  width: number;
}

export function parseGlyph(ch: string, spec: string): Glyph {
  const rows = spec.split(' ').map((h) => parseInt(h, 16));
  let min = 5;
  let max = -1;
  for (const r of rows) {
    for (let c = 0; c < 5; c++) {
      if (r & (1 << (4 - c))) {
        min = Math.min(min, c);
        max = Math.max(max, c);
      }
    }
  }
  if (max < 0) return { ch, rows, min: 0, width: 0 };
  return { ch, rows, min, width: max - min + 1 };
}

/** Advance width in px of a string at scale 1 (same maths the bitmap font uses). Pure, so tests can
 * prove that UI strings fit their boxes. Unknown characters count as the width of '?'. */
export function measureText(text: string, scale = 1): number {
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') w += 3;
    else {
      const spec = GLYPHS[ch] ?? GLYPHS['?'] ?? '';
      w += parseGlyph(ch, spec).width + 1;
    }
  }
  return Math.max(0, w - 1) * scale;
}

/** Shorten with '..' so the text fits `maxPx`. */
export function fitText(text: string, maxPx: number, scale = 1): string {
  if (measureText(text, scale) <= maxPx) return text;
  let t = text;
  while (t.length > 1 && measureText(`${t}..`, scale) > maxPx) t = t.slice(0, -1);
  return `${t}..`;
}

/** Ordered, meaning-preserving shortenings tried before a row of text is cut off with "..". */
const SHORTER: [RegExp, string][] = [
  [/\(have (\d+)\)/, 'x$1'],
  [/^Makes /, '> '],
  [/ Seeds$/, ''],
  [/ Sapling$/, ' Sap.'],
  [/^Silver /, 'Si. '],
  [/^Gold /, 'Au. '],
  [/\bhave (\d+)/, 'x$1'],
];

/** Like fitText, but first applies friendlier abbreviations so list rows keep their facts. */
export function fitRow(text: string, maxPx: number, scale = 1): string {
  let t = text;
  for (const [re, to] of SHORTER) {
    if (measureText(t, scale) <= maxPx) return t;
    t = t.replace(re, to);
  }
  return fitText(t, maxPx, scale);
}
