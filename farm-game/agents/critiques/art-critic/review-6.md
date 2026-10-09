# Review 6 (walnut skin as default), commit 1ec1f68, 2026-10-09

Scope check: diff touches theme.ts, widgets.ts, Hud.ts (dock fill only), MenuPanel.ts (2 tokens), main.ts (background
colour). No geometry, layout, input or layout.ts change: within the coordinator's guard.
Agent shots: round2/walnut/. Evidence: round-5/w_title_btn.png, w_board_give.png, w_farm_dock.png, w_sheet.png.

Verdict: walnut as default approved. R1-1, R1-2, R1-3, R1-4, R1-6 fixed; R1-5 fixed (coin glyph skipped, needs layout: accepted).

1. major - R0-3 still open: the welcome/hint toast is the old translucent grey band with green or white text over the world
   (w_farm_dock.png top). Colours/texture only: walnut plate + ink rim + parchment text.
2. minor - title "New Game": ink text carries a light drop shadow, glyphs look doubled/embossed (w_title_btn.png).
3. minor - disabled "Give": hatch runs through the glyphs; clear a 1 px halo around text or hatch only the border band.
4. nit - the dock knot at x96 sits just right of "Drag to walk"; move it under the hotbar edge or drop it.
