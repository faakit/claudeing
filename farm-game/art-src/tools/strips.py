"""Frame strips and onion skins for reviewing animations (art round 4).

    python art-src/tools/strips.py [out_dir]     # default agents/out/art-shots/round4/strips

For each animation: `<name>_strip.png`, the frames side by side at 6x on grass (top row) and on parchment (bottom
row), every frame bottom-aligned in a cell of the sequence's largest size, with a 1 px baseline guide (gold) under
the cells and a crown-height guide (rose) at the tallest frame's top; and `<name>_onion.png`, every frame at about
30% over the others at 8x, so silhouette jitter and a drifting spine show; and `<name>_1x.gif` / `_4x.gif`, a loop
at the suggested timing (agents/out/art-feel-frames.md). Reads the built sprites in
art-src/sprites/<group>/ (run build.py first).
"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, "..", ".."))
SPR = os.path.join(GAME, "art-src", "sprites")
GRASS = (116, 176, 67)
PARCH = (244, 228, 188)
GOLD = (244, 204, 60)
ROSE = (224, 122, 138)


def load(name: str) -> Image.Image | None:
    for g in ("chars", "world", "ui"):
        p = os.path.join(SPR, g, name + ".png")
        if os.path.exists(p):
            return Image.open(p).convert("RGBA")
    return None


def sequences() -> dict[str, list[str]]:
    seq: dict[str, list[str]] = {}
    for d in ("down", "up", "right", "left"):
        seq[f"walk_{d}"] = [f"player_walk_{d}_{i}" for i in range(8)]
    for tool, dirs in (
        ("hoe", "down up right"),
        ("pick", "down up right"),
        ("can", "down right"),
        ("scythe", "down right"),
        ("rod", "down right"),
    ):
        for d in dirs.split():
            seq[f"tool_{tool}_{d}"] = [f"player_tool_{tool}_{d}_{i}" for i in range(4)]
    for n in ("mara", "finn", "orin", "rosa", "clay"):
        for d in ("down", "right", "up"):
            seq[f"idle_{n}_{d}"] = [f"npc_{n}_{d}_{i}" for i in range(4)]
    for a in ("chicken", "cow", "sheep", "pig"):
        seq[f"idle_{a}"] = [f"animal_{a}"] + [f"animal_{a}_{i}" for i in (1, 2, 3)]
    seq["door_open"] = [f"obj_door_open_{i}" for i in range(4)]
    seq["door_open_low"] = [f"obj_door_open_low_{i}" for i in range(4)]
    seq["ripple"] = [f"fx_ripple_{i}" for i in range(3)]
    seq["splash"] = [f"fx_splash_{i}" for i in range(4)]
    for c in ("parsnip_4", "corn_5", "pumpkin_5", "tulip_4", "wheat_4"):
        seq[f"crop_lean_{c}"] = [f"crop_{c}_lean_l", f"crop_{c}", f"crop_{c}_lean_r"]
    for it in ("item_parsnip", "item_pumpkin", "item_egg"):
        seq[f"pop_{it}"] = [f"{it}_pop_0", f"{it}_pop_1", it]
    return seq


def strip(frames: list[Image.Image], scale: int = 6) -> Image.Image:
    cw = max(f.width for f in frames) + 4
    ch = max(f.height for f in frames) + 4
    W, H = cw * len(frames), ch * 2 + 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    # the crown guide: the highest opaque row of any frame, measured up from the baseline
    top = max(f.height - int(np.argmax(np.asarray(f)[..., 3].any(axis=1))) for f in frames)
    for row, bg in enumerate((GRASS, PARCH)):
        y0 = row * (ch + 1)
        for i, f in enumerate(frames):
            cell = Image.new("RGBA", (cw, ch), bg + (255,))
            cell.alpha_composite(f, ((cw - f.width) // 2, ch - 2 - f.height))
            px = cell.load()
            for x in range(cw):  # guides: baseline under the feet, crown at the tallest frame's top
                if px[x, ch - 1][3]:
                    px[x, ch - 1] = GOLD + (255,)
                if x % 2 == 0:
                    yy = ch - 2 - top - 1
                    if 0 <= yy < ch and cell.getpixel((x, yy)) == bg + (255,):
                        px[x, yy] = ROSE + (255,)
            im.paste(cell, (i * cw, y0))
    return im.resize((W * scale, H * scale), Image.NEAREST)


def onion(frames: list[Image.Image], scale: int = 8) -> Image.Image:
    cw = max(f.width for f in frames)
    ch = max(f.height for f in frames)
    acc = np.zeros((ch, cw, 3), dtype=np.float64)
    acc[:] = GRASS
    for f in frames:
        a = np.asarray(f).astype(np.float64)
        canvas = np.zeros((ch, cw, 4))
        x0, y0 = (cw - f.width) // 2, ch - f.height
        canvas[y0 : y0 + f.height, x0 : x0 + f.width] = a
        m = canvas[..., 3:] / 255 * 0.3
        acc = acc * (1 - m) + canvas[..., :3] * m
    im = Image.fromarray(acc.clip(0, 255).astype(np.uint8), "RGB")
    return im.resize((cw * scale, ch * scale), Image.NEAREST)


# suggested ms per frame (agents/out/art-feel-frames.md), for the preview GIFs
TIMING = {
    "walk": [62] * 8,
    "tool_hoe": [90, 50, 110, 80, 200],
    "tool_pick": [90, 50, 110, 80, 200],
    "tool_scythe": [70, 40, 90, 90, 200],
    "tool_can": [80, 60, 120, 120, 200],
    "tool_rod": [120, 50, 120, 300, 200],
    "idle_": [1800, 500, 1500, 110],
    "door": [300, 60, 60, 600],
    "ripple": [120, 120, 120],
    "splash": [70, 70, 90, 90],
    "crop_lean": [120, 300, 120],
    "pop": [60, 60, 400],
}


def gif(name: str, frames: list[Image.Image], path: str, scale: int) -> None:
    """A looping preview at the suggested timing, on grass (tool sequences end on the idle frame)."""
    ms = next((v for k, v in TIMING.items() if name.startswith(k)), [150] * len(frames))
    if name.startswith("tool_"):
        d = name.rsplit("_", 1)[1]
        idle = load(f"player_idle_{d}_0")
        if idle is not None:
            pad = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
            pad.alpha_composite(idle, (8, 0))
            frames = frames + [pad]
    cw = max(f.width for f in frames)
    ch = max(f.height for f in frames)
    out = []
    for f in frames:
        c = Image.new("RGBA", (cw, ch), GRASS + (255,))
        c.alpha_composite(f, ((cw - f.width) // 2, ch - f.height))
        out.append(c.convert("RGB").resize((cw * scale, ch * scale), Image.NEAREST))
    out[0].save(path, save_all=True, append_images=out[1:], duration=ms[: len(out)], loop=0)


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(GAME, "agents", "out", "art-shots", "round4", "strips")
    os.makedirs(out, exist_ok=True)
    made = []
    for name, keys in sequences().items():
        frames = [load(k) for k in keys]
        frames = [f for f in frames if f is not None]
        if not frames:
            continue
        strip(frames).save(os.path.join(out, f"{name}_strip.png"))
        if len(frames) > 1:
            onion(frames).save(os.path.join(out, f"{name}_onion.png"))
            gif(name, frames, os.path.join(out, f"{name}_1x.gif"), 1)
            gif(name, frames, os.path.join(out, f"{name}_4x.gif"), 4)
        made.append(f"{name} ({len(frames)})")
    print("strips:", ", ".join(made))


if __name__ == "__main__":
    main()
