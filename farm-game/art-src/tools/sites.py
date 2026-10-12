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


def build(names: list[str]) -> dict[str, np.ndarray]:
    out = {f"obj_site_spring_{i}": spring(names, i) for i in range(4)}
    out["obj_landmark_bathhouse"] = warm_pool(names)
    return out
