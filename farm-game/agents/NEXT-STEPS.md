# Next steps (round 3, 2026-10-10)

Four agents worked in parallel this round, three with a critic agent reviewing each checkpoint. This branch
(`integration/round3-2026-10-10`) merges all of them on top of round 2 (`integration/round2-2026-10-09`).
Start a new session from here, not from the agent branches.

| Area               | Handover                                             | Critic notes                                                                                                     | Top next step                                                                                             |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Guided start (new) | [NEXT-STEPS-ONBOARDING.md](NEXT-STEPS-ONBOARDING.md) | [critiques/onboarding-critic/](critiques/onboarding-critic/final.md) (no blockers; 12/12 naive runs reach day 2) | Shorten day 2's watering beat; re-verify the last four fixes (reported fixed, not replayed by the critic) |
| One-thumb controls | [NEXT-STEPS-CONTROLS.md](NEXT-STEPS-CONTROLS.md)     | [critiques/controls-critic/](critiques/controls-critic/final.md) (no blockers; plot in 7 gestures)               | SE serpentine accuracy with a shaky thumb (a row-width cue or snapping U-turn rows to the tilled edge)    |
| Game depth         | [NEXT-STEPS-DEPTH.md](NEXT-STEPS-DEPTH.md)           | `critiques/critique-10.md`, `critique-11.md`                                                                     | Critique 12, then play-test the closer Clay race with real input                                          |
| Art                | [NEXT-STEPS-ART.md](NEXT-STEPS-ART.md)               | [critiques/art-critic/](critiques/art-critic/final.md) (proportions accepted)                                    | The well as a three-tile prop; bigger footprints for farm buildings if the owner wants them               |
| Audio              | [NEXT-STEPS-AUDIO.md](NEXT-STEPS-AUDIO.md)           | [critiques/audio-critic/](critiques/audio-critic/final.md) (nothing open)                                        | Paused until a human has listened                                                                         |

## What changed at the merge

- Statue naming: depth's six levels (`obj_landmark_statue_1` to `_6`, chosen by `landmarksOn`) won over the art
  branch's parallel level path; the stale `obj_landmark_statue` frame was removed and the atlases rebuilt.
- The v17 migration (guided start) now knows the four mastery goals depth appended at v16 (`fest1`, `board4`,
  `statue6`, `legend4`), so saves on those goals migrate correctly.
- The Controls help card combines the round-3 painting sentence with the guided start's auto-tool wording.
- Save version is 17 (guided-start goals). Controls, depth and art did not bump it.

## Needs a human

- **Play it as a first-time player on a real phone, one-handed:** the 12-step checklist is in
  `critiques/onboarding-critic/final.md`; the controls checklist is in `critiques/controls-critic/final.md`.
- **Listen** to the audio (`critiques/audio-critic/final.md` has the order). Nobody has heard any of it.
- **Decide** the open questions at the end of each handover, notably: free play until 6 PM vs bed after the
  errands on day 1, Rosa or Mara as the greeter, paint step 16 px vs 10 px, softening the early game, Clay's
  crates, the goal blocked behind the legendary fish, bigger footprints for farm buildings and landmarks.
- **Licensing before any store release:** re-check Google's terms for Flow images (see `ASSETS.md`).

## Notes for the next session

- `npm run verify` takes about 8 minutes; run it in the background. On Windows set `CHROMIUM_PATH`, and the
  `E2E_PORT`, `E2E_MOBILE_PORT`, `PERF_PORT`, `E2E_CONTROLS_PORT` variables when two checkouts run checks at once.
- New saves start the guided start; `?tutorial=0` gives a bare new game for tests and probes.
- After changing a map, run `npm run art:maps`. `npm run bench:thumb` measures the one-thumb loops.
- Flow downloads: the owner approved art agents downloading their own Flow images; if an agent still declines,
  the coordinator fetches them into `C:/Users/andre/dev/tiny-acre/flow-raw/` and the agent processes them.
