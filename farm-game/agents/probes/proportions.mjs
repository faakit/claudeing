// Proportions round: shoot the scale scenarios at the iPhone 13 and SE sizes (and a door opening).
//   npm run build && node agents/probes/proportions.mjs        (SHOTS=<dir> to change where they go)
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const scenarios = (
  process.env.SCENARIOS ??
  'town-proportions,town-proportions-river,town-proportions-marls,town-store-door,mine-portal'
).split(',');
const { url, stop } = await serve(Number(process.env.PORT ?? 4891));
const browser = await launch();
try {
  for (const profile of ['i13', 'se'])
    for (const scenario of scenarios) {
      const farm = await openScenario(browser, url, scenario, { profile });
      await farm.idle();
      await farm.shot(`${scenario}-${profile}`);
      if (farm.errors.length) console.log(scenario, profile, 'console errors:', farm.errors);
      await farm.close();
    }
  // the farmhouse door opening as the farmer walks in (DoorFx frames over the taller baked door)
  for (const profile of ['i13', 'se']) {
    const farm = await openScenario(browser, url, 'farm-door-proportions', { profile });
    await farm.idle();
    await farm.page.keyboard.down('ArrowUp');
    await farm.strip(`farm-door-proportions-${profile}-open`, 8, 3);
    await farm.page.keyboard.up('ArrowUp');
    await farm.close();
  }
} finally {
  await browser.close();
  stop();
}
