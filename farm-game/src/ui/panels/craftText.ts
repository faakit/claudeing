import { skills } from '../../data';
import type { RecipeDef } from '../../data';
import type { GameState } from '../../state/GameState';
import { hasKitchen, levelOf } from '../../systems/skills';

/** Why a recipe is locked: a skill level, or (for a dish) the kitchen. Pure, so a test can fit it. */
export function lockedText(s: GameState, r: RecipeDef): string {
  if (r.kitchen && !hasKitchen(s)) return 'Needs a kitchen';
  if (!r.unlock) return 'Locked';
  return `${skills[r.unlock.skill]?.name} Lv ${r.unlock.level} (you: ${levelOf(s, r.unlock.skill)})`;
}
