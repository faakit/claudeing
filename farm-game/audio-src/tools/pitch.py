"""Estimate the pitch of tonal samples (YIN on a steady window) so zone maps are checked, not assumed.

Usage: python -I pitch.py FILE [FILE ...]   -> prints estimated MIDI note (fractional) per file.
"""
import sys

import numpy as np

sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from analyze import SR, load  # noqa: E402

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def note_name(m: float) -> str:
    r = int(round(m))
    return f"{NAMES[r % 12]}{r // 12 - 1}"


def name_to_midi(n: str) -> int:
    n = n.replace("b", "")
    letter = n[0].upper()
    acc = 1 if "#" in n else 0
    octave = int(n[1 + acc :])
    return NAMES.index(letter) + acc + (octave + 1) * 12


def yin_f0(x: np.ndarray, fmin=40.0, fmax=2500.0) -> float:
    n = len(x)
    tau_max = int(SR / fmin)
    tau_min = int(SR / fmax)
    w = n - tau_max
    if w < 256:
        return float("nan")
    d = np.array([np.sum((x[:w] - x[t : t + w]) ** 2) for t in range(tau_max)])
    cmnd = np.ones_like(d)
    cmnd[1:] = d[1:] * np.arange(1, tau_max) / np.maximum(np.cumsum(d[1:]), 1e-12)
    cand = np.nonzero(cmnd[tau_min:] < 0.15)[0]
    if len(cand):
        t = cand[0] + tau_min
        while t + 1 < tau_max and cmnd[t + 1] < cmnd[t]:
            t += 1
    else:
        t = int(np.argmin(cmnd[tau_min:]) + tau_min)
    # parabolic refinement
    if 1 <= t < tau_max - 1:
        a, b, c = cmnd[t - 1], cmnd[t], cmnd[t + 1]
        den = a - 2 * b + c
        t = t + (0.5 * (a - c) / den if den else 0)
    return SR / t


def estimate(path: str, start=0.12, dur=0.35) -> float:
    x = load(path)
    a = np.abs(x)
    on = int(np.argmax(a > a.max() * 0.1))
    seg = x[on + int(start * SR) : on + int((start + dur) * SR)]
    f = yin_f0(seg.astype(np.float64))
    return 69 + 12 * np.log2(f / 440.0)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        m = estimate(p)
        print(f"{p.replace(chr(92), '/').split('/')[-1]:40} {m:7.2f} {note_name(m)}")
