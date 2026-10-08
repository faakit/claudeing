"""Build the game's audio files from the raw sources (deterministic; run after fetch.py).

Usage: python -I build.py RAW_DIR [--only instruments|sfx|ambience]

Reads audio-src/recipes.json, writes MP3s to public/assets/audio/ and the runtime manifest to
src/audio/manifest.json, plus a per-file prep report to audio-src/prep-report.md.
Nobody can listen while building this, so every file is measured instead: onset, fades, tail,
loudness (active-region RMS and max momentary), true peak, pitch, loop seams.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402
from dsp import SR  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
GAME = os.path.dirname(SRC)
OUT = os.path.join(GAME, "public", "assets", "audio")
MANIFEST = os.path.join(GAME, "src", "audio", "manifest.json")
REPORT = os.path.join(SRC, "prep-report.md")

PRE_ROLL = int(0.002 * SR)  # keep 2 ms before the onset, faded in, so attacks are not clipped
TP_CEIL_DB = -1.0
report: list[str] = []


def raw_path(raw: str, sid: str) -> str:
    for ext in (".wav", ".ogg", ".mp3", ".flac"):
        p = os.path.join(raw, sid + ext)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(sid)


def trim_start(x: np.ndarray, rel_db: float = -40.0) -> np.ndarray:
    on = dsp.onset(x, rel_db)
    s = max(0, on - PRE_ROLL)
    y = x[s:].copy()
    return dsp.fade(y, fade_in=min(PRE_ROLL, on - s) or 0)


def decay_end(x: np.ndarray, max_len: float, floor_db: float = -55.0) -> int:
    """Cut where the 10 ms envelope stays below `floor_db` of the peak, or at max_len."""
    env = dsp.envelope(x, 441)
    thr = env.max() * dsp.undb(floor_db)
    loud = np.nonzero(env > thr)[0]
    end = (loud[-1] + 1) * 441 if len(loud) else len(x)
    return int(min(end, int(max_len * SR), len(x)))


def best_loop(x: np.ndarray, a: int, lmin: int, lmax: int, w: int = 1323) -> tuple[int, float]:
    """Loop length in [lmin, lmax] whose end best matches the start window (normalized xcorr)."""
    ref = x[a : a + w]
    ref = ref - ref.mean()
    best, best_l = -2.0, lmin
    for length in range(lmin, lmax, 3):
        seg = x[a + length : a + length + w]
        if len(seg) < w:
            break
        seg = seg - seg.mean()
        c = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-12))
        if c > best:
            best, best_l = c, length
    # refine to the single sample
    for length in range(max(lmin, best_l - 3), best_l + 4):
        seg = x[a + length : a + length + w]
        if len(seg) < w:
            continue
        seg = seg - seg.mean()
        c = float(np.dot(ref, seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-12))
        if c > best:
            best, best_l = c, length
    return best_l, best


def flatten_from(x: np.ndarray, start: int, win: int = 2205) -> np.ndarray:
    """Hold the RMS envelope constant from `start` on (sustain loops must not swell or decay)."""
    env = dsp.envelope(x, win)
    centers = (np.arange(len(env)) + 0.5) * win
    # smooth the envelope over ~150 ms so vibrato is kept but the overall decay is removed
    k = 3
    pad = np.pad(env, k, mode="edge")
    smooth = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]
    e_t = np.interp(np.arange(len(x)), centers, smooth)
    ref = e_t[start]
    g = np.ones(len(x))
    ramp = int(0.05 * SR)
    g[start:] = ref / np.maximum(e_t[start:], 1e-9)
    g[max(0, start - ramp) : start] = np.linspace(1, g[start], start - max(0, start - ramp))
    return x * g


def bake_loop(x: np.ndarray, a: int, length: int, xfade: int, margin: int) -> np.ndarray:
    """Crossfade so that playing past a+length continues exactly as from a.

    The result also carries `margin` samples after the loop end that repeat the loop start, so the
    loop stays seamless even if a decoder shifts the loop points by up to +-margin samples.
    """
    e = a + length
    y = x[: e + margin].copy()
    # Linear (equal-gain) crossfade: best_loop phase-aligns the two ends, so they are correlated and
    # an equal-power curve would swell by up to 3 dB in the middle of the fade.
    t = np.linspace(0, 1, xfade)
    y[e - xfade : e] = x[e - xfade : e] * (1 - t) + x[a - xfade : a] * t
    y[e : e + margin] = x[a : a + margin]
    return y


def seam_stats(y: np.ndarray, a: int, e: int) -> tuple[float, float]:
    """Discontinuity at the loop jump (as a fraction of local RMS) and RMS ratio either side (dB)."""
    w = int(0.05 * SR)
    before = y[e - w : e]
    after = y[a : a + w]
    jump = abs(float(y[e - 1]) - float(y[a]))
    local = np.sqrt(np.mean(np.concatenate([before, after]) ** 2)) + 1e-12
    ratio = dsp.db(np.sqrt(np.mean(after**2)) / (np.sqrt(np.mean(before**2)) + 1e-12))
    return jump / local, ratio


def natural_jump(y: np.ndarray, a: int, e: int) -> float:
    """95th percentile of |x[n] - x[n-1]| / RMS inside the body: what a seam jump is compared with."""
    body = y[a:e]
    rms = np.sqrt(np.mean(body**2)) + 1e-12
    return float(np.percentile(np.abs(np.diff(body)), 95) / rms)


def internal_steps(y: np.ndarray, a: int, e: int) -> float:
    """95th percentile of |RMS change| between adjacent 50 ms windows inside the loop body (dB).

    Vibrato makes neighbouring windows differ anyway; a seam step within this range is not a bump.
    """
    w = int(0.05 * SR)
    steps = []
    for t in range(a + w, e - w, w // 2):
        r1 = np.sqrt(np.mean(y[t - w : t] ** 2))
        r2 = np.sqrt(np.mean(y[t : t + w] ** 2))
        steps.append(abs(dsp.db(r2 / (r1 + 1e-12))))
    return float(np.percentile(steps, 95)) if steps else 0.0


def build_instruments(raw: str, recipes: dict) -> dict:
    out = {}
    report.append("## Instruments\n")
    report.append(
        "| instrument | zone | root (measured) | onset ms | length s | tail kept s | loop s | seam jump/RMS"
        " | seam dB | level dB | TP dBTP |"
    )
    report.append("|---|---|---|---|---|---|---|---|---|---|---|")
    for name, r in recipes["instruments"].items():
        kind = r["kind"]
        items = list(r["zones"].items()) if "zones" in r else [(str(i), s) for i, s in enumerate(r["hits"])]
        prepped = []
        for key, sid in items:
            x = dsp.highpass(dsp.load(raw_path(raw, sid)), 35 if kind != "perc" else 60)
            x = trim_start(x, -40)
            root = None
            if kind != "perc":
                expect = int(key)
                root = dsp.fundamental(x, expect)
                if not np.isfinite(root) or abs(root - expect) > 0.5:
                    raise SystemExit(f"{name} {key}: measured pitch {root} does not match {expect}")
            loop = None
            if kind == "sustain":
                # try a few loop starts after the attack; keep the best-correlated loop
                cands = []
                for a_s in (0.6, 0.68, 0.76, 0.84):
                    a = int(a_s * SR)
                    xf = flatten_from(x, a - int(0.25 * SR))
                    length, corr = best_loop(xf, a, int(0.9 * SR), int(1.35 * SR))
                    cands.append((corr, a, length, xf))
                corr, a, length, x = max(cands, key=lambda c: c[0])
                xfade, margin = int(0.18 * SR), int(0.08 * SR)
                y = bake_loop(x, a, length, xfade, margin)
                y = dsp.fade(y, fade_out=int(0.02 * SR))
                loop = (a, a + length)
                level = np.sqrt(np.mean(y[a : a + length] ** 2))
                tail = margin / SR
            else:
                end = decay_end(x, r["maxLen"])
                y = x[:end].copy()
                y = dsp.fade(y, fade_out=max(int(0.3 * len(y)), int(0.01 * SR)))
                level = np.sqrt(np.mean(y[: int(0.3 * SR)] ** 2))
                tail = len(y) / SR
            prepped.append({"key": key, "sid": sid, "y": y, "root": root, "loop": loop, "level": level,
                            "tail": tail, "corr": corr if kind == "sustain" else 0.0})
        # Match zones to the instrument's median level, then set the instrument level and true-peak ceiling.
        med = float(np.median([p["level"] for p in prepped]))
        for p in prepped:
            p["y"] = p["y"] * (med / p["level"])
        target = dsp.undb(-20.0) / med
        tp = max(dsp.true_peak(p["y"]) for p in prepped) * target
        if tp > dsp.undb(TP_CEIL_DB):
            target *= dsp.undb(TP_CEIL_DB) / tp
        zones = []
        for i, p in enumerate(prepped):
            y = p["y"] * target
            fname = f"inst/{name}-{p['key']}.mp3"
            dsp.encode_mp3(y, os.path.join(OUT, fname), quality=5)
            onset_s = dsp.onset(y, -40) / SR
            z = {"file": fname, "onset": round(onset_s, 5), "dur": round(len(y) / SR, 4)}
            if p["root"] is not None:
                z["root"] = round(float(p["root"]), 2)
            # Bowed and blown attacks take a while to speak: how long until -20 dB re peak (5 ms RMS),
            # so the engine can start the note that much early and keep it on the beat.
            env5 = dsp.envelope(y, 220)
            reach = int(np.argmax(env5 >= env5.max() * 0.1)) * 220 / SR
            lag = reach - onset_s
            if kind == "sustain" and lag > 0.02:
                z["lag"] = round(min(lag, 0.15), 4)
            seam = ("", "")
            if p["loop"]:
                a, e = p["loop"]
                z["loop"] = [round(a / SR, 5), round(e / SR, 5)]
                j, rat = seam_stats(y, a, e)
                seam = (f"{j:.3f} (body p95 {natural_jump(y, a, e):.3f})",
                        f"{rat:+.2f} (body p95 {internal_steps(y, a, e):.2f}, corr {p['corr']:.3f})")
            zones.append(z)
            lvl = dsp.db(np.sqrt(np.mean(y[p["loop"][0] : p["loop"][1]] ** 2)) if p["loop"]
                         else np.sqrt(np.mean(y[: int(0.3 * SR)] ** 2)))
            report.append(
                f"| {name} | {p['key']} | {z.get('root', '-')} | {onset_s * 1000:.1f} | {len(y) / SR:.2f} |"
                f" {p['tail']:.2f} | {z.get('loop', '-')} | {seam[0]} | {seam[1]} | {lvl:.1f} |"
                f" {dsp.db(dsp.true_peak(y)):.1f} |"
            )
        entry = {"kind": kind}
        entry["zones" if kind != "perc" else "hits"] = zones
        out[name] = entry
    report.append("")
    return out


_cache: dict = {}


def load_src(raw: str, sid: str) -> np.ndarray:
    if sid not in _cache:
        _cache[sid] = dsp.load(raw_path(raw, sid))
    return _cache[sid]


def resample_shift(x: np.ndarray, semis: float) -> np.ndarray:
    """Pitch by resampling (like a tape speed change): +12 = an octave up and half as long."""
    if not semis:
        return x
    ratio = 2 ** (semis / 12)
    n = int(len(x) / ratio)
    return np.interp(np.arange(n) * ratio, np.arange(len(x)), x)


def render_part(raw: str, part: dict, hp: float) -> np.ndarray:
    x = load_src(raw, part["src"])
    a = int(part.get("from", 0) * SR)
    b = int(part["to"] * SR) if "to" in part else len(x)
    seg = dsp.highpass(x[a:b], hp)
    seg = resample_shift(seg, part.get("shift", 0))
    seg = dsp.fade(seg, fade_in=int(0.002 * SR) if a > 0 else 0, fade_out=int(0.01 * SR) if "to" in part else 0)
    return seg * dsp.undb(part.get("gain", 0))


def mix_parts(raw: str, parts: list, hp: float) -> np.ndarray:
    rendered = [(int(p.get("at", 0) * SR), render_part(raw, p, hp)) for p in parts]
    n = max(at + len(y) for at, y in rendered)
    out = np.zeros(n)
    for at, y in rendered:
        out[at : at + len(y)] += y
    return out


def finish_shot(y: np.ndarray, level_db: float, max_len: float = 2.0, by: str = "rms") -> np.ndarray:
    """Start at the attack, drop the silent tail, fade out, and match the target loudness:
    by="lufs": max momentary loudness (K-weighted, 400 ms) as played on the stereo bus;
    by="rms": RMS over the active region (used for ambience one-shots)."""
    y = trim_start(y, -40)
    end = decay_end(y, max_len, -50)
    y = dsp.fade(y[:end], fade_out=min(int(0.03 * SR), max(end // 3, 1)))

    def loud(v: np.ndarray) -> float:
        return dsp.momentary_lufs(v) if by == "lufs" else dsp.db(dsp.active_rms(v))

    for _ in range(4):
        y = y * dsp.undb(level_db - loud(y))
        if dsp.true_peak(y) <= dsp.undb(TP_CEIL_DB - 0.5):
            break
        # Spiky sounds (coins) reach the ceiling long before the target loudness: limit the spikes
        # (a few ms each) instead of turning the whole sound down by several dB.
        y = dsp.limit(y, dsp.undb(TP_CEIL_DB - 1.5))
    tp = dsp.true_peak(y)
    # leave 0.5 dB for MP3 encoding overshoot
    if tp > dsp.undb(TP_CEIL_DB - 0.5):
        y = y * (dsp.undb(TP_CEIL_DB - 0.5) / tp)
    return y


def encoded_tp(path: str) -> float:
    return dsp.db(dsp.true_peak(dsp.load(path)))


def shot_row(name: str, i: int, y: np.ndarray, target: float, path: str) -> str:
    return (
        f"| {name} | {i} | {len(y) / SR * 1000:.0f} | {dsp.onset(y, -40) / SR * 1000:.1f} |"
        f" {dsp.momentary_lufs(y):.1f} | {dsp.db(dsp.active_rms(y)):.1f} | {target:.0f} | {encoded_tp(path):.1f} |"
    )


def build_sfx(raw: str, recipes: dict) -> dict:
    out = {}
    report.append("## Sound effects")
    report.append("Sound effects are matched on max momentary loudness (K-weighted, 400 ms, as played on the")
    report.append("stereo sfx bus); the target is set by role. TP is measured on the decoded MP3, 4x oversampled.")
    report.append("Add the sfx bus gain at default settings (-2.9 dB) for the in-game level.")
    report.append("")
    report.append("| cue | take | length ms | onset ms | max momentary LUFS | active RMS dB | target LUFS | TP dBTP (MP3) |")
    report.append("|---|---|---|---|---|---|---|---|")
    for cue, r in recipes["sfx"].items():
        fam = recipes["families"][r["family"]]
        hp = r.get("hp", fam["hp"])
        files = []
        for i, parts in enumerate(r["variants"]):
            y = finish_shot(mix_parts(raw, parts, hp), fam["lufs"], by="lufs")
            fname = f"sfx/{cue}-{i + 1}.mp3"
            dsp.encode_mp3(y, os.path.join(OUT, fname), quality=5)
            files.append({"file": fname, "onset": round(dsp.onset(y, -40) / SR, 5), "dur": round(len(y) / SR, 4)})
            report.append(shot_row(cue, i + 1, y, fam["lufs"], os.path.join(OUT, fname)))
        out[cue] = {"files": files, "gain": 1, "pitch": r["pitch"], "vol": r["vol"], "voices": r["voices"]}
        if "repeatDb" in r:
            out[cue]["repeatDb"] = r["repeatDb"]
    report.append("")
    return out


def build_ambience(raw: str, recipes: dict) -> dict:
    out = {}
    report.append("## Ambience")
    report.append("Beds are matched on RMS over the loop, one-shots on active-region RMS (target column).")
    report.append("")
    report.append("| bed | take | length ms | onset ms | max momentary LUFS | RMS dB | target dB | TP dBTP | loop seam |")
    report.append("|---|---|---|---|---|---|---|---|---|")
    for name, r in recipes["ambience"].items():
        if r["mode"] == "loop":
            x = dsp.highpass(load_src(raw, r["src"]), r["hp"])
            # Several layers of different lengths play together, so the combined pattern repeats
            # only after their least common multiple (each layer alone is a seamless loop).
            layers = r["layers"] if "layers" in r else [{"from": r["from"], "body": r["body"]}]
            level = r["level"] - 10 * np.log10(len(layers))
            files = []
            for li, lay in enumerate(layers):
                body = int(round(lay["body"] * SR))
                assert abs(lay["body"] * 300 - round(lay["body"] * 300)) < 1e-6, "loop body must be a multiple of 1/300 s"
                xfade = int(min(1.0, lay["body"] / 4) * SR)
                pre = max(xfade, int(0.5 * SR))
                start = int(lay["from"] * SR) - pre
                assert start >= 0, f"{name}: 'from' must leave {pre / SR:.2f} s of pre-roll for the crossfade"
                seg = x[start : start + pre + body + int(0.1 * SR)].copy()
                assert len(seg) == pre + body + int(0.1 * SR), f"{name}: source too short for this layer"
                # Equal-power crossfade: ambience is noise-like, the two ends are uncorrelated.
                e = pre + body
                t = np.linspace(0, np.pi / 2, xfade)
                y = seg.copy()
                y[e - xfade : e] = seg[e - xfade : e] * np.cos(t) + seg[pre - xfade : pre] * np.sin(t)
                y[e : e + int(0.1 * SR)] = seg[pre : pre + int(0.1 * SR)]
                y = y * (dsp.undb(level) / np.sqrt(np.mean(y[pre:e] ** 2)))
                tp = dsp.true_peak(y)
                if tp > dsp.undb(TP_CEIL_DB):
                    y = y * (dsp.undb(TP_CEIL_DB) / tp)
                fname = f"amb/{name}.mp3" if li == 0 else f"amb/{name}-{li + 1}.mp3"
                dsp.encode_mp3(y, os.path.join(OUT, fname), quality=6)
                j, rat = seam_stats(y, pre, e)
                files.append({"file": fname, "onset": 0, "dur": round(len(y) / SR, 4),
                              "loop": [round(pre / SR, 5), round(e / SR, 5)]})
                report.append(
                    f"| {name} | loop {li + 1} ({lay['body']} s) | {len(y) / SR * 1000:.0f} | - |"
                    f" {dsp.momentary_lufs(y):.1f} | {dsp.db(np.sqrt(np.mean(y[pre:e] ** 2))):.1f} | {level:.0f} |"
                    f" {encoded_tp(os.path.join(OUT, fname)):.1f} | jump/RMS {j:.3f}"
                    f" (body p95 {natural_jump(y, pre, e):.3f}), step {rat:+.2f} dB (body p95 {internal_steps(y, pre, e):.2f}) |"
                )
            out[name] = {"files": files, "gain": 1, "mode": "loop"}
        else:
            files = []
            for i, part in enumerate(r["shots"]):
                y = finish_shot(mix_parts(raw, [part], r["hp"]), r["level"], r.get("maxLen", 2.0))
                fname = f"amb/{name}-{i + 1}.mp3"
                dsp.encode_mp3(y, os.path.join(OUT, fname), quality=6)
                files.append({"file": fname, "onset": round(dsp.onset(y, -40) / SR, 5), "dur": round(len(y) / SR, 4)})
                report.append(shot_row(name, i + 1, y, r["level"], os.path.join(OUT, fname)) + " - |")
            out[name] = {"files": files, "gain": 1, "mode": "shots", "every": r["every"]}
    report.append("")
    return out


def main() -> None:
    raw = sys.argv[1]
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    recipes = json.load(open(os.path.join(SRC, "recipes.json"), encoding="utf8"))
    manifest = json.load(open(MANIFEST, encoding="utf8")) if os.path.exists(MANIFEST) else {}
    report.append("# Audio prep report (generated by audio-src/tools/build.py)\n")
    if only in (None, "instruments"):
        manifest["instruments"] = build_instruments(raw, recipes)
    if only in (None, "sfx"):
        manifest["sfx"] = build_sfx(raw, recipes)
    if only in (None, "ambience"):
        manifest["ambience"] = build_ambience(raw, recipes)
    manifest = {k: manifest[k] for k in ("instruments", "sfx", "ambience") if k in manifest}
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf8", newline="\n") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")
    with open(REPORT, "w", encoding="utf8", newline="\n") as f:
        f.write("\n".join(report) + "\n")
    print(f"wrote {MANIFEST}")


if __name__ == "__main__":
    main()
