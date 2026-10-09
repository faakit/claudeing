# Tiny Acre art direction: final report (updated 2026-10-09, after art round 2)

There were two art sessions:

- **Round 1:** branch `art/atlas`, ending at commit 246fdf6.
- **Round 2:** branch `art/round2`, created from `integration/agents-2026-10-08`. The last code commit is
  **b321e29**; **f9d5e50** adds only the handover docs.

My frozen copy of f9d5e50 builds, passes 478/478 tests and stays within the perf budget. It draws 2-4 times per frame
and spends at most 1.04 ms of script per frame at 1x, across all 7 perf scenarios (limits: 12 draws, 3.5 ms). That
includes town at night, woods with fireflies, and woods with petals. Everything was judged from headless
screenshots; nobody has looked at it on a real phone.

Reviews 0-7 are in this folder, every finding with its status is in `ledger.md`, and the frozen copies and
evidence crops are in `round-1/` to `round-6/`.

## The four decisions (reasoning in decisions.md)

1. **Palette: done.** The v2 ramps replace the derived palette, with ink `#2a1a24` set explicitly as the one
   outline colour.
2. **UI skin: done.** Walnut chrome with parchment panels has been the default since 1ec1f68; `?skin=plum` still
   gives the old UI. It changes only colours and textures, so it doesn't conflict with the controls agent's one-thumb
   rework of the dock and HUD.
3. **Villagers: done.** All humans share one body style. Heights: player 28, Mara 28, Finn 29, Rosa 26, Orin 30
   (in a 24x32 frame), Clay 28. Clay now wears his own rival colour: a red jacket, a cowlick and a straw in his mouth.
4. **Flow licensing: recorded.** ASSETS.md holds the provenance and the terms versions relied on, and the prompts no
   longer name a genre style. This is not legal advice: you must re-read Google's terms in force and decide before
   any store release.

## Open findings by severity

There are no blockers and no majors left.

**Minor**
- R6-2: on the title screen, "New Game" still has doubled-looking letters (light letters with a dark offset on the
  sand button; see `round-6/f_newgame.png`). In-game buttons are clean, so this is only the title screen's label
  style. It is a one-line fix.
- R5-5: the tool-use pose's head is about 2 px smaller than the player's. It shows for about a quarter of a second
  and is logged for when the poses are redone.

**Transferred**
- R3-6: when the player faces up, the target marker's brackets draw over the player's head. This belongs to the
  controls agent (`TileHighlight.ts`).

**Accepted under the coordinator's rulings**
- R3-1: ponds stay rounded rectangles, because their water tiles and collision can't change.
- R3-2: groves only go outside the forage zones.
- R1-5: no coin glyph next to "Gold", because it would need a layout change.

## What improved because of the conversation

**Foundations (round 1)**
- The outline was the darkest colour, picked automatically: a hot red-black, not the documented brown, and 28% of
  all pixels. It is now ink, set explicitly.
- The palette had five near-blacks you couldn't tell apart. It is now ramps by role, at least 32 RGB units apart
  instead of 11.
- The characters were two art styles. They are now one cast.
- The plum UI was off the palette and hid icon outlines. It is replaced.
- The "classic 16-bit farming RPGs" phrase is gone from the prompts.

**Maps (round 2)**
- Flat lawns became authored layers: walk-behind tree canopy, shorelines, grass creeping onto paths, carved mine walls.
- Clay-tile roofs with staggered courses, a ridge cap and eaves.
- Landmarks: a farmhouse with a chimney and rooster weathervane, a crooked oak, a cobbled square with a well, Orin's
  forge, Finn's rowboat, a mine cart and rails, and a rose-wallpaper house.
- Props are grouped into small scenes instead of scattered evenly.
- Decorative crystals were taken off floor boulders, so they no longer look like gem nodes.

**Atmosphere**
- Seasons are their own tilesets instead of a multiply tint.
- Dusk shifts toward rose instead of turning sand orange.
- Night glow went from lime and blown-out white to warm stepped rings, with window light pooling on the ground.
- The spotlight halo around the player and the checker noise in the mine are gone; mine darkness follows the walls.
- Winter has snow-mass roofs and a cast shadow on the snow.

**Signature**
- A rose-pink wildflower that recurs across the valley.
- Carved-sprout signs and board.
- A sunset title on the palette, with a hill farmhouse and an embossed wood logo with the sprout on the "I".

**UI**
- Walnut and parchment is the default, with no grain behind text, one sand slot style everywhere, one gold
  selection style, ink button text, and the toast as a walnut plate.

## What the owner should look at first

1. `farm-game/agents/out/art-shots/round2/final/f_title_phone.png`, then `f_farm_phone.png`, `f_inventory_phone.png`
   and `f_shop_phone.png`: the first impression and the new UI.
2. `round2/final/maps/` (whole-map renders), then the town and farm at day, dusk and night
   (`f_town_center_*`, `f_farm_house_*`): the world's identity and its lighting.
3. The winter and fall views (`f_*_winter_day`, `f_*_fall_day`): the season tilesets.
4. The villager lineup: `farm-game/agents/out/art-shots/villagers-lineup-6x.png` from round 1 (Clay's new look shows
   in the town shots).
5. Before any store release, decision 4 in `decisions.md` and the record in `ASSETS.md`.

Suggested next art work, beyond `agents/NEXT-STEPS-ART.md`:
- Fix R6-2.
- Redo the tool-use poses on the player's head.
- Look at everything on a real phone, both in sunlight and at night brightness.
