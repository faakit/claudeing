// One-thumb benchmark: plays the core loops with real CDP touches only (joystick drags, Action taps, holds and
// swipes, Interact, hotbar, sheet buttons) and counts what the thumb had to do: taps, holds, drags, travel in mm,
// wall-clock seconds, stop corrections, and how many of those touches landed outside the comfortable zone.
//
//   CHROMIUM_PATH=... PROFILES=i13,promax,se HANDS=right,left REACTION_MS=0,180 \
//     node agents/out/controls/tools/one-thumb-bench.mjs
//
// The "thumb" is a bot that steers from the game state, so it is a perfect player when REACTION_MS=0. With
// REACTION_MS=180 it releases the stick 180 ms after the player crossed into the target tile, like a human
// reacting to what they see, and then corrects with short nudges; the extra gestures are the cost of imprecision.
// State is only set up (items, crop growth, villager time); every action in a loop is a real touch.
// Writes bench.json. Headless emulation: no claim about a real hand.
import { writeFileSync } from 'node:fs';
import {
  OUT,
  PROFILES,
  Thumb,
  launch,
  liveTargets,
  openGame,
  sleep,
  toCss,
  zoneAt,
} from './lib.mjs';

const pick = (env, all) => (process.env[env] ? process.env[env].split(',') : all);
const profiles = PROFILES.filter((p) => pick('PROFILES', ['i13']).includes(p.id));
const hands = pick('HANDS', ['right', 'left']);
const reactions = pick('REACTION_MS', ['0', '180']).map(Number);
const only = process.env.TASKS ? process.env.TASKS.split(',') : null;

/** Thumb wrapper that also scores every touch-down against the reach model. */
class BenchThumb extends Thumb {
  constructor(cdp, geo, p, hand) {
    super(cdp, geo, p);
    this.hand = hand;
  }
  reset() {
    super.reset();
    this.zones = { comfort: 0, stretch: 0, hard: 0 };
    this.corrections = 0;
  }
  async down(lx, ly) {
    const c = toCss(this.geo, lx, ly);
    this.zones[zoneAt(this.p, this.hand, c.x, c.y).zone]++;
    await super.down(lx, ly);
  }
  ledger() {
    return { ...super.ledger(), corrections: this.corrections, touchZones: { ...this.zones } };
  }
}

function makeWorld(page, thumb, hand, reactionMs) {
  const mirror = (x) => (hand === 'left' ? 200 - x : x);
  const ACTION = { x: mirror(166), y: 324 };
  const INTERACT = { x: mirror(125), y: 343 };
  const MENU = { x: mirror(22), y: 314 };
  // Where a thumb resting near Action starts a joystick drag: open dock, between Menu and Interact.
  const JOY = { x: mirror(72), y: 340 };
  const slot = (i) => ({ x: 16.5 + i * 24, y: 383.5 });
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const state = (fn, arg) => page.evaluate(fn, arg);
  const tile = () =>
    state(() => {
      const p = window.__farm.getState().player;
      return {
        tx: Math.floor(p.x / 16),
        ty: Math.floor((p.y - 3) / 16),
        map: p.map,
        facing: p.facing,
        x: p.x,
        fy: p.y - 3,
      };
    });

  /** 4-neighbour BFS on the live collision grid; returns straight segments [{dir, tx, ty}]. */
  const route = (tx, ty) =>
    state(
      ({ tx, ty }) => {
        const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
        const g = w.grid;
        const p = window.__farm.getState().player;
        const start = [Math.floor(p.x / 16), Math.floor((p.y - 3) / 16)];
        const key = (x, y) => y * g.width + x;
        const prev = new Map([[key(...start), null]]);
        const q = [start];
        while (q.length) {
          const [x, y] = q.shift();
          if (x === tx && y === ty) break;
          for (const [dx, dy] of [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= g.width || ny >= g.height) continue;
            if (g.blocked[key(nx, ny)] && !(nx === tx && ny === ty)) continue;
            if (prev.has(key(nx, ny))) continue;
            prev.set(key(nx, ny), [x, y]);
            q.push([nx, ny]);
          }
        }
        if (!prev.has(key(tx, ty))) return null;
        const path = [];
        for (let c = [tx, ty]; c; c = prev.get(key(...c))) path.unshift(c);
        const segs = [];
        for (let i = 1; i < path.length; i++) {
          const dx = path[i][0] - path[i - 1][0];
          const dy = path[i][1] - path[i - 1][1];
          const dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
          if (segs.length && segs[segs.length - 1].dir === dir)
            Object.assign(segs[segs.length - 1], { tx: path[i][0], ty: path[i][1] });
          else segs.push({ dir, tx: path[i][0], ty: path[i][1] });
        }
        return segs;
      },
      { tx, ty },
    );

  // STOP=center: the thumb lets go when the farmer looks centred on the target tile (what a person sees),
  // instead of the moment the hidden tile index changes (what a bot sees). Reaction time is added after.
  const centre = process.env.STOP === 'center';
  const reached = (t, seg) =>
    centre
      ? seg.dir === 'up'
        ? t.fy <= seg.ty * 16 + 8
        : seg.dir === 'down'
          ? t.fy >= seg.ty * 16 + 8
          : seg.dir === 'left'
            ? t.x <= seg.tx * 16 + 8
            : t.x >= seg.tx * 16 + 8
      : seg.dir === 'up'
        ? t.ty <= seg.ty
        : seg.dir === 'down'
          ? t.ty >= seg.ty
          : seg.dir === 'left'
            ? t.tx <= seg.tx
            : t.tx >= seg.tx;

  /** Hold the stick toward `dir` until the player's tile reaches the segment end (plus the reaction delay). */
  async function steer(seg, fresh) {
    const [dx, dy] = DIRS[seg.dir];
    if (fresh) await thumb.down(JOY.x, JOY.y);
    await thumb.move(JOY.x + dx * 18, JOY.y + dy * 18);
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const t = await tile();
      if (t.map !== window_map) return t;
      if (reached(t, seg)) break;
      await sleep(8);
    }
    if (reactionMs) await sleep(reactionMs);
    await thumb.move(JOY.x, JOY.y); // back to the centre: stop
  }
  let window_map = 'farm';

  /** Walk to (tx,ty) so that the last step is `lastDir` (so the player ends facing that way). */
  async function walkTo(tx, ty, lastDir) {
    window_map = (await tile()).map;
    const [dx, dy] = DIRS[lastDir];
    const segs = await route(tx - dx, ty - dy);
    if (!segs) throw new Error(`no route to ${tx - dx},${ty - dy}`);
    let fresh = true;
    for (const s of segs) {
      await steer(s, fresh);
      fresh = false;
    }
    await steer({ dir: lastDir, tx, ty }, fresh);
    await thumb.up();
    await sleep(60);
    if ((await tile()).map !== window_map) return; // went through a door
    // Corrections: a short nudge (120 ms) toward the target until on it. Facing is the nudge direction, so a
    // nudge back costs the facing too and needs one more nudge forward into the next tile... a real loop.
    for (let i = 0; i < 4; i++) {
      const t = await tile();
      if (t.tx === tx && t.ty === ty && t.facing === lastDir) break;
      thumb.corrections++;
      let dir = lastDir;
      if (t.tx !== tx || t.ty !== ty)
        dir = t.tx < tx ? 'right' : t.tx > tx ? 'left' : t.ty < ty ? 'down' : 'up';
      const [ndx, ndy] = DIRS[dir];
      await thumb.down(JOY.x, JOY.y);
      await thumb.move(JOY.x + ndx * 18, JOY.y + ndy * 18);
      await sleep(t.tx === tx && t.ty === ty ? 40 : 120);
      await thumb.up();
      await sleep(80);
    }
  }

  /** Face a solid neighbour without moving: a flick into it. */
  async function faceSolid(dir) {
    const [dx, dy] = DIRS[dir];
    await thumb.down(JOY.x, JOY.y);
    await thumb.move(JOY.x + dx * 18, JOY.y + dy * 18);
    await sleep(60);
    await thumb.up();
    await sleep(60);
  }

  const holdAction = (ms) => thumb.hold(ACTION.x, ACTION.y, ms);
  const tapAction = () => thumb.tap(ACTION.x, ACTION.y, 60);
  const tapInteract = async () => {
    await sleep(150);
    await thumb.tap(INTERACT.x, INTERACT.y, 60);
    await sleep(350);
  };
  /** Tap the live touch target whose text matches (nth match). */
  async function tapText(re, nth = 0) {
    const ts = (await liveTargets(page)).filter((t) => re.test(t.text));
    const t = ts[nth];
    if (!t)
      throw new Error(
        `no target ${re} (have ${(await liveTargets(page)).map((x) => x.text).join(' | ')})`,
      );
    await thumb.tap(t.cx, t.cy, 70);
    await sleep(300);
    return t;
  }
  async function swipeTool(steps) {
    for (let i = 0; i < Math.abs(steps); i++) {
      const dir = steps > 0 ? -1 : 1; // up = next
      await thumb.drag(ACTION.x, ACTION.y, ACTION.x, ACTION.y + dir * 17, 120, 6);
      await sleep(120);
    }
  }
  return {
    ACTION,
    INTERACT,
    MENU,
    JOY,
    slot,
    walkTo,
    faceSolid,
    holdAction,
    tapAction,
    tapInteract,
    tapText,
    swipeTool,
    tile,
  };
}

/** Fresh day-1 farm state for a task: house door, tools, seeds, money, energy, 10:00. */
const fresh = (page, extra = '') =>
  page.evaluate((extra) => {
    const f = window.__farm;
    const s = f.getState();
    const ui = f.game.scene.getScene('UI');
    ui.allModals().forEach((m) => m.isOpen && m.close());
    s.player.x = 14 * 16 + 8;
    s.player.y = 8 * 16 + 11;
    s.player.facing = 'down';
    s.energy = 100;
    s.water = 20;
    s.time.minutes = 600;
    s.inventory.selected = 0;
    s.farm.tiles = {};
    s.farm.weeds = {};
    s.money = 5000;
    s.inventory.slots[5] = { item: 'parsnip_seed', qty: 10 }; // every task starts with the same bag
    for (let i = 6; i < s.inventory.slots.length; i++) s.inventory.slots[i] = null;
    s.shipping = {};
    s.placed.farm = [];
    if (s.friends?.rosa) s.friends.rosa = { ...s.friends.rosa, talkedDay: 0, giftedDay: 0 };
    if (extra) new Function('s', 'f', extra)(s, f);
    f.gameEvents.emit('farmChanged', undefined);
    f.gameEvents.emit('inventoryChanged', undefined);
  }, extra);

const TASKS = {
  /** Till, plant and water a 3x3 plot (home plot 9-11 x 18-20), then harvest it when ripe. */
  async plot3x3(w, page) {
    await fresh(page);
    const pass = async () => {
      await w.walkTo(10, 17, 'down');
      await w.holdAction(750);
      await w.walkTo(10, 18, 'down');
      await w.holdAction(750);
      await w.walkTo(10, 19, 'down');
      await w.holdAction(750);
    };
    const t0 = Date.now();
    await pass(); // till (hoe in hand)
    await page.waitForTimeout(100);
    const tilled = await page.evaluate(
      () => Object.keys(window.__farm.getState().farm.tiles).length,
    );
    await w.tapSlot(5); // seeds
    await pass();
    const planted = await page.evaluate(
      () => Object.values(window.__farm.getState().farm.tiles).filter((t) => t.crop).length,
    );
    await w.tapSlot(1); // can
    await pass();
    const watered = await page.evaluate(
      () => Object.values(window.__farm.getState().farm.tiles).filter((t) => t.watered).length,
    );
    // ripen (state only), then harvest with whatever is in hand
    await page.evaluate(() => {
      const f = window.__farm;
      for (const t of Object.values(f.getState().farm.tiles)) if (t.crop) t.crop.stage = 4;
      f.gameEvents.emit('farmChanged', undefined);
    });
    await pass();
    const harvested = await page.evaluate(() =>
      window.__farm
        .getState()
        .inventory.slots.reduce((n, s) => n + (s?.item === 'parsnip' ? s.qty : 0), 0),
    );
    return { tilled, planted, watered, harvested, seconds: (Date.now() - t0) / 1000 };
  },

  /** Switch tools: hoe -> can (next), hoe -> seeds (5 away) by swipe, and the same by hotbar tap. */
  async switchSwipe(w, page) {
    await fresh(page);
    await w.swipeTool(1);
    const a = await page.evaluate(() => window.__farm.getState().inventory.selected);
    await w.swipeTool(4);
    const b = await page.evaluate(() => window.__farm.getState().inventory.selected);
    return { afterOneSwipe: a, afterFiveSwipes: b };
  },
  async switchHotbar(w, page) {
    await fresh(page);
    await w.tapSlot(1);
    await w.tapSlot(5);
    return { selected: await page.evaluate(() => window.__farm.getState().inventory.selected) };
  },

  /** Open the bag, pick a sprinkler stored there, "Use now", place it with Action. */
  async bagUse(w, page) {
    await fresh(page, "s.inventory.slots[14] = { item: 'sprinkler', qty: 1 };");
    await w.walkTo(10, 17, 'down');
    await w.tapMenu();
    await w.tapBagCell(14);
    await w.tapText(/^Use now$/);
    await w.tapAction();
    await sleep(300);
    return {
      placed: await page.evaluate(() =>
        (window.__farm.getState().placed.farm ?? []).some((o) => o.type === 'sprinkler'),
      ),
    };
  },

  /** Walk to the bin, open it, ship three kinds of goods, Done. */
  async sell(w, page) {
    await fresh(
      page,
      "s.inventory.slots[9] = { item: 'parsnip', qty: 9 }; s.inventory.slots[10] = { item: 'wild_leek', qty: 3 }; s.inventory.slots[11] = { item: 'daffodil', qty: 2 };",
    );
    await w.walkTo(12, 10, 'up');
    await w.tapInteract();
    for (let i = 0; i < 3; i++) await w.tapText(/^All$/, i); // one row per kind
    await w.tapText(/^Done$/);
    return {
      shipped: await page.evaluate(() =>
        Object.values(window.__farm.getState().shipping).reduce((a, b) => a + b, 0),
      ),
    };
  },

  /** Walk to Rosa (farm, 16,12 at 10:00), Interact (chat happens on open), Gift, Give the first row, Close. */
  async villager(w, page) {
    await fresh(page, "s.inventory.slots[9] = { item: 'daffodil', qty: 2 };");
    await page.waitForTimeout(600); // villagers re-sync once per game minute
    await w.walkTo(16, 13, 'up');
    await w.tapInteract();
    await w.tapText(/^Gift$/);
    await w.tapText(/^Give$/, 0);
    await w.tapText(/^Close$/);
    return {
      friendship: await page.evaluate(() =>
        JSON.stringify(window.__farm.getState().friends?.rosa ?? null),
      ),
    };
  },

  /** A preserve jar placed beside the path: walk up, Interact, Load, (sheet closes itself). */
  async machine(w, page) {
    await fresh(
      page,
      "s.placed.farm = [{ id: 950, type: 'preserve_jar', tx: 16, ty: 15, data: {} }]; s.nextPlacedId = 951; s.inventory.slots[9] = { item: 'parsnip', qty: 5 }; f.gameEvents.emit('placedChanged', { map: 'farm' });",
    );
    await page.waitForTimeout(300);
    await w.walkTo(16, 16, 'up');
    await w.tapInteract();
    await w.tapText(/^Load$/, 0);
    return {
      loaded: await page.evaluate(() =>
        JSON.stringify(window.__farm.getState().placed.farm?.[0]?.data ?? {}),
      ),
    };
  },

  /** Rod by swiping (hoe -> rod is 3 steps), walk to the pond, cast, hook on the bite, reel with holds. */
  async fish(w, page) {
    await fresh(page);
    const water = await page.evaluate(() => {
      const sc = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
      const g = sc.ground;
      // first open tile with water right below it, south part of the farm
      for (let y = 24; y < 43; y++)
        for (let x = 2; x < 28; x++) {
          const here = g.getTileAt(x, y)?.index;
          const below = g.getTileAt(x, y + 1)?.index;
          if (here !== 5 && below === 5 && !sc.grid.blocked[y * sc.grid.width + x]) return [x, y];
        }
      return null;
    });
    if (!water) throw new Error('no water edge found');
    await w.swipeTool(3);
    await w.walkTo(water[0], water[1], 'down');
    const before = await page.evaluate(() => {
      const s = window.__farm.getState();
      return { sel: s.inventory.selected, x: s.player.x, y: s.player.y, facing: s.player.facing };
    });
    await w.tapAction();
    await sleep(200);
    const ui = 'window.__farm.game.scene.getScene("UI").fishing';
    const castPhase = await page.evaluate(`${ui}.phase`);
    // wait for the bite, then tap the sheet
    const t0 = Date.now();
    while (Date.now() - t0 < 15000 && (await page.evaluate(`${ui}.phase`)) === 'wait')
      await sleep(30);
    await w.tapSheet();
    // reel: hold while the fish is above the bar centre, release otherwise (bang-bang, 60 ms decisions)
    let down = false;
    while (Date.now() - t0 < 40000) {
      const r = await page.evaluate(
        `(() => { const f = ${ui}; return { phase: f.phase, bar: f.reel.bar, size: f.reel.size, fish: f.reel.fish }; })()`,
      );
      if (r.phase !== 'reel') break;
      const want = r.fish > r.bar + r.size / 2;
      if (want && !down) {
        await w.sheetDown();
        down = true;
      } else if (!want && down) {
        await w.sheetUp();
        down = false;
      }
      await sleep(40);
    }
    if (down) await w.sheetUp();
    await sleep(700);
    await w.tapSheet(); // dismiss the result
    return {
      water,
      before,
      castPhase,
      fishStats: await page.evaluate(() =>
        Object.fromEntries(
          Object.entries(window.__farm.getState().stats).filter(([k]) => /fish|caught/i.test(k)),
        ),
      ),
      seconds: (Date.now() - t0) / 1000,
    };
  },

  /** Farmhouse door to the town exit. */
  async toTown(w, page) {
    await fresh(page);
    const t0 = Date.now();
    await w.walkToMap(14, 43, 'down');
    return { seconds: (Date.now() - t0) / 1000, map: (await w.tile()).map };
  },
};

const results = [];
const browser = await launch();
try {
  for (const p of profiles)
    for (const hand of hands) {
      const { page, cdp, geo, ctx } = await openGame(browser, p, { leftHanded: hand === 'left' });
      const thumb = new BenchThumb(cdp, geo, p, hand);
      for (const reactionMs of reactions) {
        const w = makeWorld(page, thumb, hand, reactionMs);
        w.tapSlot = async (i) => {
          const s = w.slot(i);
          await thumb.tap(s.x, s.y, 60);
          await sleep(150);
        };
        w.tapMenu = async () => {
          await thumb.tap(w.MENU.x, w.MENU.y, 60);
          await sleep(400);
        };
        w.tapBagCell = async (i) => {
          const c = await page.evaluate((i) => {
            const m = window.__farm.game.scene.getScene('UI').menu;
            const cells = m.content.list.filter(
              (o) => o.type === 'Zone' && Math.round(o.width) === 23,
            );
            const b = cells[i].getBounds();
            return { x: b.centerX, y: b.centerY };
          }, i);
          await thumb.tap(c.x, c.y, 70);
          await sleep(300);
        };
        const sheetPoint = { x: 100, y: 280 };
        w.tapSheet = () => thumb.tap(sheetPoint.x, sheetPoint.y, 60);
        w.sheetDown = () => thumb.down(sheetPoint.x, sheetPoint.y);
        w.sheetUp = () => thumb.up();
        w.walkToMap = async (tx, ty, dir) => {
          // the door tile itself changes the map; walk onto it
          await w.walkTo(tx, ty, dir).catch(() => undefined);
          await sleep(800);
        };
        for (const [name, run] of Object.entries(TASKS)) {
          if (only && !only.includes(name)) continue;
          if (reactionMs && !['plot3x3', 'sell', 'villager', 'machine', 'bagUse'].includes(name))
            continue;
          // back to the farm if a task left us elsewhere
          await page.evaluate(() => {
            const f = window.__farm;
            const s = f.getState();
            if (s.player.map !== 'farm') {
              s.player.map = 'farm';
              s.player.x = 14 * 16 + 8;
              s.player.y = 8 * 16 + 11;
              f.game.scene
                .getScenes(true)
                .find((x) => x.grid)
                ?.scene.start('Farm');
            }
          });
          await sleep(900);
          thumb.reset();
          let detail;
          try {
            detail = await run(w, page);
          } catch (e) {
            detail = { error: String(e).slice(0, 300) };
          }
          const row = { profile: p.id, hand, reactionMs, task: name, ...thumb.ledger(), detail };
          results.push(row);
          console.log(JSON.stringify(row));
        }
      }
      await ctx.close();
    }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}bench${process.env.SUFFIX ?? ''}.json`, JSON.stringify(results, null, 1));
