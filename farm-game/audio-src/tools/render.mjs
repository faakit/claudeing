// Render the game's real audio mix offline in headless Chromium and save WAVs for analysis.
// Nobody can listen while building this game's audio, so these renders are how the mix is measured.
//
// Usage: node audio-src/tools/render.mjs OUT_DIR [URL] [job-filter]
//   URL defaults to http://localhost:5176/?debug (a running `vite` dev server or `vite preview`).
// Needs CHROMIUM_PATH (like scripts/e2e.mjs). Each job calls audio.renderOffline() in the page,
// which runs the same graph, sampler, music, sfx and ambience code as the live engine.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? 'renders';
const URL_ = process.argv[3] ?? 'http://localhost:5176/?debug';
const FILTER = process.argv[4] ?? '';
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const SFX = ['till', 'water', 'refill', 'plant', 'harvest', 'cut', 'coin', 'buy', 'ui', 'door', 'stepGrass', 'stepWood', 'error', 'sleep', 'goal', 'swing', 'select', 'level', 'heart', 'order', 'tick', 'target', 'ringOpen', 'ringClose', 'confirm', 'special', 'green', 'dig', 'logLand', 'logKnock'];

const jobs = [];
for (const s of SEASONS) {
  jobs.push({ name: `music-${s}-day`, o: { seconds: 60, slot: s, night: 0 } });
  jobs.push({ name: `music-${s}-night`, o: { seconds: 60, slot: s, night: 1 } });
}
// Long renders for the season comparison (audio-src/tools/seasons.py --renders) and for listening.
for (const s of SEASONS) {
  jobs.push({ name: `long-${s}-day`, o: { seconds: 240, slot: s, night: 0 } });
  jobs.push({ name: `long-${s}-night`, o: { seconds: 240, slot: s, night: 1 } });
}
for (const s of ['title', 'festival', 'mine']) jobs.push({ name: `long-${s}`, o: { seconds: 240, slot: s } });
// Held tools and the crickets' combined loop period (two layers, 9 s and 7.333 s: 198 s).
jobs.push({ name: 'water-rapid', o: { seconds: 5, cues: Array.from({ length: 16 }, (_, i) => ({ cue: 'water', at: 0.2 + i * 0.2 })) } });
// The critic's fatigue test for the one-thumb cues: ten taps a second for 5 s over spring music.
for (const c of ['tick', 'target', 'ringOpen', 'ringClose', 'confirm', 'ui'])
  jobs.push({ name: `tap-rapid-${c}`, o: { seconds: 6, slot: 'spring', cues: Array.from({ length: 50 }, (_, i) => ({ cue: c, at: 0.5 + i * 0.1 })) } });
for (const c of ['tick', 'target', 'ringOpen', 'ringClose', 'confirm'])
  jobs.push({ name: `tap-dry-${c}`, o: { seconds: 6, cues: Array.from({ length: 50 }, (_, i) => ({ cue: c, at: 0.5 + i * 0.1 })) } });
// A row painted by dragging: 15 tiles a second over spring music, with footsteps every 0.28 s.
jobs.push({
  name: 'drag-row-15',
  o: {
    seconds: 6,
    slot: 'spring',
    cues: [
      ...Array.from({ length: 60 }, (_, i) => ({ cue: 'tick', at: 1 + i / 15 })),
      ...Array.from({ length: 15 }, (_, i) => ({ cue: 'stepGrass', at: 1.01 + i * 0.28 })),
      { cue: 'confirm', at: 5.1 },
    ],
  },
});
// Stress: every slider at maximum, festival music, rain, 60 loud effects in 10 s. Must not clip.
jobs.push({
  name: 'stress-max',
  o: {
    seconds: 12,
    slot: 'festival',
    music: 1,
    sfx: 1,
    ambience: { rain: 1 },
    cues: Array.from({ length: 60 }, (_, i) => ({ cue: ['coin', 'harvest', 'buy', 'till', 'water', 'cut'][i % 6], at: 0.5 + i / 6 })),
  },
});
jobs.push({ name: 'tap-rapid-mix', o: { seconds: 6, slot: 'spring', cues: Array.from({ length: 50 }, (_, i) => ({ cue: ['target', 'tick', 'tick', 'tick', 'confirm'][i % 5], at: 0.5 + i * 0.1 })) } });
jobs.push({ name: 'crickets-long', o: { seconds: 420, ambience: { crickets: 1 } } });
// Musical moments over the music they will meet in game (cue at 1 s; the rest is context).
const NPCS = ['mara', 'finn', 'rosa', 'orin', 'clay'];
for (const n of NPCS)
  for (const v of ['', '-heart'])
    jobs.push({ name: `moment-motif-${n}${v}`, o: { seconds: 7, slot: 'spring', cues: [{ cue: `motif-${n}${v}`, at: 1, lead: true }] } });
for (const c of ['dawn-1', 'dawn-2', 'dawn-3', 'dusk-1', 'dusk-2', 'dusk-3']) jobs.push({ name: `moment-${c}`, o: { seconds: 7, slot: 'summer', night: 0.5, cues: [{ cue: c, at: 1 }] } });
for (const s of SEASONS) {
  jobs.push({ name: `moment-season-${s}`, o: { seconds: 7, slot: s, cues: [{ cue: `season-${s}`, at: 1 }] } });
  jobs.push({ name: `moment-open-${s}`, o: { seconds: 8, slot: 'festival', cues: [{ cue: `open-${s}`, at: 0.3 }] } });
}
// The same moments alone (no music), for their own loudness. Stings play in C here.
for (const c of [...NPCS.flatMap((n) => [`motif-${n}`, `motif-${n}-heart`]), 'dawn-1', 'dawn-2', 'dawn-3', 'dusk-1', 'dusk-2', 'dusk-3', ...SEASONS.flatMap((s) => [`season-${s}`, `open-${s}`])])
  jobs.push({ name: `sting-${c}`, o: { seconds: 5, cues: [{ cue: c, at: 0.2 }] } });
jobs.push({ name: 'moment-special', o: { seconds: 6, slot: 'spring', cues: [{ cue: 'order', at: 1 }, { cue: 'special', at: 1.25 }] } });
jobs.push({ name: 'moment-special-first', o: { seconds: 6, slot: 'spring', cues: [{ cue: 'special', at: 1 }, { cue: 'order', at: 1.1 }] } });
// Weather, interiors and year two.
for (const s of SEASONS) jobs.push({ name: `rain-${s}-day`, o: { seconds: 120, slot: s, rain: true, ambience: { rain: 1 } } });
jobs.push({ name: 'storm-summer', o: { seconds: 90, slot: 'summer', rain: true, ambience: { rain: 1, thunder: 1, wind: 0.8 } } });
jobs.push({ name: 'shop', o: { seconds: 120, slot: 'shop', indoor: true, ambience: { shop: 0.8, forge: 0.7, anvil: 0.5, clock: 0.4 } } });
jobs.push({ name: 'shop-music', o: { seconds: 60, slot: 'shop', indoor: true } });
jobs.push({ name: 'house-night', o: { seconds: 120, slot: 'lullaby', indoor: true, night: 1, ambience: { clock: 0.9 } } });
jobs.push({ name: 'lullaby-music', o: { seconds: 60, slot: 'lullaby', indoor: true, night: 1 } });
jobs.push({ name: 'amb-clock', o: { seconds: 30, ambience: { clock: 1 } } });
jobs.push({ name: 'amb-smithy', o: { seconds: 30, ambience: { forge: 1, anvil: 1 } } });
for (const s of SEASONS) jobs.push({ name: `year2-${s}-day`, o: { seconds: 240, slot: s, year: 2 } });
jobs.push({ name: 'music-spring-indoor', o: { seconds: 40, slot: 'spring', indoor: true } });
for (const s of ['title', 'mine', 'festival']) jobs.push({ name: `music-${s}`, o: { seconds: 60, slot: s } });
for (const c of SFX) jobs.push({ name: `sfx-${c}`, o: { seconds: 2.5, cues: [{ cue: c, at: 0.2 }] } });
// Sixteen hits of each cue, 1.2 s apart (no repeat duck), for per-take output loudness (sfxlevels.py).
for (const c of SFX)
  jobs.push({ name: `hits-${c}`, o: { seconds: 20, cues: Array.from({ length: 16 }, (_, i) => ({ cue: c, at: 0.2 + i * 1.2 })) } });
jobs.push({ name: 'amb-rain', o: { seconds: 20, ambience: { rain: 1 } } });
jobs.push({ name: 'amb-birds', o: { seconds: 30, ambience: { birds: 1 } } });
jobs.push({ name: 'amb-crickets', o: { seconds: 20, ambience: { crickets: 1 } } });
jobs.push({ name: 'amb-wind', o: { seconds: 20, ambience: { wind: 0.9 } } });
jobs.push({ name: 'amb-mine', o: { seconds: 20, ambience: { cave: 1, drips: 1 } } });
// The day/night crossfade midpoint and a full scene: spring day music + birds + steps and tools.
jobs.push({ name: 'mix-spring-dusk', o: { seconds: 30, slot: 'spring', night: 0.5, ambience: { birds: 0.3, crickets: 0.3 } } });
jobs.push({
  name: 'mix-farm-work',
  o: {
    seconds: 30,
    slot: 'spring',
    ambience: { birds: 1 },
    cues: Array.from({ length: 24 }, (_, i) => ({ cue: ['till', 'water', 'stepGrass', 'stepGrass', 'harvest', 'coin'][i % 6], at: 1 + i * 1.1 })),
  },
});

// ---- The Dry Year (dy-*): thinned pieces on dry stages, the first green, water beds, dig and log cues.
const DRY = { wind: 0.6, birds: 0.15 };
for (const s of SEASONS) {
  jobs.push({ name: `dy-thin-${s}-day`, o: { seconds: 60, slot: s, thin: true } });
  jobs.push({ name: `dy-thin-${s}-night`, o: { seconds: 60, slot: s, night: 1, thin: true } });
  jobs.push({ name: `dy-thin-rain-${s}-day`, o: { seconds: 60, slot: s, thin: true, rain: true } });
  // the dry farm as heard: thinned piece over the dry wind, a bird now and then
  jobs.push({ name: `dy-dryfarm-${s}`, o: { seconds: 60, slot: s, thin: true, ambience: s === 'winter' ? { wind: 0.5 } : DRY } });
  // the first green: the jingle over the thinned piece, then the reveal ends (3.4 s): full piece, birds back
  jobs.push({
    name: `dy-green-${s}`,
    o: {
      seconds: 16,
      slot: s,
      thin: true,
      ambience: s === 'winter' ? { wind: 0.5 } : DRY,
      cues: [{ cue: 'green', at: 3 }],
      changes: [{ at: 6.4, thin: false, ambience: s === 'winter' ? {} : { wind: 0, birds: 1 } }],
    },
  });
}
jobs.push({ name: 'dy-green-fullpiece', o: { seconds: 10, slot: 'spring', cues: [{ cue: 'green', at: 2 }] } });
jobs.push({ name: 'dy-dryfarm-rain', o: { seconds: 60, slot: 'spring', thin: true, rain: true, ambience: { rain: 1 } } });
// collisions the same morning: a level-up or goal within a second gives way to the green jingle
jobs.push({ name: 'dy-green-vs-level', o: { seconds: 8, slot: 'spring', thin: true, cues: [{ cue: 'green', at: 1 }, { cue: 'level', at: 1.5 }] } });
jobs.push({ name: 'dy-green-vs-goal-first', o: { seconds: 8, slot: 'spring', thin: true, cues: [{ cue: 'goal', at: 1 }, { cue: 'green', at: 1.3 }] } });
jobs.push({ name: 'dy-green-season-sting', o: { seconds: 10, slot: 'summer', thin: true, cues: [{ cue: 'season-summer', at: 1 }, { cue: 'green', at: 4.5 }] } });
jobs.push({ name: 'sting-green', o: { seconds: 5, cues: [{ cue: 'green', at: 0.2 }] } });
// water beds alone, long (loop repeats), and in their scenes
jobs.push({ name: 'dy-creek-long', o: { seconds: 150, ambience: { creek: 1, burble: 1 } } });
jobs.push({ name: 'dy-creek-bed-long', o: { seconds: 150, ambience: { creek: 1 } } });
jobs.push({ name: 'dy-river-long', o: { seconds: 150, ambience: { river: 1 } } });
jobs.push({ name: 'dy-wind-long', o: { seconds: 200, ambience: { wind: 0.6 } } });
jobs.push({ name: 'dy-trickle', o: { seconds: 30, ambience: { creek: 0.35, burble: 0.35 } } });
jobs.push({ name: 'dy-creek-house', o: { seconds: 30, slot: 'spring', ambience: { birds: 1, creek: 0.25, burble: 0.25 } } });
jobs.push({ name: 'dy-farm-creek', o: { seconds: 60, slot: 'spring', ambience: { birds: 1, creek: 1, burble: 1 } } });
jobs.push({ name: 'dy-wendhead', o: { seconds: 60, slot: 'spring', ambience: { birds: 1, creek: 1, burble: 1 } } });
jobs.push({ name: 'dy-town-river', o: { seconds: 60, slot: 'summer', ambience: { birds: 1, river: 1 } } });
jobs.push({ name: 'dy-storm-creek', o: { seconds: 90, slot: 'summer', rain: true, ambience: { rain: 1, thunder: 1, wind: 0.8, creek: 0.4, burble: 0.4 } } });
jobs.push({
  name: 'dy-water-over-creek',
  o: { seconds: 20, ambience: { creek: 1, burble: 1 }, cues: Array.from({ length: 16 }, (_, i) => ({ cue: 'water', at: 0.2 + i * 1.2 })) },
});
// A painted channel as the game plays it (measured in channels-first-dig: a cut every 0.451 s, a footstep 56 ms
// before each, the water with each cut that meets running water; the posed farmer plays no swing).
const DIG_GAP = Number(process.env.DIG_GAP ?? 0.451);
const row = (cue, wet) =>
  Array.from({ length: 24 }, (_, i) => [
    { cue: 'stepGrass', at: 0.444 + i * DIG_GAP },
    { cue, at: 0.5 + i * DIG_GAP },
    ...(wet ? [{ cue: 'water', at: 0.5 + i * DIG_GAP }] : []),
  ]).flat();
const ROW_S = 0.5 + 24 * DIG_GAP + 1;
jobs.push({ name: 'dy-dig-row', o: { seconds: ROW_S, slot: 'spring', cues: row('dig', false) } });
jobs.push({ name: 'dy-dig-row-wet', o: { seconds: ROW_S, slot: 'spring', cues: row('dig', true) } });
jobs.push({ name: 'dy-dig-row-alone', o: { seconds: ROW_S, cues: row('dig', false) } });
// the same row tilled (the accepted painted-row level the dig row is held to)
jobs.push({ name: 'dy-till-row-alone', o: { seconds: ROW_S, cues: row('till', false) } });
jobs.push({ name: 'dy-till-row', o: { seconds: ROW_S, slot: 'spring', cues: row('till', false) } });
jobs.push({ name: 'dy-dig-vs-till', o: { seconds: 8, cues: [0, 1, 2, 3].flatMap((i) => [{ cue: 'till', at: 0.3 + i * 0.9 }, { cue: 'dig', at: 4.2 + i * 0.9 }]) } });
// the log landing over the music it will meet (summer by the river), and a snag knock
jobs.push({ name: 'dy-log-land', o: { seconds: 8, slot: 'summer', ambience: { river: 1 }, cues: [{ cue: 'logKnock', at: 1 }, { cue: 'logKnock', at: 2.2 }, { cue: 'logLand', at: 4 }] } });

function wav(path, pcmB64, sr) {
  const data = Buffer.from(pcmB64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL_);
await page.waitForFunction(() => window.__farm?.audio, null, { timeout: 30000 });
const summary = [];
for (const j of jobs) {
  if (FILTER && !j.name.includes(FILTER)) continue;
  const res = await page.evaluate((o) => window.__farm.audio.renderOffline(o), j.o);
  wav(join(OUT, `${j.name}.wav`), res.pcm16, res.sampleRate);
  summary.push({ name: j.name, realtimeRatio: Math.round(res.realtimeRatio * 10) / 10, stats: res.stats });
  console.log(`${j.name}: ${res.realtimeRatio.toFixed(1)}x realtime ${JSON.stringify(res.stats.music)}`);
}
writeFileSync(join(OUT, 'renders.json'), JSON.stringify(summary, null, 1));
await browser.close();
if (errors.length) {
  console.log('console errors:', errors.join(' | '));
  process.exit(1);
}
