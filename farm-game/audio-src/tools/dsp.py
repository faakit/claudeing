"""Small numpy DSP helpers shared by the audio build tools (no scipy on purpose)."""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100


def load(path: str, sr: int = SR) -> np.ndarray:
    """Decode any file to mono float64 at `sr` (plain channel average, no pan-law gain)."""
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
         "-of", "csv=p=0", path],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    ch = min(2, int(probe or "1"))
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(sr), "-f", "f64le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float64).reshape(-1, ch).mean(axis=1).copy()


def db(x: float) -> float:
    return 20 * np.log10(max(float(x), 1e-12))


def undb(d: float) -> float:
    return 10 ** (d / 20)


def highpass(x: np.ndarray, fc: float, sr: int = SR, order: int = 2) -> np.ndarray:
    """Zero-phase FFT high-pass with a Butterworth-shaped magnitude (removes DC and rumble)."""
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(max(n, 2) * 2)))
    f = np.fft.rfftfreq(nfft, 1 / sr)
    h = 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(np.fft.rfft(x, nfft) * h, nfft)[:n]


def lowpass(x: np.ndarray, fc: float, sr: int = SR, order: int = 2) -> np.ndarray:
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(max(n, 2) * 2)))
    f = np.fft.rfftfreq(nfft, 1 / sr)
    h = 1 / np.sqrt(1 + (f / fc) ** (2 * order))
    return np.fft.irfft(np.fft.rfft(x, nfft) * h, nfft)[:n]


def true_peak(x: np.ndarray) -> float:
    """Peak of the 4x oversampled signal (what a DAC or a resampler may produce)."""
    if len(x) == 0:
        return 0.0
    n = len(x)
    spec = np.fft.rfft(x)
    up = np.fft.irfft(spec, n * 4) * 4
    return float(max(np.abs(up).max(), np.abs(x).max()))


def onset(x: np.ndarray, rel_db: float = -40.0) -> int:
    """First sample above `rel_db` relative to the peak."""
    a = np.abs(x)
    thr = a.max() * undb(rel_db)
    idx = np.nonzero(a > thr)[0]
    return int(idx[0]) if len(idx) else 0


def envelope(x: np.ndarray, win: int = 441) -> np.ndarray:
    """RMS envelope, one value per `win` samples."""
    n = len(x) // win
    if n == 0:
        return np.array([np.sqrt(np.mean(x**2))]) if len(x) else np.zeros(1)
    return np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1))


def active_rms(x: np.ndarray, gate_db: float = -30.0, win: int = 441) -> float:
    """RMS over the 10 ms blocks within `gate_db` of the loudest block (the 'active region')."""
    env = envelope(x, win)
    if env.max() <= 0:
        return 0.0
    keep = env >= env.max() * undb(gate_db)
    return float(np.sqrt(np.mean(env[keep] ** 2)))


def max_momentary(x: np.ndarray, sr: int = SR) -> float:
    """Max RMS over sliding 400 ms windows (momentary-loudness-like, unweighted) in dBFS."""
    w = int(0.4 * sr)
    if len(x) <= w:
        return db(np.sqrt(np.mean(x**2)) * np.sqrt(len(x) / w)) if len(x) else -120.0
    c = np.concatenate([[0.0], np.cumsum(x**2)])
    m = (c[w:] - c[:-w]) / w
    return db(np.sqrt(m.max()))


def fade(x: np.ndarray, fade_in: int = 0, fade_out: int = 0) -> np.ndarray:
    y = x.copy()
    if fade_in > 0:
        y[:fade_in] *= np.sin(np.linspace(0, np.pi / 2, fade_in)) ** 2
    if fade_out > 0:
        y[-fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out)) ** 2
    return y


def write_wav(path: str, x: np.ndarray, sr: int = SR) -> None:
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def encode_mp3(x: np.ndarray, out_path: str, quality: int = 5, sr: int = SR) -> None:
    """Mono MP3 (LAME VBR). Deterministic for the same input and ffmpeg/LAME version."""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        write_wav(tmp, x, sr)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", tmp, "-map_metadata", "-1", "-codec:a", "libmp3lame",
             "-q:a", str(quality), "-ar", str(sr), "-ac", "1", "-write_xing", "1", "-id3v2_version", "0",
             out_path],
            check=True,
        )
    finally:
        os.remove(tmp)


def fundamental(x: np.ndarray, expect_midi: float, start: float = 0.03, length: float = 0.4,
                sr: int = SR) -> float:
    """Pitch near `expect_midi`; low notes with a weak fundamental are read from the 2nd or 3rd partial."""
    for harmonic, offset in ((1, 0.0), (2, 12.0), (3, 12 * np.log2(3))):
        m = _partial(x, expect_midi + offset, start, length, sr)
        if np.isfinite(m):
            return m - offset
    return float("nan")


def _partial(x: np.ndarray, expect_midi: float, start: float, length: float, sr: int) -> float:
    """Fractional MIDI of the spectral peak nearest to `expect_midi` (within +-0.75 semitone)."""
    on = onset(x, -20)
    seg = x[on + int(start * sr): on + int((start + length) * sr)]
    seg = seg * np.hanning(len(seg))
    nfft = 1 << 18
    spec = np.abs(np.fft.rfft(seg, nfft))
    f = np.fft.rfftfreq(nfft, 1 / sr)
    f0 = 440 * 2 ** ((expect_midi - 69) / 12)
    lo, hi = f0 * 2 ** (-0.75 / 12), f0 * 2 ** (0.75 / 12)
    band = (f >= lo) & (f <= hi)
    if not band.any():
        return float("nan")
    i = int(np.nonzero(band)[0][np.argmax(spec[band])])
    la, lb, lc = np.log(spec[i - 1] + 1e-12), np.log(spec[i] + 1e-12), np.log(spec[i + 1] + 1e-12)
    den = la - 2 * lb + lc
    d = 0.5 * (la - lc) / den if den else 0
    fi = f[i] + d * (f[1] - f[0])
    # the peak must be a real partial, not the floor: within 30 dB of the strongest peak
    if spec[i] < spec[(f > 30) & (f < 8000)].max() * undb(-40):
        return float("nan")
    return 69 + 12 * np.log2(fi / 440)


def limit(x: np.ndarray, ceiling: float, lookahead: float = 0.0015, release: float = 0.06, sr: int = SR) -> np.ndarray:
    """Transparent-ish lookahead peak limiter (for very spiky one-shots like coins)."""
    a = np.abs(x)
    need = np.minimum(1.0, ceiling / np.maximum(a, 1e-12))
    la = max(1, int(lookahead * sr))
    # gain must already be down when the peak arrives: running minimum over the lookahead window
    pad = np.concatenate([need, np.ones(la)])
    g = np.min(np.lib.stride_tricks.sliding_window_view(pad, la + 1), axis=1)[: len(x)]
    # release: gain may only rise slowly (one-pole), never faster than `release`
    out = np.empty_like(g)
    k = np.exp(-1.0 / (release * sr))
    cur = 1.0
    for i, v in enumerate(g):
        cur = v if v < cur else v + (cur - v) * k
        out[i] = cur
    # smooth the attack too (1 ms) so the gain change is not a click
    w = max(1, int(0.001 * sr))
    out = np.convolve(np.pad(out, (w, w), mode="edge"), np.ones(2 * w + 1) / (2 * w + 1), mode="same")[w:-w]
    return x * np.minimum(out, g)


# ITU-R BS.1770 K-weighting (pre-filter shelf + RLB high-pass), coefficients for 48 kHz. Applied as a
# magnitude response in the FFT domain (evaluated at the same physical frequencies), which is exact
# enough below 20 kHz for loudness measurement at 44.1 kHz.
_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def _biquad_mag(b, a, f):
    z = np.exp(-1j * 2 * np.pi * f / 48000.0)
    return np.abs((b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z))


def k_weight(x: np.ndarray, sr: int = SR) -> np.ndarray:
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(max(n, 2) * 2)))
    f = np.fft.rfftfreq(nfft, 1 / sr)
    h = _biquad_mag(*_K1, f) * _biquad_mag(*_K2, f)
    return np.fft.irfft(np.fft.rfft(x, nfft) * h, nfft)[:n]


def momentary_lufs(x: np.ndarray, sr: int = SR, channels: int = 2) -> float:
    """Max momentary loudness (400 ms windows, 100 ms hop) of a mono signal as it plays on a stereo
    bus (both channels equal, so +3 dB over one channel). Short sounds are padded with silence."""
    w = int(0.4 * sr)
    y = k_weight(np.concatenate([x, np.zeros(w)]), sr)
    c = np.concatenate([[0.0], np.cumsum(y**2)])
    hop = int(0.1 * sr)
    starts = np.arange(0, max(1, len(y) - w + 1), hop)
    ms = (c[starts + w] - c[starts]) / w
    return float(-0.691 + 10 * np.log10(max(ms.max() * channels, 1e-12)))
