import type { ToastKind } from '../systems/events';

/**
 * How long a self-dismissing text stays on screen: long enough to read it (owner: "a few dialogs are too quick to
 * read"). About 1.5 s to notice it plus 60 ms a character (a slow reader's pace on a small screen), never under
 * 2.5 s and never over 7 s; Calm mode gives half as long again. Portuguese runs about 25% longer, so its texts
 * stay up longer by themselves. Pure, so tests pin it.
 */
export const READ = { base: 1500, perChar: 60, min: 2500, max: 7000, calm: 1.5 } as const;

export function readMs(text: string, calm = false): number {
  const chars = [...text.replace(/\s+/g, ' ').trim()].length;
  const ms = Math.min(READ.max, Math.max(READ.min, READ.base + READ.perChar * chars));
  return Math.round(calm ? ms * READ.calm : ms);
}

/**
 * Toasts that stay until the player touches the screen once they have had their reading time (a refusal, a tip):
 * nothing the player must read to act goes away unread. The rest go by themselves.
 */
export const STICKY_TOASTS: readonly ToastKind[] = ['warn', 'tip'];
