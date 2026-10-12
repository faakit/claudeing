import { npcs, tools, valley } from '../data';
import {
  registerActionHandler,
  registerToolAction,
  toolActionFor,
} from '../systems/actionRegistry';
import type { ToolActionContext } from '../systems/actionTypes';
import { registerDayHook } from '../systems/dayHooks';
import { spawnDrift, TIMBER_ITEM } from '../systems/drift';
import {
  arrivals,
  giveTimber,
  houseAt,
  houseDef,
  houseDone,
  houseOpen,
  villagerOf,
} from '../systems/houses';
import { countItem } from '../systems/inventory';
import { t } from '../i18n';

// The Weir's verb and the first homecoming (docs/MILESTONES.md M7): drift timber each morning, the timber hook, the
// houses that take timber, and the families who come home to them. The towing itself is the scene's
// (src/game/TowController.ts on src/game/weirTow.ts).

// Each morning with the river back, the day's drift logs join the queue (systems/drift.ts; positions are not saved).
registerDayHook({
  id: 'weir:drift',
  phase: 'morning',
  order: 57,
  run(state) {
    spawnDrift(state);
  },
});

// A family whose house was finished on an earlier day comes home this morning (systems/houses.ts). Before the post,
// so their villager's letters arrive with them.
registerDayHook({
  id: 'houses:arrivals',
  phase: 'morning',
  order: 58,
  run(state, ctx) {
    for (const id of arrivals(state)) {
      const who = villagerOf(id);
      const name = who ? (npcs[who]?.name ?? who) : (houseDef(id)?.name ?? id);
      ctx.notes.push(t('house.homeLine', { name }));
    }
  },
});

// The timber hook is a key item (every tool is owned from day 1 in a fixed hotbar slot): in hand, Action reads its
// tools.json action, `hook`. The towing controller takes Action first whenever a log is in view; this answers the
// rest of the time with where the logs are.
registerActionHandler({
  id: 'key-tool',
  priority: 41,
  plan(ctx) {
    const { def, stack } = ctx;
    if (!stack || !def || def.type !== 'key' || !def.tool) return null;
    const tool = tools[def.tool];
    const impl = tool && toolActionFor(tool.action);
    if (!tool || !impl) return null;
    return impl({ ...ctx, toolId: stack.item, tool } as ToolActionContext);
  },
});
registerToolAction('hook', () => ({ refusal: t('tow.hookHere') }));

// Action facing a house's door with timber in the bag gives it (Interact does too, WorldScene).
registerActionHandler({
  id: 'house-timber',
  priority: 62,
  plan({ state, tile }) {
    const id = houseAt(tile.map, tile.tx, tile.ty);
    if (!id || countItem(state, TIMBER_ITEM) <= 0) return null;
    if (!houseOpen(state, id) || houseDone(state, id)) return null;
    return {
      plan: {
        kind: 'deliver',
        tx: tile.tx,
        ty: tile.ty,
        run: () => (giveTimber(state, id) ? { item: TIMBER_ITEM } : {}),
      },
    };
  },
});

// Action facing the slip with nothing hooked says what it is for (towing takes Action while a log is in hand).
registerActionHandler({
  id: 'log-slip',
  priority: 61,
  plan({ state, tile }) {
    const d = valley.weir?.drift;
    if (!d || tile.map !== d.map || tile.tx !== d.slip.bank[0] || tile.ty !== d.slip.bank[1])
      return null;
    if ((state.stats['place.weir'] ?? 0) < 3) return null;
    return { refusal: t('tow.slip') };
  },
});
