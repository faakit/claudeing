"""Rosa's letter paper (`ui_letter_*`, Dry Year, art round dry-year-2): a 9-slice of plain parchment, drawn in code.

Letter paper, not the walnut menu sheet: flat parchment (no texture behind the text), a deckled edge in 2 px steps
(a 2 px soil edge, then a 2 px sand band where the paper has aged), and one accent, the top-right corner folded down.
The Flow sources (`letter_paper-a/b`) set the look; their tea stain and blossom would sit behind the text, so the
paper is drawn here, like the channel tiles.

Pieces (ui atlas): corners 8 x 8; the top and bottom edges 16 x 8 and the side edges 8 x 16 tile along the card;
the centre 16 x 16 is flat parchment. Slice spec in src/art/manifest.ts (LETTER_SLICE): 8 on every side, so the
title's 8 px text inset starts on plain paper. No 1 px features, no alpha.
"""
from __future__ import annotations

import numpy as np

S = 8  # slice width on every side
E = 16  # edge and centre tile length
N = S * 2 + E  # the composed card the pieces are cut from (32 x 32)
# the deckle: how far (0 or 2 px) the edge sits in, per column of a 16 px edge tile; 0 at both ends so tiles and
# corners join with no step at the seams
TOP = [0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0]
BOTTOM = [0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0]
LEFT = [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0]
RIGHT = [0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]


def _erode(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1, constant_values=False)
    return m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]


def card(names: list[str]) -> np.ndarray:
    """The composed 32 x 32 card (corners, one tile of each edge, the centre), as palette indices."""
    c = names.index
    yy, xx = np.mgrid[0:N, 0:N]
    inside = np.ones((N, N), bool)
    for i in range(E):
        inside[: TOP[i], S + i] = False
        inside[N - BOTTOM[i] :, S + i] = False
        inside[S + i, : LEFT[i]] = False
        inside[S + i, N - RIGHT[i] :] = False
    # rounded corners in 2 px steps
    for cx, cy in ((0, 0), (0, N - 1), (N - 1, N - 1)):
        dx, dy = np.abs(xx - cx), np.abs(yy - cy)
        inside &= ~((dx < 2) & (dy < 4) | (dx < 4) & (dy < 2))
    # the folded corner, top right: the cut is a stair of 2 x 2 steps
    fx, fy = N - 1 - xx, yy
    cut = (fx // 2 + fy // 2) < 3
    inside &= ~cut
    edge = inside & ~_erode(_erode(inside))
    depth = np.minimum(np.minimum(xx, yy), np.minimum(N - 1 - xx, N - 1 - yy))
    band = inside & ~edge & (depth < 5)  # the aged margin: wider where the deckle steps out, so it looks worn
    t = np.full((N, N), -1, dtype=np.int32)
    t[inside] = c("parchment")
    t[band] = c("sand")
    t[edge] = c("soil")
    # the flap: the folded-down triangle (sand, soil edge), all inside the top-right corner piece
    flap = (fx <= 7) & (fy <= 7) & ~cut
    t[flap] = c("wood")  # the flap's back, in shade
    t[flap & (fx >= 6) | flap & (fy >= 6)] = c("soil")  # its folded edges, 2 px
    return t


PIECES = {
    "tl": (0, 0, S, S), "t": (S, 0, E, S), "tr": (S + E, 0, S, S),
    "l": (0, S, S, E), "c": (S, S, E, E), "r": (S + E, S, S, E),
    "bl": (0, S + E, S, S), "b": (S, S + E, E, S), "br": (S + E, S + E, S, S),
}


def build(names: list[str]) -> dict[str, np.ndarray]:
    t = card(names)
    return {f"ui_letter_{k}": t[y : y + h, x : x + w].copy() for k, (x, y, w, h) in PIECES.items()}
