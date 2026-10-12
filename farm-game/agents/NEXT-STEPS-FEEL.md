# Next steps: game feel (towing round, The Dry Year)

Branch `feel/towing` (worktree `controls`, head 53c6e90 plus this file), from the deployed `integration/dry-year-2`
(7222bb3), with `origin/integration/dry-year-2` @ 022d0e7 merged in (53d54b4). Full `npm run verify` green at
64de502 (e2e:scenarios flaky beside the other suites, green alone; its one failure led to 53c6e90's fix). The feel critic reviewed frozen copies with real CDP
touches on the iPhone 13 and SE, both hands, at 1x and 4x CPU, using its own probe (`feel-critique/tools/dry/tow2.mjs`:
450 ms reactions, 1.5 mm scatter, 150 ms aim lag). Its notes are outside the repo in `C:/Users/andre/dev/tiny-acre/feel-critique/`.
**No real phone was used**, and headless GL is software-rendered.

The previous handover (the Dry Year feel lane: channel juice, edge hold, the first tow spike) is in git history and in
`DECISIONS.md`, "The Dry Year, feel lane". This round is in `DECISIONS.md`, "Towing, round 2".

## Towing verdict

**GO** (feel critic, on frozen 53c6e90; its report: `feel-critique/final-towing.md`). The Weir's verb stays as
designed.

- 96/96 landed at 1x and 4x: i13 and SE, both hands, wait/chain/water/action, with 1.5 mm scatter, 450 ms reactions
  and a 150 ms aim lag.
- tow-lane-long (17 tiles) took 8.2-9.8 s (bar: under 20 s). Inputs were 3 by Action and 3-5 by taps (bar: at most 6).
- 0 silent taps, 0 'hard' taps, 0 stalls. Draws 2.
- Game JS max 12.4 ms at 4x. Every frame over 33 ms had game JS of at most 4.2 ms, so those were host stalls.
- The snag, the tug and the landing read in strips.
- e2e:controls (193 PASS), bench:thumb (36/36, gestures identical to the baseline) and perf 1,4 are green on 64de502.
  The change from 64de502 to 53c6e90 is towing-only.

**Conditions for M7:**

1. The probe bar (`scripts/lib/tow.mjs`, or the critic's `tools/dry/tow2.mjs`) is the acceptance test for
   `tow-first-log` and `tow-east-lane`.
2. Slips stay low and toward the middle of the screen. The right thumb's slip and 'toward' taps still reach 80-85 mm
   (stretch) on the i13; the Action route covers it.
3. Final art keeps the snag cues (the tilt, the foam crest, the ripple) and the Action plate's verb icons.
4. Action keeps its priority rule: a crop or forage good in front wins while nothing is hooked.
5. The owner's real-phone check, haptics included, is still to do. It is on the checklist.

## What changed this round

| area | what | where |
|---|---|---|
| T1 (the chained-tap stall) | Root cause: a slip tap aimed while the hook walk scrolled the camera landed a tile or two off the slip, and the farmer stood outside the haul range (the critic's corrected trace agrees). Now a tow tap within 2 tiles of the slip (bank or water) means the slip; standing within 2 tiles with the log free hauls it in; the last tow goal (from a tap, the chained tap or Action) is walked to after every tug; an idle farmer with an unreached goal walks on after 250 ms; a hook-walk replan keeps a chained destination. | `systems/towing.ts` `SLIP_REACH`, `meansSlip`, `atSlipBank`; `dev/towSpike.ts` |
| Taps | Every world tap is read through one point: the thumb-offset correction, then the camera as it stood at touch-down (a tap during a walk used to drift ~5 px with the scroll; the tow hook used to skip the correction). | `WorldScene.tapPoint`, `worldPoint`; `inputHub` `touchDown`; `input/WorldTouch.ts` |
| No silent tow taps (T5) | While a log is hooked, a tap on solid land (the hedge) walks to the nearest bank tile, the slip's way of the nearest ring; a water tap within 1.5 tiles of a drifting log hooks it; a bank tap with nothing hooked walks as usual. | `towing.ts nearestBank`, `towSpike.towGoal` |
| Action route (T2) | Action hooks a log in view (walks to it), sends a free hooked log home to the slip, and tugs, only while towing's context is live (hooked, or within 4 tiles of the lane with a log in view); a ripe crop or forage good in front wins. The Action plate shows the verb's icon (hook, slip, tug; placeholder art). | `towing.ts actionVerb`; `inputHub.actionIcon`; `UIScene.updateActionIcon`; `WorldScene.actionInFront` |
| Long lane | `tow-lane-long`: 17 tiles in lab columns 26-47 (beside the showcase, so the spike's shore keeps its place on screen): west from a head just below the farmer, then south to a slip above the floating controls; one rock; no water decor on any tow lane. Logs lie along the current, slide on downstream at an inside corner, and pop the way they were going after a tug. | `scripts/generate-lab-map.mjs` (`tow` lanes in `lab-map.json`), `labDef.ts TowLaneDef`, `towSpike.ts` |
| Lab bug | The lab scene was added last at runtime and drew over the floating controls: every lab scenario hid Action and the hotbar. It now sits below the UI. | `dev/lab.ts` |
| T3 nits | Snag: 2 px tilt, a flickering 1 px foam crest at the rock, a ripple on the catch and every 700 ms. The held farmer keeps his row or column (no sideways step, no north-facing frame after a tug). | `towSpike.ts` |
| One act per Action press | Coordinator ruling: each press acts once; only a key the system reports as held (auto-repeat) repeats. A press seen held past the 200 ms lock on a loaded machine no longer acts twice. farm.act's workaround is gone. On desktop a held Space now repeats after the system's repeat delay (~500 ms). | `input/actionGate.ts`, `InputHub.pressAction`, `KeyboardInput`, `UIScene`; `perf.mjs` |
| Restoration beats | Pickaxe day 2.6 s (was 3.3): swings 560 ms apart, stone chips and a 1 px heap shudder per strike, the top stone loose on the third as the lower sprite shows. Spade day 1.8 s (was 3.4): the channel's clods, a cut that settles, the eased fill with a foam front. | `fx/SiteFx.ts`, `WorldScene.useSite`, `ObjectsRenderer.landmarkSprite` |

`__farm.dev.tow()` now reports `lane`, `laneTiles`, `slip.bank`/`slip.water`, `snags`, `spawn`, `verb`, `goal` and
`log.axis` besides taps, actions, tugs, times and the phase.

## Scenarios, tests, probes

- Scenarios: `tow-spike`, `tow-spike-long` (spawn moved to x 18), `tow-lane-long` (new), `spring-site-work-3` (new: the
  spade day).
- Unit: `tests/towing.test.ts` (slip reach, hedge taps, the lane turn, Action's verb and its priority),
  `tests/action-gate.test.ts` (slow frames), `tests/site-fx.test.ts`.
- e2e:scenarios blocks: `towing` (4 seeded chained T1 taps two tiles east of the slip mid-scroll, each landing with 3
  inputs; the long log by taps and by Action), `towingLane` (wait/water/chain/action on the long lane, the hedge tap,
  Action is the tool again away from the lane), `actionSlowFrame` (one press through six slow frames), and the
  spring block times each beat in game time.
- `scripts/lib/tow.mjs` plays towing like a person against the critic's bar (`playTow`, `towBar`); the e2e and
  `agents/probes/tow-spike.mjs` (`SCENARIOS`, `PROFILES`, `HANDS`, `STRATEGIES`, `RUNS`, `THROTTLE`) use it.
  `scripts/e2e-scenarios.mjs` takes `BLOCKS=towing,towingLane` to run only those blocks.

## Numbers (my runs; the critic's are in its reviews)

- 64-run matrix (3 scenarios x i13/SE x both hands x wait/chain/water/action, 1x, dev server): 64/64 landed, 0 stalls,
  0 silent taps, 0 'hard' taps. tow-lane-long 7.7-8.9 s, 3 inputs by Action, 5 by taps; spike 3.1-4.6 s, 3 inputs (4
  long). Draws 2 throughout. The right thumb's slip and westward 'toward' taps are stretch (69-82 mm); the rest and
  the whole Action route are comfort.
- 4x: draws 2; JS p95 3.8-8 ms; isolated 50-180 ms frames only while other agents' browsers loaded the host (a rerun of
  6 runs: 0 frames over 33 ms). The critic measured 0 frames over 33 ms at 4x on a quiet host.

## Open

1. **After the go (M7 proper):** the depth lane adopts `systems/towing.ts` for the real weir (lanes chosen by day hash,
   the spur, ice rims, saving while towing); `tow-first-log` etc. per MILESTONES M7; a `bench:thumb` towing row.
2. **Art:** logs short and long (east-west and north-south), the rope, the slip, the snag rock, and the three Action
   icons (`tow_icon_hook`, `tow_icon_home`, `tow_icon_tug`) are placeholders drawn in `towSpike.ts makeTextures`.
3. **Audio:** `logHook`, `logKnock`, `logTug`, `logLand` still fall back to existing cues.
4. The right thumb's reach to a slip on the far left of a horizontal lane stays stretch (about 80 mm on the i13): the
   Action route covers it; M7's weir layout should keep the slip low on screen as the long lane does.
5. Banners ("THE RIVER IS BACK") read low-contrast on straw: the art lane's (owner note).
6. Not run this round: a real phone. The critic ran `bench:thumb` on 64de502 (36/36).

## Other lanes' files touched

`scenes/WorldScene.ts` (`tapPoint`, touch-down camera, `actionInFront`, the Action gate, the site beat now in
`fx/SiteFx`), `scenes/UIScene.ts` (`pressAction`, the Action icon override), `game/ObjectsRenderer.ts`
(`landmarkSprite`), `scripts/lib/farm.mjs` (`act`), `scripts/perf.mjs` (held Action), `scripts/e2e-scenarios.mjs`,
`DECISIONS.md`.
