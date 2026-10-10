# Review 8: proportion audit (art/round3 at ee8b67e), 2026-10-09

Frozen copy: `round-6/art-round3/farm-game` (HEAD ee8b67e; the art agent's uncommitted work is excluded). It builds.
Perf baseline is 2-4 draws and at most 1.39 ms of script per frame at 1x across 10 scenarios.

- **Lineup shots:** `round-6/art-round3/shots/` (`lineup_a`, `lineup_b`, `town`, `woods`, `farmhouse`, each also as
  `_4x`), made by `tools/proportion-shots.mjs`.
- **Annotated evidence:**
  - `round-6/r8_scale_sheet.png`: every key sprite at 3x next to the player. The yellow box is the recommended size;
    the grey line is the player's height.
  - `round-6/r8_farmhouse_annot.png`, `r8_woods_annot.png` and `r8_town_annot.png`: measurements in place.

**Ruler:** the player is 28 px tall (crown to feet), so 16 px is roughly 1 m. Sizes below are opaque pixels,
width x height. "Gameplay" means collision, interact tiles or footprints. None of the recommendations moves a
collision or interact tile, unless a row says otherwise and marks it as an owner decision.

**Verdict:** the owner is right. Two scale systems are mixed. Characters, crops and props are drawn at roughly human
scale. Trees, animal houses, landmarks, lamps and the farmhouse walls are squeezed into one tile, and placed objects
are pushed up to 16 px whatever their real size. The worst offenders are:

- trees smaller than the player
- a barn smaller than the cow standing next to it
- house facades 16 px tall with a 28 px player standing at the door
- a sprinkler as big as a keg

## Method

- Opaque bounds of every frame in `world`, `chars` and `ui`, and of the named tiles in `tiles.png`.
- In-game lineups of every placeable, the trees by age, animals, crops by stage and forage, next to the player
  (`lineup_a` and `lineup_b`).
- Map renders and town and woods shots for the baked trees, buildings and props.

## Scale table

### Trees (priority 1)

The rule: the trunk stays on its one tile, and the crown grows up and out as an overhead canopy that fades near the
player. The fade already exists; widen its radius so it covers the player's tile and the target tile.

| thing                                              | now                                                     | recommended                                                                                                                       | why                                                                          | gameplay                                                                              |
| -------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Fruit tree, grown (`obj_tree_*_sapling`, all four) | 16x21 (1 tile)                                          | **32x40** (2x2.5 tiles): trunk 4-6 px wide, about 14 px on the base tile; crown 32 wide, about 26 tall; fruit 3-4 px on the crown | A fruit tree should be clearly taller than a person; today it is chest-high. | No. 1-tile solid trunk; the crown is overhead. Interact stays on the trunk tile.      |
| Fruit tree, young (`obj_sapling`)                  | 11x19, one state for every age below grown              | 3 states: **seedling 8x10, sapling 12x20, young tree 20x28**, then grown 32x40                                                    | Growth should be visible; one bare stick for all ages hides progress.        | Art plus a sprite pick by age in the fruitTree behavior's `sprite()`; no rule change. |
| Forest/grove trees (baked canopy)                  | crowns about 16-20 px (1 tile), trunk row at the bottom | **32-40 px wide crowns, 44-56 px tall**, overlapping into a mass; trunks every 1-2 tiles on the front row                         | A forest border of 1-tile crowns reads as a hedge of shrubs.                 | No. The solid cells are unchanged; crowns go on the overhead layer.                   |
| Lone decor tree, round (farm, woods, town)         | about 15x16                                             | **28-32 x 40-44**                                                                                                                 | Today it is smaller than the player's head and torso.                        | No (overhead crown).                                                                  |
| Pine                                               | about 14x18                                             | **20-24 x 40-48**, pointed                                                                                                        | It should be the tall, narrow silhouette, contrasting with the round oak.    | No.                                                                                   |
| Birch                                              | about 12x18                                             | **20 x 40**, light trunk 3 px                                                                                                     | Slender and tall.                                                            | No.                                                                                   |
| Old oak (woods landmark)                           | about 19x28                                             | **56-64 x 56-64**, gnarled trunk 2 tiles wide at the base                                                                         | A landmark you could draw from memory; today it is shorter than the player.  | Trunk solid stays on its existing tile(s); the crown is overhead.                     |
| Bushes (round, berry, rose, small)                 | 13-16 x 10-14                                           | keep (about 16x14); small bush 10x10                                                                                              | Shrubs at about 0.8 m are already right.                                     | No.                                                                                   |
| Stumps, logs                                       | about 16x12                                             | keep                                                                                                                              | Correct.                                                                     | No.                                                                                   |

### Buildings and landmarks (priority 2)

| thing                                                             | now                                                              | recommended                                                                                                                                       | why                                                                                        | gameplay                                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Farmhouse (baked)                                                 | 144 wide; roof about 68 deep; **facade 16 px**; door about 14x20 | Same footprint. **Facade 32 px (2 tiles)**, roof about 52 px, door **14x26** with a step, windows 10x12 at head height (y 14-26 above the ground) | The walls are lower than the player, so the house reads as a dollhouse under a giant roof. | No. Re-split the same rectangle: fewer roof rows, more wall rows. The door tile stays put.              |
| Town houses and shop (baked)                                      | facade about 16-20 px, door about 20                             | Same: **facade 32 px, door 14x26**, shop awning above head height                                                                                 | Same reason.                                                                               | No (same rectangles).                                                                                   |
| Coop                                                              | 16x17 on 1 tile                                                  | **24x24** now (8 px overhang up, 4 px each side); ideally a 2x2 footprint, 32x32                                                                  | A coop smaller than the player is a birdhouse.                                             | Art-only at 24 px. **A 2x2 footprint is an owner decision** (placement rules, saves).                   |
| Barn                                                              | 16x15                                                            | **28x28** now; ideally 3x2, 48x40                                                                                                                 | Today the barn is smaller than its cow (16x12).                                            | Same as the coop.                                                                                       |
| Shed                                                              | 16x16                                                            | **24x22**; ideally 2x2                                                                                                                            | Same reason.                                                                               | Same.                                                                                                   |
| Sty                                                               | 16x14                                                            | **24x18** (low fence and roof)                                                                                                                    | A pen should be wider than tall.                                                           | Same.                                                                                                   |
| Silo                                                              | 15x24                                                            | **16x40** (narrow and tall, overhead top)                                                                                                         | A silo is the tallest farm building.                                                       | No (1 tile, grows up).                                                                                  |
| Town-project landmarks (bathhouse, library, fair hall, market...) | 16x13-20 on 1 tile                                               | **32 wide x 32-40 tall**, overhang only toward the open side; or 2x2 footprints (owner decision)                                                  | A bathhouse in one 16 px tile is a toy.                                                    | Overhang is visual only, but check neighbouring tiles in town. A footprint change is an owner decision. |
| Statue levels 1-5                                                 | 12x16 up to 16x31                                                | keep. Level 5 at 31 px is right for a statue on a plinth.                                                                                         | Already correct.                                                                           | No.                                                                                                     |

### Animals and villagers

| thing                             | now   | recommended                     | why                                       | gameplay                                                  |
| --------------------------------- | ----- | ------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| Cow                               | 16x12 | **24x18** (side view, 2 frames) | A cow is about 1.4 m tall and 2.4 m long. | No; animals are cosmetic and stand in front of the house. |
| Sheep                             | 14x11 | **18x14**                       |                                           | No.                                                       |
| Pig                               | 14x9  | **18x12**                       |                                           | No.                                                       |
| Chicken                           | 10x11 | keep (10x10)                    | Correct.                                  | No.                                                       |
| Villagers (26-30 px), player (28) | -     | keep                            | Decided in round 1.                       | No.                                                       |

### Machines

| thing            | now          | recommended                         | why                                                                     | gameplay |
| ---------------- | ------------ | ----------------------------------- | ----------------------------------------------------------------------- | -------- |
| Preserves jar    | 13x18        | **12x14**                           | A jar should not be keg-sized.                                          | No.      |
| Keg              | 16x16        | keep or 14x16                       | Correct.                                                                | No.      |
| Loom             | 16x17        | **16x22** (frame above the cloth)   | A loom is chest-high.                                                   | No.      |
| Furnace          | 13x18        | **16x22** (chimney above)           |                                                                         | No.      |
| Bee house        | 14x18        | keep (12x18)                        | Correct.                                                                | No.      |
| Sprinkler (both) | 16x14, 16x16 | **10x10** (quality sprinkler 12x12) | A sprinkler is a small head on the ground; today it reads as a machine. | No.      |

### Props and furniture

| thing                       | now         | recommended                                   | why                                                    | gameplay                   |
| --------------------------- | ----------- | --------------------------------------------- | ------------------------------------------------------ | -------------------------- |
| Garden lamp (placeable)     | 10x20       | **8x36** (head above the player's head)       | A lamp post shorter than a person looks like a candle. | No (1 tile, grows up).     |
| Town and road lamps (baked) | about 8x22  | **8x36**                                      | Same reason.                                           | No.                        |
| Scarecrow                   | 16x23       | **16x30**                                     | Person-sized.                                          | No.                        |
| Flower pot                  | 13x16       | **10x12**                                     | It is the size of a bench today.                       | No.                        |
| Garden bench                | 15x16       | **16x14** (low seat, seat line at about 8 px) |                                                        | No.                        |
| Fountain                    | 16x14       | keep, or 24x20 overhang                       | Fine for a garden piece.                               | No.                        |
| Fence                       | 16x11       | **16x14** with posts                          | About 1 m.                                             | No.                        |
| Well (baked)                | about 16x20 | **20x30** with roof and winch                 | The well is the town's centrepiece.                    | No (solid tile unchanged). |
| Mailbox                     | 12x18       | keep                                          | Correct.                                               | No.                        |
| Shipping bin                | about 14x18 | keep                                          | Correct.                                               | No.                        |
| Signs, board                | 14x15       | keep                                          | Correct.                                               | No.                        |
| Mine cart                   | about 14x12 | keep                                          | Correct.                                               | No.                        |
| Bed (house)                 | about 18x29 | keep                                          | It fits the player.                                    | No.                        |
| Rowboat                     | about 12x27 | **16x36**                                     | A 28 px person should fit in it.                       | No (decor on water).       |
| Lilies, reeds               | about 8 px  | keep                                          | Correct.                                               | No.                        |

### Crops

| thing                                                                                       | now           | recommended                                    | why                                                                                                    | gameplay |
| ------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| Seed mound, stages 1-2                                                                      | 10x9, 6-12 px | keep                                           | Readable.                                                                                              | No.      |
| Low crops at maturity (parsnip, potato, cauliflower, kale, melon, pumpkin, strawberry, yam) | 14-16 x 13-16 | keep                                           | Correct for a 1-tile plot.                                                                             | No.      |
| Tall crops (corn, tomato, snow pea) at maturity                                             | 12-16 x 17-24 | corn **12x26**; tomato and snow pea keep at 24 | Corn should be about the player's height. Stay at or under 26 so a row doesn't hide the row behind it. | No.      |

### Forage, drops and UI icons in the world

| thing                                | now                                                                       | recommended                                                                                                  | why                                                                                                       | gameplay |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------- |
| Forage on the ground                 | the 16 px item icon at **scale 0.8 (12.8 px)** (`ObjectsRenderer.ts:221`) | dedicated **10-12 px world sprites drawn at 1x** (leek, mushroom, daffodil...), keeping the ring and twinkle | A non-integer scale drops pixel rows (it breaks the crisp-pixel rule), and a 16 px mushroom is knee-high. | No.      |
| Ready bubble on houses, twinkle star | scale 0.8                                                                 | 1x; author an 8-10 px bubble icon                                                                            | Same crisp-pixel issue.                                                                                   | No.      |
| Item pop                             | tweens from 0.5 to 1x, ends at 16 px                                      | keep the 1x end; snap the tween to 0.5 / 1 steps                                                             | Only transient.                                                                                           | No.      |
| HUD bolt and drop icons              | scale 0.8 (`Hud.ts:117,121`)                                              | 1x                                                                                                           | Crisp-pixel issue, minor.                                                                                 | No.      |
| UI item icons (16x16)                | -                                                                         | keep. Menus are UI scale, not world scale.                                                                   |                                                                                                           | No.      |

## Readability side effects to guard

1. **Canopies over gameplay:**
   - Bigger crowns will cover crops, forage, the target marker and doors.
   - Keep the overhead fade (45%) and widen its radius to about 24 px around the player and the target tile.
   - Never bake overhanging canopy over forage zones, plots, doors or the plot-sale signs (the generator already knows
     the reserved cells).
   - Grown fruit trees placed by the player overhang their neighbours by 8 px each side and 24 px up. Their crown must
     go on the overhead layer and fade like the rest.
2. **Fruit must still read:** fruit on a 32 px crown needs its own 1 px outline or contrast, and the "ready" star sits
   above the crown (y - crown height), not at y - 17.
3. **Animal houses at 24-28 px:** they overhang neighbouring tiles. Keep their residents in front (`y + 6` already), and
   make sure an adjacent machine's ready star is not hidden (depth by base y already handles it; check in a lineup).
4. **Perf:** baked canopies are tile layers, so no extra draws. Bigger placeable frames stay in the world atlas
   (today about 300 px; 32x40 frames add little), so 2-4 draws remain. Re-run `npm run perf` and check the atlas stays
   at or under 1024.
5. **Collision honesty:** a crown or facade growing upward over a walkable tile is fine, because it is overhead. A
   facade growing downward is not. Keep every building's bottom row where it is.

## Prioritized fix list (as sent to the art agent)

1. **Trees:**
   - fruit trees 32x40, with three young stages
   - forest and grove crowns 32-40 wide and 44-56 tall
   - lone oak, pine and birch at 28-32/20-24/20 wide and 40-48 tall
   - the old oak at 56-64
   - all crowns overhead, with the fade widened
2. **Facades:** farmhouse, town houses and shop at 32 px with 14x26 doors (re-split, same rectangles).
3. **Animal houses and silo:** coop 24, barn 28, shed 24x22, sty 24x18, silo 16x40. Ask the owner about 2x2/3x2
   footprints.
4. **Animals:** cow 24x18, sheep 18x14, pig 18x12.
5. **Lamps:** 36 px tall, both the placeable and the baked ones.
6. **Small things:** sprinkler 10x10/12x12, jar 12x14, flower pot 10x12.
7. **Landmarks:** 32 wide, 32-40 tall, overhanging only toward open ground.
8. **World icons:** forage at 1x with 10-12 px sprites, no 0.8 scales; bubble and twinkle at 1x.
9. **Remainder:** scarecrow 30, loom/furnace 22, fence 14, well 20x30, rowboat 16x36, corn 26.
