"""The broken places' site sprites, drawn in code over the palette (Dry Year, art round dry-year-2).

The Old Spring (`obj_site_spring_0..3`, 32x32, a 2x2-tile footprint whose base is the bottom row): an earth bank
with the spring's dark mouth, choked by a rockfall that comes down a few stones each work day.

  0  the full heap over a dry, dark mouth (as tall as the farmer)
  1  the top stones levered off: one gap shows the mouth, water glints between the bottom stones
  2  the mouth clear, the stones rolled to both sides, a damp stain and a trickle filling a puddle
  3  restored: the side stones mossed over, the spring pouring into an open pool

The four stages use the same stones (the ones left are where they were), so they read as one place changing.
Flow's site_spring sheets (prompts 42) were too fine to survive 32 px (a heap of 1-2 px gravel), so this follows
the channel tiles: drawn in code, 2 px minimum features, ink outlines, plum shadows, no alpha.
"""
from __future__ import annotations

import numpy as np

W = H = 32


class Canvas:
    def __init__(self, names: list[str], w: int = W, h: int = H):
        self.names = names
        self.t = np.full((h, w), -1, dtype=np.int32)

    def c(self, name: str) -> int:
        return self.names.index(name)

    def put(self, mask: np.ndarray, name: str) -> None:
        self.t[mask] = self.c(name)

    def rect(self, x: int, y: int, w: int, h: int, name: str) -> None:
        y0, x0 = max(0, y), max(0, x)
        self.t[y0 : y + h, x0 : x + w] = self.c(name)


def ellipse(w: int, h: int, cx: float, cy: float, rx: float, ry: float, p: float = 2.0) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    return (np.abs((xx + 0.5 - cx) / rx) ** p + np.abs((yy + 0.5 - cy) / ry) ** p) <= 1.0


def edge(mask: np.ndarray) -> np.ndarray:
    """Pixels of `mask` with a 4-neighbour outside it (the outline ring, inside the shape)."""
    m = np.pad(mask, 1)
    inner = m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:]
    return mask & ~inner


def shift(mask: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(mask)
    h, w = mask.shape
    ys, xs = slice(max(0, dy), h + min(0, dy)), slice(max(0, dx), w + min(0, dx))
    ys0, xs0 = slice(max(0, -dy), h + min(0, -dy)), slice(max(0, -dx), w + min(0, -dx))
    out[ys, xs] = mask[ys0, xs0]
    return out


def stone(cv: Canvas, x: int, y: int, w: int, h: int, moss: bool = False, warm: bool = False) -> None:
    """One boulder: ink outline, a 2 px lit top-left, a 2 px dark lower-right, a plum shadow on the ground."""
    shape = ellipse(W, H, x + w / 2, y + h / 2, w / 2, h / 2, 2.6)
    body = shape & ~edge(shape)
    lit = body & ~shift(body, 0, 2) | (body & ~shift(body, 2, 0) & ~shift(body, 0, h // 2))
    dark = body & ~shift(body, -2, 0) & shift(body, 0, h // 3) | (body & ~shift(body, 0, -2))
    cv.put(edge(shape), "ink")
    cv.put(body, "taupe" if warm else "stone")
    cv.put(dark, "stone dark")
    cv.put(lit & ~dark, "stone lt")
    if moss:  # a moss cap over the lit top (2 px), leaf dark on its lower edge
        cap = body & ~shift(body, 0, 3)
        cv.put(cap, "leaf mid")
        cv.put(cap & ~shift(cap, 0, -1) & shift(body, 0, 4), "leaf dark")


def bank(cv: Canvas, green: bool) -> np.ndarray:
    """The earth bank the spring comes out of, and its dark mouth. Returns the mouth's mask."""
    mound = ellipse(W, H, 16, 22, 15.5, 15) & (np.mgrid[0:H, 0:W][0] <= 31)
    body = mound & ~edge(mound)
    cv.put(edge(mound), "ink")
    cv.put(body, "soil")
    cv.put(body & ~shift(body, 0, -6), "earth dark")  # the bank's foot in shade
    cap = body & ~shift(body, 0, 2)
    cv.put(cap, "leaf mid" if green else "sand")  # turf (or dry straw) along the top, 2 px
    mouth = ellipse(W, H, 16, 27, 6, 11, 2.2)
    cv.put(mouth, "ink")
    cv.put(mouth & ~edge(mouth), "plum shadow")
    core = ellipse(W, H, 16, 29, 3, 8, 2.2)
    cv.put(core & mouth & ~edge(mouth), "ink")  # deep inside
    return mouth


# (x, y, w, h, flags) back to front; the stage lists say which stones are still there
STONES = {
    "b": (11, 3, 11, 9),  # the crown
    "a": (3, 9, 10, 9), "c": (20, 8, 10, 9), "e": (9, 11, 9, 9),
    "d": (0, 16, 9, 8), "f": (16, 13, 9, 9), "g": (24, 15, 8, 9),
    "h": (1, 22, 10, 9), "i": (10, 20, 8, 8), "j": (16, 22, 9, 9), "k": (24, 23, 8, 8),
    "l": (8, 26, 6, 5),  # a pebble in front
}
STAGE_STONES = [
    "baceldfghijk",
    "acdghjkl",  # the crown and the three in front of the mouth are off: one gap, and the heap is lower
]
WARM = {"c", "e", "h"}


def spring(names: list[str], stage: int) -> np.ndarray:
    cv = Canvas(names)
    green = stage >= 3
    bank(cv, green)
    yy, xx = np.mgrid[0:H, 0:W]
    cv.put(ellipse(W, H, 16, 31, 15, 3) & (yy >= 29), "plum shadow")  # the heap's shadow on the ground
    if stage <= 1:
        for k in STAGE_STONES[stage]:
            x, y, w, h = STONES[k]
            stone(cv, x, y, w, h, warm=k in WARM)
        if stage == 1:  # water glints at the foot, between the bottom stones (2x2, solid)
            for gx, gy in ((15, 28), (19, 27)):
                cv.rect(gx, gy, 2, 2, "sky")
            cv.rect(16, 25, 4, 2, "dusk blue")
        return cv.t
    # 2 and 3: the stones rolled to both sides of the mouth
    side = [(0, 12, 9, 9, "d"), (23, 13, 9, 9, "g"), (0, 20, 10, 10, "h"), (22, 21, 10, 9, "k")]
    if stage == 2:
        stain = ellipse(W, H, 16, 30, 9, 4) & (yy >= 26)
        cv.put(stain, "earth dark")
        cv.rect(15, 18, 2, 10, "water")  # the trickle down from the mouth
        cv.rect(15, 18, 2, 2, "sky")
        pud = ellipse(W, H, 16, 29.5, 5, 2.5)
        cv.put(pud, "water")
        cv.put(pud & ~shift(pud, 0, 1), "sky")
    else:
        for x, y, w, h, k in side:
            stone(cv, x, y, w, h, moss=True, warm=k in WARM)
        # the spring pouring out of the mouth into a pool
        cv.rect(13, 16, 6, 11, "water")
        cv.rect(15, 16, 2, 11, "sky")
        pool = ellipse(W, H, 16, 28.5, 13, 4.6) & (yy <= 31)
        cv.put(edge(pool), "ink")
        body = pool & ~edge(pool)
        cv.put(body, "water")
        cv.put(body & ~shift(body, 0, 2), "sky")  # the far rim catches the light
        cv.rect(12, 26, 8, 2, "ice white")  # foam where it lands
        cv.rect(7, 29, 4, 2, "sky")
        cv.rect(21, 29, 3, 2, "sky")
        # the overflow (R22-1): the rim opens on the south-east, where the map's pool lies just below the site, and
        # the water spills out of the sprite's bottom edge toward it
        cv.rect(20, 29, 8, 3, "water")
        cv.rect(22, 30, 2, 2, "sky")
    if not green:
        for x, y, w, h, k in side:
            stone(cv, x, y, w, h, warm=k in WARM)
    if green:  # ferns at the stones' feet
        for fx in (1, 27):
            cv.rect(fx, 27, 4, 2, "leaf mid")
            cv.rect(fx + 1, 25, 2, 2, "new leaf")
    return cv.t


def _stone_on(cv: Canvas, x: int, y: int, w: int, h: int, warm: bool = False) -> None:
    """`stone` on a canvas of any size (the warm pool is 32x40)."""
    hh, ww = cv.t.shape
    shape = ellipse(ww, hh, x + w / 2, y + h / 2, w / 2, h / 2, 2.1)
    body = shape & ~edge(shape)
    lit = body & ~shift(body, 0, 2)
    dark = body & ~shift(body, 0, -2) | (body & ~shift(body, -2, 0) & shift(body, 0, h // 3))
    cv.put(edge(shape), "ink")
    cv.put(body, "taupe" if warm else "stone")
    cv.put(dark, "stone dark")
    cv.put(lit & ~dark, "stone lt")


def warm_pool(names: list[str]) -> np.ndarray:
    """The Warm Pool (`obj_landmark_bathhouse`, 32x40): a pool walled with the spring's stones, a lantern on a post
    (its one warm accent), a bench, ferns and solid steam puffs (no alpha)."""
    w, h = 32, 40
    cv = Canvas(names, w, h)
    yy, xx = np.mgrid[0:h, 0:w]
    # the lantern post at the back right
    cv.rect(25, 8, 4, 22, "ink")
    cv.rect(26, 9, 2, 21, "wood")
    cv.rect(19, 8, 8, 3, "ink")  # the arm
    cv.rect(20, 9, 6, 1, "wood")
    cv.rect(19, 11, 6, 2, "ink")  # the lantern: a cap, the glass, a foot
    cv.rect(18, 13, 8, 6, "ink")
    cv.rect(19, 14, 6, 4, "gold")
    cv.rect(21, 14, 2, 3, "lamp")
    # ferns at the back left
    for fx, fy, fh in ((3, 19, 9), (7, 21, 7)):
        cv.rect(fx - 1, fy - 1, 4, fh + 1, "ink")
        cv.rect(fx, fy, 2, fh, "leaf dark")
        for k in range(0, fh - 2, 3):
            cv.rect(fx - 3, fy + k + 1, 3, 2, "leaf mid")
            cv.rect(fx + 2, fy + k, 3, 2, "leaf mid")
        cv.rect(fx, fy - 1, 2, 2, "new leaf")
    cv.put(ellipse(w, h, 16, 38.5, 15, 2.5) & (yy >= 37), "plum shadow")
    # the water, then the rim's stones over its edge, back to front
    pool = ellipse(w, h, 16, 31, 12.5, 6)
    cv.put(pool, "ink")
    water = pool & ~edge(pool)
    cv.put(water, "water")
    cv.put(water & ~shift(water, 0, 3), "dusk blue")  # shade under the far rim
    cv.rect(11, 31, 4, 2, "sky")
    cv.rect(18, 33, 3, 2, "sky")
    rim = [(5, 22, 8, 6), (11, 21, 7, 5), (17, 21, 8, 6), (23, 23, 7, 6),  # far side
           (0, 25, 7, 8), (26, 26, 6, 8),  # ends
           (2, 32, 8, 7), (8, 33, 7, 7), (13, 34, 8, 6), (19, 33, 7, 7), (24, 31, 8, 8)]  # near side
    for i, (x, y, sw, sh) in enumerate(rim):
        _stone_on(cv, x, y, sw, sh, warm=i in (1, 6, 9))
    # steam: two wisps rising off the water, solid ice white in 2x2 steps (no alpha)
    for wx, wy, n in ((11, 20, 5), (17, 18, 4)):
        for k in range(n):
            cv.rect(wx + (1 if k % 2 else 0) + (k // 2) % 2, wy - 2 * k, 2, 3, "ice white")
    # a bench at the front left, in front of the rim
    cv.rect(0, 33, 8, 4, "ink")
    cv.rect(1, 34, 6, 2, "wood")
    cv.rect(0, 37, 3, 3, "ink")
    cv.rect(5, 37, 3, 3, "ink")
    return cv.t


def _wall(cv: Canvas, x0: int, x1: int, top: int, broken: bool = False, bottom: int = H) -> None:
    """Dressed masonry from x0 to x1 (exclusive): a lit 4 px top face, then courses of 6 px blocks (a 2 px lit top,
    a 2 px dark foot, staggered 2 px dark joints). No 1 px mortar lines."""
    cv.rect(x0, top, x1 - x0, bottom - top, "ink")
    cv.rect(x0 + 1, top + 1, x1 - x0 - 2, 3, "stone lt")  # the wall's top, in the sun
    y, row = top + 4, 0
    while y < bottom - 1:
        hgt = min(6, bottom - 1 - y)
        cv.rect(x0 + 1, y, x1 - x0 - 2, hgt, "stone")
        cv.rect(x0 + 1, y, x1 - x0 - 2, min(2, hgt), "stone lt")
        if hgt > 4:
            cv.rect(x0 + 1, y + hgt - 2, x1 - x0 - 2, 2, "stone dark")
        for jx in range(x0 + (3 if row % 2 else 7), x1 - 2, 8):
            cv.rect(jx, y, 2, hgt, "stone dark")
        y += hgt
        row += 1
    if broken:  # the wall's broken end: a stepped bite out of its top toward the gap
        for i, bx in enumerate(range(x1 - 8, x1, 2)):
            cv.t[: top + 2 + 2 * i, bx : bx + 2] = -1
            cv.rect(bx, top + 2 + 2 * i, 2, 2, "ink")


def weir(names: list[str], stage: int) -> np.ndarray:
    """The weir's site on the gorge's west bank (`obj_site_weir_0..4`, 32x32; the gorge begins at the sprite's
    right edge): the old wall running east, its gap at the gorge end.

      0  the gap choked with rubble, the wall's end broken
      1  the top of the rubble out (stones out once)
      2  stones out twice: the gap clear down to the old footings
      3  Orin's gate set in a new wooden frame, one beam short (the gap open above it)
      4  mended: the last beam in across the top; water at the gate's foot
    """
    cv = Canvas(names)
    yy, xx = np.mgrid[0:H, 0:W]
    cv.put(ellipse(W, H, 16, 31, 16, 2.5) & (yy >= 30), "plum shadow")
    gx0, gx1 = 17, 32  # the gap
    _wall(cv, 0, gx0 + 1, 10, broken=stage <= 2, bottom=29)
    if stage <= 2:
        # the gap: dark, down to the footings
        cv.rect(gx0 + 1, 18, gx1 - gx0 - 1, 13, "ink")
        cv.rect(gx0 + 2, 19, gx1 - gx0 - 2, 10, "plum shadow")
        cv.rect(gx0 + 1, 27, gx1 - gx0 - 1, 4, "stone dark")  # the old footings (a sill)
        cv.rect(gx0 + 2, 27, gx1 - gx0 - 2, 2, "stone")
        rubble = [(18, 3, 10, 10), (23, 9, 9, 9), (16, 15, 9, 9), (24, 17, 8, 9), (18, 23, 8, 8), (25, 24, 7, 7)]
        keep = {0: rubble, 1: rubble[2:], 2: []}[stage]
        for x, y, w, h in keep:
            stone(cv, x, y, w, h, warm=(x + y) % 3 == 0)
        if stage == 1:  # the stones levered out lie at the wall's foot
            stone(cv, 2, 24, 8, 8)
            stone(cv, 9, 25, 7, 7, warm=True)
        if stage == 2:
            stone(cv, 0, 24, 8, 8)
            stone(cv, 6, 25, 7, 7, warm=True)
            stone(cv, 11, 24, 8, 8)
        return cv.t
    # 3 and 4: a wooden frame in the gap and Orin's gate
    for px_ in (gx0 + 1, gx1 - 4):
        cv.rect(px_, 10, 4, 21, "ink")
        cv.rect(px_ + 1, 11, 2, 19, "wood")
    cv.rect(gx0 + 5, 18, gx1 - gx0 - 9, 12, "ink")
    for k, bx in enumerate(range(gx0 + 6, gx1 - 5, 3)):  # the gate's planks
        cv.rect(bx, 19, 2, 10, "wood" if k % 2 == 0 else "soil")
    cv.rect(gx0 + 5, 22, gx1 - gx0 - 9, 2, "stone dark")  # an iron band across it
    cv.rect(gx0 + 1, 29, gx1 - gx0 - 1, 2, "stone dark")  # the footings under the gate
    if stage == 3:
        cv.rect(gx0 + 5, 12, gx1 - gx0 - 9, 6, "ink")  # one beam short: the gap open above the gate
        cv.rect(gx0 + 5, 13, gx1 - gx0 - 9, 4, "plum shadow")
    else:
        cv.rect(gx0 + 1, 11, gx1 - gx0 - 1, 7, "ink")  # the last beam, across the frame
        cv.rect(gx0 + 2, 12, gx1 - gx0 - 3, 2, "sand")
        cv.rect(gx0 + 2, 14, gx1 - gx0 - 3, 3, "wood")
        for bx in (gx0 + 3, gx1 - 4):
            cv.rect(bx, 14, 2, 2, "stone dark")  # its bolts
        cv.rect(gx0 + 5, 29, gx1 - gx0 - 9, 2, "water")  # water at the gate's foot
        cv.rect(gx0 + 8, 29, 3, 2, "sky")
    return cv.t


def weir_span(names: list[str], wet: bool) -> np.ndarray:
    """R27-3: the weir's wall across the gorge (48 x 32 over the gorge's three columns, tile rows 10-11, as map tiles
    `weir_span_<dry|wet>_<0..2>_<t|b>`), the same masonry and courses as the site sprite (top at row 10, foot at 29) so
    it continues the west abutment east to the far bank.

      dry   (the gorge dry: before and during the work) the wall standing across the bare bed, its foot in shadow
      wet   (the gorge running: the weir open) the river sheeting over the crest: water on the top face, a 2 px foam
            band where it falls, foam at the foot
    """
    w, h = 48, 32
    cv = Canvas(names, w, h)
    yy, xx = np.mgrid[0:h, 0:w]
    if not wet:
        cv.put(ellipse(w, h, 24, 31, 26, 2.5) & (yy >= 29), "plum shadow")
    _wall(cv, -1, w, 10, bottom=29)  # open on the west (it joins the site sprite's wall), closed at the east bank
    if wet:
        cv.rect(0, 11, w - 1, 3, "water")  # the river over the crest
        cv.rect(0, 11, w - 1, 1, "sky")
        for x in range(2, w - 4, 8):  # its glints, whole 2 px
            cv.rect(x, 12, 2, 1, "sky")
        cv.rect(0, 14, w - 1, 2, "ice white")  # the lip, where it falls
        for x in range(1, w - 3, 6):  # the falling sheet down the face, in 2 px streaks
            cv.rect(x, 16, 2, 6, "water")
            cv.rect(x, 16, 2, 2, "sky")
        cv.rect(0, 27, w, 2, "ice white")  # foam at the foot
        cv.rect(0, 29, w, 2, "ice white")
        cv.t[29:31, 3::7] = cv.c("sky")
    return cv.t


def span_tiles(names: list[str]) -> dict[str, np.ndarray]:
    """The span as tiles for the tileset (tiles_extra)."""
    out = {}
    for kind, wet in (("dry", False), ("wet", True)):
        t = weir_span(names, wet)
        for i in range(3):
            out[f"weir_span_{kind}_{i}_t"] = t[:16, i * 16 : (i + 1) * 16].copy()
            out[f"weir_span_{kind}_{i}_b"] = t[16:, i * 16 : (i + 1) * 16].copy()
    return out


def build(names: list[str]) -> dict[str, np.ndarray]:
    out = {f"obj_site_spring_{i}": spring(names, i) for i in range(4)}
    out["obj_landmark_bathhouse"] = warm_pool(names)
    out.update({f"obj_site_weir_{i}": weir(names, i) for i in range(5)})
    return out
