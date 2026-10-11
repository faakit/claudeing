"""Player animation frames from Google Flow sheets (art round 5): tools and common actions.

Each Flow sheet (`anim_<name>`, prompts.md 31-41) is 3 rows (facing down, back view, facing right) x 5 frames
(wind-up, swing, contact, follow-through, rest) on magenta. Per frame:
  1. cut the cell out of the sheet (row bands and column bands from the magenta gaps);
  2. sample it to native pixels on the sheet's own grid and quantize to the palette;
  3. align it to the player's idle frame by the head (top row and centre of the hair), so the head never drifts;
  4. clear the generated head and paste the idle frame's head pixel for pixel (fidelity: the head is always ours);
  5. place it on the round-4 canvas (32 x 32, the body at x 8..23, the feet on row 31; 32 x 36 for the hoe and
     pickaxe facing down, where the blade reaches 4 px below the feet) and re-ink the silhouette edge.

    python art-src/tools/flowanim.py --preview <out_dir>   (contact sheets of every sheet, before wiring)
Raw sheets: C:/Users/andre/dev/tiny-acre/flow-raw/anim_<name>-<a|b>.jpg; crops kept in art-src/flow/crops/.
"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixelart as px  # noqa: E402

RAW = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "flow-raw"))
DIRS = ("down", "up", "right")
KEY = (255, 0, 255)


def bands(mask_1d: np.ndarray, want: int, min_gap: int = 6) -> list[tuple[int, int]]:
    """Runs of True in a 1-D occupancy profile, merged across gaps narrower than min_gap; the `want` largest."""
    runs, start, gap = [], None, 0
    for i, v in enumerate(mask_1d):
        if v:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                runs.append((start, i - gap + 1))
                start, gap = None, 0
    if start is not None:
        runs.append((start, len(mask_1d) - gap))
    runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:want]
    return sorted(runs)


def _box_sum(m: np.ndarray, k: int) -> np.ndarray:
    """Sum of m over the k x k window whose top-left is each pixel (zero-padded), via an integral image."""
    H, W = m.shape
    ii = np.zeros((H + k + 1, W + k + 1), dtype=np.int64)
    ii[1 : H + 1, 1 : W + 1] = np.cumsum(np.cumsum(m.astype(np.int64), 0), 1)
    ii[H + 1 :, :] = ii[H : H + 1, :]
    ii[:, W + 1 :] = ii[:, W : W + 1]
    return ii[k : k + H, k : k + W] - ii[:H, k : k + W] - ii[k : k + H, :W] + ii[:H, :W]


def _open(m: np.ndarray, k: int) -> np.ndarray:
    """Binary opening with a k x k square (erode, then dilate), numpy only."""
    er = _box_sum(m, k) == k * k  # the window starting here is all set
    H, W = m.shape
    # dilate: a pixel is set when some eroded window covers it (window top-left within k-1 up and left)
    pad = np.zeros((H + k - 1, W + k - 1), dtype=bool)
    pad[k - 1 :, k - 1 :] = er
    return _box_sum(pad, k)[:H, :W] > 0


HAIR = dict(r=(80, 215), g=(35, 150), b=(0, 110))


def hair_mask(rgb: np.ndarray, fg: np.ndarray) -> np.ndarray:
    r, g, b = (rgb[..., k].astype(int) for k in range(3))
    return fg & (r > 80) & (r < 215) & (g > 35) & (g < 150) & (b < 110) & (r > g + 25) & (g > b)


def heads(rgb: np.ndarray, fg: np.ndarray) -> list[tuple[float, float]]:
    """(x, y) centres of the farmers' heads: brown hair, opened so thin wooden handles vanish, one per head."""
    opened = _open(hair_mask(rgb, fg), 24)  # about 2.4 native px: handles are 1-2 native px wide
    pts = [((c[1] + c[3]) / 2, (c[2] + c[4]) / 2, c[0]) for c in px.components(opened, 900)]
    pts.sort(key=lambda p: -p[2])
    out: list[tuple[float, float]] = []
    for x, y, _ in pts:  # a parting can split one head into two blobs: drop blobs close to a bigger one
        if all(abs(x - ox) > 90 or abs(y - oy) > 90 for ox, oy in out):
            out.append((x, y))
    return out


def cells(img: np.ndarray, rows: int = 3) -> list[list[np.ndarray]]:
    """Cut a sheet into rows of RGBA frames (magenta keyed to alpha 0), one per farmer: the heads are found first,
    grouped into `rows` rows by height, and each frame is a generous window around its head (rows overlap: a raised
    tool reaches into the row above) keeping only the connected group that holds the head. The model does not
    always draw five frames a row; the caller maps what it gets."""
    rgb = img[..., :3]
    fg = px.key_mask(rgb, KEY, 110)  # True on the sprite (not the key colour)
    H, W = fg.shape
    hs = heads(rgb, fg)
    ys = sorted(y for _, y in hs)
    # split the head heights into `rows` groups at the biggest gaps
    gaps = sorted(range(1, len(ys)), key=lambda i: ys[i] - ys[i - 1], reverse=True)[: rows - 1]
    bounds = [ys[0] - 1] + sorted((ys[i] + ys[i - 1]) / 2 for i in gaps) + [ys[-1] + 1]
    out = []
    for j in range(rows):
        row_heads = sorted((x, y) for x, y in hs if bounds[j] <= y < bounds[j + 1])
        xs = [x for x, _ in row_heads]
        cuts = [0] + [int((a + b) / 2) for a, b in zip(xs, xs[1:])] + [W]
        row = []
        for (hx, hy), x0, x1 in zip(row_heads, cuts, cuts[1:]):
            y0, y1 = max(0, int(hy - 240)), min(H, int(hy + 260))
            win = fg[y0:y1, x0:x1]
            comps = px.components(win, 6)
            if not comps:
                continue
            groups = px.group_sprites(comps, 14)
            cx, cy = hx - x0, hy - y0
            def dist(g):
                return 0 if g[0] <= cx <= g[2] and g[1] <= cy <= g[3] else min(abs(cx - g[0]), abs(cx - g[2])) + min(abs(cy - g[1]), abs(cy - g[3]))
            g = min(groups, key=dist)
            keep = np.zeros_like(win)
            for c in comps:
                if c[1] >= g[0] and c[3] <= g[2] and c[2] >= g[1] and c[4] <= g[3]:
                    for yy, xx in c[5]:
                        keep[yy, xx] = True
            c = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
            c[..., :3] = rgb[y0:y1, x0:x1]
            c[..., 3] = np.where(keep, 255, 0)
            row.append((c, (hx - x0, hy - y0)))
        out.append(row)
    return out


def native(cell: np.ndarray, p: float, phx: float, phy: float, hx: float, hy: float):
    """Sample to native pixels (px.sample_native's rule, without its trim, so the head centre maps exactly);
    returns (frame trimmed to its opaque box, head centre in that frame's pixels)."""
    rgb, a = cell[..., :3], cell[..., 3] > 0
    h, w = a.shape
    gx0 = phx - p * np.ceil(phx / p)
    gy0 = phy - p * np.ceil(phy / p)
    xs, ys = np.arange(gx0, w, p), np.arange(gy0, h, p)
    out = np.zeros((len(ys), len(xs), 4), dtype=np.uint8)
    m = max(1, int(p * 0.22))
    for j, y0 in enumerate(ys):
        for i, x0 in enumerate(xs):
            a0, a1, b0, b1 = int(round(y0)), int(round(y0 + p)), int(round(x0)), int(round(x0 + p))
            cy0, cy1, cx0, cx1 = max(0, a0), min(h, a1), max(0, b0), min(w, b1)
            if cy1 <= cy0 or cx1 <= cx0 or a[cy0:cy1, cx0:cx1].mean() < 0.5:
                continue
            iy0, iy1, ix0, ix1 = max(0, a0 + m), min(h, a1 - m), max(0, b0 + m), min(w, b1 - m)
            if iy1 <= iy0 or ix1 <= ix0:
                iy0, iy1, ix0, ix1 = cy0, cy1, cx0, cx1
            sel = rgb[iy0:iy1, ix0:ix1][a[iy0:iy1, ix0:ix1]]
            if len(sel) == 0:
                sel = rgb[cy0:cy1, cx0:cx1][a[cy0:cy1, cx0:cx1]]
            out[j, i, :3] = np.median(sel, axis=0).astype(np.uint8)
            out[j, i, 3] = 255
    oy, ox = np.nonzero(out[..., 3])
    ty, tx = int(oy.min()), int(ox.min())
    nat = out[ty : int(oy.max()) + 1, tx : int(ox.max()) + 1]
    return nat, ((hx - gx0) / p - tx, (hy - gy0) / p - ty)


def head_box(idx: np.ndarray, hair: set[int], rows: int = 8) -> tuple[int, int, int]:
    """(top row, left, right) of the hair in the top `rows` rows of the figure."""
    ys = np.where((idx >= 0).any(axis=1))[0]
    top = int(ys[0])
    band = idx[top : top + rows]
    cols = np.where(np.isin(band, list(hair)).any(axis=0))[0]
    if len(cols) == 0:
        cols = np.where((band >= 0).any(axis=0))[0]
    return top, int(cols[0]), int(cols[-1])


def sheet_frames(path: str, pal, pal_lab) -> list[list[tuple[np.ndarray, tuple[float, float]]]]:
    """A Flow sheet -> rows of (palette-index frame at native resolution, head centre in that frame's pixels)."""
    img = np.asarray(Image.open(path).convert("RGBA"))
    grid = cells(img)
    big = max((c for r in grid for c, _ in r), key=lambda c: int((c[..., 3] > 0).sum()))
    p, _, _ = px.detect_grid(big[..., :3], big[..., 3] > 0)
    out = []
    for r in grid:
        row = []
        for c, (hx, hy) in r:
            _, phx, phy = px.detect_grid(c[..., :3], c[..., 3] > 0)
            nat, head = native(c, p, phx, phy, hx, hy)
            row.append((px.quantize(nat, pal, pal_lab), head))
        out.append(row)
    return out


def preview(out_dir: str) -> None:
    pal = px.load_gpl(os.path.join(HERE, "..", "..", "public", "assets", "palette.gpl"))
    lab = px.to_lab(np.array(pal, dtype=np.float64))
    os.makedirs(out_dir, exist_ok=True)
    for fn in sorted(os.listdir(RAW)):
        if not fn.startswith("anim_"):
            continue
        frames = [[f for f, _ in r] for r in sheet_frames(os.path.join(RAW, fn), pal, lab)]
        cw = max(f.shape[1] for r in frames for f in r) + 4
        ch = max(f.shape[0] for r in frames for f in r) + 4
        im = Image.new("RGBA", (cw * max(len(r) for r in frames), ch * len(frames)), (116, 176, 67, 255))
        for j, r in enumerate(frames):
            for i, f in enumerate(r):
                im.alpha_composite(Image.fromarray(px.idx_to_rgba(f, pal), "RGBA"), (i * cw + 2, j * ch + ch - 2 - f.shape[0]))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(out_dir, fn.replace(".jpg", ".png")))
        print(fn, [len(r) for r in frames], [f.shape for f in frames[0]])





# ---------------------------------------------------------------- composition on the player's own head

TOOL_COLOURS = ("wood", "stone", "stone dark", "stone lt", "sky", "water", "ice white", "red", "gold", "orange",
                "leaf mid", "leaf dark", "grass", "new leaf", "sand", "parchment")


def keep_main(idx: np.ndarray) -> np.ndarray:
    """Keep the biggest connected group (the farmer and what he holds), dropping a neighbour's stray tip."""
    m = idx >= 0
    comps = px.components(m, 1)
    if not comps:
        return idx
    groups = px.group_sprites(comps, 2)
    best = max(groups, key=lambda g: g[4])
    out = np.full_like(idx, -1)
    x0, y0, x1, y1 = best[0], best[1], best[2], best[3]
    out[y0:y1, x0:x1] = idx[y0:y1, x0:x1]
    return out


def crop(idx: np.ndarray) -> np.ndarray:
    ys = np.where((idx >= 0).any(axis=1))[0]
    xs = np.where((idx >= 0).any(axis=0))[0]
    return idx[ys[0] : ys[-1] + 1, xs[0] : xs[-1] + 1]


def body_rows(idx: np.ndarray, names: list[str]) -> tuple[int, int]:
    """(top, bottom) rows of the farmer himself: tool colours ignored."""
    tool = {names.index(n) for n in TOOL_COLOURS}
    body = (idx >= 0) & ~np.isin(idx, list(tool))
    ys = np.where(body.sum(axis=1) >= 2)[0]
    return int(ys[0]), int(ys[-1])


def head_rect(idx: np.ndarray, names: list[str], height: int) -> tuple[int, int, int, int]:
    """(top, left, right, bottom) of the generated head: the body's top rows, `height` rows deep."""
    tool = {names.index(n) for n in TOOL_COLOURS}
    body = (idx >= 0) & ~np.isin(idx, list(tool))
    top, _ = body_rows(idx, names)
    band = body[top : top + height]
    cols = np.where(band.any(axis=0))[0]
    return top, int(cols[0]), int(cols[-1]), top + height


def idle_head(idle: np.ndarray) -> tuple[np.ndarray, int, int]:
    """The idle frame's head (rows from the crown to the chin outline) and its top row and x centre."""
    ys = np.where((idle >= 0).any(axis=1))[0]
    top = int(ys[0])
    # the chin: the narrowest row below the widest part of the head, searched in the head's usual depth
    widths = [int((idle[y] >= 0).sum()) for y in range(top, top + 16)]
    chin = top + 10 + int(np.argmin(widths[10:15]))
    head = idle[top : chin + 1].copy()
    cols = np.where((head >= 0).any(axis=0))[0]
    return head, top, (cols[0] + cols[-1]) / 2


def largest8(m: np.ndarray) -> np.ndarray:
    """The biggest 8-connected region of a mask."""
    from collections import deque  # noqa: PLC0415

    H, W = m.shape
    seen = np.zeros_like(m, dtype=bool)
    best: list[tuple[int, int]] = []
    for sy, sx in zip(*np.nonzero(m)):
        if seen[sy, sx]:
            continue
        q, pts = deque([(sy, sx)]), []
        seen[sy, sx] = True
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
        if len(pts) > len(best):
            best = pts
    out = np.zeros_like(m, dtype=bool)
    for y, x in best:
        out[y, x] = True
    return out


FRAME_H, FEET = 44, 39  # the Flow-based action frames: 32 x 44, 12 rows of headroom, the feet on row 39


def compose(names: list[str], frame: np.ndarray, head_xy: tuple[float, float], idle: np.ndarray, rest_h: int,
            H: int = FRAME_H) -> np.ndarray:
    """One Flow frame (native, quantized) on the 32 x 44 canvas: scaled so the standing farmer is the idle frame's
    height, the feet on row 39, the generated head replaced by the idle head (same pixels), re-inked. head_xy is the
    generated head's centre (from the hair blob on the raw sheet) in the frame's pixels."""
    f = frame.copy()
    hx, hy = head_xy
    ys = np.where((idle >= 0).any(axis=1))[0]
    target = int(ys[-1] - ys[0] + 1)  # 28
    if abs(rest_h - target) > 1:  # scale the whole row by the same factor (on the native grid, ink kept)
        s = target / rest_h
        f = px.downscale_idx(f, max(1, round(f.shape[1] * s)), max(1, round(f.shape[0] * s)), names.index("ink"))
        hx, hy = hx * s, hy * s
    head, htop, hcx = idle_head(idle)
    hh, hw = head.shape[0], int((head >= 0).any(axis=0).sum())
    tool = {names.index(n) for n in TOOL_COLOURS}
    cx, cy = int(round(hx)), int(round(hy))
    if not (0 <= cx < f.shape[1] and 0 <= cy < f.shape[0]) or f.shape[1] < 12:
        return None  # not a farmer (a split-off fragment): the caller skips it
    # the generated head's crown: walk up from the hair centre while the pixel is part of the head (not a tool)
    top = min(max(0, cy), f.shape[0] - 1)
    while top > 0 and f[top - 1, cx] >= 0 and f[top - 1, cx] not in tool:
        top -= 1
    left, right = max(0, cx - hw // 2 - 2), cx + hw // 2 + 2
    region = f[top : top + hh, left : right + 1]
    # the generated head is the solid blob in that box: an opening drops 1-2 px handles and arms crossing it,
    # so a tool behind or in front of the head survives the clear; the blob (grown 1 px for its outline) goes
    body = (region >= 0) & ~np.isin(region, list(tool))
    blob = _open(body, 3)
    grow = blob.copy()
    grow[1:] |= blob[:-1]
    grow[:-1] |= blob[1:]
    grow[:, 1:] |= blob[:, :-1]
    grow[:, :-1] |= blob[:, 1:]
    region[grow & body] = -1
    canvas = np.full((H, 32), -1, dtype=np.int32)
    _, feet = body_rows(f, names)
    oy = FEET - feet
    ox = int(round(8 + hcx - cx))  # the generated head's centre on the idle head's centre
    for y in range(f.shape[0]):
        for x in range(f.shape[1]):
            if f[y, x] >= 0 and 0 <= y + oy < H and 0 <= x + ox < 32:
                canvas[y + oy, x + ox] = f[y, x]
    hy0 = top + oy
    for y in range(hh):
        for x in range(head.shape[1]):
            if head[y, x] >= 0 and 0 <= hy0 + y < H:
                canvas[hy0 + y, 8 + x] = head[y, x]
    # no detached pieces (review 18): only the farmer's own 8-connected piece stays
    keep = largest8(canvas >= 0)
    canvas[~keep] = -1
    from anim import fix_edges  # noqa: PLC0415

    fix_edges(canvas, 0, 32, max(0, hy0 - 1), min(H, hy0 + hh + 2))
    return canvas


def compose_sheet(names, path: str, idle: dict[str, np.ndarray], pal, lab) -> list[list[np.ndarray]]:
    """Every frame of a sheet composed on the player's head; row r uses the idle frame of DIRS[r]."""
    rows = sheet_frames(path, pal, lab)
    out = []
    for r, frames in enumerate(rows):
        d = DIRS[r]
        t, b = body_rows(frames[-1][0], names)  # the last frame is the farmer at rest
        out.append([c for c in (compose(names, f, h, idle[d], b - t + 1) for f, h in frames) if c is not None])
    return out


def preview_composed(out_dir: str, only: str = "") -> None:
    import drawn  # noqa: PLC0415

    gpl = os.path.join(HERE, "..", "..", "public", "assets", "palette.gpl")
    pal, names = px.load_gpl(gpl), px.load_gpl_names(gpl)
    lab = px.to_lab(np.array(pal, dtype=np.float64))
    spr = os.path.join(HERE, "..", "sprites", "chars")
    idle = {d: drawn.to_idx(np.asarray(Image.open(os.path.join(spr, f"player_idle_{d}_0.png")).convert("RGBA")), pal) for d in DIRS}
    os.makedirs(out_dir, exist_ok=True)
    for fn in sorted(os.listdir(RAW)):
        if not fn.startswith("anim_") or only not in fn:
            continue
        rows = compose_sheet(names, os.path.join(RAW, fn), idle, pal, lab)
        n = max(len(r) for r in rows)
        im = Image.new("RGBA", (34 * (n + 1), 46 * len(rows)), (116, 176, 67, 255))
        for j, r in enumerate(rows):
            pad = np.full((FRAME_H, 32), -1, dtype=np.int32)
            pad[FEET - 31 : FEET + 1, 8:24] = idle[DIRS[j]]
            im.alpha_composite(Image.fromarray(px.idx_to_rgba(pad, pal), "RGBA"), (1, j * 46 + 1))
            for i, f in enumerate(r):
                im.alpha_composite(Image.fromarray(px.idx_to_rgba(f, pal), "RGBA"), ((i + 1) * 34 + 1, j * 46 + 1))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(out_dir, "c_" + fn.replace(".jpg", ".png")))
        print(fn)


# ---------------------------------------------------------------- the chosen frames, extraction and build

# anim -> dir -> (variant, frame indices in the detected row). 5 frames: wind-up, swing, contact, follow-through,
# rest; where the model drew only 4 (or 3), the contact is still index 2 and the last frame is the rest.
SELECT: dict[str, dict[str, tuple[str, list[int]]]] = {
    # review 18: the tools stay on the round-4 code-drawn frames; pet, reel and place are drawn in code
    # (codeacts.py). Kept from Flow, cleaned: harvest (down, right), plant (down, up), eat (all three). Frame 0
    # (the farmer simply standing) is replaced by the idle frame at build time ("IDLE_FIRST").
    "plant": {"down": ("b", [0, 1, 2, 3, 4]), "up": ("b", [0, 1, 2, 3, 4])},
    "harvest": {"down": ("b", [0, 1, 2, 3, 4]), "right": ("b", [0, 1, 2, 3, 4])},
    "eat": {"down": ("a", [0, 1, 2, 3]), "up": ("a", [0, 1, 2, 3]), "right": ("a", [0, 1, 2, 3])},
}
IDLE_FIRST = {"plant", "harvest"}
IDLE_LAST = {"plant"}  # standing up again: the idle frame (Flow's standing body was three-quarter)
CROPS = os.path.normpath(os.path.join(HERE, "..", "flow", "crops", "anim"))


def extract() -> None:
    """Raw sheets (outside the repo) -> the chosen native frames as small on-palette PNGs + their head centres."""
    import json  # noqa: PLC0415

    gpl = os.path.join(HERE, "..", "..", "public", "assets", "palette.gpl")
    pal = px.load_gpl(gpl)
    names = px.load_gpl_names(gpl)
    lab = px.to_lab(np.array(pal, dtype=np.float64))
    os.makedirs(CROPS, exist_ok=True)
    meta: dict = {}
    for anim, dirs in SELECT.items():
        cache: dict[str, list] = {}
        for d, (v, picks) in dirs.items():
            path = os.path.join(RAW, f"anim_{anim}-{v}.jpg")
            if not os.path.exists(path):
                print("missing", path)
                continue
            if v not in cache:
                cache[v] = sheet_frames(path, pal, lab)
            row = cache[v][DIRS.index(d)]
            rest, _ = row[min(picks[-1], len(row) - 1)]
            t, b = body_rows(rest, names)
            meta.setdefault(anim, {})[d] = {"source": f"anim_{anim}-{v}", "rest_h": b - t + 1, "frames": []}
            for i, k in enumerate(picks):
                if k >= len(row):
                    continue
                f, (hx, hy) = row[k]
                Image.fromarray(px.idx_to_rgba(f, pal), "RGBA").save(os.path.join(CROPS, f"{anim}_{d}_{i}.png"))
                meta[anim][d]["frames"].append({"head": [round(hx, 2), round(hy, 2)], "from": k})
    with open(os.path.join(CROPS, "frames.json"), "w", newline="\n") as fh:
        json.dump(meta, fh, indent=1)
        fh.write("\n")
    print("extracted", sum(len(d["frames"]) for a in meta.values() for d in a.values()), "frames")


def build(names: list[str], pal, idle: dict[str, np.ndarray], to_idx) -> dict[str, np.ndarray]:
    """The committed crops composed on the player's own head: player_act_<anim>_<dir>_<i>, 32 x 44, feet row 39."""
    import json  # noqa: PLC0415

    path = os.path.join(CROPS, "frames.json")
    if not os.path.exists(path):
        return {}
    meta = json.load(open(path))
    out = {}
    for anim, dirs in meta.items():
        for d, m in dirs.items():
            k = 0  # renumbered, so a skipped fragment leaves no gap
            for i, fr in enumerate(m["frames"]):
                last = i == len(m["frames"]) - 1
                if (i == 0 and anim in IDLE_FIRST) or (last and anim in IDLE_LAST):  # standing: the idle frame
                    c = np.full((FRAME_H, 32), -1, dtype=np.int32)
                    c[FEET - 31 : FEET + 1, 8:24] = idle[d]
                    out[f"player_act_{anim}_{d}_{k}"] = c
                    k += 1
                    continue
                rgba = np.asarray(Image.open(os.path.join(CROPS, f"{anim}_{d}_{i}.png")).convert("RGBA"))
                c = compose(names, to_idx(rgba), tuple(fr["head"]), idle[d], m["rest_h"])
                if c is not None:
                    out[f"player_act_{anim}_{d}_{k}"] = c
                    k += 1
    return out


def frame_counts(meta_path: str = os.path.join(CROPS, "frames.json")) -> dict[str, dict[str, int]]:
    import json  # noqa: PLC0415

    meta = json.load(open(meta_path))
    return {a: {d: len(m["frames"]) for d, m in dirs.items()} for a, dirs in meta.items()}


if __name__ == "__main__":
    if "--preview" in sys.argv:
        preview(sys.argv[sys.argv.index("--preview") + 1])
    if "--composed" in sys.argv:
        i = sys.argv.index("--composed")
        preview_composed(sys.argv[i + 1], sys.argv[i + 2] if len(sys.argv) > i + 2 else "")
    if "--extract" in sys.argv:
        extract()
