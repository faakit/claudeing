"""Build every shipped sprite, the packed atlases and the tileset from committed sources.

    python art-src/tools/build.py            # rebuild everything

Sources:
  art-src/flow/crops/<sheet>/<name>.png   per-sprite crops of Google Flow output (see art-src/flow/prompts.md)
  art-src/sprites.json                     which crop feeds which texture key, target size, anchor
  art-src/tools/authored.py                palette-indexed sprites written in code (terrain tiles, soil, fx...)
Outputs:
  art-src/sprites/<group>/<key>.png        every finished sprite, for review
  public/assets/sprites/{world,ui,chars}.{png,json}, public/assets/tilesets/tiles.png
  (public/assets/palette.gpl is an input: the authored 32-colour palette, slot 0 = outline ink)
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


# ---------------------------------------------------------------- sprites from crops


def build_crop_sprite(spec: dict, pal, pal_lab, outline: int) -> np.ndarray:
    nat = crop_native(spec["src"])
    if spec.get("flip"):
        nat = nat[:, ::-1]
    idx = px.quantize(nat, pal, pal_lab)
    w, h = spec["size"]
    fit = spec.get("fit", [w, h])
    drop = spec.get("drop_rows", 0)
    if drop:  # shorten a figure on its native grid: remove rows spread over the body below the waist
        h0 = idx.shape[0]
        a, b = int(h0 * 0.55), int(h0 * 0.9)
        rows = sorted({int(a + (b - a) * (k + 0.5) / drop) for k in range(drop)})
        idx = np.delete(idx, rows, axis=0)
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
    # The palette is authored (v2 ramps, chosen with the art director); slot 0 is the outline ink.
    pal = px.load_gpl(PALETTE)
    names = px.load_gpl_names(PALETTE)
    assert len(pal) <= 32, "palette over 32 colours"
    assert names[0] == "ink", "palette slot 0 must be the outline ink"
    pal_arr = np.array(pal, dtype=np.float64)
    pal_lab = px.to_lab(pal_arr)
    outline = 0

    import authored  # noqa: E402  (needs the palette)

    groups: dict[str, dict[str, np.ndarray]] = {"world": {}, "ui": {}, "chars": {}}
    for key, spec in specs.items():
        if "src" not in spec:
            continue
        idx = build_crop_sprite(spec, pal, pal_lab, outline)
        groups[spec["group"]][key] = px.idx_to_rgba(idx, pal)
    extra = authored.build(
        pal, outline, groups, specs, lambda sp: build_crop_sprite(sp, pal, pal_lab, outline), names
    )
    for g, sprites in groups.items():
        for k, arr in sprites.items():
            save_png(arr, os.path.join(ART, "sprites", g, f"{k}.png"))
    index = {"tileset": False, "atlases": []}
    if extra.get("tileset") is not None:
        save_png(extra["tileset"], os.path.join(PUB, "tilesets", "tiles.png"))
        save_png(extra["tileset"], os.path.join(ART, "sprites", "tiles.png"))
        index["tileset"] = True
        with open(os.path.join(PUB, "tilesets", "tiles.json"), "w", newline="\n") as f:
            json.dump({"columns": 21, "tiles": {n: i for i, n in enumerate(extra["tile_names"])}}, f, indent=1)
            f.write("\n")
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
