"""The families' houses rebuilt with timber (M7), drawn in code over the palette: one kit for every house.

A house waiting for its family is boarded up on the map (scripts/map-art.mjs `boarded`, the `_boarded` facade tiles).
As timber is delivered, the game draws a stage sprite over the facade (an object keyed by the house's stat; positions
and stages are the M7 builder's, in valley.json `houses`):

  obj_house_<id>_0   scaffolding begun: two standards and a ledger against the boarded front, a few logs at its foot
  obj_house_<id>_1   scaffolding up: standards across the front, a plank deck, a brace, a ladder, a full stack
  obj_house_<id>_2   the boards off: the new door and windows in (glass still dark), the scaffold still up, the stack
                     nearly used
  obj_house_<id>_3   built: the facade as it will be, windows dark (nobody home yet); no scaffold
  obj_house_<id>_4   (optional) home, by day: the same with a warm lamp-gold window

The kit (reused by every house, see HOUSES):
  - `facade(...)` composes the house's open facade from its final map (the tile layers in the .tmj and the tileset),
    so a built stage is exactly the map's facade. Window panes are recoloured: night navy (dark), lamp (lit).
  - `scaffold(...)` draws standards (2 px wood poles, ink outline) at given x's, plank decks (2 px sand over 2 px wood,
    ink outline) and ledgers across any width, a diagonal brace and a ladder: it tiles onto any facade width.
  - `stack(...)` (towart's landed timber) sits at the facade's foot, beside the scaffold.
The scaffold is warm wood like the boarded house's planks (R27-1), so it reads as "being rebuilt", never "ruined".
A sprite covers the house's wall rows plus the roof row above them (where the standards rise past the eave); it is
anchored bottom-left at the bottom of the facade row (origin 0,1). No 1 px features (bar the ink outline), no alpha.
"""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image

import towart

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, "..", ".."))
T = 16

# id: map, the sprite's tile rect (x, y, w, h: the roof row above the walls, then the wall rows), standards (sprite x
# of each pole's left edge), the deck rows (sprite y of each deck's top), cells of windows and doors in the sprite
# (tile x, tile y), the stack's corner, the ladder's x.
HOUSES = {
    "marls": {
        "map": "town",
        "rect": (14, 4, 6, 3),
        # poles clear of the panes (x 19-28, 67-76) and the door (33-46)
        "poles": [0, 29, 56, 92],
        "decks": [26],
        "ledgers": [12],
        "windows": [(1, 1), (4, 1)],
        "doors": [(2, 1), (2, 2)],
        "stacks": [(8, 34), (62, 34)],
        "ladder": 79,
    },
}


def _tileset() -> tuple[np.ndarray, int]:
    ts = np.asarray(Image.open(os.path.join(GAME, "public", "assets", "tilesets", "tiles.png")).convert("RGBA"))
    return ts, ts.shape[1] // T


def facade(names: list[str], pal: np.ndarray, map_id: str, rect: tuple[int, int, int, int]) -> np.ndarray:
    """The map's tile layers (not collision or lamps) composed over `rect` (tiles), as palette indices (-1 clear)."""
    m = json.load(open(os.path.join(GAME, "public", "assets", "maps", f"{map_id}.tmj")))
    ts, cols = _tileset()
    x0, y0, w, h = rect
    out = np.zeros((h * T, w * T, 4), np.uint8)
    for layer in m["layers"]:
        if layer["type"] != "tilelayer" or layer["name"] in ("collision", "lamps"):
            continue
        for ty in range(h):
            for tx in range(w):
                g = layer["data"][(y0 + ty) * m["width"] + x0 + tx]
                if not g:
                    continue
                k = g - 1
                tile = ts[(k // cols) * T : (k // cols + 1) * T, (k % cols) * T : (k % cols + 1) * T]
                a = tile[..., 3:4] > 0
                sl = out[ty * T : (ty + 1) * T, tx * T : (tx + 1) * T]
                sl[...] = np.where(a, tile, sl)
    idx = np.full((h * T, w * T), -1, np.int32)
    seen = out[..., 3] > 0
    rgb = out[..., :3].astype(np.int32)
    d = ((rgb[seen][:, None, :] - pal[None, :, :]) ** 2).sum(-1)
    idx[seen] = d.argmin(1)
    return idx


def _pane_recolour(names: list[str], t: np.ndarray, cells: list[tuple[int, int]], lit: bool) -> None:
    """Window panes (ice white) go night navy, or lamp with earth-dark mullions when lit."""
    c = names.index
    for tx, ty in cells:
        sl = t[ty * T : (ty + 1) * T, tx * T : (tx + 1) * T]
        pane = sl == c("ice white")
        if lit:
            sl[pane] = c("lamp")
            sl[(sl == c("soil")) | (sl == c("plum shadow"))] = c("earth dark")
        else:
            sl[pane] = c("night navy")


def scaffold(cv: towart.Ink, poles: list[int], decks: list[int], ledgers: list[int], top: int, bottom: int,
             x0: int, x1: int, brace: bool) -> None:
    """Standards from `top` to `bottom` (exclusive) at each x in `poles` (4 px with the outline), a plank deck at each
    y in `decks` (6 px with the outline) and a ledger at each y in `ledgers` (4 px), both from x0 to x1."""
    for y in ledgers:
        cv.rect(x0, y, x1 - x0, 4, "ink")
        cv.rect(x0, y + 1, x1 - x0, 2, "wood")
    if brace and len(poles) >= 2 and decks:
        # a diagonal brace in the first bay under the deck (clear of the window above it): 2 px soil, ink outline
        a, b = poles[0] + 4, poles[1]
        ya, yb = bottom - 3, decks[0] + 7
        n = max(1, b - a)
        pts = [(a + i, int(round(ya + (yb - ya) * i / n))) for i in range(n)]
        for x, y in pts:
            cv.rect(x, y - 2, 1, 4, "ink")
        for x, y in pts:
            cv.rect(x, y - 1, 1, 2, "soil")
    for x in poles:
        cv.rect(x, top, 4, bottom - top, "ink")
        cv.rect(x + 1, top + 1, 2, bottom - top - 1, "wood")
        cv.rect(x + 1, top + 1, 2, 2, "sand")  # the cut top, lit
    for y in decks:
        cv.rect(x0, y, x1 - x0, 6, "ink")
        cv.rect(x0 + 1, y + 1, x1 - x0 - 2, 2, "sand")
        cv.rect(x0 + 1, y + 3, x1 - x0 - 2, 2, "wood")
        for x in range(x0 + 12, x1 - 4, 16):  # board ends: a seam every 16 px
            cv.rect(x, y + 1, 1, 4, "ink")


def ladder(cv: towart.Ink, x: int, top: int, bottom: int) -> None:
    """A ladder leaning on the deck, 12 px wide: two rails (2 px sand, ink outline), 2 px rungs every 5 px."""
    for y in range(top + 4, bottom - 2, 5):
        cv.rect(x + 3, y - 1, 6, 4, "ink")
        cv.rect(x + 3, y, 6, 2, "wood")
    for rx in (x, x + 8):
        cv.rect(rx, top, 4, bottom - top, "ink")
        cv.rect(rx + 1, top + 1, 2, bottom - top - 1, "sand")


def stage(names: list[str], pal: np.ndarray, house: str, n: int) -> np.ndarray:
    spec = HOUSES[house]
    _, _, w, h = spec["rect"]
    W, H = w * T, h * T
    cv = towart.Ink(names, W, H)
    built = facade(names, pal, spec["map"], spec["rect"])
    cells = spec["windows"] + spec["doors"]
    if n >= 2:
        # the new door and windows in: those cells as the map draws them, panes dark (lit for 4)
        _pane_recolour(names, built, spec["windows"], lit=(n == 4))
        for tx, ty in cells:
            cv.t[ty * T : (ty + 1) * T, tx * T : (tx + 1) * T] = built[ty * T : (ty + 1) * T, tx * T : (tx + 1) * T]
    if n <= 2:
        poles = spec["poles"] if n >= 1 else spec["poles"][:2]
        right = poles[-1] + 4
        decks = spec["decks"] if n >= 1 else []
        ledgers = spec["ledgers"] if n >= 1 else [spec["decks"][0] + 1]
        scaffold(cv, poles, decks, ledgers, top=4, bottom=H, x0=poles[0], x1=right, brace=n >= 1)
        if n >= 1:
            ladder(cv, spec["ladder"], spec["decks"][0] - 2, H)
        (sx, sy), (sx2, sy2) = spec["stacks"]
        if n == 0:
            towart._stack(cv, sx, sy)
        elif n == 1:
            towart._stack(cv, sx, sy)
            towart._stack(cv, sx2, sy2)
        else:
            # nearly used: one log left on the ground
            cv.rect(sx + 1, sy + 11, 13, 2, "plum shadow")
            towart._small_log(cv, sx, sy + 6, 12)
    return cv.t


def build(names: list[str], pal) -> dict[str, np.ndarray]:
    p = np.array(pal, dtype=np.int32)[:, :3]
    out: dict[str, np.ndarray] = {}
    for house in HOUSES:
        for n in range(5):
            out[f"obj_house_{house}_{n}"] = stage(names, p, house, n)
    return out
