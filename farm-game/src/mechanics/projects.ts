import { game, projects } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { countItem } from '../systems/inventory';
import { goldGiven, isProjectOpen, itemNeeds, priceOf, projectPerk } from '../systems/projects';
import { absoluteDay } from '../systems/time';
import { registerPerkSource } from '../systems/skills';

// Finished town projects grant their perks for good, exactly like skill levels and hearts do.
registerPerkSource('projects', projectPerk);

// A nudge in the morning summary when the player could finish a project today with what they hold: once a
// season per project, not every morning (critique 9, F6).
registerDayHook({
  id: 'projects:ready',
  phase: 'morning',
  order: 50,
  run(state, ctx) {
    for (const [id, p] of Object.entries(projects)) {
      // A repeatable project (the statue) is always open; it is not news that you could fund it.
      if (!isProjectOpen(state, id) || p.repeat) continue;
      const gold = priceOf(state, id) - goldGiven(state, id);
      const goods = itemNeeds(state, id).every((n) => n.need - n.given <= countItem(state, n.item));
      const said = state.stats[`projectNag.${id}`];
      if (said !== undefined && absoluteDay(state) - said < game.seasonLength) continue;
      if (gold <= state.money && goods) {
        state.stats[`projectNag.${id}`] = absoluteDay(state);
        ctx.notes.push(`You could finish the ${p.name} today. See the town board.`);
        return;
      }
    }
  },
});
