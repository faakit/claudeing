"""The composed music, written as Python data for readability; `python -I music_src.py` writes
src/audio/music.json (the file the game reads). Melodies are note:beats tokens, '|' between bars.
Every phrase was written against its section's chords (chord tones on strong beats, passing and
neighbour tones between), and unit tests check bar lengths, ranges and sample coverage.
"""
import json
import os

INSTRUMENTS = {
    "piano": {"gain": 0.9, "pan": 0.0, "reverb": 0.3, "release": 0.35},
    "harp": {"gain": 0.8, "pan": -0.25, "reverb": 0.35, "release": 0.6},
    "marimba": {"gain": 0.8, "pan": 0.2, "reverb": 0.2, "release": 0.25},
    "glock": {"gain": 0.45, "pan": 0.3, "reverb": 0.4, "release": 0.7},
    "vibes": {"gain": 0.75, "pan": -0.15, "reverb": 0.45, "release": 0.9},
    "pizz": {"gain": 0.9, "pan": 0.1, "reverb": 0.15, "release": 0.15},
    "recorder": {"gain": 0.75, "pan": 0.12, "reverb": 0.3, "release": 0.12, "attack": 0.03},
    "ocarina": {"gain": 0.75, "pan": 0.12, "reverb": 0.3, "release": 0.15, "attack": 0.03},
    "viola": {"gain": 0.45, "pan": -0.1, "reverb": 0.45, "release": 0.9, "attack": 0.35},
    "cello": {"gain": 0.55, "pan": 0.05, "reverb": 0.35, "release": 0.8, "attack": 0.25},
    "shaker": {"gain": 0.35, "pan": 0.35, "reverb": 0.1, "release": 0.05},
    "tamb": {"gain": 0.35, "pan": -0.3, "reverb": 0.15, "release": 0.1},
    "sleigh": {"gain": 0.3, "pan": 0.3, "reverb": 0.3, "release": 0.3},
    "triangle": {"gain": 0.3, "pan": 0.4, "reverb": 0.4, "release": 0.5},
}

PATTERNS = {
    # 4/4
    "arp8": [[0, 0, 1.5, 0.8], [0.5, 1, 1.5, 0.5], [1, 2, 1.5, 0.6], [1.5, 3, 1.5, 0.5],
             [2, 4, 1.5, 0.7], [2.5, 3, 1.5, 0.5], [3, 2, 1.5, 0.6], [3.5, 1, 1.5, 0.5]],
    "arpUp": [[0, 0, 3, 0.6], [1, 1, 3, 0.45], [2, 2, 3, 0.5], [3, 3, 2, 0.45]],
    "pad": [[0, [0, 1, 2], 4, 0.6]],
    "bass1": [[0, 0, 1.8, 0.85], [2, 1, 1.8, 0.7]],
    "bassWalk": [[0, 0, 0.9, 0.85], [1, 1, 0.9, 0.6], [2, 2, 0.9, 0.7], [3, 1, 0.9, 0.6]],
    "bassLong": [[0, 0, 4, 0.7]],
    "shaker8": [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.8], [1, 0, 0.5, 0.45], [1.5, 0, 0.5, 0.75],
                [2, 0, 0.5, 0.5], [2.5, 0, 0.5, 0.8], [3, 0, 0.5, 0.45], [3.5, 0, 0.5, 0.75]],
    "tamb24": [[1, 0, 1, 0.6], [3, 0, 1, 0.65]],
    "marimbaComp": [[0, [0, 2], 0.5, 0.7], [0.75, 1, 0.5, 0.45], [1.5, [1, 3], 0.5, 0.6],
                    [2.5, [0, 2], 0.5, 0.6], [3, 1, 0.5, 0.45], [3.5, 2, 0.5, 0.5]],
    "mineOst": [[0, 0, 0.5, 0.6], [0.75, 2, 0.5, 0.4], [1.5, 1, 0.5, 0.5], [2.5, 4, 0.5, 0.45], [3, 2, 0.5, 0.4]],
    "triangle2bar": [[0, 0, 4, 0.4], [4, 0, 0, 0]],
    # 3/4
    "waltzChords": [[1, [0, 1, 2], 1, 0.4], [2, [0, 1, 2], 1, 0.36]],
    "pad3": [[0, [0, 1, 2], 3, 0.55]],
    "bass3": [[0, 0, 3, 0.6]],
    "arp3": [[0, 0, 1.5, 0.55], [1, 1, 1.5, 0.45], [2, 2, 1.5, 0.45]],
    "sleigh2bar3": [[0, 0, 3, 0.35], [3, 0, 0, 0]],
}

# Short in-key fanfares for game events, written in C and transposed to the playing piece's key.
JINGLES = {
    "level": {"bpm": 132, "parts": [
        {"inst": "harp", "notes": "C4:.5 E4:.5 G4:.5 C5:.5 E5:2"},
        {"inst": "glock", "notes": "r:2 C6:2", "gain": 0.8}]},
    "goal": {"bpm": 120, "parts": [
        {"inst": "vibes", "notes": "G5:.5 C6:.5 E6:2"},
        {"inst": "harp", "notes": "C4:.5 G4:.5 C5:2", "gain": 0.7}]},
    "sleep": {"bpm": 84, "parts": [
        {"inst": "vibes", "notes": "E6:.5 C6:.5 G5:.5 E5:.5 D5:.5 G5:.5 C6:3"},
        {"inst": "harp", "notes": "C4:2 G4:1 C5:3", "gain": 0.6}]},
    "heart": {"bpm": 140, "parts": [
        {"inst": "glock", "notes": "G5:.5 D6:2", "gain": 1.4},
        {"inst": "vibes", "notes": "G5:.5 B5:2", "gain": 0.9},
        {"inst": "harp", "notes": "G4:.5 B4:2", "gain": 0.8}]},
    "order": {"bpm": 150, "parts": [
        {"inst": "vibes", "notes": "C5:.5 E5:.5 G5:2"},
        {"inst": "harp", "notes": "C4:.5 E4:.5 G4:2", "gain": 0.7},
        {"inst": "glock", "notes": "r:1 C6:2", "gain": 0.8}]},
}

PIECES = {}

# ---------------------------------------------------------------- spring: C major, 74 bpm
PIECES["spring"] = {
    "level": 0, "nightLevel": 2.5, "jingleKey": 0, "bpm": 74, "meter": 4,
    "sections": {
        "A": {"chords": "C | Am | F | G | C | Am | Dm7 G7 | C"},
        "B": {"chords": "F | G | Em | Am | F | G | Dm7 | Gsus4 G"},
        "R": {"chords": "F | C | F | G"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "harp", "time": "day", "pattern": "arp8", "anchor": 55, "gain": 0.8},
        {"id": "bass", "inst": "pizz", "time": "day", "pattern": "bass1", "anchor": 40, "bass": True, "tacet": ["R"]},
        {"id": "tune", "inst": "recorder", "time": "day", "rest": 0.15,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "shaker", "inst": "shaker", "time": "day", "pattern": "shaker8", "outdoorOnly": True, "tacet": ["R"],
         "gain": 0.7},
        {"id": "pad", "inst": "viola", "time": "night", "pattern": "pad", "anchor": 55, "gain": 0.75},
        {"id": "ncomp", "inst": "harp", "time": "night", "pattern": "arpUp", "anchor": 60, "gain": 0.55},
        {"id": "ntune", "inst": "vibes", "time": "night", "rest": 0.3,
         "phrases": {"A": [["na1", "na1b"], ["na2", "na2b"]], "B": [["nb1"], ["nb2"]]}},
    ],
    "phrases": {
        "a1": "E5:1 G5:1 C6:1.5 B5:.5 | A5:2 E5:2 | F5:1 A5:1 C6:1 A5:1 | G5:3 r:1",
        "a1b": "G5:1.5 E5:.5 D5:1 C5:1 | C5:1 E5:1 A5:2 | A5:1.5 G5:.5 F5:1 E5:1 | D5:2 r:2",
        "a2": "E5:1 G5:1 C6:1 E6:1 | D6:2 C6:1 A5:1 | F5:1 A5:1 G5:1 F5:1 | E5:3 r:1",
        "a2b": "C5:1 E5:1 G5:2 | A5:1 G5:1 E5:1 C5:1 | D5:1 F5:1 B4:1 D5:1 | C5:3 r:1",
        "b1": "A5:1.5 G5:.5 F5:1 A5:1 | B5:1 D6:1 G5:2 | G5:1 E5:1 B4:1 E5:1 | C5:1 E5:1 A5:2",
        "b1b": "C6:2 A5:1 F5:1 | D5:1 G5:1 B5:2 | B5:1.5 A5:.5 G5:1 E5:1 | E5:4",
        "b2": "F5:1 A5:1 C6:1 A5:1 | B5:1 G5:1 D5:2 | F5:1 E5:1 D5:1 C5:1 | D5:2 B4:2",
        "b2b": "A5:2 C6:2 | D6:1.5 B5:.5 G5:2 | A5:1 F5:1 D5:1 F5:1 | G5:4",
        "na1": "r:2 G5:2 | E5:4 | r:2 A5:1 C6:1 | B5:4",
        "na1b": "E5:4 | r:1 C5:1 E5:2 | F5:2 C5:2 | D5:4",
        "na2": "G5:4 | E5:2 C5:2 | D5:2 F5:2 | E5:4",
        "na2b": "r:2 C6:2 | A5:4 | F5:2 B5:2 | C6:4",
        "nb1": "C6:4 | B5:2 G5:2 | E5:4 | r:2 C5:2",
        "nb2": "A5:4 | G5:2 D5:2 | F5:2 C5:2 | D5:2 B4:2",
    },
}

# ---------------------------------------------------------------- summer: D major, 84 bpm, brighter
PIECES["summer"] = {
    "level": 0, "nightLevel": 1.3, "jingleKey": 2, "bpm": 84, "meter": 4,
    "sections": {
        "A": {"chords": "D | Bm | G | A | D | Bm | Em7 A7 | D"},
        "B": {"chords": "G | A | F#m | Bm | G | A | Em7 | Asus4 A"},
        "R": {"chords": "G | D | G | A"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "marimba", "time": "day", "pattern": "marimbaComp", "anchor": 62, "gain": 0.8},
        {"id": "bass", "inst": "pizz", "time": "day", "pattern": "bassWalk", "anchor": 38, "bass": True, "tacet": ["R"]},
        {"id": "tune", "inst": "ocarina", "time": "day", "rest": 0.15,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "shaker", "inst": "shaker", "time": "day", "pattern": "shaker8", "outdoorOnly": True, "tacet": ["R"],
         "gain": 0.8},
        {"id": "tamb", "inst": "tamb", "time": "day", "pattern": "tamb24", "outdoorOnly": True, "tacet": ["R"],
         "gain": 0.7},
        {"id": "pad", "inst": "viola", "time": "night", "pattern": "pad", "anchor": 57, "gain": 0.7},
        {"id": "ncomp", "inst": "harp", "time": "night", "pattern": "arpUp", "anchor": 62, "gain": 0.5},
        {"id": "ntune", "inst": "vibes", "time": "night", "rest": 0.3,
         "phrases": {"A": [["na1", "na1b"], ["na2", "na2b"]], "B": [["nb1"], ["nb2"]]}},
    ],
    "phrases": {
        "a1": "F#5:1 A5:1 D6:1.5 C#6:.5 | B5:2 F#5:2 | G5:1 B5:1 D6:1 B5:1 | A5:3 r:1",
        "a1b": "A5:.5 F#5:.5 A5:1 B5:.5 A5:.5 F#5:1 | D5:1 F#5:1 B5:2 | B5:1 A5:.5 G5:.5 E5:1 D5:1 | E5:2 r:2",
        "a2": "F#5:1 A5:1 D6:2 | E6:1 D6:1 B5:1 F#5:1 | G5:1 B5:1 A5:1 G5:1 | F#5:3 r:1",
        "a2b": "D5:1 F#5:1 A5:2 | B5:1 A5:1 F#5:1 D5:1 | E5:1 G5:1 C#5:1 E5:1 | D5:3 r:1",
        "b1": "B5:1.5 A5:.5 G5:1 B5:1 | C#6:1 E6:1 A5:2 | A5:1 F#5:1 C#5:1 F#5:1 | D5:1 F#5:1 B5:2",
        "b1b": "D6:2 B5:1 G5:1 | E5:1 A5:1 C#6:2 | C#6:1.5 B5:.5 A5:1 F#5:1 | F#5:4",
        "b2": "G5:1 B5:1 D6:1 B5:1 | C#6:1 A5:1 E5:2 | G5:1 F#5:1 E5:1 D5:1 | E5:2 C#5:2",
        "b2b": "B5:2 D6:2 | E6:1.5 C#6:.5 A5:2 | B5:1 G5:1 E5:1 G5:1 | A5:4",
        "na1": "r:2 A5:2 | F#5:4 | r:2 B5:1 D6:1 | C#6:4",
        "na1b": "F#5:4 | r:1 D5:1 F#5:2 | G5:2 D5:2 | E5:4",
        "na2": "A5:4 | F#5:2 D5:2 | E5:2 G5:2 | F#5:4",
        "na2b": "r:2 D6:2 | B5:4 | G5:2 C#6:2 | D6:4",
        "nb1": "D6:4 | C#6:2 A5:2 | F#5:4 | r:2 D5:2",
        "nb2": "B5:4 | A5:2 E5:2 | G5:2 D5:2 | E5:2 C#5:2",
    },
}

# ---------------------------------------------------------------- fall: G minor, 66 bpm
PIECES["fall"] = {
    "level": 0.3, "nightLevel": 1.8, "jingleKey": -2, "bpm": 66, "meter": 4,
    "sections": {
        "A": {"chords": "Gm | Eb | Cm | D7 | Gm | Eb | Cm7 D7 | Gm"},
        "B": {"chords": "Bb | F | Gm | Eb | Bb | F | Cm7 | Dsus4 D"},
        "R": {"chords": "Eb | Bb | Cm | D"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "harp", "time": "day", "pattern": "arp8", "anchor": 55, "gain": 0.75},
        {"id": "bass", "inst": "pizz", "time": "day", "pattern": "bass1", "anchor": 38, "bass": True, "tacet": ["R"]},
        {"id": "tune", "inst": "piano", "time": "day", "rest": 0.15,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "pad", "inst": "viola", "time": "night", "pattern": "pad", "anchor": 55, "gain": 0.7},
        {"id": "nbass", "inst": "cello", "time": "night", "pattern": "bassLong", "anchor": 36, "bass": True,
         "gain": 0.7},
        {"id": "ntune", "inst": "piano", "time": "night", "rest": 0.25,
         "phrases": {"A": [["na1", "na1b"], ["na2", "na2b"]], "B": [["nb1"], ["nb2"]]}},
    ],
    "phrases": {
        "a1": "Bb4:1 D5:1 G5:1.5 F#5:.5 | G5:2 Eb5:2 | Eb5:1 G5:1 C5:1 Eb5:1 | D5:3 r:1",
        "a1b": "D5:1.5 C5:.5 Bb4:1 A4:1 | G4:1 Bb4:1 Eb5:2 | C5:1 Eb5:1 G5:1 Eb5:1 | F#5:2 r:2",
        "a2": "G5:1 Bb5:1 D6:2 | C6:1 Bb5:1 G5:1 Eb5:1 | Eb5:1 G5:1 F#5:1 A5:1 | G5:3 r:1",
        "a2b": "D5:1 G5:1 Bb5:2 | Bb5:1 G5:1 Eb5:1 Bb4:1 | C5:1 Eb5:1 D5:1 C5:1 | Bb4:1 A4:1 G4:2",
        "b1": "D5:1.5 C5:.5 Bb4:1 D5:1 | F5:1 A5:1 C6:2 | Bb5:1 G5:1 D5:1 G5:1 | Eb5:1 G5:1 Bb5:2",
        "b1b": "F5:2 D5:1 Bb4:1 | A4:1 C5:1 F5:2 | G5:1.5 F5:.5 D5:1 Bb4:1 | Bb4:4",
        "b2": "Bb5:1 F5:1 D5:1 F5:1 | A5:1 F5:1 C5:2 | Eb5:1 D5:1 C5:1 Bb4:1 | G4:2 F#4:2",
        "b2b": "D6:2 Bb5:2 | C6:1.5 A5:.5 F5:2 | G5:1 Eb5:1 C5:1 Eb5:1 | D5:4",
        "na1": "r:2 D5:2 | Eb5:4 | r:2 C5:1 Eb5:1 | D5:4",
        "na1b": "Bb4:4 | r:1 G4:1 Bb4:2 | C5:2 G4:2 | A4:4",
        "na2": "D5:4 | Bb4:2 G4:2 | Eb5:2 F#5:2 | G5:4",
        "na2b": "r:2 G5:2 | G5:2 Eb5:2 | C5:2 A4:2 | Bb4:4",
        "nb1": "F5:4 | F5:2 C5:2 | D5:4 | r:2 Eb5:2",
        "nb2": "D5:4 | C5:2 A4:2 | Bb4:2 G4:2 | A4:2 F#4:2",
    },
}

# ---------------------------------------------------------------- winter: D minor, 56 bpm, a 3/4 lullaby
PIECES["winter"] = {
    "level": 5.5, "nightLevel": -3.8, "jingleKey": 5, "bpm": 56, "meter": 3,
    "sections": {
        "A": {"chords": "Dm | Bb | Gm | A7 | Dm | Bb | Gm6 A7 | Dm"},
        "B": {"chords": "F | C | Dm | Bb | F | C | Gm | Asus4 A"},
        "R": {"chords": "Bb | F | Gm | A"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "bass", "inst": "piano", "time": "day", "pattern": "bass3", "anchor": 38, "bass": True, "gain": 0.75},
        {"id": "comp", "inst": "piano", "time": "day", "pattern": "waltzChords", "anchor": 57, "gain": 0.75},
        {"id": "tune", "inst": "glock", "time": "day", "rest": 0.2,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "dpad", "inst": "viola", "time": "day", "pattern": "pad3", "anchor": 57, "gain": 0.45},
        {"id": "sleigh", "inst": "sleigh", "time": "day", "pattern": "sleigh2bar3", "outdoorOnly": True,
         "tacet": ["R"], "gain": 0.8},
        {"id": "pad", "inst": "viola", "time": "night", "pattern": "pad3", "anchor": 55, "gain": 0.7},
        {"id": "nbass", "inst": "cello", "time": "night", "pattern": "bass3", "anchor": 36, "bass": True, "gain": 0.65},
        {"id": "ntune", "inst": "vibes", "time": "night", "rest": 0.3,
         "phrases": {"A": [["na1", "na1b"], ["na2", "na2b"]], "B": [["nb1"], ["nb2"]]}},
    ],
    "phrases": {
        "a1": "A5:1 D6:1 F6:1 | F6:2 D6:1 | D6:1 Bb5:1 G5:1 | A5:3",
        "a1b": "F6:2 E6:1 | D6:2 Bb5:1 | G6:1 F6:1 D6:1 | C#6:3",
        "a2": "D6:1 F6:1 A6:1 | Bb6:2 F6:1 | E6:1.5 C#6:1.5 | D6:3",
        "a2b": "A5:1 D6:1 F6:1 | D6:2 Bb5:1 | Bb5:1.5 A5:1.5 | D6:3",
        "b1": "C6:1 F6:1 A6:1 | G6:2 E6:1 | F6:1 D6:1 A5:1 | Bb5:3",
        "b1b": "A6:2 F6:1 | E6:1 G6:1 C6:1 | D6:2 F6:1 | D6:3",
        "b2": "F6:1 C6:1 A5:1 | G5:1 C6:1 E6:1 | D6:1 Bb5:1 G5:1 | A5:1.5 C#6:1.5",
        "b2b": "A6:2 C7:1 | G6:3 | Bb6:1 G6:1 D6:1 | E6:1.5 C#6:1.5",
        "na1": "r:1 A5:2 | F5:3 | r:1 D5:1 G5:1 | E5:3",
        "na1b": "D5:3 | r:1 F5:2 | Bb5:2 G5:1 | A5:3",
        "na2": "F5:3 | D5:3 | E5:1.5 C#5:1.5 | D5:3",
        "na2b": "A5:3 | Bb5:2 F5:1 | G5:1.5 E5:1.5 | F5:3",
        "nb1": "C6:3 | G5:2 E5:1 | F5:3 | r:1 D5:2",
        "nb2": "A5:3 | G5:2 C5:1 | Bb5:2 G5:1 | A5:1.5 C#6:1.5",
    },
}

# ---------------------------------------------------------------- title: F major, 70 bpm
PIECES["title"] = {
    "level": 0.5, "jingleKey": 5, "bpm": 70, "meter": 4,
    "sections": {
        "A": {"chords": "F | Dm | Bb | C | F | Dm | Gm7 C7 | F"},
        "B": {"chords": "Bb | C | Am | Dm | Bb | C | Gm7 | Csus4 C"},
        "R": {"chords": "Bb | F | Bb | C"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "harp", "time": "both", "pattern": "arpUp", "anchor": 53, "gain": 0.65},
        {"id": "pad", "inst": "viola", "time": "both", "pattern": "pad", "anchor": 53, "gain": 0.5},
        {"id": "tune", "inst": "piano", "time": "both", "rest": 0.1,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
    ],
    "phrases": {
        "a1": "A4:1 C5:1 F5:1.5 E5:.5 | D5:2 A4:2 | Bb4:1 D5:1 F5:1 D5:1 | C5:3 r:1",
        "a1b": "C5:1.5 A4:.5 G4:1 F4:1 | F4:1 A4:1 D5:2 | D5:1.5 C5:.5 Bb4:1 A4:1 | G4:2 r:2",
        "a2": "A4:1 C5:1 F5:1 A5:1 | G5:2 F5:1 D5:1 | Bb4:1 D5:1 C5:1 Bb4:1 | A4:3 r:1",
        "a2b": "F4:1 A4:1 C5:2 | D5:1 C5:1 A4:1 F4:1 | G4:1 Bb4:1 E4:1 G4:1 | F4:3 r:1",
        "b1": "D5:1.5 C5:.5 Bb4:1 D5:1 | E5:1 G5:1 C5:2 | C5:1 A4:1 E4:1 A4:1 | F4:1 A4:1 D5:2",
        "b1b": "F5:2 D5:1 Bb4:1 | G4:1 C5:1 E5:2 | E5:1.5 D5:.5 C5:1 A4:1 | A4:4",
        "b2": "Bb4:1 D5:1 F5:1 D5:1 | E5:1 C5:1 G4:2 | Bb4:1 A4:1 G4:1 F4:1 | G4:2 E4:2",
        "b2b": "D5:2 F5:2 | G5:1.5 E5:.5 C5:2 | D5:1 Bb4:1 G4:1 Bb4:1 | C5:4",
    },
}

# ---------------------------------------------------------------- mine: A minor drone, 60 bpm
PIECES["mine"] = {
    "level": 2.5, "jingleKey": 0, "bpm": 60, "meter": 4,
    "sections": {
        "A": {"chords": "Am | Am | Fmaj7 | G | Am | Am | Dm7 | Esus4 E"},
        "B": {"chords": "Dm7 | Am | Dm7 | Em | Fmaj7 | G | Am | Am"},
        "R": {"chords": "Am | Am | Am | Am"},
    },
    "form": ["A", "B", "A", "R"],
    "layers": [
        {"id": "drone", "inst": "cello", "time": "both", "pattern": "bassLong", "anchor": 33, "bass": True, "gain": 0.7},
        {"id": "pad", "inst": "viola", "time": "both", "pattern": "pad", "anchor": 57, "gain": 0.4},
        {"id": "ost", "inst": "marimba", "time": "both", "pattern": "mineOst", "anchor": 57, "gain": 0.55,
         "tacet": ["R"]},
        {"id": "tune", "inst": "vibes", "time": "both", "rest": 0.35,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1"], ["b2"]]}},
    ],
    "phrases": {
        "a1": "r:2 E5:2 | C5:4 | r:2 A4:1 C5:1 | B4:4",
        "a1b": "A4:4 | r:1 E5:1 A5:2 | E5:2 C5:2 | D5:4",
        "a2": "C5:4 | E5:2 A4:2 | F5:2 C5:2 | B4:2 G#4:2",
        "a2b": "r:2 A5:2 | G5:2 E5:2 | D5:2 A4:2 | E5:4",
        "b1": "F5:4 | E5:2 C5:2 | A4:2 C5:2 | B4:4",
        "b2": "E5:4 | D5:2 B4:2 | C5:4 | r:4",
    },
}

# ---------------------------------------------------------------- festival: G major, 100 bpm, light swing
PIECES["festival"] = {
    "level": 0, "jingleKey": -5, "bpm": 100, "meter": 4, "swing": 0.15,
    "sections": {
        "A": {"chords": "G | C | D | G | G | C | Am7 D7 | G"},
        "B": {"chords": "C | D | Bm | Em | C | D | Am7 | Dsus4 D"},
    },
    "form": ["A", "A", "B", "A"],
    "layers": [
        {"id": "comp", "inst": "marimba", "time": "both", "pattern": "marimbaComp", "anchor": 62, "gain": 0.75},
        {"id": "bass", "inst": "pizz", "time": "both", "pattern": "bassWalk", "anchor": 43, "bass": True},
        {"id": "tune", "inst": "recorder", "time": "both", "rest": 0.05,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "tamb", "inst": "tamb", "time": "both", "pattern": "tamb24", "gain": 0.8},
        {"id": "shaker", "inst": "shaker", "time": "both", "pattern": "shaker8", "gain": 0.7},
        {"id": "tri", "inst": "triangle", "time": "both", "pattern": "triangle2bar", "gain": 0.7},
    ],
    "phrases": {
        "a1": "D5:.5 G5:.5 B5:.5 G5:.5 D6:1 B5:1 | C6:1 E6:1 C6:1 G5:1 | F#5:.5 A5:.5 D6:1 C6:1 A5:1 | B5:2 G5:2",
        "a1b": "B5:1 A5:.5 G5:.5 D5:1 G5:1 | E5:1 G5:1 C6:2 | A5:1 F#5:.5 E5:.5 D5:1 F#5:1 | G5:3 r:1",
        "a2": "G5:.5 B5:.5 D6:.5 B5:.5 G5:1 D5:1 | E5:1 G5:1 C6:2 | C6:1 A5:1 A5:1 F#5:1 | G5:3 r:1",
        "a2b": "D6:1 B5:1 G5:1 B5:1 | C6:1.5 B5:.5 A5:1 G5:1 | E5:1 C5:1 D5:1 F#5:1 | G5:4",
        "b1": "E5:.5 G5:.5 C6:1 G5:1 E5:1 | F#5:.5 A5:.5 D6:1 A5:1 F#5:1 | B5:1 F#5:1 D5:1 F#5:1 | E5:2 G5:2",
        "b1b": "G5:1.5 E5:.5 C5:1 E5:1 | D5:1 F#5:1 A5:2 | B5:1 A5:.5 F#5:.5 D5:1 B4:1 | E5:4",
        "b2": "C6:1 B5:1 G5:1 E5:1 | D5:1 F#5:1 A5:2 | C6:1 A5:1 G5:1 E5:1 | G5:2 F#5:2",
        "b2b": "E6:1 C6:1 G5:2 | F#5:1 A5:1 D6:2 | E6:1 C6:1 A5:1 E5:1 | D5:2 A5:2",
    },
}

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "..", "src", "audio", "music.json")
    with open(out, "w", encoding="utf8", newline="\n") as f:
        json.dump({"instruments": INSTRUMENTS, "patterns": PATTERNS, "jingles": JINGLES, "pieces": PIECES}, f, indent=1)
        f.write("\n")
    print("wrote", os.path.normpath(out))
