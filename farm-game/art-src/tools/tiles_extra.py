"""Extra tileset tiles for the map layers (appended after the 21 placeholder tiles, which keep their indices).

The map generator (scripts/map-art.mjs) reads `public/assets/tilesets/tiles.json` (tile name -> index) and fills
these layers, all purely visual except `props`, whose tiles are also added to the collision layer:
  detail   ground variants, edge/transition overlays (grass creeping onto paths, shorelines, rock masses)
  shade    soft dithered drop shadows, flat decor (wildflowers, pebbles, puddles, rugs)
  roof     roofs over building blocks (all but the facade row)
  props    upright props on their own solid tile (barrels, crates, lamps, furniture, tree bases)
  overhead what you walk behind: tree canopies, lamp tops, roof eaves
Edges use a 4-bit mask of the neighbours that differ: N=1, E=2, S=4, W=8.
"""
from __future__ import annotations

import numpy as np

import pixelart as px

T = 16
N, E, S, W = 1, 2, 4, 8


def _h(*v: int) -> int:
    """Small deterministic hash (stable ragged edges)."""
    h = 2166136261
    for x in v:
        h = ((h ^ (x & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


def _dist(x: int, y: int, mask: int) -> int:
    d = 99
    if mask & N:
        d = min(d, y)
    if mask & S:
        d = min(d, T - 1 - y)
    if mask & W:
        d = min(d, x)
    if mask & E:
        d = min(d, T - 1 - x)
    return d


def _along(x: int, y: int, mask: int) -> int:
    """Coordinate along the nearest masked edge (for the ragged profile)."""
    best, a = 99, 0
    for bit, d, along in ((N, y, x), (S, T - 1 - y, x), (W, x, y), (E, T - 1 - x, y)):
        if mask & bit and d < best:
            best, a = d, along + bit * 17
    return a


def creep(P, mask: int, grass_tex: np.ndarray, salt: int) -> np.ndarray:
    """Grass creeping 1-3 px onto a path/dirt tile from the masked sides, with a dark lip."""
    t = np.full((T, T), -1, dtype=np.int32)
    lip = P.name("leaf dark")
    for y in range(T):
        for x in range(T):
            d = _dist(x, y, mask)
            if d > 4:
                continue
            a = _along(x, y, mask)
            reach = 1 + _h(a // 2, salt) % 3  # 1..3 px, in 2 px steps so it reads as tufts
            if d < reach:
                t[y, x] = grass_tex[y, x]
            elif d == reach:
                t[y, x] = lip
    return t


def shore(P, mask: int) -> np.ndarray:
    """Water edge: an earthy bank where land is to the north, foam along every land side."""
    t = np.full((T, T), -1, dtype=np.int32)
    foam, deep, bank, bank_d = P.name("ice white"), P.name("dusk blue"), P.name("soil"), P.name("earth dark")
    for y in range(T):
        for x in range(T):
            d = _dist(x, y, mask)
            if mask & N and y <= 1:
                t[y, x] = bank if y == 0 else bank_d
            elif d == (2 if mask & N and y == 2 else 0) and (x + y) % 3 != 0:
                t[y, x] = foam
            elif d == 1 and (x * 3 + y) % 4 == 0:
                t[y, x] = foam
            elif d == 2 and (x + 2 * y) % 5 == 0:
                t[y, x] = deep
    return t


def rock_mass(P, mask: int, salt: int) -> np.ndarray:
    """Mine wall seen from above: rock top, a carved face where the floor is south, ink rims elsewhere."""
    top, top_l, top_d = P.name("stone dark"), P.name("taupe"), P.name("plum shadow")
    face, face_l, ink = P.name("stone"), P.name("stone lt"), P.outline
    t = np.full((T, T), top, dtype=np.int32)
    r = np.random.default_rng(salt)
    for _ in range(10):
        x, y = r.integers(0, T, 2)
        t[y, x] = top_l if r.integers(0, 2) else top_d
    if mask & S:
        for y in range(10, T):
            for x in range(T):
                t[y, x] = face
                if (x + _h(x, salt)) % 5 == 0:
                    t[y, x] = top_d  # vertical cracks in the face
        t[10, :] = face_l
        t[9, :] = ink
        t[T - 1, :] = ink
    if mask & N:
        t[0, :] = ink
        t[1, :] = face_l
    if mask & W:
        t[:, 0] = ink
        t[1:, 1] = np.where(t[1:, 1] == top, top_l, t[1:, 1])
    if mask & E:
        t[:, T - 1] = ink
    return t


def floor_shadow(P) -> np.ndarray:
    """Dithered shadow on the top rows of a tile (under a wall, a tree, a facade)."""
    t = np.full((T, T), -1, dtype=np.int32)
    ink = P.outline
    for y in range(4):
        for x in range(T):
            if y == 0 or (y == 1 and (x + y) % 2 == 0) or (y >= 2 and (x + 2 * y) % 4 == 0):
                t[y, x] = ink
    return t


def split_v(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """A 16x32 sprite -> (top tile, bottom tile)."""
    return img[:T], img[T:]


def split_h(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    return img[:, :T], img[:, T:]


def under(base: np.ndarray, spr: np.ndarray) -> np.ndarray:
    out = base.copy()
    out[spr >= 0] = spr[spr >= 0]
    return out


def build_extra(P, make, base: dict[str, np.ndarray], roof_fn) -> dict[str, np.ndarray]:
    """All extra tiles by name, in a stable order (dict insertion order = tileset order)."""
    out: dict[str, np.ndarray] = {}
    grass_tex = base["grass"]

    # --- edges (15 masks each) ---
    for m in range(1, 16):
        out[f"edge_path_{m}"] = creep(P, m, grass_tex, 3)
    for m in range(1, 16):
        out[f"edge_dirt_{m}"] = creep(P, m, grass_tex, 7)
    for m in range(1, 16):
        out[f"shore_{m}"] = shore(P, m)
    for m in range(0, 16):
        out[f"rock_{m}"] = rock_mass(P, m, 40 + m)

    # --- shade + flat decor (transparent overlays) ---
    out["shade_n"] = floor_shadow(P)
    out["rose_1"] = make({"src": "ambient1a/decor_rose", "size": [T, T], "fit": [8, 9], "anchor": "center"})
    out["rose_2"] = make({"src": "ambient1a/decor_rose_clump", "size": [T, T], "fit": [13, 11], "anchor": "center"})
    out["tallgrass"] = make({"src": "ambient1a/decor_tallgrass", "size": [T, T], "fit": [12, 12], "anchor": "center"})
    out["pebbles"] = make({"src": "items5a/decor_pebbles", "size": [T, T], "fit": [12, 8], "anchor": "center"})
    out["puddle"] = make({"src": "ambient1a/decor_puddle", "size": [T, T], "fit": [14, 8], "anchor": "center"})
    out["rubble"] = make({"src": "ambient1a/decor_rock", "size": [T, T], "fit": [9, 7], "anchor": "center"})
    rug = make({"src": "interior1a/int_rug", "size": [32, 32], "fit": [30, 22], "anchor": "center"})
    out["rug_tl"], out["rug_tr"] = split_h(rug[:T])
    out["rug_bl"], out["rug_br"] = split_h(rug[T:])

    # --- ground variants (detail, transparent) ---
    v1 = np.full((T, T), -1, dtype=np.int32)
    for x, y in ((3, 4), (4, 4), (4, 3), (10, 9), (11, 9), (11, 8), (6, 12), (7, 12)):
        v1[y, x] = P.name("leaf mid")
    out["grass_v1"] = v1
    v2 = np.full((T, T), -1, dtype=np.int32)
    for x, y in ((2, 9), (3, 8), (9, 3), (12, 12), (13, 11), (7, 6)):
        v2[y, x] = P.name("new leaf")
    out["grass_v2"] = v2
    v3 = np.full((T, T), -1, dtype=np.int32)
    for x, y in ((5, 5), (11, 10)):
        v3[y, x] = P.name("parchment")
        v3[y + 1, x] = P.name("leaf dark")
    out["grass_v3"] = v3
    sv = np.full((T, T), -1, dtype=np.int32)
    for x, y in ((3, 5), (4, 6), (5, 6), (6, 7), (11, 3), (12, 4)):
        sv[y, x] = P.name("stone dark")
    out["stone_v1"] = sv

    # --- props: single solid tiles, transparent background, bottom-anchored ---
    def prop(name, src, fit, anchor="bottom"):
        out[name] = make({"src": src, "size": [T, T], "fit": list(fit), "anchor": anchor})

    prop("p_barrel", "items5a/decor_barrel", (12, 14))
    prop("p_crates", "items5a/decor_crates", (14, 15))
    prop("p_haybale", "items5a/decor_haybale", (14, 12))
    prop("p_trough", "items6a/decor_trough", (16, 9))
    prop("p_signpost", "items5a/decor_signpost", (13, 16))
    prop("p_logs", "items5a/decor_logs", (15, 12))
    prop("p_stump", "items5a/decor_stump", (14, 12))
    prop("p_rock", "ambient1a/decor_rock", (13, 11))
    prop("p_mosslog", "ambient1a/decor_log", (16, 10))
    prop("p_applecrates", "land1a/decor_apple_crates", (15, 15))
    prop("p_wheelbarrow", "items5a/decor_wheelbarrow", (16, 12))
    prop("p_bench", "items5a/decor_bench", (16, 12))
    prop("p_flowerpot", "items5a/decor_flowerpot", (12, 14))
    prop("p_minecart", "land1a/decor_minecart", (15, 13))
    prop("p_crystal", "items6a/decor_crystal", (13, 13))
    prop("p_torch", "items6a/decor_torch", (8, 12), "center")
    prop("p_flowerbox", "items6a/decor_flowerbox", (14, 7))
    # facade windows (drawn over a wall tile; lit at night by the glow pass)
    win = make({"src": "interior1a/int_window", "size": [T, T], "fit": [10, 9], "anchor": "center"})
    out["f_window"] = np.roll(win, -2, axis=0)
    box = make({"src": "items6a/decor_flowerbox", "size": [T, T], "fit": [14, 5]})
    wb = out["f_window"].copy()
    wb[box >= 0] = box[box >= 0]
    out["f_window_box"] = wb
    # interior
    prop("i_fireplace", "interior1a/int_fireplace", (16, 16))
    prop("i_window", "interior1a/int_window", (13, 13), "center")
    prop("i_clock", "interior1a/int_clock", (10, 10), "center")
    prop("i_painting", "interior1a/int_painting", (14, 10), "center")
    prop("i_table", "interior1a/int_table", (15, 13))
    prop("i_chair", "interior1a/int_chair", (11, 15))
    prop("i_stove", "interior1a/int_stove", (15, 16))
    prop("i_plant", "interior1a/int_plant", (13, 15))
    prop("i_dresser", "interior1a/int_dresser", (16, 14))
    prop("i_chest", "interior1a/int_chest", (15, 13))
    prop("i_lamp", "interior1a/int_lamp", (9, 16))
    prop("i_yarn", "interior1a/int_yarn", (13, 10))
    prop("i_apples", "interior1a/int_apples", (13, 14))
    prop("i_armchair", "interior1a/int_armchair", (16, 15))
    shelf = make({"src": "interior1a/int_bookshelf", "size": [T, 32], "fit": [16, 26]})
    out["i_shelf_top"], out["i_shelf_bot"] = split_v(shelf)

    # --- two-tile props: base (props, solid) + top (overhead) ---
    def tall(name, src, fit):
        img = make({"src": src, "size": [T, 32], "fit": list(fit)})
        out[f"{name}_top"], out[f"{name}_base"] = split_v(img)

    tall("t_streetlamp", "items6a/decor_street_lamp", (16, 28))
    tall("t_lanternpole", "land1a/decor_lantern_pole", (14, 28))
    tall("t_well", "world1b/obj_well", (16, 22))
    tall("t_beams", "land1a/decor_mine_beams", (16, 26))
    tall("t_scarecrow", "items5a/decor_scarecrow", (16, 24))
    # trees: the base tile is opaque (grass behind), so it hides the small placeholder tree tile below it
    for kind in ("oak", "pine", "birch"):
        img = make({"src": f"land1a/decor_{kind}", "size": [T, 32], "fit": [16, 30]})
        top, bot = split_v(img)
        out[f"tree_{kind}_top"] = top
        out[f"tree_{kind}_base"] = under(base["grass"], bot)
    bush = make({"src": "land1a/decor_bush", "size": [T, T], "fit": [16, 14]})
    out["bush_big"] = under(base["grass"], bush)
    wide = make({"src": "land1a/decor_laundry", "size": [32, T], "fit": [32, 16]})
    out["w_laundry_l"], out["w_laundry_r"] = split_h(wide)

    # --- roofs (roof layer) and eaves (overhead) ---
    for style in ("red", "slate"):
        for row in "tmb":
            for col in "lcr":
                out[f"roof_{style}_{row}{col}"] = roof_fn(P, style, row, col)
        for col in "lcr":
            out[f"eave_{style}_{col}"] = roof_fn(P, style, "e", col)
    return out
