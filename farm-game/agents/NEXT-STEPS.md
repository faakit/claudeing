# Next steps (round 4, 2026-10-11)

Five agents worked in parallel this round (three with a critic). This branch (`integration/round4-2026-10-11`)
merges all of them on top of round 3 (`integration/round3-2026-10-10`). Start a new session from here.

**How to work now (new this round):** every feature is built scenario-first. Read
[NEXT-STEPS-DEVTOOLS.md](NEXT-STEPS-DEVTOOLS.md) and `docs/EXTENDING.md` section 0 before starting: add the
scenario(s) that stage the feature (`?scenario=<name>`, or the debug-only lab map), develop by opening them, ship
e2e checks that load them and wait on game events (`window.__farm.dev`), and cite scenario names in critiques.
Run `npm run verify:fast` (about 20 s) per commit and `npm run verify` (about 6 min) before merging.

| Area               | Handover                                             | Critic notes                                                                                  | Top next step                                                                                                              |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Dev sandbox (new)  | [NEXT-STEPS-DEVTOOLS.md](NEXT-STEPS-DEVTOOLS.md)     | none (measured: full verify 893 s to 353 s, fast verify 18 s)                                 | Migrate the remaining scripts and probes to scenarios and await helpers; the fixed-wait baseline may only go down          |
| Game feel (new)    | [NEXT-STEPS-FEEL.md](NEXT-STEPS-FEEL.md)             | [critiques/feel-critic/](critiques/feel-critic/final.md) (accepted, one nit)                  | Wire the remaining art frames (villager and animal idles, crop lean, ripples) everywhere they apply; real-phone feel check |
| Art                | [NEXT-STEPS-ART.md](NEXT-STEPS-ART.md)               | [critiques/art-critic/](critiques/art-critic/final.md) (round 4 closed)                       | Up-facing frames for can, scythe and rod; a wider statue; bigger footprints if the owner wants them                        |
| Guided start       | [NEXT-STEPS-ONBOARDING.md](NEXT-STEPS-ONBOARDING.md) | [critiques/onboarding-critic/](critiques/onboarding-critic/final.md) (16/16 runs reach day 2) | Space out the day-2 tip burst; point at the first job goal                                                                 |
| Game depth         | [NEXT-STEPS-DEPTH.md](NEXT-STEPS-DEPTH.md)           | `critiques/critique-12.md`                                                                    | Crop requests in the first summer days; "buy 5 items" completes after one purchase                                         |
| One-thumb controls | [NEXT-STEPS-CONTROLS.md](NEXT-STEPS-CONTROLS.md)     | [critiques/controls-critic/](critiques/controls-critic/final.md)                              | Feel inherited input this round; SE serpentine accuracy is the open minor                                                  |
| Audio              | [NEXT-STEPS-AUDIO.md](NEXT-STEPS-AUDIO.md)           | [critiques/audio-critic/](critiques/audio-critic/final.md)                                    | Paused until a human has listened                                                                                          |

## What changed at the merge

- `feel/smooth` already contained `art/round4` (merged by the feel agent so its critic could check the real frames).
- `e2e:feel` joined `npm run verify` in its own quiet phase (frame timings measured with nothing beside them).
- The ambient anchor check now lives in `scripts/e2e-scenarios.mjs` and also pauses the pixel-locked camera.
- Fixed waits written before the no-new-waits rule (depth's round-4 probe, the feel branch's controls and feel
  e2e) are grandfathered in `scripts/fixed-waits-baseline.json`; they may only go down.
- `cap:sync` now builds with `build:store`, so the native apps carry no dev tools.
- Save version is still 17.

## Needs a human

- **Play it on a real phone, one-handed, as a first-time player**: checklists in
  `critiques/onboarding-critic/final.md`, `critiques/controls-critic/final.md` and `critiques/feel-critic/final.md`
  (feel for: no shimmer while walking on a 120 Hz phone, feet stepping not skating, instant button light, doors in
  under 0.3 s). The dev menu (`?devmenu`) lets you jump to any scenario on the phone.
- **Listen** to the audio (`critiques/audio-critic/final.md`).
- **Decide** the open questions in the handovers, notably: Clay's daily crates while you lead by 5 (right feel, or a
  board-row race instead?), goals stepping aside after 3 quiet days, bigger footprints for farm buildings.
- **Licensing before any store release:** re-check Google's terms for Flow images (see `ASSETS.md`).
