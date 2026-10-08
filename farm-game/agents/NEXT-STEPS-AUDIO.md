# Audio (R4.2): state and next steps

Branch `audio/real-audio`. Last commits: `f9c0aae` (licence + loudness + held repeats), `f2397cc` (thunder,
ducking), `9303729` (legato pads, jingles, residency), `8ee191f` (first working version). `npm run verify` green
at `f9c0aae` (359 unit tests, e2e, mobile e2e, perf). **Nobody has listened to any of it**, by ear or on a phone.

## What is done

- **Engine** (`src/platform/audio.ts`, same public API as before): one AudioContext (Phaser audio is off), the
  same unlock / interruption / lifecycle / volume / mute behaviour, one shared graph (`src/audio/graph.ts`).
- **Sound effects** (`src/audio/sfx.ts`): 15 cues from recorded CC0 takes (2-4 takes each), pitch and volume
  spread, never the same take twice in a row, per-cue voice cap, repeats within 350 ms 4 dB softer (held tools).
  5 cues (level, goal, sleep, heart, order) are in-key jingles played on the music samples, with the music
  ducked 6 dB under them.
- **Music** (`src/audio/music.ts`, `sequencer.ts`, data in `src/audio/music.json` from
  `audio-src/tools/music_src.py`): composed pieces played live on 94 CC0 instrument samples; four seasons with
  day and night arrangements on one bar clock (crossfaded by the clock), title, mine, festival; house = the
  season piece without percussion; pieces resume where they left off.
- **Ambience** (`src/audio/ambience.ts`, chosen in `src/audio/director.ts`): rain bed, birds (scattered
  one-shots), crickets (two loops of different lengths), winter/storm wind, thunder in storms, mine cave bed
  and drips.
- **Fallback**: any missing or undecodable file plays the original synth (per cue, per note, per piece, and
  the noise rain bed). Unit-tested with a fake Web Audio (`tests/fakeAudio.ts`).
- **Loading**: bytes fetched after the first frame (through the service worker's cache on a first visit),
  decoded at the unlock tap (sfx and jingle instruments first); decoded samples not needed by the current or
  home season are dropped after 2 minutes. Peak decoded memory measured 23-27 MB per scene.
- **Payload**: 2.0 MB (`public/assets/audio/`: inst 1.3 MB, sfx 0.2 MB, amb 0.5 MB), mono MP3.
- **Tools** (`audio-src/tools/`): `fetch.py` (sources with sha1 lock), `build.py` (trim, loops, loudness,
  pitch check, report), `render.mjs` + `measure.py` (offline renders of the real engine and their loudness),
  `sources_md.py`. Per-file data: `audio-src/prep-report.md`, `audio-src/SOURCES.md`, credits in `ASSETS.md`.

## Coverage

- Sound effect ids with real audio: **20 / 20** (15 recorded, 5 sampled jingles), synth fallback for all 20.
- Music slots with real audio: **12 / 12** views: spring, summer, fall, winter x day/night (8), title, house
  (season piece indoors), mine, festival. Synth music remains the fallback for each.
- Ambience: rain, birds, crickets, wind, thunder, cave, drips (rain also has the synth fallback).

## Open critic findings (round 2) and planned fixes

Critic notes and renders: `C:/Users/andre/dev/tiny-acre/audio-critique/` (`review-2.md`, `round-2/renders/`).
Fixed at `f9c0aae`: the drips licence blocker (replaced by drips from the CC0 dungeon ambience), the Ted Kerr
credit, the eviction bug (status checks no longer refresh use times; test added), cricket repetition (two
loops of 9 s and 7.2 s), loudness scale (now K-weighted max momentary by role, see `prep-report.md`), held
repeats (ducked repeats, water one voice), ui-3 fade, buy-2 true peak (now checked after MP3 encoding),
string attack lag (zones carry a measured `lag`; notes start early), compressor make-up gain (documented).
The pad dip got an overlap fix at `9303729` (dip went from -4..-6 dB to about -2..-3 dB in my measurement);
the critic has not re-measured yet. **Re-render everything at `f9c0aae` before believing any number.**

| Severity | Finding | State / planned fix |
|---|---|---|
| Major | Seasons share one harmony (spring/summer/title/festival I-vi-IV-V with the same cadence; summer = spring a tone up; fall and winter both i-VI-iv-V) | **Open.** Rewrite in `music_src.py`: summer in D with I-II / I-bVII colour and tonic pedals; fall aeolian i-bVII-bVI-V; winter suspensions over a D pedal; a title hook of its own. Each needs new phrases written against the new chords (rule used so far: chord tones on strong beats, passing/neighbour tones between, cadence on the tonic). Tests catch bar lengths and sample ranges, not musical quality. |
| Major | Effects loudness on the wrong scale | Fixed in files at `f9c0aae`; **not yet re-measured at the output**. Check: run `render.mjs`, then `measure.py`; harvest/coin/buy should read about -18 max momentary, tools -20, swing/plant -22, ui -25, steps -28. Harvest came out -19 (limited); maybe give it a softer limiter or a different pop take. Jingles target -19: currently about -21 (raise the 0.9 factor in `MusicPlayer.jingle`). |
| Major | Held-button stacking (16 waters at 0.2 s = -14.6 LUFS) | Fixed in code (repeat duck -4 dB, water single voice); **prove it** with a rapid-repeat render (`cues` with 16 waters 0.2 s apart in `render.mjs`) and compare with the critic's `water-rapid.wav`. |
| Major | Winter night pad dip at bar lines (median -3.2 dB) | Overlap fix in place; re-measure against the critic's bar: median dip < 1.5 dB, < 10% of bars over 3 dB. If not met: longer overlap (attack + 0.3 s) or a slower release for viola/cello. |
| Major | Eviction bug | Fixed + test. Also verify in a render: farm, mine 60 s, farm: no wait at the return. |
| Minor | Crickets repeat at 9 s | Two layers now; re-render 60 s and check the repeat is gone to the ear-proxy (critic's burst detector). |
| Minor | SW cache version is global, so every release re-downloads 2 MB of audio | **Open.** In `scripts/sw-plugin.mjs`, put `assets/audio/*` in a separate cache named by a hash of the audio file names and sizes; install only adds missing files; activate keeps the current audio cache. |
| Minor | Perf "holding Action" logs only 3 sfx | **Open.** Find why held Action plays so few sounds in that scene (probably the hoe on planted tiles fails silently); make the perf scene water a row instead, and assert `sfx.played >= 20` in `scripts/perf.mjs`. |
| Minor | ROADMAP claimed done | Now `[~]` partial. |
| Nit | ui-1 is 2 dB under its target (true-peak limited) | Swap the take or limit it. |
| Nit | Birds one-shots read -18..-24 max momentary in the file (about -23..-29 at the output at full intensity) | Probably fine as foreground birdsong but may sit above the music; listen, and lower `birds.level` if so. |

## What the owner should listen to first (on a phone speaker and on headphones)

1. A New Game on the farm in spring, daytime, walking and using the hoe, can and scythe: sound effects against
   music. Critic renders: `audio-critique/round-2/renders/long-spring-day.wav`, `water-rapid.wav`,
   `steps-rapid.wav`; or run `node audio-src/tools/render.mjs <dir>` (dev server on 5176) and listen to
   `mix-farm-work.wav`.
2. The title screen music (`music-title.wav`): first impression.
3. Each season by day and by night (`music-<season>-day/night.wav`; critic's `long-*.wav`): do the melodies
   sound composed and pleasant, is anything out of tune (pitch was measured per sample, but nobody heard it),
   do the pads swell or click at bar lines (winter night)?
4. Footsteps (grass uses crunchy snow footsteps from Kenney; wood uses Kenney RPG boots): right material?
5. Rain, crickets, birds, thunder, mine (`amb-*.wav`): loops audible? birds too loud?
6. The jingles: level up, goal, heart, order, sleep.

Decide: keep the composed-sampler approach or commission music; palette per season (recorder, ocarina,
marimba, harp, piano, glock); whether footsteps need different recordings.

## Next steps, in order

1. Re-render at `f9c0aae` (`render.mjs` + `measure.py`), add a rapid-water and a farm-mine-farm job, and
   confirm the fixes above with numbers; send them to the critic.
2. Season harmonies (the open major): rewrite summer, fall, winter and title sections and phrases in
   `audio-src/tools/music_src.py`, run it, `npx vitest run tests/audio-music.test.ts`, render, check levels
   (per-piece `level`/`nightLevel` may need retuning to keep day near -25 and night near -28 LUFS).
3. Jingle loudness to about -19 (output momentary).
4. Separate audio cache in the service worker; perf scene that really plays sfx plus a minimum-count assert.
5. Human listening pass on a real iPhone and Android phone (also: unlock on first tap, phone call
   interruption, silent switch on iOS web vs app, Bluetooth latency of footsteps).
6. Optional: indoor ambience (house clock or fire), woods-specific ambience, more takes for coin/harvest,
   2-3 more phrases per section to stretch the time before a melody repeats.

How to run things (Windows/Git Bash): raw sources live outside the repo, e.g. `C:/Users/andre/dev/tiny-acre/
audio-raw/samples` (re-download with `python -I audio-src/tools/fetch.py <dir>`, sha1-checked). Rebuild all
audio with `python -I audio-src/tools/build.py <dir>` (about 90 s), then `python -I audio-src/tools/sources_md.py`.
`npm run verify` with `CHROMIUM_PATH` set; use `E2E_PORT`, `E2E_MOBILE_PORT`, `PERF_PORT` when another checkout
is running its own checks.
