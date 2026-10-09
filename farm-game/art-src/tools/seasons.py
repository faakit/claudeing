"""Per-season tilesets as palette swaps of the authored spring tiles (the art critic's R1-9: no off-palette tint).

Each tile slot gets a category from the first tile name that uses it, and each season remaps palette slots per
category (slot names from public/assets/palette.gpl). Props, buildings, interiors, the mine and water are left
alone; grass, flora, foliage and roofs change. Output: tiles_summer.png, tiles_fall.png, tiles_winter.png.
"""
from __future__ import annotations

import numpy as np

FOLIAGE_PREFIX = ("canopy:", "tree_oak", "tree_birch", "bush_", "bigoak_", "fern")
FOLIAGE_EXACT = {"tree", "bush"}
ROOF_PREFIX = ("roof_", "eave_", "chimney_", "vane_")
GROUND_PREFIX = (
    "base_grass", "grass_", "lush_", "gv_", "creep:path", "shore:", "path_", "base_path", "pebbles", "cobble_",
)
GROUND_EXACT = {"grass", "flower", "fence", "path", "board", "bin", "puddle", "stepping", "tallgrass"}
FLORA_PREFIX = ("bloom_", "patch_", "rose_")

REMAP = {
    "summer": {
        "ground": {"new leaf": "sand"},
        "flora": {"new leaf": "sand"},
        "foliage": {"new leaf": "grass"},
    },
    "fall": {
        # green ground with dry brown blades and fallen orange leaves (no lime wash)
        "ground": {"new leaf": "orange"},
        "lush": {"leaf mid": "wood", "new leaf": "orange"},
        "flora": {"leaf mid": "wood", "new leaf": "orange", "rose": "orange", "lilac": "plum"},
        "foliage": {
            "teal shade": "earth dark", "leaf dark": "soil", "leaf mid": "orange", "grass": "gold", "new leaf": "sand",
        },
        "evergreen": {"new leaf": "grass"},
    },
    "winter": {
        "ground": {
            "grass": "ice white", "leaf mid": "stone lt", "new leaf": "ice white", "leaf dark": "sky",
            "teal shade": "dusk blue", "sand": "parchment", "wood": "sand",
        },
        "flora": {
            "grass": "ice white", "leaf mid": "stone lt", "leaf dark": "stone", "new leaf": "ice white",
            "rose": "stone lt", "gold": "ice white", "parchment": "ice white", "orange": "stone lt", "wine": "stone",
            "lilac": "stone lt",
        },
        "foliage": {
            "teal shade": "night navy", "leaf dark": "teal shade", "leaf mid": "leaf dark", "grass": "ice white",
            "new leaf": "ice white", "red": "ice white",
        },
        "evergreen": {"grass": "ice white", "new leaf": "ice white"},
        "roof": {
            "red": "ice white", "wine": "sky", "orange": "ice white", "sand": "parchment",
            "stone": "ice white", "stone dark": "sky", "stone lt": "ice white",
        },
    },
}


def category(name: str) -> str | None:
    if name.startswith("tree_pine"):
        return "evergreen"
    if name.startswith(FOLIAGE_PREFIX) or name in FOLIAGE_EXACT:
        return "foliage"
    if name.startswith(ROOF_PREFIX):
        return "roof"
    if name.startswith(FLORA_PREFIX):
        return "flora"
    if name.startswith(("lush_", "gv_")):
        return "lush"
    if name.startswith(GROUND_PREFIX) or name in GROUND_EXACT:
        return "ground"
    return None


def season_sheets(sheet: np.ndarray, slot_names: list[str], cols: int, names: list[str]) -> dict[str, np.ndarray]:
    """Index sheet -> {season: remapped index sheet}."""
    T = 16
    out = {}
    for season, table in REMAP.items():
        s = sheet.copy()
        for k, n in enumerate(slot_names):
            cat = category(n)
            if cat == "lush" and cat not in table:
                cat = "ground"
            if not cat or cat not in table:
                continue
            y, x = divmod(k, cols)
            tile = s[y * T : (y + 1) * T, x * T : (x + 1) * T]
            src = sheet[y * T : (y + 1) * T, x * T : (x + 1) * T]
            for a, b in table[cat].items():
                tile[src == names.index(a)] = names.index(b)
        out[season] = s
    return out
