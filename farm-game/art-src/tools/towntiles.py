"""Town tiles for the Dry Year's M6 stages (art round dry-year-2), drawn in code over the palette.

  heron_t / heron_b                Finn's boat, the Heron, afloat (16 x 32 over two water tiles, bow up): a blue-painted
                                   hull with a white sheer strake, a mast with its sail furled on the boom, a 2 px
                                   dark waterline ring on the water, no translucent water over it.
  heron_aground_t / _b             the same boat on the dry river's mud: listing (its bow 2 px over), its keel sunk in a
                                   mud bank, a dry grey line where the water used to reach.
  f_window_boarded, f_window_hi_boarded, f_doortop_red_boarded, f_doorlow_red_boarded, f_door_boarded
                                   the north-east house shut up for the dry years: two 2 px boards nailed across each
                                   window and door, over the facade as it was, so it reads as "someone will come back".

  reeds_bed                        a reed bed in the river: a clump of 2 px blades with two cattails (aquatic: gone in
                                   winter like the other reeds).
  rockspur                         stones breaking the river's surface, ice-white foam on their upstream side.
  millwheel_tl/tr/bl/br            the mill wheel (32 x 32 over four water tiles): a wooden wheel with eight spokes
                                   and paddles, its foot dipping into the river at a 2 px foam line. Static.

No 1 px features, no alpha. Positions are in scripts/map-art.mjs (town).
"""
from __future__ import annotations

import numpy as np

T = 16


def _hull(h: int, w: int, lean: int) -> np.ndarray:
    """A boat's outline mask on a w x h canvas: a pointed bow at the top, a broad round stern; `lean` shears the bow
    sideways (px at the top row), in 2 px steps, so a listing boat stays on whole pixels."""
    m = np.zeros((h, w), bool)
    for y in range(h):
        t = y / (h - 1)
        if t < 0.55:
            half = 6.0 * np.sqrt(max(0.0, 1 - ((0.55 - t) / 0.58) ** 2))
        else:
            half = 6.0 if t < 0.88 else 6.0 - (t - 0.88) / 0.12 * 2.5
        shift = int(round(lean * (1 - t) / 2)) * 2
        c = w / 2 + shift
        x0, x1 = int(round(c - half)), int(round(c + half))
        m[y, max(0, x0) : min(w, x1)] = True
    return m


def _erode(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1)
    return m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]


def heron(P, aground: bool) -> np.ndarray:
    H = 32
    c = P.name
    t = np.full((H, T), -1, dtype=np.int32)
    hull = _hull(30, T, 2 if aground else 0)
    m = np.zeros((H, T), bool)
    m[1:31] = hull
    ring = m & ~_erode(m)
    inner = _erode(m)
    paint = inner & ~_erode(_erode(inner))  # the painted hull side, 2 px
    deck = _erode(_erode(inner))
    if not aground:  # the waterline: a 2 px dark ring on the water around the hull
        p = np.pad(m, 2)
        near = np.zeros_like(m)
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if abs(dy) + abs(dx) <= 2:
                    near |= p[2 + dy : 2 + dy + H, 2 + dx : 2 + dx + T]
        t[near & ~m] = c("night navy")
    else:  # the mud bank the keel sank into (the stern half), with a crack
        yy, xx = np.mgrid[0:H, 0:T]
        bank = (((xx + 0.5 - 8) / 8.5) ** 2 + ((yy + 0.5 - 27) / 6) ** 2 <= 1) & ~m
        t[bank] = c("soil")
        t[bank & (yy >= 29)] = c("earth dark")
    t[ring] = c("ink")
    t[paint] = c("dusk blue")
    t[paint & ~np.roll(paint, 2, axis=1)] = c("water")  # the lit side of the paint (left)
    sheer = deck & ~_erode(deck)
    t[deck] = c("wood")
    t[sheer] = c("ice white")  # the white sheer strake along the gunwale
    for y in range(8, 30, 4):  # thwarts and floor boards, 2 px
        row = deck[y] & deck[y + 1]
        t[y : y + 2][:, row] = np.where(deck[y : y + 2][:, row], c("soil"), t[y : y + 2][:, row])
    # the mast step and the boom with the sail furled along it (parchment, shaded sand)
    xs = np.nonzero(deck[11])[0]
    mx = int(xs.mean()) if len(xs) else 7
    t[10:12, mx - 1 : mx + 1] = c("ink")
    for y in range(12, 24):
        xs = np.nonzero(deck[y])[0]
        if len(xs) < 4:
            continue
        cx = int(round(xs.mean()))
        t[y, cx - 1 : cx + 1] = c("parchment")
        t[y, cx + 1] = c("sand")
    if aground:
        # the dry hull line where the water used to reach (stone lt, 2 px) and the keel sunk: the mud over the
        # hull's stern
        line = paint & np.roll(paint, -2, axis=0) & ~np.roll(paint, 2, axis=0)
        yy, xx = np.mgrid[0:H, 0:T]
        t[paint & (yy >= 18) & (yy <= 19)] = c("stone lt")
        mud = m & (yy >= 27)
        t[mud] = c("soil")
        t[(mud & ~_erode(mud)) & (yy == 27)] = c("earth dark")
        del line
    return t


def boarded(P, base: np.ndarray, rows: list[int], x0: int = 1, x1: int = 15) -> np.ndarray:
    """Boards nailed across a facade tile: each board is 4 px (ink, 2 px wood, ink) from x0 to x1, nails in
    stone dark (2 x 2 would crowd a 2 px board, so a nail is the board's lit end)."""
    t = base.copy()
    for y in rows:
        t[y, x0:x1] = P.name("ink")
        t[y + 1 : y + 3, x0:x1] = P.name("wood")
        t[y + 1, x0:x1] = P.name("sand")
        t[y + 2, x0:x1] = P.name("wood")
        t[y + 3, x0:x1] = P.name("ink")
        t[y + 1 : y + 3, x0 + 1 : x0 + 3] = P.name("stone dark")
        t[y + 1 : y + 3, x1 - 3 : x1 - 1] = P.name("stone dark")
    return t


def _blob(cx: float, cy: float, rx: float, ry: float, w: int = T, h: int = T) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    return ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1


def reeds_bed(P) -> np.ndarray:
    c = P.name
    t = np.full((T, T), -1, dtype=np.int32)
    t[_blob(8, 14, 7.5, 2.5) & ~_blob(8, 14, 5.5, 1.2)] = c("night navy")  # the stalks' shadow on the water
    # blades: (x, top) 2 px wide, from their top down to row 14
    blades = [(1, 7), (4, 3), (7, 6), (10, 2), (13, 5)]
    for x, top in blades:
        t[top - 1 : 15, x - 1 : x + 3] = np.where(t[top - 1 : 15, x - 1 : x + 3] == -1, c("ink"), t[top - 1 : 15, x - 1 : x + 3])
    for i, (x, top) in enumerate(blades):
        t[top:15, x : x + 2] = c("leaf mid") if i % 2 else c("leaf dark")
        t[top : top + 2, x : x + 2] = c("new leaf") if i % 2 else c("leaf mid")
    for x, top in ((4, 3), (10, 2)):  # cattails
        t[top - 1 : top + 4, x - 1 : x + 3] = c("ink")
        t[top : top + 3, x : x + 2] = c("soil")
    return t


def rockspur(P) -> np.ndarray:
    c = P.name
    t = np.full((T, T), -1, dtype=np.int32)
    t[_blob(8, 11, 7.5, 4.5)] = c("ice white")  # the foam where the river breaks on them
    t[_blob(8, 12, 6.5, 3.5)] = c("night navy")
    for cx, cy, rx, ry, warm in ((6, 9, 4, 3.5, False), (11, 10, 3.5, 3, True), (8, 12, 3, 2.5, False)):
        b = _blob(cx, cy, rx, ry)
        body = _erode(b)
        t[b] = c("ink")
        t[body] = c("taupe" if warm else "stone")
        t[body & ~np.roll(body, 2, axis=0)] = c("stone lt")
        t[body & ~np.roll(body, -2, axis=0)] = c("stone dark")
    return t


def millwheel(P) -> np.ndarray:
    c = P.name
    n = 32
    t = np.full((n, n), -1, dtype=np.int32)
    yy, xx = np.mgrid[0:n, 0:n]
    cx, cy = 16, 14
    r = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
    ang = np.degrees(np.arctan2(yy + 0.5 - cy, xx + 0.5 - cx)) % 360
    wheel = r <= 14.5
    t[wheel] = c("ink")
    rim = (r <= 13.5) & (r > 10.5)
    t[rim] = c("wood")
    t[rim & (r > 12.5)] = c("soil")  # the rim's outer band, in shade
    for a in range(0, 360, 45):  # eight spokes, 2 px
        d = np.abs(((ang - a + 180) % 360) - 180)
        t[(r <= 10.5) & (d * np.pi / 180 * np.maximum(r, 1) <= 1.1)] = c("wood")
        paddle = (r > 10.5) & (r <= 14.5) & (d * np.pi / 180 * r <= 1.6)
        t[paddle] = c("earth dark")
    t[(r <= 10.5) & (t == c("ink"))] = c("plum shadow")  # the gaps between spokes, dark under the wheelhouse
    t[r <= 3.5] = c("ink")
    t[r <= 2.5] = c("stone dark")  # the hub
    t[(r <= 1.5)] = c("stone lt")
    # its foot in the river: cut at the surface, a 2 px foam line where the paddles dip
    t[yy >= 26] = -1
    t[(yy >= 24) & (yy < 26) & (r <= 15.5)] = c("ice white")
    return t


def build(P, out: dict[str, np.ndarray]) -> None:
    """Add the M6 town tiles to `out` (tiles_extra's dict, before it is laid out)."""
    afloat = heron(P, False)
    out["heron_t"], out["heron_b"] = afloat[:T].copy(), afloat[T:].copy()
    ag = heron(P, True)
    out["heron_aground_t"], out["heron_aground_b"] = ag[:T].copy(), ag[T:].copy()
    out["f_window_boarded"] = boarded(P, out["f_window"], [3, 8], 2, 14)
    out["f_window_hi_boarded"] = boarded(P, out["f_window_hi"], [3, 8], 2, 14)
    out["f_doortop_red_boarded"] = boarded(P, out["f_doortop_red"], [10], 2, 14)
    out["f_doorlow_red_boarded"] = boarded(P, out["f_doorlow_red"], [3], 2, 14)
    if "f_door" in out:
        out["f_door_boarded"] = boarded(P, out["f_door"], [3, 9], 2, 14)
    out["reeds_bed"] = reeds_bed(P)
    out["rockspur"] = rockspur(P)
    mw = millwheel(P)
    out["millwheel_tl"], out["millwheel_tr"] = mw[:T, :T].copy(), mw[:T, T:].copy()
    out["millwheel_bl"], out["millwheel_br"] = mw[T:, :T].copy(), mw[T:, T:].copy()
