"""Output loudness of each sound effect, per hit, from `hits-<cue>.wav` renders (render.mjs: sixteen hits
1.2 s apart at the default volumes). Prints the K-weighted max momentary loudness (400 ms, stereo, as
ebur128 "M") of every hit, their median and spread, and the gap to the role target at the output.

Usage: python -I sfxlevels.py DIR
"""
import glob
import json
import os
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RECIPES = os.path.join(os.path.dirname(HERE), "recipes.json")
# Event jingles are played by the sampler; their target is -19 at the output.
JINGLES = {"level", "goal", "sleep", "heart", "order"}


def load(path: str) -> tuple[np.ndarray, int]:
    w = wave.open(path)
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64).reshape(-1, 2) / 32768
    return x, sr


def momentary_max(x: np.ndarray, sr: int) -> float:
    w = int(0.4 * sr)
    hop = int(0.01 * sr)
    p = sum(dsp.k_weight(np.concatenate([x[:, c], np.zeros(w)]), sr) ** 2 for c in range(2))
    c = np.concatenate([[0.0], np.cumsum(p)])
    starts = np.arange(0, max(1, len(p) - w + 1), hop)
    return float(-0.691 + 10 * np.log10(max(((c[starts + w] - c[starts]) / w).max(), 1e-12)))


def main() -> None:
    d = sys.argv[1]
    rec = json.load(open(RECIPES, encoding="utf8"))
    target = {k: rec["families"][v["family"]]["lufs"] for k, v in rec["sfx"].items()}
    print("| cue | target | median M | min | max | gap | max sample peak dBFS |")
    print("|---|---|---|---|---|---|---|")
    for path in sorted(glob.glob(os.path.join(d, "hits-*.wav"))):
        cue = os.path.basename(path)[5:-4]
        x, sr = load(path)
        hits = [momentary_max(x[int((0.2 + i * 1.2 - 0.05) * sr):int((0.2 + i * 1.2 + 1.15) * sr)], sr) for i in range(16)]
        t = -19 if cue in JINGLES else target.get(cue)
        med = float(np.median(hits))
        gap = f"{med - t:+.1f}" if t is not None else "-"
        peak = 20 * np.log10(max(float(np.abs(x).max()), 1e-9))
        print(f"| {cue} | {t if t is not None else '-'} | {med:.1f} | {min(hits):.1f} | {max(hits):.1f} | {gap} | {peak:.1f} |")


if __name__ == "__main__":
    main()
