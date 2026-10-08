import { game } from '../data';
import { restoreEnergy } from '../systems/energy';
import { gameEvents } from '../systems/events';
import { growCrops, killOutOfSeason, spawnWeeds } from '../systems/farming';
import { checkGoals } from '../systems/goals';
import { parseKey, sellValue } from '../systems/itemRef';
import { registerDayHook } from '../systems/dayHooks';
import { perk } from '../systems/skills';
import { ownsTile } from '../systems/plots';
import { advanceCalendar } from '../systems/time';
import { isWet, rollWeather, waterAllSoil } from '../systems/weather';

// The original rollover, expressed as hooks. Order inside the pipeline is what the design requires:
// crops grow, shipped goods are paid, then the calendar moves on and the new day sets itself up.

registerDayHook({
  id: 'core:start',
  phase: 'start',
  run(state, ctx) {
    // Summer's last day closes the year: the results screen is shown after this summary.
    ctx.summary.yearEnd = state.time.season === 'winter' && state.time.day === game.seasonLength;
  },
});

registerDayHook({
  id: 'core:growth',
  phase: 'growth',
  run: (state) => growCrops(state),
});

registerDayHook({
  id: 'core:payout',
  phase: 'payout',
  run(state, ctx) {
    // Shipping is keyed by stack identity ("tomato|2|"), so quality and derived goods price correctly.
    const shipped = Object.entries(state.shipping).map(([key, qty]) => ({
      item: key,
      qty,
      gold: Math.round(sellValue(parseKey(key)) * qty * (1 + perk(state, 'sellBonus'))),
    }));
    const total = shipped.reduce((s, l) => s + l.gold, 0);
    state.money += total;
    state.shipping = {};
    if (total > 0) {
      gameEvents.emit('moneyChanged', { delta: total });
      state.stats['earned'] = (state.stats['earned'] ?? 0) + total;
    }
    ctx.summary.shipped = shipped;
    ctx.summary.total = total;
  },
});

registerDayHook({
  id: 'core:calendar',
  phase: 'calendar',
  run(state, ctx) {
    const seasonChanged = advanceCalendar(state);
    ctx.scratch['seasonChanged'] = seasonChanged;
    ctx.summary.withered = seasonChanged ? killOutOfSeason(state) : 0;
  },
});

registerDayHook({
  id: 'core:morning',
  phase: 'morning',
  order: -100, // first: later hooks (forage, jars...) want today's weather and weeds settled
  run(state, ctx) {
    spawnWeeds(
      state,
      ctx.weedCandidates.filter(([x, y]) => ownsTile(state, x, y)),
    );
    ctx.scratch['prevWeather'] = state.weather;
    // Today's weather was announced last night; tomorrow's is rolled now.
    state.weather = state.forecast;
    state.forecast = rollWeather(state);
    if (isWet(state.weather)) waterAllSoil(state);
    restoreEnergy(state, ctx.passedOut ? game.passOutEnergyFraction : 1);
    if (!ctx.passedOut) state.stats['daysSlept'] = (state.stats['daysSlept'] ?? 0) + 1;
    ctx.summary.weather = state.weather;
  },
});

registerDayHook({
  id: 'core:end',
  phase: 'end',
  run: (state) => checkGoals(state),
});
