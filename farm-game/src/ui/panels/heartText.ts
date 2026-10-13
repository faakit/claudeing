import { recipes } from '../../data';
import type { GameState } from '../../state/GameState';
import { nextHeart, type HeartRewards } from '../../systems/friendship';
import { t } from '../../i18n';
import { perkLine } from './perkText';

/** What one heart level brings, as a list ("a letter, 5% off shop prices, a scene"). Pure, so a test fits it. */
export function heartRewardList(r: HeartRewards): string {
  const parts: string[] = [];
  if (r.letter) parts.push(t('npc.heartLetter'));
  const perks = perkLine(r.perks);
  if (perks) parts.push(perks);
  for (const id of r.recipes) parts.push(t('npc.heartRecipe', { name: recipes[id]?.name ?? id }));
  if (r.dailyGift) parts.push(t('npc.heartDaily'));
  if (r.favourites) parts.push(t('npc.heartFavs'));
  if (r.scene) parts.push(t('npc.heartScene'));
  return parts.join(', ');
}

/** The villager sheet's line about the next heart (QA round: show what it brings), or the best-friends line. */
export function nextHeartLine(s: GameState, id: string): string {
  const next = nextHeart(s, id);
  if (!next) return t('npc.bestFriends');
  const list = heartRewardList(next);
  return list ? t('npc.nextHeart', { list }) : t('npc.atHearts', { count: next.hearts, perks: '' });
}
