// One-thumb benchmark: plays the core loops with real CDP touches only (joystick drags, Action taps, holds and
// swipes, Interact, hotbar, sheet buttons, world taps) and counts what the thumb had to do: taps, holds, drags,
// travel in mm, wall-clock seconds, stop corrections, tool changes, and touches by reach zone.
//
//   npm run build && npm run bench:thumb
//   PROFILES=i13,pixel7,se,promax,fold HANDS=right,left REACTION_MS=0,180 STOP=center LABEL=m1 npm run bench:thumb
//
// The "thumb" is a bot that steers from the game state: a perfect player with REACTION_MS=0. With STOP=center
// it lets go when the farmer looks centred on the target tile (what a person sees), plus REACTION_MS, then
// corrects with short nudges; the extra gestures are the cost of imprecision. State is only set up (items,
// crop growth, villager time); every action in a loop is a real touch.
//
// Pass/fail: scripts/bench-thresholds.json, by milestone (MILESTONE, default: the last one). A row over its
// threshold or a failed task makes the script exit 1. Writes agents/out/controls/bench-<LABEL>.json and .md.
// Headless emulation: no claim about a real hand.
import { readFileSync, writeFileSync } from 'node:fs';
import {
  PROFILES,
  Thumb,
  dock,
  launch,
  liveTargets,
  openGame,
  sleep,
  startPreview,
  tileScreen,
} from './thumb-lib.mjs';

const OUT = process.env.OUT ?? 'agents/out/controls/';
const pick = (env, all) => (process.env[env] ? process.env[env].split(',') : all);
const profiles = PROFILES.filter((p) => pick('PROFILES', ['i13']).includes(p.id));
const hands = pick('HANDS', ['right', 'left']);
const reactions = pick('REACTION_MS', ['0']).map(Number);
const only = process.env.TASKS ? process.env.TASKS.split(',') : null;
const allThresholds = JSON.parse(readFileSync('scripts/bench-thresholds.json', 'utf8'));
const milestone = process.env.MILESTONE ?? Object.keys(allThresholds).at(-1);
const thresholds = allThresholds[milestone] ?? {};
const centreStop = process.env.STOP === 'center';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function makeWorld(page, thumb, L, reactionMs) {
  const ACTION = { x: L.action.x, y: L.action.y };
  const INTERACT = { x: L.interact.x, y: L.interact.y };
  const MENU = { x: L.menu.x, y: L.menu.y };
  const JOY = L.stickHome; // a thumb resting by Action starts a stick drag in the open dock
  const slot = (i) => ({ x: 16.5 + i * 24, y: 383.5 });

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

  let mapNow = 'farm';
  /**
   * Hold the stick toward `dir` until the player reaches the segment end, then let go `reactionMs` later.
   * The crossing is detected in the page on the frame it happens (not by polling over CDP), and the delay is
   * measured from that frame, so the harness's own lag does not add to the modelled reaction time.
   */
  async function steer(seg, fresh) {
    const [dx, dy] = DIRS[seg.dir];
    if (fresh) await thumb.down(JOY.x, JOY.y);
    await thumb.move(JOY.x + dx * 18, JOY.y + dy * 18);
    await page.waitForFunction(
      ({ seg, centre, map }) => {
        const p = window.__farm.getState().player;
        const fy = p.y - 3;
        const tx = Math.floor(p.x / 16);
        const ty = Math.floor(fy / 16);
        const hit =
          p.map !== map ||
          (centre
            ? seg.dir === 'up'
              ? fy <= seg.ty * 16 + 8
              : seg.dir === 'down'
                ? fy >= seg.ty * 16 + 8
                : seg.dir === 'left'
                  ? p.x <= seg.tx * 16 + 8
                  : p.x >= seg.tx * 16 + 8
            : seg.dir === 'up'
              ? ty <= seg.ty
              : seg.dir === 'down'
                ? ty >= seg.ty
                : seg.dir === 'left'
                  ? tx <= seg.tx
                  : tx >= seg.tx);
        if (hit) window.__crossT = performance.now();
        return hit;
      },
      { seg, centre: centreStop, map: mapNow },
      { polling: 'raf', timeout: 15000 },
    );
    if ((await tile()).map !== mapNow) return;
    if (reactionMs) {
      const late = await page.evaluate(() => performance.now() - window.__crossT);
      await sleep(Math.max(0, reactionMs - late - 15)); // ~15 ms for the touch to reach the page
    }
    await thumb.move(JOY.x, JOY.y); // back to the centre: stop
    const actual = await page.evaluate(() => (window.__lastTouchT ?? 0) - window.__crossT);
    thumb.releases.push(Math.round(actual));
  }

  /** Walk to (tx,ty) so that the last step is `lastDir` (so the player ends facing that way). */
  async function walkTo(tx, ty, lastDir) {
    mapNow = (await tile()).map;
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
    await sleep(140);
    if ((await tile()).map !== mapNow) return; // went through a door
    // Corrections: a short nudge toward the target until on it.
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
      if (t.tx === tx && t.ty === ty) await sleep(60); // a flick to turn
      else {
        // a nudge: push until the farmer is visibly on the next tile (sprite centred), then let go
        const goal = { tx: t.tx + ndx, ty: t.ty + ndy };
        await page
          .waitForFunction(
            ({ goal, dir }) => {
              const p = window.__farm.getState().player;
              const fy = p.y - 3;
              const cx = goal.tx * 16 + 8;
              const cy = goal.ty * 16 + 8;
              return dir === 'right'
                ? p.x >= cx
                : dir === 'left'
                  ? p.x <= cx
                  : dir === 'down'
                    ? fy >= cy
                    : fy <= cy;
            },
            { goal, dir },
            { polling: 'raf', timeout: 1500 },
          )
          .catch(() => undefined);
      }
      await thumb.up();
      await sleep(200);
    }
  }

  const holdAction = (ms) => thumb.hold(ACTION.x, ACTION.y, ms);
  const tapAction = () => thumb.tap(ACTION.x, ACTION.y, 60);
  const tapInteract = async () => {
    await sleep(150);
    await thumb.tap(INTERACT.x, INTERACT.y, 60);
    await sleep(350);
  };
  async function tapText(re, nth = 0) {
    const all = await liveTargets(page);
    const t = all.filter((x) => re.test(x.text))[nth];
    if (!t) throw new Error(`no target ${re} (have ${all.map((x) => x.text).join(' | ')})`);
    await thumb.tap(t.cx, t.cy, 70);
    await sleep(300);
    return t;
  }
  async function swipeTool(steps) {
    for (let i = 0; i < Math.abs(steps); i++) {
      const dir = steps > 0 ? -1 : 1; // up = next
      await thumb.drag(ACTION.x, ACTION.y, ACTION.x, ACTION.y + dir * 17, 120, 6);
      thumb.toolChanges++;
      await sleep(120);
    }
  }
  async function tapSlot(i) {
    const s = slot(i);
    await thumb.tap(s.x, s.y, 60);
    thumb.toolChanges++;
    await sleep(150);
  }
  async function tapMenu() {
    await thumb.tap(MENU.x, MENU.y, 60);
    await sleep(400);
  }
  async function tapTile(tx, ty, holdMs = 70) {
    const c = await tileScreen(page, tx, ty);
    await thumb.tap(c.x, c.y, holdMs);
  }
  return {
    ACTION,
    INTERACT,
    MENU,
    JOY,
    walkTo,
    holdAction,
    tapAction,
    tapInteract,
    tapText,
    swipeTool,
    tapSlot,
    tapMenu,
    tapTile,
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
    f.gameEvents.emit('placedChanged', { map: 'farm' });
  }, extra);

const farmCount = (page, what) =>
  page.evaluate((what) => {
    const s = window.__farm.getState();
    const tiles = Object.values(s.farm.tiles);
    if (what === 'tilled') return tiles.length;
    if (what === 'planted') return tiles.filter((t) => t.crop).length;
    if (what === 'watered') return tiles.filter((t) => t.watered).length;
    return s.inventory.slots.reduce((n, x) => n + (x?.item === 'parsnip' ? x.qty : 0), 0);
  }, what);

const ripen = (page) =>
  page.evaluate(() => {
    const f = window.__farm;
    for (const t of Object.values(f.getState().farm.tiles)) if (t.crop) t.crop.stage = 4;
    f.gameEvents.emit('farmChanged', undefined);
  });

const TASKS = {
  /**
   * Till, plant and water a 3x3 plot (home plot 9-11 x 18-20), then harvest it when ripe: the core loop,
   * played the way this build plays best (M1-M2: walk, hold Action, switch tools on the hotbar).
   */
  async plot3x3(w, page) {
    await fresh(page);
    const pass = async () => {
      for (const y of [17, 18, 19]) {
        await w.walkTo(10, y, 'down');
        await w.holdAction(750);
      }
    };
    const t0 = Date.now();
    await pass(); // hoe in hand
    const tilled = await farmCount(page, 'tilled');
    await w.tapSlot(5); // seeds
    await pass();
    const planted = await farmCount(page, 'planted');
    await w.tapSlot(1); // can
    await pass();
    const watered = await farmCount(page, 'watered');
    await ripen(page);
    await pass();
    const harvested = await farmCount(page, 'harvested');
    return {
      ok: tilled === 9 && planted === 9 && watered === 9 && harvested >= 9,
      tilled,
      planted,
      watered,
      harvested,
      seconds: (Date.now() - t0) / 1000,
    };
  },

  /** Hoe -> seeds by swiping on Action (empty slots are skipped). */
  async switchSwipe(w, page) {
    await fresh(page);
    await w.swipeTool(-1);
    const sel = await page.evaluate(() => window.__farm.getState().inventory.selected);
    return { ok: sel === 5, selected: sel };
  },

  /** Hoe -> can -> seeds by hotbar taps. */
  async switchHotbar(w, page) {
    await fresh(page);
    await w.tapSlot(1);
    await w.tapSlot(5);
    const sel = await page.evaluate(() => window.__farm.getState().inventory.selected);
    return { ok: sel === 5, selected: sel };
  },

  /** Open the bag, pick a sprinkler stored there, "Use now", place it with Action. */
  async bagUse(w, page) {
    await fresh(page, "s.inventory.slots[14] = { item: 'sprinkler', qty: 1 };");
    await w.walkTo(10, 17, 'down');
    await w.tapMenu();
    const c = await page.evaluate(() => {
      const m = window.__farm.game.scene.getScene('UI').menu;
      const cells = m.content.list.filter((o) => o.type === 'Zone' && Math.round(o.width) === 23);
      const b = cells[14].getBounds();
      return { x: b.centerX, y: b.centerY };
    });
    await w.thumb.tap(c.x, c.y, 70);
    await sleep(300);
    await w.tapText(/^Use now$/);
    await w.tapAction();
    await sleep(300);
    const placed = await page.evaluate(() =>
      (window.__farm.getState().placed.farm ?? []).some((o) => o.type === 'sprinkler'),
    );
    return { ok: placed, placed };
  },

  /** Walk to the bin, open it, ship everything with one tap, Done. */
  async sell(w, page) {
    await fresh(
      page,
      "s.inventory.slots[9] = { item: 'parsnip', qty: 9 }; s.inventory.slots[10] = { item: 'wild_leek', qty: 3 }; s.inventory.slots[11] = { item: 'daffodil', qty: 2 };",
    );
    await w.walkTo(12, 10, 'up');
    await w.tapInteract();
    await w.tapText(/^Ship all produce$/);
    await w.tapText(/^Done$/);
    const shipped = await page.evaluate(() =>
      Object.values(window.__farm.getState().shipping).reduce((a, b) => a + b, 0),
    );
    return { ok: shipped === 14, shipped };
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
    const rosa = await page.evaluate(() => window.__farm.getState().friends?.rosa ?? null);
    return { ok: !!rosa && rosa.giftedDay > 0, friendship: rosa };
  },

  /** A preserve jar placed beside the path: walk up, Interact, Load (the sheet closes itself). */
  async machine(w, page) {
    await fresh(
      page,
      "s.placed.farm = [{ id: 950, type: 'preserve_jar', tx: 16, ty: 15, data: {} }]; s.nextPlacedId = 951; s.inventory.slots[9] = { item: 'parsnip', qty: 5 };",
    );
    await page.waitForTimeout(300);
    await w.walkTo(16, 16, 'up');
    await w.tapInteract();
    await w.tapText(/^Load$/, 0);
    const data = await page.evaluate(() => window.__farm.getState().placed.farm?.[0]?.data ?? {});
    return { ok: Object.keys(data).length > 0, loaded: data };
  },

  /** Rod by swiping, walk to the pond, cast, hook on the bite, reel with holds. */
  async fish(w, page) {
    await fresh(page);
    const water = await page.evaluate(() => {
      const sc = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
      const g = sc.ground;
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
    await w.tapAction();
    await sleep(200);
    const ui = 'window.__farm.game.scene.getScene("UI").fishing';
    const t0 = Date.now();
    while (Date.now() - t0 < 15000 && (await page.evaluate(`${ui}.phase`)) === 'wait')
      await sleep(30);
    await w.tapSheet();
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
    await w.tapSheet();
    const caught = await page.evaluate(() => window.__farm.getState().stats['caught'] ?? 0);
    return { ok: true, water, caught, seconds: (Date.now() - t0) / 1000 };
  },

  /** Farmhouse door to the town exit. */
  async toTown(w, page) {
    await fresh(page);
    const t0 = Date.now();
    await w.walkTo(14, 43, 'down').catch(() => undefined);
    await sleep(800);
    const map = (await w.tile()).map;
    return { ok: map !== 'farm', seconds: (Date.now() - t0 - 800) / 1000, map };
  },
};

/** Check a row against the milestone thresholds. Returns a list of failures. */
function judge(row) {
  const fails = [];
  if (row.detail?.error) fails.push(`error: ${row.detail.error}`);
  else if (row.detail?.ok === false) fails.push('task did not complete');
  // Human-like stops (STOP=center) have their own thresholds ("task@center"); without one, only success counts.
  const th = row.stop === 'center' ? thresholds[`${row.task}@center`] : thresholds[row.task];
  if (!th || row.detail?.error) return fails;
  for (const [k, max] of Object.entries(th)) {
    if (k.startsWith('_')) continue;
    const v = k === 'seconds' ? row.detail?.seconds : row[k];
    if (typeof v === 'number' && v > max) fails.push(`${k} ${v} > ${max}`);
  }
  return fails;
}

const results = [];
const base =
  process.env.URL ??
  (await startPreview(Number(process.env.BENCH_PORT ?? 5180), { snapshot: true })).url;
const browser = await launch();
try {
  for (const p of profiles)
    for (const hand of hands) {
      const { page, cdp, geo, ctx } = await openGame(browser, base, p, {
        leftHanded: hand === 'left',
      });
      const L = await dock(page);
      const thumb = new Thumb(cdp, geo, p, hand);
      for (const reactionMs of reactions) {
        const w = makeWorld(page, thumb, L, reactionMs);
        w.thumb = thumb;
        const sheetPoint = { x: 100, y: 280 };
        w.tapSheet = () => thumb.tap(sheetPoint.x, sheetPoint.y, 60);
        w.sheetDown = () => thumb.down(sheetPoint.x, sheetPoint.y);
        w.sheetUp = () => thumb.up();
        for (const [name, run] of Object.entries(TASKS)) {
          if (only && !only.includes(name)) continue;
          if (
            !only &&
            reactionMs &&
            !['plot3x3', 'sell', 'villager', 'machine', 'bagUse'].includes(name)
          )
            continue;
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
          const row = {
            profile: p.id,
            hand,
            reactionMs,
            stop: centreStop ? 'center' : 'tile',
            task: name,
            ...thumb.ledger(),
            detail,
          };
          row.fails = judge(row);
          results.push(row);
          console.log(
            `${row.fails.length ? 'FAIL' : 'ok  '} ${p.id} ${hand} r${reactionMs} ${name}: ${row.gestures} gestures (${row.taps}t ${row.holds}h ${row.drags}d), ${row.travelMm} mm, ${row.corrections} corr, ${row.toolChanges} tool${row.detail?.seconds ? `, ${row.detail.seconds.toFixed(1)} s` : ''}${row.fails.length ? `  <- ${row.fails.join('; ')}` : ''}`,
          );
        }
      }
      await ctx.close();
    }
} finally {
  await browser.close();
}

const label = process.env.LABEL ?? 'latest';
writeFileSync(`${OUT}bench-${label}.json`, JSON.stringify(results, null, 1));
const md = [
  `| profile | hand | stop | reaction ms (measured) | task | gestures | taps | holds | drags | travel mm | corrections | tool changes | seconds | comfort/stretch/hard | result |`,
  `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
  ...results.map(
    (r) =>
      `| ${r.profile} | ${r.hand} | ${r.stop} | ${r.reactionMs}${r.releaseMs !== null ? ` (${r.releaseMs})` : ''} | ${r.task} | ${r.gestures} | ${r.taps} | ${r.holds} | ${r.drags} | ${r.travelMm} | ${r.corrections} | ${r.toolChanges} | ${r.detail?.seconds?.toFixed?.(1) ?? ''} | ${r.touchZones.comfort}/${r.touchZones.stretch}/${r.touchZones.hard} | ${r.fails.length ? `FAIL: ${r.fails.join('; ')}` : 'ok'} |`,
  ),
].join('\n');
writeFileSync(`${OUT}bench-${label}.md`, `${md}\n`);
const failed = results.filter((r) => r.fails.length);
console.log(
  failed.length
    ? `\nBENCH FAILED (${failed.length} of ${results.length} rows, thresholds ${milestone})`
    : `\nBENCH OK (${results.length} rows, thresholds ${milestone})`,
);
process.exit(failed.length ? 1 : 0);
