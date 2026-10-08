import { mixColor as mix } from './color';

/** Time-of-day color grade, applied as a multiply overlay. Keyframes are [minutes, 0xRRGGBB]. */
export const DAYLIGHT_KEYS: [number, number][] = [
  [360, 0xffdccc], // 6:00 rosy dawn
  [480, 0xfff4ec], // 8:00
  [600, 0xffffff], // 10:00 neutral day
  [1020, 0xffffff], // 5:00 PM
  [1110, 0xffe4cc], // 6:30 PM soft golden hour
  [1200, 0xf2bcc4], // 8:00 PM rose dusk (toward the palette's rose and plum, not orange)
  [1290, 0xa894c4], // 9:30 PM plum
  [1380, 0x7c7cb8], // 11:00 PM
  [1560, 0x646ca8], // 2:00 AM deep night
];

export function daylightColor(minutes: number): number {
  const first = DAYLIGHT_KEYS[0]!;
  const last = DAYLIGHT_KEYS[DAYLIGHT_KEYS.length - 1]!;
  if (minutes <= first[0]) return first[1];
  if (minutes >= last[0]) return last[1];
  for (let i = 1; i < DAYLIGHT_KEYS.length; i++) {
    const [t1, c1] = DAYLIGHT_KEYS[i]!;
    const [t0, c0] = DAYLIGHT_KEYS[i - 1]!;
    if (minutes <= t1) return mix(c0, c1, (minutes - t0) / (t1 - t0));
  }
  return last[1];
}

/** Indoors the grade is softened so the house stays cozy at any hour. */
export const indoorColor = (color: number): number => mix(color, 0xffffff, 0.65);

/** 0 by day, 1 deep into the night: drives the music crossfade. */
export function nightAmount(minutes: number): number {
  const t = (minutes - 1140) / (1320 - 1140);
  return Math.max(0, Math.min(1, t));
}
