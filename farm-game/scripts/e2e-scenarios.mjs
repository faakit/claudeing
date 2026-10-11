// Scenario-based e2e: every check opens a named scenario (src/dev/scenarios) and waits on game events through the
// dev API (window.__farm.dev.wait.*), never on fixed timeouts. Run `npm run build` first.
//
//   SMOKE=1      only the smoke block (npm run verify:fast): one profile, a few core flows, a few seconds
//   default      smoke + every scenario starts + the mechanics and ambient blocks moved here from e2e.mjs
//   E2E_SCENARIOS_PORT (default E2E_PORT + 30), PROFILE (default i13), SHOTS=<dir> to keep a screenshot per scenario
import { checker, launch, openScenario, serve } from './lib/farm.mjs';

const PORT = Number(process.env.E2E_SCENARIOS_PORT ?? Number(process.env.E2E_PORT ?? 4800) + 30);
const SMOKE = process.env.SMOKE === '1';
const PROFILE = process.env.PROFILE ?? 'i13';
const t0 = Date.now();
const result = checker();
const { check } = result;
const { url, stop } = await serve(PORT);
const browser = await launch();
const held = (s, id) => s.inventory.slots.some((x) => x?.item === id);

async function smoke() {
  const farm = await openScenario(browser, url, 'ripe-plot', { profile: PROFILE });
  check(
    'dev API: a ?scenario= URL opens straight into its world',
    (await farm.state()).player.map === 'farm',
  );
  // Harvest: Action resolves on its own result, no waiting.
  const a = await farm.act();
  let s = await farm.state();
  check(
    'ripe-plot: Action harvests a ripe parsnip',
    a.ok && a.used.plan === 'harvest' && held(s, 'parsnip'),
    JSON.stringify(a),
  );
  // The bin: Interact opens its sheet.
  await farm.load('bin-produce');
  await farm.press('KeyE');
  check('bin-produce: Interact opens the bin sheet', (await farm.panel('bin')) === 'bin');
  // The lab: the dev map with its showcase, and deterministic control.
  await farm.load('lab');
  s = await farm.state();
  check(
    'lab: the dev map starts with every crop stage, placeable and node',
    s.player.map === 'lab' &&
      s.placed.lab?.length >= 20 &&
      Object.keys(s.nodes.lab ?? {}).length === 4,
  );
  const det = await farm.eval(() => {
    const d = window.__farm.dev;
    const m0 = window.__farm.getState().time.minutes;
    d.clock.pause();
    const f0 = d.loop.step(120); // two seconds of frames, synchronously
    const f1 = d.loop.step(30);
    const m1 = window.__farm.getState().time.minutes;
    d.clock.resume();
    d.loop.step(120); // 2 s at 500 ms a game minute: the clock moves again
    const m2 = window.__farm.getState().time.minutes;
    d.loop.resume();
    return { stepped: f1 - f0, m0, m1, m2 };
  });
  check(
    'dev: loop.step runs exact frames; clock.pause freezes game minutes, resume restarts them',
    det.stepped === 30 && det.m1 === det.m0 && det.m2 > det.m1,
    JSON.stringify(det),
  );
  // A door: walk into the lab house door and land on the shore (a real scene transition).
  await farm.mutate((s) => {
    s.player.x = 21 * 16 + 8;
    s.player.y = 5 * 16 + 11;
    s.player.facing = 'up';
  });
  await farm.page.keyboard.down('ArrowUp');
  await farm.until(
    (s) => Math.floor(s.player.y / 16) === 27,
    null,
    'the door to drop the player on the shore',
  );
  await farm.page.keyboard.up('ArrowUp');
  check('lab: the house door transitions the scene', (await farm.ready('Lab')) === 'Lab');
  check('smoke: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

/** Every scenario starts in the browser, in one page, switching without reloads. */
async function everyScenario() {
  const farm = await openScenario(browser, url, 'day1-fresh', {
    profile: PROFILE,
    query: '&tutorial=0',
  });
  const names = (await farm.eval(() => window.__farm.dev.scenarios())).map((x) => x.name);
  const bad = [];
  for (const name of names) {
    try {
      await farm.load(name);
      const s = await farm.state();
      const def = await farm.eval((n) => window.__farm.dev.build(n), name);
      if (s.player.map !== def.player.map) bad.push(`${name}: on ${s.player.map}`);
      if (process.env.SHOTS) await farm.shot(`scenario-${name}`, process.env.SHOTS);
    } catch (e) {
      bad.push(`${name}: ${e.message}`);
    }
  }
  check(`all ${names.length} scenarios start in the game`, bad.length === 0, bad.join(' | '));
  check('scenarios: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

// Moved from e2e.mjs block 6b (mechanics), on the farm-mechanics scenario with await helpers instead of 22 fixed
// waits. Same checks, same expectations.
async function mechanics() {
  const farm = await openScenario(browser, url, 'farm-mechanics', { profile: PROFILE });
  const mp = farm.page;
  await farm.select(0);
  await farm.act();
  let m = await farm.state();
  check(
    'Action picks up the wild good in front, whatever is equipped',
    held(m, 'wild_leek') && !m.forage.farm?.['13,18'] && m.stats.foraged === 1,
    JSON.stringify(m.forage),
  );
  await farm.idle();
  await farm.act();
  m = await farm.state();
  check(
    'smart targeting: Action then reaches the good beside the faced tile',
    held(m, 'daffodil') && m.stats.foraged === 2,
    JSON.stringify(m.forage),
  );
  await farm.mutate((s) => (s.inventory.slots[5] = { item: 'sprinkler', qty: 1 }));
  await farm.idle();
  await farm.select(5);
  await farm.act();
  m = await farm.state();
  check(
    'a sprinkler can be placed on free ground',
    m.placed.farm?.length === 1 && m.placed.farm[0].type === 'sprinkler',
    JSON.stringify(m.placed),
  );
  await farm.idle();
  await farm.interact();
  m = await farm.state();
  check(
    'Interact picks the sprinkler back up',
    !m.placed.farm && held(m, 'sprinkler'),
    JSON.stringify(m.placed),
  );
  // villagers and animals
  const placeAt = (tx, ty, facing) =>
    farm.mutate(
      (s, _f, a) => {
        s.player.x = a.tx * 16 + 8;
        s.player.y = a.ty * 16 + 11;
        s.player.facing = a.facing;
      },
      { tx, ty, facing },
    );
  await placeAt(15, 12, 'right');
  await farm.press('KeyE');
  await farm.panel('npc');
  m = await farm.state();
  check(
    'Interact talks to a villager: panel opens and friendship grows',
    m.friends.rosa?.points === 10 && m.stats.talked === 1,
    JSON.stringify(m.friends),
  );
  await farm.press('Escape');
  await farm.panelClosed();
  // A real press-and-release on the on-screen Interact button must leave the sheet open
  // (the release lands on the dim backdrop; it used to count as "tap outside" and close it).
  await placeAt(15, 12, 'right');
  await farm.idle();
  await farm.tapButton('INTERACT', 150);
  await farm.panel('npc');
  await farm.frames(10);
  check(
    'tap on the Interact button opens the villager sheet and it stays open on release',
    (await farm.openSheet()) === 'npc',
  );
  await farm.press('Escape');
  await farm.panelClosed();
  await farm.mutate((s, f) => {
    s.inventory.slots[5] = { item: 'chicken', qty: 1 };
    s.inventory.slots[6] = { item: 'chicken_feed', qty: 3 };
    s.placed.farm = [{ id: 9, type: 'coop', tx: 10, ty: 10, data: {} }];
    s.nextPlacedId = 10;
    f.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await placeAt(11, 10, 'left');
  await farm.interact();
  m = await farm.state();
  check(
    'Interact at a coop moves the chicken in and feeds it',
    m.placed.farm[0].data.house?.n === 1 && m.placed.farm[0].data.house?.fed === true,
    JSON.stringify(m.placed.farm[0]),
  );
  // Moving a building: chore taps never lift a coop with hens; the second tap opens the Move sheet and
  // its real "Move it" button picks the coop up with its hen parked for the next coop (critique 5, F3).
  await farm.interact(); // a pat
  await farm.interact(); // "All fed. ... Tap again to move it."
  await farm.press('KeyE'); // the Move sheet
  await farm.panel('move');
  m = await farm.state();
  check(
    'a chore tap never lifts a coop with a hen: the Move sheet asks first',
    m.placed.farm.some((o) => o.type === 'coop'),
    JSON.stringify(m.placed.farm),
  );
  const box = farm.geo;
  await mp.mouse.click(box.left + 100 * box.k, box.top + (400 - 130 + 74 + 12) * box.k);
  m = await farm
    .until(
      (s) => !(s.placed.farm ?? []).some((o) => o.type === 'coop') && s,
      null,
      'the coop to be picked up',
    )
    .catch(() => farm.state());
  check(
    'a coop with a hen can be picked up to move it, keeping the hen',
    !(m.placed.farm ?? []).some((o) => o.type === 'coop') &&
      held(m, 'coop') &&
      m.stored.coop?.[0]?.house?.n === 1,
    JSON.stringify(m.stored),
  );
  await farm.panelClosed();
  // A feed silo: one Interact pours the bag's feed into it.
  await farm.mutate((s, f) => {
    s.inventory.slots[7] = { item: 'hay', qty: 20 };
    (s.placed.farm ??= []).push({ id: 11, type: 'silo', tx: 11, ty: 11, data: {} });
    s.nextPlacedId = 12;
    f.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await placeAt(11, 10, 'down');
  await farm.interact();
  m = await farm.state();
  check(
    'Interact at a feed silo stores the feed from the bag',
    m.placed.farm.find((o) => o.type === 'silo')?.data.stock?.hay === 20 && !held(m, 'hay'),
    JSON.stringify(m.placed.farm),
  );
  // A garden bench: Interact sits down for a little energy, once a day.
  await farm.mutate((s, f) => {
    s.energy = 40;
    s.placed.farm.push({ id: 12, type: 'garden_bench', tx: 12, ty: 10, data: {} });
    s.nextPlacedId = 13;
    f.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await placeAt(11, 10, 'right');
  await farm.interact();
  m = await farm.state();
  check('Interact at a garden bench gives a little energy', m.energy === 55, `energy ${m.energy}`);
  // A cooked dish in hand: Action eats it.
  await farm.mutate((s) => {
    s.energy = 30;
    s.inventory.slots[6] = { item: 'fish_stew', qty: 1 };
  });
  await farm.select(6);
  await farm.act();
  m = await farm.state();
  check(
    'Action with a dish in hand eats it for energy',
    m.energy === 80 && !held(m, 'fish_stew'),
    `energy ${m.energy}`,
  );
  // From the 4th dish of a day a dish gives half (owner default, round 3).
  await farm.mutate((s) => {
    s.energy = 30;
    s.stats['ate.today'] = 3; // the stew above set today's day; count three eaten
    s.inventory.slots[6] = { item: 'fish_stew', qty: 1 };
  });
  await farm.idle();
  await farm.act();
  m = await farm.state();
  check('the 4th dish of a day gives half its energy', m.energy === 55, `energy ${m.energy}`);
  // Swiping up on the Action button changes tool without reaching for the hotbar.
  await farm.idle();
  await farm.select(0);
  await mp.mouse.move(box.left + 166 * box.k, box.top + 324 * box.k);
  await mp.mouse.down();
  await mp.mouse.move(box.left + 166 * box.k, box.top + 300 * box.k, { steps: 6 });
  await mp.mouse.up();
  m = await farm
    .until((s) => s.inventory.selected === 1 && s, null, 'the next tool')
    .catch(() => farm.state());
  check(
    'swiping up on the Action button selects the next tool',
    m.inventory.selected === 1,
    `selected ${m.inventory.selected}`,
  );
  // The mine: a pickaxe breaks a node and the ore lands in the bag.
  await farm.mutate((s) => (s.nodes.mine = { '9,23': 'copper_node' }));
  await farm.eval(() => window.__farm.dev.goto('mine', 9, 24, 'up'));
  await farm.select(4); // pickaxe
  await farm.act();
  m = await farm.state();
  check(
    'the pickaxe breaks a node in the mine and yields ore',
    !m.nodes.mine?.['9,23'] && held(m, 'copper_ore') && m.stats.mined === 1,
    JSON.stringify(m.nodes),
  );
  await farm.eval(() => window.__farm.dev.goto('farm', 18, 31, 'right'));
  await farm.select(3); // fishing rod
  const energyBefore = (await farm.state()).energy;
  await farm.act();
  const fishing = await farm.panel('fishing').catch(() => null);
  m = await farm.state();
  check(
    'casting the rod at the pond opens the fishing game and costs energy',
    fishing === 'fishing' && m.energy < energyBefore,
    `open=${fishing} energy ${energyBefore}->${m.energy}`,
  );
  check('mechanics run: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

// Moved from e2e.mjs block 6b (ambient): instead of waiting 5 s for petals and 600 ms around the camera move, the
// engine is stepped frame by frame (deterministic, and faster than real time).
async function ambient() {
  const farm = await openScenario(browser, url, 'spring-meadow', { profile: PROFILE });
  const anchor = () =>
    farm.eval(() => {
      const w = window.__farm.game.scene.getScene('Farm');
      const cam = w.cameras.main;
      return { ...w.ambient.debugPositions(), scroll: [cam.scrollX, cam.scrollY] };
    });
  await farm.eval(() => window.__farm.dev.loop.step(300)); // 5 s of frames: a few petals drift in
  await farm.eval(() => {
    const w = window.__farm.game.scene.getScene('Farm');
    w.ambient.emitter.timeScale = 0; // freeze the motes so only the camera moves
    w.cameras.main.stopFollow();
    if (w.pcam) w.pcam.paused = true; // the pixel-locked follow (fx/PixelCamera.ts) lets go of the camera
    window.__farm.dev.loop.step(2);
  });
  const a0 = await anchor();
  await farm.eval(() => {
    const cam = window.__farm.game.scene.getScene('Farm').cameras.main;
    cam.scrollX -= 24;
    cam.scrollY += 64;
    window.__farm.dev.loop.step(24);
  });
  const a1 = await anchor();
  await farm.eval(() => window.__farm.dev.loop.resume());
  const moteShift = Math.max(
    0,
    ...a0.motes.map((m, i) => Math.hypot(m.x - a1.motes[i].x, m.y - a1.motes[i].y)),
  );
  const flyShift = Math.max(
    0,
    ...a0.flies.map((m, i) => Math.hypot(m.x - a1.flies[i].x, m.y - a1.flies[i].y)),
  );
  const camShift = Math.hypot(a1.scroll[0] - a0.scroll[0], a1.scroll[1] - a0.scroll[1]);
  check(
    'ambient: drifting petals keep their world position when the camera scrolls',
    a0.motes.length >= 2 && a1.motes.length === a0.motes.length && camShift > 40 && moteShift < 0.5,
    JSON.stringify({ motes: a0.motes.length, after: a1.motes.length, camShift, moteShift }),
  );
  check(
    'ambient: butterflies fly in the world, not with the camera',
    a0.flies.length === 2 && flyShift < 16,
    JSON.stringify({ flies: a0.flies.length, flyShift, camShift }),
  );
  check('ambient: no page errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

// Art round 5: the farmer's action animations (harvest, plant, eat, place, pet, reel) play on their events, never
// block input, and stay off in Calm mode. A recorder notes every action frame the pose shows.
async function actions() {
  const farm = await openScenario(browser, url, 'ripe-plot', { profile: PROFILE });
  await farm.eval(() => {
    const sc = window.__farm.game.scene.getScene('Farm');
    window.__acts = new Set();
    sc.events.on('postupdate', () => {
      const p = sc.pose;
      if (p && p.visible && p.texture.key.startsWith('player_act_'))
        window.__acts.add(p.texture.key);
    });
  });
  const seen = () =>
    farm.eval(() => {
      const out = [...window.__acts];
      window.__acts.clear();
      return out;
    });
  const placeAt = (tx, ty, facing) =>
    farm.mutate(
      (s, _f, a) => {
        s.player.x = a.tx * 16 + 8;
        s.player.y = a.ty * 16 + 11;
        s.player.facing = a.facing;
      },
      { tx, ty, facing },
    );
  // harvest, and the stick walks at once (moving cuts the pose short)
  const a = await farm.act();
  const y0 = (await farm.state()).player.y;
  await farm.page.keyboard.down('ArrowUp');
  const moved = await farm
    .until(
      (st, _w, y) => st.player.y < y - 2 && st.player.y,
      y0,
      'the farmer to walk after a harvest',
    )
    .catch(() => null);
  await farm.page.keyboard.up('ArrowUp');
  await farm.idle();
  let got = await seen();
  check(
    'actions: a harvest plays the harvest frames',
    a.ok && a.used.plan === 'harvest' && got.some((k) => k.startsWith('player_act_harvest_')),
    JSON.stringify({ a: a.used, got }),
  );
  check('actions: input is not blocked: the farmer walks right after a harvest', moved !== null);
  // plant on tilled soil away from the ripe rows (smart targeting would harvest them first)
  await farm.mutate((s) => {
    for (const t of Object.values(s.farm.tiles)) delete t.crop; // bare tilled soil, nothing ripe nearby
    s.inventory.slots[5] = { item: 'parsnip_seed', qty: 5 };
  });
  await placeAt(10, 15, 'down');
  await farm.select(5);
  const pl = await farm.act();
  await farm.idle(20);
  got = await seen();
  check(
    'actions: planting plays the plant frames',
    pl.ok && pl.used.plan === 'plant' && got.some((k) => k.startsWith('player_act_plant_')),
    JSON.stringify({ pl: pl.used, got }),
  );
  // eat
  await farm.mutate((s) => {
    s.energy = 10;
    s.inventory.slots[6] = { item: 'baked_potato', qty: 2 };
  });
  await farm.select(6);
  const e = await farm.act();
  await farm.idle(20);
  got = await seen();
  check(
    'actions: eating plays the eat frames',
    e.ok && e.used.plan === 'eat' && got.some((k) => k.startsWith('player_act_eat_')),
    JSON.stringify({ e: e.used, got }),
  );
  // place (facing up, onto the grass above)
  await placeAt(10, 15, 'up');
  await farm.mutate((s) => (s.inventory.slots[7] = { item: 'sprinkler', qty: 1 }));
  await farm.select(7);
  const pc = await farm.act();
  await farm.idle(20);
  got = await seen();
  check(
    'actions: placing plays the place frames',
    pc.ok && pc.used.plan === 'place' && got.some((k) => k.startsWith('player_act_place_')),
    JSON.stringify({ pc: pc.used, got }),
  );
  // pet: a coop with a hen at home, faced from the right
  await farm.mutate((s, f) => {
    s.placed.farm = [
      ...(s.placed.farm ?? []),
      {
        id: 900,
        type: 'coop',
        tx: 6,
        ty: 13,
        data: { house: { n: 1, fed: true, petted: false, joy: 0, ready: 0 } },
      },
    ];
    s.nextPlacedId = 901;
    f.gameEvents.emit('placedChanged', { map: 'farm' });
  });
  await placeAt(7, 13, 'left');
  await farm.idle();
  await farm.interact();
  await farm.idle(20);
  got = await seen();
  const coop = (await farm.state()).placed.farm.find((o) => o.id === 900);
  check(
    'actions: the daily pat plays the pet frames',
    coop?.data.house?.petted === true && got.some((k) => k.startsWith('player_act_pet_')),
    JSON.stringify({ house: coop?.data.house, got }),
  );
  // reel: a landed fish plays it once the world runs again
  await farm.eval(() => window.__farm.gameEvents.emit('fishCaught', undefined));
  await farm.frames(60); // the whole reel (3 frames, under 400 ms)
  got = await seen();
  check(
    'actions: a landed fish plays the reel frames',
    got.some((k) => k.startsWith('player_act_reel_')),
    JSON.stringify(got),
  );
  // Calm mode: no action frames, the action itself still happens
  await farm.mutate((s) => (s.settings.reduceMotion = true));
  await placeAt(10, 15, 'down');
  await farm.select(2);
  await farm.frames(5);
  await seen();
  const c = await farm.act();
  await farm.idle(20);
  got = await seen();
  check(
    'actions: Calm mode plays no action frames',
    c.ok && got.length === 0,
    JSON.stringify({ c: c.used, got }),
  );
  check('actions: no page errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

try {
  const blocks = SMOKE ? [smoke] : [smoke, everyScenario, mechanics, ambient, actions];
  // Blocks are independent pages: run them side by side (each has its own browser context).
  await Promise.all(
    blocks.map((b) =>
      b().catch((e) => check(`${b.name}: block finished`, false, String(e?.stack ?? e))),
    ),
  );
} finally {
  await browser.close();
  stop();
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  result.failed === 0
    ? `\nSCENARIO E2E OK (${SMOKE ? 'smoke' : 'full'}, ${secs} s)`
    : `\nSCENARIO E2E FAILED (${result.failed})`,
);
process.exit(result.failed === 0 ? 0 : 1);
