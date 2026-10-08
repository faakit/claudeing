"""Render whole maps offline from the .tmj tile layers and the tileset, for composition review.

    python art-src/tools/mapview.py <outDir> [scale] [tileset.png]

Draws every visible tile layer in file order (ground, detail, shade, roof, props, overhead), skipping
`collision`, and marks the light positions with a small cross when MARK_LIGHTS=1. Output: <outDir>/map_<id>.png.
"""
from __future__ import annotations

import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, "..", ".."))
MAPS = os.path.join(GAME, "public", "assets", "maps")
T = 16


def render(path: str, tiles: Image.Image) -> Image.Image:
    m = json.load(open(path))
    w, h = m["width"], m["height"]
    cols = tiles.width // T
    out = Image.new("RGBA", (w * T, h * T), (42, 26, 36, 255))
    cache: dict[int, Image.Image] = {}
    for layer in m["layers"]:
        if layer["type"] != "tilelayer" or layer["name"] == "collision":
            continue
        for i, g in enumerate(layer["data"]):
            if not g:
                continue
            if g not in cache:
                k = g - 1
                cache[g] = tiles.crop(((k % cols) * T, (k // cols) * T, (k % cols + 1) * T, (k // cols + 1) * T))
            out.alpha_composite(cache[g], ((i % w) * T, (i // w) * T))
    if os.environ.get("MARK_LIGHTS"):
        for layer in m["layers"]:
            if layer["name"] == "lights":
                for o in layer["objects"]:
                    x, y = int(o["x"]), int(o["y"])
                    for d in range(-2, 3):
                        out.putpixel((min(w * T - 1, max(0, x + d)), y), (255, 240, 160, 255))
                        out.putpixel((x, min(h * T - 1, max(0, y + d))), (255, 240, 160, 255))
    return out


def main() -> None:
    out_dir = sys.argv[1]
    scale = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    ts = sys.argv[3] if len(sys.argv) > 3 else os.path.join(GAME, "public", "assets", "tilesets", "tiles.png")
    tiles = Image.open(ts).convert("RGBA")
    os.makedirs(out_dir, exist_ok=True)
    for fn in sorted(os.listdir(MAPS)):
        if fn.endswith(".tmj"):
            img = render(os.path.join(MAPS, fn), tiles)
            img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
            img.save(os.path.join(out_dir, f"map_{fn[:-4]}.png"))
            print("wrote", fn[:-4], img.size)


if __name__ == "__main__":
    main()
