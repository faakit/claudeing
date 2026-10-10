import { recipes, skills } from '../data';
import type { RecipeDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents } from './events';
import { friendPerk } from './friendship';

export const skillIds = (): string[] => Object.keys(skills);

export const xpOf = (state: GameState, skill: string): number => state.skills[skill] ?? 0;

/** Current level (1-based, capped at the end of the XP table). */
export function levelOf(state: GameState, skill: string): number {
  const table = skills[skill]?.xpTable ?? [0];
  const xp = xpOf(state, skill);
  let level = 1;
  for (let i = 1; i < table.length; i++) if (xp >= (table[i] as number)) level = i + 1;
  return level;
}

export const maxLevel = (skill: string): number => skills[skill]?.xpTable.length ?? 1;

/** XP into the current level and XP the level needs, or null at max level. */
export function levelProgress(
  state: GameState,
  skill: string,
): { have: number; need: number } | null {
  const table = skills[skill]?.xpTable ?? [0];
  const level = levelOf(state, skill);
  if (level >= table.length) return null;
  const floor = table[level - 1] as number;
  return { have: xpOf(state, skill) - floor, need: (table[level] as number) - floor };
}

/** Award XP. Emits one `levelUp` per level crossed and records the level in stats for goals. */
export function addXp(state: GameState, skill: string, amount: number): void {
  if (!skills[skill] || amount <= 0) return;
  const before = levelOf(state, skill);
  // The town library (a project perk) makes every skill grow faster.
  state.skills[skill] = xpOf(state, skill) + Math.round(amount * (1 + perk(state, 'xpBonus')));
  const after = levelOf(state, skill);
  state.stats[`level.${skill}`] = after;
  for (let lvl = before + 1; lvl <= after; lvl++) gameEvents.emit('levelUp', { skill, level: lvl });
}

/** Something besides skills and friendship that grants perks (town projects, house upgrades...). */
export type PerkSource = (state: GameState, key: string) => number;
const perkSources = new Map<string, PerkSource>();

/** Add (or replace, by id) a perk source. Mechanics register theirs; `perk()` sums them all. */
export function registerPerkSource(id: string, source: PerkSource): void {
  perkSources.set(id, source);
}

/**
 * Sum of a perk across every skill level reached, every villager's hearts and every registered perk
 * source, e.g. perk(state, 'maxEnergy'). Perk keys are free-form strings: a system that wants a new perk
 * just reads it, and a data row (skills.json, npcs.json, projects.json...) grants it.
 */
export function perk(state: GameState, key: string): number {
  let total = 0;
  for (const [id, def] of Object.entries(skills)) {
    const level = levelOf(state, id);
    for (const [lvl, perks] of Object.entries(def.perks)) {
      if (Number(lvl) <= level) total += perks[key] ?? 0;
    }
  }
  for (const source of perkSources.values()) total += source(state, key);
  return total + friendPerk(state, key);
}

/** Has the house a kitchen? (A Home upgrade; its level is kept as the `upgraded.kitchen` stat.) */
export const hasKitchen = (state: GameState): boolean =>
  (state.stats['upgraded.kitchen'] ?? 0) >= 1;

export const isRecipeUnlocked = (state: GameState, recipe: RecipeDef): boolean =>
  (!recipe.unlock || levelOf(state, recipe.unlock.skill) >= recipe.unlock.level) &&
  (!recipe.kitchen || hasKitchen(state));

export const unlockedRecipes = (state: GameState): string[] =>
  Object.entries(recipes)
    .filter(([, r]) => isRecipeUnlocked(state, r))
    .map(([id]) => id);
