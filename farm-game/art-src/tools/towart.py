"""Towing art for M7 (the Weir's verb), drawn in code over the palette (art round m7).

  tow_log, tow_log_v                a short drift log, 16 x 8 lying east-west (8 x 16 north-south): ink outline, a
                                    2 px lit top in wood, 2 px of soil bark with a dark knot, sawn ends in sand with a
                                    soil heart, and a 2 px night-navy waterline under it on the water (no translucent
                                    water over the log).
  tow_log_long, tow_log_long_v      a long log, 32 x 10: the same bark, sand rings at both ends, two knots and a branch
                                    stub standing 2 px over its back, so it differs from the short one by silhouette.
  *_tilt                            caught on a snag: the west end rides up 2 px over the snag in two
                                    1 px steps, showing its dark underside, and the waterline under the raised third
                                    is gone (for _v: the south end kicked 2 px west). The game flips the frame so that
                                    end is the one at the snag.
  tow_rock                          the lab's snag rock: the town's rock spur (towntiles.rockspur), so the player
                                    learns "rock = snag" once.
  tow_slip, tow_slip_s              the log slip, 16 x 32 over the slip's water tile and its bank tile (tow_slip: the
                                    water is north of the bank, as on the town's south bank; _s: south, as in the lab
                                    spike): a plank ramp between two rails running into the river, its foot under a
                                    2 px foam line, two mooring posts in foam rings, a sill beam on the bank.
  tow_rope_dot                      the rope's 2 x 2 stamp (wood over ink), laid every 1 px along the rope's curve.
  p_timberstack                     (a tileset prop, solid) landed timber stacked by the town's slip.
  tow_icon_hook, tow_icon_home, tow_icon_tug
                                    the Action button's towing verbs, 16 x 16 like the tool icons, 2 px strokes in ink:
                                    hook (a steel hook on a rope), home (a log landed on the slip's planks), tug (a taut
                                    rope pulled by a bold arrow off a log's end).

No 1 px features (bar the ink outline), no alpha.
"""
from __future__ import annotations

import numpy as np

import towntiles


class Ink:
    """A palette-indexed canvas (-1 = clear)."""

    def __init__(self, names: list[str], w: int, h: int):
        self.names = names
        self.t = np.full((h, w), -1, dtype=np.int32)

    def c(self, name: str) -> int:
        return self.names.index(name)

    def rect(self, x: int, y: int, w: int, h: int, name: str) -> None:
        H, W = self.t.shape
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if x1 > x0 and y1 > y0:
            self.t[y0:y1, x0:x1] = self.c(name)

    def put(self, mask: np.ndarray, name: str) -> None:
        self.t[mask] = self.c(name)


def _grow(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1)
    return m | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]


# ---------------------------------------------------------------- logs


def _log_h(names: list[str], length: int, long: bool, tilt: bool = False) -> np.ndarray:
    """A log lying east-west. Short: 16 x 8 (body rows 0-5, waterline rows 6-7). Long: 32 x 10 (a branch stub in rows
    0-1). Tilted (caught on a snag): 2 px taller; the west third is raised 2 px and the middle third 1 px, the raised
    part shows its dark underside and has no waterline under it."""
    L = length
    top = (2 if long else 0) + (2 if tilt else 0)
    H = top + 8
    third = L // 3
    off = [(2 if x < third else 1 if x < 2 * third else 0) if tilt else 0 for x in range(L)]
    names_ = names
    cv = Ink(names_, L, H)
    b0 = top  # the outline's top row when flat
    yy, xx = np.mgrid[0:H, 0:L]
    o = np.array(off)[None, :]
    inside = (xx >= 1) & (xx <= L - 2) & (yy >= b0 + 1 - o) & (yy <= b0 + 4 - o)
    rel = yy - (b0 + 1 - o)  # row inside the body, 0..3
    # sawn ends: sand faces, an ink line where the bark begins; the long log's faces have a 2 x 2 soil heart
    face = 4 if long else 2
    stub = np.zeros_like(inside)
    if long:
        sx = 13
        stub = (xx >= sx) & (xx < sx + 4) & (yy >= b0 - 2 - o) & (yy < b0 - o)
    body = inside | stub
    p = np.pad(body, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~body
    cv.put(ring, "ink")
    cv.put(inside & (rel < 2), "wood")  # the lit top, 2 px
    cv.put(inside & (rel >= 2), "soil")  # the bark in shade, 2 px
    if tilt:  # the raised part's underside
        cv.put(inside & (rel == 3) & (o > 0), "earth dark")
    for x0, ink_x in ((1, 1 + face), (L - 1 - face, L - 2 - face)):
        cv.put(inside & (xx >= x0) & (xx < x0 + face), "sand")
        cv.put(inside & (xx == ink_x), "ink")
        if long:
            cv.put(inside & (xx >= x0 + 1) & (xx < x0 + 3) & (rel >= 1) & (rel < 3), "soil")
    for kx in ([L // 2 - 1] if not long else [9, 20]):
        cv.put(inside & (xx >= kx) & (xx < kx + 2) & (rel >= 2), "earth dark")
    if long:
        cv.put(stub & (yy == b0 - 2 - o), "sand")  # the stub's cut top
        cv.put(stub & (yy == b0 - 1 - o), "wood")
        cv.put(inside & (xx >= 13) & (xx < 17) & (rel == 0), "wood")
    # the waterline: 2 px of night navy under the log's flat (unraised) part, inset at the ends to hug the body
    wl = (o == 0) & (((yy == b0 + 6) & (xx >= 1) & (xx <= L - 2)) | ((yy == b0 + 7) & (xx >= 2) & (xx <= L - 3)))
    cv.put(wl & (cv.t == -1), "night navy")
    return cv.t


def logs(names: list[str]) -> dict[str, np.ndarray]:
    out: dict[str, np.ndarray] = {}
    for key, length, long in (("tow_log", 16, False), ("tow_log_long", 32, True)):
        flat = _log_h(names, length, long)
        tilt = _log_h(names, length, long, True)
        out[key] = flat
        out[f"{key}_tilt"] = tilt
        # north-south: a quarter turn anticlockwise (the lit top becomes the west side, the waterline the east,
        # the west end the south end, so _v_tilt kicks the south end 2 px west)
        out[f"{key}_v"] = np.rot90(flat, 1).copy()
        out[f"{key}_v_tilt"] = np.rot90(tilt, 1).copy()
    return out


# ---------------------------------------------------------------- the slip


def _small_log(cv: Ink, x: int, y: int, length: int) -> None:
    """A landed log (no waterline) lying east-west with its top-left at (x, y): 6 px tall, a sand face at the east."""
    cv.rect(x + 1, y, length - 2, 1, "ink")
    cv.rect(x + 1, y + 5, length - 2, 1, "ink")
    cv.rect(x, y + 1, 1, 4, "ink")
    cv.rect(x + length - 1, y + 1, 1, 4, "ink")
    cv.rect(x + 1, y + 1, length - 2, 2, "wood")
    cv.rect(x + 1, y + 3, length - 2, 2, "soil")
    cv.rect(x + length - 5, y + 1, 4, 4, "sand")
    cv.rect(x + length - 4, y + 2, 2, 2, "soil")
    cv.rect(x + length - 6, y + 1, 1, 4, "ink")


def _stack(cv: Ink, x: int, y: int) -> None:
    """Landed timber: two logs on the ground and one on top, a plum shadow under them. (x, y) = the pile's top-left;
    it is 14 x 13."""
    cv.rect(x + 1, y + 11, 13, 2, "plum shadow")
    _small_log(cv, x, y + 6, 12)
    _small_log(cv, x + 2, y + 1, 12)
    # the top log rests in the groove: its bottom outline merges with the lower log's top
    cv.rect(x + 3, y + 6, 10, 1, "ink")


def slip(names: list[str], water_north: bool) -> np.ndarray:
    """16 x 32 over the slip's water tile and bank tile (water_north: the water tile is the top half, as on the town's
    south bank; else the bottom half, as in the lab spike). Rails at x 0-2 and 13-15, planks across x 3-12, two
    mooring posts in the river, a 2 px foam line where the ramp goes under, a sill beam on the bank."""
    cv = Ink(names, 16, 32)
    edge = 16  # the water's edge between the halves

    def wet(y: int) -> bool:
        return (y < edge) if water_north else (y >= edge)

    # the ramp's extent: from 6 px into the river (below the posts) to the bank's far side
    y0, y1 = (6, 32) if water_north else (0, 26)
    # rails: ink outline, 2 px wood (soil under the water)
    for x_ink, x_wood, x_out in ((0, 1, 3), (15, 13, 12)):
        for y in range(y0, y1):
            cv.rect(x_ink, y, 1, 1, "ink")
            cv.rect(x_wood, y, 2, 1, "soil" if wet(y) else "wood")
            cv.rect(x_out, y, 1, 1, "ink")
    # planks: 5 px pitch (an ink seam, 2 px lit, 2 px shade), lit on their north side
    for y in range(y0, y1):
        k = (y - y0) % 5
        if k == 0:
            name = "ink"
        elif k < 3:
            name = "dusk blue" if wet(y) else "sand"
        else:
            name = "night navy" if wet(y) else "wood"
        cv.rect(4, y, 8, 1, name)
    # the foam line where the planks go under (2 px, just inside the water)
    fy = edge - 2 if water_north else edge
    cv.rect(1, fy, 14, 2, "ice white")
    # the sill beam at the bank end: 4 px, lit top
    sy = y1 - 4 if water_north else y0
    cv.rect(0, sy, 16, 4, "ink")
    cv.rect(1, sy + 1, 14, 2, "wood")
    # mooring posts at the river end: 4 px with their outline, a taupe cap, wet earth-dark wood, a 2 px foam ring
    py = 0 if water_north else 23
    for px_ in (0, 12):
        cv.rect(px_, py + 6, 4, 2, "ice white")
        cv.rect(px_, py, 4, 7, "ink")
        cv.rect(px_ + 1, py + 1, 2, 2, "taupe")
        cv.rect(px_ + 1, py + 3, 2, 3, "earth dark")
    return cv.t


def timberstack(names: list[str]) -> np.ndarray:
    """The tileset prop `p_timberstack` (16 x 16, solid, by the town's slip): landed timber stacked by the bank."""
    cv = Ink(names, 16, 16)
    _stack(cv, 1, 2)
    return cv.t


# ---------------------------------------------------------------- Action icons


def _outlined(cv: Ink, layers: list[tuple[np.ndarray, str]]) -> None:
    """Paint `layers` (mask, colour) over an ink outline grown 1 px round their union."""
    union = np.zeros_like(cv.t, dtype=bool)
    for m, _ in layers:
        union |= m
    cv.put(_grow(union) & ~union, "ink")
    for m, name in layers:
        cv.put(m, name)


def _mask(w: int, h: int, rects: list[tuple[int, int, int, int]]) -> np.ndarray:
    m = np.zeros((h, w), bool)
    for x, y, rw, rh in rects:
        m[y : y + rh, x : x + rw] = True
    return m


def icon_hook(names: list[str]) -> np.ndarray:
    cv = Ink(names, 16, 16)
    # a rope down from the top-left, over the hook's eye
    rope = _mask(16, 16, [(4, 1, 2, 2), (6, 2, 2, 2), (8, 3, 2, 1)])
    # the hook: an eye ring at the top, a 2 px shank, the bend and the point turned up with a barb
    eye = _mask(16, 16, [(8, 1, 4, 1), (8, 2, 1, 2), (11, 2, 1, 2), (8, 4, 4, 1)])
    eye_hole = _mask(16, 16, [(9, 2, 2, 2)])
    shank = _mask(16, 16, [(9, 5, 2, 6)])
    bend = _mask(16, 16, [(8, 11, 2, 2), (6, 12, 2, 2), (4, 11, 2, 2), (3, 8, 2, 3)])
    barb = _mask(16, 16, [(5, 8, 1, 2)])
    steel = (eye | shank | bend | barb) & ~eye_hole
    lit = _mask(16, 16, [(9, 5, 1, 6), (3, 8, 1, 3)]) & steel
    _outlined(cv, [(rope, "wood"), (steel, "stone lt")])
    cv.put(rope & _mask(16, 16, [(4, 2, 2, 1), (6, 3, 2, 1)]), "soil")
    cv.put(steel & ~lit, "stone")
    cv.put(lit, "ice white")
    cv.t[eye_hole] = -1
    return cv.t


def icon_home(names: list[str]) -> np.ndarray:
    cv = Ink(names, 16, 16)
    planks = _mask(16, 16, [(1, 10, 14, 5)])
    logm = _mask(16, 16, [(2, 3, 12, 6)])
    _outlined(cv, [(planks, "sand"), (logm, "soil")])
    # the slip's planks: two boards with an ink seam, lit tops
    cv.rect(1, 12, 14, 1, "ink")
    cv.rect(1, 13, 14, 2, "wood")
    cv.rect(1, 10, 14, 1, "ink")
    # the log resting on them: lit top, bark, a sand face with a soil heart on the east
    cv.rect(2, 3, 12, 2, "wood")
    cv.rect(2, 5, 12, 3, "soil")
    cv.rect(2, 8, 12, 1, "earth dark")
    cv.rect(9, 3, 5, 6, "sand")
    cv.rect(8, 3, 1, 6, "ink")
    cv.rect(10, 5, 2, 2, "soil")
    return cv.t


def icon_tug(names: list[str]) -> np.ndarray:
    cv = Ink(names, 16, 16)
    # a log's end (sand face) on the east, the rope taut from it to the west edge, a bold arrow pulling west above
    face = _mask(16, 16, [(11, 8, 4, 6), (10, 9, 6, 4)])
    rope = _mask(16, 16, [(1, 10, 9, 2)])
    arrow = _mask(16, 16, [(4, 3, 9, 2), (3, 2, 2, 4), (5, 1, 2, 2), (5, 5, 2, 2), (1, 3, 2, 2)])
    _outlined(cv, [(face, "sand"), (rope, "wood"), (arrow, "lamp")])
    cv.put(_mask(16, 16, [(12, 10, 2, 2)]), "soil")
    cv.put(rope & _mask(16, 16, [(1, 11, 9, 1)]), "soil")
    cv.put(arrow & _mask(16, 16, [(1, 4, 12, 1), (5, 5, 2, 2)]), "gold")
    return cv.t


def _rope_dot(names: list[str]) -> np.ndarray:
    """The rope, stamped every 1 px along its curve by the tow controller: top row wood, bottom row ink."""
    t = np.full((2, 2), names.index("wood"), dtype=np.int32)
    t[1] = names.index("ink")
    return t


def build(names: list[str]) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    """(world sprites, ui sprites)."""
    world = logs(names)

    class _P:  # towntiles draws through P.name
        @staticmethod
        def name(n: str) -> int:
            return names.index(n)

    world["tow_rock"] = towntiles.rockspur(_P)
    world["tow_slip"] = slip(names, True)
    world["tow_slip_s"] = slip(names, False)
    world["tow_rope_dot"] = _rope_dot(names)
    ui = {
        "tow_icon_hook": icon_hook(names),
        "tow_icon_home": icon_home(names),
        "tow_icon_tug": icon_tug(names),
    }
    return world, ui
