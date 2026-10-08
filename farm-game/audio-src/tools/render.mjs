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
const SFX = ['till', 'water', 'refill', 'plant', 'harvest', 'cut', 'coin', 'buy', 'ui', 'door', 'stepGrass', 'stepWood', 'error', 'sleep', 'goal', 'swing', 'select', 'level', 'heart', 'order', 'tick', 'target', 'ringOpen', 'ringClose', 'confirm'];

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
