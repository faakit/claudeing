# Game-depth session, round 3 (2026-10-09)

Branch `depth/round3` (worktree `C:/Users/andre/dev/tiny-acre/depth`), from `integration/round2-2026-10-09`.
Pushed to `origin/depth/round3` after every green verify. Next steps: `agents/NEXT-STEPS-DEPTH.md`.

## Commits shipped

| Commit | Goal |
| --- | --- |
| `e23349b` | Critique 9 fixes (score line, farm-only scoring, stakes, trophy, slack in crop requests, bin keep-back and warning, special keep, batch slot, row order, morning order, cart use), growing statue, gentler feasts, sim keeper and fisher, day-31 stall probe |
| `20c779f` | Festival and legend trophies at home; polite Clay spares farm goods |
| `70e861a` | Critique 10 fixes (toasts above sheets, Clay plays to win, the race goes on at 5 hearts, text) and four mastery goals |
| `8a07167` | Make outermost on every Make-tab row; early-gold sensitivity measured |
| (last) | Critique 11 fixes (crates that keep up and are announced, friendly Clay, year-two text, winter prize, bin line, special feedback, sim timeouts), handover and this report |

## What was verified, and how

- `npm run verify` green before every commit (lint, typecheck, unit 680 -> 719, build, e2e, mobile e2e, controls e2e,
  perf <= 12 draws and <= 3.5 ms JS per frame). Once the controls e2e missed one flick timing ("harness lag") while a
  critic's browser ran; it passed on a rerun with perf.
- New unit test files: `critique9.test.ts`, `critique10.test.ts`, `critique11.test.ts`, `eating.test.ts`; additions to
  sim (board race for a pure farmer, fisher), board7, critique5, rival and maps tests.
- New e2e lines: the score line on the board, "Ship all produce" keeps a request's goods, a toast over an open sheet is
  drawn above it, the trophy in the house, the 4th dish gives half.
- Two independent critiques on frozen copies (headless Chromium, real keyboard and touch input, teleports between
  spots): critique 10 (`e23349b`) and critique 11 (`70e861a`), each with 32-day new games as a farmer who never fishes.
- Not verified: anything on a real phone, audio, real walking times.

## Day-31 stall (critique 9)

`agents/probes/stall-day31.mjs` replays the critic bot's sequence (full bag, the mine loop over the same 22 ore nodes,
teleport to the farm, E at the bin, then the bed) plus two variants (ending on the mine door; a door walk and a
scene start in the same moment). It did not reproduce on the frozen critique-9 build or on round 3; critique 10 and 11
re-ran it, also clean. The log's frozen clock (8:25 from the mine to the farm) points to a frozen world (a modal
counted open or a busy flow), not the full bag; the debug hook now exposes `runtime` so a future stall can be read.

## For onboarding

See "For onboarding" in `agents/NEXT-STEPS-DEPTH.md` (board race from day 8, trophies, dish diminishing, the "Craft"
goal title, toasts at the top while a sheet is open).

## Open questions

See `agents/NEXT-STEPS-DEPTH.md`: early-gold sensitivity, Clay's crates as pressure, the legend goal gating later goals.
