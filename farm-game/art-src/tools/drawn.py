"""Sprites drawn by hand in code, pixel by pixel, as character grids over the palette (art round 3).

Used where a hand-drawn sprite reads better at 1x than the Flow version (Flow sheet items8 supplies the tulip
bulbs and bloom, four dishes, fish stew, Old Whiskers and the Ice Pike via sprites.json): the tulip growth, pumpkin
pie, the Glimmer Trout and Sun Carp, the scarecrow, the Founder's Statue (one frame per level), the onboarding coach
marks. The walk and tool-use frames (round 4) are in anim.py and toolanim.py.

Every character is one palette slot by name (see CHARS); `.` is transparent. Outlines are drawn explicitly in ink
(`K`), so thin stems and whiskers survive. `build(P, groups, pal, chars)` adds RGBA sprites to the atlas groups.
"""
from __future__ import annotations

import numpy as np

import pixelart as px

CHARS = {
    "K": "ink", "P": "plum shadow", "N": "night navy", "D": "dusk blue", "W": "water", "S": "sky",
    "I": "ice white", "T": "teal shade", "G": "leaf dark", "g": "leaf mid", "v": "grass", "n": "new leaf",
    "E": "earth dark", "o": "soil", "w": "wood", "s": "sand", "p": "parchment", "k": "skin light",
    "m": "skin mid", "d": "skin deep", "V": "wine", "R": "red", "q": "rose", "O": "orange", "Y": "gold",
    "L": "lamp", "U": "plum", "u": "lilac", "Z": "stone dark", "z": "stone", "x": "stone lt", "t": "taupe",
}


def grid(names: list[str], rows: list[str], w: int | None = None, h: int | None = None) -> np.ndarray:
    """Rows of characters -> palette index image, padded (bottom-centred) to w x h when given."""
    width = max(len(r) for r in rows)
    t = np.full((len(rows), width), -1, dtype=np.int32)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                t[y, x] = names.index(CHARS[ch])
    if w or h:
        t = px.place(t, w or width, h or len(rows))
    return t


# ---------------------------------------------------------------- tulips

CROP_TULIP = {
    1: [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        ".......KK.......",
        "......KnnK......",
        "......KngK......",
        ".....KKgGKK.....",
        "......KKKK......",
    ],
    2: [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "....KK....KK....",
        "...KnnK..KnnK...",
        "...KgnnKKnngK...",
        "....KgnnKngK....",
        "....KGgnngGK....",
        ".....KGggGK.....",
        ".....KKGGKK.....",
        "......KKKK......",
    ],
    3: [
        "................",
        "................",
        "................",
        "................",
        "................",
        ".......KK.......",
        "......KnnK......",
        "......KngK......",
        "...KK.KgGK.KK...",
        "..KnnKKgGKKnnK..",
        "..KgnnKgGKnngK..",
        "...KgnnggnngK...",
        "...KGgnnnngGK...",
        "....KGggggGK....",
        "....KKGGGGKK....",
        ".....KKKKKK.....",
    ],
    4: [
        "................",
        "................",
        "................",
        "................",
        "......KKK.......",
        ".....KqqVK......",
        ".....KkqVK......",
        ".....KqqVK......",
        "......KgK.......",
        "...KK.KgK.KK....",
        "..KnnKKgKKnnK...",
        "..KgnnKgKnngK...",
        "...KgnngnngK....",
        "...KGgnnngGK....",
        "....KKGGGKK.....",
        ".....KKKKK......",
    ],
    5: [
        "................",
        "................",
        "....K.K.K.......",
        "...KqKqKqK......",
        "...KkqqqqK......",
        "...KkqqqVK......",
        "...KqqqqVK......",
        "....KVqVK.......",
        ".....KgK........",
        "..KK.KgK..KK....",
        ".KnnKKgK.KnnK...",
        ".KgnnKgKKnngK...",
        "..KgnnggnngK....",
        "..KGgnnnngGK....",
        "...KKGGGGKK.....",
        "....KKKKKK......",
    ],
}

# ---------------------------------------------------------------- dishes

PUMPKIN_PIE = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "......KKKK......",
    "....KKpIIpKK....",
    "..KKsOKppKOsKK..",
    ".KsOOOOKKOOOOsK.",
    ".KsOLOOOOOOOdsK.",
    ".KwsOOOOOOOdswK.",
    ".KswsssssssswoK.",
    ".KwswswswswswoK.",
    "..KwwwwwwwwwoK..",
    "...KKoooooooKK..",
    "....KKKKKKKKK...",
]

# ---------------------------------------------------------------- legendary fish (side view, head right)

GLIMMER_TROUT = [
    "................",
    "................",
    "..L.............",
    ".LIL.....KKK....",
    "..L.....KxxK....",
    ".KK...KKxxxxKK..",
    "KxxK.KxxxxxxxIKK",
    "KxxxKxxxxxxxxxKK",
    ".KxxxqqqqqqqqIKk",
    ".KxzKzqqqqqqzzIK",
    "KzzK.KzzzzzzzzK.",
    "KzK...KKzzKKKK..",
    ".K......KK...L..",
    "............LIL.",
    ".............L..",
    "................",
]

SUN_CARP = [
    "................",
    "................",
    "..........L.....",
    ".......KKKKK....",
    "......KYYYYYK...",
    ".KK.KKYLYLYYKK..",
    "KOOKYYLYYYLYYYKK",
    "KOYOKYYLYYYYYKYK",
    "KOYYYYYYYYYYYYYK",
    "KOOKOYOYOYOYOOK.",
    ".KKKOOOOOOOOOK..",
    "....KKOKKKOKK...",
    "......KK..KK....",
    "................",
    "................",
    "................",
]


# ---------------------------------------------------------------- scarecrow

SCARECROW = [  # placed object, 16 x 30 (person-sized on a post, review 8)
    "................",
    ".....KKKKKK.....",
    "....KswsswsK....",
    "..KKKRRRRRRKKK..",
    ".KsswwwwwwwwssK.",
    "..KKKpppppKKKK..",
    "....KpKppKpK....",
    "....KppppppK....",
    "....KpKKKKpK....",
    ".....KppppK.....",
    "..KK.KKwwKK.KK..",
    ".KYYKDDDDDDKYYK.",
    "KYsYKDDqqDDKYsYK",
    ".KYwwwwwwwwwwYK.",
    "..KKDDDDDDDDKK..",
    "....KDDDDDDK....",
    "....KDWDDDDK....",
    "....KYKwwKYK....",
    "....KY.Kw.YK....",
    "......KwwK......",
    "......KwoK......",
    "......KwoK......",
    "......KwoK......",
    "......KwoK......",
    "......KwoK......",
    "......KwoK......",
    "......KwoK......",
    "......KwoK......",
    ".....KEwoEK.....",
    ".....KKKKKK.....",
]

SCARECROW_ITEM = [
    "................",
    ".....KKKKKK.....",
    "....KswsswsK....",
    "..KKKRRRRRRKKK..",
    ".KsswwwwwwwwssK.",
    "..KKKpppppKKKK..",
    "....KpKppKpK....",
    "....KpKKKKpK....",
    "..KK.KppppK.KK..",
    ".KYYKKKwwKKKYYK.",
    "KYsYwwwwwwwwwYsK",
    ".KYKDDDqqDDDKYK.",
    "..KKDDDDDDDDKK..",
    "....KDWDDDDK....",
    "....KKKwoKKK....",
    "......KKKK......",
]

# ---------------------------------------------------------------- the Founder's Statue, one frame per level

# a stone farmer (the player in stone: short hair, shirt, a hoe at the side), reused on every pedestal
_FIGURE = [
    "....KKKKK.....",
    "...KZzzzZK....",
    "..KZzxxxzZK...",
    "..KzxzzzxzK...",
    "..KzKxxxKzK..K",
    "..KZxxxxxZK.Kz",
    "...KZxxxZK..KK",
    "..KKZzzzZKKKK.",
    ".KzxzxzxzzzxK.",
    ".KxKzxzzzKzzK.",
    ".KxKzzxzzKKwK.",
    ".KKKZZZZZK.wK.",
    "...KzzKzzK.wK.",
    "...KzzKzzK.wK.",
    "...KZZKZZK.wK.",
]


def _statue(level: int) -> list[str]:
    fig = [r.ljust(14, ".") for r in _FIGURE]
    pad = lambda r: ("." + r + ".")  # noqa: E731  16 wide
    if level == 1:  # a bust on a low plinth
        bust = [pad(r[:11] + "...") for r in fig[:8]] + [pad(".KzxzxzxzzzK..")]
        return bust + [
            "...KKKKKKKKKK...",
            "..KxxxxxxxxxxK..",
            "..KzzzzzzzzzzK..",
            "..KzzzzzzzzzzK..",
            "..KzzzzzzzzzzK..",
            "..KZZZZZZZZZZK..",
            "..KKKKKKKKKKKK..",
        ]
    body = [pad(r) for r in fig]
    if level == 2:  # the full figure on a square plinth
        return body + [
            "..KKKKKKKKKKKK..",
            "..KxxxxxxxxxxK..",
            "..KzzzzzzzzzzK..",
            "..KzzzzzzzzzzK..",
            "..KZZZZZZZZZZK..",
            "..KKKKKKKKKKKK..",
        ]
    if level == 3:  # a taller plinth with a bronze plaque
        return body + [
            "..KKKKKKKKKKKK..",
            "..KxxxxxxxxxxK..",
            "..KzzKKKKKKzzK..",
            "..KzzKYOYOKzzK..",
            "..KzzKKKKKKzzK..",
            "..KzzzzzzzzzzK..",
            "..KZZZZZZZZZZK..",
            ".KKKKKKKKKKKKKK.",
            ".KxxxxxxxxxxxxK.",
            ".KKKKKKKKKKKKKK.",
        ]
    if level == 4:  # two tiers, a green wreath on the plaque
        return body + [
            "..KKKKKKKKKKKK..",
            "..KxxxxxxxxxxK..",
            "..KzzzKggKzzzK..",
            "..KzzKgKKgKzzK..",
            "..KzzKgYOgKzzK..",
            "..KzzzKggKzzzK..",
            "..KZZZZZZZZZZK..",
            ".KKKKKKKKKKKKKK.",
            ".KxxxxxxxxxxxxK.",
            ".KzzzzzzzzzzzzK.",
            ".KZZZZZZZZZZZZK.",
            "KKKKKKKKKKKKKKKK",
            "KxxxxxxxxxxxxxxK",
            "KKKKKKKKKKKKKKKK",
        ]
    if level >= 6:  # level 6: the figure itself gilded, on the level 5 pedestal
        gild = str.maketrans({"z": "Y", "x": "L", "Z": "O"})
        body = [r.translate(gild) for r in body]
    # level 5: gold trim, the gold sprout emblem and rose-pink flowers at its foot
    return [r for r in body] + [
        "..KKKKKKKKKKKK..",
        "..KYYYYYYYYYYK..",
        "..KzzzzKKzzzzK..",
        "..KzzzKgnKzzzK..",
        "..KzzKnKKgKzzK..",
        "..KzzzKYYKzzzK..",
        "..KzzzKYYKzzzK..",
        "..KZZZZZZZZZZK..",
        ".KKKKKKKKKKKKKK.",
        ".KYYYYYYYYYYYYK.",
        ".KzzzzzzzzzzzzK.",
        ".KZZZZZZZZZZZZK.",
        "KKKKKKKKKKKKKKKK",
        "KqKgKxxxxxxKgKqK",
        "KqkqKKKKKKKKqkqK",
        "KKKKK......KKKKK",
    ]


# ---------------------------------------------------------------- house trophies (depth/round3 keys, 16 x 16)

TROPHY_FESTIVAL = [  # a gold festival cup with a rose ribbon on a wooden base
    "................",
    "....KKKKKKKK....",
    "..KKLLYYYYYOKK..",
    ".KYKLYYYYYYOKYK.",
    ".KYKLYYYYYYOKYK.",
    "..KKYLYYYYYOKK..",
    "....KYYYYYOK....",
    ".....KYYYOK.....",
    "......KYOK......",
    ".....KqqqqK.....",
    ".....KYYYOK.....",
    "....KYYYYYOK....",
    "...KwwwwwwwwK...",
    "...KwsssssswK...",
    "...KooooooooK...",
    "....KKKKKKKK....",
]

TROPHY_LEGENDS = [  # a golden fish mounted on a dark wooden plaque
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KwwwwwwwwwwwwK.",
    ".KwEEEEEEEEEEoK.",
    ".KwEEEEEKKKEEoK.",
    ".KwKKEEKYYYKEoK.",
    ".KwKYKKYLYYYKoK.",
    ".KwEKYYLYYKYYKK.",
    ".KwEKYYYYYYYYKK.",
    ".KwKYKKOYOYOKoK.",
    ".KwKKEEKOOOKEoK.",
    ".KwEEEEEKKKEEoK.",
    ".KwEEEEEEEEEEoK.",
    ".KwoooooooooooK.",
    ".KKKKKKKKKKKKKK.",
    "................",
]

TROPHY_BOARD = [  # the town's thanks: a carved plaque with the gold sprout and a rose rosette
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KsssssssssssoK.",
    ".KsppppppppppoK.",
    ".KspppKKpKKppoK.",
    ".KsppKnnKggKpoK.",
    ".KsppKgnKgGKpoK.",
    ".KspppKKgKKppoK.",
    ".KsppppKYKpppoK.",
    ".KsppppKYKpppoK.",
    ".KspppKYYOKppoK.",
    ".KsppppppppppoK.",
    ".KooooooooooooK.",
    ".KKKKKKqqKKKKKK.",
    "......KqRK......",
    "......KRKR......",
]


# ---------------------------------------------------------------- onboarding coach marks (ui atlas)

COACH_HAND = [  # points up; flip vertically to point down
    "....KK.......",
    "...KkkK......",
    "...KkmK......",
    "...KkmK......",
    "...KkmKKK....",
    "...KkmKkmKK..",
    ".KKKkmKkmKmKK",
    "KkmKkmkkmkmkK",
    "KkmKkkkkkkkmK",
    "KkkkkkkkkkkmK",
    ".KkkkkkkkkmmK",
    ".KmkkkkkkkmK.",
    "..KmmkkkkmmK.",
    "..KKKKKKKKKK.",
    "..KSSSSSSSSK.",
    "..KDDDDDDDDK.",
    "..KKKKKKKKKK.",
]

COACH_RING = [  # 16 x 16, gold ring with an ink rim inside and out
    ".....KKKKKK.....",
    "...KKLYYYYLKK...",
    "..KLYKKKKKKYYK..",
    ".KLKK......KKYK.",
    ".KYK........KYK.",
    "KLK..........KYK",
    "KYK..........KYK",
    "KYK..........KOK",
    "KYK..........KOK",
    "KYK..........KOK",
    "KYK..........KOK",
    ".KYK........KOK.",
    ".KYKK......KKOK.",
    "..KYOKKKKKKOOK..",
    "...KKOOOOOOKK...",
    ".....KKKKKK.....",
]


def _ring_wide() -> list[str]:
    """The outer pulse frame: a thin, broken lamp-coloured ring 22 px across (stepped, never a soft glow)."""
    n = 22
    c = (n - 1) / 2
    rows = []
    for y in range(n):
        r = ""
        for x in range(n):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            if 9.6 <= d < 10.6:
                ang = (np.degrees(np.arctan2(y - c, x - c)) + 360) % 360
                r += "L" if int(ang // 30) % 2 == 0 else "Y"
            elif 8.6 <= d < 9.6 or 10.6 <= d < 11.4:
                r += "K"
            else:
                r += "."
        rows.append(r)
    return rows


COACH_BUBBLE = [  # 12 x 12 nine-slice source: 4 px corners, a plum shadow under the parchment
    "..KKKKKKKK..",
    ".KppppppppK.",
    "KppppppppppK",
    "KppppppppppK",
    "KppppppppppK",
    "KppppppppppK",
    "KppppppppppK",
    "KppppppppppK",
    "KssssssssssK",
    "KPssssssssPK",
    ".KPPPPPPPPK.",
    "..KKKKKKKK..",
]

COACH_TAIL = [  # sits under the bubble's bottom edge, overlapping its outline row
    "KsssssK",
    ".KPPPK.",
    "..KPK..",
    "...K...",
]


# ---------------------------------------------------------------- fruit trees in proportion (review 8)

SEEDLING = [  # a fruit tree's first days: 8 x 10
    "..KK.KK.",
    ".KnnKgnK",
    ".KgnKgK.",
    "..KKgKK.",
    "....gK..",
    "...KwK..",
    "...KwK..",
    "...KwK..",
    "..KEwoK.",
    "..KKKKK.",
]

FRUIT = {  # (fruit colour, highlight, leaf blossom) per tree
    "cherry": ("wine", "red", True),
    "peach": ("orange", "skin light", False),
    "apple": ("red", "lamp", False),
    "plum": ("plum", "lilac", False),
}


def _tree(P, names, w: int, h: int, crown: dict, seed: int, fruit=None) -> np.ndarray:
    import crowns

    ys, xs = np.mgrid[0:h, 0:w]
    c = {"kind": "o", "draw": True, "back": False, "small": False, "trunk": True, **crown}
    return crowns.paint(P, xs + 0.5, ys + 0.5, [c], seed, fruit=fruit)


def fruit_trees(P, names) -> dict[str, np.ndarray]:
    """Grown fruit trees 32 x 40 (trunk on the base tile, crown over the tiles above) and three young stages."""
    out = {}
    for k, (tree, (col, light, blossom)) in enumerate(FRUIT.items()):
        out[f"obj_tree_{tree}_sapling"] = _tree(
            P, names, 32, 40,
            {"cx": 16, "cy": 15, "r": 13.0, "base": 38, "blossom": blossom},
            seed=31 + k * 7,
            fruit=(names.index(col), names.index(light), 5),
        )
    out["obj_sapling"] = grid(names, SEEDLING)
    out["obj_sapling_2"] = _tree(P, names, 12, 20, {"cx": 6, "cy": 6, "r": 5.0, "base": 18, "tiny": True}, 41)
    out["obj_sapling_3"] = _tree(P, names, 20, 28, {"cx": 10, "cy": 9, "r": 8.5, "base": 26, "small": True}, 43)
    return out


def to_idx(rgba: np.ndarray, pal) -> np.ndarray:
    """An RGBA sprite already on the palette -> palette indices (-1 = transparent)."""
    out = np.full(rgba.shape[:2], -1, dtype=np.int32)
    for k, c in enumerate(pal):
        out[(rgba[..., 3] > 0) & np.all(rgba[..., :3] == np.array(c, dtype=np.uint8), axis=-1)] = k
    return out


def build(P, groups: dict, pal, names: list[str]) -> None:
    def add(group: str, key: str, idx: np.ndarray) -> None:
        groups[group][key] = px.idx_to_rgba(idx, pal)

    # stage 0 is the shared seed mound (sprites.json); stages 1..4 from the drawn growth (sprout ... bloom)
    for k, stage in ((1, 2), (2, 3), (3, 4), (4, 5)):
        add("world", f"crop_tulip_{k}", grid(names, CROP_TULIP[stage]))
    for key, rows in (
        ("item_pumpkin_pie", PUMPKIN_PIE),
        ("item_glimmer_trout", GLIMMER_TROUT),
        ("item_sun_carp", SUN_CARP),
        ("item_scarecrow", SCARECROW_ITEM),
    ):
        add("ui", key, grid(names, rows, 16, 16))
    add("world", "obj_scarecrow", grid(names, SCARECROW, 16, 30))
    # the statue's levels _1.._6 (16 x 32 canvases, level 6 gilded), as named by the projects data
    for lv in range(1, 7):
        add("world", f"obj_landmark_statue_{lv}", grid(names, _statue(lv), 16, 32))
    for key, rows in (
        ("obj_trophy_festival", TROPHY_FESTIVAL),
        ("obj_trophy_legends", TROPHY_LEGENDS),
        ("obj_trophy_board", TROPHY_BOARD),
    ):
        add("world", key, grid(names, rows, 16, 16))
    for key, idx in fruit_trees(P, names).items():
        add("world", key, idx)
    add("ui", "ui_coach_hand", grid(names, COACH_HAND))
    add("ui", "ui_coach_ring", grid(names, COACH_RING))
    add("ui", "ui_coach_ring_wide", grid(names, _ring_wide()))
    add("ui", "ui_coach_bubble", grid(names, COACH_BUBBLE))
    add("ui", "ui_coach_bubble_tail", grid(names, COACH_TAIL))
    chars = groups.get("chars", {})
    if all(f"player_idle_{d}_0" in chars for d in ("down", "up", "right")):
        # round 4: the walk and the tool-use frames, built on the idle frames (anim.py, toolanim.py)
        import anim
        import toolanim

        idle = {d: to_idx(chars[f"player_idle_{d}_0"], pal) for d in ("down", "up", "right")}
        # left is the exact mirror of right (the Flow crop's flip could land 1 px off after trimming)
        add("chars", "player_idle_left_0", idle["right"][:, ::-1].copy())
        for key, idx in anim.walk_frames(names, idle).items():
            add("chars", key, idx)
        tools = toolanim.tool_frames(names, idle)
        for key, idx in tools.items():
            add("chars", key, idx)
        # the round-3 single poses (still shown by WorldScene.toolPose) are now the contact frames
        for key, src in toolanim.LEGACY_POSES.items():
            add("chars", key, tools[src][:32].copy())  # the legacy keys stay 32 x 32 (origin at the bottom)
    if chars:  # doors, crop leans, ripples and splash, harvest pops, villager and animal idles (motion.py)
        import motion

        motion.build(names, groups, lambda rgba: to_idx(rgba, pal), lambda idx: px.idx_to_rgba(idx, pal))
    if all(f"player_idle_{d}_0" in chars for d in ("down", "up", "right")):
        # round 5: tool and action animations from Google Flow, composed on the player's own head (flowanim.py)
        import json
        import os

        import flowanim

        idle = {d: to_idx(chars[f"player_idle_{d}_0"], pal) for d in ("down", "up", "right")}
        acts = flowanim.build(names, pal, idle, lambda rgba: to_idx(rgba, pal))
        import codeacts  # pet, reel and place, drawn in code on the round-4 machinery (review 18)

        acts.update(codeacts.build(names, idle))
        for key, idx in acts.items():
            add("chars", key, idx)
        if acts:  # the frame counts the game reads (src/art/actFrames.json)
            counts: dict = {}  # only the frames that composed (a split-off fragment is skipped), in order
            for key in acts:
                anim, d, i = key[len("player_act_"):].rsplit("_", 2)
                counts.setdefault(anim, {})[d] = max(counts.get(anim, {}).get(d, 0), int(i) + 1)
            path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "art", "actFrames.json")
            with open(path, "w", newline="\n") as fh:
                json.dump(counts, fh, indent=1, sort_keys=True)
                fh.write("\n")


# ---------------------------------------------------------------- the town well (round 4): 24 x 32, three tiles wide

WELL = [
    "..........KKKK..........",
    "........KKwwswKK........",
    "......KKwwwwwwwwKK......",
    "....KKwowowowowowowoKK..",
    "..KKwwwwswwwwwwwswwwwwKK",
    "KKowowowowowowowowowowoK",
    "KEEEEEEEEEEEEEEEEEEEEEEK",
    ".KKKKKKKKKKKKKKKKKKKKKK.",
    "..KwoK............KwoK..",
    "..KwoK............KwoK..",
    "..KwoKKKKKKKKKKKKKKwoKK.",
    "..KwoEwwwwwwwwwwwwEwoKwK",
    "..KwoKKKKKKwKKKKKKKwoKwK",
    "..KwoK....KsK.....KwoKK.",
    "..KwoK....KsK.....KwoK..",
    "..KwoK...KKKKKK...KwoK..",
    "..KwoK...KwEwwK...KwoK..",
    "..KwoK...KoEooK...KwoK..",
    "..KwoK....KKKK....KwoK..",
    "..KwoKKKKKKKKKKKKKKwoK..",
    "..KxxxxxxxxxxxxxxxxxxK..",
    ".KxzKKKKKKKKKKKKKKKKzxK.",
    ".KxKNNNDNNNNNNDNNNNNKxK.",
    ".KxzKKKKKKKKKKKKKKKKzxK.",
    ".KxxxxzxxxxxzxxxxxzxxxK.",
    ".KZzzzZzzzzZzzzzZzzzzZK.",
    ".KzzZzzzzZzzzzZzzzzZzzK.",
    ".KZzzxZzzzxZzzzzZxzzzZK.",
    ".KzzZzzzzZzzzzZzzzzZzzK.",
    ".KZzzzZzzzzZzzxzZzzzzZK.",
    "..KZZZZZZZZZZZZZZZZZZK..",
    "...KKKKKKKKKKKKKKKKKK...",
]
