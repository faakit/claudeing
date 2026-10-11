"""The menu sheet skin (art round 5): a parchment sheet in a walnut frame with brass corner caps, as 9-slice pieces.

Source: Google Flow `ui1` variant b (art-src/flow/crops/ui1b/sheet.png, native 98 x 76 px on its own grid). Its
frame is 7 px thick, too thick for the sheets' 4-8 px content insets, so the frame is rebuilt from the source's own
rows and columns on the native grid (no resampling): the outline, the darker grain, the light bevel and the
ink line where the wood meets the paper, plus a 1 px sand shadow inside the top and left edges. The ink at the
paper is 2 px on every side and the top bevel 2 px (review 16), so a fractional display scale changes them
proportionally less.

Pieces (ui atlas, all on the palette):
  ui_sheet_tl  ui_sheet_t  ui_sheet_tr      corners 7 x 7 (left) / 5 x 7 (right); top edge 16 x 7, tiles across
  ui_sheet_l   ui_sheet_c  ui_sheet_r       left edge 6 x 16, centre 16 x 16 (flat parchment), right edge 5 x 16
  ui_sheet_bl  ui_sheet_b  ui_sheet_br      bottom 5 px (the sheets run off the screen, so these rarely show)
Slice spec (src/ui/sheetSkin.ts): left 6, right 5, top 7, bottom 5; edges and centre TILE (never stretch, so the
grain keeps its pixels); safe content inset 8 px left, right and top (the menu tabs at x 4 overlap only the
left edge's ink column, which matches their own outline).
"""
from __future__ import annotations

import numpy as np

SRC = "ui1b/sheet"
# native rows/columns kept from the source frame (see the module docstring)
TOP_ROWS = [1, 3, 5, 5, 7, 7]  # outline, dark grain, light bevel x2, ink x2 (review 16: inner lines 2 px)
LEFT_COLS = [0, 3, 4, 6, 6]  # outline, dark grain, light bevel, ink x2
RIGHT_COLS = [-7, -7, -5, -3, -1]  # ink x2, bevel, dark grain, outline (mirrors the left)
BOTTOM_ROWS = [-8, -6, -5, -3, -1]  # ink, wood, grain, dark, outline
CAP = ["KKKKK", "KLYOK", "KYYOK", "KOOOK", "KKKKK"]  # a brass cap over each top corner, lit top-left


def _seam_cost(row_block: np.ndarray, x0: int, w: int) -> int:
    """How badly a w-wide segment starting at x0 repeats: differing pixels between its last and first column."""
    a, b = row_block[:, x0 + w - 1], row_block[:, x0]
    return int((a != b).sum())


def build(names: list[str], native_idx: np.ndarray) -> dict[str, np.ndarray]:
    """native_idx: the Flow sheet quantized to the palette (rows x cols of palette indices, -1 clear)."""
    n = native_idx
    ink = names.index("ink")
    sand = names.index("sand")
    paper = names.index("parchment")
    gold, orange = names.index("gold"), names.index("orange")
    H, W = n.shape
    top = n[TOP_ROWS]  # 6 rows
    bottom = n[BOTTOM_ROWS]
    inner = slice(12, W - 12)
    # the top edge: a 16 px segment of the source's top frame that repeats with the fewest seam pixels
    xs = range(12, W - 12 - 16)
    x0 = min(xs, key=lambda x: _seam_cost(top, x, 16))
    t = np.vstack([top[:, x0 : x0 + 16], np.full((1, 16), sand)])  # + 1 px paper shadow
    t[-1] = sand
    b = bottom[:, x0 : x0 + 16].copy()
    # side edges: the source's frame columns are vertical planks, the same down the sheet: one 16 px run
    y0 = 20
    left = n[y0 : y0 + 16][:, LEFT_COLS]
    left = np.hstack([left, np.full((16, 1), sand)])  # + paper shadow
    right = n[y0 : y0 + 16][:, RIGHT_COLS]
    # corners: the top rows over the side columns, the shadow corner filled, then the brass cap
    def corner(rows: list[int], cols: list[int], shadow_col: bool, shadow_row: bool) -> np.ndarray:
        c = n[np.ix_(rows, cols)].copy()
        if shadow_col:
            c = np.hstack([c, np.full((c.shape[0], 1), -1)])
            c[:, -1] = n[rows, inner.start][: c.shape[0]]  # the top frame continues over the shadow column
        if shadow_row:
            c = np.vstack([c, np.full((1, c.shape[1]), sand)])
            c[-1, : len(cols)] = left[0, : len(cols)] if shadow_col else right[0]
        return c

    tl = corner(TOP_ROWS, LEFT_COLS, True, True)
    tr = corner(TOP_ROWS, RIGHT_COLS, False, True)
    bl = n[np.ix_(BOTTOM_ROWS, LEFT_COLS)].copy()
    bl = np.hstack([bl, bottom[:, x0 : x0 + 1]])
    br = n[np.ix_(BOTTOM_ROWS, RIGHT_COLS)].copy()
    for c, flip in ((tl, False), (tr, True)):
        for j, row in enumerate(CAP):
            for i, ch in enumerate(row):
                x = c.shape[1] - len(row) + i if flip else i  # same cap, not mirrored: lit from the top-left
                c[j, x] = {"K": ink, "Y": gold, "O": orange, "L": names.index("lamp")}[ch]
    # the frame's outer edge is plum shadow in the source; the outline is the palette ink everywhere (decision 1)
    plum = names.index("plum shadow")
    for v in (tl, t, tr):
        v[0][v[0] == plum] = ink
    for v in (bl, b, br):
        v[-1][v[-1] == plum] = ink
    for v in (tl, left, bl):
        v[:, 0][v[:, 0] == plum] = ink
    for v in (tr, right, br):
        v[:, -1][v[:, -1] == plum] = ink
    # the ink line where the wood meets the paper is solid ink down both sides (the source mixes in plum)
    left[:, 3:5] = ink
    right[:, 0:2] = ink
    tr[len(TOP_ROWS):, 0:2] = ink
    centre = np.full((16, 16), paper)
    out = {
        "ui_sheet_tl": tl, "ui_sheet_t": t, "ui_sheet_tr": tr,
        "ui_sheet_l": left, "ui_sheet_c": centre, "ui_sheet_r": right,
        "ui_sheet_bl": bl, "ui_sheet_b": b, "ui_sheet_br": br,
    }
    for k in ("ui_sheet_t", "ui_sheet_l", "ui_sheet_c", "ui_sheet_r", "ui_sheet_b"):
        assert (out[k] >= 0).all(), f"{k} has transparent pixels"  # tiles must be solid; corners may be rounded
    return out


SLICE = {"left": 6, "right": 5, "top": 7, "bottom": 5, "inset": 8}
