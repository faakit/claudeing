# Art: next steps (handover, round 5, 2026-10-11)

Branch `art/round5` (from `integration/round4-2026-10-11`). `npm run verify:fast` is green before each commit and the
full `npm run verify` before the hand-off. Perf stays at 2-5 draws. Atlases: world 512x256, ui 512x128, chars
**512x1024** (the action frames filled it; the limit is 1024, so the next big batch needs a second chars atlas).
Everything was judged from **headless renders only**. Reviews: `C:/Users/andre/dev/tiny-acre/art-critique/
review-16.md` and `review-17.md` (the menu sheet, accepted); the action animations go to the critic with this
hand-off.

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
2. **Player action animations from Google Flow** (the owner's request), for every tool and the common actions:
   hoe, watering can, scythe, pickaxe, rod cast, rod bite and reel, planting, harvesting, petting, eating and
   placing; facing down, up and right (left flips).
   - The prompts used the project's own `player1` a sheet (the source of the current player sprite) as the
     reference image: entries 31-41 in `art-src/flow/prompts.md`.
   - `art-src/tools/flowanim.py`:
     - finds each farmer by his hair, cuts a window around him and keeps only the connected group with his head;
     - samples it to native pixels and quantizes to the palette;
     - plants the feet on one baseline;
     - clears the generated head and pastes the **idle head pixel for pixel** (the hair blob is found with an
       opening, so tools crossing the head survive);
     - drops stray specks and re-inks.
     It builds from committed crops (`art-src/flow/crops/anim/`); `--extract` re-reads the raw sheets in
     `flow-raw/` using the `SELECT` table (which variant and frames per animation and facing).
   - Keys `player_act_<anim>_<dir>_<i>`, 32 x 44, feet on row 39, origin (0.5, 40/44), contact on frame 2.
     Helpers are in `src/art/manifest.ts` (`actFrames`, `ACT_FRAMES`, `ACT_FOR_ITEM`). The full table and the
     hooks are in `agents/out/art-feel-frames.md` (round 5 section). The round-4 keys are unchanged.
   - Tests (`tests/animation-frames.test.ts`): every action frame holds the idle head exactly and has a foot on
     row 39; every round-4 and round-5 manifest frame is packed at its size; the atlases are all palette.
   - Review pack: `agents/out/art-shots/round5/tools/`:
     - `<anim>_<dir>_strip.png`, `_onion.png`, `_1x.gif` and `_4x.gif`;
     - `<anim>_<dir>_vs_round4.png`: the round-4 code-drawn frames above, the Flow frames below.

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

- Round 5 shared files: `src/ui/widgets.ts` (`Modal.panel`, `drawPanel`, `Button`, `drawSlot`, `drawBar`:
  drawing only), `src/art/manifest.ts`, new `src/ui/sheetSkin.ts`, `src/art/actFrames.json`. `Hud.ts` and layout
  untouched.

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

1. **Wiring the action frames** (the feel agent, `feel/round5`): `actFrames(...)` in `WorldScene` for tool use and
   the actions, the contact effects on frame 2, origin 40/44. Then retire the round-4 `player_tool_*` frames to
   free chars-atlas space.
2. **`place` is weak:** neither Flow variant kept the crate in the cut, and facing right has only 2 frames.
   Regenerate it (a single row per facing helps the cutter), or draw the crate in.
3. **Fidelity seams:** the bodies are Flow's (three-quarter in the down rows) under our front-facing head; a few
   back-view frames turn sideways, because the model mixed facings. The critic's review will say which frames to
   hand-correct (in the crops, then `build.py --sprites`).
4. **The chars atlas is full** (512x1024): split it (a `chars2` atlas group) before the next batch.
5. **Layout (the UI owner):** tall sheets cut through the HUD goal plate; the menu tabs are crowded at 1x.
6. Round 4 leftovers: a 9 px side stride, the statue's footprint, mine and woods details, winter paths.

## Questions for the owner

- **Look on a phone:** the animations were judged only from headless renders and GIFs.
- **Footprints:** may the animal houses and town landmarks get real 2x2 or 3x2 footprints?
