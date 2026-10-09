"""Ambience beds made here rather than recorded (deterministic, no licence question): a wall clock built
from two CC0 Kenney ticks, and a forge fire synthesized from noise. build.py calls generate(raw) before
the ambience, which writes RAW/gen/clock.wav and RAW/gen/forge.wav when they are missing or stale.

Usage (standalone): python -I gen_beds.py RAW_DIR
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402
from dsp import SR  # noqa: E402

VERSION = "1"


def _load(raw: str, sid: str) -> np.ndarray:
    for ext in (".ogg", ".wav", ".mp3"):
        p = os.path.join(raw, sid + ext)
        if os.path.exists(p):
            x = dsp.load(p)
            return x[dsp.onset(x, -40):]
    raise FileNotFoundError(sid)


def _shift(x: np.ndarray, semis: float) -> np.ndarray:
    r = 2 ** (semis / 12)
    return np.interp(np.arange(int(len(x) / r)) * r, np.arange(len(x)), x)


def clock(raw: str, seconds: int = 24) -> np.ndarray:
    """A slow wall clock: tick, tock (a little lower and softer) once a second, in a small wooden room."""
    tick = dsp.lowpass(_shift(_load(raw, "sfx/kenney-interface/tick_004"), -7), 3500)[: int(0.08 * SR)]
    tock = dsp.lowpass(_shift(_load(raw, "sfx/kenney-interface/tick_002"), -10), 2800)[: int(0.08 * SR)]
    tick = dsp.fade(tick / np.abs(tick).max(), fade_out=int(0.02 * SR))
    tock = dsp.fade(tock / np.abs(tock).max(), fade_out=int(0.02 * SR)) * 0.8
    y = np.zeros(seconds * SR + SR)
    for s in range(seconds):
        snd = tick if s % 2 == 0 else tock
        at = s * SR
        y[at:at + len(snd)] += snd
    # A short body resonance: two damped echoes (a wooden case), then a faint room.
    rng = np.random.default_rng(11)
    ir = np.zeros(int(0.25 * SR))
    ir[0] = 1.0
    ir[int(0.011 * SR)] = 0.35
    ir[int(0.023 * SR)] = 0.18
    t = np.arange(len(ir)) / SR
    ir += rng.standard_normal(len(ir)) * 0.02 * np.exp(-t / 0.05)
    y = np.convolve(y, ir)[: len(y)]
    return y[: seconds * SR] / np.abs(y).max() * 0.5


def forge(seconds: int = 30) -> np.ndarray:
    """A banked forge: a low roar that breathes slowly, and sparse crackles and pops."""
    rng = np.random.default_rng(7)
    n = seconds * SR
    brown = np.cumsum(rng.standard_normal(n))
    brown -= np.convolve(brown, np.ones(4410) / 4410, mode="same")  # remove the drift
    roar = dsp.lowpass(dsp.highpass(brown, 60), 450)
    roar /= np.abs(roar).max()
    # Slow breathing of the fire (two incommensurate periods).
    t = np.arange(n) / SR
    roar *= 0.75 + 0.15 * np.sin(2 * np.pi * t / 7.3) + 0.1 * np.sin(2 * np.pi * t / 3.1 + 1.0)
    crackle = np.zeros(n)
    k = 0.0
    while True:
        k += rng.exponential(1 / 9.0)
        at = int(k * SR)
        if at >= n - SR // 10:
            break
        length = int(rng.uniform(0.002, 0.012) * SR)
        burst = rng.standard_normal(length) * np.exp(-np.arange(length) / (length / 4))
        crackle[at:at + length] += burst * rng.uniform(0.1, 1.0) ** 2
    crackle = dsp.highpass(crackle, 1800)
    crackle /= np.abs(crackle).max()
    y = 0.6 * roar + 0.35 * crackle
    return y / np.abs(y).max() * 0.6


def generate(raw: str) -> None:
    out = os.path.join(raw, "gen")
    os.makedirs(out, exist_ok=True)
    stamp = os.path.join(out, "VERSION")
    if os.path.exists(stamp) and open(stamp).read().strip() == VERSION and all(
        os.path.exists(os.path.join(out, f)) for f in ("clock.wav", "forge.wav")
    ):
        return
    dsp.write_wav(os.path.join(out, "clock.wav"), clock(raw))
    dsp.write_wav(os.path.join(out, "forge.wav"), forge())
    with open(stamp, "w") as f:
        f.write(VERSION)


if __name__ == "__main__":
    generate(sys.argv[1])
    print("wrote", os.path.join(sys.argv[1], "gen"))
