"""Proportions round (owner: "some things in the city feel out of proportion"): pieces drawn in code to the scale
rule in DECISIONS.md ("Proportions round 2: the scale rule"). The character is 32 px (26-30 px opaque).

  f_ddoor_<l|c|r>_<top|low>_slate  the store's one double door over its three shopdoor cells (48 x 32, two wall rows):
                                   30 px wide, a 28 px frame on a 2 px step, two glazed leaves, gold pulls by the
                                   meeting stiles, and a hanging shop sign on the wall west of it. Replaces three
                                   single doors (owner: "the town store has 3 doors").
  t_beams_top2 / _top / _base      a mine roof support (16 x 48): one squared post under a cap beam with two braces and
                                   a hanging lantern, 42 px tall (was a 16 x 18 frame no one could stand under).
  portal_<l|c|r>, portal_post_<l|r>, portal_base_<l|r>
                                   the mine exit's timber portal: posts hugging the 2-tile passage and a lintel beam
                                   whose underside clears the farmer by 4 px (34 px clear, was 18).
  cave_l / cave_r                  the woods' mine mouth: timber jambs in the rock and a dark opening the full height of
                                   the map's top row, so it reads as running on above the edge (was a 12 px arch).
  p_timberstack                    landed timber with logs the length of a towed short log (16 px, was 12).

2 px features (bar the 1 px ink outline), palette indices only, no alpha.
"""
from __future__ import annotations

import numpy as np

T = 16


class Canvas:
    def __init__(self, names: list[str], w: int, h: int, base: np.ndarray | None = None):
        self.names = names
        self.t = base.copy() if base is not None else np.full((h, w), -1, dtype=np.int32)

    def c(self, name: str) -> int:
        return self.names.index(name)

    def rect(self, x: int, y: int, w: int, h: int, name: str) -> None:
        H, W = self.t.shape
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if x1 > x0 and y1 > y0:
            self.t[y0:y1, x0:x1] = self.c(name)

    def box(self, x: int, y: int, w: int, h: int, fill: str) -> None:
        """A filled rect inside a 1 px ink outline (the outline included in w x h)."""
        self.rect(x, y, w, h, "ink")
        self.rect(x + 1, y + 1, w - 2, h - 2, fill)


# ---------------------------------------------------------------- the store's double door


def shop_double_door(names: list[str], wall: np.ndarray) -> dict[str, np.ndarray]:
    """Three cells wide, two rows tall. `wall` is the shop wall tile (the ground row's base art)."""
    W = 48
    lowbase = np.tile(wall, (1, 3))
    cv = Canvas(names, W, 32)
    cv.t[16:] = lowbase
    x0, x1 = 9, 38  # the frame's outer columns (30 px)
    top = 2  # the frame's top row: 28 px of frame (2..29) on a 2 px step (30..31)
    # frame and lintel header
    cv.rect(x0, top, x1 - x0 + 1, 28, "ink")
    cv.rect(x0 + 1, top + 1, x1 - x0 - 1, 2, "wood")  # the header, lit
    cv.rect(x0 + 1, top + 3, x1 - x0 - 1, 1, "earth dark")
    cv.rect(x0 + 1, top + 4, 1, 23, "earth dark")  # jambs
    cv.rect(x1 - 1, top + 4, 1, 23, "earth dark")
    # two leaves, 12 px each, with a 2 px meeting stile between them
    for lx in (11, 25):
        cv.rect(lx, top + 4, 12, 23, "wood")
        # vertical boards: 2 px soil grooves on a 4 px pitch below the glass
        for gx in (lx + 3, lx + 7):
            cv.rect(gx, top + 16, 2, 10, "soil")
        cv.rect(lx, top + 26, 12, 1, "soil")  # the bottom rail's shade
        # the glazing: a 8 x 8 pane in a 1 px ink bead, sky with a 2 px lit corner
        cv.rect(lx + 2, top + 6, 8, 8, "ink")
        cv.rect(lx + 3, top + 7, 6, 6, "dusk blue")
        cv.rect(lx + 3, top + 7, 2, 2, "sky")
        cv.rect(lx + 3, top + 11, 6, 2, "night navy")
    cv.rect(23, top + 4, 2, 23, "ink")  # the meeting stiles
    # gold pulls either side of the meeting stiles
    cv.rect(20, top + 17, 2, 3, "gold")
    cv.rect(27, top + 17, 2, 3, "gold")
    # the step: stone, one row lit, across the frame and 1 px past it
    cv.rect(x0 - 1, 30, x1 - x0 + 3, 2, "ink")
    cv.rect(x0, 30, x1 - x0 + 1, 1, "stone lt")
    cv.rect(x0, 31, x1 - x0 + 1, 1, "stone")
    # the shop sign west of the door: a 2 px iron bracket and a hanging board with a gold coin on it
    cv.rect(1, 6, 7, 2, "ink")
    cv.rect(2, 8, 2, 2, "ink")  # the board's chains
    cv.rect(6, 8, 2, 2, "ink")
    cv.box(1, 10, 7, 8, "wood")
    cv.rect(2, 16, 5, 1, "soil")
    cv.rect(3, 12, 3, 3, "gold")
    cv.rect(4, 13, 1, 1, "orange")
    out = {}
    for i, col in enumerate("lcr"):
        tile = cv.t[:, i * T : (i + 1) * T]
        out[f"f_ddoor_{col}_top_slate"] = tile[:T].copy()
        out[f"f_ddoor_{col}_low_slate"] = tile[T:].copy()
    return out


# ---------------------------------------------------------------- the mine


def mine_support(names: list[str]) -> np.ndarray:
    """16 x 48: a squared post (4 px), a cap beam across the tile, two braces and a hanging lantern."""
    cv = Canvas(names, T, 48)
    # the cap beam, 6 px with its outline
    cv.box(0, 6, 16, 6, "wood")
    cv.rect(1, 9, 14, 2, "soil")
    # the post: ink, 2 px lit, 1 px shade, ink; footed on a stone pad
    cv.rect(5, 12, 6, 33, "ink")
    cv.rect(6, 12, 2, 33, "wood")
    cv.rect(8, 12, 2, 33, "soil")
    for y in (20, 30):  # adze marks
        cv.rect(8, y, 2, 2, "earth dark")
    # braces: 2 px stair-stepped struts from the cap to the post
    for i in range(4):
        cv.rect(1 + i, 12 + i, 2, 2, "soil")
        cv.rect(13 - i, 12 + i, 2, 2, "soil")
    # the lantern on a 2 px hook under the cap, east of the post
    cv.rect(12, 12, 2, 2, "ink")
    cv.box(11, 14, 4, 6, "lamp")
    cv.rect(12, 18, 2, 1, "orange")
    # the stone pad
    cv.box(3, 44, 10, 4, "stone")
    cv.rect(4, 45, 8, 1, "stone lt")
    return cv.t


def mine_portal(names: list[str]) -> dict[str, np.ndarray]:
    """The exit portal around a 2-tile passage: 4 tiles across (post, opening, opening, post), 3 rows tall
    (lintel row, post row, base row). The posts hug the passage, so the opening is the full 32 px."""
    cv = Canvas(names, 64, 48)
    # the lintel: 6 px beam (rows 8..13) from the west post's outer face to the east post's
    cv.box(8, 8, 48, 6, "wood")
    cv.rect(9, 11, 46, 2, "soil")
    for x in range(14, 52, 8):
        cv.rect(x, 10, 2, 1, "earth dark")
    # the posts: 6 px each, from under the lintel to the floor, on stone pads
    for px_ in (10, 48):
        cv.rect(px_, 14, 6, 30, "ink")
        cv.rect(px_ + 1, 14, 2, 30, "wood")
        cv.rect(px_ + 3, 14, 2, 30, "soil")
        cv.box(px_ - 1, 44, 8, 4, "stone")
        cv.rect(px_, 45, 6, 1, "stone lt")
    # knee braces into the lintel's underside (2 px, two steps)
    for i in range(2):
        cv.rect(16 + i * 2, 14 + i * 2, 2, 2, "soil")
        cv.rect(46 - i * 2, 14 + i * 2, 2, 2, "soil")
    t = cv.t
    out = {
        "portal_l": t[0:T, 0:T].copy(),
        "portal_c": t[0:T, T : 2 * T].copy(),
        "portal_r": t[0:T, 3 * T : 4 * T].copy(),
        "portal_post_l": t[T : 2 * T, 0:T].copy(),
        "portal_post_r": t[T : 2 * T, 3 * T : 4 * T].copy(),
        "portal_base_l": t[2 * T :, 0:T].copy(),
        "portal_base_r": t[2 * T :, 3 * T : 4 * T].copy(),
    }
    out["portal_c2"] = t[0:T, 2 * T : 3 * T].copy()  # the east half of the opening (its own adze marks)
    return out


def cave_mouth(names: list[str], side: str) -> np.ndarray:
    """The woods' mine mouth over its two path tiles on the map's top row: rock at the outer edges, a squared timber
    jamb either side, and between them the dark of the adit the full height of the row (it runs on above the map's
    edge, so the opening never reads shorter than the farmer)."""
    cv = Canvas(names, 32, T)
    cv.rect(0, 0, 32, T, "ink")
    # rock either side of the jambs, with a lit edge
    for x0 in (0, 30):
        for y in range(T):
            for x in range(x0, x0 + 2):
                cv.t[y, x] = cv.c("stone" if (x * 3 + y * 5) % 7 else "stone dark")
    # the jambs: 4 px squared posts (ink, 2 px lit, ink) with a stone pad
    for jx in (2, 26):
        cv.rect(jx, 0, 4, 14, "ink")
        cv.rect(jx + 1, 0, 2, 14, "wood" if jx == 2 else "soil")
        cv.rect(jx, 14, 4, 2, "stone")
    # inside: the dark, with the floor's last light in 2 px plum dither at the threshold
    for y in range(12, T):
        for x in range(6, 26):
            if (x + y) % 2 == 0:
                cv.t[y, x] = cv.c("plum shadow")
    cv.rect(6, 0, 20, 2, "plum shadow")  # a beam in shadow just inside the mouth
    t = cv.t
    return t[:, :T].copy() if side == "l" else t[:, T:].copy()


# ---------------------------------------------------------------- the slip's timber


def _landed_log(cv: Canvas, x: int, y: int, length: int) -> None:
    """A landed log, east-west, top-left (x, y), 6 px tall: the tow log's colours and a sand face at each end."""
    cv.rect(x + 1, y, length - 2, 1, "ink")
    cv.rect(x + 1, y + 5, length - 2, 1, "ink")
    cv.rect(x, y + 1, 1, 4, "ink")
    cv.rect(x + length - 1, y + 1, 1, 4, "ink")
    cv.rect(x + 1, y + 1, length - 2, 2, "wood")
    cv.rect(x + 1, y + 3, length - 2, 2, "soil")
    for fx, ix in ((x + 1, x + 3), (x + length - 3, x + length - 4)):
        cv.rect(fx, y + 1, 2, 4, "sand")
        cv.rect(ix, y + 1, 1, 4, "ink")


def timberstack(names: list[str]) -> np.ndarray:
    """16 x 16: two short logs side by side on the ground (front and back) and one resting on them, each 16 px like a
    towed short log, a 2 px plum shadow under the pile."""
    cv = Canvas(names, T, T)
    cv.rect(1, 14, 14, 2, "plum shadow")
    _landed_log(cv, 0, 4, 16)  # the back log
    _landed_log(cv, 0, 9, 16)  # the front log, overlapping the back one's lower half
    cv.rect(1, 9, 14, 1, "ink")
    _landed_log(cv, 0, 1, 16)  # the top log, resting in the groove
    cv.rect(1, 6, 14, 1, "ink")
    return cv.t


def build(names: list[str], base: dict[str, np.ndarray], out: dict[str, np.ndarray]) -> None:
    out.update(shop_double_door(names, base["shopwall"]))
    sup = mine_support(names)
    out["t_beams_top2"], out["t_beams_top"], out["t_beams_base"] = sup[:T], sup[T : 2 * T], sup[2 * T :]
    out.update(mine_portal(names))
    out["cave_l"] = cave_mouth(names, "l")
    out["cave_r"] = cave_mouth(names, "r")
    out["p_timberstack"] = timberstack(names)
