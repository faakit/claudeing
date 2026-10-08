# Tiny Acre art direction: final report (2026-10-08)

Art branch `art/atlas`, final commit **246fdf6** (git status clean). Rounds: decisions (round 0), review 1 (3bb27f2,
84b7d8d) and the final round (246fdf6). My frozen copy of the final commit builds, passes 398/398 tests and stays
within the perf budget: 2-3 draws per frame and at most 1.32 ms of script per frame at 6x CPU throttle (limits are
12 draws and 3.5 ms). All judgements come from headless screenshots, not a real phone.

## The four decisions (full reasoning in decisions.md)

1. **Palette:** replace the k-means palette with the hand-tuned v2 ramps, with ink `#2a1a24` as the one outline colour,
   set by slot. **Done.**
2. **UI skin:** dark walnut for the HUD and controls, parchment for menus, on the palette. **Approved as the
   direction**; it is still behind `?skin=walnut` because the round-1 fixes are open.
3. **Villagers:** one body style shared with the player; heights 28/28/29/26/30/28 (player, Mara, Finn, Rosa, Orin,
   Clay); Orin broad (24x32 frame accepted). **Done**, apart from Clay's colours and some seam pixels.
4. **Flow licensing:** keep using Flow. The record is in ASSETS.md (account, dates, terms versions, SynthID, "owner to
   re-verify; not verified by counsel"), and the genre-style phrase is gone from the prompts. Not legal advice: the
   owner re-reads Google's terms and decides before any store release.

## Open findings by severity (ledger.md has all of them)

**Blocker**

- R1-1: walnut grain lines run behind HUD text and under the joystick. Use flat walnut behind text, and regular
  planks or flat walnut in the control area.

**Major**

- R1-2: hotbar slots are dark purple, so thin tools lose their outline. Use the sand slot everywhere.
- R1-3: the selected slot is wine in the bag and gold in the hotbar. Use one style: gold ring, 2 px notches, ledge.
- R1-4: enabled buttons like "Close" have dim text and read as disabled. Use ink.
- R1-7: Clay is the third blue-topped man. Give him a signature rival colour and a side-view marker.
- R1-9: the season and dusk tints push the world off the palette (orange paths at summer dusk, no snow in winter).
  Use per-season tilesets built from the palette and softer dusk colours.
- R1-10: the maps are flat. The 152 new tiles and `art-src/drafts/map-art.mjs` exist but aren't wired in. Also: a
  bush on a grass square in the woods pond, a hard rectangular pond, an empty woods, a flat mine, a plain block
  farmhouse.
- R2-1: the new clay roofs are 1-row red/orange stripes, the loudest thing on screen, and the ridge cap doesn't read.
  Use staggered tile courses, a 2-3 px ridge cap and an eaves shadow.

**Minor**

- R1-5: prices and gold in wine read as warnings.
- R1-6: the letterbox and bar row are still navy.
- R1-8: side-view seam pixels on Mara, Finn and Rosa.
- R2-2: edge tiles use an ink lip on terrain transitions.
- R2-3: tree and bush tiles with a grass base must only go on grass.
- R0-4: icons lose their outline in purple slots (fixed by R1-2).
- R0-3: the toast is fixed only in the walnut skin.

No missing textures. 296 of 297 keys have art; `fx_shadow` stays generated on purpose. Atlases are small (tileset
336x144).

## What improved because of the conversation

- **Outline:** the build used to pick the darkest colour automatically. That was a hot red-black, not the
  documented brown, and it was 28% of all pixels. The outline is now set explicitly to ink, and the world no longer
  reads dark and hot.
- **Palette:** the k-means palette had five near-blacks you can't tell apart and no skin, water or night ramps. It
  is now 32 colours in ramps by role, at least 32 RGB units apart (was 11), and the build no longer re-derives it.
- **Watered soil:** it was a flat near-outline fill. It is now dithered, so seed mounds keep their contrast.
- **Characters:** they were two art styles (a big-head player next to small-head villagers who read as children).
  They now share one body style at deliberate heights, the player is consistent in every direction, Orin is broad,
  and there is no resampling smear.
- **UI:** the plum UI was off-palette and hid icon outlines. Walnut and parchment is designed, mocked and approved
  as the direction, with measured contrast (ink on parchment 13:1).
- **Licensing:** ASSETS.md now records provenance and terms. The "classic 16-bit farming RPGs" prompt phrase is gone,
  which cuts genericness and similarity risk.
- **Identity:** the valley signature is adopted: a rose-pink wildflower, red clay roofs with a sand ridge cap, a
  carved sprout emblem. Only the roofs exist so far.

## What the owner should look at first

1. `round-2/shots-walnut/town_day_phone.png` next to `round-2/shots/town_day_phone.png`, and
   `farm-game/agents/out/art-shots/ui-skin-mock-{bag,shop}.png`: the UI direction you are getting.
2. `farm-game/agents/out/art-shots/villagers-lineup-6x.png`: the cast. Note Clay's blue jacket (R1-7).
3. `round-2/r2_roof_zoom.png`: the clay roofs need rework before they spread (R2-1).
4. `round-2/r2_tileset_3x.png`: the unwired prop and edge tiles. That is where the maps' depth will come from.
5. Before any store release, decision 4 in decisions.md.

Suggested next-session order (it matches `agents/NEXT-STEPS-ART.md`):

1. The UI fixes R1-1 to R1-6, then make walnut the default.
2. Clay and the seam pixels.
3. Wire in the map layers, with R1-10, R2-1 and R2-2 as acceptance criteria.
4. The atmosphere pass: season tilesets, dusk colours, particles, night glow.
