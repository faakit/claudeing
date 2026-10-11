"""Sample a phone-scale canvas screenshot back to the 200 x 400 game grid (one sample per game pixel, at its centre).

    python art-src/tools/x1.py <canvas.png> [out.png] [zoom]
"""
import sys

from PIL import Image


def x1(path: str, w: int = 200, h: int = 400) -> Image.Image:
    im = Image.open(path).convert("RGB")
    sx, sy = im.width / w, im.height / h
    out = Image.new("RGB", (w, h))
    px, src = out.load(), im.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = src[int((x + 0.5) * sx), int((y + 0.5) * sy)]
    return out


if __name__ == "__main__":
    o = x1(sys.argv[1])
    z = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    o.resize((o.width * z, o.height * z), Image.NEAREST).save(sys.argv[2] if len(sys.argv) > 2 else sys.argv[1].replace("_canvas", "_x1"))
