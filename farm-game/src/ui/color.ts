/** Linear blend of two 0xRRGGBB colors; t = 0 gives `a`, t = 1 gives `b`. */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
