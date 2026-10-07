import type { Direction } from '../state/GameState';

export const DIRECTIONS: readonly Direction[] = ['down', 'up', 'left', 'right'];

export const DIR_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const isDirection = (v: unknown): v is Direction =>
  typeof v === 'string' && (DIRECTIONS as readonly string[]).includes(v);

/**
 * Reduce an analog vector to one of 4 directions. When `current` is given, the
 * current axis wins until the other axis is `bias` times stronger, which stops
 * flicker when the thumb sits near a diagonal.
 */
export function dominantDirection(
  x: number,
  y: number,
  deadzone: number,
  bias = 1.25,
  current: Direction | null = null,
): Direction | null {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (Math.max(ax, ay) < deadzone) return null;
  let horizontal = ax >= ay;
  if (current) {
    const wasHorizontal = current === 'left' || current === 'right';
    horizontal = wasHorizontal ? !(ay > ax * bias) : ax > ay * bias;
  }
  return horizontal ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down';
}
