"""Map-stage tiles (The Dry Year, MILESTONES M2), drawn in code until the art lane paints them.

scripts/map-art.mjs asks for them by recipe name, like the other baked tiles:

    creekwater:<seed>:<x>:<p>:<nb9>                the farm creek running (restored): bank, wet rim, foam and water,
                                                   as bake.py `shore` draws them, on the creek's own bank field
    creekbed:<style>:<seed>:<x>:<p>:<nb9>:<wet9>   the creek's empty bed on the same banks, so the opening morning
                                                   fills the bed instead of changing its shape. style dry (the dry
                                                   stage: warm sand, pebbles and stranded stones, dead reeds, a dark
                                                   cut lip, straw at the top) or damp (waking: brown moist mud,
                                                   closing cracks, the first shoots, green at the top); wet9 = 3x3
                                                   water: the pond laps into the mouth over a silt fan
    bridge:<l|r>                                   the footbridge's west or east half (planks across the creek)
    gate:<shut|open>                               Ilse's gate in the farm's east fence

p = y mod 6: the creek repeats every six rows (its noise is periodic over 96 px down the creek), so a long creek
costs about two dozen tiles per stage, not one per cell. nb9 = 3x3 creek membership (bed, water, the footbridge).
Everything is a function of world pixels (y taken modulo 96) and the seed, so tiles join across seams.
"""
from __future__ import annotations

import numpy as np

from bake import T, blur, centre, grid, hash2, normal_up, sdf, water_px, window_mask

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


def creek_field(nb: str, x: int, p: int, seed: int):
    """The creek's bank, shared by its running water and its empty bed: bake.py `shore`'s geometry (convex corners
    opened to a 14 px radius, a bank that meanders 0-5 px into the creek tile) with periodic noise. Returns the
    signed distance into the creek for the centre tile, and its world pixel coordinates (Y modulo PERIOD)."""
    inside = window_mask(nb, 3)
    R = 14.0
    sd = sdf(inside)
    core = sd > R
    if core.any():
        d = np.minimum(sd, R - (-sdf(core) - 0.5))
    else:
        d = sd
    d = blur(d, 1.6)
    X, Y = grid(3, x - 1, p - 1)
    Y = Y % PERIOD
    meander = (pnoise(X, Y, 24, seed + 9) - 0.5) * 5.6 + (pnoise(X, Y, 6, seed + 3) - 0.5) * 1.2
    return centre(d - 2.8 - meander, 3), centre(X, 3), centre(Y, 3)


def creekwater(P, recipe: list[str], grass: np.ndarray) -> np.ndarray:
    seed, x, p, nb = int(recipe[1]), int(recipe[2]), int(recipe[3]), recipe[4]
    d, X, Y = creek_field(nb, x, p, seed)
    up = normal_up(nb)
    t = water_px(P, X, Y, seed)
    gx, gy = X.astype(int) % T, Y.astype(int) % T
    foam_n = pnoise(X, Y, 2, seed + 7)
    for j in range(T):
        for i in range(T):
            v = d[j, i]
            bank = 2.2 if up[j, i] else 0.0
            if v < 1.0 - bank - 0.8:
                t[j, i] = grass[gy[j, i], gx[j, i]]
                if v > -bank - 0.8:
                    t[j, i] = P.name("leaf dark")
            elif v < 1.0:  # the earth bank face, where land is north of the water
                t[j, i] = P.name("soil") if v < 0.0 else P.name("earth dark")
            elif v < 2.0:
                t[j, i] = P.name("earth dark") if up[j, i] else P.name("teal shade")
            elif v < 3.0:
                if foam_n[j, i] > 0.3:
                    t[j, i] = P.name("ice white")
            elif v < 5.0 and (i + j) % 2 == 0:
                t[j, i] = P.name("dusk blue") if up[j, i] else P.name("sky") if v < 4 else t[j, i]
    return t


def _stones(X, Y, d, seed: int):
    """Stones left stranded in the bed: one candidate per 16x24 px cell, an ellipse about 8x5 px, only well inside
    the bed. Returns (fill, lit, shade, outline) masks."""
    xi, yi = X.astype(int), Y.astype(int)
    fill = np.zeros(X.shape, dtype=bool)
    lit = np.zeros(X.shape, dtype=bool)
    shade = np.zeros(X.shape, dtype=bool)
    for j in (-1, 0, 1):
        for i in (-1, 0, 1):
            cx, cy = xi // 16 + i, yi // 24 + j
            h = hash2(cx, cy % (PERIOD // 24), seed + 61)
            on = (h % 3) == 0
            sx = cx * 16 + 4 + (h >> 3) % 8
            sy = cy * 24 + 6 + (h >> 7) % 12
            ex, ey = (X - sx) / 3.8, (Y - sy) / 2.6
            m = on & (ex * ex + ey * ey <= 1.0)
            fill |= m
            lit |= m & (ex + ey < -0.6)
            shade |= m & (ex + ey > 0.7)
    fill &= d > 5.0  # off the banks: only where the bed is deep
    lit &= fill
    shade &= fill
    fp = np.pad(fill, 1)
    edge = fill & ~(fp[:-2, 1:-1] & fp[2:, 1:-1] & fp[1:-1, :-2] & fp[1:-1, 2:])
    return fill, lit, shade, edge


def creekbed(P, recipe: list[str], grass: np.ndarray) -> np.ndarray:
    style, seed, x, p, nb, wet = recipe[1], int(recipe[2]), int(recipe[3]), int(recipe[4]), recipe[5], recipe[6]
    dry = style == "dry"
    d, X, Y = creek_field(nb, x, p, seed)
    up = normal_up(nb)  # land to the north: the taller earth face of the cut
    g = blur(sdf(window_mask(nb, 3)), 1.8)
    from_nw = centre(np.gradient(g, axis=0) + np.gradient(g, axis=1), 3) > 0.25  # the bank is north or west
    gx, gy = X.astype(int) % T, Y.astype(int) % T
    xi, yi = X.astype(int), Y.astype(int)
    ink = P.outline
    sand, wood, soil, earth, parch = (P.name(n) for n in ("sand", "wood", "soil", "earth dark", "parchment"))
    taupe, sdark, stone, slt = (P.name(n) for n in ("taupe", "stone dark", "stone", "stone lt"))
    if dry:  # warm sand, ochre where the last water stood, bleached patches, grit
        bedc = np.full(X.shape, sand, dtype=np.int32)
        bedc[pnoise(X, Y, 12, seed + 23) > 0.62] = wood
        bedc[hash2(xi, yi, seed + 3) % 23 == 0] = taupe
    else:  # brown moist mud, its cracks closing
        bedc = np.full(X.shape, taupe, dtype=np.int32)
        bedc[pnoise(X, Y, 12, seed + 23) > 0.62] = soil
        d1, d2, _, _ = _voronoi(X, Y, 12, seed + 47)
        bedc[(d2 - d1 < 0.55) & (pnoise(X, Y, 8, seed + 29) > 0.62)] = earth
    # pebbles: 2x1 with a dark underside, one candidate per 6x4 px cell
    cx, cy = xi // 6, yi // 4
    h = hash2(cx, cy, seed + 7)
    on = (h % 11) < 3
    lx, ly = xi - cx * 6 - (h >> 4) % 4, yi - cy * 4 - (h >> 6) % 2
    bedc[on & (ly == 0) & (lx >= 0) & (lx < 2)] = slt if dry else stone
    bedc[on & (ly == 1) & (lx >= 0) & (lx < 2)] = sdark
    # stranded stones, each outlined, its shadow falling down-right onto the bed
    fill, lit, shade, edge = _stones(X, Y, d, seed)
    drop = np.zeros(X.shape, dtype=bool)
    drop[1:, 1:] = fill[:-1, :-1]
    bedc[drop & ~fill] = wood if dry else earth
    bedc[fill] = stone
    bedc[lit] = slt
    bedc[shade] = sdark
    bedc[edge] = ink
    # near the bank: dead reeds standing in the dry bed, the first green shoots in the damp one
    rx, ry = xi // 5, yi // 8
    hr = hash2(rx, ry, seed + 71)
    top = 3 + (hr >> 6) % 3
    stalk = ((hr % 4) == 0) & (xi - rx * 5 == 1 + (hr >> 4) % 3) & (yi - ry * 8 >= top)
    stalk &= (d > 2.6) & (d < 6.5) & ~fill
    if dry:
        bedc[stalk] = soil
        bedc[stalk & (yi - ry * 8 == top)] = parch  # bleached tips
    else:
        bedc[stalk] = P.name("leaf mid")
    # the pond laps into the mouth, over a fan of silt
    if "1" in wet:
        wd = -centre(blur(sdf(window_mask(wet, 3)), 2.0), 3) + (pnoise(X, Y, 8, seed + 51) - 0.5) * 6.0
        lap = wd < 1.2
        bedc[(wd < 13.0) & (pnoise(X, Y, 6, seed + 53) > 0.34 + wd * 0.02)] = parch if dry else taupe
        bedc[wd < 3.6] = soil
        bedc[wd < 2.2] = earth
        bedc[lap] = water_px(P, X, Y, seed)[lap]
        bedc[lap & (wd > 0.4) & ((xi + yi) % 2 == 0)] = P.name("teal shade")
    # the bank, as on the running creek: the lip, the dark cut, the bed in the shadow of a north or west bank
    floor = (sand, taupe, parch, wood, soil)
    t = grass[gy, gx].copy()
    for j in range(T):
        for i in range(T):
            v = d[j, i]
            bank = 2.2 if up[j, i] else 0.0
            if v < 1.0 - bank - 0.8:
                if v > -bank - 0.8:  # the lip: straw on a dry farm, green once it wakes
                    t[j, i] = (sand if (i + j) % 2 else wood) if dry else P.name("leaf dark")
            elif v < 1.0:
                t[j, i] = soil if v < 0.0 else earth
            elif v < 2.0:
                t[j, i] = earth if up[j, i] else soil
            elif v < 4.5 and from_nw[j, i] and (i + j) % 2 == 0 and bedc[j, i] in floor:
                t[j, i] = soil if (not dry or bedc[j, i] == wood) else wood
            else:
                t[j, i] = bedc[j, i]
    return t


def bridge(P, recipe: list[str], _grass=None) -> np.ndarray:
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


def gate(P, recipe: list[str], _grass=None) -> np.ndarray:
    """Ilse's gate in a north-south fence (the farm's east fence), seen from above, matching maptiles.fence: shut,
    a plank gate across the gap from post to post; open, swung inward (west) off its hinge at the north end."""
    state = recipe[1]
    ink, sand, wood, soil = P.outline, P.name("sand"), P.name("wood"), P.name("soil")
    t = np.full((T, T), -1, dtype=np.int32)
    if state == "shut":
        t[0:T, 5] = ink
        t[0:T, 10] = ink
        t[0:T, 6:10] = wood
        t[0:T, 6] = sand  # the lit edge of the planks
        t[0:T, 9] = soil
        for y in (3, 12):  # cross rails
            t[y - 1, 5:11] = ink
            t[y, 6:10] = sand
            t[y + 1, 5:11] = ink
        for k in range(8):  # the diagonal brace between them
            t[4 + k, 6 + (k * 3) // 8] = soil
    else:
        t[0:4, 5] = ink  # the hinge post stays
        t[0:4, 10] = ink
        t[0:4, 6:10] = wood
        t[0, 5:11] = ink
        t[4, 5:11] = ink
        for y in (6, 10):  # the gate lies open along the inside of the fence, rails westward
            t[y - 1, 0:9] = ink
            t[y, 0:8] = sand
            t[y + 1, 0:8] = wood
            t[y + 2, 0:9] = ink
        t[5:13, 0] = ink
        t[5:13, 1] = wood
    return t
