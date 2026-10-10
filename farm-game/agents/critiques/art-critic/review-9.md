# Review 9 (proportions pass), art/round3 c3de265 (code) / 41ef18f, 2026-10-09

Frozen copy round-7/farm-game: build ok, perf 2-4 draws, <=1.26 ms JS at 1x (10 scenarios). Agent shots:
round3/proportions/ (cmp_*, after/). Evidence: round-6/r9_fade_disc.png, round-6/r9_lamp.png.

Verdict: the scale problem is solved where it mattered most: trees now tower over the player, the forest reads as a
forest, houses have walls you can walk through, farm buildings and lamps are believable. Remaining issues are the fade
treatment and a few undersized fallbacks.

Fixed: R8-1 (fruit 32x40 with 3 young stages, forest 32-40 crowns, oak/birch/pine 30x44/20x40/22x44, old oak ~60, no
overhang over reserved cells), R8-2 (32 px facades, 14x26 doors), R8-4 (sheep, pig; cow 19x14 native, accepted),
R8-5 (lamps 36), R8-6 (sprinkler, jar, pot), R8-8 (1x world sprites for forage, bubbles, twinkle), R8-9 (scarecrow,
loom, furnace, fence/bench placeables, rowboat 12x32, corn 26).
Partial (accepted for now, source-limited): R8-3 barn 24x22 (not bigger than the coop 23x24), R8-7 landmarks 20-24.
Transferred: HUD bolt/drop scale (Hud.ts is the controls agent's). Recorded: 2x2/3x2 footprints as an owner/depth decision.

1. major - the 45% alpha fade turns the player green and semi-transparent under a crown (r9_fade_disc.png): a
   translucent disc with a visible edge, the player and target marker tinted. Pixel-art fade: cut a dithered hole
   (checker rim, fully clear inside ~12 px around the player and target) or drop to ~25% with a 1 px checker edge.
2. minor - thin tall props fade too (farm lamp post near the door goes ghostly and its head vanishes, r9_lamp.png).
   Exclude lamps, posts and signs from the fade; they hide nothing.
3. minor - fallback "small" lone trees (about 16-24 px) remain on the farm lawn and in the woods interior (after/map_farm
   x~300,390 / 685,390 / 175,995; map_woods x~270,100 / 365,230 / 400,705 / 560,645). A tree shorter than the player
   reintroduces the problem: replace those spots with bushes, stumps or a deliberate young tree, or allow the canopy
   under the player there.
4. minor - barn not visibly bigger than the coop; new Flow source for a 32x28 barn (owner approved Flow downloads).
5. nit - well 20x30 and baked map fences still pending; item-pop tween snap.
