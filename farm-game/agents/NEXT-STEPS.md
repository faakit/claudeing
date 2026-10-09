# Next steps (round 2, 2026-10-09)

Four agents worked in parallel on their own branches, three of them paired with a critic agent that reviewed
every checkpoint. This branch (`integration/round2-2026-10-09`) merges all of them on top of round 1
(`integration/agents-2026-10-08`). Start a new session from here, not from the agent branches.

| Area                              | Handover                                         | Critic notes                                                                                             | Top next step                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One-thumb controls (top priority) | [NEXT-STEPS-CONTROLS.md](NEXT-STEPS-CONTROLS.md) | [critiques/controls-critic/](critiques/controls-critic/final.md) (final: no blockers, ready for a phone) | A slow press on Action does nothing (make press-and-lift act once, fix the two "Hold Action" hints); then let a painted line turn a corner to bring the plot from 15 gestures toward 8 |
| Game depth                        | [NEXT-STEPS-DEPTH.md](NEXT-STEPS-DEPTH.md)       | `critiques/critique-6.md` to `critique-9.md`                                                             | Critique 9: show the season score when losing, a non-fishing path to beat Clay, warn before a request eats the harvest                                                                 |
| Art                               | [NEXT-STEPS-ART.md](NEXT-STEPS-ART.md)           | [critiques/art-critic/](critiques/art-critic/final.md) (accepted, no majors left)                        | Art for the 21 newest keys (tulips, dishes, legendary fish, scarecrow, statue); the "New Game" doubled label; redo tool poses                                                          |
| Audio                             | [NEXT-STEPS-AUDIO.md](NEXT-STEPS-AUDIO.md)       | [critiques/audio-critic/](critiques/audio-critic/final.md) (nothing open)                                | Paused until a human has listened; then act on that feedback                                                                                                                           |

## What changed at the merge

- The audio touch cues are now wired into the controls code: `ringOpen` and `ringClose` on the tool ring,
  `confirm` on a ring pick and a committed row, `tick` per painted tile (with the existing light haptic), and
  `target` when a tap sets a walk route. Nobody has heard them in game yet.
- Conflicts were resolved by keeping both sides: the art tool poses plus the controls haptics in
  `WorldScene`, the audio, controls and atmosphere scenarios in `scripts/perf.mjs`, and both sets of
  `DECISIONS.md` sections. A `clearCursor` method that two branches added to `MenuPanel` was de-duplicated.
- The save is version 16 (controls settings and last-planted seed). Depth, art and audio did not bump it.

## Needs a human

- **Play it on a real phone, one-handed.** Every control was measured with emulated touch only. The checklist
  is in `NEXT-STEPS-CONTROLS.md` (tap-to-walk, hold Action then drag to paint, the sideways flick for the
  ring, resting the thumb before steering, Menu reach, haptics strength, the iOS and Android edge gestures).
- **Listen.** No one has heard any audio. Start with `critiques/audio-critic/final.md` (listening order); the
  renders were made outside the repo and can be regenerated with `node audio-src/tools/render.mjs <dir>`.
- **Look.** All art was judged from headless screenshots.
- **Decide** the open questions at the end of each handover, for example: serpentine or strip painting,
  whether holding Action should repeat, scarecrow crows, statue growth, eating caps, truly round ponds,
  whether art may add collision, and composed versus commissioned music.
- **Licensing before any store release:** re-check Google's terms for Flow images (see `ASSETS.md` and
  `critiques/art-critic/decisions.md`; not legal advice).

## Notes for the next session

- The walnut and parchment UI is the default; `?skin=plum` shows the old one.
- After changing a map, run `npm run art:maps`; a test fails if a map asks for a tile the tileset lacks.
- `npm run bench:thumb` measures the one-thumb core loops per phone and hand; thresholds are in
  `scripts/bench-thresholds.json`.
- `npm run verify` now takes about 7 minutes (the controls e2e runs two phones at a time). On Windows set
  `CHROMIUM_PATH`, and `E2E_PORT`, `E2E_MOBILE_PORT`, `PERF_PORT` when two checkouts run checks at once.
- Raw Flow downloads, audio renders and critics' screenshots are kept outside the repo; prompts, per-sprite
  crops and audio sources are in the repo, so both pipelines re-run from it.
