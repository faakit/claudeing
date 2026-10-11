"""Tool-use frames (art round 4): 32 x 32 (32 x 36 for the hoe and pickaxe facing down), the player's idle body centred at x 8..23 (as the round-3 poses).

Each frame: the idle body with its arms taken off, then back to front: far arm, the tool if it is behind the body,
torso and head (pixel-identical to the walking sprite), the tool if it is in front, the near arm. Arms are 2 px
strokes (sleeve, then skin) from the shoulder to the hand, each with its own ink ring. Handles are 1 px wood with an
ink ring; heads are small grids. Frame 0 winds up, 1 swings (a smear on the fast swings), 2 is the CONTACT frame
(the tool meets the tile: spawn the dust or splash on it), 3 follows through. Left is the mirror of right.

    player_tool_<tool>_<dir>_<0..3>    tool: hoe, can, scythe, pick, rod    dir: down, up, right, left
"""
from __future__ import annotations

import math

import numpy as np

from anim import SIDE_TOP, _n, blank, fix_edges, grid, layer, line_pts, stroke

TOOLS = ("hoe", "can", "scythe", "pick", "rod")
# Facing down, the hoe and pickaxe bite into the tile in front of the feet (review 14, R14-1): those sequences are
# 32 x 36, the feet still on row 31, the blade reaching 3-4 px below the baseline. Origin: (0.5, 32 / height).
TALL = {("hoe", "down"), ("pick", "down")}
CANVAS_H = 36
CONTACT_FRAME = 2
# The round-3 single pose keys, kept: each is now its tool's contact frame.
LEGACY_POSES = {
    "player_use_hoe": "player_tool_hoe_down_2",
    "player_use_can": "player_tool_can_right_2",
    "player_use_rod": "player_tool_rod_right_2",
}

# name: (rows, (dx, dy) of the grid's top-left from the anchor point). Fill only: the part outline adds the ink.
HEADS = {
    "hoe_down": ([".zz.", "zxxz", "zzzz"], (-2, 0)),  # front view: the blade faces the viewer, at the feet
    "hoe_left": (["xz", "zz", "zz", "Zz"], (-2, -1)),  # front view, raised: the blade hangs off the handle's end
    "hoe_up_back": (["zzx", "zZz", ".zz"], (0, -1)),  # side view, raised behind the head
    "hoe_fwd_down": (["zz", "xz", "zZ", "Zz"], (0, 0)),  # side view, contact: the blade in the ground
    "pick_down": (["zZ..Zz", ".zxxz.", "..ww.."], (-3, -1)),
    "pick_left": (["x.", "zz", "zw", "zz", "x."], (-1, -2)),
    "pick_up_back": (["xz....", ".zzwzz", "....zx"], (-2, -1)),
    "pick_fwd_down": (["x..", ".zz", ".wz", "zz.", "z.."], (-1, -1)),
    "scythe_side_back": (["xxxz", "...zz", "....z"], (-4, -1)),
    "scythe_side_fwd": (["z....", "zz...", ".zxxx"], (0, -2)),
    "scythe_front_r": (["zxxxx", "zz...", ".z..."], (0, -1)),
    "scythe_front_l": (["xxxxz", "...zz", "...z."], (-4, -1)),
}

# The side torso with the near arm taken off (rows 17..25); the head above comes from the idle frame.
SIDE_TORSO = [
    ".....KKEKKKK....",
    ".....KDDDK......",
    "....KWWWWK......",
    "....KWWWWWK.....",
    "....KWWWWWK.....",
    "....KWWWWWK.....",
    "....KWWWWWK.....",
    "....KEEEEEK.....",
    "....KDDDDDK.....",
]

FS_L, FS_R = (10, 20), (20, 20)  # front shoulders (top-left of the 2 px arm stroke)
SS_F, SS_N = (12, 20), (13, 20)  # side shoulders: far, near


def _arc(cx: float, cy: float, r: float, a0: float, a1: float) -> list[tuple[int, int]]:
    n = int(abs(a1 - a0) / 180 * math.pi * r) + 2
    pts: list[tuple[int, int]] = []
    for k in range(n):
        a = math.radians(a0 + (a1 - a0) * k / max(1, n - 1))
        p = (int(round(cx + r * math.cos(a))), int(round(cy - r * math.sin(a))))
        if not pts or pts[-1] != p:
            pts.append(p)
    return pts


def _p(**kw) -> dict:
    return kw


# Key poses (canvas pixels). hands = (far, near) for side views, (left, right) for front views.
POSES: dict[tuple[str, str], list[dict]] = {}
POSES[("hoe", "down")] = [
    _p(hands=((7, 9), (22, 9)), tool=[((3, 9), (28, 9))], head=("hoe_left", (3, 9)), front=False),
    _p(hands=((14, 18), (16, 18)), tool=[((16, 19), (16, 21))], head=("hoe_down", (16, 22)), front=True,
       smear=_arc(16, 11, 10, 150, 30)),
    _p(hands=((14, 21), (16, 21)), tool=[((16, 22), (16, 30))], head=("hoe_down", (16, 31)), front=True),
    _p(hands=((14, 22), (16, 22)), tool=[((16, 23), (16, 29))], head=("hoe_down", (16, 30)), front=True),
]
POSES[("pick", "down")] = [
    _p(hands=((7, 9), (22, 9)), tool=[((4, 9), (27, 9))], head=("pick_left", (3, 9)), front=False),
    _p(hands=((14, 18), (16, 18)), tool=[((16, 19), (16, 21))], head=("pick_down", (16, 23)), front=True,
       smear=_arc(16, 11, 10, 150, 30)),
    _p(hands=((14, 21), (16, 21)), tool=[((16, 22), (16, 30))], head=("pick_down", (16, 32)), front=True),
    _p(hands=((14, 22), (16, 22)), tool=[((16, 23), (16, 29))], head=("pick_down", (16, 31)), front=True),
]
POSES[("hoe", "right")] = [
    _p(hands=((10, 16), (11, 17)), tool=[((11, 17), (5, 3))], head=("hoe_up_back", (5, 2)), front=False),
    _p(hands=((18, 16), (19, 17)), tool=[((19, 17), (29, 14))], head=None, front=True,
       smear=_arc(19, 17, 11, 100, 20)),
    _p(hands=((19, 20), (20, 21)), tool=[((20, 21), (26, 27))], head=("hoe_fwd_down", (26, 28)), front=True),
    _p(hands=((18, 21), (19, 22)), tool=[((19, 22), (25, 27))], head=("hoe_fwd_down", (25, 28)), front=True),
]
POSES[("pick", "right")] = [
    _p(hands=((10, 16), (11, 17)), tool=[((11, 17), (5, 3))], head=("pick_up_back", (5, 2)), front=False),
    _p(hands=((18, 16), (19, 17)), tool=[((19, 17), (29, 14))], head=None, front=True,
       smear=_arc(19, 17, 11, 100, 20)),
    _p(hands=((19, 20), (20, 21)), tool=[((20, 21), (26, 27))], head=("pick_fwd_down", (26, 28)), front=True),
    _p(hands=((18, 21), (19, 22)), tool=[((19, 22), (25, 27))], head=("pick_fwd_down", (25, 28)), front=True),
]
POSES[("scythe", "right")] = [
    _p(hands=((10, 21), (11, 22)), tool=[((11, 22), (3, 18))], head=("scythe_side_back", (3, 18)), front=False),
    _p(hands=((15, 22), (16, 23)), tool=[((16, 23), (25, 25))], head=None, front=True,
       smear=_arc(16, 22, 10, 210, 300)),
    _p(hands=((18, 21), (19, 22)), tool=[((19, 22), (26, 26))], head=("scythe_side_fwd", (26, 27)), front=True),
    _p(hands=((19, 18), (20, 19)), tool=[((20, 19), (28, 14))], head=("scythe_front_r", (28, 14)), front=True),
]
POSES[("scythe", "down")] = [
    _p(hands=((21, 19), (22, 20)), tool=[((22, 20), (28, 14))], head=("scythe_front_r", (28, 14)), front=True),
    _p(hands=((17, 22), (18, 22)), tool=[((18, 23), (18, 26))], head=None, front=True,
       smear=_arc(16, 22, 11, -20, -110)),
    _p(hands=((12, 22), (13, 22)), tool=[((12, 23), (6, 27))], head=("scythe_front_l", (6, 27)), front=True),
    _p(hands=((10, 20), (11, 21)), tool=[((10, 21), (3, 16))], head=("scythe_front_l", (3, 16)), front=True),
]

# The watering can, side view (spout right): upright, tipped, pouring. Fill only (the part ring adds the ink).
CAN_UP = [".zzzz...", ".z..z...", "xxzzzZ..z", "xzzzzZ.z.", "xzzzzZz..", ".ZZZZZ..."]
CAN_TIP = ["..zz.....", ".z..z....", ".xzzzz...", "xxzzzzZ..", ".xzzzzZZ.", "..ZzzzZ.z", "...ZZZ..z"]
CAN_POUR = ["..zz......", ".z..zz....", ".xxzzzz...", "..xzzzzZ..", "...zzzzZZ.", "....ZZZZzz", ".......ZZz"]
# front view: the can held out to the right, the spout pointing down and left, in front of the feet
CAN_FRONT = ["..zzz.", ".z...z", "xzzzzZ", "xzzzzZ", "xzzzzZ", ".ZZZZ."]
CAN_FRONT_TIP = ["...zz..", "..z..z.", ".xzzzzZ", "xxzzzzZ", "zxzzzZ.", "z.ZZZ..", ]


def _drops(names, canvas, pts, col="S") -> None:
    """Water: 1 px drops or a 1 px stream on the sky tone, each with its own ink ring."""
    p = blank(32, CANVAS_H)
    for x, y in pts:
        if 0 <= y < CANVAS_H and 0 <= x < 32:
            p[y, x] = _n(names, col)
    layer(canvas, p)


POSES[("can", "right")] = [
    _p(hands=(None, (19, 20)), tool=[], grid=(CAN_UP, (18, 21)), front=True),
    _p(hands=(None, (20, 19)), tool=[], grid=(CAN_TIP, (19, 20)), front=True),
    _p(hands=(None, (20, 19)), tool=[], grid=(CAN_POUR, (19, 20)), front=True,
       water=[(29, 27), (29, 28), (30, 30), (28, 31)]),
    _p(hands=(None, (20, 19)), tool=[], grid=(CAN_POUR, (19, 20)), front=True,
       water=[(29, 27), (28, 29), (30, 29), (29, 31)]),
]
POSES[("can", "down")] = [
    _p(hands=((12, 22), (21, 22)), tool=[], grid=(CAN_FRONT, (19, 23)), front=True),
    _p(hands=((12, 22), (21, 22)), tool=[], grid=(CAN_FRONT_TIP, (18, 23)), front=True),
    _p(hands=((12, 22), (21, 22)), tool=[], grid=(CAN_FRONT_TIP, (18, 23)), front=True,
       water=[(18, 29), (17, 31), (19, 31)]),
    _p(hands=((12, 22), (21, 22)), tool=[], grid=(CAN_FRONT_TIP, (18, 23)), front=True,
       water=[(18, 29), (18, 31), (16, 30)]),
]
# The rod: wood, the line 1 px of ink (no ring: it is a line, not a body).
POSES[("rod", "right")] = [
    _p(hands=((11, 16), (12, 17)), tool=[((12, 17), (3, 2))], front=False),
    _p(hands=((17, 15), (18, 16)), tool=[((18, 16), (26, 2))], front=True, smear=_arc(18, 16, 15, 120, 55)),
    _p(hands=((19, 19), (20, 20)), tool=[((20, 20), (31, 11))], front=True, line=[(31, 11), (31, 12)]),
    _p(hands=((18, 20), (19, 21)), tool=[((19, 21), (30, 14))], front=True, line=[(31, 15), (31, 16), (31, 17)]),
]
POSES[("rod", "down")] = [
    _p(hands=((20, 15), (21, 16)), tool=[((21, 16), (27, 1))], front=False),
    _p(hands=((17, 18), (18, 19)), tool=[((18, 19), (19, 23))], front=True, smear=_arc(16, 12, 11, 60, 120)),
    _p(hands=((17, 21), (18, 21)), tool=[((18, 22), (21, 30))], front=True, line=[(21, 31)]),
    _p(hands=((17, 21), (18, 21)), tool=[((18, 22), (22, 29))], front=True, line=[(23, 30), (23, 31)]),
]
# Facing up (back view): the swing is mostly hidden by the body; the raised tool and the strike show above the head.
POSES[("hoe", "up")] = [
    _p(hands=((7, 9), (22, 9)), tool=[((3, 9), (28, 9))], head=("hoe_left", (3, 9)), front=True),
    _p(hands=((13, 17), (18, 17)), tool=[], front=False, smear=_arc(16, 11, 10, 150, 30)),
    _p(hands=((13, 18), (18, 18)), tool=[((16, 4), (16, 2))], head=("hoe_down", (16, 0)), front=False, behind_arms=True),
    _p(hands=((13, 19), (18, 19)), tool=[((16, 4), (16, 3))], head=("hoe_down", (16, 1)), front=False, behind_arms=True),
]
POSES[("pick", "up")] = [
    _p(hands=((7, 9), (22, 9)), tool=[((4, 9), (27, 9))], head=("pick_left", (3, 9)), front=True),
    _p(hands=((13, 17), (18, 17)), tool=[], front=False, smear=_arc(16, 11, 10, 150, 30)),
    _p(hands=((13, 18), (18, 18)), tool=[((16, 4), (16, 3))], head=("pick_down", (16, 1)), front=False, behind_arms=True),
    _p(hands=((13, 19), (18, 19)), tool=[((16, 4), (16, 3))], head=("pick_down", (16, 2)), front=False, behind_arms=True),
]


def _arm(names, canvas: np.ndarray, shoulder, hand, far: bool = False, sleeve: int = 3) -> None:
    """An arm: the short sleeve (3 px along the arm), then the bare forearm and hand."""
    pts = line_pts(*shoulder, *hand)
    p = blank(canvas.shape[1], canvas.shape[0])
    k = min(len(pts) - 1, sleeve)
    stroke(p, pts[k:], _n(names, "m" if far else "k"), 2)
    stroke(p, pts[:k], _n(names, "D" if far else "W"), 2)
    layer(canvas, p)


def _put(names, p: np.ndarray, rows: list[str], x0: int, y0: int) -> None:
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != "." and 0 <= y0 + j < p.shape[0] and 0 <= x0 + i < p.shape[1]:
                p[y0 + j, x0 + i] = _n(names, ch)


def _tool_part(names, pose: dict) -> np.ndarray:
    t = blank(32, CANVAS_H)
    for a, b in pose["tool"]:
        for x, y in line_pts(*a, *b):
            if 0 <= y < CANVAS_H and 0 <= x < 32:
                t[y, x] = _n(names, "w")
    if pose.get("head"):
        name, (ax, ay) = pose["head"]
        rows, (dx, dy) = HEADS[name]
        _put(names, t, rows, ax + dx, ay + dy)
    if pose.get("grid"):  # a whole drawn tool (the can), at its top-left
        rows, (x0, y0) = pose["grid"]
        _put(names, t, rows, x0, y0)
    return t


def _smear(names, canvas, pts) -> None:
    """A swing smear: a 1 px arc of pale steel along the head's path, with its own ink ring."""
    p = blank(32, CANVAS_H)
    for i, (x, y) in enumerate(pts):
        if 0 <= y < CANVAS_H and 0 <= x < 32:
            p[y, x] = _n(names, "I" if i % 3 else "x")
    layer(canvas, p)


def strip_arms_front(idle: np.ndarray) -> np.ndarray:
    f = idle.copy()
    f[20:26, 0:3] = -1
    f[20:26, 12:15] = -1
    fix_edges(f, 0, 16, 19, 27)
    return f


def side_body(names, idle: np.ndarray) -> np.ndarray:
    f = blank(16, 32)
    f[:SIDE_TOP] = idle[:SIDE_TOP]
    f[SIDE_TOP : SIDE_TOP + len(SIDE_TORSO)] = grid(names, SIDE_TORSO)
    f[26:] = idle[26:]
    return f


# The body moves with the swing (review 13): the wind-up leans 1 px back (up in the front and back views), the
# contact sinks 1 px (knees implied), the swing and the follow-through stand at rest. Head and torso move as one
# piece (same pixels, offset); the legs stay planted.
LEAN = {0: "back", 2: "down"}


def lean_body(body: np.ndarray, how: str | None, side: bool) -> tuple[np.ndarray, int, int]:
    """(body, dx, dy) of the shoulders after the lean."""
    from motion import shift_rows, squash_down, stretch_up

    if how == "down":
        return squash_down(body, 25), 0, 1
    if how == "back" and side:
        return shift_rows(body, 0, 26, -1), -1, 0
    if how == "back":
        return stretch_up(body, 25), 0, -1
    return body, 0, 0


def draw_pose(names, body: np.ndarray, pose: dict, side: bool, lean: str | None = None) -> np.ndarray:
    c = blank(32, CANVAS_H)
    far_h, near_h = pose["hands"]
    body, ox, oy = lean_body(body, lean, side)
    sf, sn = (SS_F[0] + ox, SS_F[1] + oy), (SS_N[0] + ox, SS_N[1] + oy)
    fl, fr = (FS_L[0] + ox, FS_L[1] + oy), (FS_R[0] + ox, FS_R[1] + oy)
    if side and far_h:
        _arm(names, c, sf, far_h, far=True)
    tool = _tool_part(names, pose)
    if pose.get("behind_arms"):  # back view: the arms reach forward, behind the body
        _arm(names, c, fl, far_h)
        _arm(names, c, fr, near_h)
    if not pose["front"]:
        layer(c, tool)
    bm = body >= 0
    c[:32, 8:24][bm] = body[bm]
    if pose.get("smear"):
        _smear(names, c, pose["smear"])
    if pose["front"]:
        layer(c, tool)
    if pose.get("water"):
        _drops(names, c, pose["water"])
    for x, y in pose.get("line", []):
        if 0 <= y < CANVAS_H and 0 <= x < 32:
            c[y, x] = 0
    if side:
        _arm(names, c, sn, near_h)
    elif not pose.get("behind_arms"):
        if far_h:
            _arm(names, c, fl, far_h)
        if near_h:
            _arm(names, c, fr, near_h)
    return c


def tool_frames(names: list[str], idle: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    out = {}
    bodies = {
        "down": strip_arms_front(idle["down"]),
        "up": strip_arms_front(idle["up"]),
        "right": side_body(names, idle["right"]),
    }
    for (tool, d), poses in POSES.items():
        for i, pose in enumerate(poses):
            f = draw_pose(names, bodies[d], pose, d == "right", pose.get("lean", LEAN.get(i)))
            f = f[: CANVAS_H if (tool, d) in TALL else 32].copy()
            out[f"player_tool_{tool}_{d}_{i}"] = f
            if d == "right":
                out[f"player_tool_{tool}_left_{i}"] = f[:, ::-1].copy()
    return out
