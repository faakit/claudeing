# Art: next steps (handover, round 5, 2026-10-11)

Branch `art/round5` (from `integration/round4-2026-10-11`). `npm run verify:fast` is green before each commit and the
full `npm run verify` before the hand-off. Perf stays at 2-5 draws. Atlases: world 512x256, ui 512x128, chars
**512x1024** (the action frames filled it; the limit is 1024, so the next big batch needs a second chars atlas).
Everything was judged from **headless renders only**. Reviews: `C:/Users/andre/dev/tiny-acre/art-critique/
review-16.md` to `review-19.md`: the menu sheet accepted (16-17), the actions settled (18) and round 5 closed
(19; its nit R19-1, the reel pull's rod across the face, is fixed in the last commit).
- **Perf note:** the full `verify` on this machine (other agents running) failed perf 4x/6x on single frame-pacing
  spikes in different scenes on each run (a sleep, a Woods door, a Town door). Perf alone passed draws and JS
  every time (2-5 draws; holding Action 1.2-1.3 ms), and the critic's frozen copy had pacing within budget.
  Rerun perf on a quiet machine before the merge.

## Shipped this round

1. **The menu sheet background** (the owner: "looks buggy" on a phone). Findings and the slice spec:
   `agents/out/art-round5-menu.md`.
   - Cause: the canvas is fractional on the iPhone 13 (5.72 device px per game px) and the SE (3.24). The old
     frame was all 1-2 px stripes, so it rendered unevenly. The coordinator ruled to keep those phones fractional,
     so the UI art carries it: 2 px lines over 1 px, no fine stripes or checkers, no semi-alpha.
   - New: Flow `ui1` b (a parchment sheet in a walnut frame with brass corner caps), rebuilt on its native grid
     into nine on-palette 9-slice pieces (`art-src/tools/uisheet.py`). `src/ui/sheetSkin.ts` tiles them (never
     stretches) into one canvas texture per sheet size. Slice: left 6, right 5, top 7, bottom 5; content inset 8;
     inner ink and top bevel 2 px.
   - `widgets.ts` (drawing helpers only):
     - `Modal.panel()` uses the skin.
     - `drawPanel` (walnut) has no alpha shadow and no 1 px inner stripes.
     - `Button` has a separate solid 2 px soil lip, the face sinks onto it when pressed, and the disabled hatch is
       solid 2 px blocks.
     - `drawSlot`'s recess is a solid 2 px soil row.
     - `drawBar`'s highlight is the next lighter ramp colour (`LIGHTER`).
     The UI has no semi-alpha pixels left in the walnut skin.
2. **Player action animations** (the owner's request, settled by review 18):
   - **Tools stay on the round-4 code-drawn frames.** On every side-by-side they beat Flow's on consistency, tool
     identity and anchoring.
   - **Kept from Flow, cleaned:** harvest (down, right), plant (down, up) and eat (all three). The Flow prompts
     used the project's own `player1` a sheet as the reference (entries 31-41 in `art-src/flow/prompts.md`, with
     what was used from each). `art-src/tools/flowanim.py`:
     - finds each farmer by his hair and keeps his connected piece;
     - samples to native pixels on the palette and plants the feet on row 39;
     - pastes the **idle head pixel for pixel**;
     - keeps only one 8-connected piece;
     - uses the exact idle frame where the farmer simply stands.
   - **Drawn in code** (`art-src/tools/codeacts.py`, on the round-4 toolanim parts): pet (crouch, reach, pat),
     reel (wait, bite, pull) and place (the held item's icon is drawn by the game at `ACT_ITEM_ANCHORS`).
   - Keys `player_act_<anim>_<dir>_<i>`, 32 x 44, feet on row 39, origin (0.5, 40/44), contact on frame 2; table
     in `agents/out/art-feel-frames.md`.
   - **Wired here** (the feel agent finished its round):
     - `PlayerFrames.act()`;
     - `WorldScene.playAct()` plays plant, harvest/forage, eat and place on the action result, pet on the daily
       pat, and reel on a new `fishCaught` event once the fishing sheet closes;
     - the fx land on the contact frame; Calm mode plays none; moving cuts the pose, so input is never blocked;
     - the pose origin comes from the frame height (44: 40/44).
   - **Tests:** `tests/animation-frames.test.ts` checks the idle head, the row-39 feet and one piece per frame;
     `scripts/e2e-scenarios.mjs` gained an `actions` block (each animation plays on its event, the farmer walks
     right after a harvest, Calm mode plays none).
   - **Review pack:** `agents/out/art-shots/round5/tools/`: strips, onions, 1x/4x GIFs, and
     `ingame/ingame_rows.png` (frame-exact in-game strips of harvest, place, pet and reel).

## Flow usage

- 14 prompts this round in "out. 08 - 07:06" (1:1, Nano Banana 2.1, x2): `ui1` and `ui2` (the menu sheet) and
  `anim_*` (11 animations; `anim_can` was resubmitted after its first run failed silently). No quota message.
- **References:** local uploads are not possible from the agent's browser pane. Use the project's own images
  through the prompt box's + picker (search "Farmer character sprite sheet"). After picking a result, the picker
  closes by itself. Do **not** click its X then: it lands on the grid's filter button, and the typed prompt is lost.
- **Downloads:** the coordinator fetched every image into `flow-raw/`. Flow virtualizes the grid: older items show
  only 512 px previews; opening an item in the viewer exposes the full-size signed URL (the viewer also loads the
  attached reference image, so don't confuse the two).

## Merge notes (for the coordinator)

- Round 5 shared files:
  - `src/ui/widgets.ts`: `Modal.panel`, `drawPanel`, `Button`, `drawSlot`, `drawBar`; drawing only.
  - `src/scenes/WorldScene.ts`: `playAct`, the pose origin, `pendingAct`/held-item fields, a `fishCaught`
    listener, the act call after `toolSwing`, and the pet check in `onInteract`.
  - `src/fx/playerFrames.ts`: `act()`.
  - `src/systems/events.ts`: `fishCaught`.
  - `src/ui/panels/FishingPanel.ts`: emits `fishCaught`.
  - `scripts/e2e-scenarios.mjs`: the `actions` block.
  - `src/art/manifest.ts`; new `src/ui/sheetSkin.ts`, `src/art/actFrames.json`.
  - `Hud.ts`, layout and `actionFx.ts` are untouched.

Round 4 notes, still valid:

- Shared files touched, a few lines each:
  - `src/scenes/PreloadScene.ts`: the walk anim uses 8 frames at `WALK_FPS * 8 / 4` fps; the villager idle uses
    `NPC_IDLE_SEQUENCE` with per-frame durations. The feel agent may own the timing; keep its numbers if they
    conflict.
  - `src/art/placeholders.ts`: the stand-in player sheet has 8 walk frames, the villagers 4 idle frames.
  - `scripts/map-art.mjs`: the `m_*` three-wide prop kind, the town well.
- Maps and tileset changed (new well tiles). After merging a branch that touches `scripts/generate-maps.mjs`, run
  `npm run art:maps` and commit the maps, the tilesets and `art-src/map-tiles.json`.
- `fx_splash_*` changed size (manifest `FX_SPRITES` updated); nothing in `src/` used them before.
- Python edits on Windows: write files with `newline='\n'`, or git warns about CRLF.

## Open items (by priority)

1. **Actions not drawn for every facing:** harvest has no back view and plant no side view (the Flow rows mixed
   facings and were dropped). Those facings simply play no animation. A redraw in code, or a new Flow row per
   facing, would complete them.
2. **The round-4 tool frames** remain the tool animations. The chars atlas is 512x1024 with the action frames:
   split it (a `chars2` group) before the next big batch.
3. **Eat** is standing-only Flow art. The critic may still ask for front/side cleanups after the final review.
4. **Fidelity seams:** the bodies under our head are Flow's drawing in harvest and eat; any frame the critic flags
   can be swapped for the idle or redrawn in code (`flowanim.SELECT` / `codeacts.py`).
5. **Layout (the UI owner):** tall sheets cut through the HUD goal plate; the menu tabs are crowded at 1x.
6. Round 4 leftovers: a 9 px side stride, the statue's footprint, mine and woods details, winter paths.

## Questions for the owner

- **Look on a phone:** the animations were judged only from headless renders and GIFs.
- **Footprints:** may the animal houses and town landmarks get real 2x2 or 3x2 footprints?
