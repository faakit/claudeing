// Scenario-based e2e: every check opens a named scenario (src/dev/scenarios) and waits on game events through the
// dev API (window.__farm.dev.wait.*), never on fixed timeouts. Run `npm run build` first.
//
//   SMOKE=1      only the smoke block (npm run verify:fast): one profile, a few core flows, a few seconds
//   default      smoke + every scenario starts + the mechanics and ambient blocks moved here from e2e.mjs
//   E2E_SCENARIOS_PORT (default E2E_PORT + 30), PROFILE (default i13), SHOTS=<dir> to keep a screenshot per scenario,
//   BLOCKS=towing,towingLane to run only the named blocks
import { checker, launch, liveTargets, openScenario, serve } from './lib/farm.mjs';
import { playTow, towBar } from './lib/tow.mjs';

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

// One act per short Action press, even on a slow frame (coordinator ruling after the dry-year-2 review). On a loaded
// machine a 60 ms press of Space can be seen held for longer than the 200 ms Action lock (slow frames, a key release
// delivered late), and it used to act again: one press foraged both goods within reach. Here Space goes down, the
// first act lands, six frames stall for 150 ms each, and the key lifts only after 30 more frames, with no system
// auto-repeat (the sign of a key really held). Exactly one good is foraged.
async function actionSlowFrame() {
  const farm = await openScenario(browser, url, 'farm-mechanics', { profile: PROFILE });
  await farm.select(0);
  const acted = farm.eval(() => {
    const w = window.__farm;
    return w.dev.wait.actionDone().then(
      () =>
        new Promise((done) => {
          let n = 0;
          const stall = () => {
            const t = performance.now();
            while (performance.now() - t < 150) {
              /* a slow frame */
            }
            if (++n < 6) w.game.events.once('prestep', stall);
            else done();
          };
          w.game.events.once('prestep', stall);
        }),
    );
  });
  await farm.page.keyboard.down('Space');
  await acted;
  await farm.frames(30);
  await farm.page.keyboard.up('Space');
  await farm.idle(10);
  const m = await farm.state();
  check(
    'one short Action press acts once, even when slow frames hold it past the Action lock',
    m.stats.foraged === 1,
    JSON.stringify({ foraged: m.stats.foraged, forage: m.forage.farm }),
  );
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
  // every drawn frame after the press: how far the drawn farmer is off his spot (the refusal's shake), and the
  // target marker's lowest alpha (the press's flash dips it from 0.35; its own throb never goes under 0.51)
  await farm.eval(() => {
    const sc = window.__farm.game.scene.getScene('Farm');
    const rec = (window.__pressRec = { shake: 0, alpha: 1 });
    rec.off = () => sc.events.off('postupdate', rec.fn);
    rec.fn = () => {
      rec.shake = Math.max(rec.shake, Math.abs(sc.sprite.x - window.__farm.getState().player.x));
      rec.alpha = Math.min(rec.alpha, sc.highlight.gfx.alpha);
    };
    sc.events.on('postupdate', rec.fn);
  });
  const said = await farm.event('toast', () => farm.press('Space'));
  await farm.frames(20);
  const rec = await farm.eval(() => {
    const r = window.__pressRec;
    r.off();
    return { shake: r.shake, alpha: r.alpha };
  });
  s = await farm.state();
  check(
    'farm-creek-place: placing in the old creek bed is refused with its line',
    said?.text === 'The old creek bed. Best left clear.' && !(s.placed.farm ?? []).length,
    JSON.stringify(said),
  );
  // (syncSprite put the farmer back on his spot every frame, and the marker's throb overwrote the flash)
  check('farm-creek-place: the refusal shakes the farmer', rec.shake >= 1, JSON.stringify(rec));
  check(
    'farm-creek-place: the press flashes the target marker',
    rec.alpha < 0.45,
    JSON.stringify(rec),
  );
  await farm.select(0); // the hoe: the bed's own line, not the land-for-sale one (critic review 1, #2)
  await farm.idle(); // the refusal's action lock runs out first
  const tilled = await farm.event('toast', () => farm.press('Space'));
  check(
    'farm-creek-place: the hoe facing the old creek bed gets the same line',
    tilled?.text === 'The old creek bed. Best left clear.',
    JSON.stringify(tilled),
  );
  // Placing on the bank, then again after the farm scene is rebuilt: the item-in-hand image of the first place
  // was kept across the restart, and setTexture on it threw and stopped the game loop.
  const placeDown = async () => {
    await farm.idle(); // a refusal's action lock runs out first
    await farm.mutate((st) => {
      st.player.facing = 'down';
      st.inventory.selected = st.inventory.slots.findIndex((x) => x?.item === 'sprinkler');
    });
    await farm.frames(3);
    return farm.act();
  };
  const placed1 = await placeDown();
  await farm.frames(40); // the place pose plays out
  await farm.load('farm-creek-place');
  const placed2 = await placeDown();
  const clock0 = await farm.eval(() => window.__farm.getState().time.minutes);
  await farm.until((st, _w, m) => st.time.minutes > m, clock0, 'the clock to tick after a place');
  check(
    'farm-creek-place: placing again after the farm scene restarts keeps the game running',
    placed1.ok && placed2.ok && farm.errors.length === 0,
    JSON.stringify([placed1.used, placed2.used, farm.errors]),
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
    'valley-farm-green-reveal: the next morning the farm is done with straw (Wendhead and the town keep it, until the spring and the weir)',
    // the dry tileset stays resident for Wendhead and the town, so its count alone could not fail: the farm itself
    // must be built on the normal tileset
    (await dryResident(farm)).length === 1 &&
      (await farm.state()).player.map === 'farm' &&
      !String(await groundKey(farm)).endsWith('_dry') &&
      (await farm.eval(() => window.__farm.getState().stats['valley.greenSeen'] === 1)),
    JSON.stringify({
      map: (await farm.state()).player.map,
      ground: await groundKey(farm),
      dry: await dryResident(farm),
    }),
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

/** A tile of a running world scene's ground layer, and whether its collision grid blocks it. */
const sceneTile = (farm, key, tx, ty) =>
  farm.eval(
    ([k, x, y]) => {
      const scene = window.__farm.game.scene.getScene(k);
      const layers = scene.children.list.filter((o) => o.type === 'TilemapLayer');
      const at = (name) => layers.find((l) => l.layer.name === name)?.getTileAt(x, y)?.index ?? 0;
      return { ground: at('ground') };
    },
    [key, tx, ty],
  );
/** Every text the UI scene shows now, joined (sheet lines, buttons). */
const uiText = (farm) =>
  farm.eval(() => {
    const texts = [];
    const walk = (n) => {
      if (typeof n.text === 'string' && n.visible !== false) texts.push(n.text);
      (n.list ?? []).forEach(walk);
    };
    window.__farm.game.scene.getScene('UI').children.list.forEach(walk);
    return texts.join(' | ');
  });
/** Draws per frame after the view settles. */
async function settledDraws(farm) {
  await farm.idle();
  await farm.frames(10);
  return farm.eval(() => window.__farm.dev.frameStats().draws);
}
/** Step through the farm's south gate into town: ms from the step to a clear view (the feel suite's measure). */
const gateToTown = (farm) =>
  farm.eval(
    () =>
      new Promise((resolve) => {
        const f = window.__farm;
        const ui = f.game.scene.getScene('UI');
        const t0 = performance.now();
        const s = f.getState();
        s.player.x = 14 * 16 + 8;
        s.player.y = 43 * 16 + 11; // onto the south gate
        const fn = () => {
          const town = f.game.scene.getScene('Town');
          if (town.sys.isActive() && !ui.wipe.busy) {
            f.game.events.off('postrender', fn);
            resolve(performance.now() - t0);
          }
        };
        f.game.events.on('postrender', fn);
        setTimeout(() => resolve(-1), 4000);
      }),
  );

// The Weir (M6): Orin's gate, the fund, four work days (the last the scripted beam), the river's first morning in
// town, Finn at the dock, the Derby's venue, an old save's river, draws and the farm-to-town door on a dry town.
async function weir() {
  // Orin sells the sluice gate while the asked weir's fund needs it
  const farm = await openScenario(browser, url, 'weir-gate', { profile: PROFILE });
  await farm.press('KeyE');
  await farm.panel('npc');
  const offer = await uiText(farm);
  const bought = await tapSheetButton(farm, /^Sluice Gate 500g$/);
  await farm.frames(3);
  let s = await farm.state();
  check(
    "weir-gate: Orin's sheet says the weir wants a gate and sells it for 500g in one tap",
    /sluice gate/.test(offer) &&
      bought &&
      s.money === 100 &&
      s.inventory.slots.some((x) => x?.item === 'sluice_gate'),
    JSON.stringify({ offer: offer.slice(0, 160), money: s.money }),
  );
  check(
    'weir-gate: with the gate in the bag the offer is gone',
    !/Sluice Gate 500g/.test(await uiText(farm)),
  );
  await farm.press('Escape');
  await farm.panelClosed();

  // The ask morning at the broken weir: fund it in one tap
  await farm.load('weir-broken');
  check(
    'weir-broken: the HUD line is the ask; the gorge is a dry stony bed',
    (await hudLine(farm)) === 'Finn asked: the Weir' &&
      (await sceneTile(farm, 'Wendhead', 20, 12)).ground === 20,
    await hudLine(farm),
  );
  const sprites = [await siteKey(farm, 'weir')];
  await farm.press('KeyE');
  await farm.panel('projects');
  await farm.during('panelClosed', [], () => tapSheetButton(farm, /^Fund it$/));
  s = await farm.state();
  check(
    'weir-broken: Fund it takes 2,500g, 60 stone and the gate in one tap',
    s.stats['place.weir'] === 2 &&
      s.money === 100 &&
      !s.inventory.slots.some((x) => x?.item === 'sluice_gate' || x?.item === 'stone'),
    JSON.stringify({ stage: s.stats['place.weir'], money: s.money }),
  );
  for (let day = 1; day <= 4; day++) {
    await farm.frames(10);
    await farm.press('KeyE');
    await farm.until((_s, w) => w.runtime.busy, null, "the work day's beat to start", 3000);
    if (process.env.SHOTS && day === 4) await farm.strip('weir-beam', 8, 14, process.env.SHOTS);
    await farm.until((_s, w) => !w.runtime.busy, null, "the work day's beat to end", 8000);
    await farm.frames(3);
    s = await farm.state();
    sprites.push(await siteKey(farm, 'weir'));
    check(
      `weir work day ${day}: one tap plays the day, and the site changes after it`,
      s.stats['site.weir.work'] === day && sprites[day] !== sprites[day - 1],
      JSON.stringify({ work: s.stats['site.weir.work'], sprites }),
    );
    await farm.during('sceneReady', [], () =>
      farm.eval(() => window.__farm.dev.time.skipDays(1, { wake: false })),
    );
  }
  s = await farm.state();
  check(
    'the morning after the fourth work day: the weir is open, the gorge runs',
    s.stats['place.weir'] === 3 &&
      (await hudLine(farm)) === 'The Weir is open!' &&
      (await sceneTile(farm, 'Wendhead', 20, 12)).ground === 5,
    JSON.stringify({ stage: s.stats['place.weir'], hud: await hudLine(farm) }),
  );
  // the river's first morning: into town, the dry town dissolves around the farmer, once
  const dryBefore = (await dryResident(farm)).length;
  const moment = await farm.event('valleyMoment', () =>
    farm.eval(() => window.__farm.dev.goto('town', 11, 2, 'down')),
  );
  const live = await farm.eval(() => window.__farm.game.scene.getScene('Town').reveal?.live ?? 0);
  check(
    'river-first-morning: the dry town is drawn over the river town and cut away, under THE RIVER IS BACK',
    moment?.text?.startsWith('THE RIVER IS BACK') && live > 0 && dryBefore === 1,
    JSON.stringify({ moment, live, dryBefore }),
  );
  await farm.until((_s, w) => !w.runtime.valleyReveal, null, 'the river reveal to end', 6000);
  await farm.eval(() => window.__farm.dev.goto('town', 15, 30, 'right'));
  await farm.idle();
  check(
    'weir-opened-town: a full river (water where the mud was), Finn at the dock on the opening morning',
    (await sceneTile(farm, 'Town', 18, 25)).ground === 5 &&
      (await farm.eval(() => window.__farm.game.scene.getScene('Town').npcs.at(16, 32))) ===
        'finn' &&
      (await farm.state()).stats['valley.riverSeen'] === 1,
    JSON.stringify(await sceneTile(farm, 'Town', 18, 25)),
  );
  await farm.eval(() => window.__farm.dev.goto('house'));
  await farm.eval(() => window.__farm.dev.goto('town', 11, 2, 'down'));
  await farm.idle();
  check(
    'river-first-morning: the moment plays once',
    (await farm.eval(() => window.__farm.game.scene.getScene('Town').reveal ?? null)) === null,
  );

  // The opening scene: Finn's three lines in his sheet
  await farm.load('weir-opened-town');
  await farm.press('KeyE');
  await farm.panel('npc');
  const sc = await farm.eval(() => {
    const ui = window.__farm.game.scene.getScene('UI');
    return { mode: ui.npc.mode, id: ui.npc.id };
  });
  check(
    'weir-opened-town: talking to Finn at the dock opens his opening scene',
    sc.mode === 'event' && sc.id === 'finn',
    JSON.stringify(sc),
  );
  await farm.press('Escape');
  await farm.panelClosed();
  if (process.env.SHOTS) await farm.shot('weir-opened-town', process.env.SHOTS);

  // Draws: every town stage costs what today's town does (same layers, the palette a texture choice). Dry first:
  // the dry tileset is made at the load, never by a world scene.
  await farm.load('weir-gate');
  await farm.eval(() => window.__farm.dev.goto('town', 15, 32, 'right'));
  const dryDraws = await settledDraws(farm);
  check(
    'town@dry: the dry stage on the dry tileset (mud where the river was)',
    (await sceneTile(farm, 'Town', 18, 25)).ground === 20 &&
      String(await groundKey(farm)).endsWith('_dry'),
    String(await groundKey(farm)),
  );
  await farm.mutate((st) => {
    st.stats['place.weir'] = 3;
    st.stats['valley.riverSeen'] = 1;
  });
  await farm.eval(() => window.__farm.dev.goto('house'));
  await farm.eval(() => window.__farm.dev.goto('town', 15, 32, 'right'));
  const riverDraws = await settledDraws(farm);
  check(
    "town@dry: draws equal the river town's",
    dryDraws > 0 && dryDraws <= riverDraws,
    `dry ${dryDraws}, river ${riverDraws}`,
  );

  // The Derby follows the water
  for (const [name, where] of [
    ['derby-lake', 'woods lake'],
    ['derby-river', 'town river'],
  ]) {
    await farm.load(name);
    await farm.during('panelOpen', [], () =>
      farm.eval(() => window.__farm.gameEvents.emit('openPanel', { type: 'festival' })),
    );
    const text = await uiText(farm);
    check(
      `${name}: the Derby's catfish are stocked in the ${where}`,
      text.includes(`Catfish stocked in the ${where} today!`),
      text.slice(0, 240),
    );
    await farm.press('Escape');
    await farm.panelClosed();
  }

  // A save from before the Weir keeps its river, with no moment
  await farm.load('old-save-weir-default');
  s = await farm.state();
  check(
    'old-save-weir-default: the town shows its river, quietly (no moment, nothing counted)',
    s.stats['place.weir'] === 3 &&
      s.stats['valley.riverSeen'] === 1 &&
      s.stats['projectsDone'] === 1 &&
      (await sceneTile(farm, 'Town', 18, 25)).ground === 5 &&
      (await farm.eval(() => window.__farm.game.scene.getScene('Town').reveal ?? null)) === null,
    JSON.stringify({ weir: s.stats['place.weir'] }),
  );

  // The farm-to-town door with the farm green and the town dry: the dry tileset already resident, under the bar
  await farm.load('farm-creek-running');
  await farm.idle();
  const resident = (await dryResident(farm)).length;
  const dryMs = await gateToTown(farm);
  const afterDry = (await dryResident(farm)).length;
  const dryFile = String(await groundKey(farm));
  await farm.mutate((st) => (st.stats['place.weir'] = 3));
  await farm.eval(() => window.__farm.dev.goto('farm', 14, 41, 'down'));
  await farm.idle();
  const riverMs = await gateToTown(farm);
  check(
    'door farm -> dry town: the dry tileset resident before the door, the door as quick as to the river town',
    resident === 1 &&
      afterDry === 1 &&
      dryFile.endsWith('_dry') &&
      dryMs > 0 &&
      dryMs < 450 &&
      dryMs <= riverMs + 60,
    `dry ${dryMs.toFixed(0)} ms (${dryFile}), river ${riverMs.toFixed(0)} ms`,
  );
  console.log(`  door farm -> town: dry ${dryMs.toFixed(0)} ms, river ${riverMs.toFixed(0)} ms`);
  check('weir: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
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
    const sceneNow = (_s, w) =>
      w.game.scene.getScenes(true).find((x) => x.scene.key !== 'UI')?.time.now ?? 0;
    const b0 = await farm.until(
      (s2, w, f) => w.runtime.busy && new Function(`return (${f})`)()(s2, w),
      sceneNow.toString(),
      "the work day's beat to start",
      3000,
    );
    if (process.env.SHOTS && day > 1)
      await farm.strip(`spring-beat-day-${day}`, 6, 36, process.env.SHOTS);
    const b1 = await farm.until(
      (s2, w, f) => !w.runtime.busy && new Function(`return (${f})`)()(s2, w),
      sceneNow.toString(),
      "the work day's beat to end",
      8000,
    );
    // the beats are tight (feel critic, review 6): the pickaxe days about 2.6 s, the spade day about 1.8 s
    check(
      `work day ${day}: the beat lasts ${Math.round(b1 - b0)} ms of game time`,
      b1 - b0 <= (day === 3 ? 1900 : 2700),
      `${Math.round(b1 - b0)} ms`,
    );
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
      (await farm.eval(() => window.__farm.game.scene.getScene('Wendhead').npcs.at(8, 15))) ===
        'rosa', // two tiles east: the site's sprite covers 6-7
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
  // the morning's run holds the water back until it passes (fx/ChannelFx.ts)
  await farm.until(
    (_s, w) => !w.game.scene.getScene('Farm').channels.running,
    null,
    'the morning run to finish',
    8000,
  );
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
  // Channel art (art lane): the serpentine's cells show the autotiled ditch for their neighbours, wet where the
  // flow reaches and dry past it; a culvert's headwalls stand on the path; the flowers on a channel are gone.
  await farm.load('channels-serpentine');
  // the morning's run (feel lane) shows the reached channels dug dry until the water passes them
  await farm.until(
    (_s, w) => !w.game.scene.getScene('Farm').channels.running,
    null,
    'the serpentine morning run to finish',
    8000,
  );
  const art = await farm.eval(() => {
    const scene = window.__farm.game.scene.getScene('Farm');
    const idx = scene.cache.json.get('tiles_index').tiles;
    const layer = (n) =>
      scene.children.list.find((o) => o.type === 'TilemapLayer' && o.layer.name === n);
    const at = (n, x, y) => layer(n)?.getTileAt(x, y)?.index ?? 0;
    return {
      corner: at('detail', 17, 16) === idx['chan:wet:6'] + 1, // E and S: the turn down at x 17
      tee: at('detail', 20, 16) === idx['chan:wet:14'] + 1, // E, S, W: the T at x 20
      dry: at('detail', 10, 22) === idx['chan:dry:15'] + 1, // the cross, past the flow
      culvert: at('shade', 14, 19) === idx['culvert:8'] + 1, // the west wall of the path crossing
      mouth: at('shade', 26, 16) === idx['chanmouth:w'] + 1, // the cut through the creek's bank
    };
  });
  if (process.env.SHOTS) await farm.shot('channels-serpentine', process.env.SHOTS);
  check(
    'channels-serpentine: corners, a T, a dry cross, a culvert and the creek mouth draw their tiles',
    Object.values(art).every(Boolean),
    JSON.stringify(art),
  );
  // A home-plot-only farm (owner ruling): from the creek's open bank along y 14 (a culvert under the road), then
  // down x 13 beside the home plot; the next morning its east column is watered without the can.
  await farm.load('channels-home-only');
  const act2 = (await liveTargets(farm.page)).find((t) => t.text === 'ACTION');
  await farm.frames(10);
  await farm.thumb.down(act2.cx, act2.cy);
  await farm.until((_s, w) => w.game.scene.getScene('UI').actionPress?.armed, null, 'paint to arm');
  for (let i = 1; i <= 10; i++) {
    await farm.thumb.move(act2.cx - i * 14, act2.cy);
    await farm.frames(3);
  }
  const said = farm.event('toast');
  await farm.thumb.up();
  await farm.until(
    (_s, w) => {
      const sc = w.game.scene.getScene('Farm');
      return sc.work === null && sc.route === null && sc.painting === null;
    },
    null,
    'the first row to be dug',
    20000,
  );
  const rowToast = await said;
  // the rest of the run by single Actions, the farmer stepping along it
  const along = [];
  for (let x = 24; x >= 13; x--) along.push([x, 14, x + 1, 14, 'left']);
  for (let y = 15; y <= 23; y++) along.push([13, y, 13, y - 1, 'down']);
  for (const [tx, ty, px, py, face] of along) {
    if ((await farm.state()).farm.tiles[`${tx},${ty}`]?.channel) continue;
    await farm.eval((a) => window.__farm.dev.goto('farm', a[0], a[1], a[2]), [px, py, face]);
    await farm.frames(3);
    await farm.act();
  }
  s = await farm.state();
  const run = Object.keys(s.farm.tiles).filter((k) => s.farm.tiles[k].channel);
  check(
    'channels-home-only: on unplotted ground, a channel runs from the bank under the road to the home plot',
    run.includes('25,14') && run.includes('14,14') && run.includes('13,23') && run.length >= 21,
    JSON.stringify({ n: run.length, rowToast }),
  );
  check(
    'a dug row says what it dug (not that tiles had nothing left to do)',
    /^Channel dug: \d+ tiles?\.$/.test(rowToast?.text ?? ''),
    JSON.stringify(rowToast),
  );
  await farm.during('sceneReady', [], () =>
    farm.eval(() => window.__farm.dev.time.skipDays(1, { wake: false })),
  );
  s = await farm.state();
  const home = [16, 17, 18, 19, 20, 21, 22, 23].map((y) => s.farm.tiles[`12,${y}`]?.watered);
  check(
    'the next morning the home plot beside the channel is watered from the creek',
    home.every(Boolean),
    JSON.stringify({ home, weather: s.weather }),
  );
  check('channels: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

// Art round 5: the farmer's action animations (harvest, plant, eat, place, pet, reel) play on their events, never
// block input, and stay off in Calm mode. A recorder notes every action frame the pose shows.
// The morning run and the house doors by real taps (feel critic C1-1): from the house, a tap on the front door goes
// out; the morning's run waits until its entry is on screen (never spent on a sliver at the view's edge), then
// starts with its first tiles in view. Back at the farmhouse, a tap on the door drawn above its warp tile goes in.
async function morning() {
  const farm = await openScenario(browser, url, 'channels-morning', { profile: PROFILE });
  await farm.frames(5);
  // a low thumb: the middle of the void tile just under the front door (5,8)
  await farm.during('sceneReady', ['Farm'], () => farm.tapTile(5, 9));
  check(
    'house: a tap just under the front door goes out',
    (await farm.state()).player.map === 'farm',
  );
  const fx = () =>
    farm.eval(() => {
      const c = window.__farm.game.scene.getScene('Farm').channels;
      return { started: c.started, running: c.running };
    });
  await farm.frames(40);
  const early = await fx();
  // back in and out again before the channels came into view: the run is still to play ("once, on first sight")
  await farm.during('sceneReady', ['House'], () => farm.tapTile(14, 6));
  await farm.frames(5);
  await farm.during('sceneReady', ['Farm'], () => farm.tapTile(5, 9));
  await farm.frames(5);
  const again = await fx();
  check(
    'channels-morning: leaving the farm before the channels came into view keeps the run for the next visit',
    again.started === null && again.running,
    JSON.stringify(again),
  );
  // walk east along the field until the channel's head is on screen
  await farm.tapTile(19, 8);
  const started = await farm.until(
    (_s, w) => w.game.scene.getScene('Farm').channels.started,
    null,
    'the morning run to start',
    15000,
  );
  const inside = ([tx, ty]) =>
    tx * 16 >= started.view.x &&
    (tx + 1) * 16 <= started.view.x + started.view.width &&
    ty * 16 >= started.view.y &&
    (ty + 1) * 16 <= started.view.y + started.view.height;
  // the critic's rule: its entry and next two tiles on screen, or half the run or more
  const inView = started.head.every(inside) || started.seen * 2 >= started.of;
  check(
    'channels-morning: the run waits off screen, then starts with its head (or half of it) in view',
    early.started === null && early.running && inView,
    JSON.stringify({ early, started }),
  );
  await farm.until(
    (_s, w) => !w.game.scene.getScene('Farm').channels.running,
    null,
    'run end',
    8000,
  );
  const s = await farm.state();
  check(
    'channels-morning: after the run the soil beside the channel shows watered',
    [19, 20, 21, 22, 23, 24].every((x) => s.farm.tiles[`${x},11`]?.watered),
  );
  await farm.idle();
  await farm.during('sceneReady', ['House'], () => farm.tapTile(14, 6));
  check(
    'farm: a tap on the farmhouse door drawn above its warp tile goes in',
    (await farm.state()).player.map === 'house',
  );
  check('morning: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();
}

// Towing (M7 "spike first", feel lane, round 2): played like a person (scripts/lib/tow.mjs: real taps with 1.5 mm
// gaussian scatter, 450 ms reactions), against the critic's bar: every run lands, under 20 s, at most 6 inputs, at most
// 7 draws while towing, no tap in the 'hard' thumb zone, none ignored, no stall that needs another tap, and the log
// never off the water. T1: the chained tap lands two tiles east of the slip while the hook walk scrolls the camera,
// and the log still lands with no further input.
const towCheck = (tag, r, extra = true, detail = '', bar = {}) => {
  const bad = towBar(r, bar);
  check(
    `${tag}: lands by itself, ${r.inputs} inputs, ${((r.ms ?? 0) / 1000).toFixed(1)} s, ${r.draws} draws`,
    bad.length === 0 && extra,
    `${bad.join('; ')} ${detail} ${r.zones}`,
  );
};

async function towing() {
  // T1: log, then the slip region mid-scroll (two tiles east of the slip), then the tug if it snags: at most 3
  // inputs and it lands with no further one (on a loaded machine the log can pass the rock without catching)
  for (const [hand, seed] of [
    ['right', 101],
    ['right', 202],
    ['left', 303],
    ['left', 404],
  ]) {
    const farm = await openScenario(browser, url, 'tow-spike', { profile: PROFILE, hand });
    const r = await playTow(farm, { strategy: 'chain', seed, chainTile: { tx: 15, ty: 28 } });
    towCheck(
      `tow-spike chained T1 tap (${hand}, seed ${seed})`,
      r,
      r.inputs <= 3,
      `inputs ${r.inputs}`,
    );
    check(
      `tow-spike chained (${hand}): no console errors`,
      farm.errors.length === 0,
      farm.errors.join(' | '),
    );
    await farm.close();
  }
  for (const [hand, strategy] of [
    ['right', 'wait'],
    ['left', 'action'],
  ]) {
    const farm = await openScenario(browser, url, 'tow-spike-long', { profile: PROFILE, hand });
    const r = await playTow(farm, { strategy, seed: 505 });
    towCheck(`tow-spike-long ${strategy} (${hand})`, r, r.tugs === 2, `tugs ${r.tugs}`);
    await farm.close();
  }
}

// M7 on the town river: the probe bar for tow-first-log (under 20 s) and tow-east-lane (under 30 s), the long log's
// two tugs and 3 timber, winter, the Marls' house taking its last timber, the homecoming, the lit window, and a save
// from before M7.
async function weirTow() {
  const timber = (s) =>
    s.inventory.slots.reduce((n, x) => n + (x?.item === 'timber' ? x.qty : 0), 0);
  for (const [scenario, hand, strategy, maxMs, extra] of [
    ['tow-first-log', 'right', 'wait', 20000, (r, s) => timber(s) === 1 && r.tugs >= 1],
    ['tow-first-log', 'left', 'action', 20000, (_r, s) => timber(s) === 1],
    ['tow-east-lane', 'right', 'wait', 30000, (r, s) => timber(s) === 1 && r.tugs === 0],
    ['tow-east-lane', 'left', 'chain', 30000, (_r, s) => timber(s) === 1],
    ['tow-long-log', 'right', 'wait', 20000, (r, s) => timber(s) === 3 && r.tugs >= 2],
    ['tow-winter', 'left', 'water', 20000, (_r, s) => timber(s) === 1],
  ]) {
    const farm = await openScenario(browser, url, scenario, { profile: PROFILE, hand });
    const r = await playTow(farm, { strategy, seed: 707 });
    await farm.frames(30);
    const s = await farm.state();
    const left = await farm.eval(() => window.__farm.dev.tow()?.logs.length ?? -1);
    towCheck(
      `${scenario} ${strategy} (${hand})`,
      r,
      extra(r, s) && left === 0 && !Object.keys(s.stats).some((k) => /^drift\.\d$/.test(k)),
      `timber ${timber(s)} tugs ${r.tugs} logs left ${left}`,
      { maxMs },
    );
    check(
      `${scenario} (${hand}): no console errors`,
      farm.errors.length === 0,
      farm.errors.join(' | '),
    );
    await farm.close();
  }
  // winter: half speed (a middle-lane log takes twice as long to reach the spur)
  {
    const farm = await openScenario(browser, url, 'tow-winter', { profile: PROFILE });
    // game time, not frames: px per second of the controller's own clock
    const at = () =>
      farm.eval(() => {
        const sc = window.__farm.game.scene.getScene('Town');
        return { y: sc.tow.metrics.logs[0].y, now: sc.tow.now };
      });
    const a = await at();
    await farm.frames(60);
    const b = await at();
    const speed = ((b.y - a.y) / (b.now - a.now)) * 1000;
    check(
      'tow-winter: a log drifts at half speed (5 px/s)',
      speed >= 3.5 && speed <= 6.5,
      `${speed.toFixed(1)} px/s`,
    );
    await farm.close();
  }
  // the Marls' house: Interact at the door gives the last timber, the scaffolding shows built
  {
    const farm = await openScenario(browser, url, 'tow-house-marls', { profile: PROFILE });
    const before = await farm.eval(() =>
      window.__farm.game.scene
        .getScene('Town')
        .things.landmarkSprite('house.marls')
        ?.getData('sprite'),
    );
    await farm.interact();
    await farm.frames(3);
    const s = await farm.state();
    const after = await farm.eval(() =>
      window.__farm.game.scene
        .getScene('Town')
        .things.landmarkSprite('house.marls')
        ?.getData('sprite'),
    );
    check(
      'tow-house-marls: Interact at the door gives the last timber; the house shows built',
      s.stats['house.marls'] === 6 &&
        timber(s) === 0 &&
        before === 'obj_house_marls_2' &&
        after === 'obj_house_marls_3',
      JSON.stringify({ house: s.stats['house.marls'], before, after }),
    );
    await farm.eval(() => window.__farm.dev.time.skipDays(1, { wake: false }));
    const t = await farm.state();
    check(
      'tow-house-marls: Senna comes home the next morning',
      t.stats['arrived.marls'] > 0,
      JSON.stringify(t.stats['arrived.marls']),
    );
    await farm.close();
  }
  // the homecoming: HOME AGAIN with the homecoming cue, the house open, Senna at her door, the wheel turning
  {
    const farm = await openScenario(browser, url, 'marls-arrive', { profile: PROFILE });
    const moment = await farm.event('valleyMoment', () =>
      farm.eval(() => window.__farm.dev.goto('town', 12, 2, 'down')),
    );
    await farm.idle();
    const look = await farm.eval(() => {
      const sc = window.__farm.game.scene.getScene('Town');
      return {
        senna: sc.npcs.at(17, 7),
        wheel: sc.wheel?.texture.key ?? null,
        house: sc.things.landmarkSprite('house.marls') ? 'scaffold' : null,
      };
    });
    check(
      'marls-arrive: HOME AGAIN (the homecoming cue), Senna at her door, the wheel turning, no scaffolding',
      moment?.text?.startsWith('HOME AGAIN') &&
        moment?.cue === 'homecoming' &&
        look.senna === 'senna' &&
        /^obj_millwheel_/.test(look.wheel ?? '') &&
        look.house === null,
      JSON.stringify({ moment, look }),
    );
    check('marls-arrive: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
    await farm.close();
  }
  {
    const farm = await openScenario(browser, url, 'marls-home', { profile: PROFILE });
    const lit = await farm.event('houseLit', () =>
      farm.eval(() => window.__farm.dev.time.set({ clock: '20:30' })),
    );
    check(
      'marls-home: the first evening the window is lit, once (houseLit)',
      lit?.house === 'marls',
      JSON.stringify(lit),
    );
    await farm.close();
  }
  // a save from before M7: nothing lost or given, Orin sells the hook, nothing on the river yet, the house boarded
  {
    const farm = await openScenario(browser, url, 'old-save-m7', { profile: PROFILE });
    const s = await farm.state();
    const t = await farm.eval(() => window.__farm.dev.tow());
    check(
      'old-save-m7: the money and stats kept, no timber, no drift yet, Senna away, the house boarded',
      s.money === 1200 &&
        timber(s) === 0 &&
        t?.logs.length === 0 &&
        !s.stats['arrived.marls'] &&
        !(await farm.eval(() => window.__farm.game.scene.getScene('Town').npcs.at(17, 7))),
      JSON.stringify({ money: s.money, logs: t?.logs.length }),
    );
    await farm.close();
  }
}

async function towingLane() {
  // the long lane: about 17 tiles round a bend, by taps (toward the slip when it is off screen) and by Action only
  for (const [hand, strategy, seed] of [
    ['right', 'wait', 11],
    ['left', 'water', 22],
    ['right', 'chain', 33],
    ['left', 'action', 44],
    ['right', 'action', 55],
  ]) {
    const farm = await openScenario(browser, url, 'tow-lane-long', { profile: PROFILE, hand });
    if (strategy === 'action') {
      // the Action button says what Action will do while towing owns it (the hook, first)
      const before = await farm
        .until(
          (_s, w) =>
            w.game.scene.getScene('UI').actionIconKey === 'tow_icon_hook' && 'tow_icon_hook',
          null,
          'the hook icon on Action',
          3000,
        )
        .catch(() => farm.eval(() => window.__farm.game.scene.getScene('UI').actionIconKey));
      const r = await playTow(farm, { strategy, seed });
      towCheck(
        `tow-lane-long action (${hand}): ${r.laneTiles} tiles`,
        r,
        r.laneTiles >= 10 && r.laneTiles <= 20 && r.inputs === 3 && before === 'tow_icon_hook',
        `icon ${before}`,
      );
    } else {
      const r = await playTow(farm, { strategy, seed });
      towCheck(`tow-lane-long ${strategy} (${hand})`, r);
    }
    check(
      `tow-lane-long ${strategy} (${hand}): no console errors`,
      farm.errors.length === 0,
      farm.errors.join(' | '),
    );
    await farm.close();
  }
  // T5: while a log is hooked, a tap on the hedge round the lane walks to the nearest bank (never silent)
  {
    const farm = await openScenario(browser, url, 'tow-lane-long', { profile: PROFILE });
    await farm.frames(5);
    await farm.eval(() => window.__farm.controls?.clear?.());
    await farm.tapButton('ACTION');
    await farm.until(
      (_s, w) => w.dev.tow()?.log.hooked,
      null,
      'tow-lane-long: hooked by Action',
      5000,
    );
    await farm.until(
      (_s, w) => w.game.scene.getScene('Lab').actionLock <= 0,
      null,
      'the lock',
      2000,
    );
    await farm.tapTile(32, 16); // two tiles up into the hedge, west of the farmer (the slip's way)
    const r = await farm
      .until(
        (_s, w) => {
          const lab = w.game.scene.getScene('Lab');
          const g = w.dev.tow()?.goal;
          return lab.walking && g && g !== 'slip' && lab.walkable(g.tx, g.ty) ? g : null;
        },
        null,
        'a walk after the hedge tap',
        3000,
      )
      .catch(() => null);
    const silent = await farm.eval(
      () => window.__farm.controls.entries.filter((e) => e.kind === 'silent').length,
    );
    check(
      'tow-lane-long: a hedge tap while towing walks to the nearest bank, not silent',
      r !== null && r.ty === 18 && silent === 0,
      JSON.stringify({ goal: r, silent }),
    );
    await farm.close();
  }
  // Action stays the tool's when the tow's context is not live: far from the lane's water, nothing hooked
  const farm = await openScenario(browser, url, 'tow-lane-long', { profile: PROFILE });
  await farm.eval(() => window.__farm.dev.goto('lab', 13, 15, 'down'));
  await farm.frames(5);
  const t = await farm.eval(() => window.__farm.dev.tow());
  const key = await farm.eval(() => window.__farm.game.scene.getScene('UI').actionIconKey);
  check(
    'tow-lane-long: away from the lane, Action is the tool again (no tow verb, no tow icon)',
    t === null || (t.verb === null && !String(key).startsWith('tow_')),
    JSON.stringify({ verb: t?.verb, key }),
  );
  await farm.close();
}

// The see-through hole behind a lone crown (owner bug 1, integration review): tap the tile behind the crown, as the
// scenario says; once the hole is fully open, the crown keeps at least 60% of its opaque pixels, the farmer's head
// shows, and the target tile under the same crown is not cut. On the iPhone 13 and the SE.
async function seeThrough() {
  for (const profile of ['i13', 'se']) {
    const farm = await openScenario(browser, url, 'walk-behind-tree', { profile });
    await farm.tapTile(7, 1);
    await farm.idle(5);
    const m = await farm.until(
      (s, w) => {
        const sc = w.game.scene.getScene('Farm');
        const st = sc.seeThrough;
        if (!st || st.open.body < 1) return null;
        const p = s.player;
        const tiles = sc.mapArt.crownUnderBody(p.x, p.y);
        const on = new Set();
        for (const [x, y, n] of st.runs)
          for (let i = 0; i < n; i++) on.add((y + 64) * 4096 + x + i);
        let all = 0;
        let cut = 0;
        for (const k of tiles) {
          const tx = k % 100000;
          const ty = (k - tx) / 100000;
          for (let y = ty * 16; y < ty * 16 + 16; y++)
            for (let x = tx * 16; x < tx * 16 + 16; x++)
              if (sc.mapArt.opaque(x, y)) {
                all++;
                if (on.has((y + 64) * 4096 + x)) cut++;
              }
        }
        const head = on.has((Math.round(p.y) - 20 + 64) * 4096 + Math.round(p.x));
        return {
          at: [Math.floor(p.x / 16), Math.floor((p.y - 3) / 16)],
          all,
          cut,
          head,
          target: st.open.target,
        };
      },
      null,
      'the see-through hole to open fully',
      5000,
    );
    if (process.env.SHOTS) await farm.shot(`walk-behind-tree-hole-${profile}`, process.env.SHOTS);
    // Land you do not own is dimmed over the ground only: the dim lies under the shade, props and overhead layers
    // (where trees and props are baked), and no tree or prop tile is in the layers under it inside a dim.
    const dim = await farm.eval(() => {
      const sc = window.__farm.game.scene.getScene('Farm');
      const inv = new Map(
        Object.entries(sc.cache.json.get('tiles_index').tiles).map(([k, v]) => [v + 1, k]),
      );
      const layers = sc.children.list.filter((o) => o.type === 'TilemapLayer');
      const rects = sc.children.list.filter(
        (o) => o.type === 'Rectangle' && o.fillColor === 0x14101f && o.fillAlpha > 0.2,
      );
      const bad = [];
      for (const r of rects) {
        for (const l of layers) {
          const above = ['shade', 'props', 'roof', 'overhead', 'lamps'].includes(l.layer.name);
          if (above !== l.depth > r.depth)
            bad.push(`${l.layer.name} at ${l.depth} vs dim ${r.depth}`);
        }
        const x0 = Math.round(r.x / 16);
        const y0 = Math.round(r.y / 16);
        for (let ty = y0; ty < y0 + Math.round(r.height / 16); ty++)
          for (let tx = x0; tx < x0 + Math.round(r.width / 16); tx++)
            // the ground layer's own "tree" tile is the collision kind, painted over by the props layer's art
            for (const l of layers.filter((q) => q.depth < r.depth && q.layer.name !== 'ground')) {
              const n = inv.get(l.getTileAt(tx, ty)?.index ?? -1) ?? '';
              if (/crown|tree|trunk|bush|fence|prop|stump|rock/.test(n))
                bad.push(`${l.layer.name} ${tx},${ty} ${n}`);
            }
      }
      return { rects: rects.length, bad: bad.slice(0, 6) };
    });
    check(
      `walk-behind-tree (${profile}): unowned plots dim the ground only, never a tree or a prop`,
      dim.rects > 0 && dim.bad.length === 0,
      JSON.stringify(dim),
    );
    check(
      `walk-behind-tree (${profile}): behind the lone crown the farmer's head shows and the crown keeps 60% or more`,
      m.at.join() === '7,1' && m.head && m.target === 0 && m.all > 200 && 1 - m.cut / m.all >= 0.6,
      JSON.stringify({ ...m, kept: +(1 - m.cut / m.all).toFixed(2) }),
    );
    check(
      `walk-behind-tree (${profile}): no console errors`,
      farm.errors.length === 0,
      farm.errors.join(' | '),
    );
    await farm.close();
  }
}

// World text never sits under a floating control plate (integration review: the Menu plate covered a plot sign's
// price on the SE). Every world label on screen is checked against the live plates, on the iPhone 13 and the SE.
async function worldText() {
  for (const profile of ['i13', 'se'])
    for (const name of ['tap-retarget-walk', 'ui-float-controls', 'ui-float-controls-left']) {
      const farm = await openScenario(browser, url, name, { profile });
      await farm.idle(5);
      await farm.frames(2);
      const r = await farm.eval(() => {
        const w = window.__farm.game.scene.getScenes(true).find((sc) => sc.grid);
        const plates = window.__farm.game.scene.getScene('UI').plates();
        const cam = w.cameras.main;
        const labels = w.children.list.filter(
          (o) =>
            o.type === 'Container' && o.visible && o.list?.some((c) => c.type === 'BitmapText'),
        );
        const under = [];
        let seen = 0;
        for (const o of labels) {
          if (o.name === 'rising') continue; // a "+1" line rises on its own tween (fx/Effects RISING_LABEL)
          const b = o.getBounds();
          const x0 = b.x - cam.scrollX + cam.x;
          const y0 = b.y - cam.scrollY + cam.y;
          const x1 = x0 + b.width;
          const y1 = y0 + b.height;
          if (x1 < 0 || x0 > 200 || y1 < cam.y || y0 > 400) continue; // off screen
          seen++;
          const text = o.list.find((c) => c.type === 'BitmapText').text;
          for (const p of plates) {
            const hit =
              p.kind === 'box'
                ? x1 > p.x0 && x0 < p.x1 && y1 > p.y0 && y0 < p.y1
                : Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(y0 - p.y, 0, p.y - y1)) <
                  p.r;
            if (hit) under.push(`${text} [${Math.round(x0)},${Math.round(y0)}]`);
          }
        }
        return { seen, under };
      });
      if (process.env.SHOTS) await farm.shot(`world-text-${name}-${profile}`, process.env.SHOTS);
      check(
        `${name} (${profile}): no world label sits under a control plate`,
        r.seen > 0 && r.under.length === 0, // at least one label on screen was checked
        JSON.stringify(r),
      );
      if (name === 'ui-float-controls' && profile === 'i13') {
        // A villager's bobbing "!" (a Label in a looping tween) put over Action rises clear of it like any label
        // (labels in a tween were all skipped, so the "!" stayed under the plate).
        await farm.eval(() => window.__farm.dev.clock.pause()); // no schedule sync hides the marker meanwhile
        const bob = await farm.eval(async () => {
          const w = window.__farm.game.scene.getScene('Farm');
          const cam = w.cameras.main;
          const plate = window.__farm.game.scene
            .getScene('UI')
            .plates()
            .find((p) => p.kind === 'disc' && p.r >= 28); // Action
          const m = [...w.npcs.shown.values()][0].marker;
          const wx = plate.x - cam.x + cam.scrollX;
          const wy = plate.y - cam.y + cam.scrollY;
          w.tweens.killTweensOf(m);
          m.setVisible(true).setPosition(wx, wy);
          w.tweens.add({ targets: m, y: wy - 3, duration: 450, yoyo: true, repeat: -1 });
          await window.__farm.dev.wait.frames(5);
          const b = m.getBounds();
          return { bottom: b.bottom - cam.scrollY + cam.y, plateTop: plate.y - plate.r };
        });
        check(
          'ui-float-controls (i13): a bobbing villager "!" over Action rises clear of the plate',
          bob.bottom <= bob.plateTop,
          JSON.stringify(bob),
        );
      }
      await farm.close();
    }
}

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

// ---------------------------------------------------------------- the text guard over every sheet (owner bug)

/**
 * Each sheet the game can show, opened straight through the UI scene on a scenario that has something in it. Each
 * opener runs in the page with (ui, farm hook) and may return false when the sheet does not apply there.
 */
const SHEETS = [
  ['hud', 'late-game-farm', () => true],
  [
    'banner',
    'farm-variant-dry',
    (ui, f) => {
      f.gameEvents.emit('goalCompleted', { text: 'Ship 5 items', reward: 50 });
      return true;
    },
  ],
  [
    'moment',
    'farm-variant-dry',
    (ui, f) => {
      f.gameEvents.emit('valleyMoment', {
        text: ['THE CREEK RUNS', 'Water finds the old bed again.'].join(String.fromCharCode(10)),
      });
      return true;
    },
  ],
  [
    'toast',
    'late-game-farm',
    (ui, f) => {
      f.gameEvents.emit('toast', {
        text: 'New kinds of goods go in Menu > Book. Finish a page for gold.',
        kind: 'info',
      });
      f.gameEvents.emit('toast', { text: 'Bought 1 Parsnip Seeds', kind: 'good' });
      return true;
    },
  ],
  ...['sunny', 'rain', 'storm'].map((w) => [
    `sleep.${w}`,
    'late-game-farm',
    (ui, f, a) => {
      f.getState().forecast = a;
      f.getState().time.minutes = 20 * 60;
      f.gameEvents.emit('openPanel', { type: 'sleep' });
      return true;
    },
    w,
  ]),
  [
    'summary',
    'late-game-farm',
    (ui) => {
      void ui.summary.present({
        endedDay: 9,
        endedSeason: 'summer',
        shipped: [
          { item: 'tomato', qty: 12, gold: 720 },
          { item: 'melon', qty: 3, gold: 750 },
          { item: 'corn', qty: 9, gold: 450 },
        ],
        total: 1920,
        withered: 2,
        passedOut: false,
        weather: 'rain',
        yearEnd: false,
        notes: ['The keg is ready: pale ale.', 'A new order is on the board.'],
      });
      return true;
    },
  ],
  ['yearEnd', 'late-game-farm', (ui) => (void ui.yearEnd.present(), true)],
  ...['seeds', 'home', 'upgrades', 'tools', 'goods'].map((tab) => [
    `shop.${tab}`,
    'late-game-farm',
    (ui, f, a) => {
      const shop = ui.panels.get('shop');
      shop.tab = a;
      shop.page = 0;
      f.gameEvents.emit('openPanel', { type: 'shop' });
      return true;
    },
    tab,
  ]),
  ...['bin', 'board', 'mail', 'cart', 'festival'].map((type) => [
    type,
    'late-game-farm',
    (ui, f, a) => (f.gameEvents.emit('openPanel', { type: a }), true),
    type,
  ]),
  [
    'festival.day',
    'festival-day',
    (ui, f) => (f.gameEvents.emit('openPanel', { type: 'festival' }), true),
  ],
  [
    'mail.letter',
    'mailbox-mail',
    (ui, f) => {
      f.gameEvents.emit('openPanel', { type: 'mail' });
      return true;
    },
    null,
    /^(Read|Ler)$/,
  ],
  ...['bag', 'goals', 'craft', 'skills', 'book', 'opts'].map((tab) => [
    `menu.${tab}`,
    'late-game-farm',
    (ui, f, a) => (f.gameEvents.emit('openPanel', { type: 'menu' }), ui.menu.openTab(a), true),
    tab,
  ]),
  ...['wait', 'bite', 'reel', 'done'].map((phase) => [
    `fishing.${phase}`,
    'fishing-spot',
    (ui, f, a) => {
      ui.fishing.start('carp', true);
      ui.fishing.phase = a;
      ui.fishing.delay = 1e9; // held in its phase while the guard reads it (no bite, no timeout)
      ui.fishing.clock = a === 'wait' ? 0 : -1e9;
      ui.fishing.resultText = 'Carp (silver)';
      ui.fishing.draw();
      return true;
    },
    phase,
  ]),
  ['plot', 'farm-mechanics', (ui) => (ui.plot.openFor('west'), true)],
  ...['place_spring', 'place_weir', 'greenhouse', 'library'].map((id) => [
    `project.${id}`,
    'late-game-farm',
    (ui, f, a) => (ui.panels.get('projects').openFor(a), true),
    id,
  ]),
  [
    'site.spring',
    'spring-site-ask',
    (ui) => (ui.panels.get('projects').openFor('place_spring'), true),
  ],
  ...['mara', 'clay', 'finn', 'rosa', 'senna', 'orin'].flatMap((id) => [
    [
      `npc.${id}.talk`,
      'late-game-farm',
      (ui, f, a) => {
        ui.npc.openFor(a);
        ui.npc.mode = 'talk';
        ui.npc.gained = 10;
        ui.npc.rebuild();
        return true;
      },
      id,
    ],
    [
      `npc.${id}.event`,
      'late-game-farm',
      (ui, f, a) => {
        ui.npc.openFor(a);
        if (ui.npc.mode !== 'event') return false;
        return true;
      },
      id,
    ],
    [
      `npc.${id}.gift`,
      'late-game-farm',
      (ui, f, a) => {
        ui.npc.openFor(a);
        ui.npc.mode = 'gift';
        ui.npc.rebuild();
        return true;
      },
      id,
    ],
    [
      `npc.${id}.giftResult`,
      'late-game-farm',
      (ui, f, a) => {
        ui.npc.openFor(a);
        ui.npc.mode = 'talk';
        ui.npc.gained = 80;
        ui.npc.reply = window.__farm.i18n.t('npc.replyLove');
        ui.npc.rebuild();
        return true;
      },
      id,
    ],
  ]),
];

async function textGuard() {
  // the four phone and language pairs side by side, each on its own page
  const pairs = ['se', 'i13'].flatMap((profile) => ['pt-BR', 'en'].map((lang) => [profile, lang]));
  await Promise.all(pairs.map(([profile, lang]) => textGuardOn(profile, lang)));
}

async function textGuardOn(profile, lang) {
  const only = process.env.SHEETS?.split(',');
  {
    let farm = null;
    let at = null;
    for (const [name, scenario, open, arg, button] of SHEETS) {
      if (only && !only.some((o) => name.startsWith(o))) continue;
      if (!farm || at !== scenario) {
        await farm?.close();
        farm = await openScenario(browser, url, scenario, { profile, query: `&lang=${lang}` });
        at = scenario;
      } else {
        await farm.load(scenario);
      }
      await farm.idle();
      const shown = await farm.eval(
        ([src, a]) => {
          const f = window.__farm;
          const ui = f.game.scene.getScene('UI');
          return new Function(`return (${src})`)()(ui, f, a);
        },
        [open.toString(), arg],
      );
      if (shown === false) continue;
      if (!['hud', 'toast', 'banner', 'moment'].includes(name)) await farm.panel();
      if (button) await tapSheetButton(farm, button);
      await farm.idle();
      // toasts glide into their stack for a moment
      await farm.frames(['toast', 'banner', 'moment'].includes(name) ? 40 : 12);
      if (name === 'moment')
        await farm.until(
          (s, f) => f.game.scene.getScene('UI').hud.moment.alpha === 1,
          null,
          'the moment to fade in',
        );
      const bad = await uiOverflow(farm);
      if (process.env.SHOTS) await farm.shot(`text-${name}-${profile}-${lang}`, process.env.SHOTS);
      check(`text guard (${profile}, ${lang}): ${name}`, bad.length === 0, bad.join(' | '));
      await farm.eval(() => {
        const ui = window.__farm.game.scene.getScene('UI');
        for (const m of ui.allModals()) if (m.isOpen) m.close();
      });
      await farm.idle();
    }
    check(
      `text guard (${profile}, ${lang}): no page errors`,
      !farm || farm.errors.length === 0,
      farm?.errors.join(' | '),
    );
    await farm?.close();
  }
}

// ---------------------------------------------------------------- fishing: the rod alone (owner bug)

/**
 * Step the paused loop frame by frame from an Action press until the fishing sheet has been open a few frames,
 * recording what the farmer shows each frame (the pose image's texture, or the sprite's when no pose shows) and any
 * tool icon swinging beside him.
 */
async function castFrames(farm) {
  await farm.eval(() => window.__farm.dev.loop.pause());
  await farm.page.keyboard.down('Space');
  const seq = [];
  try {
    for (let i = 0; i < 90; i++) {
      if (i === 3) await farm.page.keyboard.up('Space');
      const r = await farm.eval(() => {
        window.__farm.dev.loop.step(1);
        const w = window.__farm.game.scene.getScenes(true).find((sc) => sc.grid);
        const ui = window.__farm.game.scene.getScene('UI');
        const shown = w.pose?.visible
          ? w.pose.texture.key
          : w.sprite.visible
            ? w.sprite.texture.key + ':' + w.sprite.frame.name
            : '-';
        const icons = w.children.list
          .filter((o) => o.visible && o.type === 'Image' && o.depth === 9300)
          .map((o) => o.texture.key)
          .filter((k) => /hoe|pick|can|scythe|axe|spade|rod/.test(k));
        return { shown, icons, sheet: ui.fishing.isOpen };
      });
      seq.push(r);
      if (r.sheet && seq.filter((x) => x.sheet).length >= 4) break;
    }
  } finally {
    await farm.page.keyboard.up('Space');
    await farm.eval(() => window.__farm.dev.loop.resume());
  }
  return seq;
}

/** A bank tile near the farmer with water on the given side (stand there, face it, cast). */
const bankFacing = (farm, dir) =>
  farm.eval((d) => {
    const w = window.__farm.game.scene.getScene('Farm');
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
    const p = window.__farm.getState().player;
    const px = Math.floor(p.x / 16);
    const py = Math.floor(p.y / 16);
    let best = null;
    for (let dy = -14; dy <= 14; dy++)
      for (let dx = -14; dx <= 14; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        const here = w.tileInfo({ tx, ty });
        const there = w.tileInfo({ tx: tx + v[0], ty: ty + v[1] });
        if (here.kind === 'water' || here.blocked || here.door || there.kind !== 'water') continue;
        const dd = Math.abs(dx) + Math.abs(dy);
        if (!best || dd < best.dd) best = { tx, ty, dd };
      }
    return best;
  }, dir);

/** The rod's frames, less its swing frame (1), which carries the pickaxe's swoosh arc. */
const ROD_ONLY = /^player_(tool_rod_\w+_[023]|act_reel_\w+_\d)$/;

async function fishCast() {
  for (const profile of ['se', 'i13']) {
    const farm = await openScenario(browser, url, 'fish-cast', { profile });
    for (const dir of ['right', 'left', 'down', 'up']) {
      const at = await bankFacing(farm, dir);
      if (!check(`fish-cast (${profile}): a bank to cast ${dir} from`, !!at)) continue;
      await farm.mutate(
        (s, f, a) => {
          s.player.x = a.tx * 16 + 8;
          s.player.y = a.ty * 16 + 11;
          s.player.facing = a.dir;
          s.energy = 999;
        },
        { ...at, dir },
      );
      await farm.select(3);
      await farm.idle();
      const seq = await castFrames(farm);
      const before = seq.filter((x) => !x.sheet);
      const open = seq.filter((x) => x.sheet);
      const bad = seq.filter((x) => !ROD_ONLY.test(x.shown) || x.icons.length);
      check(
        `fish-cast (${profile}, ${dir}): from the first frame the farmer shows only the rod, cast to line out`,
        before.length >= 3 && open.length >= 1 && bad.length === 0,
        JSON.stringify({ bad: bad.slice(0, 3), first: seq[0], n: before.length }),
      );
      check(
        `fish-cast (${profile}, ${dir}): the sheet opens over the farmer holding the line out`,
        open.every((x) => /^player_act_reel_\w+_0$/.test(x.shown)),
        JSON.stringify(open[0]),
      );
      // A catch: the line comes in with the reel, still the rod alone, then he stands.
      await farm.eval(() => window.__farm.gameEvents.emit('fishCaught', undefined));
      await closeSheet(farm);
      const after = [];
      await farm.eval(() => window.__farm.dev.loop.pause());
      for (let i = 0; i < 40; i++)
        after.push(
          await farm.eval(() => {
            window.__farm.dev.loop.step(1);
            const w = window.__farm.game.scene.getScene('Farm');
            return w.pose?.visible ? w.pose.texture.key : `sprite:${w.sprite.frame.name}`;
          }),
        );
      await farm.eval(() => window.__farm.dev.loop.resume());
      const posed = after.filter((x) => !x.startsWith('sprite:'));
      check(
        `fish-cast (${profile}, ${dir}): the catch reels in with the rod, then the farmer stands`,
        posed.length > 0 &&
          posed.every((x) => ROD_ONLY.test(x)) &&
          after.at(-1).startsWith('sprite:'),
        JSON.stringify([...new Set(after)]),
      );
    }
    // A cast straight after another tool's swing: the pickaxe's (forced, mid-pose) and the hoe's.
    for (const tool of [
      ['pickaxe', 'mine'],
      ['hoe', 'till'],
    ]) {
      const at = await bankFacing(farm, 'right');
      await farm.mutate((s, f, a) => {
        s.player.x = a.tx * 16 + 8;
        s.player.y = a.ty * 16 + 11;
        s.player.facing = 'right';
      }, at);
      await farm.select(3);
      await farm.idle();
      await farm.eval(([item, kind]) => {
        const w = window.__farm.game.scene.getScene('Farm');
        w.toolSwing(item, kind);
        w.actionLock = 0;
        w.moveLock = 0;
      }, tool);
      const seq = await castFrames(farm);
      const bad = seq.filter((x) => !ROD_ONLY.test(x.shown) || x.icons.length);
      check(
        `fish-cast (${profile}): a cast right after the ${tool[0]}'s swing shows only the rod`,
        seq.some((x) => x.sheet) && bad.length === 0,
        JSON.stringify(bad.slice(0, 3)),
      );
      await closeSheet(farm);
      await farm.idle();
    }
    check(
      `fish-cast (${profile}): no page errors`,
      farm.errors.length === 0,
      farm.errors.join(' | '),
    );
    await farm.close();
  }
}

// ---------------------------------------------------------------- the guided start's buy step (owner bug)

/** The coach's view now (step, line, pointer). */
const coachNow = (farm) => farm.eval(() => window.__farm.game.scene.getScene('UI').coach.debug());

async function coachShop() {
  // Owner: "Buy 5 items is buggy: when you tap Mara it shows to tap on Close when it should show to tap in the
  // store." On her sheet the coach points at Shop; in the shop at a price; closed early, back at Mara.
  for (const lang of ['en', 'pt-BR']) {
    const farm = await openScenario(browser, url, 'town-dry-day2', {
      profile: 'se',
      query: `&lang=${lang}`,
    });
    const tag = `town-dry-day2 (SE, ${lang})`;
    await farm.during('panelOpen', ['npc'], () =>
      farm.eval(() => window.__farm.gameEvents.emit('talkTo', { id: 'mara' })),
    );
    await farm.idle();
    let c = await coachNow(farm);
    check(
      `${tag}: on Mara's sheet the coach points at Shop, never Close`,
      c?.visible && c.step === 'buySeeds' && c.pointer?.pattern === '^Shop$' && !!c.aim,
      JSON.stringify(c),
    );
    const tapped = await tapSheetButton(farm, lang === 'en' ? /^Shop$/ : /^Loja$/);
    await farm.panel('shop');
    await farm.idle();
    c = await coachNow(farm);
    check(
      `${tag}: Shop opens the store and the coach points at a price`,
      tapped &&
        c?.visible &&
        c.pointer?.kind === 'button' &&
        /g\$/.test(c.pointer.pattern) &&
        !!c.aim,
      JSON.stringify(c),
    );
    await closeSheet(farm);
    await farm.idle();
    c = await coachNow(farm);
    check(
      `${tag}: closed before 5 are bought, the coach leads back to Mara`,
      c?.visible && c.step === 'buySeeds' && c.pointer?.kind !== 'button',
      JSON.stringify(c),
    );
    check(`${tag}: no page errors`, farm.errors.length === 0, farm.errors.join(' | '));
    await farm.close();
  }
}

// ---------------------------------------------------------------- languages (src/i18n)

/**
 * The text guard (owner: "many of the texts are getting hidden"). Every visible text of a scene (the UI scene or the
 * title), found by walking the scene's display list in render order (a Label counts once, by its main glyphs; its
 * drop shadow is part of it), is checked and every problem is returned (empty when the layout holds):
 *
 * - it stays on the 200 x 400 canvas, with no unfilled `{param}` or raw dictionary key;
 * - inside an open sheet, it lies inside the sheet's visible part (below its top edge, above the canvas bottom);
 * - it overlaps no other text (two lines overprinting, as a 3-line wrap over a fixed-y line did);
 * - nothing opaque drawn after it covers it (an image, a sprite or a filled rectangle; the guided start's own
 *   marks, which point at things on purpose, are left out);
 * - it reads against what is behind it: the canvas is read back and the commonest colour in the text's box that
 *   is neither the text's nor its shadow's is the background; the contrast ratio (WCAG) must be at least 3, or 2
 *   for light text on an ink drop shadow (the shadow carries it).
 */
function overflowIn(sceneKey) {
  return (farm) =>
    farm.eval(async (key) => {
      const game = window.__farm.game;
      const scene = game.scene.getScene(key);
      const bad = [];
      const coach = key === 'UI' ? scene.coach?.root : null;
      const modal = key === 'UI' ? scene.allModals?.().find((m) => m.isOpen) : null;
      scene.sys.displayList.depthSort();
      // render order: [object, inCoach, inModal]
      const order = [];
      const units = [];
      const walk = (n, shown, inCoach, inModal) => {
        const on = shown && n.visible !== false && n.alpha !== 0;
        if (!on) return;
        const c = inCoach || n === coach;
        const m = inModal || (modal && n === modal.root);
        if (n.main && n.main.type === 'BitmapText') {
          if (n.main.text?.trim())
            units.push({
              t: n.main,
              shade: n.shade ?? null,
              outline: typeof n.outline === 'number' ? n.outline : null,
              inCoach: c,
              inModal: m,
              i: order.length,
            });
          order.push({ o: n, c, m, text: true });
          return;
        }
        if (n.type === 'BitmapText') {
          if (n.text?.trim())
            units.push({ t: n, shade: null, inCoach: c, inModal: m, i: order.length });
          order.push({ o: n, c, m, text: true });
          return;
        }
        if (typeof n.bw === 'number' && typeof n.bh === 'number') {
          // a Button: its face is Graphics (no bounds); it covers what lies under its footprint
          const mt = n.getWorldTransformMatrix();
          const a = mt.transformPoint(0, 0);
          const z = mt.transformPoint(n.bw, n.bh);
          const box = { left: a.x, top: a.y, right: z.x, bottom: z.y };
          order.push({
            o: { type: 'Button', alpha: n.alpha, getBounds: () => box },
            c,
            m,
            text: false,
          });
        } else if (n.type === 'Graphics') {
          // a Graphics has no bounds: read its solid fillRects from its command buffer (arguments per command)
          const ARGS = {
            0: 7,
            1: 0,
            2: 0,
            3: 4,
            4: 2,
            5: 2,
            6: 3,
            7: 2,
            8: 0,
            9: 0,
            10: 6,
            11: 6,
            14: 0,
            15: 0,
            21: 8,
            22: 6,
          };
          const mt = n.getWorldTransformMatrix();
          const cmd = n.commandBuffer ?? [];
          const rects = [];
          let fa = 0;
          for (let q = 0; q < cmd.length;) {
            const code = cmd[q];
            if (!(code in ARGS)) break; // a transform or an unknown command: stop reading this one
            if (code === 7) fa = cmd[q + 2];
            if (code === 3 && fa * n.alpha > 0.5) {
              const a = mt.transformPoint(cmd[q + 1], cmd[q + 2]);
              const z = mt.transformPoint(cmd[q + 1] + cmd[q + 3], cmd[q + 2] + cmd[q + 4]);
              rects.push({ left: a.x, top: a.y, right: z.x, bottom: z.y });
            }
            q += 1 + ARGS[code];
          }
          order.push({ o: { type: 'Graphics', alpha: n.alpha, rects }, c, m, text: false });
        } else order.push({ o: n, c, m, text: false });
        (n.list ?? []).forEach((ch) => walk(ch, on, c, m));
      };
      scene.sys.displayList.list.forEach((ch) => walk(ch, true, false, false));
      // With a sheet open, what is drawn before it (the HUD, the hotbar) sits under its dim on purpose.
      const sheetAt = modal ? order.findIndex((e) => e.o === modal.root) : -1;
      // the canvas, read back once (logical px -> device px)
      const img = await new Promise((r) => game.renderer.snapshot(r));
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const k = img.width / 200;
      const lum = (c) => {
        const f = (v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f((c >> 16) & 255) + 0.7152 * f((c >> 8) & 255) + 0.0722 * f(c & 255);
      };
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const near = (a, b) =>
        Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) +
          Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) +
          Math.abs((a & 255) - (b & 255)) <
        40;
      const hex = (c) => '#' + c.toString(16).padStart(6, '0');
      // Each text's ink box: the extent of its own colour's pixels inside its layout box (a layout box carries the
      // font's line padding, which would make neighbouring lines and big logos "overlap" with no glyph touching).
      const layout = units.map((u) => u.t.getBounds());
      const boxes = units.map((u, ui) => {
        const b = layout[ui];
        const fg = u.t.tintTopLeft & 0xffffff;
        const x0 = Math.max(0, Math.floor(b.left * k));
        const y0 = Math.max(0, Math.floor(b.top * k));
        const x1 = Math.min(cv.width, Math.ceil(b.right * k));
        const y1 = Math.min(cv.height, Math.ceil(b.bottom * k));
        if (x1 <= x0 || y1 <= y0) return { left: 0, top: 0, right: 0, bottom: 0, none: true };
        const px = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const w = x1 - x0;
        let [l, t, r, bt] = [Infinity, Infinity, -1, -1];
        for (let q = 0; q < px.length; q += 4) {
          const c = (px[q] << 16) | (px[q + 1] << 8) | px[q + 2];
          if (!near(c, fg)) continue;
          const xx = (q / 4) % w;
          const yy = Math.floor(q / 4 / w);
          // only a line's 9 glyph rows: its 2 rows of line spacing may hold the next text's top
          const row = ((y0 + yy) / k - b.top) / (u.t.scaleY || 1);
          if (row % 11 >= 9) continue;
          l = Math.min(l, xx);
          r = Math.max(r, xx);
          t = Math.min(t, yy);
          bt = Math.max(bt, yy);
        }
        if (r < 0) return { left: 0, top: 0, right: 0, bottom: 0, none: true };
        return {
          left: (x0 + l) / k,
          top: (y0 + t) / k,
          right: (x0 + r + 1) / k,
          bottom: (y0 + bt + 1) / k,
        };
      });
      // Each line's x-height band (glyph rows 2-6, where every letter has ink), from the font's own character
      // boxes: two texts overprint when these bands meet. (Layout and cell boxes carry accent and descender rows
      // and line spacing that are empty in most lines, so they "overlap" with no glyph touching.)
      const cores = units.map((u) => {
        const m = u.t.getWorldTransformMatrix();
        const lines = new Map();
        for (const ch of u.t.getTextBounds().characters ?? []) {
          if (!ch.char.trim()) continue;
          const a = m.transformPoint(ch.x, ch.y + 2);
          const z = m.transformPoint(ch.x + ch.w, ch.y + 7);
          const L = lines.get(ch.line);
          if (!L) lines.set(ch.line, { left: a.x, top: a.y, right: z.x, bottom: z.y });
          else {
            L.left = Math.min(L.left, a.x);
            L.right = Math.max(L.right, z.x);
          }
        }
        return [...lines.values()];
      });
      const inter = (a, b) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      units.forEach((u, ui) => {
        const n = u.t;
        const b = boxes[ui];
        const lb = layout[ui];
        const name = `"${n.text.replace(/\n/g, ' ').slice(0, 40)}"`;
        if (lb.left < -0.5 || lb.right > 200.5 || lb.top < -0.5 || lb.bottom > 400.5)
          bad.push(`${n.text} [${lb.left | 0}..${lb.right | 0} x ${lb.top | 0}..${lb.bottom | 0}]`);
        if (/\{\w+\}/.test(n.text) || /^[a-z]+\.[a-zA-Z.]+$/.test(n.text))
          bad.push(`raw: ${n.text}`);
        if (u.inCoach || (sheetAt >= 0 && u.i < sheetAt)) return;
        // a lower layer of stacked copies of one text (the title's outlined logo): only the top layer is read
        if (
          units.some(
            (v, vi) => vi !== ui && v.i > u.i && v.t.text === n.text && inter(b, boxes[vi]) > 0,
          )
        )
          return;
        if (b.none) {
          bad.push(`not drawn (no pixel of its colour): ${name}`);
          return;
        }
        if (u.inModal) {
          const top = modal.root.y;
          const bottom = Math.min(400, top + modal.panelH);
          if (b.top < top + 1.5 || b.bottom > bottom + 0.5 || b.left < 0 || b.right > modal.panelW)
            bad.push(
              `outside its sheet: ${name} [${b.top | 0}..${b.bottom | 0} in ${top | 0}..${bottom | 0}]`,
            );
        }
        // overlapping text (each pair once)
        units.forEach((v, vi) => {
          if (vi <= ui || v.inCoach || v.inModal !== u.inModal || v.t.text === n.text) return;
          if (sheetAt >= 0 && v.i < sheetAt) return;
          if (cores[ui].some((p) => cores[vi].some((q) => inter(p, q) > 1)))
            bad.push(`overlaps text: ${name} / "${v.t.text.slice(0, 30)}"`);
        });
        // covered by something opaque drawn after it
        for (let j = u.i + 1; j < order.length; j++) {
          const e = order[j];
          if (e.c || e.text) continue;
          const o = e.o;
          const solid =
            ((o.type === 'Image' || o.type === 'Sprite' || o.type === 'Button') && o.alpha > 0.5) ||
            (o.type === 'Rectangle' && o.isFilled && o.fillAlpha > 0.5 && o.alpha > 0.5);
          if (o.type === 'Graphics') {
            if (o.rects.some((r) => cores[ui].some((p) => inter(p, r) > 4)))
              bad.push(`covered by Graphics: ${name}`);
            continue;
          }
          if (!solid || !o.getBounds) continue;
          const ob = o.getBounds();
          // the x-height bands where the glyphs should be (the ink box only holds what still shows)
          if (cores[ui].some((p) => inter(p, ob) > 4))
            bad.push(`covered by ${o.type}${o.texture ? ' ' + o.texture.key : ''}: ${name}`);
        }
        // contrast against the commonest other colour in its box
        const x0 = Math.max(0, Math.floor((b.left - 1) * k));
        const y0 = Math.max(0, Math.floor((b.top - 1) * k));
        const x1 = Math.min(cv.width, Math.ceil((b.right + 1) * k));
        const y1 = Math.min(cv.height, Math.ceil((b.bottom + 1) * k));
        if (x1 <= x0 || y1 <= y0) return;
        const px = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const fg = n.tintTopLeft & 0xffffff;
        const sh = u.shade ? u.shade.tintTopLeft & 0xffffff : null;
        const count = new Map();
        let ink = 0;
        for (let q = 0; q < px.length; q += 4) {
          const c = (px[q] << 16) | (px[q + 1] << 8) | px[q + 2];
          if (near(c, fg)) {
            ink++;
            continue;
          }
          if (sh !== null && near(c, sh)) continue;
          count.set(c, (count.get(c) ?? 0) + 1);
        }
        if (ink === 0) {
          bad.push(`not drawn (no pixel of its colour): ${name}`);
          return;
        }
        let bg = null;
        let most = 0;
        for (const [c, m] of count) if (m > most) [bg, most] = [c, m];
        if (bg === null) return;
        // an outlined text is read against its own outline, which rings every glyph
        const r =
          u.outline !== null && u.outline !== undefined ? ratio(fg, u.outline) : ratio(fg, bg);
        const need = sh !== null && lum(fg) > lum(sh) ? 2 : 3;
        if (r < need) bad.push(`low contrast ${r.toFixed(2)}: ${name} ${hex(fg)} on ${hex(bg)}`);
      });
      return [...new Set(bad)];
    }, sceneKey);
}
const uiOverflow = overflowIn('UI');
const titleOverflow = overflowIn('Title');
/** Every text a scene shows (Label texts, read from their main glyphs). */
const textsOf = (farm, sceneKey) =>
  farm.eval((key) => {
    const out = [];
    const walk = (n) => {
      if (n.main?.text) out.push(n.main.text);
      (n.list ?? []).forEach(walk);
    };
    window.__farm.game.scene.getScene(key).children.list.forEach(walk);
    return out;
  }, sceneKey);
/** Open a sheet by its panel type (as Interact or a button would) and wait until it has settled. */
const openSheet = (farm, type) =>
  farm.during('panelOpen', [], () =>
    farm.eval((t) => window.__farm.gameEvents.emit('openPanel', { type: t }), type),
  );
/** Close whatever sheet is open and wait for it. */
const closeSheet = (farm) =>
  farm.during('panelClosed', [], () =>
    farm.eval(() => {
      const ui = window.__farm.game.scene.getScene('UI');
      ui.allModals()
        .find((m) => m.isOpen)
        ?.close();
    }),
  );

async function lang() {
  // The title in Portuguese at a first launch, on the smallest phone.
  let farm = await openScenario(browser, url, 'lang-pt-title', { profile: 'se' });
  let texts = await textsOf(farm, 'Title');
  check(
    "lang-pt-title: Rosa's letter, New Game and the language button are in Portuguese",
    texts.some((x) => x.startsWith('Você não vai lembrar de mim.')) &&
      texts.includes('Novo jogo') &&
      texts.includes('Português') &&
      (await farm.eval(() => window.__farm.i18n.getLocale())) === 'pt-BR',
    JSON.stringify(texts),
  );
  const fit = await titleOverflow(farm);
  check(
    'lang-pt-title (SE): every title text stays on the canvas',
    fit.length === 0,
    fit.join(' | '),
  );
  // One tap on the language button: the title redraws in English.
  const langBtn = await farm.eval(() => {
    const t = window.__farm.game.scene.getScene('Title');
    const r = window.__farm.game.canvas.getBoundingClientRect();
    const k = r.width / 200;
    let found = null;
    const walk = (n) => {
      if (!found && n.list?.some?.((c) => c.main?.text === 'Português')) {
        const b = n.getBounds();
        found = { x: r.left + b.centerX * k, y: r.top + b.centerY * k };
      }
      (n.list ?? []).forEach(walk);
    };
    t.children.list.forEach(walk);
    return found;
  });
  if (langBtn) await farm.page.touchscreen.tap(langBtn.x, langBtn.y);
  await farm.eval(() =>
    window.__farm.dev.wait.until(() => {
      const t = window.__farm.game.scene.getScene('Title');
      return (
        window.__farm.i18n.getLocale() === 'en' &&
        window.__farm.game.scene.isActive('Title') &&
        (t.buttons?.length ?? 0) > 0
      );
    }, 'the title in English'),
  );
  texts = await textsOf(farm, 'Title');
  check(
    'lang-pt-title: the language button switches the title to English',
    !!langBtn &&
      texts.includes('New Game') &&
      texts.some((x) => x.startsWith("You won't remember me.")),
    JSON.stringify(texts),
  );
  await farm.close();

  // The farm HUD in Portuguese: date, clock, gold, weather, the goal line.
  farm = await openScenario(browser, url, 'lang-pt-farm-hud', { profile: 'se' });
  await farm.idle();
  const hud = await farm.eval(() => {
    const h = window.__farm.game.scene.getScene('UI').hud;
    return {
      date: h.dateLabel.text,
      time: h.timeLabel.text,
      weather: h.weatherLabel.text,
      goal: h.goalLabel.text,
      goalW: h.goalLabel.textWidth,
    };
  });
  check(
    'lang-pt-farm-hud: the HUD reads in Portuguese (date, 24-hour clock, weather, goal line)',
    hud.date.startsWith('Primavera 6') &&
      /^7:\d\d$/.test(hud.time) &&
      ['Sol', 'Chuva', 'Tempestade'].includes(hud.weather) &&
      hud.goal === 'Rosa pediu: a Nascente Velha' &&
      hud.goalW <= 182,
    JSON.stringify(hud),
  );
  let over = await uiOverflow(farm);
  check(
    'lang-pt-farm-hud (SE): no HUD text leaves the canvas',
    over.length === 0,
    over.join(' | '),
  );
  // The plot signs' prices in the world: gold as "o" (they were written "<n>g" by hand).
  const prices = await farm.eval(() =>
    window.__farm.game.scene
      .getScene('Farm')
      .things.plotParts.filter((o) => o.type === 'Container')
      .map((o) => o.list.find((c) => c.type === 'BitmapText')?.text ?? '')
      .filter((s) => /^\d/.test(s)),
  );
  check(
    'lang-pt-farm-hud: the plot signs show their price as gold in Portuguese',
    prices.length > 0 && prices.every((p) => /^\d[\d.]*o$/.test(p)),
    JSON.stringify(prices),
  );
  // Menu > Opts: the language switch, one tap, applies at once and the open menu redraws.
  await openSheet(farm, 'menu');
  await farm.eval(() => window.__farm.game.scene.getScene('UI').menu.openTab('opts'));
  await farm.frames(2);
  over = await uiOverflow(farm);
  check('lang-pt-farm-hud (SE): Menu > Opç. fits', over.length === 0, over.join(' | '));
  const switched = await tapSheetButton(farm, /^Idioma: PT$/);
  await farm.eval(() =>
    window.__farm.dev.wait.until(
      () => window.__farm.i18n.getLocale() === 'en',
      'the language to switch',
    ),
  );
  await farm.frames(2);
  const date = await farm.eval(() => window.__farm.game.scene.getScene('UI').hud.dateLabel.text);
  const labels = await textsOf(farm, 'UI');
  check(
    'lang-pt-farm-hud: the switch applies at once (the HUD and the open Options are English)',
    switched && date.startsWith('Spring 6') && labels.includes('Language: EN'),
    JSON.stringify({ date, labels }),
  );
  check('lang-pt-farm-hud: no page errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();

  // Sheets in Portuguese on the SE: shop, board, bin and every menu tab.
  farm = await openScenario(browser, url, 'lang-pt-sheets', { profile: 'se' });
  const sheets = [];
  for (const type of ['shop', 'board', 'bin']) {
    await openSheet(farm, type);
    sheets.push([type, await uiOverflow(farm)]);
    await closeSheet(farm);
  }
  await openSheet(farm, 'menu');
  for (const tab of ['bag', 'goals', 'craft', 'skills', 'book', 'opts']) {
    await farm.eval((id) => window.__farm.game.scene.getScene('UI').menu.openTab(id), tab);
    await farm.frames(2);
    sheets.push([`menu.${tab}`, await uiOverflow(farm)]);
  }
  await closeSheet(farm);
  for (const [name, bad] of sheets)
    check(`lang-pt-sheets (SE): ${name} fits in Portuguese`, bad.length === 0, bad.join(' | '));
  check('lang-pt-sheets: no page errors', farm.errors.length === 0, farm.errors.join(' | '));
  await farm.close();

  // Dialogue: Mara in Portuguese, wrapped inside the sheet.
  farm = await openScenario(browser, url, 'lang-pt-dialogue', { profile: 'se' });
  await farm.during('panelOpen', ['npc'], () => farm.press('KeyE'));
  over = await uiOverflow(farm);
  const said = (await textsOf(farm, 'UI')).join(' | ');
  check(
    'lang-pt-dialogue (SE): Mara talks in Portuguese, inside the sheet',
    // her own text in Portuguese (her blurb from the data overlay, a Portuguese step button): the sheet's own
    // "Fechar", which alone passed this check, says nothing about Mara
    over.length === 0 &&
      said.includes('Cuida do Armazém.') &&
      !said.includes('Runs the General Store.') &&
      /Próximo|Presente|Loja/.test(said) &&
      !/\bGift\b|\bShop\b|\bNext\b/.test(said),
    `${over.join(' | ')} :: ${said}`,
  );
  await farm.close();

  // The mailbox: a letter in Portuguese.
  farm = await openScenario(browser, url, 'lang-pt-mail', { profile: 'se' });
  await farm.during('panelOpen', ['mail'], () => farm.press('KeyE'));
  const read = await tapSheetButton(farm, /^Ler$/);
  await farm.frames(3);
  over = await uiOverflow(farm);
  check(
    'lang-pt-mail (SE): a letter opens in Portuguese and fits the sheet',
    read && over.length === 0,
    over.join(' | '),
  );
  await farm.close();

  // The choice is remembered (outside the sandbox): pick Portuguese, reload, the title comes back in it.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${url}?debug`);
  await page.waitForFunction(() => window.__farm?.game?.scene.isActive('Title'), null, {
    timeout: 30000,
  });
  check(
    'lang: an automated browser starts in English',
    (await page.evaluate(() => window.__farm.i18n.getLocale())) === 'en',
  );
  await page.evaluate(() => window.__farm.i18n.choose('pt-BR')); // resolves once the choice is stored
  await page.reload();
  const kept = await page
    .waitForFunction(
      () =>
        window.__farm?.i18n?.getLocale() === 'pt-BR' && window.__farm.game.scene.isActive('Title'),
      null,
      { timeout: 30000 },
    )
    .then(() => true)
    .catch(() => false);
  check('lang: the chosen language survives a reload', kept);
  await ctx.close();
}

try {
  const blocks = SMOKE
    ? [smoke]
    : [
        smoke,
        everyScenario,
        mechanics,
        stages,
        ambient,
        actions,
        seeThrough,
        worldText,
        valley,
        spring,
        channels,
        weir,
        morning,
        towing,
        towingLane,
        weirTow,
        lang,
        coachShop,
        fishCast,
        textGuard,
      ];
  // BLOCKS=towing,towingLane runs only those blocks (a quick rerun of one area)
  const only = process.env.BLOCKS?.split(',');
  const run = (b) =>
    b().catch((e) => check(`${b.name}: block finished`, false, String(e?.stack ?? e)));
  // Blocks are independent pages: run them side by side (each has its own browser context).
  await Promise.all(blocks.filter((b) => !only || only.includes(b.name)).map(run));
  // Timing blocks run after, with no other page beside them: actionSlowFrame stalls frames on purpose, and the
  // other blocks' load turned its stalls into a 10 s timeout (twice in full verifies; never alone).
  const alone = SMOKE ? [] : [actionSlowFrame];
  for (const b of alone.filter((b) => !only || only.includes(b.name))) await run(b);
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
