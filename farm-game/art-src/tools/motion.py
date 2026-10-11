"""The rest of the round-4 animation frames (the walk and tool use are in anim.py and toolanim.py).

All new frame names; existing keys keep their art except where noted:
  obj_door_open_<0..3>            16 x 32, the tall facade door over its two tiles: 0 closed (as baked), 1 ajar,
                                  2 half, 3 open. Hinge on the left, the leaf swings inward; the frame stays put.
  obj_door_open_low_<0..3>        16 x 16, the same door's ground-row tile only (the shop, under its awning).
  crop_<id>_<s>_lean_l / _lean_r  every grown stage (s >= 2): the top half leans 1 px; the base stays put.
  fx_ripple_<0..2>                stepped rings on the water ramp (no ink, no alpha), widening.
  fx_splash_<0..3>                (redrawn) a crown of droplets on foam: bulge, crown, droplets fly, fall back.
                                  Loose droplets carry no ink (a ring would read as a dark speck at 1x).
  <icon>_pop_0 / _pop_1           harvest pop for crops, forage and animal goods: 0 stretch (14 x 18), 1 squash
                                  (18 x 14), then the icon itself (16 x 16). Bottom-anchored, integer pixels.
  npc_<id>_<dir>_1                (redrawn) breathe in: the chest grows 1 px, the head rises 1 px, feet planted
  npc_<id>_<dir>_2                blink (down and side views; from behind it repeats frame 0)
  npc_<id>_<dir>_3                each villager's own beat: Mara nods, Finn lifts his hat, Orin shifts his weight,
                                  Rosa lifts and tips her hat, Clay tilts his head (smug)
  animal_<a>_2, animal_<a>_3      breathe (the back rises 1 px) and a head dip
  player_idle_<dir>_1             exhale: the head and shoulders sink 1 px (a torso row goes); the feet stay
  obj_door_house_<0..2>           the house's exit door tile (16 x 16, the `door` tile): closed, ajar, open
Alias frame names (the feel agent's names for frames above; same atlas rect, no extra pixels): see aliases().
"""
from __future__ import annotations

import json
import os

import numpy as np

from anim import INK, _n, blank, fix_edges, grid

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "..", "src", "data"))

# ---------------------------------------------------------------- doors

# the baked tall door (tiles_extra.py, f_doortop_* rows 6..15 + f_doorlow_* rows 0..15) in drawn.CHARS letters
DOOR_TOP = ["...KKKKKKKKKK...", "..KEwwwwwwwwEK..", ".KwwwwwwwwwwwwK."]
PLANK = ".KEwowwoowwowEK."
DOOR_LOW_TAIL = [".KEwwwwwwwwwwEK.", ".KKKKKKKKKKKKKK.", "KxxxxxxxxxxxxxxK", "KzzzzzzzzzzzzzzK"]


def _door_closed() -> list[str]:
    rows = ["." * 16] * 6 + DOOR_TOP + [PLANK] * 7  # top tile
    rows += [PLANK] * 5 + [".KEwowwoowYowEK."] + [PLANK] * 6 + DOOR_LOW_TAIL  # ground tile
    return rows


def _door_open(names, leaf: int) -> np.ndarray:
    """The doorway with the leaf `leaf` px wide at the hinge (left); 10 is closed. Inside: a dark room, a band of
    shadow under the lintel and a strip of floor."""
    rows = [list(r) for r in _door_closed()]
    if leaf >= 10:
        return grid(names, ["".join(r) for r in rows])
    # the opening follows the closed leaf's own arch: row 7 x 4..11, rows 8..27 x 3..12. The outline, the jamb
    # (`E` columns), the arch's wooden shoulders (row 8, x 2 and 13) and the step stay pixel-identical.
    def inside(y: int) -> range:
        return range(4, 12) if y == 7 else range(3, 13)

    for y in range(7, 28):
        for x in inside(y):
            rows[y][x] = "N" if y < 10 else ("P" if y < 26 else "E")
    # the leaf: hinged at x 3, planks foreshortened to `leaf` columns, a dark edge where it turns away
    cols = "woowwowwoo"
    for y in range(8, 28):
        for i in range(leaf):
            x = 3 + i
            rows[y][x] = "K" if i == leaf - 1 else ("E" if y == 8 else cols[int(i * 10 / max(1, leaf - 1)) % 10])
    if leaf >= 4:  # the knob, at the leaf's free edge
        rows[21][3 + leaf - 2] = "Y"
    return grid(names, ["".join(r) for r in rows])


def doors(names) -> dict[str, np.ndarray]:
    out = {}
    for i, leaf in enumerate((10, 7, 4, 2)):
        f = _door_open(names, leaf)
        out[f"obj_door_open_{i}"] = f
        out[f"obj_door_open_low_{i}"] = f[16:].copy()
    return out


# ---------------------------------------------------------------- crop lean

def lean(idx: np.ndarray, dx: int) -> np.ndarray:
    """The top half of the opaque rows shifts dx (+-1) px; the base stays put. The joint keeps its ink."""
    ys = np.where((idx >= 0).any(axis=1))[0]
    if len(ys) < 4:
        return idx.copy()
    top, bot = int(ys[0]), int(ys[-1])
    pivot = top + (bot - top + 1) // 2
    w = idx.shape[1]
    out = np.full((idx.shape[0], w + 0), -1, dtype=np.int32)
    out[pivot:] = idx[pivot:]
    for y in range(top, pivot):
        row = idx[y]
        sh = np.full(w, -1, dtype=np.int32)
        if dx > 0:
            sh[dx:] = row[:-dx]
        else:
            sh[:dx] = row[-dx:]
        out[y] = sh
    fix_edges(out, 0, w, max(0, pivot - 2), pivot + 2)
    return out


# ---------------------------------------------------------------- water

RIPPLES = [
    [".SIS.", "S...S", ".SIS."],
    ["..SIIIS..", ".S.....S.", "I.......I", ".S.....S.", "..SIIIS.."],
    ["...SI.ISS...", ".S........S.", "S..........I", "............", "I..........S", ".S........S.", "...SSI.IS..."],
]
SPLASH = [
    ["...KKK...", "..KIIIK..", ".KISSSIK.", "KISWWWSIK"],
    ["..K.....K..", ".KIK...KIK.", ".KIK.K.KIK.", "..KIKIKIK..", "..KISISIK..", ".KISSSSSIK.", "KISWWWWWSIK"],
    [
        ".I.........I.",
        "ISI...I...ISI",
        ".S...ISI...S.",
        "......S......",
        "..KK.....KK..",
        ".KIIK...KIIK.",
        ".KISIK.KISIK.",
        "..KISIKISIK..",
        ".KISSSSSSSIK.",
        "KISSWWWWWSSIK",
    ],
    [
        ".............",
        "..I.......I..",
        ".ISI.....ISI.",
        "..S.......S..",
        ".............",
        "...KKKKKKK...",
        ".KKIIIIIIIKK.",
        "KIISSSSSSSIIK",
    ],
]


# ---------------------------------------------------------------- harvest pop (squash and stretch)

def _resize_rows(idx: np.ndarray, d: int, band=(0.35, 0.7)) -> np.ndarray:
    """Add (d > 0) or remove (d < 0) |d| rows spread over a band of the opaque rows (on the native grid)."""
    ys = np.where((idx >= 0).any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    h = bot - top + 1
    a, b = top + int(h * band[0]), top + int(h * band[1])
    rows = sorted({int(a + (b - a) * (k + 0.5) / abs(d)) for k in range(abs(d))})
    if d > 0:
        return np.insert(idx, rows, idx[rows], axis=0)
    return np.delete(idx, rows, axis=0)


def _resize_cols(idx: np.ndarray, d: int) -> np.ndarray:
    return _resize_rows(idx.T, d, (0.3, 0.7)).T


def _place(idx: np.ndarray, w: int, h: int) -> np.ndarray:
    """Crop to the opaque box and put it bottom-centred on a w x h canvas."""
    ys = np.where((idx >= 0).any(axis=1))[0]
    xs = np.where((idx >= 0).any(axis=0))[0]
    t = idx[ys[0] : ys[-1] + 1, xs[0] : xs[-1] + 1]
    out = blank(w, h)
    th, tw = t.shape
    x0 = (w - tw) // 2
    y0 = h - th - 1 if th < h else 0
    out[max(0, y0) : max(0, y0) + min(th, h), max(0, x0) : max(0, x0) + min(tw, w)] = t[:h, :w]
    return out


def pops(icon_idx: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Stretch (2 px taller, 2 px narrower) and squash (2 px shorter, 2 px wider), same bottom line as the icon."""
    ys = np.where((icon_idx >= 0).any(axis=1))[0]
    margin = 15 - int(ys[-1])  # the icon's empty rows under it, kept so the pop sits where the icon does
    st = _resize_cols(_resize_rows(icon_idx, 2), -2)
    sq = _resize_cols(_resize_rows(icon_idx, -2), 2)
    out = []
    for f, (w, h) in ((st, (14, 18)), (sq, (18, 14))):
        p = _place(f, w, h)
        up = margin - 1  # _place leaves one empty row under the art; match the icon's own margin
        if up > 0:
            p = np.vstack([p[up:], np.full((up, w), -1, dtype=np.int32)])
        elif up < 0:
            p = np.vstack([np.full((-up, w), -1, dtype=np.int32), p[:up]])
        out.append(p)
    return out[0], out[1]


def pop_icons() -> list[str]:
    items = json.load(open(os.path.join(DATA, "items.json")))
    return sorted({it["icon"] for it in items.values() if it.get("type") in ("crop", "forage", "product")})


# ---------------------------------------------------------------- idles

def stretch_up(f: np.ndarray, r: int) -> np.ndarray:
    """Row r doubles; everything above it rises 1 px (the feet stay put)."""
    out = f.copy()
    out[0:r] = f[1 : r + 1]
    fix_edges(out, 0, f.shape[1], max(0, r - 2), r + 2)
    return out


def squash_down(f: np.ndarray, r: int) -> np.ndarray:
    """Row r goes; everything above it sinks 1 px."""
    out = f.copy()
    out[1 : r + 1] = f[0:r]
    out[0] = -1
    fix_edges(out, 0, f.shape[1], max(0, r - 2), r + 2)
    return out


def shift_rows(f: np.ndarray, r0: int, r1: int, dx: int) -> np.ndarray:
    """Rows r0..r1-1 move dx px sideways (over what is there); the rest stays."""
    out = f.copy()
    band = f[r0:r1]
    moved = np.full_like(band, -1)
    if dx > 0:
        moved[:, dx:] = band[:, :-dx]
    else:
        moved[:, :dx] = band[:, -dx:]
    out[r0:r1] = moved
    # under the moved band, the row below keeps its pixels; re-ink the seams
    fix_edges(out, 0, f.shape[1], max(0, r0 - 1), min(f.shape[0], r1 + 2))
    return out


def chin_row(f: np.ndarray) -> int:
    """The narrowest row between the head and the shoulders."""
    ys = np.where((f >= 0).any(axis=1))[0]
    top = int(ys[0])
    widths = [(int((f[y] >= 0).sum()), y) for y in range(top + 10, min(f.shape[0] - 8, top + 20))]
    return min(widths)[1]


# Eye boxes (x0, x1, y) of each eye's pupil row, by villager and view (left mirrors right). Read off 14x crops of
# the frames (agents/out/art-shots/round4/faces.png). Blink: the eye pixels go to skin, a 2 px lid line stays.
EYES = {
    "mara": {"down": [(5, 6, 14), (11, 12, 14)], "right": [(14, 15, 14)]},
    "finn": {"down": [(6, 7, 13), (11, 12, 13)], "right": [(12, 13, 12)]},
    "orin": {"down": [(9, 9, 6), (13, 13, 6)], "right": [(14, 14, 6)]},
    "rosa": {"down": [(7, 8, 15), (12, 13, 15)], "right": [(13, 14, 13)]},
    "clay": {"down": [(6, 7, 12), (11, 12, 12)], "right": [(12, 13, 11)]},
}
SKIN = ("skin light", "skin mid", "skin deep")


def blink(names, f: np.ndarray, boxes) -> np.ndarray:
    out = f.copy()
    k, m = names.index("skin light"), names.index("skin mid")
    lid = names.index("skin deep")
    skin = {names.index(s) for s in SKIN}
    for x0, x1, y in boxes:
        for x in range(x0, x1 + 1):
            # the pupil row and the row under it: not skin -> skin; then the lid line on the pupil row
            for yy in (y, y + 1):
                if out[yy, x] >= 0 and out[yy, x] not in skin and out[yy, x] != INK:
                    out[yy, x] = k if yy == y + 1 else m
                elif out[yy, x] == INK and yy == y + 1:
                    out[yy, x] = k
            out[y, x] = lid
    return out


def villager_idles(names, frames: dict[str, np.ndarray], npc: str) -> dict[str, np.ndarray]:
    """frames: npc_<id>_<dir>_0 for down, up, right. Returns _1.._3 for all four directions."""
    out = {}
    for d in ("down", "up", "right"):
        f = frames[f"npc_{npc}_{d}_0"]
        c = chin_row(f)
        out[f"npc_{npc}_{d}_1"] = stretch_up(f, c + 3)
        eyes = EYES.get(npc, {}).get(d)
        out[f"npc_{npc}_{d}_2"] = blink(names, f, eyes) if eyes else f.copy()
        if npc == "mara":  # a friendly nod
            beat = squash_down(f, c)
        elif npc in ("finn", "rosa"):  # lifts the hat a pixel (Rosa also tips it)
            hat = HAT_ROW[npc][d]
            beat = stretch_up(f, hat)
            if npc == "rosa":
                beat = shift_rows(beat, 0, hat - 2, 1 if d != "right" else -1)
        elif npc == "orin":  # shifts his weight: everything above the knees leans 1 px
            ys = np.where((f >= 0).any(axis=1))[0]
            beat = shift_rows(f, 0, int(ys[-1]) - 3, -1)
        else:  # clay: the smug tilt, head 1 px over
            beat = shift_rows(f, 0, c, 1)
        out[f"npc_{npc}_{d}_3"] = beat
    # left mirrors right exactly, frame 0 included (the Flow crop's flip could land 1 px off after trimming)
    out[f"npc_{npc}_left_0"] = frames[f"npc_{npc}_right_0"][:, ::-1].copy()
    for i in (1, 2, 3):
        out[f"npc_{npc}_left_{i}"] = out[f"npc_{npc}_right_{i}"][:, ::-1].copy()
    return out


# the first row under the hat brim (the hat is everything above it), by view
HAT_ROW = {
    "finn": {"down": 12, "up": 12, "right": 12},
    "rosa": {"down": 15, "up": 15, "right": 15},
}


def animal_idles(f: np.ndarray, face_right: bool = True) -> tuple[np.ndarray, np.ndarray]:
    """2: the back rises 1 px (a breath), legs planted. 3: the head dips 1 px."""
    ys = np.where((f >= 0).any(axis=1))[0]
    top, bot = int(ys[0]), int(ys[-1])
    mid = top + (bot - top) // 2
    breathe = stretch_up(f, mid)
    w = f.shape[1]
    xs = np.where((f >= 0).any(axis=0))[0]
    x0 = int(xs[0] + (xs[-1] - xs[0]) * 0.62) if face_right else int(xs[0])
    x1 = int(xs[-1]) + 1 if face_right else int(xs[0] + (xs[-1] - xs[0]) * 0.38) + 1
    dip = f.copy()
    legs = bot - 3
    region = f[top:legs, x0:x1].copy()
    dip[top:legs, x0:x1] = -1
    dip[top + 1 : legs + 1, x0:x1] = np.where(region >= 0, region, dip[top + 1 : legs + 1, x0:x1])
    fix_edges(dip, max(0, x0 - 1), min(w, x1 + 1), top, legs + 2)
    return breathe, dip


# ---------------------------------------------------------------- build

def build(names, groups: dict, to_idx, to_rgba) -> None:
    world, ui, chars = groups["world"], groups["ui"], groups["chars"]
    for k, idx in doors(names).items():
        world[k] = to_rgba(idx)
    for k in [k for k in world if k.startswith("crop_") and "_lean_" not in k]:
        s = k.rsplit("_", 1)[1]
        if s.isdigit() and int(s) >= 2:
            idx = to_idx(world[k])
            world[f"{k}_lean_l"] = to_rgba(lean(idx, -1))
            world[f"{k}_lean_r"] = to_rgba(lean(idx, 1))
    for i, rows in enumerate(RIPPLES):
        ui[f"fx_ripple_{i}"] = to_rgba(grid(names, rows))
    for i, rows in enumerate(SPLASH):
        ui[f"fx_splash_{i}"] = to_rgba(grid(names, rows))
    for icon in pop_icons():
        if icon in ui:
            st, sq = pops(to_idx(ui[icon]))
            ui[f"{icon}_pop_0"] = to_rgba(st)
            ui[f"{icon}_pop_1"] = to_rgba(sq)
    for npc in ("mara", "finn", "orin", "rosa", "clay"):
        base = {f"npc_{npc}_{d}_0": to_idx(chars[f"npc_{npc}_{d}_0"]) for d in ("down", "up", "right")}
        if len(base) == 3:
            for k, idx in villager_idles(names, base, npc).items():
                chars[k] = to_rgba(idx)
    for d in ("down", "up", "right"):
        k = f"player_idle_{d}_0"
        if k in chars:
            chars[f"player_idle_{d}_1"] = to_rgba(player_breath(to_idx(chars[k])))
    if "player_idle_right_1" in chars:
        chars["player_idle_left_1"] = chars["player_idle_right_1"][:, ::-1].copy()
    # the house's exit door, from the shipped tileset's `door` and `wall` tiles (placeholder row: stable slots)
    tdir = os.path.normpath(os.path.join(HERE, "..", "..", "public", "assets", "tilesets"))
    if os.path.exists(os.path.join(tdir, "tiles.json")):
        from PIL import Image

        meta = json.load(open(os.path.join(tdir, "tiles.json")))
        sheet = np.asarray(Image.open(os.path.join(tdir, "tiles.png")).convert("RGBA"))
        cols = meta["columns"]

        def tile(name: str) -> np.ndarray:
            k = meta["tiles"][name]
            y, x = divmod(k, cols)
            return to_idx(sheet[y * 16 : (y + 1) * 16, x * 16 : (x + 1) * 16].copy())

        for i, f in enumerate(house_door(names, tile("door"), tile("wall"))):
            world[f"obj_door_house_{i}"] = to_rgba(f)
    for a in ("chicken", "cow", "sheep", "pig"):
        key = f"animal_{a}"
        if key in world:
            b, d = animal_idles(to_idx(world[key]))
            world[f"{key}_2"] = to_rgba(b)
            world[f"{key}_3"] = to_rgba(d)


# ---------------------------------------------------------------- the feel agent's names (atlas aliases)

def aliases() -> dict[str, str]:
    """alias frame name -> existing frame name, added to the atlas JSON by build.py (same rect)."""
    out = {}
    for tool in ("hoe", "can", "scythe", "pick", "rod"):
        dirs = ("down", "left", "right", "up") if tool in ("hoe", "pick") else ("down", "left", "right")
        for d in dirs:  # 3-frame swing: anticipation, impact (the contact frame), follow-through
            for i, src in enumerate((0, 2, 3)):
                out[f"player_swing_{tool}_{d}_{i}"] = f"player_tool_{tool}_{d}_{src}"
    for i, src in enumerate((0, 1, 3)):  # the farmhouse's tall door: closed, ajar, open
        out[f"obj_door_farmhouse_{i}"] = f"obj_door_open_{src}"
    return out


def player_breath(f: np.ndarray) -> np.ndarray:
    """Exhale: one torso row (row 21, under the shoulders) goes, so the head and shoulders sink 1 px."""
    return squash_down(f, 21)


def house_door(names, door: np.ndarray, wall: np.ndarray) -> list[np.ndarray]:
    """The `door` tile opening: the leaf is the wooden part where the door tile differs from the wall. Closed is the tile
    itself; ajar keeps the leaf's hinge half; open leaves a 2 px edge. Inside: a dark room."""
    woodish = {names.index(n) for n in ("wood", "soil", "earth dark", "gold", "sand")}
    leaf = (door != wall) & np.isin(door, list(woodish))
    ys, xs = np.where(leaf)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    ix0, ix1, iy0, iy1 = x0 + 1, x1 - 1, y0 + 1, y1  # inside the wooden frame (its 1 px border stays)
    out = [door.copy()]
    nav, plum = names.index("night navy"), names.index("plum shadow")
    for keep in (max(3, (ix1 - ix0 + 1) * 2 // 3), 2):
        f = door.copy()
        inner = door[iy0 : iy1 + 1, ix0 : ix1 + 1].copy()
        for y in range(iy0, iy1 + 1):
            for x in range(ix0, ix1 + 1):
                f[y, x] = nav if y < iy0 + 2 else plum
        w = ix1 - ix0 + 1
        for y in range(iy0, iy1 + 1):
            for i in range(keep):
                src = inner[y - iy0, int(i * w / keep)]
                f[y, ix0 + i] = INK if i == keep - 1 else src
        out.append(f)
    return out
