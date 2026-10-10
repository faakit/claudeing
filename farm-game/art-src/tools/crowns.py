"""Big tree crowns baked in world space (art round 3, proportions pass).

scripts/map-art.mjs places every tree of a map (the forest mass and the standalone trees) as a crown in world
pixels, then asks for one tile per layer and cell:

    crown:<seed>:<x>:<y>:<mode>:<entries>

mode   `f<nb9>` a forest tile (solid): forest floor in the gaps, every crown that touches it; nb9 = 3x3 forest
       `u`      an open or trunk tile under the player: the crowns of trees on this row or north of it, trunks, and
                the cast shadows of every listed crown
       `o`      the overhead layer of an open tile: the crowns of trees south of it (you walk behind them; the
                overhead layer fades near the player)
entries `~`-joined `<kind><draw>_<cx>_<cy>_<r>_<base>_<flags>`: kind o (oak) / b (birch) / p (pine), draw 1 or 0
       (0 = shadow only), crown centre and radius and trunk foot in world px, flags: t = trunk shows, k = back row
       (one step darker), s = small tree, g = gnarled old trunk.

Crowns are clusters of leaf lumps lit from the top left, darker underneath, outlined in ink, with a dark seam
where a crown overlaps one behind it. Every noise and lump is a function of world coordinates, so tiles join.
"""
from __future__ import annotations

import numpy as np

from bake import T, hash2, vnoise, window_mask

PAD = 2  # px around the tile, so outlines and seams match across tile edges


def parse(entries: str) -> list[dict]:
    out = []
    for e in entries.split("~") if entries else []:
        head, cx, cy, r, base, flags = e.split("_")
        out.append(
            {
                "kind": head[0],
                "draw": head[1] == "1",
                "cx": float(cx),
                "cy": float(cy),
                "r": float(r),
                "base": int(base),
                "trunk": "t" in flags,
                "back": "k" in flags,
                "small": "s" in flags,
                "gnarled": "g" in flags,
            }
        )
    out.sort(key=lambda c: (c["base"], c["cx"]))
    return out


def lumps(c: dict) -> list[tuple[float, float, float]]:
    """Leaf clusters of an oak or birch crown: a body and five lumps, jittered by the crown's world position."""
    r = c["r"]
    h = int(hash2(int(c["cx"]), int(c["cy"]), 977))
    j = lambda k: ((h >> (3 * k)) % 3 - 1) * 0.06 * r  # noqa: E731
    out = [(0.0, 0.05 * r, 0.92 * r)]
    for k, (dx, dy, rr) in enumerate(
        ((0.0, -0.55, 0.56), (-0.48, -0.32, 0.55), (0.5, -0.3, 0.54), (-0.62, 0.18, 0.48), (0.6, 0.2, 0.47))
    ):
        out.append((dx * r + j(k), dy * r + j(k + 5), rr * r))
    return out


def shape(c: dict, X: np.ndarray, Y: np.ndarray, wob: np.ndarray):
    """Mask of one crown, its shade index per pixel (0 light .. 3 deepest) and a seam mask between lumps."""
    dx, dy = X - c["cx"], Y - c["cy"]
    r = c["r"]
    if c["kind"] == "p":  # pine: three stacked tiers, narrow on top
        m = np.zeros(X.shape, dtype=bool)
        shade = np.full(X.shape, 2, dtype=np.int32)
        seam = np.zeros(X.shape, dtype=bool)
        top = -1.6 * r  # tall and narrow: about 2 r wide, 2.7 r tall
        for t in range(3):
            apex = top + t * 0.8 * r
            hgt = 1.1 * r
            hw = (0.55 + 0.22 * t) * r
            v = (dy - apex) / hgt
            inside = (v >= 0) & (v <= 1) & (np.abs(dx) <= v * hw + wob * 0.6)
            local = np.where(dx < -0.15 * hw * v, 1, 2) + np.where(v > 0.78, 1, 0)
            seam |= inside & m & (v < 0.14)
            shade = np.where(inside, local, shade)
            m |= inside
        return m, shade, seam
    if c["kind"] == "b":  # birch: slender
        dx = dx / 0.78
    m = np.zeros(X.shape, dtype=bool)
    shade = np.zeros(X.shape, dtype=np.int32)
    seam = np.zeros(X.shape, dtype=bool)
    for lx, ly, lr in lumps(c):
        ex, ey = dx - lx, dy - ly
        d = np.sqrt(ex * ex + (ey * 1.08) ** 2)
        inside = d <= lr + wob
        light = -(ex * 0.55 + ey * 0.85) / max(lr, 1.0)
        local = np.where(light > 0.42, 0, np.where(light > -0.12, 1, np.where(light > -0.62, 2, 3)))
        seam |= inside & m & (d > lr + wob - 1.0)
        shade = np.where(inside, local, shade)
        m |= inside
    # the underside of the canopy sits in its own shadow
    shade = np.where(m & (dy > 0.5 * r), np.maximum(shade, 2), shade)
    return m, shade, seam


def crown_tile(P, recipe: list[str]) -> np.ndarray:
    seed, x, y, mode = int(recipe[1]), int(recipe[2]), int(recipe[3]), recipe[4]
    crowns = parse(recipe[5] if len(recipe) > 5 else "")
    S = T + 2 * PAD
    ys, xs = np.mgrid[0:S, 0:S]
    X = xs + x * T - PAD + 0.5
    Y = ys + y * T - PAD + 0.5
    forest = None
    if mode.startswith("f"):
        nb = mode[1:]
        full = window_mask(nb, 3)
        # the wood's south edge: the floor stops halfway down the cell, so the edge trees' trunks stand on grass
        # in their own shade instead of in a dark box (the cells' south neighbours known from nb9: rows 0 and 1)
        for j in (0, 1):
            for i in range(3):
                if nb[j * 3 + i] == "1" and nb[(j + 1) * 3 + i] == "0":
                    full[j * T + T // 2 : (j + 1) * T, i * T : (i + 1) * T] = False
        forest = full[T - PAD : 2 * T + PAD, T - PAD : 2 * T + PAD]
    img = paint(P, X, Y, crowns, seed, forest=forest, shadows=mode == "u" or forest is not None)
    return img[PAD : PAD + T, PAD : PAD + T].copy()


def paint(P, X, Y, crowns: list[dict], seed: int, forest=None, shadows=False, fruit=None) -> np.ndarray:
    """Draw crowns (and their trunks) over a window of world pixel centres X, Y. `forest`: a mask of the wood's
    floor; `shadows`: cast the crowns' shadows; `fruit`: (colour, highlight, count) dots on every crown."""
    S0, S1 = X.shape
    x0, y0 = int(X[0, 0] - 0.5), int(Y[0, 0] - 0.5)
    ys, xs = np.mgrid[0:S0, 0:S1]
    ink = P.outline
    glint, hi, mid, dark, deep = (P.name(n) for n in ("new leaf", "grass", "leaf mid", "leaf dark", "teal shade"))
    wood, bark, earth = P.name("wood"), P.name("soil"), P.name("earth dark")
    white, grey = P.name("ice white"), P.name("stone lt")
    leaf = vnoise(X, Y, 2.2, seed + 3)
    wob = (vnoise(X, Y, 3.0, seed + 5) - 0.5) * 1.6
    img = np.full((S0, S1), -1, dtype=np.int32)
    sil = np.zeros((S0, S1), dtype=bool)
    if forest is not None:
        floor = np.where(vnoise(X, Y, 4.0, seed + 9) > 0.62, dark, deep)
        img[forest] = floor[forest]
        sil |= forest
        fp = np.pad(forest, 1, mode="edge")
        rim = forest & ~(fp[:-2, 1:-1] & fp[2:, 1:-1] & fp[1:-1, :-2] & fp[1:-1, 2:])
        img[rim] = ink  # the wood's ground line; crowns and trunks drawn below cover most of it
    if shadows:  # cast shadows first, down-right, dithered teal
        sh = np.zeros((S0, S1), dtype=bool)
        for c in crowns:
            m, _, _ = shape(c, X - 3, Y - 4, wob)
            sh |= m
            ex, ey = (X - c["cx"] - 1) / (c["r"] * 0.7), (Y - c["base"] + 1) / 3.0
            sh |= (ex * ex + ey * ey) <= 1.0
        img[sh & ((xs + ys) % 2 == 0)] = deep
    for c in crowns:  # trunks behind their own crowns
        if not (c["draw"] and c["trunk"]):
            continue
        tx = int(round(c["cx"]))
        top = int(c["cy"] + c["r"] * 0.35)
        wide = 0 if c.get("tiny") else 1 if c["small"] else 3 if c.get("gnarled") else 2
        birch = c["kind"] == "b"
        for yy in range(top, c["base"] + 1):
            j = yy - y0
            if not 0 <= j < S0:
                continue
            flare = (1 if yy >= c["base"] - 1 else 0) + (2 if c.get("gnarled") and yy >= c["base"] - 3 else 0)
            cols = list(range(tx - wide - flare, tx + wide + flare + 1))
            for k, xx in enumerate(cols):
                i = xx - x0
                if not 0 <= i < S1:
                    continue
                if k == 0 or k == len(cols) - 1 or yy == c["base"]:
                    col = ink
                elif birch:
                    col = ink if (yy * 7 + xx * 3) % 11 == 0 else (white if k <= len(cols) // 2 else grey)
                elif c.get("gnarled") and (xx * 5 + yy * 3) % 13 == 0:
                    col = earth  # knots and furrows in old bark
                else:
                    col = wood if k == 1 else earth if k >= len(cols) - 2 else bark
                img[j, i] = col
                sil[j, i] = True
    owner = np.full((S0, S1), -1, dtype=np.int32)
    for n, c in enumerate(crowns):
        if not c["draw"]:
            continue
        m, shade, seam = shape(c, X, Y, wob)
        if c["back"]:
            shade = np.minimum(shade + 1, 3)
        ramp = np.array([glint, hi, mid, dark]) if c["kind"] == "b" else np.array([hi, mid, dark, deep])
        if c.get("blossom"):  # cherry: rose blossom in the light
            ramp = np.array([P.name("rose"), hi, mid, dark])
        col = ramp[shade]
        col = np.where((leaf > 0.64) & (shade == 1), ramp[2], col)
        col = np.where((leaf < 0.24) & (shade == 2), ramp[1], col)
        if c["kind"] == "o":
            col = np.where((leaf > 0.82) & (shade == 0), glint, col)
        col = np.where(seam, ramp[min(3, 2 + (1 if c["back"] else 0))], col)
        # a dark rim where this crown overlaps one drawn before it (depth between trees)
        mp = np.pad(m, 1)
        edge = m & ~(mp[:-2, 1:-1] & mp[2:, 1:-1] & mp[1:-1, :-2] & mp[1:-1, 2:])
        col = np.where(edge & (owner >= 0), deep, col)
        img[m] = col[m]
        owner[m] = n
        sil |= m
    # ink outline around everything solid (crowns, trunks, the forest mass)
    out = np.zeros_like(sil)
    out[1:, :] |= sil[:-1, :] & ~sil[1:, :]
    out[:-1, :] |= sil[1:, :] & ~sil[:-1, :]
    out[:, 1:] |= sil[:, :-1] & ~sil[:, 1:]
    out[:, :-1] |= sil[:, 1:] & ~sil[:, :-1]
    img[out & ~sil] = ink
    if fruit:  # round fruit, 4 px with its own ink outline and a highlight, spread over the crown
        colour, light, count = fruit
        pat = (".KK.", "KLcK", "KccK", ".KK.")
        for c in crowns:
            r = c["r"]
            spots = [(-0.5, -0.3), (0.4, -0.45), (0.05, 0.05), (-0.15, -0.75), (0.6, 0.1), (-0.65, 0.3)]
            for fx, fy in spots[:count]:
                px_ = int(round(c["cx"] + fx * r)) - x0 - 2
                py_ = int(round(c["cy"] + fy * r)) - y0 - 2
                for j2, row in enumerate(pat):
                    for i2, ch in enumerate(row):
                        if ch != "." and 0 <= py_ + j2 < S0 and 0 <= px_ + i2 < S1:
                            img[py_ + j2, px_ + i2] = ink if ch == "K" else light if ch == "L" else colour
    return img
