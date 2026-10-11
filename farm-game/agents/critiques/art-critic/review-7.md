# Review 7 / final round of art round 2, commits b321e29 (code), f9d5e50 (docs), 2026-10-09

Frozen copy round-6/farm-game: build ok, 478/478 tests, my shots round-6/shots (no console errors), perf 2-4 draws,
<=1.04 ms JS at 1x across all 7 scenarios. Agent shots: round2/final/. Evidence: round-6/f_newgame.png, f_close.png,
f_toast.png, f_mine_zoom.png, final_sheet.png.

Verdict: art round 2 is done to a good standard: cohesive palette, authored maps with a signature, warm stepped night,
real seasons, walnut/parchment UI as default. One small UI leftover.

Fixed: R5-1 (mine darkness follows walls/bays, no tile squares, grit instead of dashes), R5-2 (wall glow ends in
orange/earth, solid cores), R5-3 (roof sky band + cast shadows on snow), R5-4 (asymmetric hills, tree, lit farmhouse,
embossed wood logo with the carved sprout), R0-3 (toast is a walnut plate with parchment text), R6-3 (hatch band clear of
glyphs), R6-4 (one knot).

Open:

- R6-2 minor: title "New Game" still renders parchment glyphs with an ink offset (doubled look) on the sand button
  (f_newgame.png); in-game buttons ("Close") are clean, so it is the TitleScene label style only.
- R5-5 minor: tool-pose head ~2 px small (logged for the pose redo).
- R3-6 transferred: target marker over the player facing up belongs to the controls agent (TileHighlight.ts).
