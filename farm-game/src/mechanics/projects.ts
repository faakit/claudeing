import { projects } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { countItem } from '../systems/inventory';
import { goldGiven, isProjectOpen, itemNeeds, projectPerk } from '../systems/projects';
import { registerPerkSource } from '../systems/skills';

// Finished town projects grant their perks for good, exactly like skill levels and hearts do.
registerPerkSource('projects', projectPerk);

// A nudge in the morning summary when the player could finish a project today with what they hold.
registerDayHook({
  id: 'projects:ready',
  phase: 'morning',
  order: 50,
  run(state, ctx) {
    for (const [id, p] of Object.entries(projects)) {
      if (!isProjectOpen(state, id)) continue;
      const gold = p.gold - goldGiven(state, id);
      const goods = itemNeeds(state, id).every((n) => n.need - n.given <= countItem(state, n.item));
      if (gold <= state.money && goods) {
        ctx.notes.push(`You could finish the ${p.name} today. See the town board.`);
        return;
      }
    }
  },
});
