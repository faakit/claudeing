"""Channel tiles (The Dry Year M4, the Old Spring's verb): a dug ditch, dry or with water, autotiled by its four
neighbours, plus the stone culvert where a channel passes under a path and the mouth where it opens into the creek.

The game paints these at runtime (WorldScene.paintChannel, src/art/channelTiles.ts), so they are not requested by
the maps: authored.build appends them at the END of the tileset, after every baked tile, and the game looks them up
by name in tiles.json. Existing map gids never move because of them.

    chan:<wet|dry>:<mask>   the ditch; mask = N1 E2 S4 W8, a bit set where the neighbour is a channel (a culvert
                            counts) or creek water. Drawn over the ground layer (transparent outside the cut).
    culvert:<mask>          stone headwalls over a path cell (its shade layer); mask = the channel sides.
    chanmouth:<n|e|s|w>     on a creek cell (its shade layer): the cut through the creek's bank, coming from that side.

Shape, light from the top left, 3/4 view (the art critic's acceptance points, review 20):
  - the cut is 10 px wide (3..12), centred, and runs to the tile edge on connected sides, so every corner, T, cross
    and dead end joins;
  - inside the cut: a 3 px shadowed north face and a 2 px shadowed west face (plum shadow over earth dark), a 2 px
    lit south and east lip (wood), never 1 px;
  - dry: a recessed earth-dark bed with soil clods and 2x2 pebbles (not the tilled soil's furrows, not a path);
  - wet: water inside the same banks, a 2 px dusk-blue shade under the north face and 2 px sky glints.
Every feature is 2 px or more, every pixel opaque or transparent (no alpha).
"""
from __future__ import annotations

import numpy as np

T = 16
N, E, S, W = 1, 2, 4, 8
DIRS = {"n": N, "e": E, "s": S, "w": W}
LO, HI = 3, 13  # the cut spans [LO, HI) across the run
PAD = 4  # the cut is computed on a padded canvas, so faces and lips at a seam match the neighbour


def cut_mask(mask: int) -> np.ndarray:
    """The hole on a (T + 2 PAD)^2 canvas: the centre square plus an arm to each connected edge, continued past it
    (the neighbour's arm), so faces near a seam see the same hole the neighbour does."""
    n = T + 2 * PAD
    h = np.zeros((n, n), dtype=bool)
    a, b = LO + PAD, HI + PAD
    h[a:b, a:b] = True
    if mask & N:
        h[:b, a:b] = True
    if mask & S:
        h[a:, a:b] = True
    if mask & W:
        h[a:b, :b] = True
    if mask & E:
        h[a:b, a:] = True
    return h


def _shift(h: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """h moved by (dy, dx), padding with False (outside the hole)."""
    out = np.zeros_like(h)
    n = h.shape[0]
    ys = slice(max(dy, 0), n + min(dy, 0))
    yd = slice(max(-dy, 0), n + min(-dy, 0))
    xs = slice(max(dx, 0), n + min(dx, 0))
    xd = slice(max(-dx, 0), n + min(-dx, 0))
    out[ys, xs] = h[yd, xd]
    return out


def rim(mask: int) -> np.ndarray:
    """R21-1: a 2 px earth-dark rim just outside the lit south and east lips (on the ground), so a crop beside the
    channel stands on dark soil instead of melting into the wood lip (leaf mid on wood was about 1.2:1)."""
    h = cut_mask(mask)
    out = ~h & (_shift(h, 1, 0) | _shift(h, 2, 0) | _shift(h, 0, 1) | _shift(h, 0, 2))
    s = slice(PAD, PAD + T)
    return out[s, s]


def bands(mask: int):
    """Per pixel of the tile: inside the cut, and which bank band it is in (north face, west face, south lip,
    east lip), else the bed."""
    h = cut_mask(mask)
    above = lambda k: _shift(h, k, 0)  # noqa: E731  (the pixel k rows up is in the hole)
    left = lambda k: _shift(h, 0, k)  # noqa: E731
    below = lambda k: _shift(h, -k, 0)  # noqa: E731
    right = lambda k: _shift(h, 0, -k)  # noqa: E731
    north = h & ~(above(1) & above(2) & above(3))
    west = h & ~(left(1) & left(2))
    south = h & ~(below(1) & below(2))
    east = h & ~(right(1) & right(2))
    s = slice(PAD, PAD + T)
    crop = lambda a: a[s, s]  # noqa: E731
    return crop(h), crop(north), crop(west), crop(south), crop(east)


def _hash(*v: int) -> int:
    x = 2166136261
    for k in v:
        x = ((x ^ (k & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return x


def _blocks(spots, bed: np.ndarray, t: np.ndarray, colour: int, size=(2, 2)) -> None:
    """Paint size-px blocks at spots that lie wholly on the bed (so nothing touches a bank or a seam)."""
    hh, ww = size
    for y, x in spots:
        if y + hh <= T and x + ww <= T and bed[y : y + hh, x : x + ww].all():
            t[y : y + hh, x : x + ww] = colour


def _bed_spots(mask: int, salt: int, n: int):
    """Deterministic spots on a 2 px lattice (so blocks never land 1 px apart)."""
    out = []
    for i in range(n):
        h = _hash(mask, salt, i)
        out.append(((h % 7) * 2 + 1, ((h >> 4) % 7) * 2 + 1))
    return out


def channel(P, look: str, mask: int) -> np.ndarray:
    hole, north, west, south, east = bands(mask)
    t = np.full((T, T), -1, dtype=np.int32)
    shadow, face, lip = P.name("plum shadow"), P.name("earth dark"), P.name("wood")
    bed = hole & ~(north | west | south | east)
    if look == "dry":
        t[hole] = face
        # the bed: dark earth with lighter soil clods and pale pebbles, on a 2 px lattice
        _blocks(_bed_spots(mask, 3, 9), bed, t, P.name("soil"))
        _blocks(_bed_spots(mask, 7, 4), bed, t, P.name("stone"))
        _blocks(_bed_spots(mask, 11, 2), bed, t, P.name("taupe"))
    else:
        t[hole] = P.name("water")
        # shade on the water under the north face: the 2 rows below it
        shade = bed & (_shift_t(north, 1) | _shift_t(north, 2))
        t[shade] = P.name("dusk blue")
        # glints: short 2 px tall sky dashes on open water, away from the shade
        open_water = bed & ~shade
        for y, x in _bed_spots(mask, 5, 5):
            if y + 2 <= T and x + 3 <= T and open_water[y : y + 2, x : x + 3].all():
                t[y : y + 2, x : x + 3] = P.name("sky")
                break
    # banks: lit lips first, then the shadowed faces over them (a corner takes the shadow)
    t[south | east] = lip
    t[west] = face if look == "wet" else shadow
    t[north] = shadow
    t[rim(mask)] = face
    # the north face's top 2 rows read as the cut edge; below them, in a wet ditch, a muddy 1-row step would be
    # 1 px, so the face is a solid 3 px block
    return t


def _shift_t(a: np.ndarray, dy: int) -> np.ndarray:
    """a moved down by dy rows inside the tile (up when dy < 0), False where it comes in from outside."""
    out = np.zeros_like(a)
    if dy >= 0:
        out[dy:] = a[: T - dy]
    else:
        out[:dy] = a[-dy:]
    return out


def culvert(P, mask: int) -> np.ndarray:
    """Stone headwalls on a path cell, one per channel side: the path itself stays (the overlay is transparent
    elsewhere). Facing the viewer (south) the wall shows its dark mouth; the other sides show the wall's cap.
    R21-3: the walls are 6 px deep (a 2 px lit cap, 2 px of stone, a 2 px dark foot) and 4 px wider than the cut,
    so they read as masonry across a 2-wide path, not as a thin kerb."""
    t = np.full((T, T), -1, dtype=np.int32)
    dark, mid, lt, gap = P.name("stone dark"), P.name("stone"), P.name("stone lt"), P.name("night navy")
    ink = P.name("ink")
    a, b = LO - 2, HI + 2  # the wall is 4 px wider than the cut
    if mask & N:
        t[0:6, a:b] = mid
        t[0:2, a:b] = lt
        t[4:6, a:b] = dark
        t[2:4, a:a + 2] = dark
        t[2:4, b - 2:b] = dark
    if mask & S:
        t[8:16, a:b] = mid
        t[8:10, a:b] = lt
        t[12:16, LO + 1:HI - 1] = gap  # the mouth under the path
        t[14:16, LO + 1:HI - 1] = P.name("dusk blue")
        t[10:16, a:a + 2] = dark
        t[10:16, b - 2:b] = dark
        t[10:12, LO + 1:HI - 1] = ink  # the arch's shadowed lintel
    if mask & W:
        t[a:b, 0:6] = mid
        t[a:b, 0:2] = lt
        t[b - 2:b, 0:6] = dark
        t[a:a + 2, 4:6] = dark
    if mask & E:
        t[a:b, 10:16] = mid
        t[a:b, 14:16] = lt
        t[LO + 1:HI - 1, 10:12] = gap
        t[b - 2:b, 10:16] = dark
    return t


def mouth(P, side: str) -> np.ndarray:
    """The cut through the creek's bank, from `side` (the channel's side of this creek cell): the ditch's banks
    and water run 6 px in from that edge, over the creek's own bank (at most 5 px wide), and stop in its water."""
    m = DIRS[side]
    full = channel(P, "wet", m | {N: S, S: N, E: W, W: E}[m])  # a straight run through the cell
    t = np.full((T, T), -1, dtype=np.int32)
    k = 6
    if side == "w":
        t[:, :k] = full[:, :k]
    elif side == "e":
        t[:, T - k:] = full[:, T - k:]
    elif side == "n":
        t[:k] = full[:k]
    else:
        t[T - k:] = full[T - k:]
    return t


def channel_winter(P, mask: int) -> np.ndarray:
    """R21-2: a wet channel in winter: the season's shore remap (sand lips), dark open water, and a 2 px ice-white
    edge frozen along the lit lips. Replaces the generic remap in tiles_winter.png (tiles_extra.SEASON_OVERRIDES)."""
    hole, north, west, south, east = bands(mask)
    t = channel(P, "wet", mask)
    bed = hole & ~(north | west | south | east)
    t[bed] = P.name("water")
    near = np.zeros_like(bed)
    for k in (1, 2):
        near |= _shift_t(south, -k)
        near[:, : T - k] |= east[:, k:]
    t[bed & near] = P.name("ice white")
    t[south | east] = P.name("sand")  # the winter ground remap's lip (wood -> sand)
    return t


def mouth_winter(P, side: str) -> np.ndarray:
    m = DIRS[side]
    full = channel_winter(P, m | {N: S, S: N, E: W, W: E}[m])
    t = np.full((T, T), -1, dtype=np.int32)
    k = 6
    sl = {"w": (slice(None), slice(0, k)), "e": (slice(None), slice(T - k, T)),
          "n": (slice(0, k), slice(None)), "s": (slice(T - k, T), slice(None))}[side]
    t[sl] = full[sl]
    return t


def build(P) -> dict[str, np.ndarray]:
    import tiles_extra

    winter = tiles_extra.SEASON_OVERRIDES.setdefault("winter", {})
    for m in range(16):
        winter[f"chan:wet:{m}"] = channel_winter(P, m)
    for d in DIRS:
        winter[f"chanmouth:{d}"] = mouth_winter(P, d)
    out: dict[str, np.ndarray] = {}
    for look in ("dry", "wet"):
        for m in range(16):
            out[f"chan:{look}:{m}"] = channel(P, look, m)
    for m in range(1, 16):
        out[f"culvert:{m}"] = culvert(P, m)
    for d in DIRS:
        out[f"chanmouth:{d}"] = mouth(P, d)
    return out
