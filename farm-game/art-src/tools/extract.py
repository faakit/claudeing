"""Cut one Google Flow sheet (raw JPEG, kept outside the repo) into per-sprite crops.

usage: python art-src/tools/extract.py <raw.jpg> <sheet-id> <name1,name2,...> [--key ff00ff] [--tol 110] [--gap 12]

Names are given in reading order (rows top to bottom, left to right); use `_` to skip a sprite. Crops are
saved as RGBA PNGs at the original resolution (background keyed to alpha 0) under art-src/flow/crops/<sheet-id>/.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import pixelart as px  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("raw")
ap.add_argument("sheet")
ap.add_argument("names")
ap.add_argument("--key", default="ff00ff")
ap.add_argument("--tol", type=float, default=110)
ap.add_argument("--gap", type=int, default=12)
ap.add_argument("--min", type=int, default=400, help="minimum sprite area in px")
a = ap.parse_args()

key = tuple(int(a.key[i : i + 2], 16) for i in (0, 2, 4))
img = np.asarray(Image.open(a.raw).convert("RGB"))
mask = px.key_mask(img, key, a.tol)
comps = px.components(mask, 20)
boxes = [b for b in px.group_sprites(comps, a.gap) if b[4] >= a.min]
rows = px.reading_order(boxes)
flat = [b for r in rows for b in r]
names = a.names.split(",")
print(f"{len(flat)} sprites in {len(rows)} rows ({[len(r) for r in rows]}), {len(names)} names")
if len(flat) != len(names):
    print("COUNT MISMATCH: fix names or --gap/--min", file=sys.stderr)
    sys.exit(1)
root = os.path.join(os.path.dirname(__file__), "..", "flow", "crops", a.sheet)
os.makedirs(root, exist_ok=True)
for name, (x0, y0, x1, y1, area) in zip(names, flat):
    if name == "_":
        continue
    pad = 2
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(img.shape[1], x1 + pad), min(img.shape[0], y1 + pad)
    rgba = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
    rgba[..., :3] = img[y0:y1, x0:x1]
    rgba[..., 3] = np.where(mask[y0:y1, x0:x1], 255, 0)
    Image.fromarray(rgba, "RGBA").save(os.path.join(root, f"{name}.png"), optimize=True)
    print(f"  {name}: {x1 - x0}x{y1 - y0} at {x0},{y0}")
