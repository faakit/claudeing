/**
 * The friendship curve (QA round: "hearts are too easy to max"). Pure numbers with no imports, so valley.ts and
 * friendship.ts can both read it without a cycle.
 *
 * Each heart costs more than the last: 100, 150, 200, 250 and 300 points. Daily chats alone (10 points, 6 from two
 * hearts) reach the first heart in ten days and the fifth in about five months. Two loved gifts a week as well (the
 * weekly limit) get there in about five weeks.
 */
export const HEART_AT = [0, 100, 250, 450, 700, 1000] as const;
export const MAX_HEARTS = HEART_AT.length - 1;
export const MAX_POINTS: number = HEART_AT[MAX_HEARTS]!;

/** Whole hearts for a points total. */
export function heartsFor(points: number): number {
  let h = 0;
  while (h < MAX_HEARTS && points >= HEART_AT[h + 1]!) h += 1;
  return h;
}

/** Points for a number of hearts; a fraction lands that far into the next heart (2.5: halfway to 3). */
export function pointsForHearts(hearts: number): number {
  const h = Math.max(0, Math.min(MAX_HEARTS, hearts));
  const whole = Math.floor(h);
  if (whole >= MAX_HEARTS) return MAX_POINTS;
  const from = HEART_AT[whole]!;
  return Math.round(from + (h - whole) * (HEART_AT[whole + 1]! - from));
}

/** Points into the current heart and what the next one costs; null at the top. */
export function heartProgress(points: number): { have: number; need: number } | null {
  const h = heartsFor(points);
  if (h >= MAX_HEARTS) return null;
  return { have: points - HEART_AT[h]!, need: HEART_AT[h + 1]! - HEART_AT[h]! };
}

/** The curve saves used before the QA round: 50 points a heart, 250 at most. */
export const OLD_POINTS_PER_HEART = 50;

/** A total from the old curve on the new one: the same hearts, and the same share of the way to the next. */
export function rescaleOldPoints(old: number): number {
  const p = Math.max(0, Math.min(OLD_POINTS_PER_HEART * MAX_HEARTS, old));
  return pointsForHearts(p / OLD_POINTS_PER_HEART);
}
