# Next steps: game feel (The Dry Year)

Branch `feel/dry-year` (worktree `controls`), from `integration/dry-year-core` (db29f2a). The feel critic reviewed
frozen copies with real CDP touches on the iPhone 13 and SE, both hands, at 1x and 4x CPU; its notes are outside the
repo in `C:/Users/andre/dev/tiny-acre/feel-critique/` (`dry-*`). **No real phone was used**, and headless GL is
software-rendered: frame times are relative, judge by draws and JS.

The previous handover (rounds 4 and 5: the pixel camera, wipes, tool timing, canvas scale) is in git history and in
`DECISIONS.md`, "Game feel (feel agent, round 4)".

## What changed this round

| area | what | where |
|---|---|---|
| Channel dig | The spade swings with a 50 ms wind-up (a key item, it had no swing at all). On impact 7 soil clods (1-2 px, palette wood/sand/soil) arc onto both banks beside the cut, 2/3 to the throwing side, hop 1 px, rest 0.4 s and fade in two steps; the cut stands 1 px proud for 70 ms and settles; a haptic tick per dug tile, even along a painted row. | `fx/ChannelFx.ts`, `fx/channelRun.ts`, `WorldScene.tryAction` |
| Water into a cut | The new tiles are held dry and the water runs in from upstream (the real wet tile cropped from the tileset and grown from the entry side, 220 ms ease-out, a 1 px foam line on its front), the bank tile first; drops and the water cue when full. The old instant splash and ripple at the cut are gone. | same; `FarmRenderer.holdDry/release` |
| Morning run | The first time the reached channels come into view each day, the water runs from the creek down the ditch as one continuous front (65 ms a tile, a whole run capped at 1.5 s so the weir's 64 still reads), and each watered soil tile beside it darkens with a droplet as the front passes. It waits until its first 3 tiles, or half the run, are inside the view inset by 16 px (critic C1-1). Not on the creek's first morning, not in Calm (the water is simply there); rain: the run plays, soil not held. | `ChannelFx.planMorning`, `channelRun.runSeen` |
| Creek reveal | The creek's first morning starts once the bed (x 26-27) is wholly in view, a tile in from the edge (it started with the bed still off screen). | `WorldScene.update` |
| Edge hold | Band 36 CSS px and 180 ms unchanged (critic ruling: an edge-grown tile can't be trimmed, so a faster interval overshoots). Exit hysteresis: once growing, the hold lasts until the finger leaves a 52 CSS px band along the leg's axis (critic D3: a 33 px rest lost 4 tiles in a frame). | `input/gesture.ts` `PAINT_EDGE_EXIT_CSS`, `UIScene.updateHold` |
| Taps | A tap in the upper 60% of the void under a door on a map's bottom edge (the house's front door) goes out that door. The dug toast counts the bank tile. | `systems/tapIntent.ts` |
| Towing spike (M7) | See below. | `systems/towing.ts`, `dev/towSpike.ts` |

Scenarios: `channels-first-dig`, `channels-row` (the run plays on load), `channels-morning` (step out of the house),
`channels-home-only`, `tow-spike`, `tow-spike-long`. e2e: `e2e:scenarios` blocks `morning` (house door by a real
tap; the run holds until its head is in view) and `towing`; `e2e:controls` has the trembling-rest row. Unit tests:
`tests/channel-fx.test.ts`, `tests/towing.test.ts`, `tests/paint.test.ts`, `tests/tapmove.test.ts`. Probes:
`agents/probes/feel-channels.mjs`, `tow-spike.mjs`, `feel-beats.mjs`.

Perf (headless, my probes): at most 3 draws during a dig and a morning run, at most 2 while towing; the critic
measured JS p95 at 4x of 3.5-3.8 ms against 3.8-4.4 on the base, no frame over 33 ms at 4x.

The critic accepted item 1 (dig and fill juice) at acbcd24, with C1-1 open; C1-1 was fixed at 281f5a4. It ruled on
item 3 (keep band and interval, add hysteresis), done at dfaa633.

## The towing spike (M7 "spike first")

On the lab's south shore (debug only): water rows 29-32 flowing west at 6 px/s, a rock snag at (17,29) in the
near-bank row, slip planks at (13,28) where the road meets the shore, the farmer at (13,27), a log spawning at
(19,30).

- **Hook:** tap the log anywhere: the farmer walks to the nearest bank tile with the log a tile inside the rope's
  reach and hooks it the moment it is in reach (the rope throws out over 120 ms). Action hooks too when in reach. A
  tap on the bank or water on the way is kept as the tow destination and walked right after the hook.
- **Tow:** tap a bank tile, or the water (it resolves to the nearest bank beside it). The log follows on a 3-tile
  rope (an eased chase, so it lags and swings round turns), slides along the bank and only ever lies on open water.
  The rope is a solid 1 px line that sags when slack and is straight when taut. The stick works the same.
- **Snag:** the log stops, tilts and bobs a pixel, the rope goes straight, a knock and a tick; the farmer is held
  where it caught and the walk is cut. Action, a tap on the log, or any bank or water tap tugs: he leans back, the
  log pops a tile past the rock in a 4 px hop, a splash, and the walk resumes. A long log gives on the first tug and
  comes free on the second.
- **Land:** standing at the slip he hauls it in (110 px/s) to the slip's water tile, then it is lifted onto the
  planks and dropped (dust, splash, "+1 Timber", success haptic); input stays free. A walk to the slip stops beside
  it, so the log never lands on the farmer.
- **Numbers:** 3 taps (log, slip, tug), first input to landing 3.7-4.0 s with instant reactions on i13 and SE, both
  hands (the spec asks under 20 s). `__farm.dev.tow()` reports taps, actions, tugs, times and the phase.
- **Rules for M7** (`systems/towing.ts`, pure, tested): `makeLog`, `placeAt`, `drift`, `follow`, `tug`, `haul`,
  `atSlip`, `atSlipBank`, `land`, `bankFor`, `hookStand`, `inReach`; constants `ROPE_PX` 48, `FOLLOW_RATE` 0.16,
  `HAUL_PX_S` 110, `TUGS` 1/2, `TIMBER` 1/3. Not yet: lanes chosen by day hash, the spur that turns a log, ice
  rims, saving while towing, logs turning into a vertical lane.
- **Critic's verdict:** not given yet; the go/no-go waits for the next round (owner order to stop testing).

WorldScene gained small verb hooks for it (also usable by M7): `tapHook`, `actionHook`, `walkTo`, `walkGoal`,
`stopWalk`, `walkable`, `farmerSprite`. The lab scene creates the spike when the stat `lab.towSpike` is set.

## Owner bugs (branch `fix/owner-bugs`, from integration/dry-year-2 16f89eb)

Three bugs the owner saw while playing, one commit each, **all untested** (owner order: the PC was needed, so no
test, typecheck, lint, build, e2e, perf, bench or browser ran). Root causes and rulings are in `DECISIONS.md`,
"Owner bugs".

| bug | fix | where |
|---|---|---|
| 1. Walking behind a crown, it "faded" and the farmer showed whole | The see-through hole opens only when a crown covers the lower body (behind the trunk, never beside or in front), eases in and out over 150 ms with the checker rim, 9 px body circles; the target circle only behind or standing still | `fx/SeeThrough.ts`, `art/mapLayers.ts`, `game/ObjectsRenderer.ts`, `WorldScene.tick`; `tests/see-through.test.ts`; scenario `walk-behind-tree` |
| 2. A tap while walking "flicks" | Re-plan from the tile ahead or behind, whichever is the shorter walk from the exact position (ahead wins ties and 4 px); no step back, no stop, no turn unless the target is behind; a held preview is not overwritten | `systems/pathfind.ts`, `WorldScene.planTap/onTap/walkTo/followRoute`; `tests/tapmove.test.ts`; e2e:controls row; scenario `tap-retarget-walk` |
| 3. A bridge over a walkable dry bed | Coordinator ruling: dry beds block exactly where the water stage does (farm creek, town D1, Wendhead pool, creek head and gorge); data only, the dry look unchanged | `scripts/generate-maps.mjs`, six variant `.tmj` collision layers; `tests/maps.test.ts`, `tests/map-stages.test.ts`; scenario notes |

**Before merging, run on an idle machine:** `npm run verify` (in particular the new `tests/see-through.test.ts`, the
new rows in `tests/tapmove.test.ts`, `tests/maps.test.ts` and `tests/map-stages.test.ts`, the typecheck of
`mapLayers.ts`'s alpha probe, and `tests/dev-scenarios.test.ts` for the two new scenarios); `npm run e2e:controls`
(the new "a second tap ahead mid-step keeps walking" row, both phones and hands); `npm run e2e:feel`; `npm run perf`
(the "behind a lone tree" and "behind a grown fruit tree" rows: the hole now redraws for 150 ms on each open and
close, and reads tile alpha once per tile id); `npm run bench:thumb`; `npm run e2e:scenarios` (it loads every
scenario, the new `walk-behind-tree` and `tap-retarget-walk` with them, and the creek and dry-town blocks); and
`npm run e2e:onboarding`, comparing its median with the last run, in case a guided path used to cross a dry bed.
Then open `?scenario=walk-behind-tree` and `?scenario=tap-retarget-walk` and judge them by eye: the hole's size and
ease, and the walk through retargets, were never seen running.

## Other lanes' files touched

`scenes/WorldScene.ts` (ChannelFx wiring, the spade swing, verb hooks, the creek reveal threshold),
`game/FarmRenderer.ts` (`holdDry`/`release`), `scenes/UIScene.ts` (edge-hold exit band), `systems/tapIntent.ts`
(the void under a door), `dev/lab.ts`, `dev/api.ts`, `dev/devtools.ts` (`__farm.dev.tow()`),
`scripts/e2e-scenarios.mjs`, `scripts/e2e-controls.mjs`.

## Open

1. **Item 2, the restoration beats, is not done.** From strips (`feel-beats.mjs work|reveal|creek`): the pickaxe
   day (`spring-site-work`) is 3.3 s with about 600 ms of dead air between swings, and the stone rolls off at
   2.2 s, a second after the last hit. Plan: swings about 560 ms apart, grey chips and a 1 px heap shudder per hit
   (needs a landmark getter in `ObjectsRenderer`), the stone breaking loose on the third hit with the site's lower
   sprite showing as it leaves, about 2.6 s in all. The spade day (no scenario yet: add `spring-site-work-3`)
   should reuse the channel clods and the foam-edged fill. The first-green dissolve (`valley-farm-green-reveal`)
   reads well. Doors must stay under 0.3 s.
2. **Art merge** (art/dry-year 0dd9a35 landed the channel tiles `chan:wet|dry:<mask>`): at integration, the ChannelFx
   `src(tx, ty, look)` callback in `WorldScene.create` should use the art lane's `channelGid(tx, ty, look)` (null on a
   path; `tileset.getTileTextureCoordinates(gid)`) in place of `CHANNEL_GID`, and the foam line in `ChannelFx.stepFills`
   should be limited to `CHANNEL_WATER_BAND` ([6, 12], from `src/art/channelTiles.ts`; columns on a vertical run).
3. **Audio:** the audio lane is adding `dig` (actionFx's dig case) and `logLand`; the spike already asks for
   `logHook`, `logKnock`, `logTug` and `logLand` and falls back to existing cues until they exist.
4. Critic nit passed on (not feel): decor (a pebble, a bush, a canopy) is drawn over channel water.
5. Towing after a go: a bench:thumb row, art (logs short and long, rope, slip), turn frames, the M7 rules above.

## Unverified, and what must run before the merge

The owner stopped all tests before the full verify finished (the PC was needed). What did run on this branch:

- `verify:fast` green at 281f5a4 and at dfaa633 (the unit suite's 2 ms pathfind timing test failed once at dfaa633
  while the machine was loaded and passed when rerun alone).
- `e2e:scenarios` full green at 281f5a4 plus the morning-run fixes (towing and morning blocks included).
- `e2e:controls` before dfaa633's last edits: the new trembling-rest rows passed on i13, both hands; 7 SE rows
  failed on harness lag (flicks, swipes, a rolled press) while verify:fast ran beside it. Not rerun alone.
- The interrupted full `npm run verify` at dfaa633: typecheck, lint, build, e2e:onboarding, e2e:mobile, bundle and
  lab-map ok; e2e and e2e:scenarios ok when rerun alone; **test failed** on `tests/sim.test.ts` (the board-race
  balance sim, a 91 s run under load, most likely a timeout, not a logic change: nothing in this branch touches the
  sim's rules); controls, feel and perf never ran.

**Before merging, run** `npm run verify` on an idle machine and check in particular: `tests/sim.test.ts` alone,
`npm run e2e:controls` (SE rows), `npm run e2e:feel`, and `npm run perf` (draws and frame pacing; the channel run
and the dig add pooled images only). `npm run bench:thumb` was not run this round. The towing go/no-go waits for
the next round (the critic has the spike at 281f5a4).

No real phone or native build. Haptic timing, the rope's 1 px line and the clods on a real panel are judged from
strips and emulated touches only.
