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
TILESET_COLUMNS = 32
TILE_ORDER = [
    "grass", "dirt", "tilled", "watered", "water", "path", "fence", "wall", "door", "floor", "wallin",
    "bed", "bin", "tree", "flower", "shopwall", "shopdoor", "board", "bush", "stone", "rock",
]


class Pal:
    def __init__(self, pal, outline):
        self.rgb = np.array(pal, dtype=np.float64)
        self.lab = px.to_lab(self.rgb)
        self.outline = outline

    names: list[str] = []

    def name(self, n: str) -> int:
        """Palette slot by name (see public/assets/palette.gpl)."""
        return self.names.index(n)

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
    """Tilled rows: soft ridges every 4 px with broken, wobbling furrow shadows (reads as earth, not planks)."""
    # Both on the soil base so seed mounds and seedlings keep contrast; watered = dithered earth-dark wetness.
    base, dark, lite = P.name("soil"), P.name("earth dark"), P.name("wood")
    t = fill(base)
    if watered:
        lite = base
        for y in range(T):
            for x in range(T):
                if (x + 2 * y) % 3 == 0:
                    t[y, x] = dark
    r = np.random.default_rng(11 if watered else 5)
    for row in (0, 4, 8, 12):
        x = 0
        while x < T:
            seg = int(r.integers(3, 7))
            wob = int(r.integers(0, 2))
            for k in range(seg):
                c = (x + k) % T
                t[(row + 3 + wob) % T, c] = dark
                if k and k < seg - 1:
                    t[(row + 1 + wob) % T, c] = lite
            x += seg + int(r.integers(0, 2))
    for _ in range(6):
        y, x = r.integers(0, T, 2)
        t[y, x] = lite if r.integers(0, 2) else dark
    if watered:
        for x, y in ((3, 6), (10, 10), (6, 14), (13, 2)):
            t[y, x] = P.name("water")
    return t


def seed_mound(P: Pal) -> np.ndarray:
    """Crop stage 0 for every crop: a small light mound with a green tip, clear on dark soil."""
    t = np.full((T, T), -1, dtype=np.int32)
    o, f, h, g = P.outline, P("#c99a62"), P("#e8c48a"), P("#6aa84f")
    rows = {10: (6, 10), 11: (5, 11), 12: (4, 12), 13: (3, 13), 14: (3, 13)}
    for y, (a, b) in rows.items():
        t[y, a:b] = f
    t[11, 6:9] = h
    t[12, 5] = h
    t = px.clean_and_outline(t, o, 0)
    # a two-leaf tip poking out of the top, outlined
    for y, x in ((9, 7), (8, 8), (9, 8), (7, 9)):
        t[y, x] = g
    for y, x in ((8, 7), (9, 6), (7, 8), (6, 9), (7, 10), (8, 9), (9, 9)):
        t[y, x] = o
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
    # base, shadow, highlight (palette slot names): red clay for every house, slate for the shop
    "red": ("red", "wine", "orange"),
    "slate": ("stone", "stone dark", "stone lt"),
}


def roof(P: Pal, style: str, row: str, col: str) -> np.ndarray:
    """One roof tile over a building's wall tiles (R2-1, the art critic's spec). row: t (ridge), m, b (eave), or e
    (the ridge cap rising above the building, drawn in the overhead layer so you walk behind it); col: l/c/r.

    Staggered tiles 4 px wide in 3 px courses, each course offset by half a tile, a 1 px shadow under every course,
    the highlight only as one small glint per tile; a 3 px ridge cap (sand on clay, the valley's signature) with an
    ink outline; at the eave an ink line (the facade below gets a 1-2 px shadow from the shade layer)."""
    b, d, h = (P.name(c) for c in ROOF_STYLES[style])
    cap, cap_d = (P.name("sand"), P.name("wood")) if style == "red" else (P.name("stone lt"), P.name("stone"))
    ink = P.outline
    if row == "e":
        t = np.full((T, T), -1, dtype=np.int32)
        t[12, :] = ink
        t[13, :] = cap
        t[14, :] = cap
        t[14, 1::3] = cap_d  # the cap's rounded tiles
        t[15, :] = cap_d
        if col == "l":
            t[12:, 0] = ink
        if col == "r":
            t[12:, T - 1] = ink
        return t
    t = fill(b)
    for r0 in range(0, T, 4):
        t[r0 + 3, :] = d  # the shadow under each course
        off = 2 if (r0 // 4) % 2 else 0
        for c in range(off, T + off, 4):
            t[r0 : r0 + 3, (c + 3) % T] = d  # the seam between two tiles
            t[r0, c % T] = h  # one glint on each tile's lit corner
    if row == "t":
        t[0, :] = cap
        t[0, 2::3] = cap_d
        t[1, :] = ink
    if row == "b":
        t[14, :] = d
        t[15, :] = ink
    if col == "l":
        t[:, 0] = ink
        t[:, 1] = d
    if col == "r":
        t[:, T - 1] = ink
        t[:, T - 2] = d
    return t


# Small UI glyphs, drawn as character grids: '.' clear, 'o' outline, other letters map to palette colours.
GLYPHS = {
    "ui_sun": (
        {"y": "#f4d35e", "h": "#fff3b0", "r": "#e8a23a"},
        [
            ".....r.....",
            ".r...r...r.",
            "..r.ooo.r..",
            "...oyyyo...",
            "..oyhhyyo..",
            "rroyhyyyorr",
            "..oyyyyro..",
            "...oyyro...",
            "..r.ooo.r..",
            ".r...r...r.",
            ".....r.....",
        ],
    ),
    "ui_rain": (
        {"c": "#c9d3e4", "w": "#ece8e0", "s": "#8a94a8", "b": "#4f7fb8"},
        [
            "....oooo.....",
            "..oowwwwoo...",
            ".owwwccwwwoo.",
            "owccccccccwwo",
            "occcccccccsco",
            ".osssssssssso",
            "..oooooooooo.",
            "..b...b...b..",
            ".b...b...b...",
            "..b...b...b..",
            ".............",
        ],
    ),
    "ui_star": (
        {"w": "#ece8e0"},
        [
            "...o...",
            "..owo..",
            "oowwwoo",
            ".owwwo.",
            ".owwwo.",
            "owo.owo",
            "oo...oo",
        ],
    ),
    "ui_heart": (
        {"w": "#ece8e0"},
        [
            ".oo.oo.",
            "owwowwo",
            "owwwwwo",
            ".owwwo.",
            "..owo..",
            "...o...",
        ],
    ),
    "ui_menu": (
        {"w": "#f2e6c9"},
        [
            "wwwwwwwwwww",
            "wwwwwwwwwww",
            "...........",
            "wwwwwwwwwww",
            "wwwwwwwwwww",
            "...........",
            "wwwwwwwwwww",
            "wwwwwwwwwww",
            "...........",
        ],
    ),
    "fx_px": ({"w": "#ece8e0"}, ["ww", "ww"]),
}


def stepping_stones(P: Pal) -> np.ndarray:
    """Flat stone path piece: four worn slabs that line up with the neighbouring tiles."""
    t = np.full((T, T), -1, dtype=np.int32)
    base, lite, dark = P("#a39d99"), P("#cfc2ad"), P("#6e6a6b")
    for x0, y0, w, h in ((1, 1, 6, 5), (9, 2, 6, 5), (2, 9, 5, 6), (9, 10, 6, 5)):
        t[y0 : y0 + h, x0 : x0 + w] = base
        t[y0, x0 + 1 : x0 + w - 1] = lite
        t[y0 + h - 1, x0 + 1 : x0 + w] = dark
        for cx, cy in ((x0, y0), (x0 + w - 1, y0), (x0, y0 + h - 1), (x0 + w - 1, y0 + h - 1)):
            t[cy, cx] = -1
    return px.clean_and_outline(t, P.outline, 0)


def glyph(P: Pal, colours: dict, rows: list[str]) -> np.ndarray:
    t = np.full((len(rows), len(rows[0])), -1, dtype=np.int32)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "o":
                t[y, x] = P.outline
            elif ch != ".":
                t[y, x] = P(colours[ch])
    return t


def overlay(base: np.ndarray, sprite: np.ndarray) -> np.ndarray:
    out = base.copy()
    out[sprite >= 0] = sprite[sprite >= 0]
    return out


def tile_sprite(make, src: str, fit=(16, 16), anchor="bottom") -> np.ndarray:
    return make({"src": src, "size": [T, T], "fit": list(fit), "anchor": anchor})


def build(pal, outline, groups, specs, make, names=None):
    P = Pal(pal, outline)
    P.names = list(names or [])
    import maptiles as mt
    tiles: dict[str, np.ndarray] = {
        "grass": mt.grass_base(P),
        "dirt": mt.dirt_base(P),
        "tilled": soil(P, False),
        "watered": soil(P, True),
        "water": mt.water_base(P),
        "path": mt.path_base(P),
        "fence": fence(P),
        "wall": bricks(P, "#a39d99", "#5e5a5b", "#cfc2ad"),
        "floor": planks(P),
        "wallin": wall_in(P),
        "bed": quilt(P),
        "shopwall": plaster(P),
        "stone": mt.stone_base(P),
    }
    tiles["door"] = overlay(tiles["wall"], tile_sprite(make, "world1b/tile_door"))
    tiles["shopdoor"] = overlay(tiles["shopwall"], tile_sprite(make, "world1b/tile_shopdoor"))
    tiles["bin"] = overlay(tiles["grass"], tile_sprite(make, "world1b/tile_bin", (15, 15)))
    tiles["tree"] = overlay(grass(P, 31), tile_sprite(make, "crops3b/tile_tree"))
    tiles["flower"] = overlay(grass(P, 41), tile_sprite(make, "crops3b/tile_flower", (14, 12), "center"))
    tiles["board"] = overlay(grass(P, 51), tile_sprite(make, "crops3b/tile_board", (15, 15)))
    tiles["bush"] = overlay(grass(P, 61), tile_sprite(make, "crops3b/tile_bush", (15, 14)))
    tiles["rock"] = overlay(stone_floor(P, 71), tile_sprite(make, "crops3a/node_rock_node", (16, 15)))

    # Extra tiles for the map layers, appended in rows of 21 after the placeholder row (indices unchanged).
    import tiles_extra

    extra = tiles_extra.build_extra(P, make, tiles, roof)
    # Baked tiles the maps asked for (scripts/map-art.mjs -> art-src/map-tiles.json), rendered in world space.
    import json
    import os

    import bake

    req = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "map-tiles.json")
    for name in json.load(open(req)) if os.path.exists(req) else []:
        extra[name] = bake.bake(P, name, tiles["grass"], tiles["stone"])
    # Identical tiles share one slot; every name keeps its own entry in tiles.json.
    index: dict[str, int] = {}
    slot_names: list[str] = []
    allt: list[np.ndarray] = []
    slot: dict[bytes, int] = {}
    for n, tile in [(n, tiles[n]) for n in TILE_ORDER] + list(extra.items()):
        key = tile.astype(np.int32).tobytes()
        if n not in TILE_ORDER and not (tile >= 0).any():
            index[n] = -1  # fully transparent: the map generator leaves the cell empty
            continue
        if n in TILE_ORDER or key not in slot:  # the placeholder row always keeps its 21 indices
            slot.setdefault(key, len(allt))
            allt.append(tile)
            slot_names.append(n)
            index[n] = len(allt) - 1
        else:
            index[n] = slot[key]
    cols = TILESET_COLUMNS
    rows = (len(allt) + cols - 1) // cols
    sheet = np.full((rows * T, cols * T), -1, dtype=np.int32)
    for k, tile in enumerate(allt):
        y, x = divmod(k, cols)
        sheet[y * T : (y + 1) * T, x * T : (x + 1) * T] = tile
    import seasons

    season_rgba = {k: px.idx_to_rgba(v, pal) for k, v in seasons.season_sheets(sheet, slot_names, cols, P.names).items()}
    for key, (colours, rows) in GLYPHS.items():
        groups["ui"][key] = px.idx_to_rgba(glyph(P, colours, rows), pal)
    seed = px.idx_to_rgba(seed_mound(P), pal)
    for key, spec in specs.items():
        if spec.get("authored") == "seed_mound":
            groups["world"][key] = seed
        if spec.get("authored") == "stepping_stones":
            groups[spec["group"]][key] = px.idx_to_rgba(stepping_stones(P), pal)
    groups["world"]["soil_tilled"] = px.idx_to_rgba(tiles["tilled"], pal)
    groups["world"]["soil_watered"] = px.idx_to_rgba(tiles["watered"], pal)
    return {"tileset": px.idx_to_rgba(sheet, pal), "tile_index": index, "columns": cols, "seasons": season_rgba}
