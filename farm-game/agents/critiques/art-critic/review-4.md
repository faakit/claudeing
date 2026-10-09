# Review 4 (art round 2, pass 2: review-3 fixes + atmosphere), commits e0d2e0e, b056201, 5e9fe92, 2026-10-09

Frozen copy round-4/farm-game: build ok, my shots round-4/shots (no console errors), perf 2-4 draws, <=1.11 ms JS at 1x
including the new town-night, woods-fireflies and woods-petals scenarios. Agent shots: round2/pass2/.
Evidence: round-4/r4_lamp_glow.png, r4_mine_dither.png, r4_winter_roof.png, r4_chars.png, r4_sheet0-2.png.

Verdict: atmosphere lands structurally (seasons without multiply, rose dusk, warm interiors, sparse fireflies), but the
outdoor glow colour, the mine dither and the winter roofs need another pass.

Fixed: R1-7 Clay (red jacket, cowlick, straw), R1-8 seams, R3-3 scatter (copses), R3-4 crystals on walls only, R3-5 mine
bays/faces/beams, R3-7 water grid, R3-8 yard vignettes, R3-9 well on the square + mixed border, R1-9 dusk (rose, sand no
longer orange) and per-season tilesets (with the issues below).
Accepted (coordinator rulings): R3-1 ponds stay rounded rectangles (collision fixed); R3-2 groves only outside forage
zones. Transferred: R3-6 target marker to the controls agent (TileHighlight.ts).

1. major - outdoor glow is lime over grass and clips to white (lamp cores, window spill as a white blob on the wall).
2. major - player halo outdoors reads as a green spotlight/selection disc.
3. major - mine floor covered in checker dither day and night; screen-door noise.
4. major - winter roofs read as blue tiled roofs (course grid palette-swapped), chimney too.
5. minor - winter ground speckle busy; blue scribble flora ghost.
6. minor - fall ground cue is rash-like speckle; prefer leaf litter under trees.
7. minor - summer nearly identical to spring (optional cue).
8. nit - window boxes bloom pink in winter.
