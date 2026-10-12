"""Action frames drawn in code (art round 5, review 18): pet, reel and place, on the round-4 tool machinery.

Same canvas as the Flow action frames (flowanim.py): 32 x 44, the body at x 8..23, the feet on row 39, contact on
frame 2. Built from the idle body with toolanim's parts (arms with their own ink, the rod), so the head is the idle
head pixel for pixel.
  pet:   0 crouch, 1 reach low in front, 2 pat (contact: the hand down), 3 hand up, 4 stand (down and right; from
         behind only the crouch shows)
  reel:  0 waiting (rod held out, line down), 1 the bite (tip dips), 2 pull (contact: rod raised, bent, line taut)
  place: 0 holding at the chest, 1 bending, 2 setting down (contact), 3 hands lifting away. The held object is not
         drawn here: the game draws the item's icon at PLACE_ANCHORS (its centre, in frame pixels) per frame.
"""
from __future__ import annotations

import numpy as np

import toolanim as ta
from anim import blank, line_pts
from motion import squash_down

PAD_TOP = 8  # toolanim frames are 32 x 36 with the feet on row 31: 8 rows on top make the 44-row canvas


def crouch(body: np.ndarray, n: int) -> tuple[np.ndarray, int]:
    """Knees bent n px: head and torso sink as one piece (the legs shorten), the feet stay."""
    for _ in range(n):
        body = squash_down(body, 25)
    return body, n


def _p(**kw) -> dict:
    kw.setdefault("tool", [])
    kw.setdefault("front", True)
    return kw


def _shift_shoulders(dy: int):
    """Context manager-ish helper: move toolanim's shoulder anchors down by dy while drawing a crouched pose."""
    saved = (ta.FS_L, ta.FS_R, ta.SS_F, ta.SS_N)
    ta.FS_L, ta.FS_R = (saved[0][0], saved[0][1] + dy), (saved[1][0], saved[1][1] + dy)
    ta.SS_F, ta.SS_N = (saved[2][0], saved[2][1] + dy), (saved[3][0], saved[3][1] + dy)
    return saved


def _restore(saved) -> None:
    ta.FS_L, ta.FS_R, ta.SS_F, ta.SS_N = saved


def posed(names, body, pose, side, sink):
    saved = _shift_shoulders(sink)
    try:
        b, _ = crouch(body, sink)
        c = ta.draw_pose(names, b, pose, side, None)
    finally:
        _restore(saved)
    out = blank(32, 44)
    out[PAD_TOP : PAD_TOP + c.shape[0]] = c
    return out


# ---------------------------------------------------------------- the poses (toolanim canvas: 32 x 36, feet row 31)

PET = {
    "down": [  # (pose, sink)
        (_p(hands=((11, 24), (21, 24))), 2),
        (_p(hands=((11, 24), (21, 28))), 3),
        (_p(hands=((11, 24), (21, 30))), 3),
        (_p(hands=((11, 24), (21, 28))), 3),
        "idle",
    ],
    "right": [
        (_p(hands=((14, 24), (15, 25))), 2),
        (_p(hands=((19, 27), (21, 27))), 3),
        (_p(hands=((20, 29), (22, 30))), 3),
        (_p(hands=((19, 27), (21, 28))), 3),
        "idle",
    ],
    "up": [  # from behind the reaching hand is hidden: the crouch carries it
        (_p(hands=((12, 22), (19, 22)), behind_arms=True, front=False), 2),
        (_p(hands=((12, 24), (19, 24)), behind_arms=True, front=False), 3),
        (_p(hands=((12, 25), (19, 25)), behind_arms=True, front=False), 3),
        (_p(hands=((12, 24), (19, 24)), behind_arms=True, front=False), 3),
        "idle",
    ],
}

REEL = {
    "right": [
        (_p(hands=((18, 20), (19, 21)), tool=[((19, 21), (30, 14))], line=[(31, 15), (31, 16), (31, 17), (31, 18)]), 0),
        (_p(hands=((18, 20), (19, 21)), tool=[((19, 21), (30, 20))], line=[(31, 21), (31, 22), (31, 23)]), 0),
        # R19-1: the rod rises in front of the body, clear of the face (forward first, the bend above the head)
        (_p(hands=((18, 18), (19, 19)), tool=[((19, 19), (27, 9)), ((27, 9), (30, 3))],
            line=[(31, 4), (31, 13)]), 0),
    ],
    "down": [
        (_p(hands=((17, 21), (18, 21)), tool=[((18, 22), (22, 29))], line=[(23, 30), (23, 31)]), 0),
        (_p(hands=((17, 22), (18, 22)), tool=[((18, 23), (23, 31))], line=[]), 0),
        (_p(hands=((19, 15), (20, 16)), tool=[((20, 16), (24, 8)), ((24, 8), (27, 4))],
            line=[(28, 5), (28, 7), (27, 9)]), 0),
    ],
    "up": [  # from behind: the rod rises above the head, the hands are hidden
        (_p(hands=((13, 18), (18, 18)), behind_arms=True, front=False, tool=[((21, 15), (27, 3))], line=[(28, 4), (28, 9)]), 0),
        (_p(hands=((13, 19), (18, 19)), behind_arms=True, front=False, tool=[((21, 15), (28, 8))], line=[(29, 9), (29, 12)]), 0),
        (_p(hands=((13, 17), (18, 17)), behind_arms=True, front=False, tool=[((21, 13), (24, 4)), ((24, 4), (28, 1))],
            line=[(29, 2), (30, 6), (30, 9)]), 0),
    ],
}

PLACE = {
    "down": [
        (_p(hands=((14, 21), (17, 21))), 0),
        (_p(hands=((14, 25), (17, 25))), 1),
        (_p(hands=((14, 29), (17, 29))), 3),
        (_p(hands=((11, 26), (20, 26))), 1),
    ],
    "right": [
        (_p(hands=((18, 21), (19, 21))), 0),
        (_p(hands=((20, 25), (21, 25))), 1),
        (_p(hands=((22, 29), (23, 29))), 3),
        (_p(hands=((17, 25), (18, 25))), 1),
    ],
    "up": [
        (_p(hands=((13, 20), (18, 20)), behind_arms=True, front=False), 0),
        (_p(hands=((13, 22), (18, 22)), behind_arms=True, front=False), 1),
        (_p(hands=((13, 24), (18, 24)), behind_arms=True, front=False), 3),
        (_p(hands=((13, 22), (18, 22)), behind_arms=True, front=False), 1),
    ],
}
# The two facings Flow never drew (art round dry-year-2): plant from the side, harvest from behind. Frame 0 is the
# idle (as Flow's plant and harvest), the last is standing again (plant) or holding the crop up (harvest).
PLANT_RIGHT = [
    "idle",
    (_p(hands=((18, 26), (20, 27))), 2),
    (_p(hands=((21, 29), (22, 30))), 3),  # contact: the seed pressed in
    (_p(hands=((19, 28), (21, 29))), 2),
    "idle",
]
HARVEST_UP = [
    "idle",
    (_p(hands=((12, 24), (19, 24)), behind_arms=True, front=False), 2),
    (_p(hands=((12, 26), (19, 26)), behind_arms=True, front=False), 4),  # contact: the pull
    (_p(hands=((12, 21), (19, 19)), behind_arms=True, front=False), 1),
    "idle",
]
SEED_AT = (23, 38)  # the seed's soil fleck on plant right's contact frame (frame px, 2 x 2)

# where the game draws the held item's icon (its centre, in the 32 x 44 frame's pixels) per frame; None: hidden
PLACE_ANCHORS = {
    "down": [(16, 28), (16, 33), (16, 38), None],
    "right": [(23, 28), (25, 33), (27, 38), None],
    "up": [None, None, None, None],
}


def _line(pose: dict) -> dict:
    """The fishing line as a continuous 1 px ink line through its points (toolanim draws only the points)."""
    pts = pose.get("line") or []
    if len(pts) < 2:
        return pose
    full = []
    for a, b in zip(pts, pts[1:]):
        full += line_pts(*a, *b)
    return {**pose, "line": full}


def idle_frame(idle: np.ndarray) -> np.ndarray:
    out = blank(32, 44)
    out[PAD_TOP : PAD_TOP + 32, 8:24] = idle
    return out


def _sprig(flow: dict[str, np.ndarray] | None) -> np.ndarray | None:
    """The crop held up in Flow's harvest-down last frame: its pixels right of the body (x >= 24), as a patch."""
    src = (flow or {}).get("player_act_harvest_down_4")
    if src is None:
        return None
    patch = np.full_like(src, -1)
    patch[:, 24:] = src[:, 24:]
    return patch if (patch >= 0).any() else None


def build(names: list[str], idle: dict[str, np.ndarray], flow: dict | None = None) -> dict[str, np.ndarray]:
    bodies = {
        "down": ta.strip_arms_front(idle["down"]),
        "up": ta.strip_arms_front(idle["up"]),
        "right": ta.side_body(names, idle["right"]),
    }
    out = {}
    tables = (("pet", PET), ("reel", REEL), ("place", PLACE), ("plant", {"right": PLANT_RIGHT}),
              ("harvest", {"up": HARVEST_UP}))
    for anim, table in tables:
        for d, poses in table.items():
            for i, entry in enumerate(poses):
                if entry == "idle":  # standing again: the idle frame itself
                    out[f"player_act_{anim}_{d}_{i}"] = idle_frame(idle[d])
                    continue
                pose, sink = entry
                out[f"player_act_{anim}_{d}_{i}"] = posed(names, bodies[d], _line(pose), d == "right", sink)
    # plant right: a soil fleck where the seed goes in (contact); harvest up: the crop held up by the right shoulder
    c = out["player_act_plant_right_2"]
    x, y = SEED_AT
    c[y : y + 2, x : x + 2] = names.index("earth dark")
    sprig = _sprig(flow)
    if sprig is not None:
        for i in (3, 4):
            k = f"player_act_harvest_up_{i}"
            f = out[k].copy() if i == 3 else idle_frame(idle["up"])
            dy = 3 if i == 3 else 0  # still rising on frame 3
            sp = np.roll(np.roll(sprig, dy, axis=0), -3, axis=1)  # held at the shoulder, not beside it
            behind = (sp >= 0) & (f < 0)  # the crop goes behind the farmer (the head stays the idle head)
            f[behind] = sp[behind]
            out[k] = f
    return out
