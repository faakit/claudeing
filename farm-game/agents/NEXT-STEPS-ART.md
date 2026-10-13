# Art: next steps (handover, proportions round, 2026-10-12)

Branch `art/proportions`, from the deployed `integration/dry-year-2` (288965d). Nothing else was merged in. Art critic:
a3d6d90a1b2a0124d (reviews 35 on, outside the repo); it accepted checkpoint 9b61b9b (review 36, no blockers or
majors). Every item was judged in its scenario at the iPhone 13 and SE sizes in headless Chromium. Nobody has looked at
it on a real phone.

The owner asked for two things:

- "Some things in the city feel out of proportion. There is a small house above Finn that does not match a character
  size."
- "The town store has 3 doors, that is simply strange, it could be a bigger one."

## The scale rule (DECISIONS.md, "Proportions round 2"; the critic's D35-1)

C is the character: a 32 px frame, 26-30 px opaque.

- **R1 Doors.**
  - One entrance per facade; a shop may have one double door instead.
  - A door's frame plus step is at least 30 px tall, with an opening of at least 26 px.
  - A single door is at least 14 px wide; a double door is 28-32 px wide.
- **R2 Walls.** At least two rows (32 px) of front wall on any building people live or work in, with the windows at
  head height.
- **R3 Buildings.** At least 3 tiles wide and 4 rows tall.
- **R4 Passages.** A passage is at least 24 px wide, and it is either at least 34 px clear or open at the map's edge.
- **R5 Props.**
  - Crates and furniture: at most 0.6 C.
  - Lamps and roof supports: at least 1.1 C.
  - Fences: 0.4-0.6 C.
- **R6 Matching sizes.** Things that match other things share a size (landed timber matches the tow logs).

## Shipped this round

1. **Rosa's cottage**, the house above Finn's town spot (16,22), in all three town stages.
   - It grew a row north, from (14,16,4,3) to (14,15,4,4), so it now has a 32 px wall, the tall door, and its windows
     and their night lights at head height.
   - The new row is drawn after the scatter, so no flower or tree moved.
   - **Walkability change, on purpose:**
     - row 15, x 14-17, is solid;
     - the stone lantern moved from (15,14) to (18,14).
   - `tests/fixtures/town-before-m6.json` was updated for exactly those six cells. The critic's walk_diff found
     exactly these cells, the same in every stage.
   - Before: a 16 px wall and a door about 12x16, under 0.6 of a character. After: a wall the same height as Clay's
     and Orin's houses.
2. **The store's one double door.** The art is 30 px wide with glazed leaves and a hanging shop sign west of it,
   replacing three single doors with awnings.
   - The three shopdoor cells, their collision and the shop's trigger (4,9, 3 wide) are unchanged.
   - map-art draws any run of exactly three door cells as one double door (`f_ddoor_<l|c|r>_<top|low>_slate`). It is
     the only such run in the game. No other building has repeated doors.
3. **Every tall door 4 px taller.** The frame went from 24 to 28 px on its 2 px step, with a 26 px opening. This
   covers:
   - the farmhouse, Clay/Marls, Orin and Rosa;
   - the boarded pieces;
   - the DoorFx frames (`obj_door_open_*`, motion.py);
   - `obj_house_marls_2..4`, recomposed from the map.
4. **The mine.**
   - The exit's timber portal: posts hugging the 2-tile passage and a lintel 34 px over the floor (it was 18).
   - The hall's roof supports (`t_beams`) are 3 tiles, 42 px tall (they were 16x18 frames).
5. **The woods' mine mouth.** A dark opening the full height of the top row between timber jambs (it was a 12 px
   arch). About 20 px of it shows under the HUD; R4's map-edge clause accepts that (R36-2).
6. **The slip's timber stack.** Its logs are 16 px, a towed short log's length (they were 12).

All six are drawn in code in `art-src/tools/scale.py`: palette indices, 2 px features, no alpha.

## Audit: checked and within the rule

- **Town:** Clay's/the Marls' house with its boarded and scaffold stages, Orin's smithy, the well, the lamps (36 px),
  the signs, the stone lantern, the fences and flowerbeds, and the board.
- **The farm:** the house (its door is now 30 px), the fences, the creek's footbridge.
- **The woods.**
- **Wendhead:** the spring and weir sites (a low stone mouth and a low weir wall with its sluice), the weir span, the
  bridges, the fences.
- **The mine,** after the fixes.
- **The house interior:** the bed is 24x31 (about 1.1 C), and the furniture and fireplace are 0.6 C or less.

## Next steps (open, by priority)

1. **Stated exceptions (follow-ups, not changed this round):**
   - **One-tile placeables** (barn, shed, coop, sty, silo). Each is a token on the single tile that `placeables.json`
     gives it. The barn is about as tall as the farmer, and the shed's door is about 10x14. Fixing them needs
     multi-tile footprints, a design-lane change. Then the art can draw them at R2/R3 size.
   - **Project landmarks** (`projects.json`: fair hall, market, library and the rest). These are 32x40 kiosks on one
     solid tile. They read as kiosks, so they fit the rule as props; buildings would need bigger footprints.
   - **The Heron** (30 px long, about 0.95 C) **and the mill wheel** (32 px). Both are pinned by the drift `blocks`
     in valley.json (`[18,28,1,2]` and `[21,30,2,2]`). Larger art would cover water where logs float, so the depth
     lane would have to move those blocks first.
2. **Older open items:**
   - R30-3: in `tow-spike`, the rock against the tilted log (the builder's depth).
   - Tobin's and Wren's `HOUSES` entries, once they have positions.
   - Wendhead's look.
   - R23-1: the title sky's dithers.
   - Perf on a quiet machine (see below).

## Scenarios and probe

- `town-proportions` (dry), `town-proportions-river`, `town-proportions-marls`:
  - in `-river` the farmer stands beside the cottage, on the door step's baseline (R36-3);
  - in the other two he stands on the step;
  - Finn is at (16,22) in all three.
- `town-store-door`, `mine-portal`.
- `farm-door-proportions`: walking up plays the taller door's open frames.
- `agents/probes/proportions.mjs` shoots all of them at i13 and SE, plus the door strip. My shots are in
  `C:/Users/andre/dev/tiny-acre/art-scratch/prop/`.

## Verified and not verified

- **Verified:**
  - `verify:fast` was green before each commit.
  - The full `npm run verify` passed lint, typecheck, test, build, e2e, e2e:mobile, e2e:onboarding, e2e:joystick,
    e2e:feel (flaky beside the other suites, green alone), e2e:scenarios, bundle, lab-map and perf 1x.
  - GL draws are unchanged: the town at night is 5, as on 288965d.
- **Failing, on the baseline too:**
  - **e2e:controls:** the bin and mailbox tap rates, plus swipe and flick timing.
  - **perf 4x/6x pacing:** for example, map changes over 34 ms at 4x.
  - I ran both at 288965d in a temporary worktree on the same machine, and they fail there the same way. The machine
    was loaded: the critic and other lanes were running browsers.
- **Not verified:** a real phone; perf on a quiet machine.

## Merge notes (for the coordinator)

- **Map rebuild:** every `.tmj` changed in its gids, and the tileset grew. After merging, rerun `npm run art:maps`.
  If a merge touches door or tileset art, also run a full `python art-src/tools/build.py` and then `generate-maps`
  again, because `houses.py` composes the Marls' house stages from the tileset on disk.
- **Shared files touched:**
  - `scripts/generate-maps.mjs`: the cottage's extra row, after the scatter.
  - `scripts/map-art.mjs`: the double-door run, the mine portal, the props list (lantern, mine beams).
  - `tests/fixtures/town-before-m6.json`: 6 cells.
  - `src/dev/lab/lab-map.json`: regenerated, art layer only.
- **Coordination:** depth/bait-board's town quest board must not use x 14-17, rows 14-18 (the cottage and its eave),
  or 18,14 (the lantern).
- **Text baked into images:** none (the shop sign shows a coin).

## Rulings standing

D20-1, D21-1, D21-2, D23-1, D24-1 and D25-1, as before. New: D35-1, the scale rule above.

## Flow usage this round

None. Every new piece is drawn in code, because Flow came out as gravel at this size in earlier rounds.
