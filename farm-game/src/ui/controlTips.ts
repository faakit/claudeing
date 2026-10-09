/**
 * One-time first-run tips that teach the one-thumb gestures in play (M7). Each shows once per game (a stat
 * flag), when the player is doing the slow version of what the gesture does faster. Tests check they fit a
 * toast (186 px, 3 lines).
 */
export const TIPS = {
  /** After the third tile tilled one at a time with Action. */
  paint: 'Tip: hold Action a moment, then drag, to work a whole row.',
  /** After the third tool change by swipe or hotbar. */
  ring: 'Tip: flick Action sideways for a ring of all your tools.',
} as const;
