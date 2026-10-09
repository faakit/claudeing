"""Authored map-layer tiles (round 2 maps pass): autotiled transitions, forest canopy, fences, ground variation,
flat flora, water decor and small village props, all drawn from palette slot names.

Autotiles use an 8-bit neighbour mask (a set bit = that neighbour is the *other* terrain):
    N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128
and are reduced to the 46 canonical non-zero masks of the classic blob set by `canon()` (a corner bit only
counts when both sides next to it are clear). scripts/map-art.mjs uses the same reduction.

Rules from the art critic (agents/critiques/art-critic/): terrain transitions use leaf-dark/teal shade lips,
never ink; ink outlines only on objects; shadows fall down-right (light top-left) as dithered teal/plum shade;
ground flora has no outline so it sits in the ground and never out-shouts crops, forage or interactables.
"""
from __future__ import annotations

import math

import numpy as np

T = 16
N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128


def canon(m: int) -> int:
    if m & (N | E):
        m &= ~NE
    if m & (S | E):
        m &= ~SE
    if m & (S | W):
        m &= ~SW
    if m & (N | W):
        m &= ~NW
    return m


BLOB = sorted({canon(m) for m in range(256)} - {0})
assert len(BLOB) == 46


def _h(*v: int) -> int:
    h = 2166136261
    for x in v:
        h = ((h ^ (x & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


def empty() -> np.ndarray:
    return np.full((T, T), -1, dtype=np.int32)


def profile(salt: int, lo: float, hi: float) -> np.ndarray:
    """A ragged 16-step edge profile whose ends meet (so neighbouring tiles join without a step)."""
    p = np.array([lo + (hi - lo) * ((_h(i // 2, salt) % 1000) / 999) for i in range(T)])
    p = (p + np.roll(p, 1) + np.roll(p, -1)) / 3
    mid = (lo + hi) / 2
    p[0] = p[T - 1] = mid
    p[1] = (p[1] + mid) / 2
    p[T - 2] = (p[T - 2] + mid) / 2
    return p


def depth_field(mask: int, salt: int, lo: float, hi: float, round_r: float) -> tuple[np.ndarray, np.ndarray]:
    """Per pixel: how far (px) inside the own terrain it is from the boundary with the other terrain, and which
    side is nearest (N/E/S/W bit, or the corner bit). Edges are ragged by `profile`; convex corners (two other
    sides) are rounded with radius `round_r`; lone diagonal neighbours bite a quarter circle."""
    D = np.full((T, T), 99.0)
    side = np.zeros((T, T), dtype=np.int32)
    prof = {b: profile(salt + b * 13, lo, hi) for b in (N, E, S, W)}
    for y in range(T):
        for x in range(T):
            cx, cy = x + 0.5, y + 0.5
            cands = []
            if mask & N:
                cands.append((cy - prof[N][x], N))
            if mask & S:
                cands.append((T - cy - prof[S][x], S))
            if mask & W:
                cands.append((cx - prof[W][y], W))
            if mask & E:
                cands.append((T - cx - prof[E][y], E))
            mid = (lo + hi) / 2
            for bit, (px_, py_) in ((NE, (T, 0)), (SE, (T, T)), (SW, (0, T)), (NW, (0, 0))):
                if mask & bit:
                    cands.append((math.hypot(cx - px_, cy - py_) - mid - 1.0, bit))
            for a, b, (qx, qy) in ((N, E, (T - round_r, round_r)), (S, E, (T - round_r, T - round_r)),
                                   (S, W, (round_r, T - round_r)), (N, W, (round_r, round_r))):
                if mask & a and mask & b:
                    inx = cx > qx if qx > T / 2 else cx < qx
                    iny = cy > qy if qy > T / 2 else cy < qy
                    if inx and iny:
                        cands.append((round_r - math.hypot(cx - qx, cy - qy) - mid + 0.5, a))
            if cands:
                d, s = min(cands)
                D[y, x], side[y, x] = d, s
    return D, side


# ---------------------------------------------------------------- base terrain textures


def speckle(t, c, n, seed, shape=((0, 0),)):
    r = np.random.default_rng(seed)
    for _ in range(n):
        x, y = r.integers(0, T, 2)
        for dx, dy in shape:
            t[(y + dy) % T, (x + dx) % T] = c


def grass_base(P, seed=1) -> np.ndarray:
    t = np.full((T, T), P.name("grass"), dtype=np.int32)
    speckle(t, P.name("leaf mid"), 9, seed, ((0, 0), (1, -1)))
    speckle(t, P.name("leaf mid"), 5, seed + 1, ((0, 0), (0, -1)))
    speckle(t, P.name("new leaf"), 4, seed + 2, ((0, 0),))
    return t


def path_base(P, seed=3) -> np.ndarray:
    t = np.full((T, T), P.name("sand"), dtype=np.int32)
    speckle(t, P.name("wood"), 6, seed, ((0, 0), (1, 0)))
    speckle(t, P.name("parchment"), 6, seed + 1)
    speckle(t, P.name("wood"), 3, seed + 2)
    return t


def dirt_base(P, seed=2) -> np.ndarray:
    t = np.full((T, T), P.name("wood"), dtype=np.int32)
    speckle(t, P.name("soil"), 12, seed, ((0, 0), (1, 0)))
    speckle(t, P.name("sand"), 5, seed + 1)
    return t


def stone_base(P, seed=6) -> np.ndarray:
    t = np.full((T, T), P.name("stone"), dtype=np.int32)
    speckle(t, P.name("taupe"), 8, seed, ((0, 0), (1, 0)))
    speckle(t, P.name("stone dark"), 5, seed + 3)
    speckle(t, P.name("stone lt"), 5, seed + 1)
    return t


def mine_floor(P, seed: int, mood: str) -> np.ndarray:
    """Cavern floor: calm stone, an earthy variant (taupe grit) and a worn one, for clustered patches."""
    t = np.full((T, T), P.name("stone"), dtype=np.int32)
    r = np.random.default_rng(seed)
    n_grit = {"calm": 3, "earth": 9, "worn": 4, "dark": 2}[mood]
    if mood == "dark":  # a pocket away from the torches: half the floor in stone dark, dithered
        for y in range(T):
            for x in range(T):
                if (x + y) % 2 == 0:
                    t[y, x] = P.name("stone dark")
    for _ in range(n_grit):
        x, y = int(r.integers(0, T)), int(r.integers(0, T))
        t[y, x] = P.name("taupe")
        if mood == "earth":
            t[y, (x + 1) % T] = P.name("taupe")
    for _ in range(2):
        x, y = int(r.integers(0, T)), int(r.integers(0, T))
        t[y, x] = P.name("stone lt")
        t[(y + 1) % T, x] = P.name("stone dark")
    if mood == "worn":
        x, y = int(r.integers(2, 12)), int(r.integers(2, 12))
        for k in range(5):
            t[(y + k // 2) % T, (x + k) % T] = P.name("stone dark")
    return t


def rubble(P, seed: int) -> np.ndarray:
    """Loose stones on the cavern floor: a few chips lit top-left with a dark underside."""
    t = empty()
    r = np.random.default_rng(seed)
    for _ in range(int(r.integers(2, 4))):
        x, y = int(r.integers(3, 12)), int(r.integers(3, 12))
        w = int(r.integers(2, 4))
        t[y, x : x + w] = P.name("stone lt")
        t[y + 1, x : x + w] = P.name("stone")
        t[y + 2, x : x + w] = P.name("stone dark")
    return t


def path_worn(P, seed: int, ruts: bool) -> np.ndarray:
    """A well-walked stretch of path: soft dithered wear (and on the road, two faint cart ruts)."""
    t = path_base(P, seed)
    r = np.random.default_rng(seed)
    for _ in range(3):
        cx, cy = int(r.integers(0, T)), int(r.integers(0, T))
        for y in range(T):
            for x in range(T):
                if (x - cx) ** 2 + ((y - cy) * 1.6) ** 2 < 14 and x % 2 == 0 and y % 2 == 0:
                    t[y, x] = P.name("wood")
    if ruts:
        for x in (4, 11):
            for y in range(0, T, 2):
                t[y, x] = P.name("wood")
    return t


def puddle(P, seed: int) -> np.ndarray:
    """A shallow puddle on a path: a dark rim, water with one sky glint."""
    t = empty()
    cx, cy, rx, ry = 8, 9, 5.5 + seed % 2, 3.0
    for y in range(T):
        for x in range(T):
            v = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if v <= 1:
                t[y, x] = P.name("water") if v < 0.7 else P.name("dusk blue")
    t[int(cy) - 1, int(cx) - 2 : int(cx) + 1] = P.name("sky")
    return t


def rail(P, kind: str) -> np.ndarray:
    """Mine-cart track: wooden sleepers under two steel rails (h, v, or a corner joining two sides: ne nw se sw)."""
    t = empty()
    wood, dark, steel, lit = P.name("wood"), P.name("soil"), P.name("stone"), P.name("stone lt")
    if kind == "h":
        for x in range(1, T, 5):
            t[3:13, x : x + 3] = wood
            t[12, x : x + 3] = dark
        t[5, :] = lit
        t[6, :] = steel
        t[10, :] = lit
        t[11, :] = steel
    elif kind == "v":
        for y in range(1, T, 5):
            t[y : y + 3, 3:13] = wood
            t[y + 2, 3:13] = dark
        t[:, 5] = lit
        t[:, 6] = steel
        t[:, 10] = lit
        t[:, 11] = steel
    else:  # quarter circle between two sides
        cx = T if "e" in kind else 0
        cy = 0 if "n" in kind else T
        for y in range(T):
            for x in range(T):
                d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
                if 3 <= d <= 13 and (int(d * 2) + x + y) % 5 < 3 and t[y, x] < 0:
                    t[y, x] = wood
                if 5 <= d < 6 or 10 <= d < 11:
                    t[y, x] = lit
                elif 6 <= d < 7 or 11 <= d < 12:
                    t[y, x] = steel
    return t


def water_base(P, seed=4, ripples=2) -> np.ndarray:
    """Calm water: a couple of short glints with a dark underline, placed by seed so variants never line up."""
    t = np.full((T, T), P.name("water"), dtype=np.int32)
    lite, dark = P.name("sky"), P.name("dusk blue")
    r = np.random.default_rng(seed)
    for _ in range(ripples):
        x, y = int(r.integers(0, T)), int(r.integers(0, T))
        n = int(r.integers(2, 4))
        for i in range(n):
            t[y % T, (x + i) % T] = lite
        for i in range(1, n + 1):
            t[(y + 1) % T, (x + i) % T] = dark
    return t


def pebbles(P, seed: int) -> np.ndarray:
    """Three or four small stones pressed into a path (lit top-left, shade bottom-right, no outline)."""
    t = empty()
    r = np.random.default_rng(seed)
    for _ in range(int(r.integers(3, 5))):
        x, y = int(r.integers(2, 13)), int(r.integers(2, 13))
        t[y, x] = P.name("stone lt")
        t[y, x + 1] = P.name("stone")
        t[y + 1, x] = P.name("stone")
        t[y + 1, x + 1] = P.name("taupe")
    return t


# ---------------------------------------------------------------- transitions


def creep(P, mask: int, grass: np.ndarray, ground_shadow: str, salt: int) -> np.ndarray:
    """Grass creeping onto a path/dirt tile from the masked sides: tufts 1-3 px with a leaf-dark lip (never
    ink), and a dithered shadow on the ground where the grass is north or west of it (light from top-left)."""
    t = empty()
    D, side = depth_field(mask, salt, 1.0, 3.2, 5.0)
    lip, rim2 = P.name("leaf dark"), P.name("leaf mid")
    sh = P.name(ground_shadow)
    for y in range(T):
        for x in range(T):
            d = D[y, x]
            if d < 0:
                t[y, x] = grass[y, x]
                if d > -1:
                    t[y, x] = lip if (x + y) % 2 == 0 else rim2
            elif d < 1 and side[y, x] in (N, W, NW, NE, SW) and (x + y) % 2 == 0:
                t[y, x] = sh
    return t


def shore(P, mask: int, grass: np.ndarray, salt: int) -> np.ndarray:
    """Water tile edge: grass bank (with an earth bank face where land is north), a dark wet rim, a broken
    1 px foam line and a dithered deeper band. Convex corners are rounded so ponds never read as rectangles."""
    t = empty()
    D, side = depth_field(mask, salt, 0.6, 1.8, 6.0)
    soil, earth, foam = P.name("soil"), P.name("earth dark"), P.name("ice white")
    deep, lip = P.name("dusk blue"), P.name("leaf dark")
    for y in range(T):
        for x in range(T):
            d, s = D[y, x], side[y, x]
            north = s in (N, NE, NW)
            bank = 2.0 if north else 0.0
            if d < -bank:
                t[y, x] = grass[y, x]
                if d > -bank - 1:
                    t[y, x] = lip if (x % 2 == 0 or not north) else grass[y, x]
            elif d < 0:  # the bank face, seen where land is north of the water
                t[y, x] = soil if d < -1 else earth
            elif d < 1:
                t[y, x] = earth if north else P.name("teal shade")
            elif d < 2:
                if (x * 7 + y * 3 + _h(x // 3, y // 3, salt)) % 5 != 0:
                    t[y, x] = foam
            elif d < 3.5 and (x + y) % 2 == 0:
                t[y, x] = deep
    return t


# ---------------------------------------------------------------- forest canopy


def canopy_texture(P, seed: int) -> np.ndarray:
    """Seamless leaf mass seen from above: round clumps lit top-left, teal shade in the gaps."""
    base, mid, hi, glint, gap = (P.name(n) for n in ("leaf dark", "leaf mid", "grass", "new leaf", "teal shade"))
    t = np.full((T, T), gap, dtype=np.int32)
    r = np.random.default_rng(seed)
    pts = [(int(r.integers(0, T)), int(r.integers(0, T))) for _ in range(9)]
    for cx, cy in pts:
        rad = 3.2 + r.random() * 1.6
        for dy in range(-6, 7):
            for dx in range(-6, 7):
                dd = math.hypot(dx, dy)
                if dd <= rad:
                    x, y = (cx + dx) % T, (cy + dy) % T
                    lit = (-dx - dy) / max(rad, 1)
                    t[y, x] = hi if lit > 0.9 and dd > rad * 0.35 else mid if lit > 0.1 else base
        t[(cy - 1) % T, (cx - 1) % T] = glint
    return t


def canopy(P, mask: int, tex: np.ndarray, salt: int) -> np.ndarray:
    """A forest-mass tile (tree tiles joined into a wood). Edges scallop into round clumps with an ink rim;
    where the open side is south, the canopy lifts to show trunks over a dark under-canopy band."""
    t = tex.copy()
    m4 = mask & (N | E | S | W)
    south_open = bool(mask & S)
    D, side = depth_field(mask & ~S if south_open else mask, salt, 0.0, 2.5, 6.0)
    ink = P.outline
    for y in range(T):
        for x in range(T):
            bump = 1.4 * abs(math.sin((x if side[y, x] in (N, S) else y) * math.pi / 5 + salt))
            d = D[y, x] - bump
            if d < 0:
                t[y, x] = -1
            elif d < 1:
                t[y, x] = ink
    if south_open:
        edge = 9
        for x in range(T):
            e = edge + int(round(1.5 * abs(math.sin(x * math.pi / 5 + salt))))
            for y in range(e, T):
                if t[y, x] != -1 or not (m4 & (E | W)):
                    t[y, x] = -1
            t[min(e, T - 1), x] = ink if t[e - 1, x] != -1 else -1
        # trunks under the canopy lip: two per tile, staggered by the salt
        wood, bark, dark, shadow = P.name("wood"), P.name("soil"), P.name("earth dark"), P.name("teal shade")
        for tx in ((3, 10) if salt % 2 == 0 else (5, 12)):
            if (mask & W and tx < 4) or (mask & E and tx > 11):
                continue
            for y in range(edge, T - 1):
                if t[y, tx] != -1 and y < edge + 2:
                    continue
                t[y, tx - 1] = ink
                t[y, tx] = wood
                t[y, tx + 1] = bark
                t[y, tx + 2] = dark
                t[y, tx + 3] = ink
            t[T - 1, tx - 2: tx + 4] = ink
            t[T - 2, tx - 2] = ink
            t[T - 2, tx + 3] = ink
        for x in range(T):  # under-canopy shade on the trunks
            for y in range(edge, edge + 3):
                if t[y, x] in (wood, bark) and (x + y) % 2 == 0:
                    t[y, x] = shadow
    return t


def canopy_overhang(P, tex: np.ndarray, salt: int) -> np.ndarray:
    """Leaves spilling from a wood into the open tile north of it (drawn overhead: you walk behind them)."""
    t = empty()
    ink = P.outline
    for x in range(T):
        top = 11 - int(round(2.2 * abs(math.sin(x * math.pi / 6 + salt))))
        for y in range(top, T):
            t[y, x] = tex[y, x]
        t[top, x] = ink
        if x > 0 and t[top - 1, x - 1] == -1 and top < 11:
            pass
    for x in range(1, T):  # close vertical steps in the rim
        a = int(np.argmax(t[:, x] >= 0))
        b = int(np.argmax(t[:, x - 1] >= 0))
        for y in range(min(a, b), max(a, b)):
            col = x if a < b else x - 1
            if t[y, col] != ink:
                t[y, col] = ink
    return t


def canopy_shadow(P, kind: str) -> np.ndarray:
    """Dappled shade cast down-right by a wood: on the tile south (kind n) or east (kind w) of it."""
    t = empty()
    c = P.name("teal shade")
    for y in range(T):
        for x in range(T):
            d = y if kind == "n" else x
            if d < 2 and (x + y) % 2 == 0:
                t[y, x] = c
            elif d < 5 and (x * 3 + y * 5) % 7 == 0:
                t[y, x] = c
    return t


# ---------------------------------------------------------------- fences, walls, cobbles


def fence(P, mask4: int) -> np.ndarray:
    """Fence by its fence neighbours (4-bit, a set bit = a fence there). Rails run E-W; a N-S run is a line
    of posts with a side rail. Transparent: the ground under it comes from the detail layer."""
    t = empty()
    rail, rail_d, post, post_d, ink = (P.name(n) for n in ("sand", "wood", "wood", "soil", "ink"))
    horiz = bool(mask4 & (E | W)) or not (mask4 & (N | S))
    if horiz:
        x0 = 0 if mask4 & W else 6
        x1 = T if mask4 & E else 10
        for y in (5, 10):
            t[y - 1, x0:x1] = ink
            t[y, x0:x1] = rail
            t[y + 1, x0:x1] = rail_d
            t[y + 2, x0:x1] = ink
    if mask4 & (N | S):
        y0 = 0 if mask4 & N else 4
        y1 = T if mask4 & S else 13
        t[y0:y1, 6] = ink
        t[y0:y1, 7] = rail
        t[y0:y1, 8] = rail_d
        t[y0:y1, 9] = ink
    posts = (2, 12) if horiz and not (mask4 & (N | S)) else (6,)
    for x in posts:
        t[1:15, x - 1] = ink
        t[2:14, x: x + 2] = post
        t[2:14, x + 1] = post_d
        t[1:15, x + 2] = ink
        t[1, x - 1: x + 3] = ink
        t[2, x: x + 2] = rail
        t[14, x - 1: x + 3] = ink
    return t


def cobble(P, mask4: int, salt: int) -> np.ndarray:
    """Town square pavers: rounded setts in a running bond, with a kerb on sides that are not square."""
    base, hi, lo, joint = P.name("sand"), P.name("parchment"), P.name("wood"), P.name("taupe")
    t = np.full((T, T), joint, dtype=np.int32)
    for r0 in range(0, T, 4):
        off = 2 if (r0 // 4) % 2 else 0
        for c0 in range(-4 + off, T, 4):
            for y in range(r0, r0 + 3):
                for x in range(c0, c0 + 3):
                    if 0 <= x < T:
                        t[y, x] = base
            if 0 <= c0 < T:
                t[r0, c0] = hi
            if 0 <= c0 + 2 < T:
                t[r0 + 2, c0 + 2] = lo
    kerb = P.name("taupe")
    if mask4 & N:
        t[0, :] = kerb
    if mask4 & S:
        t[T - 1, :] = kerb
    if mask4 & W:
        t[:, 0] = kerb
    if mask4 & E:
        t[:, T - 1] = kerb
    return t


def wall_face(P) -> np.ndarray:
    """Interior wall seen from the room: rose-sprig wallpaper over a wood wainscot and baseboard."""
    paper, sprig, leaf = P.name("sand"), P.name("rose"), P.name("leaf mid")
    t = np.full((T, T), paper, dtype=np.int32)
    for y in range(1, 9, 4):
        for x in range((y // 4) % 2 * 4 + 1, T, 8):
            t[y, x] = sprig
            t[y + 1, x] = leaf
    t[0, :] = P.name("wood")
    t[9, :] = P.name("parchment")
    t[10:15, :] = P.name("wood")
    for x in range(0, T, 4):
        t[10:15, x] = P.name("soil")
    t[15, :] = P.name("earth dark")
    return t


def wall_top(P, mask4: int) -> np.ndarray:
    """Top of an interior wall (seen from above): dark beam with a lit inner rim toward the room."""
    t = np.full((T, T), P.name("earth dark"), dtype=np.int32)
    for y in range(2, T, 5):
        t[y, :] = P.name("plum shadow")
    if mask4 & S:
        t[T - 2, :] = P.name("wood")
        t[T - 1, :] = P.name("ink")
    if mask4 & N:
        t[0, :] = P.name("soil")
    if mask4 & E:
        t[:, T - 1] = P.name("soil")
    if mask4 & W:
        t[:, 0] = P.name("soil")
    return t


# ---------------------------------------------------------------- ground variation and flora (no outline)


def grass_patch(P, density: int, seed: int) -> np.ndarray:
    """Low-contrast grass blades (leaf mid, new-leaf tips), drawn in clustered patches by the map noise."""
    t = empty()
    r = np.random.default_rng(seed)
    for _ in range(density):
        x, y = int(r.integers(1, T - 1)), int(r.integers(2, T))
        tall = int(r.integers(1, 3))
        for k in range(tall + 1):
            t[y - k, x] = P.name("leaf mid")
        if r.random() < 0.5:
            t[y - tall - 1, x] = P.name("new leaf")
    return t


def bloom(P, kind: str, seed: int) -> np.ndarray:
    """Tiny flowers sitting in the grass: rose-pink wildflowers (the valley's signature), daisies, buttercups."""
    t = empty()
    r = np.random.default_rng(seed)
    petal = {"rose": "rose", "daisy": "parchment", "butter": "gold", "lilac": "lilac"}[kind]
    eye = {"rose": "gold", "daisy": "gold", "butter": "orange", "lilac": "parchment"}[kind]
    n = {"rose": 4, "daisy": 4, "butter": 5, "lilac": 3}[kind]
    spots = []
    for _ in range(40):
        if len(spots) >= n:
            break
        x, y = int(r.integers(2, T - 2)), int(r.integers(2, T - 3))
        if all(abs(x - a) + abs(y - b) > 3 for a, b in spots):
            spots.append((x, y))
    for x, y in spots:
        t[y + 1, x] = P.name("leaf dark")
        t[y + 2, x] = P.name("leaf dark")
        if kind == "rose":
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                t[y + dy, x + dx] = P.name(petal)
            t[y, x] = P.name(eye)
            t[y + 1, x + 1] = P.name("wine")
        elif kind == "butter":
            t[y, x] = P.name(petal)
            t[y, x + 1] = P.name(petal)
            t[y - 1, x] = P.name(eye)
        else:
            t[y, x - 1] = t[y, x + 1] = P.name(petal)
            t[y - 1, x] = P.name(petal)
            t[y, x] = P.name(eye)
    return t


def strip_outline(P, spr: np.ndarray, to: str = "leaf dark") -> np.ndarray:
    out = spr.copy()
    out[out == P.outline] = P.name(to)
    return out


def ground_shadow(P, kind: str, ground: str) -> np.ndarray:
    """Dithered drop shadow (light top-left): kind n = cast from the tile north, e = from the tile west."""
    c = {"grass": "teal shade", "path": "wood", "stone": "stone dark", "floor": "soil", "dirt": "soil"}[ground]
    t = empty()
    for y in range(T):
        for x in range(T):
            d = y if kind == "n" else x
            if d == 0 or (d == 1 and (x + y) % 2 == 0) or (d in (2, 3) and (x + 2 * y) % 4 == 0):
                t[y, x] = P.name(c)
    return t


def cracks(P, seed: int) -> np.ndarray:
    t = empty()
    r = np.random.default_rng(seed)
    x, y = int(r.integers(3, 12)), int(r.integers(3, 12))
    for _ in range(9):
        t[y, x] = P.name("stone dark")
        if r.random() < 0.4:
            t[y, min(T - 1, x + 1)] = P.name("stone lt")
        dx, dy = [(1, 0), (0, 1), (1, 1), (-1, 1)][int(r.integers(0, 4))]
        x, y = max(1, min(T - 2, x + dx)), max(1, min(T - 2, y + dy))
    return t


# ---------------------------------------------------------------- water decor


def lily(P, seed: int) -> np.ndarray:
    t = empty()
    r = np.random.default_rng(seed)
    pads = [(4, 5), (11, 10)] if seed % 2 else [(9, 4), (5, 11), (12, 12)]
    pad, pad_d = P.name("leaf mid"), P.name("leaf dark")
    for k, (cx, cy) in enumerate(pads):
        rad = 2.6 if k == 0 else 2.0
        for y in range(T):
            for x in range(T):
                d = math.hypot(x - cx, (y - cy) * 1.3)
                if d <= rad:
                    t[y, x] = pad
                    if y > cy:
                        t[y, x] = pad_d
        t[cy, cx: cx + 3] = -1  # the notch of a lily pad
        if k == 0:
            t[cy - 1, cx] = P.name("rose")
            t[cy - 2, cx] = P.name("rose")
            t[cy - 1, cx - 1] = P.name("parchment")
            t[cy - 1, cx + 1] = P.name("rose")
    _ = r
    return t


def reeds(P, seed: int, side: str = "n") -> np.ndarray:
    """A reed and cattail clump at the water's edge (outlined: it is an object sticking out of the water)."""
    t = empty()
    r = np.random.default_rng(seed)
    base_y = 8 if side == "n" else 14
    xs = sorted({int(x) for x in r.integers(2, 14, 6)})
    for x in xs:
        h = int(r.integers(5, 9))
        for y in range(base_y - h, base_y + 1):
            t[y, x] = P.name("leaf mid") if y > base_y - h + 1 else P.name("new leaf")
        if r.random() < 0.5:
            t[base_y - h - 2: base_y - h, x] = P.name("soil")  # a cattail head
    for x in range(T):
        if t[base_y, x] >= 0:
            t[base_y + 1, x] = P.name("teal shade")
    return t


def stepping_stone(P) -> np.ndarray:
    t = empty()
    for cx, cy, rx, ry in ((5, 6, 3.4, 2.4), (11, 11, 3.0, 2.2)):
        for y in range(T):
            for x in range(T):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    t[y, x] = P.name("stone lt") if y < cy else P.name("stone")
    return t


# ---------------------------------------------------------------- small village props (outlined objects)


def outline(P, t: np.ndarray) -> np.ndarray:
    """Add a 1 px ink outline around the opaque shape (outside it, within the tile)."""
    out = t.copy()
    m = t >= 0
    for y in range(T):
        for x in range(T):
            if m[y, x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < T and 0 <= yy < T and m[yy, xx]:
                    out[y, x] = P.outline
                    break
    return out


def draw(P, rows: list[str], key: dict[str, str], anchor_bottom: bool = True) -> np.ndarray:
    """Paint a small sprite from a character grid ('.' clear), placed bottom-centre in a 16x16 tile."""
    h, w = len(rows), max(len(r) for r in rows)
    rows = [r.ljust(w, ".") for r in rows]
    t = empty()
    y0 = T - h if anchor_bottom else (T - h) // 2
    x0 = (T - w) // 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                t[y0 + y, x0 + x] = P.outline if ch == "o" else P.name(key[ch])
    return t


PROPS = {
    "p_anvil": (
        {"s": "stone lt", "m": "stone", "d": "stone dark", "w": "wood", "b": "soil"},
        [
            "..............",
            "oooooooooooo..",
            "osssssssssmooo",
            "ommmmmmmmmmmmo",
            ".oooddddddooo.",
            "....odddo.....",
            "...oowwwwoo...",
            "..owwwwwwwbo..",
            "..owwwbwwwbo..",
            "..obbbbbbbbo..",
            "...oooooooo...",
        ],
    ),
    "p_coal": (
        {"k": "stone dark", "m": "plum shadow", "h": "stone", "s": "wood", "o2": "orange"},
        [
            "......oo......",
            ".....ohko.....",
            "...ookkmkoo...",
            "..ohkkmkkhko..",
            ".okkmkhkkmkko.",
            ".ommmmmmmmmmo.",
            "..oooooooooo..",
        ],
    ),
    "p_netrack": (
        {"w": "wood", "b": "soil", "n": "parchment", "k": "sand", "f": "water"},
        [
            "oo..........oo",
            "owoooooooooowo",
            "owwwwwwwwwwwwo",
            "obonknknknkobo",
            "owknknknknknwo",
            "obnknknknknkbo",
            "owknkffknknkwo",
            "obonknknknkobo",
            "owo.oooooo.owo",
            "obo........obo",
            "owo........owo",
            "ooo........ooo",
        ],
    ),
    "p_bucket": (
        {"w": "wood", "b": "soil", "s": "stone lt", "f": "water"},
        [
            "..oooooo..",
            ".o......o.",
            "osooooooso",
            "offfffffffo"[:10],
            "owwbwwwbwo",
            "osssssssso",
            "owwbwwwbwo",
            ".owwwwwwo.",
            "..oooooo..",
        ],
    ),
    "p_firewood": (
        {"w": "wood", "b": "soil", "r": "sand", "d": "earth dark"},
        [
            "..oooooooooo..",
            ".orbrorbrorbo.",
            ".obrborbrborbo"[:14],
            "orbrorbrorbro.",
            "obrborbrborbo.",
            ".oooooooooooo.",
            ".odwwwwwwwwdo.",
            ".oooooooooooo.",
        ],
    ),
    "p_toolrack": (
        {"w": "wood", "b": "soil", "s": "stone lt", "m": "stone"},
        [
            "..o.....o.....",
            ".oso...omo....",
            ".osso..omo....",
            "..owo..owo..o.",
            "..owo..owo.oso",
            "oooooooooooooo",
            "obbbbbbbbbbbbo",
            "oooowooowooooo",
            "...owo.owo..o.",
            "...owo.owo.owo",
            "...owo.owo.owo",
            "...ooo.ooo.ooo",
        ],
    ),
    "p_fishcrate": (
        {"w": "wood", "b": "soil", "f": "sky", "g": "stone lt", "r": "rose"},
        [
            ".oooooooooooo.",
            "ofgfrfgffgfrfo",
            "owwwwwwwwwwwwo",
            "owbwwwwwwwwbwo",
            "owwwwwwwwwwwwo",
            "owbwwwwwwwwbwo",
            "oooooooooooooo",
        ],
    ),
    "p_flowerbed": (
        {"r": "rose", "y": "gold", "g": "leaf mid", "d": "leaf dark", "w": "wood", "b": "soil", "p": "parchment"},
        [
            ".r.p..r..y.r..",
            "rgr.prpgryrgr.",
            ".gdg.g.dgd.g..",
            "oooooooooooooo",
            "owwwwwwwwwwwwo",
            "obbbbbbbbbbbbo",
            "oooooooooooooo",
        ],
    ),
}

FACADE = {
    # decor painted over a solid wall tile of a building's facade row
    "f_door": (
        {"w": "wood", "b": "soil", "d": "earth dark", "g": "gold", "s": "sand"},
        [
            "..oooooooooo..",
            ".odwwwwwwwwdo.",
            ".owbwwbbwwbwo.",
            ".owbwwbbwwbwo.",
            ".owbwwbbwwbwo.",
            ".owbwwbbwgbwo.",
            ".owbwwbbwwbwo.",
            ".owbwwbbwwbwo.",
            ".owbwwbbwwbwo.",
            ".owwwwwwwwwwo.",
            ".oooooooooooo.",
            "osssssssssssso",
        ],
    ),
    "f_forge": (
        {"s": "stone lt", "m": "stone", "d": "stone dark", "f": "orange", "y": "gold", "l": "lamp", "r": "red"},
        [
            "...oooooooo...",
            "..osmsmsmsmo..",
            ".osmooooooomo.",
            ".omodrrrrrdso.",
            ".osorffffroso.",
            ".omorfyyfromo.",
            ".osorfylyfoso.",
            ".omorfyyyfomo.",
            ".osoooooooomo.",
            ".omsmsmsmsmso.",
            ".oooooooooooo.",
        ],
    ),
    "f_lantern": (
        {"b": "earth dark", "y": "gold", "l": "lamp", "w": "wood"},
        [
            "ooo...",
            "owwo..",
            "ooobo.",
            "..obo.",
            ".ooooo",
            ".oylyo",
            ".oyyyo",
            ".ooooo",
        ],
    ),
    "f_sign_shop": (
        {"w": "wood", "b": "soil", "s": "sand", "g": "leaf mid", "d": "leaf dark"},
        [
            "oooooooooooooo",
            "osssssgsssssso",
            "oswwwgdgwwwwso",
            "oswwbwgwbwwwso",
            "osssssgsssssso",
            "oooooooooooooo",
        ],
    ),
}


def chimney(P) -> tuple[np.ndarray, np.ndarray]:
    """Brick chimney: the base sits on the roof (roof layer), the top rises over the ridge (overhead)."""
    brick, mortar, hi, ink, soot = P.name("red"), P.name("wine"), P.name("orange"), P.outline, P.name("ink")
    img = np.full((24, 8), brick, dtype=np.int32)
    for y in range(24):
        if y % 3 == 2:
            img[y, :] = mortar
        elif (y // 3) % 2 == 0:
            img[y, 3] = mortar
        else:
            img[y, 6] = mortar
    img[0:2, :] = P.name("stone lt")
    img[2, :] = P.name("stone dark")
    img[0, 2:6] = soot
    img[:, 0] = ink
    img[:, 7] = ink
    img[0, :] = ink
    img[23, :] = ink
    for y in range(3, 23):
        if y % 3 == 0:
            img[y, 1] = hi  # a glint on each course, not a stripe
    img[3:23, 6] = np.where(img[3:23, 6] == brick, mortar, img[3:23, 6])  # the shaded side
    full = empty32()
    full[8:32, 4:12] = img
    return full[:T], full[T:]


def empty32() -> np.ndarray:
    return np.full((32, T), -1, dtype=np.int32)


def cave_mouth(P, side: str) -> np.ndarray:
    """The dark mine mouth on the woods' north edge (drawn on the path tiles you walk into, left/right half)."""
    t = np.full((T, T), P.name("ink"), dtype=np.int32)
    rock, lit, dark = P.name("stone"), P.name("stone lt"), P.name("stone dark")
    for y in range(T):
        for x in range(T):
            gx = x if side == "l" else x + T  # 0..31 across both tiles
            arch = 4 + 12 * ((gx - 16) / 13) ** 2 if 3 <= gx <= 28 else 0
            if gx < 3 or gx > 28 or y < arch:
                t[y, x] = rock if (x * 3 + y * 5) % 7 else dark
                if 0 < y and y < arch and y >= arch - 1:
                    t[y, x] = lit
            elif y < arch + 2 and (x + y) % 2 == 0:
                t[y, x] = P.name("plum shadow")
    for x in range(T):
        if t[T - 1, x] == P.name("ink") and x % 3 == 0:
            t[T - 1, x] = P.name("plum shadow")
    return t


def mine_lintel(P, part: str) -> np.ndarray:
    """A timber lintel across the mine exit (overhead, so you walk under it)."""
    t = empty()
    wood, bark, ink = P.name("wood"), P.name("soil"), P.outline
    t[9, :] = ink
    t[10:13, :] = wood
    t[12, :] = bark
    t[13, :] = ink
    for x in range(2, T, 6):
        t[11, x] = P.name("earth dark")
    if part == "l":
        t[9:14, 0] = ink
    if part == "r":
        t[9:14, T - 1] = ink
    return t


def boat(P) -> tuple[np.ndarray, np.ndarray]:
    """A little moored rowboat seen from above (two tiles wide), sits on water tiles."""
    img = np.full((T, 32), -1, dtype=np.int32)
    wood, bark, sand, ink = P.name("wood"), P.name("soil"), P.name("sand"), P.outline
    for y in range(4, 13):
        for x in range(2, 30):
            nx = (x - 16) / 14
            ny = (y - 8.5) / 4.5
            if nx * nx * (1.6 if x > 16 else 1) + ny * ny <= 1:
                img[y, x] = wood
    inner = img.copy()
    for y in range(T):
        for x in range(32):
            if img[y, x] >= 0 and all(
                0 <= y + dy < T and 0 <= x + dx < 32 and img[y + dy, x + dx] >= 0 for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2))
            ):
                inner[y, x] = bark
    for x in (12, 20):
        inner[5:12, x] = sand
    out = inner.copy()
    for y in range(T):
        for x in range(32):
            if img[y, x] < 0 and any(
                0 <= y + dy < T and 0 <= x + dx < 32 and img[y + dy, x + dx] >= 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                out[y, x] = ink
    for x in range(4, 28):
        if out[13, x] == ink:
            out[14, x] = P.name("dusk blue")
    return out[:, :T], out[:, T:]


def big_oak(P, make) -> np.ndarray:
    """The woods' old crooked oak (48x64): a broad canopy over a twisted trunk; the trunk base sits on one
    solid tree tile, everything else is drawn overhead or as flat roots."""
    img = np.full((64, 48), -1, dtype=np.int32)
    base, mid, hi, glint, gap, ink = (P.name(n) for n in ("leaf dark", "leaf mid", "grass", "new leaf", "teal shade", "ink"))
    r = np.random.default_rng(77)
    blobs = [(24, 20, 15), (11, 26, 10), (37, 25, 10), (18, 10, 9), (31, 11, 9), (24, 31, 11)]
    for cx, cy, rad in blobs:
        for y in range(64):
            for x in range(48):
                d = math.hypot(x - cx, y - cy)
                if d <= rad:
                    img[y, x] = gap if img[y, x] < 0 else img[y, x]
    for _ in range(70):  # leaf clumps inside the silhouette
        cx, cy = int(r.integers(4, 44)), int(r.integers(2, 42))
        if img[cy, cx] < 0:
            continue
        rad = 2.5 + r.random() * 2.5
        for dy in range(-5, 6):
            for dx in range(-5, 6):
                x, y = cx + dx, cy + dy
                if 0 <= x < 48 and 0 <= y < 64 and img[y, x] >= 0 and math.hypot(dx, dy) <= rad:
                    lit = (-dx - dy) / rad
                    img[y, x] = hi if lit > 0.95 else mid if lit > 0.05 else base
        img[max(0, cy - 1), max(0, cx - 1)] = glint
    # trunk: twisted, leaning, roots splayed at the base (rows 40-63)
    wood, bark, dark = P.name("wood"), P.name("soil"), P.name("earth dark")
    for y in range(36, 61):
        lean = int(round(3 * math.sin((y - 36) / 9)))
        w = 4 + (2 if y > 54 else 0) + (y - 54 if y > 56 else 0)
        x0 = 22 + lean - w // 2
        for x in range(x0, x0 + w + 1):
            img[y, x] = wood if x < x0 + 2 else bark if x < x0 + w - 1 else dark
    for x0, dirn in ((17, -1), (29, 1)):
        for k in range(6):
            img[58 + k // 2, x0 + dirn * k] = bark
            img[59 + k // 2, x0 + dirn * k] = dark
    img[44, 25] = dark  # a knot hole
    img[45, 25] = P.name("ink")
    # ink outline around the whole silhouette
    out = img.copy()
    for y in range(64):
        for x in range(48):
            if img[y, x] < 0 and any(
                0 <= y + dy < 64 and 0 <= x + dx < 48 and img[y + dy, x + dx] >= 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                out[y, x] = ink
    # under-canopy shade on the trunk top
    for y in range(36, 40):
        for x in range(48):
            if out[y, x] in (wood, bark) and (x + y) % 2 == 0:
                out[y, x] = gap
    _ = make
    return out


def tiles_of(img: np.ndarray, name: str) -> dict[str, np.ndarray]:
    """Cut a multi-tile image into named 16x16 tiles `<name>_<col>_<row>` (empty tiles dropped)."""
    out = {}
    for j in range(img.shape[0] // T):
        for i in range(img.shape[1] // T):
            t = img[j * T:(j + 1) * T, i * T:(i + 1) * T]
            if (t >= 0).any():
                out[f"{name}_{i}_{j}"] = t.copy()
    return out


# ---------------------------------------------------------------- winter roofs and seasonal clumps


def snow_roof(P, roof_tile: np.ndarray, row: str, col: str, salt: int = 0) -> np.ndarray:
    """A clay (or slate) roof under snow, drawn as a mass (critic R4-4): flat ice white with one or two soft
    sky-blue lumps, the ridge a rounded mound with an ink outline (row e, overhead), and at the eave a rounded
    overhang lip over a strip of the roof's own tiles peeking out above the ink eave line."""
    snow, shade, ink = P.name("ice white"), P.name("sky"), P.outline
    if row == "e":
        t = empty()
        for x in range(T):
            top = 11
            if col == "l" and x < 2:
                top = 13 - x
            if col == "r" and x > T - 3:
                top = 13 - (T - 1 - x)
            t[top, x] = ink
            t[top + 1 : T, x] = snow
        t[T - 1, 3::5] = shade
        if col == "l":
            t[13:, 0] = ink
        if col == "r":
            t[13:, T - 1] = ink
        return t
    t = np.full((T, T), snow, dtype=np.int32)
    lumps = ((3 + salt % 4, 4, 4),) if row == "b" else ((2 + salt % 5, 5, 4), (9 - salt % 3, 11, 5))
    for x0, y0, w in lumps:
        t[y0, x0 : x0 + w] = shade  # the soft underside of a lump
    if row == "b":
        for x in range(T):
            lip = 8 + (1 if (x // 4) % 2 == 0 else 0)
            t[lip, x] = shade
            t[lip + 1 : 14, x] = roof_tile[lip + 1 : 14, x]
        t[14, :] = roof_tile[14, :]
        t[15, :] = ink
    if col == "l":
        t[:, 0] = ink
        t[:, 1] = np.where(t[:, 1] == snow, shade, t[:, 1])
    if col == "r":
        t[:, T - 1] = ink
        t[:, T - 2] = np.where(t[:, T - 2] == snow, shade, t[:, T - 2])
    return t


def icicles(P, base: np.ndarray) -> np.ndarray:
    """The eave shadow in winter: icicles hanging over the facade's top rows."""
    t = base.copy()
    for x, n in ((2, 3), (6, 2), (9, 4), (13, 2)):
        for y in range(n):
            t[y, x] = P.name("ice white") if y < n - 1 else P.name("sky")
    return t


def seasonal(P, season: str, k: int) -> np.ndarray:
    """Clumps that exist only in one season (empty in spring): dry grass with gold heads in summer, a scatter
    of fallen leaves in fall, a small drift in winter. Placed under and downwind of trees by the map generator."""
    t = empty()
    r = np.random.default_rng(1000 + k * 7 + len(season))
    if season == "summer":
        for _ in range(6 + k):
            x, y = int(r.integers(2, 14)), int(r.integers(8, 15))
            hgt = int(r.integers(3, 7))
            for j in range(hgt):
                t[y - j, x] = P.name("sand") if j < hgt - 1 else P.name("gold")
            t[y, x] = P.name("wood")
        if k == 0:  # a small sunflower
            t[2:9, 7] = P.name("leaf mid")
            t[2, 6:9] = P.name("gold")
            t[1, 7] = P.name("gold")
            t[3, 7] = P.name("orange")
            t[2, 7] = P.name("soil")
    elif season == "fall":
        cols = [P.name(c) for c in ("orange", "red", "gold", "wine", "orange")]
        for _ in range(9 + k * 2):
            x, y = int(r.integers(1, 14)), int(r.integers(3, 15))
            c = cols[int(r.integers(0, len(cols)))]
            t[y, x] = c
            t[y, x + 1] = c if r.random() < 0.6 else P.name("soil")
    elif season == "winter":
        cx = 4 + k * 3
        for x in range(cx - 4, cx + 5):
            if 0 <= x < T:
                hgt = 3 - abs(x - cx) // 2
                for j in range(max(hgt, 0)):
                    t[13 - j, x] = P.name("ice white")
                t[14, x] = P.name("sky")
    return t
