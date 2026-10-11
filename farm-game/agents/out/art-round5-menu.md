# Art round 5: the menu sheet background

Branch `art/round5`. Shots: `agents/out/art-shots/round5/{before,after}/` (`<tag>_<sheet>_<profile>_phone.png` is
the phone screen, `_canvas.png` the canvas alone, `_x1.png` that canvas sampled back to 200 x 400). Probe:
`node agents/probes/sheets-round5.mjs <dir> <tag>` (SCENARIO=late-game-farm; the `lab` scenario draws its world
over the UI scene, a devtools quirk, so it is not used for sheets). Headless only.

## What was wrong with the old sheet (bag, shop, bin, board, Options; i13, SE, Pixel 7)

1. **Non-whole-pixel scale on the two most common phones.** The canvas fits at 5.72 device px per game px on the
   iPhone 13 and 3.24 on the SE (`data-fit="fit ..."`); only the Pixel 7 gets a whole 5x. The old sheet's frame was
   made only of 1-2 px stripes (ink, 2 px wood, ink), so each stripe came out 5 or 6 (3 or 4) device px wide at
   random. The frame looked uneven and wobbly, the "buggy" look. The flat fills are fine at any scale; thin lines
   are not.
2. **A hairline, not a frame.** At phone scale the 4 px border running along the screen edges reads as a thin
   outline, with no wood, no corners and no depth, and its sides just run off the bottom of the screen.
3. **Flat placeholder paper.** Tall sheets (bag, Options) are large flat parchment fields with no edge treatment,
   so they look unfinished.
4. **Tall sheets cut through the HUD.** The bag and Options sheets top out across the goal plate and slice its
   progress bar in half (`before_opts_*`). That is layout, not skin; noted for the UI owner.
5. **Off-palette blends.** The drop shadow is ink at 35 % alpha, and the buttons' tan offset shadow (1-2 px) reads
   as misregistration against flat paper. Both come from `drawPanel` and `Button`, which I left alone (shared).
6. **Not background, but it looks broken at 1x:** the six menu tabs are 30 px wide, so "Make", "Skill" and "Opts"
   touch their borders. That is for the UI owner (`MenuPanel`, tab labels).

## The new sheet

- **Source:** Google Flow `ui1` variant b (a parchment sheet in a slim dark-walnut frame with brass corners), out of
  four candidates (`ui1` a/b, `ui2` a/b; `prompts.md` entries 29-30). Native grid 98 x 76 px, quantized to the
  palette (`art-src/flow/crops/ui1b/sheet.png`).
- **Rebuilt on the native grid** (`art-src/tools/uisheet.py`, no resampling): the source frame is 7 px thick, too
  much for the sheets' content insets, so the pieces keep the source's own rows and columns: the ink outline, the
  dark grain, the wood, the light bevel and the ink line at the paper, plus a 1 px sand shadow inside the top and
  left edges. A 5 x 5 brass cap (lamp, gold and orange, inked) sits on each top corner, not mirrored, lit from the
  top-left. The outline is the palette ink everywhere (the source's plum outline is remapped). The centre is
  flat parchment, quiet behind text and icons.
- **Drawn as one texture per sheet size** (`src/ui/sheetSkin.ts`): edges and centre **tile** (never stretch, so the
  grain stays on whole pixels), composed once into a canvas texture `ui_sheet_<w>x<h>`. One image and one draw
  call per open sheet. Plum skin, or no ui atlas: the old drawn panel.

## Slice spec

| piece | size (w x h) | use |
|---|---|---|
| `ui_sheet_tl` | 6 x 7 | top-left corner (brass cap), drawn once |
| `ui_sheet_t` | 16 x 7 | top edge, tiled across (the source segment with the fewest seam pixels) |
| `ui_sheet_tr` | 5 x 7 | top-right corner (brass cap) |
| `ui_sheet_l` | 6 x 16 | left edge, tiled down (planks plus the 1 px paper shadow) |
| `ui_sheet_c` | 16 x 16 | centre, tiled both ways (flat parchment) |
| `ui_sheet_r` | 5 x 16 | right edge, tiled down |
| `ui_sheet_bl`, `_b`, `_br` | 6 x 5, 16 x 5, 5 x 5 | bottom (the sheets run off the screen, so these rarely show) |

- Slice widths: **left 6, right 5, top 7, bottom 5** (`SHEET_SLICE` in `src/art/manifest.ts`).
- **Safe content inset: 8 px** on the left, right and top: every sheet already lays out from x 8, y 8. The menu
  tabs start at x 4 and overlap only the left edge's inner ink column, which lines up with their own outline.

## Shared files touched (for the coordinator and the feel agent)

- `src/ui/widgets.ts`: `Modal.panel()` only. It draws the skinned sheet when the art exists, else the old
  `drawPanel`, and returns the same Graphics as before. `drawPanel`, `Button`, the dim and the layout are untouched;
  `Hud.ts` is untouched.
- `src/art/manifest.ts`: the piece constants and nine optional ui-atlas entries.
- New: `src/ui/sheetSkin.ts`, `art-src/tools/uisheet.py`, `art-src/tools/x1.py`, `agents/probes/sheets-round5.mjs`.
