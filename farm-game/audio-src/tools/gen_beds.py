"""Ambience beds made here rather than recorded (deterministic, no licence question): a wall clock built
from two CC0 Kenney ticks, a forge fire synthesized from noise, and the mill wheel turning, built from CC0
water splashes (rubberduck), Kenney RPG creaks and a Kenney wood knock. build.py calls generate(raw) before
the ambience, which writes RAW/gen/clock.wav, forge.wav and mill.wav when they are missing or stale.

Usage (standalone): python -I gen_beds.py RAW_DIR
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402
from dsp import SR  # noqa: E402

VERSION = "2"


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


MILL_REV = 3.0  # seconds per turn of the wheel
MILL_TURNS = 3  # turns per loop: each turn has its own jitter, so the loop repeats only every 9 s


def mill(raw: str) -> np.ndarray:
    """The mill wheel turning: eight paddles slap the race each turn, the axle groans once a turn and a joint
    knocks. Built on a circular timeline of MILL_TURNS turns (events wrap around), so the loop is exactly
    periodic and its wrap seamless; every paddle, groan and knock has its own timing and level jitter."""
    rng = np.random.default_rng(23)
    period = MILL_REV * MILL_TURNS
    n = int(round(period * SR))
    y = np.zeros(n)

    def prep(sid: str, a: float, b: float, semis: float, lp: float) -> np.ndarray:
        x = _load(raw, sid)[int(a * SR):int(b * SR)]
        x = dsp.lowpass(dsp.highpass(_shift(x, semis), 150), lp)
        x = dsp.fade(x, fade_in=int(0.003 * SR), fade_out=int(0.04 * SR))
        return x / (np.sqrt(np.mean(x ** 2)) + 1e-12)

    slaps = [prep(f"sfx/oga-rubberduck-water/splash_0{k}", 0.0, 0.16, s, 1800)
             for k, s in (("2", -6), ("6", -7), ("9", -5), ("2", -8), ("9", -7))]
    groans = [prep(f"sfx/kenney-rpg/creak{k}", a, b, s, 1100)
              for k, a, b, s in (("1", 0.1, 0.6, -12), ("2", 0.2, 0.8, -12), ("3", 0.0, 0.32, -10))]
    knock = prep("sfx/kenney-impact/impactWood_light_001", 0.0, 0.2, -2, 2000)

    def add(snd: np.ndarray, at: float, g: float) -> None:
        i = int(at * SR) % n
        idx = (np.arange(len(snd)) + i) % n  # wrap around the loop end
        np.add.at(y, idx, snd * g)

    for turn in range(MILL_TURNS):
        t0 = turn * MILL_REV
        for p in range(8):
            at = t0 + p * MILL_REV / 8 + rng.normal(0, 0.012)
            add(slaps[rng.integers(len(slaps))], at, 0.5 * 10 ** (rng.uniform(-3, 1.5) / 20))
        add(groans[turn % len(groans)], t0 + rng.uniform(0.9, 1.6), 0.32 * 10 ** (rng.uniform(-2, 1) / 20))
        add(knock, t0 + MILL_REV * 0.75 + rng.normal(0, 0.01), 0.45 * 10 ** (rng.uniform(-2, 1) / 20))
    # three periods, so build.py can cut a loop anywhere in the middle with its pre-roll
    y = np.tile(y, 3)
    return y / np.abs(y).max() * 0.6


def generate(raw: str) -> None:
    out = os.path.join(raw, "gen")
    os.makedirs(out, exist_ok=True)
    stamp = os.path.join(out, "VERSION")
    if os.path.exists(stamp) and open(stamp).read().strip() == VERSION and all(
        os.path.exists(os.path.join(out, f)) for f in ("clock.wav", "forge.wav", "mill.wav")
    ):
        return
    dsp.write_wav(os.path.join(out, "clock.wav"), clock(raw))
    dsp.write_wav(os.path.join(out, "forge.wav"), forge())
    dsp.write_wav(os.path.join(out, "mill.wav"), mill(raw))
    with open(stamp, "w") as f:
        f.write(VERSION)


if __name__ == "__main__":
    generate(sys.argv[1])
    print("wrote", os.path.join(sys.argv[1], "gen"))
