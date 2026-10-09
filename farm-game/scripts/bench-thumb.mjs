// One-thumb benchmark: plays the core loops with real CDP touches only (joystick drags, Action taps, holds and
// swipes, Interact, hotbar, sheet buttons, world taps) and counts what the thumb had to do: taps, holds, drags,
// travel in mm, wall-clock seconds, stop corrections, tool changes, and touches by reach zone.
//
//   npm run build && npm run bench:thumb
//   PROFILES=i13,pixel7,se,promax,fold HANDS=right,left REACTION_MS=0,180 STOP=center LABEL=m1 npm run bench:thumb
//
// The "thumb" is a bot that steers from the game state. It lets go when the farmer looks centred on the target
// tile (what a person sees), plus REACTION_MS (0 = a perfect player), then corrects with nudges; the extra
// gestures are the cost of imprecision. STOP=tile releases on the hidden tile index instead (pre-M2 baseline). State is only set up (items,
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
// Since M2 the farmer settles onto the tile centre it was last near, so even a perfect player aims at the
// sprite's centre (STOP=center, the default). STOP=tile releases on the hidden tile index (the old perfect bot).
const centreStop = (process.env.STOP ?? 'center') === 'center';
// Spread of a person's reaction time around REACTION_MS (Gaussian, ms). Rows with REACTION_MS=0 stay perfect
// unless REACTION_SD is set explicitly.
const reactionSd = Number(process.env.REACTION_SD ?? 30);
const sdExplicit = process.env.REACTION_SD !== undefined;
/** Aim spread of world taps in mm (0 = taps land on tile centres). */
const tapSdMm = Number(process.env.TAP_SD_MM ?? 0);
let seed = Number(process.env.SEED ?? 7);
const gauss = () => {
  const u = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  return Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
};

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * Does this build walk on a tap? TAP=0 forces the stick (to bench a build from before M4, whose saves already
 * carry the setting), TAP=1 forces taps; default: the game's own setting.
 */
async function tapModeOn(page) {
  if (process.env.TAP === '0') return false;
  if (process.env.TAP === '1') return true;
  // Builds before M4 already carry the setting in their saves; only trust it if the world can walk a tap.
  return page.evaluate(() => {
    const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
    return (
      typeof w?.planTap === 'function' &&
      window.__farm.getState().settings.controls?.tapToMove === true
    );
  });
}

function makeWorld(page, thumb, L, reactionMs) {
  const hand = thumb.hand;
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
    // This stop's reaction time: the row's mean plus Gaussian spread (REACTION_SD). Negative = anticipation:
    // let go that long before the sprite is centred, i.e. `lead` px early at walking speed.
    const reaction = reactionMs + (reactionMs !== 0 || sdExplicit ? gauss() * reactionSd : 0);
    const lead = reaction < 0 ? (-reaction * 64) / 1000 : 0;
    await page.waitForFunction(
      ({ seg, centre, map, lead }) => {
        const p = window.__farm.getState().player;
        const fy = p.y - 3;
        const tx = Math.floor(p.x / 16);
        const ty = Math.floor(fy / 16);
        const hit =
          p.map !== map ||
          (centre
            ? seg.dir === 'up'
              ? fy <= seg.ty * 16 + 8 + lead
              : seg.dir === 'down'
                ? fy >= seg.ty * 16 + 8 - lead
                : seg.dir === 'left'
                  ? p.x <= seg.tx * 16 + 8 + lead
                  : p.x >= seg.tx * 16 + 8 - lead
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
      { seg, centre: centreStop, map: mapNow, lead },
      { polling: 'raf', timeout: 15000 },
    );
    if ((await tile()).map !== mapNow) return;
    if (reaction > 0) {
      const late = await page.evaluate(() => performance.now() - window.__crossT);
      await sleep(Math.max(0, reaction - late - 15)); // ~15 ms for the touch to reach the page
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
      if (t.tx === tx && t.ty === ty)
        await sleep(60); // a flick to turn
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
  /** M6+: does this build have the tool ring? */
  const hasRing = () => page.evaluate(() => !!window.__farm.game.scene.getScene('UI').ring);
  /** Flick sideways on Action, slide to ring item `i` (0-7 hotbar slots, 8 = Bag), let go: one drag. */
  async function ringPick(i) {
    // The ring shows only filled hotbar slots and Bag (i = 8): find this item's place on the arc.
    const at = await page.evaluate(
      ({ i, left }) => {
        const s = window.__farm.getState();
        const items = [];
        for (let k = 0; k < 8; k++) if (s.inventory.slots[k]) items.push(k);
        items.push(8);
        const n = items.length;
        const t = n <= 1 ? 0.5 : items.indexOf(i) / (n - 1);
        const R = window.__farm.controls.ringGeometry ?? { radius: 56, from: 270, to: 100 };
        let deg = R.from + (R.to - R.from) * t;
        if (left) deg = 180 - deg;
        return { a: (deg * Math.PI) / 180, r: R.radius };
      },
      { i, left: hand === 'left' },
    );
    const inward = hand === 'left' ? 1 : -1;
    await thumb.down(ACTION.x, ACTION.y);
    await thumb.move(ACTION.x + inward * 9, ACTION.y);
    await sleep(16);
    await thumb.move(ACTION.x + inward * 18, ACTION.y);
    await sleep(60);
    await thumb.move(ACTION.x + Math.cos(at.a) * at.r, ACTION.y + Math.sin(at.a) * at.r);
    await sleep(140); // rest on the item before lifting (a quick lift leaves the ring open as a menu)
    await thumb.up();
    if (i < 8) thumb.toolChanges++;
    await sleep(250);
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
  /** Wait until the follow camera has stopped moving (taps map screen to tiles through it). */
  async function settleCamera() {
    let last = '';
    for (let i = 0; i < 40; i++) {
      const now = await page.evaluate(() => {
        const c = window.__farm.game.scene.getScenes(true).find((s) => s.grid).cameras.main;
        return `${c.scrollX.toFixed(1)},${c.scrollY.toFixed(1)}`;
      });
      if (now === last) return;
      last = now;
      await sleep(60);
    }
  }
  /**
   * Tap a tile. With TAP_SD_MM set, the thumb lands with that Gaussian spread plus 1.5 mm toward the thumb
   * base (down and toward the holding side), like the controls critic's human model.
   */
  async function tapTile(tx, ty, holdMs = 70) {
    const c = await tileScreen(page, tx, ty);
    let { x, y } = c;
    if (tapSdMm > 0) {
      const mm = 1 / (thumb.geo.k * ((25.4 / thumb.p.ppi) * thumb.p.dpr));
      const off = 1.06 * mm;
      x += gauss() * tapSdMm * mm + (hand === 'left' ? -off : off);
      y += gauss() * tapSdMm * mm + off;
    }
    await thumb.tap(x, y, holdMs);
  }
  /**
   * Paint a row (M5+): long-press the first tile until painting arms, drag through the rest, lift; then wait
   * until the farmer has worked them all.
   */
  async function paintTiles(tiles) {
    await settleCamera();
    const pts = [];
    for (const t of tiles) pts.push(await tileScreen(page, t.tx, t.ty));
    await thumb.down(pts[0].x, pts[0].y);
    await sleep(360); // past the 300 ms arm
    // a deliberate paint, about a tile every 120 ms (a fast straight push reads as steering)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      for (let k = 1; k <= 3; k++) {
        await thumb.move(a.x + ((b.x - a.x) * k) / 3, a.y + ((b.y - a.y) * k) / 3);
        await sleep(40);
      }
    }
    await thumb.up();
    await page
      .waitForFunction(
        () => {
          const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
          return w.work === null && w.route === null && w.painting === null;
        },
        null,
        { timeout: 20000, polling: 100 },
      )
      .catch(() => undefined);
    await sleep(300);
  }
  /**
   * Get to a thing and open it: with tap-to-move (M4+) one tap on it; before that, walk to the stand tile
   * with the stick and press Interact.
   */
  async function goInteract(target, stand, dir) {
    const tapMode = await tapModeOn(page);
    if (!tapMode) {
      await walkTo(stand.tx, stand.ty, dir);
      await tapInteract();
      return;
    }
    await settleCamera();
    // Off screen (under the dock or the HUD)? Tap a visible tile on the way first, as a person would.
    for (let hop = 0; hop < 3; hop++) {
      const c = await tileScreen(page, target.tx, target.ty);
      if (c.y >= 84 && c.y <= 278 && c.x >= 6 && c.x <= 194) break;
      const p = await tile();
      const ty = c.y > 278 ? p.ty + 5 : p.ty - 5;
      const tx = p.tx; // straight down (or up) the path the farmer is on
      await tapTile(tx, ty);
      await sleep(150);
      await page
        .waitForFunction(
          () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).route === null,
          null,
          { timeout: 6000, polling: 50 },
        )
        .catch(() => undefined);
      await settleCamera();
    }
    // A miss (aim spread) is retried, as a person would: each try is a counted gesture.
    for (let attempt = 0; attempt < 4; attempt++) {
      await settleCamera();
      await tapTile(target.tx, target.ty);
      await sleep(150);
      const opened = await page
        .waitForFunction(
          () => {
            const f = window.__farm;
            const open = f.game.scene
              .getScene('UI')
              .allModals()
              .some((m) => m.isOpen);
            const w = f.game.scene.getScenes(true).find((s) => s.grid);
            return open || w.route === null ? open : null;
          },
          null,
          { timeout: 8000, polling: 50 },
        )
        .then((h) => h.jsonValue())
        .catch(() => false);
      if (opened) break;
      thumb.retries++;
    }
    await sleep(350);
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
    ringPick,
    hasRing,
    tapTile,
    paintTiles,
    settleCamera,
    hand,
    goInteract,
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
    ui.ring?.close(); // a ring left open as a tap menu would swallow the next task's touches
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
    if (s.controls) s.controls.lastSeed = null;
    // drop any walk, painted row or paint left over from the last task
    const w = f.game.scene.getScenes(true).find((x) => x.grid);
    if (w && 'route' in w)
      Object.assign(w, { route: null, routeEnd: null, work: null, painting: null });
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
    // With auto tool (M3+) Action picks the hoe, seeds and can itself: no tool changes at all.
    const auto = await page.evaluate(
      () => window.__farm.getState().settings.controls?.autoTool === true,
    );
    // Row painting from Action (ruling 2026-10-09): each row is a tap to stand beside it and one
    // hold-then-drag on Action toward the middle of the screen, three tiles long.
    const actionPaint =
      auto &&
      (await tapModeOn(page)) &&
      (await page.evaluate(() => 'paintTiles' in window.__farm.game.scene.getScene('UI')));
    if (actionPaint) {
      const right = w.hand !== 'left';
      const toMid = right ? -1 : 1;
      // Round 3: a painted path may turn corners, so the whole plot is one serpentine from Action. Stand by the
      // plot's bottom corner on the thumb's side (right hand: 12,20; left: 8,20) and draw toward the middle of
      // the screen, then up a row, back, up a row, across: the finger stays in the comfortable arc above Action.
      const standX = right ? 12 : 8;
      // The game's own paint geometry, so the bench follows the constants.
      const G = await page.evaluate(() => window.__farm.controls.paintGeometry ?? null);
      const step = G?.step ?? 10;
      const first = G?.deadzone ?? 8;
      const turn = G?.turn ?? 14;
      const at = (n, turned = false) => (turned ? turn : first) + step * (n - 1) + step / 2;
      const serp = !!G; // builds before round 3 paint straight rows only
      const routeDone = () =>
        page
          .waitForFunction(
            () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).route === null,
            null,
            { timeout: 8000, polling: 50 },
          )
          .catch(() => undefined);
      const workDone = () =>
        page
          .waitForFunction(
            () => {
              const sc = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
              return sc.work === null && sc.route === null && sc.painting === null;
            },
            null,
            { timeout: 30000, polling: 100 },
          )
          .catch(() => undefined);
      /** Tap a tile to walk there, hopping 5 rows at a time while it is off screen (as a person would). */
      const tapWalk = async (tx, ty) => {
        for (let hop = 0; hop < 4; hop++) {
          await w.settleCamera();
          const c = await tileScreen(page, tx, ty);
          if (c.y >= 84 && c.y <= 278) break;
          const p = await w.tile();
          await w.tapTile(tx, c.y > 278 ? p.ty + 5 : p.ty - 5);
          await sleep(150);
          await routeDone();
        }
        await w.settleCamera();
        await w.tapTile(tx, ty);
        await sleep(150);
        await routeDone();
      };
      /** Hold Action until it arms, draw through the corners (dx, dy from Action) at a deliberate pace, lift. */
      const paintPath = async (corners) => {
        await w.thumb.down(w.ACTION.x, w.ACTION.y);
        await sleep(340);
        let prev = [0, 0];
        for (const c of corners) {
          const len = Math.hypot(c[0] - prev[0], c[1] - prev[1]);
          const n = Math.max(2, Math.round(len / 5));
          for (let k = 1; k <= n; k++) {
            await w.thumb.move(
              w.ACTION.x + prev[0] + ((c[0] - prev[0]) * k) / n,
              w.ACTION.y + prev[1] + ((c[1] - prev[1]) * k) / n,
            );
            await sleep(30);
          }
          prev = c;
          await sleep(60); // a person slows into each corner
        }
        await sleep(150); // and sees the preview before lifting
        await w.thumb.up();
        await workDone();
      };
      // the whole 3x3 (serpentine), or one straight row (older builds)
      const plotPath = [
        [toMid * at(3), 0],
        [toMid * at(3), -at(1, true)],
        [toMid * (at(3) - at(2, true)), -at(1, true)],
        [toMid * (at(3) - at(2, true)), -2 * at(1, true)],
        [toMid * at(3), -2 * at(1, true)],
      ];
      const t0 = Date.now();
      const travelBefore = w.thumb.ledger().travelMm;
      const pass = async () => {
        if (serp) {
          await tapWalk(standX, 20);
          await paintPath(plotPath);
        } else
          for (const ty of [18, 19, 20]) {
            await tapWalk(standX, ty);
            await paintPath([[toMid * 31, 0]]);
          }
      };
      // getting there: the plot starts 10 rows below the door
      await tapWalk(standX, 20);
      const travelThere = w.thumb.ledger().travelMm - travelBefore;
      // The seeds, once (never chosen for you): the hotbar slot is a short hop for the right thumb; for the left
      // thumb it is across the screen, so it flicks the tool ring instead.
      if (!right && (await w.hasRing())) await w.ringPick(5);
      else await w.tapSlot(5);
      await paintPath(serp ? plotPath : [[toMid * 31, 0]]);
      if (!serp)
        for (const ty of [19, 18]) {
          await tapWalk(standX, ty);
          await paintPath([[toMid * 31, 0]]);
        }
      const tilled = await farmCount(page, 'tilled');
      const planted = await farmCount(page, 'planted');
      const watered = await farmCount(page, 'watered');
      const after1 = await w.tile();
      await ripen(page);
      await pass();
      const harvested = await farmCount(page, 'harvested');
      return {
        ok: tilled === 9 && planted === 9 && watered === 9 && harvested >= 9,
        mode: serp ? 'serpentine' : 'action-paint',
        after1: `${after1.tx},${after1.ty} ${after1.facing}`,
        travelThereMm: travelThere,
        plotTravelMm: w.thumb.ledger().travelMm - travelBefore - travelThere,
        tilled,
        planted,
        watered,
        harvested,
        log:
          tilled === 9 && harvested >= 9
            ? undefined
            : await page.evaluate(() =>
                window.__farm.controls.entries.filter((e) => e.kind !== 'act').slice(-8),
              ),
        seconds: (Date.now() - t0) / 1000,
      };
    }
    // With painting (M5+) every pass is one long-press-and-drag over the plot, worked by the farmer.
    const paint =
      auto &&
      (await tapModeOn(page)) &&
      (await page.evaluate(() => {
        const w = window.__farm.game.scene.getScenes(true).find((s) => s.grid);
        return (
          typeof w?.onPaintArm === 'function' &&
          window.__farm.getState().settings.controls?.paint === true
        );
      }));
    if (paint) {
      // The serpentine starts on the thumb's side of the plot (right hand: the right column).
      const right = w.hand !== 'left';
      const cols = right ? [11, 10, 9] : [9, 10, 11];
      const serp = [18, 19, 20].flatMap((ty, row) =>
        (row % 2 ? [...cols].reverse() : cols).map((tx) => ({ tx, ty })),
      );
      // Two taps walk within sight of the whole plot (it starts 10 rows below the door, off screen).
      for (const [tx, ty] of [
        [right ? 12 : 9, 13],
        [right ? 11 : 9, 15],
      ]) {
        await w.settleCamera();
        await w.tapTile(tx, ty);
        await sleep(150); // let the tap land before waiting for its walk to end
        await page
          .waitForFunction(
            () => window.__farm.game.scene.getScenes(true).find((s) => s.grid).route === null,
            null,
            { timeout: 8000, polling: 50 },
          )
          .catch(() => undefined);
      }
      const t0 = Date.now();
      const travelBefore = w.thumb.ledger().travelMm;
      // Pick the seeds once (never chosen for you), then one pass over grass tills, plants and waters
      // each tile (worked until done for today).
      await w.tapSlot(5);
      await w.paintTiles(serp);
      const tilled = await farmCount(page, 'tilled');
      const planted = await farmCount(page, 'planted');
      const watered = await farmCount(page, 'watered');
      await ripen(page);
      await w.paintTiles(serp);
      const harvested = await farmCount(page, 'harvested');
      const ok9 = tilled === 9 && planted === 9 && watered === 9 && harvested >= 9;
      // Thumb travel once the plot is on screen (seed tap and the two paints), apart from the hops there.
      const plotTravelMm = w.thumb.ledger().travelMm - travelBefore;
      return {
        ok: ok9,
        mode: 'paint',
        plotTravelMm,
        log: ok9
          ? undefined
          : await page.evaluate(() =>
              window.__farm.controls.entries.filter((e) => e.kind !== 'act').slice(-8),
            ),
        tilled,
        planted,
        watered,
        harvested,
        seconds: (Date.now() - t0) / 1000,
      };
    }
    const t0 = Date.now();
    await pass(); // hoe in hand
    const tilled = await farmCount(page, 'tilled');
    // Seeds are never picked for you until you have planted some (owner ruling): one tap on the seeds.
    await w.tapSlot(5);
    await pass();
    const planted = await farmCount(page, 'planted');
    if (!auto) await w.tapSlot(1); // can (auto tool: the can steps in where the seeds in hand cannot act)
    await pass();
    const watered = await farmCount(page, 'watered');
    await ripen(page);
    await pass();
    const harvested = await farmCount(page, 'harvested');
    // With auto tool a held pass may already plant what it tilled, so judge the end state.
    return {
      ok: planted === 9 && watered === 9 && harvested >= 9 && (auto || tilled === 9),
      auto,
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
    // The sprinkler sits in row 2 of the bag, one column in from the thumb's edge: column 7 for the right hand
    // (slot 14), its mirror, column 2, for the left (slot 9), so both hands reach the same relative spot (round
    // 3; before, slot 14 for both put the left thumb's target across the sheet). BAG_SLOT overrides.
    const bagSlot = Number(process.env.BAG_SLOT ?? (w.hand === 'left' ? 9 : 14));
    await fresh(page, `s.inventory.slots[${bagSlot}] = { item: 'sprinkler', qty: 1 };`);
    await w.walkTo(10, 17, 'down');
    // M6: the ring's Bag is under the thumb; before, the Menu button.
    if (await w.hasRing()) {
      await w.ringPick(8);
      await sleep(200);
    } else await w.tapMenu();
    const c = await page.evaluate((bagSlot) => {
      const m = window.__farm.game.scene.getScene('UI').menu;
      const cells = m.content.list.filter((o) => o.type === 'Zone' && Math.round(o.width) === 23);
      const b = cells[bagSlot].getBounds();
      return { x: b.centerX, y: b.centerY };
    }, bagSlot);
    await w.thumb.tap(c.x, c.y, 70);
    await sleep(300);
    // Round 3: the same cell again brings it to hand (no reach across the sheet to "Use now").
    if (process.env.BAG_USE_NOW) await w.tapText(/^Use now$/);
    else await w.thumb.tap(c.x, c.y, 70);
    await sleep(300);
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
    await w.goInteract({ tx: 12, ty: 9 }, { tx: 12, ty: 10 }, 'up');
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
    await w.goInteract({ tx: 16, ty: 12 }, { tx: 16, ty: 13 }, 'up');
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
    await w.goInteract({ tx: 16, ty: 15 }, { tx: 16, ty: 16 }, 'up');
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
    // M6: the rod from the ring (one drag); before, three swipes on Action.
    if (await w.hasRing()) await w.ringPick(3);
    else await w.swipeTool(3);
    const tapMode = await tapModeOn(page);
    if (tapMode) {
      // M4: walk until the pond is on screen, then tap the water with the rod in hand: walk and cast in one
      await w.walkTo(water[0], water[1] - 3, 'down');
      await sleep(600); // camera catches up
      await w.tapTile(water[0], water[1] + 1);
      await page
        .waitForFunction(() => window.__farm.game.scene.getScene('UI').fishing.isOpen, null, {
          timeout: 8000,
        })
        .catch(() => undefined);
    } else {
      await w.walkTo(water[0], water[1], 'down');
      await w.tapAction();
    }
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
  // Rows with a reaction delay (a human-like stop) have their own thresholds ("task@human"); without one,
  // only success counts.
  const th = row.reactionMs !== 0 ? thresholds[`${row.task}@human`] : thresholds[row.task];
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
  (
    await startPreview(Number(process.env.BENCH_PORT ?? 5180), {
      snapshot: true,
      from: process.env.BENCH_DIST ?? 'dist',
    })
  ).url;
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
          await page.evaluate(() => window.__farm.controls?.clear());
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
          // Did every act match what the marker and the Action icon showed the frame before?
          Object.assign(
            row,
            await page.evaluate(() => {
              const c = window.__farm.controls;
              if (!c) return {};
              const acts = c.entries.filter((e) => e.kind === 'act' && e.ok).length;
              return { acts, markMismatches: c.mismatches().length };
            }),
          );
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
