import { npcs } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { isBirthday } from '../systems/friendship';
import { villagerHome } from '../systems/houses';
import { t } from '../i18n';

// A birthday is worth knowing about the moment you wake up.
registerDayHook({
  id: 'villagers:birthdays',
  phase: 'morning',
  order: 40,
  run(state, ctx) {
    for (const [id, def] of Object.entries(npcs))
      if (isBirthday(state, id) && villagerHome(state, id))
        ctx.notes.push(t('npc.birthdayNote', { name: def.name }));
  },
});
