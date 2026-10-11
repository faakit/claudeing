"""Animation frames for smoothness (art round 4), built in code on the player's own idle frames.

Every frame starts from `player_idle_<dir>_0`, so the head is pixel-identical in every frame of a direction
(review R5-5: the old pose sheet had a head 2 px small). Moving parts are drawn as separate parts, each with its
own 1 px ink outline, composited back to front, so the joints never lose their ink and limbs keep their width.

Frame names (all new; the old keys stay, some now drawn here):
  player_walk_<dir>_0..7      8-frame walk: contact, down, passing, up, contact, down, passing, up
                              (0..3 kept their names; left is the mirror of right)
  player_tool_<tool>_<dir>_0..3   32 x 32 tool use: 0 wind-up, 1 swing, 2 contact, 3 follow-through
                              tools: hoe, can, scythe, pick, rod; dirs: down, up, right (left = flip right)
The rest of the round-4 frames (doors, crop sway, ripples, the harvest pop, idles) are in `motion.py`.
"""
from __future__ import annotations

import numpy as np

from drawn import CHARS

INK = 0


def _n(names: list[str], ch: str) -> int:
    return names.index(CHARS[ch])


def blank(w: int, h: int) -> np.ndarray:
    return np.full((h, w), -1, dtype=np.int32)


def paste(dst: np.ndarray, src: np.ndarray, x: int, y: int) -> None:
    """Opaque pixels of src over dst at (x, y), clipped."""
    h, w = src.shape
    for j in range(h):
        yy = y + j
        if not 0 <= yy < dst.shape[0]:
            continue
        for i in range(w):
            xx = x + i
            if 0 <= xx < dst.shape[1] and src[j, i] >= 0:
                dst[yy, xx] = src[j, i]


def ring(mask: np.ndarray) -> np.ndarray:
    """The 4-neighbour 1 px ring just outside a mask."""
    p = np.pad(mask, 1)
    grow = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return grow & ~mask


def layer(dst: np.ndarray, fill: np.ndarray, outline: bool = True) -> None:
    """Composite a fill-only part (no ink) over dst with its own outside ink ring."""
    m = fill >= 0
    if outline:
        dst[ring(m)] = INK
    dst[m] = fill[m]


def grid(names: list[str], rows: list[str]) -> np.ndarray:
    w = max(len(r) for r in rows)
    t = blank(w, len(rows))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in ". ":
                t[y, x] = _n(names, ch)
    return t


def line_pts(x0: float, y0: float, x1: float, y1: float) -> list[tuple[int, int]]:
    """Integer pixels of a line (DDA, one pixel per step on the long axis)."""
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    out = []
    for k in range(n):
        t = k / max(1, n - 1)
        p = (int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t)))
        if not out or out[-1] != p:
            out.append(p)
    return out


def stroke(canvas: np.ndarray, pts, col: int, width: int = 2) -> None:
    """A thick stroke: each line pixel stamped as a width x width square (top-left at the pixel)."""
    for x, y in pts:
        for dy in range(width):
            for dx in range(width):
                yy, xx = y + dy, x + dx
                if 0 <= yy < canvas.shape[0] and 0 <= xx < canvas.shape[1]:
                    canvas[yy, xx] = col


def fix_edges(img: np.ndarray, x0: int = 0, x1: int | None = None, y0: int = 0, y1: int | None = None) -> None:
    """Silhouette-edge pixels inside the box become ink (after cutting part of a sprite away)."""
    sub = img[y0:y1, x0:x1]
    m = img >= 0
    p = np.pad(m, 1)
    edge = m & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    e = edge[y0:y1, x0:x1]
    sub[e] = INK


# ---------------------------------------------------------------- the walk, front and back views

def _arm_len(img: np.ndarray, cols: range, top: int, bottom: int, d: int) -> None:
    """Lengthen (d > 0) or shorten (d < 0) by |d| px an arm hanging in `cols`, rows top..bottom (sleeve row `top`,
    bottom outline row `bottom`): the shoulder stays put and the hand moves by d. Lengthening repeats the sleeve
    row; shortening takes rows out of the forearm, so the sleeve stays."""
    xs = list(cols)
    strip = img[top : bottom + 1, xs[0] : xs[-1] + 1].copy()
    if d > 0:
        new = np.vstack([strip[:1]] * d + [strip])
    else:
        new = np.vstack([strip[:1], strip[1 - d :]])
    for j in range(strip.shape[0]):
        for i, x in enumerate(xs):
            if strip[j, i] >= 0:
                img[top + j, x] = -1
    for j in range(new.shape[0]):
        for i, x in enumerate(xs):
            if new[j, i] >= 0 and top + j < img.shape[0]:
                img[top + j, x] = new[j, i]


def _lift_leg(img: np.ndarray, cols: range, top: int, n: int) -> None:
    """Raise one leg (rows top..31 in `cols`) by n px: the knee bends, the foot leaves the baseline."""
    if n <= 0:
        return
    xs = slice(cols.start, cols.stop)
    leg = img[top:32, xs].copy()
    img[top:32, xs] = np.where(leg >= 0, -1, img[top:32, xs])
    region = img[top - n : 32 - n, xs]
    img[top - n : 32 - n, xs] = np.where(leg >= 0, leg, region)


# Front/back cycle: (body_dy, lift viewer-left leg, lift viewer-right leg, arm viewer-left, arm viewer-right).
# Arms: +n = swung forward n px (looks longer in front view), -n = swung back; a 2 px swing at contact (review 13). The body bobs 1 px down on the "down"
# frames only; the planted foot never leaves row 31.
FRONT_CYCLE = [
    (0, 0, 0, -2, +2),  # 0 contact: arms at full swing (2 px)
    (1, 0, 0, -1, +1),  # 1 down
    (0, 0, 2, 0, 0),  # 2 passing (right leg lifted), arms passing the hips
    (0, 0, 1, +1, -1),  # 3 up
    (0, 0, 0, +2, -2),  # 4 contact
    (1, 0, 0, +1, -1),  # 5 down
    (0, 2, 0, 0, 0),  # 6 passing (left leg lifted)
    (0, 1, 0, -1, +1),  # 7 up
]


def front_walk(idle: np.ndarray, back_view: bool) -> list[np.ndarray]:
    """Front (down) and back (up) views: arms lengthen or shorten by 1 px (swung toward or away from the camera),
    the lifted leg rises 1-2 px, and the body above the legs sinks 1 px on the down frames."""
    out = []
    leg_top = 27
    bottom = 24 if back_view else 25  # the arm's bottom outline row
    for dy, la, lb, aa, ab in FRONT_CYCLE:
        f = idle.copy()
        if aa:
            _arm_len(f, range(0, 3), 20, bottom, aa)
        if ab:
            _arm_len(f, range(12, 15), 20, bottom, ab)
        fix_edges(f, 0, 4, 18, 28)
        fix_edges(f, 11, 16, 18, 28)
        upper = f.copy()
        upper[leg_top:] = -1
        legs = f.copy()
        legs[:leg_top] = -1
        g = blank(16, 32)
        if dy:
            upper = np.vstack([np.full((dy, 16), -1, dtype=np.int32), upper[:-dy]])
        paste(g, legs, 0, 0)
        paste(g, upper, 0, 0)
        _lift_leg(g, range(2, 8), leg_top, la)
        _lift_leg(g, range(8, 14), leg_top, lb)
        out.append(g)
    return out


# ---------------------------------------------------------------- the walk, side view (facing right)

# Rows 17..31 of each side frame, drawn by hand on the idle frame's torso (x4..10). The head (rows 0..16) is the
# idle frame's, untouched; on the down frames (1, 5) the whole body above the hips sinks 1 px, the feet stay on
# row 31. The near arm counter-swings the near leg. Stride: the feet are 7 px apart at contact.
SIDE_FRAMES = [
    [  # 0 contact: near foot forward (heel down), far foot back on its toe; near arm back
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "...KWWWWWWK.....",
        "..KWWKWWWWK.....",
        "..KWmKWWWWK.....",
        "..KkkKWWWWK.....",
        "..KkkKEEEEK.....",
        "...KKDDDDDK.....",
        "....KNNKDDDK....",
        "...KNNK.KDDDK...",
        "..KEEK...KoooK..",
        "..KEEK...KooodK.",
        ".KEEEK...KoooKK.",
        ".KKKK....KKKKK..",
    ],
    [  # 1 down: weight on the near foot, body 1 px lower (the rows above shift at build time)
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "...KWWWWWWK.....",
        "...KWKWWWWK.....",
        "..KWmKWWWWK.....",
        "..KkkKWWWWK.....",
        "..KkkKEEEEK.....",
        "...KKDDDDDK.....",
        "...KNNKDDDK.....",
        "..KEENKKDDK.....",
        "..KEEEK.KoooK...",
        "...KEEK.KooodK..",
        "....KK..KKKKKK..",
        "................",
    ],
    [  # 2 passing: the far foot swings through, lifted; near arm hanging
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "....KWWWWWK.....",
        "....KWWKWWK.....",
        "....KmmKWWK.....",
        "....KkkKWWK.....",
        "....KkkkKEK.....",
        "....KkkkKDK.....",
        ".....KKKDDK.....",
        ".....KNDDDK.....",
        ".....KEEKoK.....",
        ".....KEEoooK....",
        ".....KKKooodK...",
        ".......KKKKKK...",
    ],
    [  # 3 up: pushing off the near toe, the far foot reaching forward; near arm forward
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "....KWWWWWK.....",
        "....KWWWKWK.....",
        "....KWWKmmKK....",
        "....KWWKkkkK....",
        "....KEEKkkkK....",
        "....KDDDKKKK....",
        "....KDDDNNK.....",
        "...KDDKKNEEK....",
        "...KoooKKEEEK...",
        "...KooodK.KK....",
        "..KoooKK........",
        "..KKKKK.........",
    ],
    [  # 4 contact: far foot forward (heel down), near foot back on its toe; near arm forward
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "....KWWWWWK.....",
        "....KWWWWKKK....",
        "....KWWWKmmK....",
        "....KWWWKkkkK...",
        "....KEEEKkkkK...",
        "....KDDDDKKK....",
        "....KDDDNNNK....",
        "...KDDDK.KNNK...",
        "..KoooK...KEEK..",
        "..KooodK..KEEEK.",
        ".KoooKK...KEEKK.",
        ".KKKKK....KKKK..",
    ],
    [  # 5 down: weight on the far foot
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "....KWWWWWK.....",
        "....KWWWKWK.....",
        "....KWWKmmK.....",
        "....KWWKkkkK....",
        "....KEEKkkkK....",
        "....KDDDKKK.....",
        "....KDDDNNK.....",
        "...KoooKKEEK....",
        "...KooodKEEEK...",
        "..KoooKKKEEEK...",
        "..KKKKK.KKKKK...",
        "................",
    ],
    [  # 6 passing: the near foot swings through, lifted; near arm hanging
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "....KWWWWWK.....",
        "....KWWKWWK.....",
        "....KmmKWWK.....",
        "....KkkKWWK.....",
        "....KkkkKEK.....",
        "....KkkkKDK.....",
        ".....KKKDDK.....",
        ".....KDDDDK.....",
        ".....KoooNK.....",
        ".....KooodEK....",
        ".....KKKKEEEK...",
        "........KKKKK...",
    ],
    [  # 7 up: pushing off the far toe, the near foot reaching forward; near arm back
        ".....KKEKKKK....",
        ".....KDDDK......",
        "....KWWWWK......",
        "...KWWWWWWK.....",
        "...KWKWWWWK.....",
        "..KWmKWWWWK.....",
        "..KkkKWWWWK.....",
        "..KkkKEEEEK.....",
        "...KKDDDDDK.....",
        "....KNKDDDK.....",
        "...KNNKDDDDK....",
        "...KEEKKoooK....",
        "...KEEEKooodK...",
        "..KEEKK.KKKK....",
        "..KKKK..........",
    ],
]
SIDE_TOP = 17
SIDE_DY = [0, 1, 0, 0, 0, 1, 0, 0]


def side_walk(names: list[str], idle: np.ndarray) -> list[np.ndarray]:
    out = []
    for rows, dy in zip(SIDE_FRAMES, SIDE_DY):
        g = grid(names, rows)
        f = blank(16, 32)
        f[:SIDE_TOP] = idle[:SIDE_TOP]
        f[SIDE_TOP:] = g
        if dy:  # down frames are drawn with bent legs one row short: the whole figure sinks onto row 31
            f = np.vstack([np.full((dy, 16), -1, dtype=np.int32), f[:-dy]])
        out.append(f)
    return out


def walk_frames(names: list[str], idle: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    out: dict[str, np.ndarray] = {}
    for d, frames in (
        ("down", front_walk(idle["down"], False)),
        ("up", front_walk(idle["up"], True)),
        ("right", side_walk(names, idle["right"])),
    ):
        for i, f in enumerate(frames):
            out[f"player_walk_{d}_{i}"] = f
            if d == "right":
                out[f"player_walk_left_{i}"] = f[:, ::-1].copy()
    return out
