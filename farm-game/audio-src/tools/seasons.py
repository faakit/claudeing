"""How different are the pieces? Measures the composed music (src/audio/music.json) and, optionally,
long offline renders of it, so "each season has its own harmony and melodies" is a number, not a claim.

Usage:
  python -I seasons.py [MUSIC_JSON] [--renders DIR] [--md]

Data checks (transposition-invariant, over spring, summer, fall, winter, title and festival):
  - section A progressions as Roman numerals (relative to the piece's declared key);
  - chord-bigram Jaccard per pair, maximised over the 12 transpositions (triad-simplified chords);
  - cadence formulas (last three chords of section A, Roman numerals);
  - melody interval 3-gram overlap per pair (|A & B| / min(|A|, |B|));
  - melody features: notes per beat, median pitch, leap share (> 2 st), range, syncopation share.
Render checks (--renders DIR with long-<piece>.wav files from render.mjs):
  - estimated key (Krumhansl-Schmuckler on the whole-render chroma) against the declared key;
  - transposition-invariant bar-chroma similarity per pair (1 = same harmony up to key);
  - spectral centroid.
"""
import itertools
import json
import os
import re
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(os.path.dirname(HERE))
PIECES = ["spring", "summer", "fall", "winter", "title", "festival"]
SEASONS = ["spring", "summer", "fall", "winter"]

LETTERS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
QUALITIES = {
    "": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10], "maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10],
    "sus2": [0, 2, 7], "sus4": [0, 5, 7], "add9": [0, 4, 7, 14], "madd9": [0, 3, 7, 14], "6": [0, 4, 7, 9],
    "m6": [0, 3, 7, 9], "dim": [0, 3, 6], "m7b5": [0, 3, 6, 10], "9": [0, 4, 7, 10, 14],
    "maj9": [0, 4, 7, 11, 14], "m9": [0, 3, 7, 10, 14],
}
ROMAN = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"]
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def pc(letter: str, acc: str) -> int:
    return (LETTERS[letter] + (1 if acc == "#" else -1 if acc == "b" else 0)) % 12


def parse_chord(sym: str) -> dict:
    m = re.match(r"^([A-G])([#b]?)([a-z0-9]*)(?:/([A-G])([#b]?))?$", sym)
    assert m, sym
    root = pc(m[1], m[2])
    q = m[3]
    return {"root": root, "q": q, "tones": QUALITIES[q], "bass": pc(m[4], m[5] or "") if m[4] else root, "sym": sym}


def triad(q: str) -> str:
    """Triad class used for bigrams and cadences: maj, min, dim or sus."""
    if q.startswith("sus"):
        return "sus"
    if q in ("dim", "m7b5"):
        return "dim"
    return "min" if q.startswith("m") and not q.startswith("maj") else "maj"


def parse_chords(line: str, meter: int) -> list[dict]:
    out = []
    for i, bar in enumerate(b.strip() for b in line.split("|")):
        syms = bar.split()
        for j, s in enumerate(syms):
            c = parse_chord(s)
            c["beat"] = i * meter + j * meter / len(syms)
            c["beats"] = meter / len(syms)
            out.append(c)
    return out


def note_midi(name: str) -> int:
    m = re.match(r"^([A-G])([#b]?)(-?\d)$", name)
    return LETTERS[m[1]] + (1 if m[2] == "#" else -1 if m[2] == "b" else 0) + (int(m[3]) + 1) * 12


def parse_phrase(text: str, meter: int) -> list[dict]:
    notes = []
    for i, bar in enumerate(b.strip() for b in text.split("|")):
        t = 0.0
        for tok in bar.split():
            m = re.match(r"^(r|[A-G][#b]?-?\d):(\d*\.?\d+)([!~]?)$", tok)
            d = float(m[2])
            if m[1] != "r":
                notes.append({"beat": i * meter + t, "beats": d, "midi": note_midi(m[1])})
            t += d
    return notes


def roman(c: dict, tonic: int) -> str:
    r = ROMAN[(c["root"] - tonic) % 12]
    q = c["q"]
    if triad(q) in ("min", "dim"):
        r = r.lower()
        q = q[1:] if q.startswith("m") else q
    if c["bass"] != c["root"]:
        q += "/" + ROMAN[(c["bass"] - tonic) % 12]
    return r + q


# Keys of the round-1 pieces (they had no "key" field), so the old music.json can be measured too.
OLD_KEYS = {"spring": "C major", "summer": "D major", "fall": "G minor", "winter": "D minor", "title": "F major",
            "festival": "G major", "mine": "A minor"}


def declared_key(p: dict) -> tuple[int, str]:
    m = re.match(r"^([A-G])([#b]?) (\w+)", p.get("key") or OLD_KEYS.get(p.get("_name", ""), "C major"))
    mode = m[3]
    return pc(m[1], m[2]), ("minor" if mode in ("minor", "aeolian", "dorian", "phrygian") else "major")


def melody_layers(p: dict) -> list[dict]:
    return [l for l in p["layers"] if l.get("phrases")]


def phrase_ids(p: dict, time: str | None = None) -> list[str]:
    ids = []
    for l in melody_layers(p):
        if time and l["time"] not in (time, "both"):
            continue
        for slots in l["phrases"].values():
            for pool in slots:
                ids += [i for i in pool if i not in ids]
    return ids


def trigram_set(p: dict) -> set:
    grams = set()
    for pid in phrase_ids(p):
        ns = [n["midi"] for n in parse_phrase(p["phrases"][pid], p["meter"])]
        iv = [b - a for a, b in zip(ns, ns[1:])]
        grams |= {tuple(iv[i:i + 3]) for i in range(len(iv) - 2)}
    return grams


def bigram_set(p: dict, shift: int = 0) -> set:
    """Consecutive distinct chords inside each section and across the form, as (deg, triad) pairs."""
    tonic = declared_key(p)[0]
    tok = lambda c: ((c["root"] - tonic + shift) % 12, triad(c["q"]))  # noqa: E731
    secs = {k: parse_chords(s["chords"], p["meter"]) for k, s in p["sections"].items()}
    seq = []
    for s in p["form"]:
        seq += [tok(c) for c in secs[s]]
    seq.append(seq[0])
    return {(a, b) for a, b in zip(seq, seq[1:]) if a != b}


def jaccard(a: set, b: set) -> float:
    return len(a & b) / max(1, len(a | b))


def cadence(p: dict) -> str:
    tonic = declared_key(p)[0]
    cs = parse_chords(p["sections"]["A"]["chords"], p["meter"])
    nxt = p["form"][1] if len(p["form"]) > 1 else "A"
    first_next = parse_chords(p["sections"][nxt]["chords"], p["meter"])[0]
    last = cs[-3:]
    # The cadence lands on the first chord of whatever follows when A ends on a pre-tonic chord.
    tail = [roman(c, tonic) for c in last]
    if (last[-1]["root"] - tonic) % 12 != 0:
        tail = tail[1:] + [roman(first_next, tonic)]
    return "-".join(tail)


def features(p: dict, time: str = "day") -> dict:
    """Melody character of the main tune (the day melody, or the only one)."""
    ids = phrase_ids(p, time)
    beats = 0.0
    notes = []
    for pid in ids:
        ph = parse_phrase(p["phrases"][pid], p["meter"])
        bars = p["phrases"][pid].count("|") + 1
        beats += bars * p["meter"]
        notes.append(ph)
    flat = [n for ph in notes for n in ph]
    ivs = [abs(b["midi"] - a["midi"]) for ph in notes for a, b in zip(ph, ph[1:])]
    sync = [n for n in flat if abs(n["beat"] - round(n["beat"])) > 1e-6]
    mids = [n["midi"] for n in flat]
    return {
        "npb": len(flat) / max(beats, 1),
        "median": float(np.median(mids)),
        "leap": sum(1 for i in ivs if i > 2) / max(1, len(ivs)),
        "range": max(mids) - min(mids),
        "sync": len(sync) / max(1, len(flat)),
    }


def consonance(p: dict) -> tuple[int, int, list[str]]:
    """Notes on a beat that are not chord tones and do not resolve by step to the next note."""
    bad, total = [], 0
    for l in melody_layers(p):
        for sec, slots in l["phrases"].items():
            chords = parse_chords(p["sections"][sec]["chords"], p["meter"])
            start = 0
            for pool in slots:
                for pid in pool:
                    ns = parse_phrase(p["phrases"][pid], p["meter"])
                    for k, n in enumerate(ns):
                        if abs(n["beat"] - round(n["beat"])) > 1e-6:
                            continue
                        total += 1
                        b = start * p["meter"] + n["beat"]
                        c = [c for c in chords if c["beat"] <= b + 1e-9][-1]
                        tones = {(c["root"] + t) % 12 for t in c["tones"]} | {c["bass"]}
                        if n["midi"] % 12 in tones:
                            continue
                        nxt = ns[k + 1]["midi"] if k + 1 < len(ns) else None
                        if nxt is None or abs(nxt - n["midi"]) > 2:
                            bad.append(f"{pid}@{n['beat']:g} {NAMES[n['midi'] % 12]} over {c['sym']}")
                start += (p["phrases"][pool[0]].count("|") + 1)
    return len(bad), total, bad


# ------------------------------------------------------------------------------------------ renders
K_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
K_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def load_wav(path: str) -> tuple[np.ndarray, int]:
    w = wave.open(path)
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, 2).mean(1) / 32768
    return x, sr


def chroma(seg: np.ndarray, sr: int) -> np.ndarray:
    n = len(seg)
    X = np.abs(np.fft.rfft(seg * np.hanning(n)))
    f = np.fft.rfftfreq(n, 1 / sr)
    m = (f > 60) & (f < 2000)
    pcs = (np.round(12 * np.log2(f[m] / 440)) + 9) % 12
    c = np.bincount(pcs.astype(int), weights=X[m] ** 2, minlength=12)
    return c / (np.linalg.norm(c) + 1e-12)


def estimate_key(total: np.ndarray) -> tuple[float, int, str]:
    return max((float(np.corrcoef(np.roll(prof, t), total)[0, 1]), t, mode)
               for prof, mode in ((K_MAJ, "major"), (K_MIN, "minor")) for t in range(12))


def bar_sim(A: np.ndarray, B: np.ndarray) -> float:
    best = 0.0
    for t in range(12):
        S = A @ np.roll(B, t, axis=1).T
        best = max(best, 0.5 * (S.max(1).mean() + S.max(0).mean()))
    return best


def renders(music: dict, d: str, md: bool) -> None:
    bars, rows = {}, []
    for name in [f"{s}-day" for s in SEASONS] + [f"{s}-night" for s in SEASONS] + ["title", "festival"]:
        path = os.path.join(d, f"long-{name}.wav")
        if not os.path.exists(path):
            continue
        p = music["pieces"][name.split("-")[0]]
        x, sr = load_wav(path)
        bar = 60 * p["meter"] / p["bpm"]
        nb = int((len(x) / sr - 0.2) // bar)
        B = np.array([chroma(x[int((0.12 + i * bar) * sr):int((0.12 + (i + 1) * bar) * sr)], sr) for i in range(nb)])
        bars[name] = B
        r, t, mode = estimate_key(B.sum(0))
        dk, dm = declared_key(p)
        prof = K_MAJ if dm == "major" else K_MIN
        r_decl = float(np.corrcoef(np.roll(prof, dk), B.sum(0))[0, 1])
        allr = sorted((float(np.corrcoef(np.roll(pr, k), B.sum(0))[0, 1]) for pr in (K_MAJ, K_MIN) for k in range(12)),
                      reverse=True)
        rank = allr.index(r_decl) + 1
        X = np.abs(np.fft.rfft(x))
        fq = np.fft.rfftfreq(len(x), 1 / sr)
        rows.append((name, p.get("key", "?"), f"{NAMES[t]} {mode}", r, (t == dk and mode == dm), r_decl, rank,
                     (X * fq).sum() / X.sum()))
    print("\n## Renders: key and brightness\n")
    print("Krumhansl-Schmuckler has only major and minor profiles, so a modal piece reads as its parent scale;"
          " the declared key's own r and rank (of 24) are listed too.\n")
    print("| render | declared key | estimated key | r | match | declared-key r (rank) | centroid Hz |")
    print("|---|---|---|---|---|---|---|")
    for n, k, e, r, ok, rd, rk, c in rows:
        print(f"| {n} | {k} | {e} | {r:.2f} | {'yes' if ok else 'NO'} | {rd:.2f} ({rk}) | {c:.0f} |")
    print("\n## Renders: transposition-invariant bar-chroma similarity (1 = same harmony up to key)\n")
    keys = [k for k in bars if k.endswith("-day") or "-" not in k]
    print("| pair | similarity |")
    print("|---|---|")
    for a, b in itertools.combinations(keys, 2):
        print(f"| {a} - {b} | {bar_sim(bars[a], bars[b]):.3f} |")
    nk = [k for k in bars if k.endswith("-night")]
    for a, b in itertools.combinations(nk, 2):
        print(f"| {a} - {b} | {bar_sim(bars[a], bars[b]):.3f} |")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    path = args[0] if args and args[0].endswith(".json") else os.path.join(GAME, "src", "audio", "music.json")
    with open(path, encoding="utf8") as f:
        music = json.load(f)
    for k, p in music["pieces"].items():
        p["_name"] = k
    P = {k: music["pieces"][k] for k in PIECES}
    print("## Pieces\n")
    print("| piece | key | bpm | meter | A section (Roman numerals) | cadence |")
    print("|---|---|---|---|---|---|")
    for k, p in P.items():
        tonic = declared_key(p)[0]
        prog = " ".join(roman(c, tonic) for c in parse_chords(p["sections"]["A"]["chords"], p["meter"]))
        print(f"| {k} | {p.get('key', '?')} | {p['bpm']} | {p['meter']}/4 | {prog} | {cadence(p)} |")
    progs = {k: tuple(roman(c, declared_key(p)[0]) for c in parse_chords(p["sections"]["A"]["chords"], p["meter"]))
             for k, p in P.items()}
    print(f"\nDistinct A progressions: {len(set(progs.values()))} / {len(P)}; "
          f"distinct cadences: {len({cadence(p) for p in P.values()})} / {len(P)}")
    print("\n## Pairs (data)\n")
    print("| pair | chord-bigram Jaccard (max over keys) | melody 3-gram overlap | features that differ |")
    print("|---|---|---|---|")
    feats = {k: features(p) for k, p in P.items()}
    tri = {k: trigram_set(p) for k, p in P.items()}
    lim = {"npb": None, "median": 3, "leap": 0.10, "range": 4, "sync": 0.10}
    for a, b in itertools.combinations(PIECES, 2):
        jac = max(jaccard(bigram_set(P[a]), bigram_set(P[b], s)) for s in range(12))
        ov = len(tri[a] & tri[b]) / max(1, min(len(tri[a]), len(tri[b])))
        fa, fb = feats[a], feats[b]
        diff = [n for n in lim if (abs(fa[n] - fb[n]) > 0.2 * max(fa[n], fb[n]) if n == "npb" else abs(fa[n] - fb[n]) > lim[n])]
        print(f"| {a} - {b} | {jac:.2f} | {ov * 100:.0f}% | {len(diff)}: {', '.join(diff)} |")
    print("\n## Melody features (day tune)\n")
    print("| piece | notes/beat | median pitch | leap share | range st | syncopation | off-chord beats |")
    print("|---|---|---|---|---|---|---|")
    for k, p in P.items():
        f = feats[k]
        nb, tot, _ = consonance(p)
        print(f"| {k} | {f['npb']:.2f} | {f['median']:.0f} ({NAMES[int(f['median']) % 12]}{int(f['median']) // 12 - 1}) |"
              f" {f['leap'] * 100:.0f}% | {f['range']} | {f['sync'] * 100:.0f}% | {nb}/{tot} |")
    for k, p in P.items():
        for line in consonance(p)[2]:
            print(f"  unresolved: {k} {line}")
    if "--renders" in sys.argv:
        renders(music, sys.argv[sys.argv.index("--renders") + 1], "--md" in sys.argv)


if __name__ == "__main__":
    main()
