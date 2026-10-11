// Art round 5: the farmer's action animations in the game, as frame-exact strips (every 4 frames) at phone scale.
//   npm run build && node agents/probes/acts-round5.mjs [outDir]
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const out = process.argv[2] ?? 'agents/out/art-shots/round5/tools/ingame';
const { url, stop } = await serve(Number(process.env.PORT ?? 4893));
const browser = await launch();
const placeAt = (farm, tx, ty, facing) =>
  farm.mutate(
    (s, _f, a) => {
      s.player.x = a.tx * 16 + 8;
      s.player.y = a.ty * 16 + 11;
      s.player.facing = a.facing;
    },
    { tx, ty, facing },
  );
try {
  const farm = await openScenario(browser, url, 'ripe-plot', { profile: 'i13' });
  // harvest facing down: strip from the press
  await farm.act();
  await farm.strip('harvest_down', 6, 4, out);
  await farm.idle(30);
  // place, facing right, with the sprinkler in hand
  await farm.mutate((s) => (s.inventory.slots[7] = { item: 'sprinkler', qty: 1 }));
  await placeAt(farm, 9, 14, 'right');
  await farm.idle(60);
  await farm.select(7);
  await farm.act();
  await farm.strip('place_right', 6, 4, out);
  await farm.idle(30);
  // pet a hen at home
  await farm.mutate((s, f) => {
    s.placed.farm = [
      ...(s.placed.farm ?? []),
      { id: 900, type: 'coop', tx: 6, ty: 13, data: { house: { n: 1, fed: true, petted: false, joy: 0, ready: 0 } } },
    ];
    s.nextPlacedId = 901;
    f.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await placeAt(farm, 7, 13, 'left');
  await farm.idle(60);
  await farm.interact();
  await farm.strip('pet_left', 6, 4, out);
  await farm.idle(30);
  // the reel
  await placeAt(farm, 10, 13, 'down');
  await farm.idle(60);
  await farm.eval(() => window.__farm.gameEvents.emit('fishCaught', undefined));
  await farm.frames(2);
  await farm.strip('reel_down', 5, 4, out);
  console.log('console errors:', farm.errors.length ? farm.errors : 'none');
  await farm.close();
} finally {
  await browser.close();
  stop();
}
