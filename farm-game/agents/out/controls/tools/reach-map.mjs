// Reach map: every live touch target on every main screen, classified into comfortable / stretch / hard thumb
// zones for a right and a left one-handed grip, on five phone profiles. Writes reach.json and annotated
// screenshots (zone tint + every target outlined in its zone colour).
//
//   npm run build && node node_modules/vite/bin/vite.js preview --port 5179 --strictPort &
//   CHROMIUM_PATH=... node agents/out/controls/tools/reach-map.mjs
//
// Headless emulation only: the thumb model is geometry from published studies, not a measured hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  OUT,
  PROFILES,
  THUMB,
  launch,
  liveTargets,
  mmPerCss,
  openGame,
  sleep,
  zoneAt,
} from './lib.mjs';

const SHOTS = `${OUT}reach/`;
mkdirSync(SHOTS, { recursive: true });
/** Annotated screenshots for every screen on these profiles; the rest get the dock only. */
const FULL_SHOTS = new Set(['i13', 'se', 'promax']);

/** Screen setups, run in the page. Each leaves exactly one screen up. */
const SCREENS = {
  dock: () => {
    const f = window.__farm;
    const s = f.getState();
    s.player.x = 12 * 16 + 8;
    s.player.y = 10 * 16 + 11;
    s.player.facing = 'up'; // bin in front: Interact shows
  },
  'menu-bag': () => window.__farm.game.scene.getScene('UI').menu.openTab('bag'),
  'menu-goal': () => window.__farm.game.scene.getScene('UI').menu.openTab('goals'),
  'menu-make': () => window.__farm.game.scene.getScene('UI').menu.openTab('craft'),
  'menu-opts': () => window.__farm.game.scene.getScene('UI').menu.openTab('opts'),
  shop: () => window.__farm.gameEvents.emit('openPanel', { type: 'shop' }),
  bin: () => {
    const s = window.__farm.getState();
    s.inventory.slots[9] = { item: 'parsnip', qty: 12 };
    s.inventory.slots[10] = { item: 'wild_leek', qty: 3 };
    window.__farm.gameEvents.emit('openPanel', { type: 'bin' });
  },
  board: () => window.__farm.gameEvents.emit('openPanel', { type: 'board' }),
  sleep: () => window.__farm.gameEvents.emit('openPanel', { type: 'sleep' }),
  'npc-talk': () => {
    const s = window.__farm.getState();
    s.time.minutes = 600;
    window.__farm.game.scene.getScene('UI').npc.openFor('rosa');
  },
  'npc-gift': () => {
    const s = window.__farm.getState();
    s.inventory.slots[9] = { item: 'parsnip', qty: 12 };
    s.inventory.slots[10] = { item: 'wild_leek', qty: 3 };
    const ui = window.__farm.game.scene.getScene('UI');
    ui.npc.openFor('rosa');
    ui.npc.mode = 'gift';
    ui.npc.rebuild();
  },
  jar: () => {
    const f = window.__farm;
    const s = f.getState();
    s.placed.farm = [{ id: 901, type: 'preserve_jar', tx: 20, ty: 12, data: {} }];
    s.inventory.slots[9] = { item: 'parsnip', qty: 12 };
    f.game.scene.getScene('UI').jar.openFor(901);
  },
  fishing: () => window.__farm.game.scene.getScene('UI').fishing.start('carp', false),
  plot: () => window.__farm.game.scene.getScene('UI').plot.openFor('west'),
};

const closeAll = () => {
  const ui = window.__farm.game.scene.getScene('UI');
  for (const m of ui.allModals()) if (m.isOpen) m.close();
};

/** Paint the zones and outline every target, in the page, on a canvas laid over the game. */
async function overlay(page, p, hand, targets, geo) {
  await page.evaluate(
    ({ p, hand, targets, geo, THUMB }) => {
      const k = (25.4 / p.ppi) * p.dpr;
      const zone = (x, y) => {
        const wm = p.w * k;
        const px = hand === 'right' ? wm + THUMB.pivotOut : -THUMB.pivotOut;
        const py = p.h * k + p.chin - THUMB.pivotUp;
        const d = Math.hypot(x * k - px, y * k - py);
        if (d >= THUMB.comfortMin && d <= THUMB.comfortMax) return 'comfort';
        if (d >= THUMB.stretchMin && d <= THUMB.stretchMax) return 'stretch';
        return 'hard';
      };
      const col = { comfort: [40, 200, 90], stretch: [250, 200, 40], hard: [235, 60, 60] };
      document.getElementById('reach')?.remove();
      const c = document.createElement('canvas');
      c.id = 'reach';
      c.width = p.w;
      c.height = p.h;
      Object.assign(c.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: `${p.w}px`,
        height: `${p.h}px`,
        pointerEvents: 'none',
        zIndex: 50,
      });
      const g = c.getContext('2d');
      for (let y = 0; y < p.h; y += 3)
        for (let x = 0; x < p.w; x += 3) {
          const [r, gg, b] = col[zone(x + 1.5, y + 1.5)];
          g.fillStyle = `rgba(${r},${gg},${b},0.22)`;
          g.fillRect(x, y, 3, 3);
        }
      g.font = 'bold 11px sans-serif';
      targets.forEach((t, i) => {
        const x = geo.left + t.x * geo.k;
        const y = geo.top + t.y * geo.k;
        const w = t.w * geo.k;
        const h = t.h * geo.k;
        const [r, gg, b] = col[t.zone];
        g.strokeStyle = `rgb(${r},${gg},${b})`;
        g.lineWidth = 2;
        if (t.shape === 'circle') {
          g.beginPath();
          g.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
          g.stroke();
        } else g.strokeRect(x, y, w, h);
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.fillRect(x + 1, y + 1, 16, 13);
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillText(String(i + 1), x + 3, y + 12);
      });
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(0, p.h - 18, p.w, 18);
      g.fillStyle = '#fff';
      g.fillText(
        `${p.name}  ${hand} thumb  green=comfortable  yellow=stretch  red=hard`,
        4,
        p.h - 5,
      );
      document.body.appendChild(c);
    },
    { p, hand, targets, geo, THUMB },
  );
}

const result = { model: THUMB, profiles: {} };
const browser = await launch();
try {
  for (const p of PROFILES) {
    result.profiles[p.id] = { name: p.name, mmPerCss: mmPerCss(p), hands: {} };
    for (const hand of ['right', 'left']) {
      const { page, geo, ctx, errors } = await openGame(browser, p, {
        leftHanded: hand === 'left',
      });
      const screens = {};
      for (const [name, setup] of Object.entries(SCREENS)) {
        await page.evaluate(closeAll);
        await sleep(150);
        await page.evaluate(setup);
        await sleep(450);
        const raw = await liveTargets(page);
        const targets = raw.map((t) => {
          const cx = geo.left + t.cx * geo.k;
          const cy = geo.top + t.cy * geo.k;
          const z = zoneAt(p, hand, cx, cy);
          // share of the hit area that is comfortable (sampled on a 5x5 grid)
          let comfort = 0;
          for (let i = 0; i < 5; i++)
            for (let j = 0; j < 5; j++) {
              const sx = geo.left + (t.x + (t.w * (i + 0.5)) / 5) * geo.k;
              const sy = geo.top + (t.y + (t.h * (j + 0.5)) / 5) * geo.k;
              if (zoneAt(p, hand, sx, sy).zone === 'comfort') comfort++;
            }
          return {
            ...t,
            zone: z.zone,
            dMm: z.d,
            comfortShare: comfort / 25,
            wCss: Math.round(t.w * geo.k),
            hCss: Math.round(t.h * geo.k),
          };
        });
        screens[name] = targets;
        if (FULL_SHOTS.has(p.id) || name === 'dock' || name === 'menu-bag') {
          await overlay(page, p, hand, targets, geo);
          await page.screenshot({
            path: `${SHOTS}${p.id}-${hand}-${name}.jpg`,
            type: 'jpeg',
            quality: 72,
            scale: 'css',
          });
          await page.evaluate(() => document.getElementById('reach')?.remove());
        }
      }
      result.profiles[p.id].hands[hand] = { screens, errors };
      await ctx.close();
      console.log(p.id, hand, 'done', errors.length ? errors : '');
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}reach.json`, JSON.stringify(result, null, 1));

// Summary table: per profile/hand, counts by zone over all screens, plus the dock controls.
const rows = [];
for (const [id, pr] of Object.entries(result.profiles))
  for (const [hand, h] of Object.entries(pr.hands)) {
    const all = Object.values(h.screens).flat();
    const dock = h.screens.dock;
    const by = (z) => all.filter((t) => t.zone === z).length;
    const named = (n) => dock.find((t) => t.text === n);
    rows.push({
      profile: id,
      hand,
      targets: all.length,
      comfort: by('comfort'),
      stretch: by('stretch'),
      hard: by('hard'),
      action: named('ACTION')?.zone,
      interact: named('INTERACT')?.zone,
      menu: named('MENU')?.zone,
      'slots comfort': dock.filter((t) => t.text.startsWith('slot') && t.zone === 'comfort').length,
    });
  }
console.table(rows);
writeFileSync(`${OUT}reach-summary.json`, JSON.stringify(rows, null, 1));
