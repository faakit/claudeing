// A remote-controlled phone for playing the game step by step as a naive player (onboarding work).
// Starts a headless phone (real CDP touches, like the controls e2e), then listens for commands on a local port:
//
//   PORT=5299 URL=http://localhost:5190/ OUT=agents/out/onboarding/before node agents/probes/naive-driver.mjs
//   curl "localhost:5299/start?profile=i13&hand=right"   new game on a phone (title screen shown)
//   curl "localhost:5299/tap?x=100&y=200"                tap at logical (200x400) coordinates
//   curl "localhost:5299/hold?x=..&y=..&ms=400"          press, wait, lift
//   curl "localhost:5299/drag?x0=..&y0=..&x1=..&y1=..&ms=300&hold=0"  (hold: ms still before moving)
//   curl "localhost:5299/shot?name=01-title&note=..."    screenshot with a caption drawn under the canvas
//   curl "localhost:5299/state"                          what is on screen (toasts, goal, sheets, coach)
//   curl "localhost:5299/wait?ms=1000"
//   curl "localhost:5299/key?k=Enter"
//   curl "localhost:5299/ledger"                         taps, holds, drags and wall time since start
//   curl "localhost:5299/quit"
//
// Headless emulation only. It shows what is on screen; it never knows how a person feels.
import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { PROFILES, Thumb, launch, geometry, sleep } from '../../scripts/thumb-lib.mjs';

const PORT = Number(process.env.PORT ?? 5299);
const URL = process.env.URL ?? 'http://localhost:5190/';
let OUT = process.env.OUT ?? 'agents/out/onboarding/before';
mkdirSync(OUT, { recursive: true });

const browser = await launch();
let ctx = null;
let page = null;
let thumb = null;
let geo = null;
let t0 = Date.now();
const toasts = [];

async function start(profileId, hand, query) {
  if (ctx) await ctx.close();
  const p = PROFILES.find((x) => x.id === profileId) ?? PROFILES[0];
  ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: p.insets });
  await page.goto(`${URL}?debug${query ?? ''}`);
  await page.waitForFunction(() => window.__farm?.game?.scene?.getScene('Title')?.sys.isActive());
  await page.evaluate(() => {
    window.__toasts = [];
    window.__farm.gameEvents.on('toast', (t) =>
      window.__toasts.push({ t: Math.round(performance.now()), text: t.text }),
    );
  });
  geo = await geometry(page);
  thumb = new Thumb(cdp, geo, p, hand);
  if (hand === 'left') {
    // a left-handed player turns Left hand on first thing (Options); the probe sets it after New Game
    page.__left = true;
  }
  t0 = Date.now();
  toasts.length = 0;
  return { profile: p.id, hand, geo };
}

async function state() {
  return page.evaluate(() => {
    const f = window.__farm;
    const s = f.getState();
    const ui = f.game.scene.getScene('UI');
    const active = f.game.scene.getScenes(true).map((x) => x.sys.settings.key);
    const out = {
      scenes: active,
      toasts: (window.__toasts ?? []).slice(-6),
    };
    if (!ui?.sys.isActive()) return out;
    const p = s.player;
    const goal = ui.hud?.goalLabel?.main?.text;
    return {
      ...out,
      map: p.map,
      tile: [Math.floor(p.x / 16), Math.floor((p.y - 3) / 16)],
      facing: p.facing,
      day: `${s.time.season} ${s.time.day}`,
      clock: s.time.minutes,
      money: s.money,
      energy: s.energy,
      water: s.water,
      goal,
      goalIndex: s.goalIndex,
      selected: s.inventory.selected,
      hotbar: s.inventory.slots.slice(0, 8).map((x) => (x ? `${x.item}x${x.qty}` : '-')),
      sheets: ui
        .allModals()
        .filter((m) => m.isOpen)
        .map((m) => m.constructor.name),
      coach: ui.coach?.debug?.() ?? null,
      soil: Object.keys(s.farm.tiles).length,
      stats: Object.fromEntries(Object.entries(s.stats).filter(([k]) => !k.startsWith('gift.'))),
      forage: s.forage,
    };
  });
}

async function shot(name, note) {
  const file = `${OUT}/${name}.png`;
  await page.evaluate((note) => {
    let el = document.getElementById('__note');
    if (!note) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = '__note';
      el.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;padding:6px 8px;background:rgba(160,20,40,.92);color:#fff;' +
        'font:13px/1.3 sans-serif;z-index:99;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = note;
  }, note ?? '');
  await page.screenshot({ path: file });
  await page.evaluate(() => document.getElementById('__note')?.remove());
  return { file };
}

const server = http.createServer(async (req, res) => {
  const u = new globalThis.URL(req.url, 'http://x');
  const q = Object.fromEntries(u.searchParams);
  const n = (k, d = 0) => (q[k] === undefined ? d : Number(q[k]));
  let out = { ok: true };
  try {
    switch (u.pathname) {
      case '/start':
        out = await start(q.profile ?? 'i13', q.hand ?? 'right', q.query);
        break;
      case '/out':
        OUT = q.dir;
        mkdirSync(OUT, { recursive: true });
        break;
      case '/tap':
        await thumb.tap(n('x'), n('y'), n('ms', 60));
        break;
      case '/hold':
        await thumb.hold(n('x'), n('y'), n('ms', 400));
        break;
      case '/drag': {
        const steps = n('steps', 10);
        await thumb.down(n('x0'), n('y0'));
        if (n('hold')) await sleep(n('hold'));
        for (let i = 1; i <= steps; i++) {
          await thumb.move(
            n('x0') + ((n('x1') - n('x0')) * i) / steps,
            n('y0') + ((n('y1') - n('y0')) * i) / steps,
          );
          await sleep(n('ms', 300) / steps);
        }
        if (n('rest')) await sleep(n('rest'));
        await thumb.up();
        break;
      }
      case '/key':
        await page.keyboard.press(q.k);
        break;
      case '/wait':
        await sleep(n('ms', 500));
        break;
      case '/shot':
        out = await shot(q.name, q.note);
        break;
      case '/state':
        out = await state();
        break;
      case '/eval':
        out = { value: await page.evaluate(q.js) };
        break;
      case '/ledger':
        out = { ...thumb.ledger(), seconds: Math.round((Date.now() - t0) / 1000) };
        break;
      case '/reset-ledger':
        thumb.reset();
        t0 = Date.now();
        break;
      case '/quit':
        res.end('{"ok":true}');
        await browser.close();
        process.exit(0);
        break;
      default:
        out = { ok: false, error: 'unknown command' };
    }
  } catch (e) {
    out = { ok: false, error: String(e) };
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(out, null, 1));
});
server.listen(PORT, () => console.log(`naive driver on ${PORT}, game ${URL}, shots in ${OUT}`));
