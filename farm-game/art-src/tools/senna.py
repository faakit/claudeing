"""Senna Marl, the miller (M7), Mara's sister: her base frames drawn over Mara's (art round m7).

`npc_senna_<down|up|right>_0` (20 x 32, feet on row 31) start from Mara's frame 0 so the sisters share a face and the
red hair; motion.villager_idles then makes the idle frames (breathe, blink, her beat) and the left view as for every
villager. What makes her Senna, by silhouette and colour:
  - a dusk-blue headscarf over the hair (no bun: a low round crown), knotted at the nape with two tails that stand
    out behind her; Mara's red hair shows at the temples
  - a leaf-green work dress with the sleeves rolled to the elbow (bare forearms, a parchment cuff)
  - a long parchment apron dusted with flour (ice-white flecks)
  - a flour sack on her hip (parchment, tied at the neck), the miller's silhouette
No alpha; the 1 px ink outline as on every villager.
"""
from __future__ import annotations

import numpy as np

# One letter per palette slot, in palette order (as the dumps in agents' notes): 0 ink .. v taupe.
CH = "0123456789abcdefghijklmnopqrstuv"


def _grid(rows: list[str]) -> np.ndarray:
    return np.array([[-1 if c == "." else CH.index(c) for c in r] for r in rows], dtype=np.int32)


def _patch(t: np.ndarray, y: int, x: int, rows: list[str]) -> None:
    """Paint `rows` at (x, y); '.' leaves what is there, ' ' clears."""
    for dy, r in enumerate(rows):
        for dx, c in enumerate(r):
            if c == ".":
                continue
            t[y + dy, x + dx] = -1 if c == " " else CH.index(c)


def _recolour(t: np.ndarray, region: tuple[int, int, int, int], mapping: dict[str, str]) -> None:
    y0, y1, x0, x1 = region
    sl = t[y0:y1, x0:x1]
    src = sl.copy()
    for a, b in mapping.items():
        sl[src == CH.index(a)] = CH.index(b)


# the dress: Mara's peach blouse (skin mid / skin deep / skin light on the body) -> leaf greens
DRESS = {"i": "8", "j": "7", "h": "9"}
# Mara's skirt (stone, taupe, plum shadow, soil) -> the dress's skirt
SKIRT = {"s": "8", "u": "9", "v": "8", "1": "7", "t": "8", "d": "7"}

SACK = [  # the flour sack: parchment, a sand shade, its neck tied in soil (7 x 9)
    " 00    ",
    "0dd0   ",
    "0gg0.  ",
    "0ggg00 ",
    "0gg6gf0",
    "0ggggf0",
    "0gggff0",
    "0gfff0 ",
    " 0000  ",
]


def _dome(t: np.ndarray, spans: dict[int, tuple[int, int]], fill: str = "3") -> None:
    """A filled shape with its ink outline, by rows: spans[y] = (x0, x1) inclusive of the outline."""
    for y, (x0, x1) in spans.items():
        t[y, x0 : x1 + 1] = CH.index(fill)
        t[y, x0] = t[y, x1] = 0
    ys = sorted(spans)
    for y in (ys[0],):
        x0, x1 = spans[y]
        t[y, x0 : x1 + 1] = 0


def _outline(t: np.ndarray, body: np.ndarray, keep: np.ndarray) -> None:
    """Ink the 4-neighbour ring round `body` where nothing is drawn yet or where `keep` is False."""
    p = np.pad(body, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~body
    t[ring & ((t < 0) | ~keep)] = 0


def _rows(spans: dict[int, tuple[int, int]], shape=(32, 20)) -> np.ndarray:
    m = np.zeros(shape, bool)
    for y, (x0, x1) in spans.items():
        m[y, x0 : x1 + 1] = True
    return m


def _body(t: np.ndarray, view: str) -> None:
    """Senna's dress, rolled sleeves, apron and skirt below Mara's chin (rows 19-28); Mara's feet stay (29-31)."""
    c = CH.index
    head = np.zeros_like(t, bool)
    head[:19] = t[:19] >= 0
    t[19:29] = -1
    if view == "down":
        torso = _rows({19: (7, 11), 20: (5, 13), 21: (5, 13), 22: (5, 13), 23: (5, 13), 24: (5, 13),
                       25: (4, 14), 26: (4, 14), 27: (3, 15), 28: (3, 15)})
        arm = _rows({20: (3, 4), 21: (2, 4), 22: (2, 4), 23: (2, 4), 24: (2, 4), 25: (2, 3)})
        apron = _rows({21: (7, 11), 22: (7, 11), 23: (6, 12), 24: (6, 12), 25: (6, 12), 26: (6, 12), 27: (6, 12),
                       28: (6, 12)})
        straps = [(19, 7), (20, 7), (19, 11), (20, 11)]
        neck = [(19, 8, 10)]
    elif view == "right":
        torso = _rows({19: (9, 12), 20: (8, 13), 21: (8, 13), 22: (8, 13), 23: (8, 13), 24: (8, 13),
                       25: (8, 14), 26: (7, 14), 27: (7, 15), 28: (7, 15)})
        arm = _rows({20: (9, 11), 21: (9, 11), 22: (9, 11), 23: (10, 12), 24: (10, 12), 25: (11, 12)})
        apron = _rows({21: (13, 13), 22: (13, 13), 23: (13, 14), 24: (13, 14), 25: (13, 14), 26: (13, 14),
                       27: (13, 15), 28: (13, 15)})
        straps = [(19, 12), (20, 12)]
        neck = [(19, 12, 12)]
    else:  # up
        torso = _rows({19: (6, 12), 20: (5, 13), 21: (5, 13), 22: (5, 13), 23: (5, 13), 24: (5, 13),
                       25: (4, 14), 26: (4, 14), 27: (3, 15), 28: (3, 15)})
        arm = _rows({20: (3, 4), 21: (2, 4), 22: (2, 4), 23: (2, 4), 24: (2, 4), 25: (2, 3)})
        arm |= arm[:, ::-1]
        apron = np.zeros_like(torso)
        straps = [(19, 7), (20, 7), (19, 11), (20, 11)]
        neck = []
    if view == "down":
        arm |= arm[:, ::-1]  # the right arm too (the sack covers most of it)
    body = torso | arm
    # the dress: lit on the west, shade on the east and the hem
    t[torso] = c("8")
    cols = np.where(torso.any(0))[0]
    for y in range(19, 29):
        xs = np.where(torso[y])[0]
        if len(xs):
            t[y, xs[0] : xs[0] + 2] = c("9")
            t[y, xs[-1]] = c("7")
    t[28][torso[28]] = c("7")
    # sleeves: green to the elbow, a 1 px parchment cuff where they are rolled, bare forearms and hands
    ys = sorted(set(np.where(arm)[0]))
    for y in ys:
        xs = np.where(arm[y])[0]
        k = y - ys[0]
        name = "8" if k < 2 else ("g" if k == 2 else ("h" if k < 5 else "i"))
        t[y, xs] = c(name)
    for y, x0, x1 in neck:  # the neckline: skin
        t[y, x0 : x1 + 1] = c("h")
    # the apron: parchment, a sand shade down its east side, flour on it
    t[apron] = c("g")
    for y in range(19, 29):
        xs = np.where(apron[y])[0]
        if len(xs) > 2:
            t[y, xs[-1]] = c("f")
    for y, x in straps:
        t[y, x] = c("g")
    _outline(t, body, ~head)
    del cols


def down(mara: np.ndarray) -> np.ndarray:
    t = mara.copy()
    # the headscarf: rows 4-10 replaced (no bun: a low round crown from row 5)
    t[0:11] = -1
    _dome(t, {5: (6, 12), 6: (5, 13), 7: (4, 14), 8: (3, 15), 9: (3, 15), 10: (3, 15)})
    _patch(t, 6, 0, ["......5553.........", ".....555533........"])
    t[10, 4:15] = CH.index("2")  # the folded front edge over the brow
    t[9, 13:15] = CH.index("2")
    # the knot at the left of the nape (the viewer's right): two tails standing out
    _patch(t, 8, 15, ["000 ", "3330", "3220", "000 "])
    _body(t, "down")
    # flecks of flour on the apron (each 2 px)
    _patch(t, 23, 0, ["........66.........", "...................", "...........66......", "...................",
                      ".......66.........."])
    # the sack on her left hip (the viewer's right), over the arm that holds it
    _patch(t, 20, 13, SACK)
    return t


def right(mara: np.ndarray) -> np.ndarray:
    t = mara.copy()
    t[0:11] = -1
    _dome(t, {5: (6, 12), 6: (5, 13), 7: (4, 14), 8: (3, 15), 9: (2, 16), 10: (2, 17)})
    _patch(t, 6, 0, ["......5553.........", ".....55553........", "....55333........."])
    t[10, 11:17] = CH.index("2")  # the front edge over the brow
    # the knot at the nape (behind her, the viewer's left): tails out past the scarf
    _patch(t, 9, 0, [" 00", "0330", "032 ", " 00"])
    t[11, 3] = 0
    _body(t, "right")
    _patch(t, 24, 13, ["66"])
    # the sack carried at her front hip
    _patch(t, 20, 13, SACK)
    return t


def up(mara: np.ndarray) -> np.ndarray:
    t = mara.copy()
    # from behind: the scarf's crown (no bun) and its point hanging over the nape; red hair either side of it
    t[0:16] = -1
    _dome(t, {5: (7, 11), 6: (5, 13), 7: (4, 14), 8: (3, 15), 9: (3, 15), 10: (3, 15), 11: (3, 15), 12: (3, 15),
              13: (3, 15)})
    _patch(t, 6, 0, [".......553........", "......5553........", ".....5533........."])
    t[12:14, 4:15] = CH.index("2")
    # R32-1: the hair either side of the point in red with a 2 px rose highlight (wine read as a dark mask at 1x)
    _patch(t, 13, 3, ["0mm0222220ml0", "0lll02220lll0", ".0lll020lll0.", "..0000000000.."[:13]])
    _recolour(t, (17, 18, 0, 20), {"k": "l"})
    _body(t, "up")
    # the apron's strings round the waist and their bow at the small of the back
    for x in range(5, 14):
        t[23, x] = CH.index("g")
    _patch(t, 22, 7, ["0g0g0", "0ggg0", ".0g0."])
    # the sack on her left hip (from behind, the viewer's left)
    _patch(t, 20, 0, [r[::-1] for r in SACK])
    return t


def build(mara: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """mara: npc_mara_<down|up|right>_0 as palette indices. Returns Senna's three base frames."""
    return {
        "npc_senna_down_0": down(mara["npc_mara_down_0"]),
        "npc_senna_right_0": right(mara["npc_mara_right_0"]),
        "npc_senna_up_0": up(mara["npc_mara_up_0"]),
    }
