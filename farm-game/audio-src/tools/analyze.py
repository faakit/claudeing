"""Describe audio files numerically (nobody on this project can listen while building it).

Usage: python -I analyze.py FILE [FILE ...]
Prints per file: duration, peak dBFS, RMS dBFS, leading silence (ms, -50 dBFS gate), time to peak,
spectral centroid (Hz, a brightness proxy), and the fraction of energy below 300 Hz.
"""
import subprocess
import sys

import numpy as np

SR = 44100


def load_channels(path: str) -> np.ndarray:
    """Decode to float32 at SR, shape (channels, samples). Stereo stays stereo (no pan-law gain)."""
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
         "-of", "csv=p=0", path],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    ch = min(2, int(probe or "1"))
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).T


def load(path: str) -> np.ndarray:
    """Mono as the plain average of the channels (ffmpeg's -ac 1 adds a +3 dB pan law)."""
    return load_channels(path).mean(axis=0)


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-9))


def describe(x: np.ndarray) -> dict:
    a = np.abs(x)
    peak = float(a.max()) if len(a) else 0.0
    rms = float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) if len(x) else 0.0
    gate = 10 ** (-50 / 20)
    above = np.nonzero(a > gate)[0]
    lead = (above[0] / SR * 1000) if len(above) else float("nan")
    tail = ((len(x) - above[-1]) / SR * 1000) if len(above) else float("nan")
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) if len(x) > 32 else np.zeros(2)
    freqs = np.fft.rfftfreq(len(x), 1 / SR) if len(x) > 32 else np.zeros(2)
    p = spec**2
    tot = p.sum() or 1.0
    return {
        "dur_ms": len(x) / SR * 1000,
        "peak_db": db(peak),
        "rms_db": db(rms),
        "lead_ms": lead,
        "tail_ms": tail,
        "t_peak_ms": float(np.argmax(a)) / SR * 1000 if len(a) else 0,
        "centroid": float((freqs * p).sum() / tot),
        "low_frac": float(p[freqs < 300].sum() / tot),
        # Loudness as a phone speaker would roughly render it: energy above 400 Hz only.
        "phone_db": db(float(np.sqrt(p[freqs >= 400].sum() / tot)) * rms),
    }


if __name__ == "__main__":
    print(f"{'file':42} {'dur':>6} {'peak':>6} {'rms':>6} {'lead':>5} {'tail':>5} {'tpk':>5} {'cent':>6} {'low':>5} {'phone':>6}")
    for f in sys.argv[1:]:
        d = describe(load(f))
        name = f.replace("\\", "/").split("/")[-1][:42]
        print(
            f"{name:42} {d['dur_ms']:6.0f} {d['peak_db']:6.1f} {d['rms_db']:6.1f} {d['lead_ms']:5.0f}"
            f" {d['tail_ms']:5.0f} {d['t_peak_ms']:5.0f} {d['centroid']:6.0f} {d['low_frac']:5.2f} {d['phone_db']:6.1f}"
        )
