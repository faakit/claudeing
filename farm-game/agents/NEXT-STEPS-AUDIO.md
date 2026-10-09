# Audio (R4.2, round 2): state and next steps

Branch `audio/round2` (from `integration/agents-2026-10-08`).

Round-2 commits:
- `716dbc7`: season harmonies, crickets, sfx calibration, touch cues.
- `f633de0`: service-worker audio cache, perf storm scene.
- `182ac74`: critic R5 fixes.
- `6e935be`: title sting, festival trio, mine deep section, R6 fixes.
- `1127690`: sfx peaks capped at the source (R7), plus decisions.

`npm run verify` is green at `892183c`: 484 unit tests, e2e, mobile e2e and perf. **Nobody has listened to any of it**, by
ear or on a phone. Every judgement so far comes from measuring offline renders of the real engine.

## What is done (round 1, still true)

- **Engine:** one AudioContext, the shared graph in `src/audio/graph.ts`, and the same public API in `src/platform/audio.ts`.
- **Sound effects:** recorded CC0 takes with pitch and volume spread and voice caps. Repeats within 350 ms are
  ducked. Five event jingles play on the music samples.
- **Music:** composed pieces played live on 94 CC0 instrument samples. Each season has a day and a night
  arrangement on one bar clock, plus title, mine and festival.
- **Ambience:** rain, birds, crickets, wind, thunder, cave and drips.
- **Synth fallback:** used per cue, per note and per piece.
- **Loading:** files are fetched after the first frame and decoded at the unlock tap; unused seasons are evicted.
- **Tools:** in `audio-src/tools/`. Per-file data is in `audio-src/prep-report.md` and `SOURCES.md`; credits are in `ASSETS.md`.

## Round 2

**Each piece has its own harmony and melody** (critic F20, resolved), written in `audio-src/tools/music_src.py`.

| piece    | key, tempo         | harmony and cadence                                                                                                        | melody and texture                                                                                        |
| -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| spring   | C major, 74, 4/4   | I-vi-IV-V, ii7-V7-I (unchanged reference)                                                                                  | recorder, steps and thirds on the beat; harp arpeggios                                                    |
| summer   | D mixolydian, 92   | tonic pedal (D, C/D, G/D), no V, bVII-I; the bridge borrows from D minor (Fmaj7 C/E Bbmaj7 C), so it returns as bVI-bVII-I | syncopated ocarina (33% off-beat), higher; marimba and pizz in a 3+3+2 tresillo                           |
| fall     | E minor, 70        | Andalusian i-bVII-bVI-V, dorian IV, aeolian bVI-bVII-i, Neapolitan bII in the bridge                                       | slow stepwise viola (24% leaps), harp triplets, bowed cello, no percussion; the cello takes the night tune |
| winter   | D minor, 56, 3/4   | A over a D pedal (Dm, Bbmaj7/D, Gm/D, Dsus2), suspension cadence Gm/D-Dsus4-Dm, no leading tone; the bridge ends on Asus4  | sparse glock with appoggiaturas; four-note pads                                                           |
| title    | Eb major, 76       | sting intro, a fixed hook over I-iii7-IVmaj7-V, then borrowing from Eb minor (Cbmaj7, Gb, Cb) and a minor plagal iv6-I     | low, syncopated piano; hook doubled on the glock                                                          |
| festival | G major, 112 swung | ragtime I-VI7-ii7-V7 with a II7-V7-I cadence, a Cm6 bridge, and a trio in E minor                                          | recorder with chromatic notes; stride piano over an oom-pah bass                                          |
| mine     | A minor, 60        | drone, plus a deep section D (phrygian Bb/A)                                                                               | vibes, marimba ostinato (silent in D)                                                                     |

**Measurements.** `python -I audio-src/tools/seasons.py [--renders DIR]` prints these numbers, and the tests in `tests/audio-music.test.ts` enforce most of them:
- Data checks:
  - Every piece has its own A progression and its own cadence.
  - Chord-bigram Jaccard is at most 0.32.
  - Melody 3-gram overlap is at most 22%.
  - Each pair of seasons differs in at least two of: density, register, leaps, range, syncopation.
  - Every on-beat melody note is a chord tone or resolves by step.
- Renders, transposition-invariant bar-chroma similarity:
  - Every day pair is 0.91 or lower. Spring-summer went from 0.955 to 0.910, and fall-winter from 0.953 to 0.870.
  - Night pairs are 0.915 or lower.
- Estimated keys match the declared key, except summer, which reads as G major: D mixolydian is G's scale, and the critic accepted this.
- Levels: day -24.7 to -25.6 LUFS, night -27.4 to -28.8. Mine music reads -28.9 on purpose: a step down into the cave, decided in DECISIONS.md. Do not go below about -30.

**Other round-2 changes:**
- **Crickets:** loops of 9 s and 7.333 s, which realign every 198 s (was 36 s).
- **Sound-effect levels:** each recipe has a `trim` (dB), calibrated with `sfxlevels.py`: the median of 16 hits, K-weighted max momentary. Every cue is within about 1 dB of its role target at the output: rewards -18, tools -20, light -22, ui -25, steps -28, jingles -19. The heart jingle is -19.3, and the ui first take is replaced.
- **Brick wall:** a soft clipper after the compressor: knee -3 dBFS, ceiling -1.4 dBFS, 2x oversampling. With every slider at maximum, festival, rain and 60 loud effects, the peak is -1.0 dBTP. Music mixes peak at -6 dBTP or lower.
- **Sound-effect peaks are capped at the source** (`sfx_tp_ceiling` in `build.py`): a cue's worst take, with its trim, volume spread and the compressor's +1.71 dB make-up gain, peaks at or under -3.5 dBTP at the default volume. A test checks it (it is the `tp` field in the manifest). Single cues now peak at -4.3 to -8.9 dBFS at the output, so the clipper never shapes everyday sounds.
- **Service worker:** audio has its own cache, `tiny-acre-audio`, with one entry per file version (path plus content hash). A release downloads only the files that changed. `tests/audio-sw.test.ts` covers it.
- **Perf:** a "20 sound effects a second" scene asserts that at least 20 cues play from files; about 99-110 do.
- **Touch cues** for the one-thumb controls: `tick`, `target`, `ringOpen`, `ringClose` and `confirm`.
  - They are Kenney CC0 recordings, 75 ms or shorter, about -28 at the output, and repeats are 8 dB softer.
  - tick and target play at most one per 70 ms, and tick masks footsteps for 80 ms.
  - Each has a synth fallback.
  - They are documented in `docs/EXTENDING.md` with a haptics policy.
  - **They are not wired**: the controls branch owns the call sites.
- **Payload:** 1.75 MB of mono MP3 (instruments 1.08, sfx 0.18, ambience 0.49), up 23 KB from round 1.

## Round 2, part 3 (the coordinator's second list; `c6c9181`, `892183c` and later)

- **Villager motifs:** Mara, Finn, Rosa, Orin, and Clay (cheeky and chromatic).
  - Each has a "-heart" version.
  - Stored in `music.json` "stings".
  - `audio.motif(id)` plays on the first `talkTo` per villager per day. `heartUp` plays the heart version after the heart jingle.
  - Level: -21 to -23 max momentary, with a 4 dB music dip.
  - The lead moves to a light instrument the playing piece is not using.
- **Weather:**
  - Rain or storm: no percussion, accompaniment on the main beats only, melodies rest more, and the piece plays 2.5 dB down.
  - The music ducks 6 dB under each thunderclap.
  - The rain bed is now 2 dB lower.
- **Dawn and dusk:** three variants each (`MomentClock`), on the first day of each week only. Dawn plays the first time you are outdoors that morning; dusk plays when the evening turns while you are outdoors.
- **Interiors:**
  - While the shop is open (after 1.5 s; `PanelTracker`), a light F-major shop piece plays. Under it: creaks and pages, a generated forge, the anvil from the smithy next door, and a wall clock.
  - The house at night plays a near-silent lullaby (-30.5 LUFS) with the ticking clock. The clock also ticks softly in the house by day.
  - `gen_beds.py` makes the clock (from CC0 ticks) and the forge (from noise).
- **Moments:**
  - Season-change sting under the sleep screen, in the new season's key.
  - Festival openers, one per season.
  - A `special` fanfare (new `Sfx` id) after a special order is delivered in full. It has jingle priority 2: it cuts or drops an `order` jingle within 1 s of it, in either order.
- **Chord-aware jingles:** held notes (a beat or more) of every jingle and sting move off any semitone clash with the chord under them (`fitToChord`, which follows the coming bars). A test covers every chord of every piece.
- **Year two:** each season's `form2` is A A2 B A2 R. The A2 sections are reharmonised and have their own day and night phrases. They read -24.6 to -25.3 LUFS.
- **Mix:** `select` +1.5 dB, rain bed -2 dB.
- **Renders and listening order:** `audio-renders/round2/r3/LISTEN.md`.

## Open

- Nits from the critic:
  - Select, at -26.6, sits about 1.5 dB under its ui target.
  - Each sfx hit creates its own nodes. The 20-sfx/s perf scene is fine in headless Chrome (141.6 fps at 6x); pool gain nodes per cue only if phones show a cost.
- The "holding Action" perf scene still plays only 3 sfx, because the hoe fails on planted tiles. The storm scene covers the sfx path.
- The touch cues need wiring in the controls code:
  - `tick` per painted tile
  - `target` when a walk target is set
  - `ringOpen` / `ringClose`
  - `confirm` when a tool is picked or a row is committed
- Render speed is now 30-40x realtime (the soft clipper costs about 10%).
- The year-two spring vs summer bar-chroma similarity is 0.922, 0.002 over the critic's 0.92 line, inside the run-to-run noise, and the critic accepted it. If you touch spring A2 again, its E7-A7 secondary dominants are the place to separate it from summer.
- The motifs, shop, lullaby, dawn/dusk and season stings have not been heard in game. Their triggers (talkTo, heartUp, the shop panel, the house at night, daySummary) are unit-tested, but nobody has checked them on a phone.

## What the owner should listen to first

The order and file names are in `C:/Users/andre/dev/tiny-acre/audio-renders/round2/LISTEN.md`. It covers:
- the four seasons by day;
- the title, including the sting;
- the festival, including the trio;
- the mine;
- the nights;
- the touch cues at 10 taps a second;
- single effects, crickets, farm work, the drag-row render and the stress render.

The decisions it informs:
- Keep the composed-sampler approach, or commission music?
- Is summer's mixolydian bridge welcome, or too far from home?
- Are the touch cues audible enough?

## Next steps, in order

1. A human listening pass on a real iPhone and an Android phone. Also check:
   - unlock on the first tap;
   - resuming after a phone call;
   - the iOS silent switch;
   - footstep latency over Bluetooth.
2. Wire the touch cues once the controls branch merges, then render a real drag and tap session.
3. Optional: indoor ambience (house clock or fire), woods ambience, more takes for coin and harvest, and
   more phrases per section to stretch the time before a melody repeats.

## How to run things

All commands are for Windows with Git Bash.

- **Raw sources:** they live outside the repo, in `C:/Users/andre/dev/tiny-acre/audio-raw/samples`. Re-download them with `python -I audio-src/tools/fetch.py <dir>`, which checks each sha1.
- **Rebuild:** `python -I audio-src/tools/build.py <dir>` takes about 60 s and is deterministic. Then run `python -I audio-src/tools/sources_md.py`.
- **Music:** `python -I audio-src/tools/music_src.py` writes `src/audio/music.json`.
- **Renders:** `node audio-src/tools/render.mjs <out> http://localhost:5176/?debug [filter]`, with the dev server running. Then measure with:
  - `measure.py <out>`
  - `sfxlevels.py <out>`
  - `seasons.py --renders <out>`
