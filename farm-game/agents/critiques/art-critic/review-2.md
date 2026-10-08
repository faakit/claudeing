# Review 2 / final round (commit 246fdf6), 2026-10-08

Frozen copy round-2/farm-game: build ok, 398/398 tests, perf within budget (2-3 draws, <=1.32 ms JS at 6x).
Shots: round-2/shots (plum default), round-2/shots-walnut, contact_x1.png; evidence r2_roof_zoom.png, r2_tileset_3x.png.

Verdict: the session ends with solid foundations (palette, outline, characters, pipeline, records) but the player-visible
world and UI look almost the same as round 1: none of the round-1 findings were implemented, the 152 new tiles and the
map-layer generator are not wired in, and plum is still the default.

New findings:

- R2-1 major: clay roofs are 1-row alternating red/orange stripes, high-frequency banding that is the loudest thing on
  screen; the sand ridge cap is a 1 px line that does not read (r2_roof_zoom.png). Ask: staggered tile courses (tiles
  ~4 px wide, 3 px courses offset by half, 1 px wine shadow under each course, orange only as a small highlight),
  2-3 px sand ridge cap with ink outline, eaves with an ink line and a 1-2 px shadow on the wall below.
- R2-2 minor: in the new edge tiles, grass-to-path/plot transitions carry a dark ink-like lip; terrain should use a
  leaf-dark/teal shade lip, ink is for objects and interactive things, or the ground reads as stickers.
- R2-3 minor: tree/bush tiles with a grass base square in the extra tileset: only place them on grass (R1-10 repeat).
- Good: the prop set (barrels, crates, well, scarecrow, laundry line, lamps, mushrooms, crystals, rugs) is
  characterful and on-palette, and carved mine walls with top faces are exactly the right idea.

Round-1 findings: all still open (recorded in agents/NEXT-STEPS-ART.md with concrete fixes): R1-1..R1-10.
