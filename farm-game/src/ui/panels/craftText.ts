import { items, skills } from '../../data';
import type { RecipeDef } from '../../data';
import type { GameState } from '../../state/GameState';
import { hasKitchen, levelOf } from '../../systems/skills';

/** Why a recipe is locked: a skill level, or (for a dish) the kitchen. Pure, so a test can fit it. */
export function lockedText(s: GameState, r: RecipeDef): string {
  if (r.kitchen && !hasKitchen(s)) return 'Needs a kitchen';
  if (!r.unlock) return 'Locked';
  return `${skills[r.unlock.skill]?.name} Lv ${r.unlock.level} (you: ${levelOf(s, r.unlock.skill)})`;
}

/** A recipe's ingredients: "2 Carp, Potato, 400g" (a count only when more than one). Pure, so a test fits it. */
export const recipeNeed = (r: RecipeDef): string =>
  r.ingredients
    .map((i) => `${i.qty > 1 ? `${i.qty} ` : ''}${items[i.item]?.name ?? i.item}`)
    .concat(r.gold ? [`${r.gold}g`] : [])
    .join(', ');
