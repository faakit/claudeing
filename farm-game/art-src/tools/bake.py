"""Baked map tiles: transitions rendered in world space, so edges never repeat and join across tile seams.

scripts/map-art.mjs writes the tiles it needs to `art-src/map-tiles.json` as recipe names, e.g.
    canopy:<seed>:<x>:<y>:<part>:<nb25>    the forest mass (part = in: a forest tile, under/over: an open tile next
                                           to it, drawn under the player or overhead); nb25 = 5x5 forest membership
    shore:<seed>:<x>:<y>:<nb9>             a water tile's bank, wet rim, foam and shallows (nb9 = 3x3 water)
    creep:<ground>:<seed>:<x>:<y>:<nb9>    grass creeping onto a path or dirt tile (nb9 = 3x3 green)
and build.py renders each one here. Every noise value is a function of world pixel coordinates and the seed, so a
tile's edge matches its neighbour's. Rules from the art critic: transitions use leaf-dark/teal lips (never ink),
objects (tree crowns) get the ink outline, shadows fall down-right as dithered teal.
"""
from __future__ import annotations

import numpy as np

T = 16
M32 = 0xFFFFFFFF


def hash2(x, y, s):
    """Vectorised integer hash -> uint32 (same idea as the map generator's)."""
    x = np.asarray(x, dtype=np.int64) & M32
    y = np.asarray(y, dtype=np.int64) & M32
    h = (x * 374761393 + y * 668265263 + (s & M32) * 2246822519) & M32
    h = ((h ^ (h >> 13)) * 1274126177) & M32
    return (h ^ (h >> 16)) & M32


def vnoise(X, Y, cell: float, seed: int):
    """Smooth value noise in [0,1) at world pixel coords."""
    gx = np.floor(X / cell).astype(np.int64)
    gy = np.floor(Y / cell).astype(np.int64)
    fx = X / cell - gx
    fy = Y / cell - gy
    s = lambda t: t * t * (3 - 2 * t)  # noqa: E731

    def v(i, j):
        return hash2(gx + i, gy + j, seed) / 4294967296.0

    a = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx)
    b = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx)
    return a + (b - a) * s(fy)


def grid(n: int, ox: int, oy: int):
    """World pixel coordinates (X, Y) of an n-tile square window whose top-left tile is (ox, oy)."""
    ys, xs = np.mgrid[0 : n * T, 0 : n * T]
    return xs + ox * T + 0.5, ys + oy * T + 0.5


def sdf(inside: np.ndarray) -> np.ndarray:
    """Signed distance (px) to the boundary: positive inside, negative outside (brute force, small windows)."""
    h, w = inside.shape
    ys, xs = np.mgrid[0:h, 0:w]
    pts_in = np.stack([xs[inside], ys[inside]], 1).astype(np.float32)
    pts_out = np.stack([xs[~inside], ys[~inside]], 1).astype(np.float32)
    q = np.stack([xs.ravel(), ys.ravel()], 1).astype(np.float32)

    def nearest(pts):
        if len(pts) == 0:
            return np.full(len(q), 99.0, dtype=np.float32)
        best = np.full(len(q), 1e9, dtype=np.float32)
        for k in range(0, len(pts), 512):
            d = ((q[:, None, :] - pts[None, k : k + 512, :]) ** 2).sum(-1)
            best = np.minimum(best, d.min(1))
        return np.sqrt(best)

    d_out = nearest(pts_out).reshape(h, w)  # for inside pixels: distance to the outside
    d_in = nearest(pts_in).reshape(h, w)
    return np.where(inside, d_out - 0.5, -(d_in - 0.5))


def blur(a: np.ndarray, sigma: float) -> np.ndarray:
    r = int(sigma * 2.5)
    k = np.exp(-(np.arange(-r, r + 1) ** 2) / (2 * sigma * sigma))
    k /= k.sum()
    p = np.pad(a, r, mode="edge")
    p = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 1, p)
    p = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 0, p)
    return p


def window_mask(nb: str, n: int) -> np.ndarray:
    """An n x n tile membership string -> a pixel mask of the window."""
    cells = np.array([c == "1" for c in nb], dtype=bool).reshape(n, n)
    return np.kron(cells, np.ones((T, T), dtype=bool))


def centre(a: np.ndarray, n: int) -> np.ndarray:
    o = (n // 2) * T
    return a[o : o + T, o : o + T]


# ---------------------------------------------------------------- terrain edges (shore, creep)


def smooth_field(nb: str, x: int, y: int, seed: int, wobble: float, sigma: float = 2.6) -> np.ndarray:
    """Signed distance into the 'own' terrain (nb9 '1' = own), with rounded corners (blurred SDF) and a
    world-space wobble so the edge meanders. Returns the 16x16 field of the centre tile."""
    inside = window_mask(nb, 3)
    d = blur(sdf(inside), sigma)
    X, Y = grid(3, x - 1, y - 1)
    d = d + (vnoise(X, Y, 7.0, seed) - 0.5) * 2 * wobble + (vnoise(X, Y, 3.0, seed + 1) - 0.5) * wobble * 0.6
    return centre(d, 3), centre(X, 3), centre(Y, 3), centre(inside, 3)


def normal_up(nb: str) -> np.ndarray:
    """Per pixel of the centre tile: True where the nearest other terrain is to the north (a bank face shows)."""
    inside = window_mask(nb, 3)
    d = blur(sdf(inside), 2.6)
    gy = np.gradient(d, axis=0)
    gx = np.gradient(d, axis=1)
    return centre((gy > 0.35) & (gy > np.abs(gx) * 0.8), 3)


def water_px(P, X, Y, seed: int) -> np.ndarray:
    """Open water in world space: flat water with sparse short glints (a dash of sky over a dusk-blue underline),
    one candidate per 9x6 px cell, jittered, so nothing lines up on a grid."""
    t = np.full(X.shape, P.name("water"), dtype=np.int32)
    xi, yi = X.astype(int), Y.astype(int)
    cx, cy = xi // 9, yi // 6
    h = hash2(cx, cy, seed + 21)
    on = (h % 7) < 2
    ox, oy = (h >> 3) % 6, (h >> 6) % 4
    lx, ly = xi - cx * 9 - ox, yi - cy * 6 - oy
    n = 2 + (h >> 9) % 2
    dash = on & (ly == 0) & (lx >= 0) & (lx < n)
    under = on & (ly == 1) & (lx >= 1) & (lx <= n)
    t[dash] = P.name("sky")
    t[under] = P.name("dusk blue")
    return t


def water(P, recipe: list[str]) -> np.ndarray:
    seed, x, y = int(recipe[1]), int(recipe[2]), int(recipe[3])
    X, Y = grid(1, x, y)
    return water_px(P, X, Y, seed)


def shore(P, recipe: list[str], grass: np.ndarray) -> np.ndarray:
    """A water tile's edge: convex corners rounded with a 10 px radius (an opening of the water shape), a bank
    that meanders 1-5 px into the water tile in coves and bulges, so the drawn edge stays within ~5 px of the real
    (collision) edge; earth bank face where land is north, wet rim, broken foam, then world-space water."""
    seed, x, y, nb = int(recipe[1]), int(recipe[2]), int(recipe[3]), recipe[4]
    inside = window_mask(nb, 3)
    R = 14.0  # convex corners: the drawn bank cuts ~5 px off the corner along the diagonal
    sd = sdf(inside)
    core = sd > R
    if core.any():
        cd = sdf(core)  # negative outside the eroded core: -distance to it
        opened = -cd - 0.5
        d = np.minimum(sd, R - opened)  # inside the opened shape: the distance to its rounded edge
    else:
        d = sd
    d = blur(d, 1.6)
    X, Y = grid(3, x - 1, y - 1)
    meander = (vnoise(X, Y, 22.0, seed + 9) - 0.5) * 5.6 + (vnoise(X, Y, 6.0, seed + 3) - 0.5) * 1.2
    d = centre(d - 2.8 - meander, 3)  # coves and bulges: the drawn bank sits 0-5 px inside the water tile
    X, Y = centre(X, 3), centre(Y, 3)
    up = normal_up(nb)
    t = water_px(P, X, Y, seed)
    gx, gy = (X.astype(int) % T), (Y.astype(int) % T)
    foam_n = vnoise(X, Y, 2.0, seed + 7)
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


def creep(P, recipe: list[str], grass: np.ndarray) -> np.ndarray:
    ground, seed, x, y, nb = recipe[1], int(recipe[2]), int(recipe[3]), int(recipe[4]), recipe[5]
    # own terrain = path/dirt (nb9 '1' = green): flip so the field is the depth into the path
    own = "".join("0" if c == "1" else "1" for c in nb)
    d, X, Y, _ = smooth_field(own, x, y, seed, 1.6, 3.0)
    d = d - 2.0  # grass reaches 1-4 px onto the path, in tufts
    t = np.full((T, T), -1, dtype=np.int32)
    gx, gy = (X.astype(int) % T), (Y.astype(int) % T)
    inside = window_mask(own, 3)
    g = blur(sdf(inside), 1.8)
    from_nw = centre(np.gradient(g, axis=0) + np.gradient(g, axis=1), 3) > 0.25  # grass is north or west
    shadow = P.name("wood" if ground == "path" else "soil")
    for j in range(T):
        for i in range(T):
            v = d[j, i]
            if v < 0:
                t[j, i] = grass[gy[j, i], gx[j, i]]
                if v > -1:
                    t[j, i] = P.name("leaf dark") if (i + j) % 2 == 0 else P.name("leaf mid")
            elif v < 1.2 and from_nw[j, i] and (i + j) % 2 == 0:
                t[j, i] = shadow
    return t


# ---------------------------------------------------------------- the forest mass


def _crowns(nb25: str, x: int, y: int, seed: int):
    """Crowns of the forest tiles in the 3x3 around (x, y), in a 48x48 window (origin = tile x-1, y-1)."""
    f = np.array([c == "1" for c in nb25], dtype=bool).reshape(5, 5)
    out = []
    for j in range(1, 4):
        for i in range(1, 4):
            if not f[j, i]:
                continue
            wx, wy = x - 2 + i, y - 2 + j
            hx = int(hash2(wx, wy, seed))
            jx = (hx % 5) - 2
            jy = ((hx >> 4) % 3) - 1
            r = 8.6 + ((hx >> 8) % 4) * 0.45
            south_open = not f[j + 1, i]
            north_open = not f[j - 1, i]
            cy = 8 + jy
            if south_open:
                cy = 4 + jy * 0.5
                r = min(r, 8.6)
            elif north_open:
                cy = 5 + jy
            cx = (i - 1) * T + 8 + jx
            kind = "pine" if hx % 9 == 0 else "birch" if hx % 9 in (4, 7) else "oak"
            out.append(
                {
                    "kind": kind,
                    "cx": cx,
                    "cy": (j - 1) * T + cy,
                    "r": r,
                    "trunk": south_open,
                    "src": (i - 2, j - 2),  # offset of the source tile from the centre
                }
            )
    out.sort(key=lambda c: c["cy"])
    return out, f


def canopy(P, recipe: list[str]) -> np.ndarray:
    seed, x, y, part, nb25 = int(recipe[1]), int(recipe[2]), int(recipe[3]), recipe[4], recipe[5]
    crowns, f = _crowns(nb25, x, y, seed)
    X, Y = grid(3, x - 1, y - 1)
    leaf = vnoise(X, Y, 2.2, seed + 3)
    edge_n = vnoise(X, Y, 3.0, seed + 5)
    ink, glint = P.outline, P.name("new leaf")
    hi, mid, dark, deep = P.name("grass"), P.name("leaf mid"), P.name("leaf dark"), P.name("teal shade")
    wood, bark, earth = P.name("wood"), P.name("soil"), P.name("earth dark")
    S = 3 * T
    img = np.full((S, S), -1, dtype=np.int32)
    owner = np.full((S, S), -1, dtype=np.int32)  # which crown covers each pixel (draw order index)
    ys, xs = np.mgrid[0:S, 0:S]
    forest_px = window_mask("".join("1" if f[j, i] else "0" for j in range(1, 4) for i in range(1, 4)), 3)

    def keep(c) -> bool:
        dx, dy = c["src"]
        if part == "in":
            return True
        if part == "over":
            return dy == 1  # crowns rising from the row south of an open tile: drawn overhead
        return dy != 1

    for k, c in enumerate(crowns):
        if c["trunk"]:
            tx = int(round(c["cx"]))
            top = int(c["cy"] + c["r"] * 0.5)
            bottom = (int(c["cy"] // T) + 1) * T - 1 if c["cy"] >= 0 else T - 1
            bottom = ((c["src"][1] + 1) * T) + T - 1
            for yy in range(top, bottom + 1):
                for xx, col in ((tx - 2, ink), (tx - 1, wood), (tx, bark), (tx + 1, earth), (tx + 2, ink)):
                    if 0 <= xx < S and 0 <= yy < S and keep(c):
                        img[yy, xx] = col
            for xx in range(tx - 3, tx + 4):
                if 0 <= xx < S and keep(c):
                    img[bottom, xx] = ink
            for xx in (tx - 3, tx + 3):
                if 0 <= xx < S and keep(c):
                    img[bottom - 1, xx] = ink
    for k, c in enumerate(crowns):
        if not keep(c):
            continue
        dx, dy = xs + 0.5 - c["cx"], ys + 0.5 - c["cy"]
        if c["kind"] == "pine":  # a narrower, pointed crown
            dist = np.sqrt((dx * (1.0 + np.clip(-dy, 0, None) / c["r"] * 0.9)) ** 2 + dy * dy)
            ramp = (mid, dark, deep, ink)
        elif c["kind"] == "birch":
            dist = np.sqrt(dx * dx + dy * dy)
            ramp = (glint, hi, mid, dark)
        else:
            dist = np.sqrt(dx * dx + dy * dy)
            ramp = (hi, mid, dark, deep)
        r = c["r"] + (edge_n - 0.5) * 1.6
        m = dist <= r
        light = -(dx + dy) / (np.sqrt(2) * c["r"])
        c_hi, c_mid, c_dark, c_deep = ramp
        col = np.where(light > 0.5, c_hi, np.where(light > -0.15, c_mid, np.where(light > -0.6, c_dark, c_deep)))
        col = np.where((leaf > 0.62) & (col == c_mid), c_dark, col)
        col = np.where((leaf < 0.25) & (col == c_dark), c_mid, col)
        if c["kind"] != "birch":
            col = np.where((leaf > 0.8) & (light > 0.2), glint if c["kind"] == "oak" else c_hi, col)
        rim = m & (dist > r - 1.0)
        col = np.where(rim & (owner >= 0), c_dark if c["kind"] != "birch" else dark, col)  # a dark seam where this crown overlaps one behind it
        img[m] = col[m]
        owner[m] = k
    # deep shade in the forest's gaps; ink outline around the silhouette
    covered = img >= 0
    if part == "in":
        o = T
        gap = forest_px & ~covered
        far = sdf(forest_px) > 3.5
        img[gap & far] = deep
        covered = img >= 0
    sil = covered.copy()
    outline = np.zeros_like(sil)
    outline[1:, :] |= sil[:-1, :] & ~sil[1:, :]
    outline[:-1, :] |= sil[1:, :] & ~sil[:-1, :]
    outline[:, 1:] |= sil[:, :-1] & ~sil[:, 1:]
    outline[:, :-1] |= sil[:, 1:] & ~sil[:, :-1]
    if part == "in":
        outline &= forest_px | True
    img[outline] = ink
    if part == "under":
        # the wood's shadow, cast down-right onto open ground (dithered teal)
        allc = np.zeros((S, S), dtype=bool)
        for c in crowns:
            dx, dy = xs + 0.5 - c["cx"], ys + 0.5 - c["cy"]
            allc |= np.sqrt(dx * dx + dy * dy) <= c["r"] + 0.5
            if c["trunk"]:
                allc[int(c["cy"]) : ((c["src"][1] + 2) * T), :] |= False
        allc |= forest_px
        near = np.zeros_like(allc)
        for sx, sy in ((1, 2), (2, 3), (3, 4)):
            sh = np.zeros_like(allc)
            sh[sy:, sx:] = allc[:-sy, :-sx]
            near |= sh
        dith = ((xs + ys) % 2 == 0)
        mask = near & ~allc & ~covered & dith & ~forest_px
        img[mask] = deep
    o = T
    return img[o : o + T, o : o + T].copy()


def bake(P, name: str, grass: np.ndarray, floor: np.ndarray | None = None) -> np.ndarray:
    r = name.split(":")
    if r[0] == "shore":
        return shore(P, r, grass)
    if r[0] == "creep":
        return creep(P, r, grass)
    if r[0] == "canopy":
        return canopy(P, r)
    if r[0] == "rock":
        return rock(P, r, floor)
    if r[0] == "water":
        return water(P, r)
    if r[0] == "floor":
        return floor_dark(P, r, floor)
    if r[0] == "ao":
        return occlusion(P, r)
    raise ValueError(f"unknown baked tile {name}")


# ---------------------------------------------------------------- mine rock


def rock(P, recipe: list[str], floor: np.ndarray) -> np.ndarray:
    """A mine wall or boulder seen from above: a dark rock top with a lit rim, and a carved face (up to 8 px)
    where the cavern floor is to the south, so pillars read as part of the rock, not stickers on it."""
    seed, x, y, nb = int(recipe[1]), int(recipe[2]), int(recipe[3]), recipe[4]
    inside = window_mask(nb, 3)
    X, Y = grid(3, x - 1, y - 1)
    d = blur(sdf(inside), 2.4) + (vnoise(X, Y, 5.0, seed) - 0.5) * 2.0 - 0.6
    rk = d > 0
    S = 3 * T
    face = np.zeros((S, S), dtype=np.int32)  # rows of rock above the floor below (0 = not a face pixel)
    for i in range(S):
        run = 0
        for j in range(S - 1, -1, -1):
            if not rk[j, i]:
                run = 0
                continue
            run += 1
            face[j, i] = run if run <= 8 else 0
    strata = vnoise(X * 0.6, Y * 2.2, 3.0, seed + 4)
    grit = vnoise(X, Y, 3.5, seed + 6)
    t = np.full((S, S), -1, dtype=np.int32)
    t[~rk] = floor[(Y[~rk].astype(int)) % T, (X[~rk].astype(int)) % T]
    top = rk & (face == 0)
    t[top] = P.name("stone dark")
    t[top & (grit > 0.74) & (((X + Y).astype(int)) % 2 == 0)] = P.name("plum shadow")
    t[top & (grit < 0.16) & (((X * 3 + Y).astype(int)) % 4 == 0)] = P.name("taupe")
    fc = face > 0
    t[fc] = P.name("stone")
    t[fc & (strata > 0.62)] = P.name("taupe")
    t[fc & (strata < 0.25)] = P.name("stone dark")
    t[face == 8] = P.name("stone lt")  # the lit lip where the top turns into the face
    t[(face == 1) | (face == 2)] = P.name("stone dark")
    # ink where rock meets floor; a lit rim on the top's north and west edges
    edge = np.zeros((S, S), dtype=bool)
    edge[:-1, :] |= rk[:-1, :] & ~rk[1:, :]
    edge[1:, :] |= rk[1:, :] & ~rk[:-1, :]
    edge[:, :-1] |= rk[:, :-1] & ~rk[:, 1:]
    edge[:, 1:] |= rk[:, 1:] & ~rk[:, :-1]
    t[edge] = P.outline
    rim = np.zeros((S, S), dtype=bool)
    rim[1:, :] |= top[1:, :] & edge[:-1, :]
    rim[:, 1:] |= top[:, 1:] & edge[:, :-1]
    t[rim & ~edge] = P.name("stone")
    # a soft dithered shadow on the floor just south of a face
    below = np.zeros((S, S), dtype=bool)
    for k in (1, 2):
        below[k:, :] |= rk[:-k, :]
    sh = below & ~rk & (((X + Y).astype(int)) % 2 == 0)
    t[sh] = P.name("stone dark")
    return centre(t, 3).copy()


def occlusion(P, recipe: list[str]) -> np.ndarray:
    """Cavern floor darkening toward the rock around it (dithered stone dark, densest at the wall foot)."""
    seed, x, y, nb = int(recipe[1]), int(recipe[2]), int(recipe[3]), recipe[4]
    inside = window_mask(nb, 3)  # '1' = rock
    X, Y = grid(3, x - 1, y - 1)
    d = -blur(sdf(inside), 1.5) + (vnoise(X, Y, 4.0, seed) - 0.5) * 2.0  # distance out from the rock
    t = np.full((3 * T, 3 * T), -1, dtype=np.int32)
    xi, yi = X.astype(int), Y.astype(int)
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    thr = bayer[yi % 4, xi % 4]
    dens = np.clip((6.0 - d) / 6.0, 0, 1) * 0.55
    t[(~inside) & (thr < dens)] = P.name("stone dark")
    return centre(t, 3).copy()


def floor_dark(P, recipe: list[str], floor: np.ndarray) -> np.ndarray:
    """Cavern floor with a darker pocket: darkness given at the tile's four corners (0-9, from the torch distance
    and a smooth noise in the map generator), interpolated per pixel and dithered with stone dark."""
    seed, x, y, c = int(recipe[1]), int(recipe[2]), int(recipe[3]), recipe[4]
    c00, c10, c01, c11 = (int(ch) / 9.0 for ch in c)
    X, Y = grid(1, x, y)
    fx, fy = (X - x * T) / T, (Y - y * T) / T
    dark = (c00 * (1 - fx) + c10 * fx) * (1 - fy) + (c01 * (1 - fx) + c11 * fx) * fy
    dark = dark + (vnoise(X, Y, 3.0, seed) - 0.5) * 0.25
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
    thr = bayer[Y.astype(int) % 4, X.astype(int) % 4]
    t = floor.copy()
    t[thr < dark * 0.5] = P.name("stone dark")
    return t
