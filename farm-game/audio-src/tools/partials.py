"""List the strongest spectral peaks of a sample (as MIDI notes with relative dB), to check pitch by eye.

Usage: python -I partials.py [--from S] [--len S] FILE ...
"""
import sys

import numpy as np

sys.path.insert(0, __file__.replace("\\", "/").rsplit("/", 1)[0])
from analyze import SR, load  # noqa: E402


def peaks(x: np.ndarray, start: float, length: float, n=6):
    a = np.abs(x)
    on = int(np.argmax(a > a.max() * 0.1))
    seg = x[on + int(start * SR) : on + int((start + length) * SR)].astype(np.float64)
    seg = seg * np.hanning(len(seg))
    nfft = 1 << 17
    spec = np.abs(np.fft.rfft(seg, nfft))
    f = np.fft.rfftfreq(nfft, 1 / SR)
    ok = (f > 30) & (f < 8000)
    s = np.where(ok, spec, 0)
    out = []
    for _ in range(n):
        i = int(np.argmax(s))
        if s[i] <= 0:
            break
        # parabolic interpolation on log magnitude
        if 0 < i < len(s) - 1 and s[i - 1] > 0 and s[i + 1] > 0:
            la, lb, lc = np.log(s[i - 1]), np.log(s[i]), np.log(s[i + 1])
            d = 0.5 * (la - lc) / (la - 2 * lb + lc)
        else:
            d = 0
        fi = f[i] + d * (f[1] - f[0])
        out.append((69 + 12 * np.log2(fi / 440), 20 * np.log10(s[i] / spec[ok].max())))
        lo, hi = int(i * 0.94), int(i * 1.06) + 2
        s[lo:hi] = 0
    return sorted(out)


if __name__ == "__main__":
    args = sys.argv[1:]
    start, length = 0.03, 0.4
    if "--from" in args:
        i = args.index("--from"); start = float(args[i + 1]); del args[i : i + 2]
    if "--len" in args:
        i = args.index("--len"); length = float(args[i + 1]); del args[i : i + 2]
    for p in args:
        pk = peaks(load(p), start, length)
        name = p.replace("\\", "/").split("/")[-1]
        print(f"{name:32}", "  ".join(f"{m:6.2f}({db:4.0f})" for m, db in pk))
