"""Measure rendered mixes (WAVs from render.mjs): integrated loudness and true peak (ffmpeg ebur128),
loudness range, spectral centroid, share of energy a phone speaker can play, and silence.

Usage: python -I measure.py DIR [--md]
"""
import glob
import os
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402


def ebur128(path: str) -> dict:
    err = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    tail = err[err.rfind("Summary:"):]
    get = lambda key: float(re.search(key + r":\s+(-?[\d.]+|-inf)", tail).group(1).replace("-inf", "-120"))  # noqa: E731
    return {"I": get("I"), "LRA": get("LRA"), "TP": get("Peak")}


def spectral(x: np.ndarray) -> dict:
    n = 1 << 15
    hops = range(0, max(1, len(x) - n), n)
    acc = np.zeros(n // 2 + 1)
    for h in hops:
        seg = x[h : h + n]
        if len(seg) < n:
            break
        acc += np.abs(np.fft.rfft(seg * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1 / dsp.SR)
    tot = acc.sum() or 1
    return {
        "centroid": float((f * acc).sum() / tot),
        "phone": float(acc[f >= 400].sum() / tot),
    }


def main() -> None:
    d = sys.argv[1]
    md = "--md" in sys.argv
    rows = []
    for path in sorted(glob.glob(os.path.join(d, "*.wav"))):
        x = dsp.load(path)
        e = ebur128(path)
        sp = spectral(x)
        env = dsp.envelope(x, 4410)
        silent = float(np.mean(env < dsp.undb(-60)))
        rows.append((os.path.basename(path)[:-4], e["I"], e["TP"], e["LRA"], dsp.max_momentary(x), sp["centroid"],
                     sp["phone"], silent))
    if md:
        print("| render | LUFS | TP dBTP | LRA LU | max momentary dB | centroid Hz | energy >400 Hz | silent 100 ms blocks |")
        print("|---|---|---|---|---|---|---|---|")
        for r in rows:
            print(f"| {r[0]} | {r[1]:.1f} | {r[2]:.1f} | {r[3]:.1f} | {r[4]:.1f} | {r[5]:.0f} | {r[6] * 100:.0f}% | {r[7] * 100:.0f}% |")
    else:
        for r in rows:
            print(f"{r[0]:26} I {r[1]:6.1f} TP {r[2]:5.1f} LRA {r[3]:4.1f} mom {r[4]:6.1f} cent {r[5]:5.0f}"
                  f" >400Hz {r[6] * 100:3.0f}% silent {r[7] * 100:3.0f}%")


if __name__ == "__main__":
    main()
