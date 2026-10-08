import { npcs } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { isBirthday } from '../systems/friendship';

// A birthday is worth knowing about the moment you wake up.
registerDayHook({
  id: 'villagers:birthdays',
  phase: 'morning',
  order: 40,
  run(state, ctx) {
    for (const [id, def] of Object.entries(npcs))
      if (isBirthday(state, id)) ctx.notes.push(`It's ${def.name}'s birthday today!`);
  },
});
