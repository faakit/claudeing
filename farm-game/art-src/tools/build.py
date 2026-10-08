"""Build every shipped sprite, the packed atlases and the tileset from committed sources.

    python art-src/tools/build.py            # rebuild everything
    python art-src/tools/build.py --palette  # (re)derive public/assets/palette.gpl from the Flow crops first

Sources:
  art-src/flow/crops/<sheet>/<name>.png   per-sprite crops of Google Flow output (see art-src/flow/prompts.md)
  art-src/sprites.json                     which crop feeds which texture key, target size, anchor
  art-src/tools/authored.py                palette-indexed sprites written in code (terrain tiles, soil, fx...)
Outputs:
  art-src/sprites/<group>/<key>.png        every finished sprite, for review
  public/assets/sprites/{world,ui,chars}.{png,json}, public/assets/tilesets/tiles.png, public/assets/palette.gpl
  src/art/atlases.json                     which of those files exist (the loader requests only these)
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pixelart as px  # noqa: E402

GAME = os.path.normpath(os.path.join(HERE, "..", ".."))
ART = os.path.join(GAME, "art-src")
CROPS = os.path.join(ART, "flow", "crops")
PUB = os.path.join(GAME, "public", "assets")
PALETTE = os.path.join(PUB, "palette.gpl")
USED: set[str] = set()


def prune_crops() -> None:
    """Drop crops no sprite uses, so the committed sources stay lean (raw sheets live outside the repo)."""
    for sheet in os.listdir(CROPS):
        for fn in os.listdir(os.path.join(CROPS, sheet)):
            if f"{sheet}/{fn[:-4]}" not in USED:
                os.remove(os.path.join(CROPS, sheet, fn))
        if not os.listdir(os.path.join(CROPS, sheet)):
            os.rmdir(os.path.join(CROPS, sheet))


def crop_native(src: str) -> np.ndarray:
    """Flow crop -> native-resolution RGBA (one pixel per detected art pixel)."""
    USED.add(src)
    im = np.asarray(Image.open(os.path.join(CROPS, src + ".png")).convert("RGBA"))
    rgb, a = im[..., :3], im[..., 3] > 0
    p, phx, phy = px.detect_grid(rgb, a)
    return px.sample_native(rgb, a, p, phx, phy)


# ---------------------------------------------------------------- palette


def derive_palette(specs: dict, n: int = 32) -> list[tuple[int, int, int]]:
    """Weighted k-means (Lab) over the colours of every Flow crop in use.

    Each crop gets the same total weight and each of its colours sqrt(count), so small accents (a blue fish,
    a red berry) still win a palette slot. `art-src/palette-extra.json` lists colours that are always kept
    (the outline brown)."""
    cols_w: dict[tuple, float] = {}
    seen_src = set()
    for s in specs.values():
        src = s.get("src")
        if not src or src in seen_src:
            continue
        seen_src.add(src)
        nat = crop_native(src)
        pix = nat[..., :3][nat[..., 3] > 0].astype(np.int32)
        q = (pix // 8) * 8 + 4
        u, c = np.unique(q, axis=0, return_counts=True)
        w = np.sqrt(c)
        w = w / w.sum()
        for col, wt in zip(map(tuple, u), w):
            cols_w[col] = cols_w.get(col, 0.0) + wt
    extra = os.path.join(ART, "palette-extra.json")
    fixed = [tuple(c) for c in json.load(open(extra))] if os.path.exists(extra) else []
    allpx = np.array(list(cols_w.keys()), dtype=np.float64)
    wts = np.array(list(cols_w.values()))
    lab = px.to_lab(allpx)
    k = n - len(fixed)
    rng = np.random.default_rng(7)
    cent = [lab[np.argmax(wts)]]
    for _ in range(k - 1):
        d = np.min([((lab - c) ** 2).sum(-1) for c in cent], axis=0) * wts
        cent.append(lab[rng.choice(len(lab), p=d / d.sum())])
    cent = np.array(cent)
    for _ in range(40):
        lab_idx = ((lab[:, None, :] - cent[None]) ** 2).sum(-1).argmin(1)
        for i in range(k):
            m = lab_idx == i
            if m.any():
                cent[i] = (lab[m] * wts[m, None]).sum(0) / wts[m].sum()
    cols = []
    for i in range(k):
        m = lab_idx == i
        if m.any():
            # the member colour nearest the weighted centre (a real colour, not an average)
            j = np.argmin(((lab[m] - cent[i]) ** 2).sum(-1))
            cols.append(tuple(int(v) for v in allpx[m][j]))
    cols += fixed
    cols = sorted(set(cols), key=lambda c: px.to_lab(np.array(c, dtype=np.float64))[0])
    return cols


# ---------------------------------------------------------------- sprites from crops


def build_crop_sprite(spec: dict, pal, pal_lab, outline: int) -> np.ndarray:
    nat = crop_native(spec["src"])
    if spec.get("flip"):
        nat = nat[:, ::-1]
    idx = px.quantize(nat, pal, pal_lab)
    w, h = spec["size"]
    fit = spec.get("fit", [w, h])
    if not spec.get("noscale"):
        idx = px.downscale_idx(idx, fit[0], fit[1], outline)
    else:  # keep the native scale (consistent animation frames); trim the sides to the frame width
        over = max(0, idx.shape[1] - w)
        idx = idx[:, over // 2 : idx.shape[1] - (over - over // 2)]
    idx = px.clean_and_outline(idx, outline, spec.get("island", 2))
    out = px.place(idx, w, h, spec.get("anchor", "bottom"))
    bob = spec.get("bob", 0)
    if bob:  # idle "breath": everything above the legs sinks 1 px (legs: the bottom `bob` rows)
        top = out[: h - bob].copy()
        out[1 : h - bob + 1][top >= 0] = top[top >= 0]
        out[0, :] = -1
        out = px.clean_and_outline(out, outline, 0)
    dy = spec.get("dy", 0)
    if dy:
        out = np.roll(out, dy, axis=0)
        if dy < 0:
            out[dy:, :] = -1
        else:
            out[:dy, :] = -1
    return out


# ---------------------------------------------------------------- packing


def pack(sprites: dict[str, np.ndarray], max_w: int = 512, pad: int = 1):
    """Shelf-pack RGBA sprites (tallest first) with transparent padding; returns (image, frames)."""
    order = sorted(sprites, key=lambda k: (-sprites[k].shape[0], k))
    x = y = shelf = 0
    pos = {}
    for k in order:
        h, w = sprites[k].shape[:2]
        if x + w + pad > max_w:
            x, y, shelf = 0, y + shelf + pad, 0
        pos[k] = (x + pad, y + pad)
        x += w + pad
        shelf = max(shelf, h)
    W = max_w
    H = y + shelf + 2 * pad
    H = 1 << (H - 1).bit_length()
    sheet = np.zeros((H, W, 4), dtype=np.uint8)
    frames = {}
    for k in order:
        h, w = sprites[k].shape[:2]
        x0, y0 = pos[k]
        sheet[y0 : y0 + h, x0 : x0 + w] = sprites[k]
        frames[k] = {
            "frame": {"x": x0, "y": y0, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
    assert W <= 2048 and H <= 2048, "atlas over 2048"
    return sheet, frames


def save_png(arr: np.ndarray, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(arr, "RGBA").save(path, optimize=True)


def main() -> None:
    specs = json.load(open(os.path.join(ART, "sprites.json")))
    specs = {k: v for k, v in specs.items() if not k.startswith("//")}
    if "--palette" in sys.argv or not os.path.exists(PALETTE):
        cols = derive_palette(specs)
        px.write_gpl(PALETTE, cols)
        print(f"palette: {len(cols)} colours -> {PALETTE}")
    pal = px.load_gpl(PALETTE)
    assert len(pal) <= 32, "palette over 32 colours"
    pal_arr = np.array(pal, dtype=np.float64)
    pal_lab = px.to_lab(pal_arr)
    outline = int(np.argmin(pal_lab[:, 0]))

    import authored  # noqa: E402  (needs the palette)

    groups: dict[str, dict[str, np.ndarray]] = {"world": {}, "ui": {}, "chars": {}}
    for key, spec in specs.items():
        if "src" not in spec:
            continue
        idx = build_crop_sprite(spec, pal, pal_lab, outline)
        groups[spec["group"]][key] = px.idx_to_rgba(idx, pal)
    extra = authored.build(
        pal, outline, groups, specs, lambda sp: build_crop_sprite(sp, pal, pal_lab, outline)
    )
    for g, sprites in groups.items():
        for k, arr in sprites.items():
            save_png(arr, os.path.join(ART, "sprites", g, f"{k}.png"))
    index = {"tileset": False, "atlases": []}
    if extra.get("tileset") is not None:
        save_png(extra["tileset"], os.path.join(PUB, "tilesets", "tiles.png"))
        save_png(extra["tileset"], os.path.join(ART, "sprites", "tiles.png"))
        index["tileset"] = True
    for g, sprites in groups.items():
        if not sprites:
            continue
        sheet, frames = pack(sprites)
        save_png(sheet, os.path.join(PUB, "sprites", f"{g}.png"))
        meta = {
            "app": "art-src/tools/build.py",
            "image": f"{g}.png",
            "format": "RGBA8888",
            "size": {"w": sheet.shape[1], "h": sheet.shape[0]},
            "scale": "1",
        }
        with open(os.path.join(PUB, "sprites", f"{g}.json"), "w", newline="\n") as f:
            json.dump({"frames": frames, "meta": meta}, f, indent=1, sort_keys=True)
            f.write("\n")
        index["atlases"].append(g)
        print(f"{g}: {len(sprites)} frames, {sheet.shape[1]}x{sheet.shape[0]}")
    if "--prune" in sys.argv:
        prune_crops()
    with open(os.path.join(GAME, "src", "art", "atlases.json"), "w", newline="\n") as f:
        json.dump(index, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
