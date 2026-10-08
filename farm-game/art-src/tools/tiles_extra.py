"""Extra tileset tiles for the map layers (appended after the 21 placeholder tiles, which keep their indices).

The map generator (scripts/map-art.mjs) reads `public/assets/tilesets/tiles.json` (tile name -> index) and fills
these layers, all purely visual except `props`, whose tiles are also added to the collision layer:
  detail   opaque ground under objects, autotiled transitions (grass creeping onto paths, shorelines, the forest
           mass, rock masses, fences, cobbles), ground variation
  shade    dithered drop shadows, flat flora and decor (wildflowers, pebbles, lilies, reeds, rugs)
  roof     roofs over building blocks (all but the facade row), facade decor (windows, doors, a forge)
  props    upright props on their own tile (barrels, lamps, furniture, tree trunks)
  overhead what you walk behind: tree canopies, lamp tops, roof ridges, the chimney
Most new tiles are authored in maptiles.py; Flow crops supply the props and furniture.
"""
from __future__ import annotations

import numpy as np

T = 16
N, E, S, W = 1, 2, 4, 8


def _h(*v: int) -> int:
    """Small deterministic hash (stable ragged edges)."""
    h = 2166136261
    for x in v:
        h = ((h ^ (x & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


def rock_mass(P, mask: int, salt: int) -> np.ndarray:
    """Mine wall seen from above: a rock top, a carved face where the floor is south, ink rims elsewhere."""
    top, top_l, top_d = P.name("stone dark"), P.name("taupe"), P.name("plum shadow")
    face, face_l, ink = P.name("stone"), P.name("stone lt"), P.outline
    t = np.full((T, T), top, dtype=np.int32)
    r = np.random.default_rng(salt)
    for _ in range(10):
        x, y = r.integers(0, T, 2)
        t[y, x] = top_l if r.integers(0, 2) else top_d
    if mask & S:
        for y in range(9, T):
            for x in range(T):
                t[y, x] = face
                if (x + _h(x, salt)) % 5 == 0 and y > 10:
                    t[y, x] = top_d  # vertical cracks in the face
                if y == T - 2 and (x + salt) % 3 == 0:
                    t[y, x] = P.name("taupe")
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


def split_v(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """A 16x32 sprite -> (top tile, bottom tile)."""
    return img[:T], img[T:]


def split_h(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    return img[:, :T], img[:, T:]


def build_extra(P, make, base: dict[str, np.ndarray], roof_fn) -> dict[str, np.ndarray]:
    """All extra tiles by name, in a stable order (dict insertion order = tileset order)."""
    import maptiles as mt

    out: dict[str, np.ndarray] = {}
    grass_tex = base["grass"]

    # --- autotiled transitions (blob masks, see maptiles.canon) ---
    for m in mt.BLOB:
        out[f"edge_path_{m}"] = mt.creep(P, m, grass_tex, "wood", 3)
    for m in mt.BLOB:
        out[f"edge_dirt_{m}"] = mt.creep(P, m, grass_tex, "soil", 7)
    for m in mt.BLOB:
        out[f"shore_{m}"] = mt.shore(P, m, grass_tex, 11)
    rock_top = np.full((T, T), P.name("stone dark"), dtype=np.int32)
    mt.speckle(rock_top, P.name("plum shadow"), 6, 41, ((0, 0), (1, 0)))
    mt.speckle(rock_top, P.name("taupe"), 3, 42)
    out["rock_0"] = rock_top
    # --- the forest mass (tree tiles joined to the map edge) ---
    tex = mt.canopy_texture(P, 5)
    out["canopy_0"] = tex.copy()
    for m in mt.BLOB:
        out[f"canopy_{m}"] = mt.canopy(P, m, tex, m % 7)
    for k in range(3):
        out[f"canopy_over_{k}"] = mt.canopy_overhang(P, tex, k * 2 + 1)
    out["canopy_shade_n"] = mt.canopy_shadow(P, "n")
    out["canopy_shade_w"] = mt.canopy_shadow(P, "w")
    # --- fences (4-bit fence-neighbour mask), cobbles, interior walls ---
    for m in range(16):
        out[f"fence_{m}"] = mt.fence(P, m)
    for m in range(16):
        out[f"cobble_{m}"] = mt.cobble(P, m, m)
    out["wall_face"] = mt.wall_face(P)
    for m in range(16):
        out[f"wall_top_{m}"] = mt.wall_top(P, m)

    # --- opaque ground bases (detail layer, under objects and over the placeholder object tiles) ---
    out["base_grass"] = grass_tex.copy()
    out["base_grass_2"] = mt.grass_base(P, 31)
    # opaque grass variants for the detail layer: plain ones break the 16 px repeat, lush ones make patches
    for k in range(4):
        out[f"grass_{k}"] = mt.grass_base(P, 400 + k * 7)
    for k in range(3):
        g = mt.grass_base(P, 500 + k * 7)
        blades = mt.grass_patch(P, 10 + k * 3, 600 + k)
        g[blades >= 0] = blades[blades >= 0]
        out[f"lush_{k}"] = g
    out["base_water"] = mt.water_base(P, 900, 2)
    for k in range(3):
        out[f"water_{k}"] = mt.water_base(P, 910 + k, 1 + k % 2)
    out["base_stone"] = base["stone"].copy()
    out["base_path"] = base["path"].copy()
    out["base_floor"] = base["floor"].copy()
    for k, mood in enumerate(("calm", "earth", "worn", "dark")):
        out[f"stone_{k}"] = mt.mine_floor(P, 700 + k * 5, mood)
    bed = make({"src": "world1b/tile_bed", "size": [32, 32], "fit": [24, 31], "anchor": "center"})
    out["bed_tl"], out["bed_tr"] = split_h(bed[:T])
    out["bed_bl"], out["bed_br"] = split_h(bed[T:])

    # --- shade: dithered drop shadows (light top-left) ---
    for g in ("grass", "path", "stone", "floor", "dirt"):
        out[f"shade_n_{g}"] = mt.ground_shadow(P, "n", g)
        out[f"shade_e_{g}"] = mt.ground_shadow(P, "e", g)

    # --- ground variation and flora: no outlines, low contrast ---
    for k, (dens, seed) in enumerate(((5, 1), (6, 2), (9, 3), (12, 4))):
        out[f"gv_{k}"] = mt.grass_patch(P, dens, 100 + seed)
    for kind in ("rose", "daisy", "butter", "lilac"):
        for k in range(2):
            out[f"bloom_{kind}_{k}"] = mt.bloom(P, kind, 200 + k * 17 + len(kind))

    def flat(src, fit, to="leaf dark", anchor="center"):
        return mt.strip_outline(P, make({"src": src, "size": [T, T], "fit": list(fit), "anchor": anchor}), to)

    out["rose_1"] = flat("ambient1a/decor_rose", (8, 9))
    out["rose_2"] = flat("ambient1a/decor_rose_clump", (13, 11))
    out["tallgrass"] = flat("nature2a/n2_tallgrass", (12, 11))
    out["pebbles"] = mt.pebbles(P, 1)
    out["pebbles_2"] = mt.pebbles(P, 2)
    out["puddle"] = mt.puddle(P, 0)
    for k in range(3):
        out[f"path_{k}"] = mt.path_base(P, 800 + k * 3)
    out["path_worn"] = mt.path_worn(P, 811, False)
    out["path_ruts"] = mt.path_worn(P, 812, True)
    for kind in ("h", "v", "ne", "nw", "se", "sw"):
        out[f"rail_{kind}"] = mt.rail(P, kind)
    out["rubble"] = mt.rubble(P, 3)
    out["rubble_2"] = mt.rubble(P, 8)
    for k in range(3):
        out[f"cracks_{k}"] = mt.cracks(P, 300 + k)
    out["stepping"] = mt.stepping_stone(P)
    rug = make({"src": "interior1a/int_rug", "size": [32, 32], "fit": [30, 22], "anchor": "center"})
    out["rug_tl"], out["rug_tr"] = split_h(rug[:T])
    out["rug_bl"], out["rug_br"] = split_h(rug[T:])
    # water decor
    out["lily_0"] = make({"src": "village2a/p2_lily", "size": [T, T], "fit": [13, 10], "anchor": "center"})
    out["lily_1"] = np.fliplr(make({"src": "village2a/p2_lily", "size": [T, T], "fit": [10, 8], "anchor": "center"}))
    out["reeds_n"] = make({"src": "village2a/p2_reeds", "size": [T, T], "fit": [14, 15]})
    out["reeds_s"] = make({"src": "village2a/p2_reeds", "size": [T, T], "fit": [12, 13]})
    boat = make({"src": "village2a/p2_boat", "size": [T, 32], "fit": [13, 28], "anchor": "center"})
    out["boat_t"], out["boat_b"] = split_v(boat)

    # --- props: single solid tiles, transparent background, bottom-anchored ---
    def prop(name, src, fit, anchor="bottom"):
        out[name] = make({"src": src, "size": [T, T], "fit": list(fit), "anchor": anchor})

    prop("p_barrel", "items5a/decor_barrel", (12, 14))
    prop("p_crates", "items5a/decor_crates", (14, 15))
    prop("p_haybale", "items5a/decor_haybale", (14, 12))
    prop("p_trough", "items6a/decor_trough", (16, 9))
    prop("p_signpost", "items5a/decor_signpost", (13, 16))
    prop("p_logs", "items5a/decor_logs", (15, 12))
    prop("p_stump", "nature2a/n2_stump", (14, 13))
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
    # village life (Flow sheet village2): who lives where
    prop("p_anvil", "village2a/p2_anvil", (14, 15))
    prop("p_coal", "village2a/p2_coal", (14, 11))
    prop("p_netrack", "village2a/p2_netrack", (16, 16))
    prop("p_bucket", "village2a/p2_bucket", (10, 11))
    prop("p_toolrack", "village2a/p2_toolrack", (16, 14))
    prop("p_firewood", "village2a/p2_firewood", (15, 14))
    prop("p_fishcrate", "village2a/p2_fishcrate", (14, 13))
    prop("p_sign_sprout", "village2a/p2_sign_sprout", (15, 15))
    prop("p_cat", "village2a/p2_cat", (13, 9))
    prop("p_flowerbed", "village2a/p2_windowbox", (16, 10))
    # nature (Flow sheet nature2)
    prop("p_boulder", "nature2a/n2_boulder", (15, 12))
    prop("p_rocks", "nature2a/n2_rocks", (14, 10))
    prop("p_hollowlog", "nature2a/n2_hollowlog", (16, 10))
    prop("p_rootstump", "nature2a/n2_stump", (15, 14))
    # bushes and ferns: transparent bases (R2-3: the detail layer paints the ground under them)
    bush = make({"src": "land1a/decor_bush", "size": [T, T], "fit": [16, 14]})
    out["bush_big"] = bush
    out["bush_berry"] = make({"src": "nature2a/n2_berrybush", "size": [T, T], "fit": [15, 14]})
    out["bush_rose"] = make({"src": "nature2a/n2_pinkbush", "size": [T, T], "fit": [15, 14]})
    out["bush_small"] = make({"src": "land1a/decor_bush", "size": [T, T], "fit": [12, 10]})
    out["fern"] = make({"src": "nature2a/n2_ferns", "size": [T, T], "fit": [15, 13]})
    out["fern_flat"] = flat("nature2a/n2_ferns", (13, 11))
    # flower patches (flat ground flora: outline softened to leaf dark so they sit in the grass)
    for kind in ("roses", "daisies", "buttercups", "lavender"):
        out[f"patch_{kind}"] = flat(f"nature2a/n2_{kind}", (14, 12))
    # facade decor (over wall tiles; windows are lit at night by the glow pass)
    win = make({"src": "interior1a/int_window", "size": [T, T], "fit": [10, 9], "anchor": "center"})
    out["f_window"] = np.roll(win, -2, axis=0)
    box = make({"src": "items6a/decor_flowerbox", "size": [T, T], "fit": [14, 5]})
    wb = out["f_window"].copy()
    wb[box >= 0] = box[box >= 0]
    out["f_window_box"] = wb
    for name, (key, rows) in mt.FACADE.items():
        out[name] = mt.draw(P, rows, key, anchor_bottom=name != "f_lantern")
    out["f_lantern"] = make({"src": "village2a/p2_lantern", "size": [T, T], "fit": [9, 13], "anchor": "center"})
    box = make({"src": "village2a/p2_windowbox", "size": [T, T], "fit": [14, 7]})
    wb = out["f_window"].copy()
    wb[box >= 0] = box[box >= 0]
    out["f_window_box"] = wb
    vane = make({"src": "village2a/p2_weathervane", "size": [T, T], "fit": [12, 16]})
    out["vane"] = vane
    out["cave_l"] = mt.cave_mouth(P, "l")
    out["cave_r"] = mt.cave_mouth(P, "r")
    for part in "lcr":
        out[f"lintel_{part}"] = mt.mine_lintel(P, part)
    out["boat_l"], out["boat_r"] = mt.boat(P)
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
    # standalone trees: transparent bases (R2-3), canopy top drawn overhead
    for kind in ("oak", "pine", "birch"):
        img = make({"src": f"land1a/decor_{kind}", "size": [T, 32], "fit": [16, 30]})
        out[f"tree_{kind}_top"], out[f"tree_{kind}_base"] = split_v(img)
    oak = make({"src": "nature2a/n2_oak", "size": [48, 64], "fit": [46, 52]})
    out.update(mt.tiles_of(oak, "bigoak"))
    wide = make({"src": "land1a/decor_laundry", "size": [32, T], "fit": [32, 16]})
    out["w_laundry_l"], out["w_laundry_r"] = split_h(wide)

    # --- roofs (roof layer) and eaves (overhead) ---
    for style in ("red", "slate"):
        for row in "tmb":
            for col in "lcr":
                out[f"roof_{style}_{row}{col}"] = roof_fn(P, style, row, col)
        for col in "lcr":
            out[f"eave_{style}_{col}"] = roof_fn(P, style, "e", col)
        # the eave's shadow on the facade's top rows (shade layer, under windows and doors)
        if style == "red":
            es = np.full((T, T), -1, dtype=np.int32)
            es[0, :] = P.name("plum shadow")
            es[1, ::2] = P.name("plum shadow")
            out["eave_shadow"] = es
        # a chimney on the roof's top row: composited so the roof and ridge layers hold one tile per cell
        ctop, cbase = mt.chimney(P)
        roof_t, eave = out[f"roof_{style}_tc"].copy(), out[f"eave_{style}_c"].copy()
        roof_t[cbase >= 0] = cbase[cbase >= 0]
        eave[ctop >= 0] = ctop[ctop >= 0]
        out[f"chimney_base_{style}"], out[f"chimney_top_{style}"] = roof_t, eave
        vane = eave.copy() if False else out[f"eave_{style}_c"].copy()
        v = out["vane"]
        vane[v >= 0] = v[v >= 0]
        out[f"vane_{style}"] = vane
    return out
