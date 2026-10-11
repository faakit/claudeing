/**
 * The in-game dev menu (debug builds only), drawn in the page (HTML), not in Phaser: it adds no scene, no draw
 * call and no touch target to the game, so perf budgets and scene checks see the game exactly as players do.
 *
 * A small DEV tab in the top-left corner (over the read-only HUD, where no touch target lives) opens a bottom sheet
 * with big buttons, all within thumb reach: jump to any scenario or map, pause or speed up the clock, freeze and
 * step frames, the frame graph (FPS, ms, draw calls) and a tile-coordinate overlay. Backquote (`) toggles it.
 * The tab shows in dev builds and with `?scenario=` or `?devmenu` (plain `?debug` pages, i.e. the older e2e
 * suites, never see it); `__farm.dev.menu.open()` works everywhere.
 */
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, WORLD_CLEAR, WORLD_VIEW } from '../config';
import { mapsData } from '../data';
import { mapVariants } from '../systems/valley';
import { getState } from '../state/store';
import { formatClock, seasonLabel } from '../systems/time';
import type { FarmDevApi } from './api';
import type { FrameMeter } from './frameStats';

type Page = 'main' | 'scenarios' | 'maps';

const CSS = `
.tadev-tab{position:fixed;z-index:1000;padding:4px 8px;font:700 11px/1 ui-monospace,monospace;color:#f4ead2;
  background:rgba(42,26,36,.75);border:1px solid #e4b04a;border-radius:4px;opacity:.75;touch-action:manipulation}
.tadev-sheet{position:fixed;z-index:1001;bottom:0;box-sizing:border-box;
  padding:8px 8px calc(8px + env(safe-area-inset-bottom));background:rgba(20,16,31,.94);
  border-top:2px solid #e4b04a;color:#f4ead2;font:600 13px/1.25 system-ui,sans-serif}
.tadev-sheet h3{margin:0 0 6px;font-size:13px;color:#e4b04a;display:flex;justify-content:space-between;
  align-items:center;gap:6px}
.tadev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.tadev-grid.one{grid-template-columns:1fr}
.tadev-sheet button{min-height:46px;border-radius:6px;border:1px solid #8a6a43;background:#4c2c1c;
  color:#f4ead2;font:600 13px/1.1 system-ui,sans-serif;touch-action:manipulation;overflow:hidden}
.tadev-sheet button.on{background:#2e6a3e}
.tadev-sheet button small{display:block;font-weight:400;font-size:11px;color:#d9c7a0}
.tadev-status{margin-top:6px;font:11px ui-monospace,monospace;color:#d9c7a0}
.tadev-overlay{position:fixed;z-index:999;pointer-events:none}
`;

export class DevMenu {
  private tab: HTMLButtonElement | null = null;
  private sheet: HTMLDivElement | null = null;
  private status: HTMLDivElement | null = null;
  private graph: HTMLCanvasElement | null = null;
  private grid: HTMLCanvasElement | null = null;
  private lastTouch: { tx: number; ty: number } | null = null;
  private scenarioPage = 0;
  showFps = false;
  showTiles = false;

  constructor(
    private readonly api: FarmDevApi,
    private readonly meter: FrameMeter,
    private readonly canvas: () => HTMLCanvasElement | null,
    showTab: boolean,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    if (showTab) this.showTab();
    window.addEventListener('keydown', (e) => {
      if (e.key === '`') this.toggle();
    });
    // Remember where the last touch landed (for the tile overlay); capture, so the game's handlers are untouched.
    window.addEventListener('pointerdown', (e) => this.noteTouch(e.clientX, e.clientY), true);
    const loop = () => {
      this.update();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get isOpen(): boolean {
    return this.sheet !== null;
  }

  /** The canvas rect and CSS px per logical px. */
  private geo(): { left: number; top: number; width: number; height: number; k: number } | null {
    const c = this.canvas();
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, k: r.width / GAME_WIDTH };
  }

  showTab(): void {
    if (this.tab) return;
    const b = document.createElement('button');
    b.className = 'tadev-tab';
    b.textContent = 'DEV';
    b.setAttribute('aria-label', 'Open the dev menu');
    b.addEventListener('click', () => this.toggle());
    document.body.appendChild(b);
    this.tab = b;
  }

  toggle(): void {
    if (this.sheet) this.close();
    else this.open();
  }

  open(page: Page = 'main'): void {
    this.close();
    const sheet = document.createElement('div');
    sheet.className = 'tadev-sheet';
    // Touches on the sheet never reach the game under it.
    for (const ev of ['pointerdown', 'touchstart', 'mousedown'])
      sheet.addEventListener(ev, (e) => e.stopPropagation());
    const head = document.createElement('h3');
    const title = document.createElement('span');
    head.appendChild(title);
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.style.minHeight = '34px';
    close.addEventListener('click', () => this.close());
    head.appendChild(close);
    sheet.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'tadev-grid';
    sheet.appendChild(grid);
    const btn = (
      text: string,
      fn: () => void,
      opts: { on?: boolean; sub?: string; to?: HTMLElement } = {},
    ) => {
      const b = document.createElement('button');
      b.textContent = text;
      if (opts.sub) {
        const s = document.createElement('small');
        s.textContent = opts.sub;
        b.appendChild(s);
      }
      if (opts.on) b.classList.add('on');
      b.addEventListener('click', fn);
      (opts.to ?? grid).appendChild(b);
      return b;
    };
    const api = this.api;
    if (page === 'main') {
      title.textContent = `DEV · ${api.scenario ?? 'live game'}${api.sandboxed ? ' · sandbox' : ''}`;
      btn('Scenarios', () => this.open('scenarios'));
      btn('Maps', () => this.open('maps'));
      btn('Reload', () => location.reload());
      const clock = api.clock.get();
      btn(
        clock.paused ? 'Clock off' : 'Clock on',
        () => {
          if (api.clock.get().paused) api.clock.resume();
          else api.clock.pause();
          this.open('main');
        },
        { on: !clock.paused },
      );
      btn(`Speed x${clock.scale}`, () => {
        const steps = [1, 10, 60, 0.25];
        api.clock.scale(steps[(steps.indexOf(api.clock.get().scale) + 1) % steps.length]!);
        this.open('main');
      });
      btn('+1 hour', () => api.time.set({ minutes: getState().time.minutes + 60 }));
      btn(
        api.loop.paused ? 'Run' : 'Freeze',
        () => {
          if (api.loop.paused) api.loop.resume();
          else api.loop.pause();
          this.open('main');
        },
        { on: api.loop.paused },
      );
      btn('Step 1', () => api.loop.step(1));
      btn('Step 10', () => api.loop.step(10));
      btn(
        'Graph',
        () => {
          api.overlay.fps(!this.showFps);
          this.open('main');
        },
        { on: this.showFps, sub: 'fps ms draws' },
      );
      btn(
        'Tiles',
        () => {
          api.overlay.tiles(!this.showTiles);
          this.open('main');
        },
        { on: this.showTiles, sub: 'grid + coords' },
      );
      btn('Next day', () => api.time.skipDays(1), { sub: 'full rollover' });
      this.status = document.createElement('div');
      this.status.className = 'tadev-status';
      sheet.appendChild(this.status);
    } else if (page === 'scenarios') {
      grid.classList.add('one');
      const all = api.scenarios();
      const per = 5;
      const pages = Math.max(1, Math.ceil(all.length / per));
      this.scenarioPage = Math.min(this.scenarioPage, pages - 1);
      title.textContent = `Scenarios ${this.scenarioPage + 1}/${pages}`;
      for (const s of all.slice(this.scenarioPage * per, this.scenarioPage * per + per))
        btn(
          s.name,
          () => {
            this.close();
            void api.load(s.name);
          },
          { sub: s.title },
        );
      const nav = document.createElement('div');
      nav.className = 'tadev-grid';
      nav.style.marginTop = '6px';
      sheet.appendChild(nav);
      btn(
        'Prev',
        () => {
          this.scenarioPage = (this.scenarioPage - 1 + pages) % pages;
          this.open('scenarios');
        },
        { to: nav },
      );
      btn('Back', () => this.open('main'), { to: nav });
      btn(
        'Next',
        () => {
          this.scenarioPage = (this.scenarioPage + 1) % pages;
          this.open('scenarios');
        },
        { to: nav },
      );
    } else {
      title.textContent = 'Go to map (keeps the game)';
      for (const id of Object.keys(mapsData.maps))
        btn(id, () => {
          this.close();
          void api.goto(id);
        });
      // map stages (M2): show a staged map in each of its variants (sets the valley stats that pick it)
      for (const id of Object.keys(mapsData.maps))
        for (const v of mapVariants(id))
          btn(`${id}: ${v}`, () => {
            this.close();
            void api.goto(id).then(() => api.stage(id, v));
          });
      btn('Back', () => this.open('main'));
    }
    document.body.appendChild(sheet);
    this.sheet = sheet;
    this.place();
  }

  close(): void {
    this.sheet?.remove();
    this.sheet = null;
    this.status = null;
  }

  setFps(on: boolean): void {
    this.showFps = on;
    if (on && !this.graph) this.graph = this.overlayCanvas();
    this.graph?.style.setProperty('display', on ? 'block' : 'none');
  }

  setTiles(on: boolean): void {
    this.showTiles = on;
    if (on && !this.grid) this.grid = this.overlayCanvas();
    this.grid?.style.setProperty('display', on ? 'block' : 'none');
  }

  private overlayCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.className = 'tadev-overlay';
    document.body.appendChild(c);
    return c;
  }

  /** Keep the tab and the sheet on the game canvas (it is letterboxed and scaled). */
  private place(): void {
    const g = this.geo();
    if (!g) return;
    if (this.tab) {
      this.tab.style.left = `${g.left + 4}px`;
      this.tab.style.top = `${g.top + 4}px`;
    }
    if (this.sheet) {
      this.sheet.style.left = `${g.left}px`;
      this.sheet.style.width = `${g.width}px`;
    }
  }

  private update(): void {
    this.place();
    if (this.status) {
      const s = getState();
      const st = this.meter.stats();
      this.status.textContent =
        `${seasonLabel(s.time.season)} ${s.time.day} y${s.time.year} ${formatClock(s.time.minutes)} · ` +
        `${s.player.map} · ${st.fps} fps · ${st.jsMs} ms JS · ${st.draws} draws`;
    }
    if (this.showFps) this.drawGraph();
    if (this.showTiles) this.drawGrid();
  }

  /** Frame-time bars (green, red over 20 ms) with the JS part in blue, a 16.7 ms line, and the numbers. */
  private drawGraph(): void {
    const g = this.geo();
    const c = this.graph;
    if (!g || !c) return;
    const W = 124;
    const H = 52;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== W * dpr) {
      c.width = W * dpr;
      c.height = H * dpr;
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;
    }
    c.style.left = `${g.left + g.width - W - 4}px`;
    c.style.top = `${g.top + 4}px`;
    const x = c.getContext('2d');
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(20,16,31,.8)';
    x.fillRect(0, 0, W, H);
    const h = H - 18;
    const scale = h / 33; // full height = 33 ms
    this.meter.gaps.forEach((ms, i) => {
      const bh = Math.min(h, ms * scale);
      x.fillStyle = ms > 20 ? '#e05a4a' : '#74b043';
      x.fillRect(2 + i * 2, H - 2 - bh, 2, bh);
      const js = Math.min(h, (this.meter.js[i] ?? 0) * scale);
      x.fillStyle = '#6fa3e0';
      x.fillRect(2 + i * 2, H - 2 - js, 2, js);
    });
    x.fillStyle = 'rgba(244,204,60,.8)';
    x.fillRect(0, H - 2 - 16.7 * scale, W, 1);
    const st = this.meter.stats();
    x.fillStyle = '#f4ead2';
    x.font = '11px ui-monospace,monospace';
    x.fillText(`${st.fps}fps ${st.jsMs}ms ${st.draws}dc`, 4, 12);
  }

  /** A tile grid over the world view, the player's tile (gold), the last touch's tile (blue), and their numbers. */
  private drawGrid(): void {
    const g = this.geo();
    const c = this.grid;
    if (!g || !c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(g.width * dpr) || c.height !== Math.round(g.height * dpr)) {
      c.width = Math.round(g.width * dpr);
      c.height = Math.round(g.height * dpr);
      c.style.width = `${g.width}px`;
      c.style.height = `${g.height}px`;
    }
    c.style.left = `${g.left}px`;
    c.style.top = `${g.top}px`;
    const x = c.getContext('2d');
    if (!x) return;
    x.setTransform(dpr * g.k, 0, 0, dpr * g.k, 0, 0); // draw in logical px
    x.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const origin = this.api.tileToScreen(0, 0);
    if (!origin) return;
    const T = TILE_SIZE;
    const ox = (((origin.x - T / 2) % T) + T) % T;
    const oy = ((((origin.y - T / 2 - WORLD_VIEW.y) % T) + T) % T) + WORLD_VIEW.y;
    x.save();
    x.beginPath();
    x.rect(WORLD_VIEW.x, WORLD_VIEW.y, WORLD_VIEW.w, WORLD_VIEW.h);
    x.clip();
    x.strokeStyle = 'rgba(255,255,255,.22)';
    x.lineWidth = 1 / g.k;
    x.beginPath();
    for (let px = ox; px < GAME_WIDTH; px += T) {
      x.moveTo(px, WORLD_VIEW.y);
      x.lineTo(px, WORLD_VIEW.y + WORLD_VIEW.h);
    }
    for (let py = oy; py < WORLD_VIEW.y + WORLD_VIEW.h; py += T) {
      x.moveTo(0, py);
      x.lineTo(GAME_WIDTH, py);
    }
    x.stroke();
    const p = getState().player;
    const me = { tx: Math.floor(p.x / T), ty: Math.floor((p.y - 1) / T) };
    const box = (tx: number, ty: number, color: string) => {
      const s = this.api.tileToScreen(tx, ty);
      if (!s) return;
      x.strokeStyle = color;
      x.lineWidth = 1.5 / g.k;
      x.strokeRect(s.x - T / 2, s.y - T / 2, T, T);
    };
    box(me.tx, me.ty, '#f4cc3c');
    if (this.lastTouch) box(this.lastTouch.tx, this.lastTouch.ty, '#6fa3e0');
    x.restore();
    x.fillStyle = 'rgba(20,16,31,.8)';
    x.fillRect(0, WORLD_CLEAR.y + WORLD_CLEAR.h - 11, GAME_WIDTH, 11); // above the floating controls
    x.fillStyle = '#f4ead2';
    x.font = '8px ui-monospace,monospace';
    const t = this.lastTouch;
    x.fillText(
      `${p.map} you ${me.tx},${me.ty} ${p.facing}${t ? `  touch ${t.tx},${t.ty}` : ''}`,
      3,
      WORLD_CLEAR.y + WORLD_CLEAR.h - 3,
    );
  }

  /** Remember the tile under a touch (for the tile overlay). */
  private noteTouch(clientX: number, clientY: number): void {
    const g = this.geo();
    if (!g) return;
    this.lastTouch = this.api.screenToTile((clientX - g.left) / g.k, (clientY - g.top) / g.k);
  }
}
