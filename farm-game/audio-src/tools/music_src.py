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
    "glock": {"gain": 0.38, "pan": 0.3, "reverb": 0.4, "release": 0.7},
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
    # summer: marimba stabs and bass in a 3+3+2 tresillo
    "summerComp": [[0, [0, 1, 2], 0.5, 0.7], [1.5, [0, 1, 2], 0.5, 0.6], [3, [0, 1, 2], 0.5, 0.55],
                   [3.5, [1, 2], 0.5, 0.4]],
    "bassTresillo": [[0, 0, 1.4, 0.85], [1.5, 2, 1.4, 0.6], [3, 0, 0.9, 0.7]],
    # fall: harp in triplet eighths (up and down), half of that at night, bowed half-note bass
    "arpTrip": [[0, 0, 1, 0.65], [0.333, 1, 1, 0.45], [0.667, 2, 1, 0.5], [1, 3, 1, 0.55], [1.333, 2, 1, 0.45],
                [1.667, 1, 1, 0.45], [2, 0, 1, 0.6], [2.333, 1, 1, 0.45], [2.667, 2, 1, 0.5], [3, 3, 1, 0.55],
                [3.333, 2, 1, 0.45], [3.667, 1, 1, 0.45]],
    "arpTripHalf": [[0, 0, 2, 0.55], [0.333, 1, 2, 0.4], [0.667, 2, 2, 0.45], [2, 1, 2, 0.45], [2.333, 2, 2, 0.4],
                    [2.667, 3, 2, 0.45]],
    "bass2": [[0, 0, 2, 0.75], [2, 1, 2, 0.6]],
    # festival: stride piano chords on 2 and 4 over an oom-pah bass on 1 and 3
    "stride": [[1, [0, 1, 2], 0.5, 0.55], [3, [0, 1, 2], 0.5, 0.5]],
    "bassOomPah": [[0, 0, 0.9, 0.85], [2, 1, 0.9, 0.7]],
    # 3/4
    "waltzChords": [[1, [0, 1, 2], 1, 0.4], [2, [0, 1, 2], 1, 0.36]],
    "pad3": [[0, [0, 1, 2], 3, 0.55]],
    "pad3wide": [[0, [0, 1, 2, 3], 3, 0.5]],
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
        {"inst": "glock", "notes": "G5:.5 D6:2", "gain": 1.1},
        {"inst": "vibes", "notes": "G5:.5 B5:2", "gain": 0.7},
        {"inst": "harp", "notes": "G4:.5 B4:2", "gain": 0.62}]},
    "order": {"bpm": 150, "parts": [
        {"inst": "vibes", "notes": "C5:.5 E5:.5 G5:2"},
        {"inst": "harp", "notes": "C4:.5 E4:.5 G4:2", "gain": 0.7},
        {"inst": "glock", "notes": "r:1 C6:2", "gain": 0.8}]},
    "special": {"bpm": 140, "volume": 0.85, "parts": [
        {"inst": "vibes", "notes": "C5:.25 E5:.25 G5:.25 C6:.5 G5:.25 C6:.25 E6:1.5"},
        {"inst": "harp", "notes": "C4:.5 G4:.5 C5:.5 E5:1.5", "gain": 0.7},
        {"inst": "glock", "notes": "r:1.5 C6:.5 G6:1.5", "gain": 0.7}]},
}

# Musical moments the engine plays itself (audio.sting / audio.motif), also written in C. Instruments
# are limited to the light ones the jingles already keep decoded (harp, vibes, glock, marimba, pizz).
STINGS = {
    # Villager motifs, soft, when their sheet opens; "-heart" is the warmer one at a new heart.
    # Mara (General Store): a welcoming sixth up and a turn home.
    "motif-mara": {"bpm": 112, "volume": 0.5, "parts": [
        {"inst": "vibes", "notes": "G5:.5 C6:.5 E6:.5 D6:.5 C6:1.5"},
        {"inst": "marimba", "notes": "C5:.5 r:.5 G4:.5 r:.5 C5:1", "gain": 0.6}]},
    "motif-mara-heart": {"bpm": 90, "volume": 0.6, "parts": [
        {"inst": "vibes", "notes": "G5:.5 C6:.5 E6:.5 D6:.5 C6:2"},
        {"inst": "harp", "notes": "C4:.25 E4:.25 G4:.25 C5:2.75", "gain": 0.6},
        {"inst": "glock", "notes": "r:2.5 G6:1.5", "gain": 0.5}]},
    # Finn (fisherman): a lazy swaying pentatonic line.
    "motif-finn": {"bpm": 84, "volume": 0.5, "parts": [
        {"inst": "vibes", "notes": "E5:1 G5:.5 A5:1.5 G5:.5 E5:1.5"},
        {"inst": "harp", "notes": "C4:1.5 G4:1.5 C5:2", "gain": 0.6}]},
    "motif-finn-heart": {"bpm": 72, "volume": 0.6, "parts": [
        {"inst": "vibes", "notes": "E5:1 G5:.5 A5:1.5 C6:2"},
        {"inst": "harp", "notes": "C4:.25 G4:.25 C5:.25 E5:3.25", "gain": 0.6},
        {"inst": "glock", "notes": "r:3 E6:2", "gain": 0.5}]},
    # Rosa (neighbour, knows soil): a plain stepwise rise that settles.
    "motif-rosa": {"bpm": 96, "volume": 0.5, "parts": [
        {"inst": "harp", "notes": "C5:.5 D5:.5 E5:.5 G5:.5 A5:1 G5:1.5"},
        {"inst": "glock", "notes": "r:3 E6:1.5", "gain": 0.4}]},
    "motif-rosa-heart": {"bpm": 80, "volume": 0.6, "parts": [
        {"inst": "harp", "notes": "C5:.5 D5:.5 E5:.5 G5:.5 A5:1 G5:2"},
        {"inst": "vibes", "notes": "r:1 E5:1 G5:3", "gain": 0.6},
        {"inst": "glock", "notes": "r:3 G6:2", "gain": 0.4}]},
    # Orin (blacksmith): two hammer blows on the tonic, a fifth, an octave.
    "motif-orin": {"bpm": 100, "volume": 0.55, "parts": [
        {"inst": "marimba", "notes": "C4:.5 C4:.5 G4:.5 E4:.5 C5:2"},
        {"inst": "pizz", "notes": "C3:1 G2:1 C3:2", "gain": 0.8}]},
    "motif-orin-heart": {"bpm": 84, "volume": 0.6, "parts": [
        {"inst": "marimba", "notes": "C4:.5 C4:.5 G4:.5 E4:.5 C5:2.5"},
        {"inst": "pizz", "notes": "C3:1 G2:1 C3:2.5", "gain": 0.8},
        {"inst": "harp", "notes": "r:2 G4:.25 C5:.25 E5:2.5", "gain": 0.6}]},
    # Clay (the rival): a cheeky chromatic "nyah-nyah".
    "motif-clay": {"bpm": 150, "volume": 0.35, "parts": [
        {"inst": "marimba", "notes": "G5:.25 F#5:.25 G5:.5 E5:.5 A5:.5 G5:1"},
        {"inst": "pizz", "notes": "G3:.25 F#3:.25 G3:.5 E3:.5 A3:.5 G3:1", "gain": 0.8}]},
    "motif-clay-heart": {"bpm": 120, "volume": 0.42, "parts": [
        {"inst": "marimba", "notes": "G5:.25 F#5:.25 G5:.5 E5:.5 A5:.5 C6:1.5"},
        {"inst": "pizz", "notes": "C3:1 G3:1 C3:1.5", "gain": 0.8},
        {"inst": "glock", "notes": "r:2 E6:1.5", "gain": 0.4}]},
    # Dawn and dusk, when the day and night music trade places.
    "dawn": {"bpm": 100, "volume": 0.4, "parts": [
        {"inst": "harp", "notes": "C4:.25 E4:.25 G4:.25 C5:.25 E5:2"},
        {"inst": "vibes", "notes": "r:1 C6:2", "gain": 0.6},
        {"inst": "glock", "notes": "r:1 G6:2", "gain": 0.5}]},
    "dusk": {"bpm": 80, "volume": 0.4, "parts": [
        {"inst": "vibes", "notes": "E6:.5 C6:.5 A5:.5 G5:2"},
        {"inst": "harp", "notes": "C4:3.5", "gain": 0.6}]},
    # A new season, under the sleep screen, in the new season's key.
    "season-spring": {"bpm": 96, "volume": 0.8, "parts": [
        {"inst": "harp", "notes": "C4:.5 G4:.5 C5:.5 E5:.5 G5:2"},
        {"inst": "glock", "notes": "r:2 C6:2", "gain": 0.6}]},
    "season-summer": {"bpm": 120, "volume": 0.8, "parts": [
        {"inst": "marimba", "notes": "G4:.25 A4:.25 C5:.5 D5:.5 E5:.5 G5:1.5"},
        {"inst": "vibes", "notes": "r:2 E6:1.5", "gain": 0.7}]},
    "season-fall": {"bpm": 80, "volume": 0.8, "parts": [
        {"inst": "harp", "notes": "A3:.5 C4:.5 E4:.5 A4:.5 C5:2"},
        {"inst": "vibes", "notes": "r:1.5 E5:2.5", "gain": 0.7}]},
    "season-winter": {"bpm": 72, "volume": 1.1, "parts": [
        {"inst": "glock", "notes": "E6:.5 D6:.5 C6:.5 A5:2"},
        {"inst": "vibes", "notes": "A4:3.5", "gain": 0.7}]},
    # Festival openers (one festival per season), in the festival's key.
    "open-spring": {"bpm": 132, "volume": 0.9, "parts": [
        {"inst": "marimba", "notes": "C5:.25 E5:.25 G5:.25 C6:.25 G5:.5 C6:1.5"},
        {"inst": "glock", "notes": "r:1 E6:.5 G6:1.5", "gain": 0.6}]},
    "open-summer": {"bpm": 120, "volume": 0.9, "parts": [
        {"inst": "marimba", "notes": "E5:.5 G5:.5 A5:.5 G5:.5 C6:2"},
        {"inst": "pizz", "notes": "C3:.5 G3:.5 C3:.5 G3:.5 C3:2", "gain": 0.8}]},
    "open-fall": {"bpm": 116, "volume": 0.9, "parts": [
        {"inst": "harp", "notes": "C4:.5 E4:.5 G4:.5 C5:.5 E5:.5 G5:1.5"},
        {"inst": "pizz", "notes": "C3:1 G2:1 C3:2", "gain": 0.8}]},
    "open-winter": {"bpm": 100, "volume": 1.2, "parts": [
        {"inst": "glock", "notes": "G5:.5 E6:.5 C6:2"},
        {"inst": "vibes", "notes": "C5:1 E5:1 G5:2", "gain": 0.7},
        {"inst": "harp", "notes": "C4:4", "gain": 0.6}]},
}


PIECES = {}

# ---------------------------------------------------------------- spring: C major, 74 bpm
# The plain diatonic one: I-vi-IV-V with a ii7-V7-I cadence, harp arpeggios, a lyrical recorder tune
# moving in steps and thirds on the beat.
PIECES["spring"] = {
    "key": "C major", "level": 0, "nightLevel": 2.5, "jingleKey": 0, "bpm": 74, "meter": 4,
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
        "a2b": "C5:1 E5:1 G5:2 | A5:1 E5:1 C5:1 E5:1 | D5:1 F5:1 B4:1 D5:1 | C5:3 r:1",
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

# ---------------------------------------------------------------- summer: D mixolydian, 92 bpm
# Tonic pedal and the flat seventh: D, C/D, G/D over a D bass, no dominant chord at all, and a bVII-I
# cadence (C to D). The bridge borrows from the parallel minor (Fmaj7, C/E, Bbmaj7, C), so its return
# to D is the bright bVI-bVII-I. The tune is syncopated (off-beat starts, repeated notes)
# and sits higher than spring's; marimba stabs in a 3+3+2 tresillo over a pizzicato tresillo bass.
PIECES["summer"] = {
    "key": "D mixolydian", "level": -1.1, "nightLevel": -0.1, "jingleKey": 2, "bpm": 92, "meter": 4,
    "sections": {
        "A": {"chords": "D | C/D | G/D | D | D | C/D | Em7 G/D | C D"},
        "B": {"chords": "Fmaj7 | C/E | Bbmaj7 | C | Fmaj7 | C/E | Bbmaj7 | Cadd9"},
        "R": {"chords": "G/D | D | C/D | D"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "marimba", "time": "day", "pattern": "summerComp", "anchor": 62, "gain": 0.8},
        {"id": "bass", "inst": "pizz", "time": "day", "pattern": "bassTresillo", "anchor": 38, "bass": True,
         "tacet": ["R"]},
        {"id": "tune", "inst": "ocarina", "time": "day", "rest": 0.15,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "shaker", "inst": "shaker", "time": "day", "pattern": "shaker8", "outdoorOnly": True, "tacet": ["R"],
         "gain": 0.8},
        {"id": "tamb", "inst": "tamb", "time": "day", "pattern": "tamb24", "outdoorOnly": True, "tacet": ["R"],
         "gain": 0.7},
        {"id": "ncomp", "inst": "marimba", "time": "night", "pattern": "arpUp", "anchor": 62, "gain": 0.5},
        {"id": "nbass", "inst": "cello", "time": "night", "pattern": "bassLong", "anchor": 38, "bass": True,
         "gain": 0.55},
        {"id": "ntune", "inst": "ocarina", "time": "night", "rest": 0.3,
         "phrases": {"A": [["na1", "na1b"], ["na2", "na2b"]], "B": [["nb1"], ["nb2"]]}},
    ],
    "phrases": {
        "a1": "r:.5 F#5:.5 A5:1 A5:.5 B5:.5 A5:1 | G5:1.5 C6:.5 E6:1 C6:1 | B5:.5 A5:.5 G5:1 D6:1 G5:.5 B5:.5"
              " | A5:3 r:1",
        "a1b": "D6:1.5 C6:.5 A5:1 F#5:1 | E5:.5 G5:1 E5:.5 C6:2 | D6:.5 B5:.5 G5:1 D6:1.5 B5:.5"
               " | A5:2 F#5:.5 A5:.5 D6:1",
        "a2": "F#5:.5 A5:.5 D6:1 D6:.5 E6:.5 D6:1 | C6:1.5 G5:.5 E5:2 | E5:.5 G5:.5 B5:1 D6:1 B5:1"
              " | E6:1 C6:.5 G5:.5 F#5:1 A5:1",
        "a2b": "A5:1.5 F#5:.5 A5:.5 D6:1.5 | E6:.5 D6:.5 C6:1 G5:2 | G5:.5 B5:.5 E5:1 B5:.5 D6:1.5"
               " | C6:1.5 G5:.5 A5:.5 F#5:.5 D6:1",
        "b1": "r:.5 A5:.5 C6:1 E6:1.5 C6:.5 | G5:1 C6:1 E6:2 | D6:1.5 A5:.5 F5:1 A5:1 | G5:.5 C6:.5 E6:1 G5:2",
        "b1b": "C6:1.5 A5:.5 F5:.5 A5:.5 C6:1 | E6:1.5 C6:.5 G5:2 | F5:.5 A5:.5 D6:1 F6:1 D6:1 | E6:2 r:.5 G5:.5 C6:1",
        "b2": "F5:.5 A5:.5 C6:.5 E6:1 C6:1.5 | E6:1 D6:.5 C6:.5 G5:2 | F5:1 A5:.5 D6:1 F6:1.5 | E6:1.5 D6:.5 C6:1 D6:1",
        "b2b": "A5:2 C6:1.5 E6:.5 | E6:.5 G5:.5 C6:1 E6:2 | D6:2 r:.5 F5:.5 A5:1 | G5:1 C6:.5 E6:.5 D6:2",
        "na1": "A5:3 F#5:1 | G5:2 E5:2 | B5:2 D5:2 | A5:4",
        "na1b": "r:2 D6:2 | C6:3 G5:1 | B5:4 | F#5:2 A5:2",
        "na2": "F#5:4 | E5:2 G5:2 | B5:2 D6:2 | C6:2 D6:2",
        "na2b": "D6:3 A5:1 | G5:4 | G5:2 B5:2 | E5:2 F#5:2",
        "nb1": "A5:4 | G5:2 E5:2 | F5:3 D5:1 | E5:4",
        "nb2": "C6:4 | C6:2 G5:2 | A5:2 F5:2 | D6:4",
    },
}

# ---------------------------------------------------------------- fall: E minor (aeolian with dorian IV), 70 bpm
# The Andalusian descent i-bVII-bVI-V, the dorian IV (A major) for warmth, an aeolian bVI-bVII-i
# cadence (no leading tone), and the Neapolitan bII (F major) on the way back in the bridge. Harp in triplets, a bowed cello bass, a stepwise viola tune with dotted
# rhythms; no percussion. At night the cello takes the tune, low and slow.
PIECES["fall"] = {
    "key": "E minor", "level": 3.1, "nightLevel": -2.2, "jingleKey": -5, "bpm": 70, "meter": 4,
    "sections": {
        "A": {"chords": "Em | D | C | B7 | Em | A | C D | Em"},
        "B": {"chords": "Am7 | D | G | Em | Am7 | F | C | B7"},
        "R": {"chords": "Em | Am7 | Em | Am7"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "harp", "time": "day", "pattern": "arpTrip", "anchor": 52, "gain": 0.7},
        {"id": "bass", "inst": "cello", "time": "day", "pattern": "bass2", "anchor": 40, "bass": True, "gain": 0.6,
         "tacet": ["R"]},
        {"id": "tune", "inst": "viola", "time": "day", "rest": 0.15,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "ncomp", "inst": "harp", "time": "night", "pattern": "arpTripHalf", "anchor": 52, "gain": 0.55},
        {"id": "ntune", "inst": "cello", "time": "night", "rest": 0.25,
         "phrases": {"A": [["na1", "na1b"], ["na2", "na2b"]], "B": [["nb1"], ["nb2"]]}},
    ],
    "phrases": {
        "a1": "B4:3 A4:1 | A4:2 F#4:2 | G4:3 F#4:.5 E4:.5 | D#4:4",
        "a1b": "E5:1.5 D5:.5 B4:2 | A4:3 F#4:1 | E4:1.5 G4:.5 C5:2 | B4:4",
        "a2": "G4:1.5 F#4:.5 E4:2 | C#5:3 B4:1 | C5:2 A4:1 F#4:1 | G4:1.5 F#4:.5 E4:2",
        "a2b": "B4:3 C5:1 | C#5:2 E5:2 | E5:2 D5:1 C5:1 | B4:4",
        "b1": "C5:3 B4:1 | A4:2 F#4:2 | G4:3 A4:1 | B4:4",
        "b1b": "E5:2 D5:1 C5:1 | D5:3 C5:1 | B4:2 D5:2 | E5:4",
        "b2": "A4:1.5 B4:.5 C5:2 | C5:2 A4:2 | G4:1.5 F#4:.5 E4:2 | D#4:3 r:1",
        "b2b": "E5:3 D5:1 | C5:2 F4:2 | G4:2 E5:2 | D#5:4",
        "na1": "G3:4 | F#3:2 A3:2 | G3:2 E3:2 | F#3:2 D#3:2",
        "na1b": "r:2 B3:2 | A3:4 | E3:2 C4:2 | B3:4",
        "na2": "E4:3 B3:1 | C#4:4 | C4:2 A3:2 | B3:4",
        "na2b": "B3:4 | A3:2 E3:2 | G3:2 F#3:2 | E3:4",
        "nb1": "C4:4 | A3:2 F#3:2 | B3:2 D4:2 | E4:4",
        "nb2": "E4:4 | C4:2 A3:2 | G3:2 E3:2 | D#3:4",
    },
}

# ---------------------------------------------------------------- winter: D minor over a D pedal, 56 bpm, 3/4
# Section A never leaves the D in the bass: Dm, Bbmaj7/D, Gm/D, Dsus2, and a suspension cadence
# (Gm/D - Dsus4 - Dm) instead of a dominant. The bridge moves (Bbmaj7, C, Fmaj7) and lands on Asus4,
# still without a leading tone. The glock tune leans on appoggiaturas that resolve down by step.
PIECES["winter"] = {
    "key": "D minor", "level": 7.5, "nightLevel": -3.8, "jingleKey": 5, "bpm": 56, "meter": 3,
    "sections": {
        "A": {"chords": "Dm | Bbmaj7/D | Gm/D | Dsus2 | Dm | Bbmaj7/D | Gm/D | Dsus4 Dm"},
        "B": {"chords": "Bbmaj7 | C | Fmaj7 | Dm | Bbmaj7 | C | Gm7 | Asus4"},
        "R": {"chords": "Dm | Gm/D | Dm | Gm/D"},
    },
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "bass", "inst": "piano", "time": "day", "pattern": "bass3", "anchor": 38, "bass": True, "gain": 0.75},
        {"id": "comp", "inst": "piano", "time": "day", "pattern": "waltzChords", "anchor": 57, "gain": 0.75},
        {"id": "tune", "inst": "glock", "time": "day", "rest": 0.2,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "dpad", "inst": "viola", "time": "day", "pattern": "pad3wide", "anchor": 57, "gain": 0.45},
        {"id": "sleigh", "inst": "sleigh", "time": "day", "pattern": "sleigh2bar3", "outdoorOnly": True,
         "tacet": ["R"], "gain": 0.8},
        {"id": "pad", "inst": "viola", "time": "night", "pattern": "pad3wide", "anchor": 57, "gain": 0.7},
        {"id": "nbass", "inst": "cello", "time": "night", "pattern": "bass3", "anchor": 38, "bass": True, "gain": 0.65},
        {"id": "ntune", "inst": "piano", "time": "night", "rest": 0.3, "gain": 0.85,
         "phrases": {"A": [["na1", "na1b"], ["na2", "na2b"]], "B": [["nb1"], ["nb2"]]}},
    ],
    "phrases": {
        "a1": "A5:2 D6:1 | G6:2 F6:1 | D6:3 | E6:3",
        "a1b": "F6:2 E6:1 | D6:3 | Bb5:1.5 D6:1.5 | A6:2 E6:1",
        "a2": "D6:2 A6:1 | Bb6:2 A6:1 | G6:3 | G6:1.5 F6:1.5",
        "a2b": "A6:3 | F6:2 E6:1 | D6:2 Bb5:1 | A5:3",
        "b1": "D6:2 A6:1 | G6:3 | F6:2 C6:1 | A5:3",
        "b1b": "F6:3 | E6:2 C6:1 | E6:3 | D6:3",
        "b2": "Bb5:2 F6:1 | G6:3 | F6:2 D6:1 | D6:3",
        "b2b": "A6:3 | G6:2 C6:1 | D6:2 G6:1 | E6:3",
        "na1": "A5:3 | F5:2 D5:1 | D5:3 | E5:3",
        "na1b": "r:1 D6:2 | A5:3 | Bb5:2 G5:1 | A5:3",
        "na2": "F5:3 | D5:2 F5:1 | G5:3 | G5:1.5 F5:1.5",
        "na2b": "D6:3 | C6:2 Bb5:1 | Bb5:2 G5:1 | A5:1.5 F5:1.5",
        "nb1": "F5:3 | E5:2 G5:1 | A5:3 | r:1 D5:2",
        "nb2": "D6:3 | C6:2 G5:1 | Bb5:2 F5:1 | E5:3",
    },
}

# ---------------------------------------------------------------- title: Eb major, 76 bpm
# A fixed four-bar hook (a rising sixth, Bb to G) opens every A section, doubled an octave up on the
# glock. The harmony climbs I-iii7-IVmaj7-V and answers with the borrowed minor iv (Abm6) into the tonic:
# a minor plagal cadence, the "coming home" sound. It keeps borrowing from Eb minor (Cbmaj7, Gb, Cb).
# The rest of the piano tune sits low (around C5) and leans on dotted, off-beat entries. Harp, viola
# pad, cello bass.
PIECES["title"] = {
    "key": "Eb major", "level": 2.7, "jingleKey": 3, "bpm": 76, "meter": 4,
    "sections": {
        "A": {"chords": "Ebadd9 | Gm7 | Abmaj7 | Bbsus4 Bb | Eb/G | Cbmaj7 | Abmaj7 | Abm6"},
        "B": {"chords": "Abmaj7 | Gb | Cb | Bbsus4 Bb | Abmaj7 | Gb | Fm9 | Bbsus4 Bb"},
        "R": {"chords": "Cbmaj7 | Gb | Abm6 | Ebadd9"},
        "I": {"chords": "Ebadd9 | Bb"},
    },
    # A two-bar sting the first time the title appears: a rising arpeggio to the high Eb, doubled on the bell.
    "intro": ["I"],
    "form": ["A", "A", "B", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "harp", "time": "both", "pattern": "arpUp", "anchor": 51, "gain": 0.65},
        {"id": "pad", "inst": "viola", "time": "both", "pattern": "pad", "anchor": 51, "gain": 0.5},
        {"id": "bass", "inst": "cello", "time": "both", "pattern": "bassLong", "anchor": 39, "bass": True,
         "gain": 0.5},
        {"id": "tune", "inst": "piano", "time": "both", "rest": 0.1,
         "phrases": {"I": [["sting"]], "A": [["hook"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]]}},
        {"id": "bell", "inst": "glock", "time": "both", "rest": 0.3, "gain": 0.6,
         "phrases": {"I": [["stingHi"]], "A": [["hookHi"], ["bellEnd"]]}},
    ],
    "phrases": {
        "sting": "Bb4:.5 Eb5:.5 G5:.5 Bb5:.5 Eb6:2 | D6:1.5 Bb5:.5 F5:2",
        "stingHi": "r:1 Eb6:.5 G6:.5 Bb6:2 | F6:2 r:2",
        "hook": "Bb4:1 G5:2 F5:.5 Eb5:.5 | D5:1.5 Bb4:.5 F5:2 | Eb5:1 C5:1 G5:1.5 Ab5:.5 | Bb5:3 r:1",
        "hookHi": "Bb5:1 G6:2 F6:.5 Eb6:.5 | D6:1.5 Bb5:.5 F6:2 | Eb6:1 C6:1 G6:1.5 Ab6:.5 | Bb6:3 r:1",
        "bellEnd": "r:4 | r:4 | r:2 G6:2 | Eb6:2 r:2",
        "a2": "G4:1.5 Bb4:1 Eb5:1.5 | Eb5:1.5 Bb4:1 Gb4:1.5 | Ab4:1.5 C5:1 Eb5:1.5 | Cb5:2.5 Ab4:1.5",
        "a2b": "Bb4:.5 Eb5:1.5 G4:2 | r:.5 Gb4:.5 Cb5:1.5 Bb4:1.5 | C5:2.5 Eb4:1.5 | F4:1.5 Ab4:1 Cb5:1.5",
        "b1": "r:.5 Eb4:.5 Ab4:1.5 G4:.5 C5:1 | Bb4:1.5 Db5:1.5 Bb4:1 | Eb5:1.5 Gb4:.5 Cb5:2 | F4:1.5 Eb5:.5 D5:2",
        "b1b": "C5:1.5 Ab4:.5 Eb4:1 G4:1 | Gb4:.5 Bb4:1 Db5:1.5 Bb4:1 | Cb5:1.5 Eb5:1 Gb5:1.5 | F5:2.5 D5:1.5",
        "b2": "Ab4:1.5 C5:1 Eb5:1.5 | Db5:1.5 Bb4:1 Gb4:1.5 | Ab4:1.5 C5:.5 Eb5:1 G4:1 | Bb4:2.5 r:1.5",
        "b2b": "r:1 Eb5:1.5 C5:1.5 | Bb4:1 Db5:1.5 F5:1.5 | F4:1 Ab4:1.5 C5:1.5 | Eb5:2 D5:2",
    },
}

# ---------------------------------------------------------------- mine: A minor drone, 60 bpm
PIECES["mine"] = {
    "key": "A minor", "level": 2.5, "jingleKey": 0, "bpm": 60, "meter": 4,
    "sections": {
        "A": {"chords": "Am | Am | Fmaj7 | G | Am | Am | Dm7 | Esus4 E"},
        "B": {"chords": "Dm7 | Am | Dm7 | Em | Fmaj7 | G | Am | Am"},
        "R": {"chords": "Am | Am | Am | Am"},
        "D": {"chords": "Am | Bb/A | Am | Bb/A | Dm/A | Bb/A | Esus4 | Am"},
    },
    # D goes deeper: the phrygian bII (Bb) over the A drone, no ostinato, a slower and lower tune.
    "form": ["A", "B", "A", "R", "D"],
    "layers": [
        {"id": "drone", "inst": "cello", "time": "both", "pattern": "bassLong", "anchor": 33, "bass": True, "gain": 0.7},
        {"id": "pad", "inst": "viola", "time": "both", "pattern": "pad", "anchor": 57, "gain": 0.4},
        {"id": "ost", "inst": "marimba", "time": "both", "pattern": "mineOst", "anchor": 57, "gain": 0.55,
         "tacet": ["R", "D"]},
        {"id": "tune", "inst": "vibes", "time": "both", "rest": 0.35,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1"], ["b2"]], "D": [["d1"], ["d2"]]}},
    ],
    "phrases": {
        "a1": "r:2 E5:2 | C5:4 | r:2 A4:1 C5:1 | B4:4",
        "a1b": "A4:4 | r:1 E5:1 A5:2 | E5:2 C5:2 | D5:4",
        "a2": "C5:4 | E5:2 A4:2 | F5:2 C5:2 | B4:2 G#4:2",
        "a2b": "r:2 A5:2 | C6:2 E5:2 | D5:2 A4:2 | E5:4",
        "b1": "F5:4 | E5:2 C5:2 | A4:2 C5:2 | B4:4",
        "b2": "E5:4 | D5:2 B4:2 | C5:4 | r:4",
        "d1": "r:2 E5:2 | D5:4 | r:2 C5:2 | D5:2 F5:2",
        "d2": "F5:4 | F5:2 D5:2 | E5:2 B4:2 | A4:4",
    },
}

# ---------------------------------------------------------------- festival: G major, 112 bpm, swung
# A ragtime circle of secondary dominants (I-VI7-II7-V7), the borrowed Cm6 in the bridge, and a
# II7-V7-I cadence. Piano stride chords on 2 and 4 over an oom-pah pizzicato bass; the recorder tune
# uses the chromatic notes the dominants bring (G#, C#) and bouncy swung eighths.
PIECES["festival"] = {
    "key": "G major", "level": -1.4, "jingleKey": -5, "bpm": 112, "meter": 4, "swing": 0.2,
    "sections": {
        "A": {"chords": "G | E7 | Am7 | D7 | G | E7 | A7 D7 | G"},
        "B": {"chords": "C | Cm6 | G/B | E7 | Am7 | D7 | G | D7"},
        "C": {"chords": "Em | B7 | Em | B7 | Am | Em/G | F#m7b5 B7 | Em"},
    },
    # The trio (C) turns to the relative minor for eight bars: same dance, a different colour.
    "form": ["A", "A", "B", "A", "C", "A"],
    "layers": [
        {"id": "comp", "inst": "piano", "time": "both", "pattern": "stride", "anchor": 55, "gain": 0.8},
        {"id": "bass", "inst": "pizz", "time": "both", "pattern": "bassOomPah", "anchor": 43, "bass": True},
        {"id": "tune", "inst": "recorder", "time": "both", "rest": 0.05,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1", "b1b"], ["b2", "b2b"]],
                     "C": [["c1", "c1b"], ["c2", "c2b"]]}},
        {"id": "tamb", "inst": "tamb", "time": "both", "pattern": "tamb24", "gain": 0.8},
        {"id": "shaker", "inst": "shaker", "time": "both", "pattern": "shaker8", "gain": 0.7},
        {"id": "tri", "inst": "triangle", "time": "both", "pattern": "triangle2bar", "gain": 0.7},
    ],
    "phrases": {
        "a1": "D5:.5 E5:.5 G5:1 B5:.5 A5:.5 G5:1 | G#5:1 B5:.5 G#5:.5 E5:1 D5:1"
              " | C5:.5 E5:.5 A5:1 G5:.5 E5:.5 C5:1 | D5:.5 F#5:.5 A5:.5 C6:.5 B5:1 A5:1",
        "a1b": "B5:1 A5:.5 G5:.5 D5:1 G5:1 | E5:1 G#5:1 B5:1.5 A5:.5 | A5:.5 G5:.5 E5:.5 C5:.5 E5:1 A5:1"
               " | F#5:1.5 E5:.5 D5:1 C6:1",
        "a2": "G5:.5 A5:.5 B5:.5 D6:.5 E6:.5 D6:.5 B5:1 | B5:.5 G#5:.5 E5:1 D5:2"
              " | C#5:.5 E5:.5 A5:1 A5:.5 C6:.5 F#5:1 | G5:3 r:1",
        "a2b": "D6:1 B5:.5 G5:.5 D5:1 G5:1 | G#5:1 E5:.5 G#5:.5 B5:1 D6:1"
               " | C#6:1 A5:.5 E5:.5 D5:.5 F#5:.5 A5:.5 C6:.5 | B5:2 G5:2",
        "b1": "E5:.5 G5:.5 C6:1 G5:.5 E5:.5 C5:1 | Eb5:.5 G5:.5 A5:1 C6:1 A5:1 | B5:.5 A5:.5 G5:1 D5:1 G5:1"
              " | G#5:1 B5:1 E6:1.5 D6:.5",
        "b1b": "C6:1.5 B5:.5 G5:1 E5:1 | Eb5:1.5 C5:.5 A4:1 C5:1 | D5:1 G5:1 B5:1 D6:1 | B5:1.5 G#5:.5 E5:2",
        "b2": "A5:.5 C6:.5 E6:1 C6:.5 A5:.5 E5:1 | F#5:.5 A5:.5 C6:1 A5:1 F#5:1 | G5:.5 B5:.5 D6:1 B5:1 G5:1"
              " | F#5:1 A5:1 C6:1 D6:1",
        "b2b": "E5:1 G5:1 C6:1 A5:1 | D6:1.5 C6:.5 A5:1 F#5:1 | G5:1 D5:1 B4:1 D5:1 | C5:1 E5:1 F#5:1 A5:1",
        "c1": "E5:.5 F#5:.5 G5:.5 B5:.5 E6:1 B5:1 | A5:.5 F#5:.5 D#5:1 F#5:1 B5:1 | G5:.5 F#5:.5 E5:1 G5:1 B5:1"
              " | A5:1 F#5:1 D#5:2",
        "c1b": "B5:1 G5:.5 E5:.5 B4:1 E5:1 | D#5:1 F#5:.5 A5:.5 B5:2 | E6:1.5 B5:.5 G5:1 E5:1 | F#5:1 A5:1 B5:2",
        "c2": "A5:.5 C6:.5 E6:1 C6:.5 A5:.5 E5:1 | G5:.5 B5:.5 E6:1 B5:1 G5:1 | F#5:.5 A5:.5 C6:1 B5:.5 A5:.5 F#5:1"
              " | E5:3 r:1",
        "c2b": "E6:1.5 C6:.5 A5:1 E5:1 | B5:1.5 G5:.5 E5:2 | C6:1 A5:1 D#5:1 F#5:1 | E5:4",
    },
}


# ---------------------------------------------------------------- shop: F major, 96 bpm, a light shuffle
# While the General Store is open (the smithy next door): a light, jazzy shop tune with ii-V turns and
# secondary dominants, vibes over marimba and a walking pizzicato bass. Its first phrase quotes Mara.
PIECES["shop"] = {
    "key": "F major", "level": 0, "jingleKey": 5, "bpm": 96, "meter": 4, "swing": 0.1,
    "sections": {
        "A": {"chords": "F | Dm7 | Gm7 | C7 | F | D7 | Gm7 C7 | F"},
        "B": {"chords": "Bbmaj7 | Am7 | Gm7 | C7 | Bbmaj7 | A7 | Dm7 G7 | C7"},
    },
    "form": ["A", "A", "B", "A"],
    "layers": [
        {"id": "comp", "inst": "marimba", "time": "both", "pattern": "marimbaComp", "anchor": 60, "gain": 0.6},
        {"id": "bass", "inst": "pizz", "time": "both", "pattern": "bassWalk", "anchor": 41, "bass": True, "gain": 0.8},
        {"id": "tune", "inst": "vibes", "time": "both", "rest": 0.1,
         "phrases": {"A": [["a1", "a1b"], ["a2", "a2b"]], "B": [["b1"], ["b2"]]}},
    ],
    "phrases": {
        "a1": "C5:.5 F5:.5 A5:.5 G5:.5 F5:1.5 r:.5 | A5:1 F5:.5 D5:.5 C5:2 | Bb4:.5 D5:.5 G5:1 F5:1 D5:1"
              " | E5:1.5 G5:.5 C5:2",
        "a1b": "A5:1.5 G5:.5 F5:1 C5:1 | D5:1 F5:1 A5:1 C6:1 | Bb5:1 G5:1 D5:1 F5:1 | E5:1 Bb4:1 G4:1 C5:1",
        "a2": "F5:1 A5:1 C6:1.5 A5:.5 | F#5:1.5 D5:.5 A5:2 | G5:1 Bb5:1 E5:1 G5:1 | F5:3 r:1",
        "a2b": "C6:1.5 A5:.5 F5:1 A5:1 | A5:1 F#5:1 D5:1 C6:1 | Bb5:1.5 G5:.5 E5:1 Bb4:1 | A4:1 C5:1 F5:2",
        "b1": "D5:.5 F5:.5 A5:1 Bb5:.5 A5:.5 F5:1 | E5:1 G5:1 C6:2 | Bb5:1.5 A5:.5 G5:1 D5:1 | E5:1 G5:1 Bb5:2",
        "b2": "F5:1 A5:1 D6:1 A5:1 | C#6:1.5 A5:.5 E5:2 | F5:1 A5:1 B5:1 D6:1 | C6:2 Bb5:1 G5:1",
    },
}

# ---------------------------------------------------------------- lullaby: F major, 54 bpm, 3/4
# The house at night: almost nothing. Slow harp in threes, a vibraphone line that mostly rests, and the
# wall clock (ambience) ticking under it.
PIECES["lullaby"] = {
    "key": "F major", "level": 3, "jingleKey": 5, "bpm": 54, "meter": 3,
    "sections": {
        "A": {"chords": "Fmaj7 | Dm7 | Bbmaj7 | Csus4 C | Fmaj7 | Am7 | Gm7 C | F"},
        "R": {"chords": "Bbmaj7 | Fmaj7 | Bbmaj7 | Csus4 C"},
    },
    "form": ["A", "A", "R"],
    "layers": [
        {"id": "comp", "inst": "harp", "time": "both", "pattern": "arp3", "anchor": 53, "gain": 0.5},
        {"id": "tune", "inst": "vibes", "time": "both", "rest": 0.35, "gain": 0.6,
         "phrases": {"A": [["la1", "la1b"], ["la2", "la2b"]]}},
    ],
    "phrases": {
        "la1": "A5:3 | F5:2 D5:1 | D5:3 | F5:1.5 E5:1.5",
        "la1b": "r:1 C5:2 | A5:3 | F5:2 D5:1 | C5:3",
        "la2": "C6:3 | A5:2 E5:1 | G5:1.5 E5:1.5 | F5:3",
        "la2b": "E5:3 | E5:1 C5:2 | Bb4:1.5 C5:1.5 | A4:3",
    },
}

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "..", "src", "audio", "music.json")
    with open(out, "w", encoding="utf8", newline="\n") as f:
        json.dump({"instruments": INSTRUMENTS, "patterns": PATTERNS, "jingles": JINGLES, "stings": STINGS, "pieces": PIECES},
                  f, indent=1)
        f.write("\n")
    print("wrote", os.path.normpath(out))
