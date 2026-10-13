import { items, npcs, skills } from '../../data';
import type { RecipeDef } from '../../data';
import type { GameState } from '../../state/GameState';
import { countItem } from '../../systems/inventory';
import { hasKitchen, levelOf } from '../../systems/skills';
import { fmtGold, t } from '../../i18n';

/** Why a recipe is locked: a skill level, or (for a dish) the kitchen. Pure, so a test can fit it. */
export function lockedText(s: GameState, r: RecipeDef): string {
  if (r.kitchen && !hasKitchen(s)) return t('craft.needsKitchen');
  const f = r.friend;
  const who = f ? (npcs[f.npc]?.name ?? f.npc) : '';
  if (!r.unlock)
    return f ? t('craft.needsFriend', { name: who, count: f.hearts }) : t('craft.locked');
  if (f)
    return t('craft.orFriend', {
      skill: skills[r.unlock.skill]?.name ?? r.unlock.skill,
      level: r.unlock.level,
      name: who,
      count: f.hearts,
    });
  return t('craft.needsLevel', {
    skill: skills[r.unlock.skill]?.name ?? r.unlock.skill,
    level: r.unlock.level,
    have: levelOf(s, r.unlock.skill),
  });
}

/** A recipe's ingredients: "2 Carp, Potato, 400g" (a count only when more than one). Pure, so a test fits it. */
export const recipeNeed = (r: RecipeDef): string =>
  r.ingredients
    .map((i) => `${i.qty > 1 ? `${i.qty} ` : ''}${items[i.item]?.name ?? i.item}`)
    .concat(r.gold ? [fmtGold(r.gold)] : [])
    .join(', ');

/**
 * A recipe's ingredients, with where the first short one comes from ("12 Fiber: cut weeds, or at Mara's"): every
 * ask says where its goods come from (owner rule, the fund sheets), and fiber was the one players could not find
 * (QA round). The row's sub wraps to two lines. Pure, so a test fits it.
 */
export function recipeNeedLine(s: GameState, r: RecipeDef): string {
  const need = recipeNeed(r);
  const short = r.ingredients.find((i) => countItem(s, i.item) < i.qty && items[i.item]?.source);
  const source = short ? items[short.item]?.source : undefined;
  return source ? t('project.needFrom', { line: need, source }) : need;
}
