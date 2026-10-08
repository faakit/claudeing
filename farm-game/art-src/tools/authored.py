"""Sprites written in code from palette indices: the terrain tileset, tilled soil, and frames derived from others.

Terrain must tile seamlessly and keep the placeholder tile order, which AI images cannot promise, so the base
textures are authored here (deterministic patterns, wrapped at the tile edges so they tile). Object tiles
(tree, bush, bed, door...) put a pixelized Google Flow sprite on top of one of these bases.

`build(pal, outline, groups, specs, make)` adds RGBA sprites to `groups` and returns {"tileset": RGBA array}.
`make(spec)` turns a Flow-crop spec (as in sprites.json) into an index image.
"""
from __future__ import annotations

import numpy as np

import pixelart as px

T = 16
TILE_ORDER = [
    "grass", "dirt", "tilled", "watered", "water", "path", "fence", "wall", "door", "floor", "wallin",
    "bed", "bin", "tree", "flower", "shopwall", "shopdoor", "board", "bush", "stone", "rock",
]


class Pal:
    def __init__(self, pal, outline):
        self.rgb = np.array(pal, dtype=np.float64)
        self.lab = px.to_lab(self.rgb)
        self.outline = outline

    def __call__(self, hexcol: str) -> int:
        """Nearest palette index to a colour, so authored art can never leave the palette."""
        rgb = np.array([int(hexcol[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)
        return int(px.nearest_index(rgb[None], self.lab)[0])


def fill(c: int) -> np.ndarray:
    return np.full((T, T), c, dtype=np.int32)


def speckle(t: np.ndarray, c: int, n: int, seed: int, shape=((0, 0),)) -> None:
    """Scatter a small pixel shape n times, wrapping at the edges (keeps the tile seamless)."""
    r = np.random.default_rng(seed)
    for _ in range(n):
        x, y = r.integers(0, T, 2)
        for dx, dy in shape:
            t[(y + dy) % T, (x + dx) % T] = c


def grass(P: Pal, seed=1) -> np.ndarray:
    t = fill(P("#6aa84f"))
    speckle(t, P("#4f8a3c"), 10, seed, ((0, 0), (1, -1)))
    speckle(t, P("#4f8a3c"), 6, seed + 1, ((0, 0), (0, -1)))
    speckle(t, P("#8cc265"), 7, seed + 2, ((0, 0), (1, 0)))
    return t


def dirt(P: Pal, seed=2) -> np.ndarray:
    t = fill(P("#a0703f"))
    speckle(t, P("#83582f"), 14, seed, ((0, 0), (1, 0)))
    speckle(t, P("#bf8f55"), 8, seed + 1)
    return t


def path(P: Pal, seed=3) -> np.ndarray:
    t = fill(P("#d9b37a"))
    speckle(t, P("#bf9a62"), 10, seed, ((0, 0), (1, 0)))
    speckle(t, P("#efd8a5"), 7, seed + 1)
    speckle(t, P("#a88356"), 4, seed + 2)
    return t


def soil(P: Pal, watered: bool) -> np.ndarray:
    base = P("#6b4329") if watered else P("#8e5f37")
    dark = P("#4a2c22") if watered else P("#6b4329")
    lite = P("#83582f") if watered else P("#b07c48")
    t = fill(base)
    for row in (3, 7, 11, 15):
        t[row, :] = dark
        t[row - 1, :] = lite
    r = np.random.default_rng(11 if watered else 5)
    for row in (1, 5, 9, 13):
        for _ in range(3):
            t[row, r.integers(0, T)] = dark
    if watered:
        for x, y in ((3, 5), (10, 9), (6, 13), (13, 1)):
            t[y, x] = P("#4f7fb8")
    return t


def water(P: Pal, seed=4) -> np.ndarray:
    t = fill(P("#3f74b8"))
    lite, dark = P("#7fb2e0"), P("#2f5a99")
    for x, y in ((2, 3), (9, 6), (4, 11), (12, 13)):
        for i in range(3):
            t[y % T, (x + i) % T] = lite
        t[(y + 1) % T, (x + 3) % T] = dark
    speckle(t, dark, 5, seed)
    return t


def stone_floor(P: Pal, seed=6) -> np.ndarray:
    t = fill(P("#8a8584"))
    speckle(t, P("#6e6a6b"), 14, seed, ((0, 0), (1, 0)))
    speckle(t, P("#a39d99"), 8, seed + 1)
    return t


def bricks(P: Pal, base: str, mortar: str, lite: str) -> np.ndarray:
    """Running-bond blocks 8x4: lit top edge, mortar line below and at the joints (wraps, so it tiles)."""
    t = fill(P(base))
    m, li = P(mortar), P(lite)
    for r0 in range(0, T, 4):
        t[r0, :] = li
        t[r0 + 3, :] = m
        off = 4 if (r0 // 4) % 2 else 0
        for c in range(off, T + off, 8):
            t[r0 : r0 + 3, c % T] = m
            t[r0 + 1, (c + 1) % T] = li
    return t


def planks(P: Pal) -> np.ndarray:
    t = fill(P("#b07c48"))
    dark, lite = P("#83582f"), P("#c99a62")
    for c in (0, 8):
        t[:, c] = dark
        t[:, c + 1] = lite
    t[5, 1:8] = dark
    t[12, 9:16] = dark
    t[2, 4] = dark
    t[9, 12] = dark
    return t


def wall_in(P: Pal) -> np.ndarray:
    t = fill(P("#7b5f86"))
    li, dk = P("#9a7fa6"), P("#5a4466")
    for c in range(0, T, 4):
        t[:11, c] = li
    t[11, :] = P("#c99a62")
    t[12:, :] = P("#83582f")
    t[15, :] = dk
    return t


def plaster(P: Pal) -> np.ndarray:
    t = fill(P("#e8d3a8"))
    beam = P("#83582f")
    t[0, :] = beam
    t[:, 0] = beam
    t[8, :] = P("#d1b98a")
    speckle(t, P("#d1b98a"), 5, 9)
    return t


def quilt(P: Pal) -> np.ndarray:
    t = fill(P("#c84a3f"))
    li = P("#f2e6c9")
    t[0, :] = li
    t[:, 0] = li
    t[8, :] = P("#9e3a37")
    t[:, 8] = P("#9e3a37")
    for x, y in ((4, 4), (12, 12), (4, 12), (12, 4)):
        t[y, x] = li
    return t


def fence(P: Pal) -> np.ndarray:
    t = grass(P, 21)
    rail, rail_d, post, post_d = P("#c99a62"), P("#83582f"), P("#a0703f"), P("#5e3b26")
    for y in (5, 10):
        t[y, :] = rail
        t[y + 1, :] = rail_d
    for x in (2, 12):
        t[2:14, x : x + 2] = post
        t[2:14, x + 1] = post_d
        t[2, x : x + 2] = rail
    return t


ROOF_STYLES = {
    # base, shadow, highlight
    "red": ("#b8503c", "#8a3a33", "#d9785a"),
    "slate": ("#5f6f8a", "#45506a", "#8090a8"),
}


def roof(P: Pal, style: str, row: str, col: str) -> np.ndarray:
    """One roof tile for a building drawn over its wall tiles (decor layer). row: t/m/b, col: l/c/r.

    Overlapping shingle courses every 4 px, staggered; ridge on top, a dark eave line at the bottom,
    outline on the outer sides. Wraps horizontally, so any building width tiles."""
    b, d, h = (P(c) for c in ROOF_STYLES[style])
    t = fill(b)
    for r0 in range(0, T, 4):
        t[r0 + 3, :] = d
        off = 2 if (r0 // 4) % 2 else 0
        for c in range(off, T, 4):
            t[r0 : r0 + 3, c] = d if c % 8 == off else b
            t[r0, (c + 1) % T] = h
    if row == "t":
        t[0, :] = P.outline
        t[1, :] = h
        t[2, :] = h
    if row == "b":
        t[13, :] = d
        t[14, :] = P.outline
        t[15, :] = -1  # a 1 px gap shows the facade top: the eave overhangs
    if col == "l":
        t[:, 0] = P.outline
    if col == "r":
        t[:, 15] = P.outline
    if row == "b":
        t[15, :] = -1
    return t


def overlay(base: np.ndarray, sprite: np.ndarray) -> np.ndarray:
    out = base.copy()
    out[sprite >= 0] = sprite[sprite >= 0]
    return out


def tile_sprite(make, src: str, fit=(16, 16), anchor="bottom") -> np.ndarray:
    return make({"src": src, "size": [T, T], "fit": list(fit), "anchor": anchor})


def build(pal, outline, groups, specs, make):
    P = Pal(pal, outline)
    tiles: dict[str, np.ndarray] = {
        "grass": grass(P),
        "dirt": dirt(P),
        "tilled": soil(P, False),
        "watered": soil(P, True),
        "water": water(P),
        "path": path(P),
        "fence": fence(P),
        "wall": bricks(P, "#a39d99", "#5e5a5b", "#cfc2ad"),
        "floor": planks(P),
        "wallin": wall_in(P),
        "bed": quilt(P),
        "shopwall": plaster(P),
        "stone": stone_floor(P),
    }
    tiles["door"] = overlay(tiles["wall"], tile_sprite(make, "world1b/tile_door"))
    tiles["shopdoor"] = overlay(tiles["shopwall"], tile_sprite(make, "world1b/tile_shopdoor"))
    tiles["bin"] = overlay(tiles["grass"], tile_sprite(make, "world1b/tile_bin", (15, 15)))
    tiles["tree"] = overlay(grass(P, 31), tile_sprite(make, "crops3b/tile_tree"))
    tiles["flower"] = overlay(grass(P, 41), tile_sprite(make, "crops3b/tile_flower", (14, 12), "center"))
    tiles["board"] = overlay(grass(P, 51), tile_sprite(make, "crops3b/tile_board", (15, 15)))
    tiles["bush"] = overlay(grass(P, 61), tile_sprite(make, "crops3b/tile_bush", (15, 14)))
    tiles["rock"] = overlay(stone_floor(P, 71), tile_sprite(make, "crops3a/node_rock_node", (16, 15)))

    for style in ROOF_STYLES:
        for row in "tmb":
            for col in "lcr":
                groups["world"][f"decor_roof_{style}_{row}{col}"] = px.idx_to_rgba(roof(P, style, row, col), pal)

    sheet = np.concatenate([tiles[n] for n in TILE_ORDER], axis=1)
    groups["world"]["soil_tilled"] = px.idx_to_rgba(tiles["tilled"], pal)
    groups["world"]["soil_watered"] = px.idx_to_rgba(tiles["watered"], pal)
    return {"tileset": px.idx_to_rgba(sheet, pal)}
