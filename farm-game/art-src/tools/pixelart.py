"""Deterministic helpers that turn Google Flow output (raw source material) into grid-true pixel art.

Steps: chroma-key the flat background (with tolerance, the images are JPEG), find the separate sprites as
connected components, detect each sprite's native pixel grid, sample one colour per native cell (median),
downscale to the target size by coverage-weighted mode over palette indices (never bilinear), drop stray
pixels and redraw a clean 1 px outline in the darkest palette brown.
"""
from __future__ import annotations

from collections import Counter, deque

import numpy as np
from PIL import Image

# ---------------------------------------------------------------- palette


def load_gpl(path: str) -> list[tuple[int, int, int]]:
    cols = []
    for line in open(path, encoding="utf8"):
        parts = line.split()
        if len(parts) >= 3 and all(p.isdigit() for p in parts[:3]):
            cols.append(tuple(int(p) for p in parts[:3]))
    return cols


def write_gpl(path: str, cols, names=None) -> None:
    with open(path, "w", encoding="utf8", newline="\n") as f:
        f.write("GIMP Palette\nName: Tiny Acre\nColumns: 8\n#\n")
        for i, c in enumerate(cols):
            n = names[i] if names else f"c{i:02d}"
            f.write(f"{c[0]:3d} {c[1]:3d} {c[2]:3d}\t{n}\n")


def to_lab(rgb: np.ndarray) -> np.ndarray:
    """sRGB (0-255, shape (...,3)) to CIE Lab, for perceptual nearest-colour matching."""
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def nearest_index(rgb: np.ndarray, pal_lab: np.ndarray) -> np.ndarray:
    lab = to_lab(rgb)
    d = ((lab[..., None, :] - pal_lab) ** 2).sum(-1)
    return d.argmin(-1)


# ---------------------------------------------------------------- keying and components


def key_mask(img: np.ndarray, key=(255, 0, 255), tol=110.0) -> np.ndarray:
    """True where the pixel is sprite (not background). Distance in RGB plus a magenta-ness test."""
    f = img.astype(np.float64)
    d = np.sqrt(((f - np.array(key, dtype=np.float64)) ** 2).sum(-1))
    fg = d > tol
    if key == (255, 0, 255):
        r, g, b = f[..., 0], f[..., 1], f[..., 2]
        magenta = (r > 150) & (b > 150) & (g < 0.55 * np.minimum(r, b))
        fg &= ~magenta
    return fg


def components(mask: np.ndarray, min_area: int = 30):
    """4-connected components of a boolean mask -> list of (area, x0, y0, x1, y1, pixel index list)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys.tolist(), xs.tolist()):
        if seen[sy, sx]:
            continue
        q = deque([(sy, sx)])
        seen[sy, sx] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pts) < min_area:
            continue
        py = [p[0] for p in pts]
        px = [p[1] for p in pts]
        out.append([len(pts), min(px), min(py), max(px) + 1, max(py) + 1, pts])
    return out


def group_sprites(comps, merge_gap: int = 12):
    """Merge components whose boxes are within `merge_gap` px (detached leaves, stems) into sprites."""
    boxes = [[c[1], c[2], c[3], c[4], c[0]] for c in comps]
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if (
                    a[0] - merge_gap < b[2]
                    and b[0] - merge_gap < a[2]
                    and a[1] - merge_gap < b[3]
                    and b[1] - merge_gap < a[3]
                ):
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]), a[4] + b[4]]
                    del boxes[j]
                    changed = True
                    break
            if changed:
                break
    return boxes


def reading_order(boxes, rows: int | None = None):
    """Sort sprite boxes into rows (by centre y gaps) then left to right."""
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    out, row = [], []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if row:
            ry = sum((r[1] + r[3]) / 2 for r in row) / len(row)
            rh = max(r[3] - r[1] for r in row)
            if abs(cy - ry) > rh * 0.6:
                out.append(sorted(row, key=lambda r: r[0]))
                row = []
        row.append(b)
    if row:
        out.append(sorted(row, key=lambda r: r[0]))
    return out


# ---------------------------------------------------------------- native grid


def _edge_profile(rgb: np.ndarray, alpha: np.ndarray, axis: int) -> np.ndarray:
    f = rgb.astype(np.float64)
    if axis == 1:
        d = np.abs(np.diff(f, axis=1)).sum(-1) * (alpha[:, 1:] & alpha[:, :-1])
        return d.sum(0)
    d = np.abs(np.diff(f, axis=0)).sum(-1) * (alpha[1:, :] & alpha[:-1, :])
    return d.sum(1)


def detect_grid(rgb: np.ndarray, alpha: np.ndarray, lo=3.0, hi=14.0):
    """Estimate (period, phase_x, phase_y) of the art-pixel grid from colour-edge positions."""
    px = _edge_profile(rgb, alpha, 1)
    py = _edge_profile(rgb, alpha, 0)
    best = (0.0, lo, 0.0, 0.0)
    for p in np.arange(lo, hi, 0.05):
        sx, phx = _comb(px, p)
        sy, phy = _comb(py, p)
        s = sx + sy
        if s > best[0]:
            best = (s, p, phx, phy)
    # Prefer the fundamental: if half the period scores nearly as well, the grid is finer.
    return best[1], best[2], best[3]


def _comb(profile: np.ndarray, p: float):
    n = len(profile)
    if n < 2 * p:
        return 0.0, 0.0
    mean = profile.mean() + 1e-9
    best = (0.0, 0.0)
    for ph in np.arange(0, p, 0.25):
        idx = np.round(np.arange(ph, n, p)).astype(int)
        idx = idx[idx < n]
        if len(idx) < 2:
            continue
        # edges sit between pixel idx-1 and idx; profile[i] is the edge between i and i+1
        vals = profile[np.clip(idx - 1, 0, n - 1)]
        s = vals.mean() / mean
        if s > best[0]:
            best = (s, ph)
    return best


def sample_native(rgb: np.ndarray, alpha: np.ndarray, p: float, phx: float, phy: float):
    """One colour per native cell: median of the cell's inner pixels; transparent if mostly background."""
    h, w = alpha.shape
    xs = np.arange(phx - p * np.ceil(phx / p), w, p)
    ys = np.arange(phy - p * np.ceil(phy / p), h, p)
    nw, nh = len(xs), len(ys)
    out = np.zeros((nh, nw, 4), dtype=np.uint8)
    m = max(1, int(p * 0.22))
    for j, y0 in enumerate(ys):
        for i, x0 in enumerate(xs):
            a0, a1 = int(round(y0)), int(round(y0 + p))
            b0, b1 = int(round(x0)), int(round(x0 + p))
            cy0, cy1 = max(0, a0), min(h, a1)
            cx0, cx1 = max(0, b0), min(w, b1)
            if cy1 <= cy0 or cx1 <= cx0:
                continue
            cell_a = alpha[cy0:cy1, cx0:cx1]
            if cell_a.mean() < 0.5:
                continue
            iy0, iy1 = max(0, a0 + m), min(h, a1 - m)
            ix0, ix1 = max(0, b0 + m), min(w, b1 - m)
            if iy1 <= iy0 or ix1 <= ix0:
                iy0, iy1, ix0, ix1 = cy0, cy1, cx0, cx1
            px = rgb[iy0:iy1, ix0:ix1][alpha[iy0:iy1, ix0:ix1]]
            if len(px) == 0:
                px = rgb[cy0:cy1, cx0:cx1][cell_a]
            out[j, i, :3] = np.median(px, axis=0).astype(np.uint8)
            out[j, i, 3] = 255
    return trim(out)


def trim(rgba: np.ndarray) -> np.ndarray:
    a = rgba[..., 3] > 0
    if not a.any():
        return rgba[:1, :1]
    ys, xs = np.nonzero(a)
    return rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


# ---------------------------------------------------------------- downscale, outline, cleanup


def quantize(rgba: np.ndarray, pal: np.ndarray, pal_lab: np.ndarray) -> np.ndarray:
    """RGBA -> index image (-1 = transparent)."""
    idx = np.full(rgba.shape[:2], -1, dtype=np.int32)
    a = rgba[..., 3] > 0
    if a.any():
        idx[a] = nearest_index(rgba[..., :3][a], pal_lab)
    return idx


def downscale_idx(idx: np.ndarray, tw: int, th: int, outline: int, max_fill=1.0):
    """Fit an index image into tw x th (keeping aspect) by coverage-weighted mode per target cell."""
    nh, nw = idx.shape
    s = min(tw / nw, th / nh, 1.0) * max_fill if max(nw, nh) > 0 else 1.0
    s = min(s, 1.0)
    ow, oh = max(1, round(nw * s)), max(1, round(nh * s))
    if ow == nw and oh == nh:
        return idx.copy()
    out = np.full((oh, ow), -1, dtype=np.int32)
    fx, fy = nw / ow, nh / oh
    for j in range(oh):
        for i in range(ow):
            x0, x1 = i * fx, (i + 1) * fx
            y0, y1 = j * fy, (j + 1) * fy
            votes: Counter = Counter()
            for yy in range(int(y0), int(np.ceil(y1))):
                wy = min(y1, yy + 1) - max(y0, yy)
                for xx in range(int(x0), int(np.ceil(x1))):
                    wx = min(x1, xx + 1) - max(x0, xx)
                    if yy < nh and xx < nw:
                        votes[int(idx[yy, xx])] += wx * wy
            total = sum(votes.values())
            if votes[-1] > total * 0.5:
                continue
            votes.pop(-1, None)
            # Interior cells: the outline colour only wins with a clear majority (keeps details, not mush).
            if outline in votes and len(votes) > 1 and votes[outline] < total * 0.6:
                votes[outline] *= 0.5
            out[j, i] = votes.most_common(1)[0][0]
    return out


def clean_and_outline(idx: np.ndarray, outline: int, min_island: int = 2) -> np.ndarray:
    """Remove tiny islands, then make every silhouette-edge pixel the outline colour (1 px, 4-neighbour)."""
    h, w = idx.shape
    opaque = idx >= 0
    comps = components(opaque, 1)
    for c in comps:
        if c[0] <= min_island:
            for y, x in c[5]:
                idx[y, x] = -1
    opaque = idx >= 0
    pad = np.pad(opaque, 1)
    edge = opaque & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    out = idx.copy()
    out[edge] = outline
    # Interior pixels that were outline-coloured but are isolated specks inside a flat area stay as detail.
    return out


def place(idx: np.ndarray, tw: int, th: int, anchor: str = "bottom") -> np.ndarray:
    """Pad an index image onto a tw x th canvas (centred; bottom-anchored by default, 0 px margin)."""
    h, w = idx.shape
    out = np.full((th, tw), -1, dtype=np.int32)
    x = (tw - w) // 2
    y = th - h if anchor == "bottom" else (th - h) // 2
    out[max(0, y) : max(0, y) + h, max(0, x) : max(0, x) + w] = idx[: th, : tw]
    return out


def idx_to_rgba(idx: np.ndarray, pal) -> np.ndarray:
    h, w = idx.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for j in range(h):
        for i in range(w):
            k = idx[j, i]
            if k >= 0:
                out[j, i, :3] = pal[k]
                out[j, i, 3] = 255
    return out
