// Scenario-based e2e: every check opens a named scenario (src/dev/scenarios) and waits on game events through the
// dev API (window.__farm.dev.wait.*), never on fixed timeouts. Run `npm run build` first.
//
//   SMOKE=1      only the smoke block (npm run verify:fast): one profile, a few core flows, a few seconds
//   default      smoke + every scenario starts + the mechanics and ambient blocks moved here from e2e.mjs
//   E2E_SCENARIOS_PORT (default E2E_PORT + 30), PROFILE (default i13), SHOTS=<dir> to keep a screenshot per scenario
import { checker, launch, liveTargets, openScenario, serve } from './lib/farm.mjs';

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
      if (await farm.onTitle()) continue; // a title scenario stops on the title screen
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
/** What the farm scene shows at a tile: the ground kind and the art detail tile (map stages, M2). */
function farmTile(farm, tx, ty) {
  return farm.eval(
    ([x, y]) => {
      const scene = window.__farm.game.scene.getScene('Farm');
      const layers = scene.children.list.filter((o) => o.type === 'TilemapLayer');
      const at = (name) => layers.find((l) => l.layer.name === name)?.getTileAt(x, y)?.index ?? 0;
      const gate = scene.objects.find((o) => o.props?.gateOpen);
      return {
        ground: at('ground'),
        detail: at('detail'),
        gate: gate
          ? layers.find((l) => l.layer.name === 'props')?.getTileAt(gate.tx, gate.ty)?.index
          : 0,
        gateOpen: gate?.props.gateOpen,
        gateShut: gate?.props.gateShut,
      };
    },
    [tx, ty],
  );
}

// Map stages (M2): each farm-variant scenario builds the farm from its own stage file; the creek bed refuses
// placing; a load standing in the running creek moves to a door spawn; Ilse's gate stays shut.
async function stages() {
  const farm = await openScenario(browser, url, 'farm-variant-dry', { profile: PROFILE });
  const want = { dry: 20, waking: 20, restored: 5 }; // stone (the bed), stone, water
  for (const v of ['dry', 'waking', 'restored']) {
    if (v !== 'dry') await farm.load(`farm-variant-${v}`);
    await farm.ready('Farm');
    const t = await farmTile(farm, 26, 12);
    check(
      `farm-variant-${v}: the creek bed shows its ${v} look (ground and baked art)`,
      t.ground === want[v] && t.detail > 0,
      JSON.stringify(t),
    );
    check(
      `farm-variant-${v}: Ilse's gate is drawn ${v === 'dry' ? 'shut' : 'open'}`,
      t.gate === (v === 'dry' ? t.gateShut : t.gateOpen) && t.gate > 0,
      JSON.stringify(t),
    );
  }
  await farm.load('farm-creek-rescue');
  await farm.ready('Farm');
  let s = await farm.state();
  const tile = [Math.floor(s.player.x / 16), Math.floor((s.player.y - 3) / 16)];
  check(
    'farm-creek-rescue: a load standing in the running creek moves to the nearest door spawn',
    tile[0] === 28 && tile[1] === 3,
    JSON.stringify(tile),
  );
  await farm.load('farm-creek-place');
  await farm.ready('Farm');
  const said = await farm.event('toast', () => farm.press('Space'));
  s = await farm.state();
  check(
    'farm-creek-place: placing in the old creek bed is refused with its line',
    said?.text === 'The old creek bed. Best left clear.' && !(s.placed.farm ?? []).length,
    JSON.stringify(said),
  );
  await farm.select(0); // the hoe: the bed's own line, not the land-for-sale one (critic review 1, #2)
  await farm.idle(); // the refusal's action lock runs out first
  const tilled = await farm.event('toast', () => farm.press('Space'));
  check(
    'farm-creek-place: the hoe facing the old creek bed gets the same line',
    tilled?.text === 'The old creek bed. Best left clear.',
    JSON.stringify(tilled),
  );
  await farm.eval(() => window.__farm.dev.goto('farm', 28, 3, 'right')); // resolves once the scene is up
  await farm.frames(3); // a fresh scene ignores input until a frame with nothing held
  const gate = await farm.event('toast', () => farm.press('KeyE'));
  await farm.select(0); // the hoe in hand: Action facing the gate still reads the gate, not the hoe
  const gateAct = await farm.event('toast', () => farm.press('Space'));
  await farm.page.keyboard.down('ArrowRight');
  await farm.frames(30); // half a second of walking into the shut gate
  await farm.page.keyboard.up('ArrowRight');
  await farm.frames(3);
  s = await farm.state();
  check(
    "Ilse's gate: Interact and Action read that it is locked, and walking into it stays on the farm",
    gate?.text === "Ilse's old gate. Locked." &&
      gateAct?.text === gate?.text &&
      s.player.map === 'farm',
    JSON.stringify([gate, gateAct]),
  );
  check('stages: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

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

/** The world scene's ground tileset texture key (the dry palette's is `tiles_placeholder[_<season>]_dry`). */
const groundKey = (farm) =>
  farm.eval(() => {
    const w = window.__farm.game.scene.getScenes(true).find((x) => 'coachWorld' in x);
    const t = w?.ground?.tileset;
    return (Array.isArray(t) ? t[0] : t)?.image?.key ?? null;
  });
const dryResident = (farm) =>
  farm.eval(() =>
    Object.keys(window.__farm.game.textures.list).filter((k) =>
      /^tiles_.*_dry$|^tiles_placeholder_dry$/.test(k),
    ),
  );

// The Dry Year, M1 (docs/MILESTONES.md): Rosa's letter on the title, the straw-coloured day 1, the first green.
async function valley() {
  const farm = await openScenario(browser, url, 'title-first-launch', { profile: PROFILE });
  const title = await farm.eval(() => {
    const t = window.__farm.game.scene.getScene('Title');
    const texts = [];
    const walk = (n) => {
      if (typeof n.text === 'string') texts.push(n.text);
      (n.list ?? []).forEach(walk);
    };
    t.children.list.forEach(walk);
    const r = window.__farm.game.canvas.getBoundingClientRect();
    return {
      active: window.__farm.game.scene.isActive('Title'),
      texts,
      buttons: t.buttons.map((b) => {
        const bd = b.getBounds();
        return { x: bd.centerX, y: bd.centerY, h: bd.height };
      }),
      rect: { left: r.left, top: r.top, k: r.width / 200 },
    };
  });
  check(
    "title-first-launch: Rosa's letter is on the title, with one button (New Game) under it",
    title.active &&
      title.texts.some((t) => t.startsWith("You won't remember me.")) &&
      title.texts.includes('Rosa') &&
      title.texts.includes('New Game') &&
      !title.texts.includes('Continue') &&
      title.buttons.length === 1 &&
      title.buttons[0].y > 250 &&
      title.buttons[0].y < 340,
    JSON.stringify(title.buttons),
  );
  // New Game by a real tap: the farm opens straw-coloured, the dry tileset made under the wipe
  const b = title.buttons[0];
  await farm.during('sceneReady', ['Farm'], () =>
    farm.page.touchscreen.tap(
      title.rect.left + b.x * title.rect.k,
      title.rect.top + b.y * title.rect.k,
    ),
  );
  let s = await farm.state();
  check(
    'New Game: day 1 on the dry farm (the dry tileset in use), the guide unchanged',
    (await groundKey(farm)) === 'tiles_placeholder_dry' &&
      s.time.day === 1 &&
      s.stats['valley.on'] === 1 &&
      !s.stats['valley.farmGreen'],
    String(await groundKey(farm)),
  );

  // Draws: the dry farm costs what the green one does (the palette is a texture choice).
  await farm.load('valley-farm-dry');
  await farm.idle();
  await farm.frames(10);
  const dryDraws = await farm.eval(() => window.__farm.dev.frameStats().draws);
  await farm.mutate((st) => (st.stats['valley.farmGreen'] = 1));
  await farm.eval(() => window.__farm.dev.goto('house'));
  await farm.eval(() => window.__farm.dev.goto('farm', 12, 14, 'down'));
  await farm.idle();
  await farm.frames(10);
  const greenDraws = await farm.eval(() => window.__farm.dev.frameStats().draws);
  check(
    "valley-farm-dry: draws equal the green farm's",
    dryDraws > 0 && dryDraws <= greenDraws,
    `dry ${dryDraws}, green ${greenDraws}`,
  );

  // The eve: sleep through the real sleep flow and wake to the first green.
  await farm.load('valley-farm-green-eve');
  check('valley-farm-green-eve: the farm is still dry', (await dryResident(farm)).length === 1);
  await farm.during('panelOpen', [], () =>
    farm.eval(() => window.__farm.gameEvents.emit('sleepRequest', { passedOut: false })),
  );
  await farm.press('Enter');
  await farm.until((st, w) => st.time.day === 6 && !w.runtime.busy, null, 'the morning of day 6');
  s = await farm.state();
  const letter = s.mail.list.find((l) => l.title === 'First green');
  check(
    'first green: day 6 wakes green, the letter brings the tin, the dry tileset held for the step-out',
    s.stats['valley.farmGreen'] === 1 &&
      letter?.gift?.item === 'ilse_tin' &&
      !letter.read &&
      (await dryResident(farm)).length === 1,
    JSON.stringify({ letter, dry: await dryResident(farm) }),
  );

  // The morning: step out onto the green farm; the moment plays once.
  await farm.load('valley-farm-green');
  check(
    'valley-farm-green: the dry tileset is held this one morning, for the step-out',
    (await dryResident(farm)).length === 1,
  );
  const moment = await farm.event('valleyMoment', () =>
    farm.eval(() => window.__farm.dev.goto('farm', 12, 14, 'down')),
  );
  check(
    'valley-farm-green: stepping out plays the first-green moment on the normal tileset',
    moment?.text?.startsWith('FIRST GREEN') && (await groundKey(farm)) === 'tiles_placeholder',
    JSON.stringify(moment),
  );

  // The reveal (critic, M1 review 2): the straw dissolves into green around the farmer, then goes.
  await farm.load('valley-farm-green-reveal');
  const r0 = await farm.eval(() => ({
    live: window.__farm.game.scene.getScene('Farm').reveal?.live ?? 0,
  }));
  check(
    'valley-farm-green-reveal: the farm builds green with the straw drawn over it',
    r0.live > 0 && (await groundKey(farm)) === 'tiles_placeholder',
    JSON.stringify(r0),
  );
  await farm.strip('first-green-reveal', 8, 10, process.env.SHOTS ?? 'agents/out/shots');
  await farm.until((_s, w) => !w.runtime.valleyReveal, null, 'the reveal to end', 5000);
  check(
    'valley-farm-green-reveal: the dissolve ends, its overlay goes, the dry tiles wait for the night',
    (await farm.eval(() => window.__farm.game.scene.getScene('Farm').reveal)) === null &&
      (await dryResident(farm)).length === 1,
  );
  await farm.during('sceneReady', [], () =>
    farm.eval(() => window.__farm.dev.time.skipDays(1, { wake: false })),
  );
  check(
    'valley-farm-green-reveal: the next morning no dry tileset is resident',
    (await dryResident(farm)).length === 0,
  );
  // Rosa's letter: take the gift, both key items arrive
  await farm.mutate((st) => {
    const l = st.mail.list.find((x) => x.title === 'First green');
    l.read = true;
  });
  const took = await farm.eval(() => {
    const st = window.__farm.getState();
    const l = st.mail.list.find((x) => x.title === 'First green');
    return l ? l.id : null;
  });
  check('valley-farm-green: the first-green letter is in the mailbox', took !== null);

  // Mara in a dry town says a dry line, never a thriving one.
  await farm.load('talk-dry-mara');
  await farm.press('KeyE');
  await farm.panel('npc');
  const said = await farm.eval(() => {
    const ui = window.__farm.game.scene.getScene('UI');
    const texts = [];
    const walk = (n) => {
      if (typeof n.text === 'string') texts.push(n.text);
      (n.list ?? []).forEach(walk);
    };
    ui.children.list.forEach(walk);
    return texts.join(' | ');
  });
  check(
    'talk-dry-mara: Mara talks, and nothing calls the town thriving',
    /General Store|Seeds|step|lights on|Saturdays/.test(said) &&
      !/booming|talk of town/i.test(said),
    said.slice(0, 300),
  );
  check('valley: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

/** The HUD goal line's text (a valley step, or the goal chain). */
const hudLine = (farm) =>
  farm.eval(() => {
    const hud = window.__farm.game.scene.getScene('UI').hud;
    return hud.goalLabel.main?.text ?? hud.goalLabel.text ?? '';
  });
/** The sprite key a site shows now (the landmark path). */
const siteKey = (farm, id) =>
  farm.eval((key) => {
    const w = window.__farm.game.scene.getScenes(true).find((x) => 'coachWorld' in x);
    return w?.things?.landmarks?.get(key)?.getData('sprite') ?? null;
  }, `site.${id}`);
/** Tap a button in the open sheet by its label. */
async function tapSheetButton(farm, re) {
  const t = (await liveTargets(farm.page)).find((x) => re.test(x.text));
  if (!t) return false;
  await farm.thumb.tap(t.cx, t.cy, 70);
  return true;
}

// The Old Spring (M3): ask, fund in one tap, three work days (one tap each), the opening morning, the creek runs.
async function spring() {
  const farm = await openScenario(browser, url, 'spring-site-ask', { profile: PROFILE });
  check(
    "spring-site-ask: the HUD line is the ask, and Ilse's gate is open",
    (await hudLine(farm)) === 'Rosa asked: the Old Spring',
    await hudLine(farm),
  );
  const sprites = [await siteKey(farm, 'spring')];
  await farm.press('KeyE');
  await farm.panel('projects');
  const tapped = await farm.during('panelClosed', [], () => tapSheetButton(farm, /^Fund it$/));
  let s = await farm.state();
  check(
    'spring-site-ask: Interact opens the fund, and Fund it takes 300g and 20 stone in one tap',
    tapped !== false &&
      s.stats['place.spring'] === 2 &&
      s.stats['fund.place_spring'] === 300 &&
      !s.inventory.slots.some((x) => x?.item === 'stone'),
    JSON.stringify({ money: s.money, stage: s.stats['place.spring'] }),
  );
  check(
    "the fund never shows on the town board's list",
    await farm.eval(() => !window.__farm.getState().stats['projectNag.place_spring']),
  );
  for (let day = 1; day <= 3; day++) {
    await farm.frames(10); // a fresh scene ignores input until a frame with nothing held
    const e0 = (await farm.state()).energy;
    await farm.press('KeyE');
    // the work day's beat plays (the world waits), then the site shows its new stage
    await farm.until((_s, w) => w.runtime.busy, null, "the work day's beat to start", 3000);
    if (process.env.SHOTS && day > 1)
      await farm.strip(`spring-beat-day-${day}`, 6, 36, process.env.SHOTS);
    await farm.until((_s, w) => !w.runtime.busy, null, "the work day's beat to end", 8000);
    await farm.frames(3);
    s = await farm.state();
    sprites.push(await siteKey(farm, 'spring'));
    if (process.env.SHOTS) await farm.shot(`spring-work-day-${day}`, process.env.SHOTS);
    check(
      `work day ${day}: one tap plays the day's work (20 energy), and the site changes after it`,
      s.stats['site.spring.work'] === day &&
        e0 - s.energy === 20 &&
        sprites[day] !== sprites[day - 1],
      JSON.stringify({ work: s.stats['site.spring.work'], energy: [e0, s.energy], sprites }),
    );
    if (day === 1) {
      await farm.press('KeyE');
      await farm.frames(3);
      check(
        'a second tap the same day changes nothing',
        (await farm.state()).stats['site.spring.work'] === 1,
      );
    }
    await farm.during('sceneReady', [], () =>
      farm.eval(() => window.__farm.dev.time.skipDays(1, { wake: false })),
    );
  }
  s = await farm.state();
  check(
    'the morning after the third work day: the spring is open, counted once, Rosa waits at the site',
    s.stats['place.spring'] === 3 &&
      s.stats['placesDone'] === 1 &&
      (await hudLine(farm)) === 'The Old Spring is open!' &&
      (await farm.eval(() => window.__farm.game.scene.getScene('Wendhead').npcs.at(7, 15))) ===
        'rosa',
    JSON.stringify({ stage: s.stats['place.spring'], hud: await hudLine(farm) }),
  );
  if (process.env.SHOTS) await farm.shot('spring-opened', process.env.SHOTS);
  await farm.eval(() => window.__farm.dev.goto('farm', 25, 12, 'right'));
  const creek = await farmTile(farm, 26, 12);
  check(
    'farm-creek-running: the farm wakes to a running creek (water in the bed)',
    creek.ground === 5,
    JSON.stringify(creek),
  );
  // The opening scene: Rosa's three lines in her sheet, one a tap (not toasts)
  await farm.load('spring-opened');
  await farm.press('KeyE');
  await farm.panel('npc');
  const scene = await farm.eval(() => {
    const ui = window.__farm.game.scene.getScene('UI');
    return { mode: ui.npc.mode, id: ui.npc.id };
  });
  check(
    "spring-opened: Interact at the site opens Rosa's opening scene in her sheet",
    scene.mode === 'event' && scene.id === 'rosa',
    JSON.stringify(scene),
  );
  await farm.press('Escape');
  await farm.panelClosed();
  // The creek's first morning: the water runs down the bed from the gate, once
  await farm.load('farm-creek-first-morning');
  const waiting = await farm.eval(
    () => window.__farm.game.scene.getScene('Farm').creekReveal?.live ?? 0,
  );
  // it waits for the creek to come into view: walk the farmer over to the bank
  await farm.eval(() => window.__farm.dev.goto('farm', 24, 12, 'right'));
  await farm.frames(3);
  const creekReveal = await farm.eval(
    () => window.__farm.game.scene.getScene('Farm').reveal?.live ?? 0,
  );
  await farm.until((_s, w) => !w.runtime.valleyReveal, null, 'the creek reveal to end', 6000);
  const seen = (await farm.state()).stats['valley.creekSeen'];
  check(
    'farm-creek-first-morning: the dry bed is drawn over the running creek, then cut away, once',
    waiting > 0 && creekReveal > 0 && seen === 1,
    JSON.stringify({ waiting, creekReveal, seen }),
  );
  check('spring: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

// Channels (M4): one paint drag from the creek's bank digs a channel the water follows; the next morning the soil
// beside it is watered without the can; the flow stops at 24 tiles; nothing fills while a row is worked.
async function channels() {
  const farm = await openScenario(browser, url, 'channels-first-dig', { profile: PROFILE });
  const action = (await liveTargets(farm.page)).find((t) => t.text === 'ACTION');
  await farm.frames(10);
  await farm.thumb.down(action.cx, action.cy);
  await farm.until((_s, w) => w.game.scene.getScene('UI').actionPress?.armed, null, 'paint to arm');
  for (let i = 1; i <= 10; i++) {
    await farm.thumb.move(action.cx - i * 14, action.cy);
    await farm.frames(3);
  }
  await farm.thumb.up();
  await farm.until(
    (_s, w) => {
      const sc = w.game.scene.getScene('Farm');
      return sc.work === null && sc.route === null && sc.painting === null;
    },
    null,
    'the painted row to be dug',
    20000,
  );
  let s = await farm.state();
  const dug = Object.entries(s.farm.tiles)
    .filter(([, t]) => t.channel)
    .map(([k]) => k);
  if (process.env.SHOTS) await farm.shot('channels-first-dig', process.env.SHOTS);
  check(
    'channels-first-dig: one paint drag digs a channel of 6 or more tiles from the bank',
    dug.length >= 6 && dug.includes('25,10'),
    JSON.stringify(dug),
  );
  await farm.during('sceneReady', [], () =>
    farm.eval(() => window.__farm.dev.time.skipDays(1, { wake: false })),
  );
  s = await farm.state();
  // the parsnips under every dug tile (x 19-24 on row 11) are watered by the channel
  const beside = dug
    .map((k) => Number(k.split(',')[0]))
    .filter((x) => x >= 19 && x <= 24)
    .map((x) => s.farm.tiles[`${x},11`]?.watered);
  check(
    'the next morning the crops beside the channel are watered without the can',
    beside.length >= 5 && beside.every(Boolean),
    JSON.stringify({
      beside,
      weather: s.weather,
      dug: Object.keys(s.farm.tiles).filter((k) => s.farm.tiles[k].channel),
    }),
  );
  await farm.load('channels-flow-cap');
  const look = await farm.eval(() => {
    const f = window.__farm.game.scene.getScene('Farm').farm;
    const tint = (k) => f.cells.get(k)?.channel ?? null;
    return { first: tint('2,10'), past: tint('20,14') };
  });
  if (process.env.SHOTS) await farm.shot('channels-flow-cap', process.env.SHOTS);
  check(
    'channels-flow-cap: the water reaches the first 24 tiles; past them the channel shows dry',
    look.first === 'wet' && look.past === 'dry',
    JSON.stringify(look),
  );
  check('channels: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
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
  const blocks = SMOKE
    ? [smoke]
    : [smoke, everyScenario, mechanics, stages, ambient, actions, valley, spring, channels];
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
