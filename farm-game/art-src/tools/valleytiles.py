"""Map-stage tiles (The Dry Year, MILESTONES M2), drawn in code until the art lane paints them.

scripts/map-art.mjs asks for them by recipe name, like the other baked tiles:

    creekbed:<style>:<seed>:<x>:<p>:<nb9>:<wet9>   the farm creek's empty bed. style dry (the dry stage: cracked
                                                   grey mud, straw at the lip) or damp (waking: moist mud, closing
                                                   cracks, the first shoots, green at the lip); p = y mod 6: the
                                                   bed repeats every six rows (its noise is periodic over 96 px),
                                                   so a long creek costs two dozen tiles, not one per cell; nb9 = 3x3
                                                   bed (or water) membership, wet9 = 3x3 water, where it is wet
    bridge:<l|r>                                   the footbridge's west or east half (planks across the creek)

Everything is a function of world pixels (y taken modulo 96) and the seed, so tiles join across seams.
"""
from __future__ import annotations

import numpy as np

from bake import T, blur, centre, grid, hash2, normal_up, sdf, window_mask

PHASES = 6  # the bed repeats every six rows (map-art.mjs asks for y % 6)
PERIOD = PHASES * T  # its noise is periodic over 96 px down the creek


def pnoise(X, Y, cell: int, seed: int):
    """Smooth value noise in [0,1), periodic in Y over PERIOD (cell must divide it)."""
    n = PERIOD // cell
    gx = np.floor(X / cell).astype(np.int64)
    gy = np.floor(Y / cell).astype(np.int64)
    fx = X / cell - gx
    fy = Y / cell - gy
    s = lambda t: t * t * (3 - 2 * t)  # noqa: E731

    def v(i, j):
        return hash2(gx + i, (gy + j) % n, seed) / 4294967296.0

    a = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx)
    b = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx)
    return a + (b - a) * s(fy)


def _voronoi(X, Y, cell: int, seed: int):
    """Distances to the nearest and second-nearest jittered points (one per `cell` px square, periodic in Y):
    mud plates."""
    n = PERIOD // cell
    gx = np.floor(X / cell).astype(np.int64)
    gy = np.floor(Y / cell).astype(np.int64)
    d1 = np.full(X.shape, 1e9)
    d2 = np.full(X.shape, 1e9)
    ox = np.zeros(X.shape)
    oy = np.zeros(X.shape)
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx, cy = gx + i, gy + j
            h = hash2(cx, cy % n, seed)
            px = (cx + 0.15 + (h % 1000) / 1000.0 * 0.7) * cell
            py = (cy + 0.15 + ((h >> 10) % 1000) / 1000.0 * 0.7) * cell
            d = np.hypot(X - px, Y - py)
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d))
            ox = np.where(closer, X - px, ox)
            oy = np.where(closer, Y - py, oy)
            d1 = np.where(closer, d, d1)
    return d1, d2, ox, oy


def creekbed(P, recipe: list[str], grass: np.ndarray) -> np.ndarray:
    style, seed, x, y, nb, wet = recipe[1], int(recipe[2]), int(recipe[3]), int(recipe[4]), recipe[5], recipe[6]
    dry = style == "dry"
    # the bank: a rounded edge (blurred distance field) that meanders with periodic noise (y is the phase)
    Xw, Yw = grid(3, x - 1, y - 1)
    Yw = Yw % PERIOD
    d = blur(sdf(window_mask(nb, 3)), 2.4)
    d = d + (pnoise(Xw, Yw, 8, seed + 13) - 0.5) * 3.6 + (pnoise(Xw, Yw, 4, seed + 14) - 0.5) * 1.1
    d, X, Y = centre(d, 3) - 1.5, centre(Xw, 3), centre(Yw, 3)  # the bank sits 1-3 px into the bed
    up = normal_up(nb)  # land to the north: a taller earth face shows
    gx, gy = X.astype(int) % T, Y.astype(int) % T
    xi, yi = X.astype(int), Y.astype(int)
    if "1" in wet:  # distance (px) to the water: the mud darkens toward it
        wd = -centre(blur(sdf(window_mask(wet, 3)), 2.0), 3)
    else:
        wd = np.full(X.shape, 99.0)
    taupe, sdark, stone, slt = (P.name(n) for n in ("taupe", "stone dark", "stone", "stone lt"))
    soil, earth, sand, wood = (P.name(n) for n in ("soil", "earth dark", "sand", "wood"))
    bedc = np.full(X.shape, taupe, dtype=np.int32)
    # silt: grey patches where the last water stood longest; damp mud: dark wet patches instead
    silt = pnoise(X, Y, 12, seed + 23)
    if dry:
        bedc[silt < 0.32] = stone
    else:
        bedc[silt > 0.62] = soil
    # cracks: a broken network of thin lines between big clay plates (wide and many when dry, few when damp)
    d1, d2, _, _ = _voronoi(X, Y, 12, seed + 47)
    broken = pnoise(X, Y, 8, seed + 29)
    crack = (d2 - d1 < 0.75) & (broken > (0.3 if dry else 0.62))
    bedc[crack] = earth
    # dust specks on the dry clay, catching the light
    if dry:
        bedc[(hash2(xi, yi, seed + 3) % 29 == 0) & ~crack] = slt
    # stones washed into the bed: 2x1 pebbles with a dark underside, one candidate per 6x4 px cell
    cx, cy = xi // 6, yi // 4
    h = hash2(cx, cy, seed + 7)
    on = (h % 11) < 2
    lx, ly = xi - cx * 6 - (h >> 4) % 4, yi - cy * 4 - (h >> 6) % 2
    bedc[on & (ly == 0) & (lx >= 0) & (lx < 2)] = slt if dry else stone
    bedc[on & (ly == 1) & (lx >= 0) & (lx < 2)] = sdark
    if not dry:  # waking: the first shoots in the moist bed (no pools: they would repeat every six rows)
        bedc[(hash2(xi // 2, yi // 3, seed + 37) % 37 == 0) & ~crack] = P.name("leaf mid")
    # wet mud near standing water
    bedc[wd < 4.0] = soil
    bedc[wd < 2.0] = earth
    t = grass[gy, gx].copy()
    for j in range(T):
        for i in range(T):
            v = d[j, i]
            if v < -2.0:
                continue
            if v < 0.0:  # the lip of the bank: straw tufts on a dry farm, green ones once it wakes
                if (i + j + (1 if v < -1.0 else 0)) % 2 == 0:
                    t[j, i] = (sand if (i * 3 + j) % 5 else wood) if dry else P.name("leaf dark")
            elif v < (3.0 if up[j, i] else 1.4):  # the bank's earth face (taller where the land is north)
                t[j, i] = earth if v < 1.0 else soil
            elif v < 3.4 and (i + j) % 2 == 0 and bedc[j, i] == taupe:
                t[j, i] = stone  # gravel along the foot of the bank
            else:
                t[j, i] = bedc[j, i]
    return t


def bridge(P, recipe: list[str]) -> np.ndarray:
    """Half of a plank footbridge crossing a creek west to east: planks laid north-south, a rail on each long side,
    posts at the outer end. Rows 0-1 and 14-15 stay clear so the bed or the water shows above and below."""
    side = recipe[1]
    ink, wood, sand, soil, earth = P.outline, P.name("wood"), P.name("sand"), P.name("soil"), P.name("earth dark")
    t = np.full((T, T), -1, dtype=np.int32)
    t[3:13, :] = wood
    for xx in range(T):
        if xx % 4 == (1 if side == "l" else 3):
            t[3:13, xx] = soil  # the seam between two planks
        t[3, xx] = sand if xx % 4 else wood
        if (xx * 7) % 5 == 0:
            t[8, xx] = soil  # a knot or a nail line
    t[1, :] = ink  # the north rail: an ink line, then its lit top
    t[2, :] = sand
    t[13, :] = earth  # the south rail and the deck's edge
    t[14, :] = ink
    post = (0, 1) if side == "l" else (T - 2, T - 1)
    for xx in post:
        t[0:15, xx] = wood if xx in (1, T - 2) else ink
    t[0, post[0] : post[1] + 1] = ink
    return t
