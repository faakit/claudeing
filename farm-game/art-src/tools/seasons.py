"""Per-season tilesets from the authored spring tiles (the art critic's R1-9: no off-palette tint).

Each tile slot gets a category from the first tile name that uses it. A season either remaps palette slots per
category (slot names from public/assets/palette.gpl), clears the tile (winter flora), or uses a drawn override
(winter roofs as a snow mass, the seasonal clumps). Props, buildings, interiors, the mine and water are left
alone. Output: tiles_summer.png, tiles_fall.png, tiles_winter.png.

`seasonal_*` tiles are empty in spring and drawn per season (dry grass in summer, leaf litter in fall, small drifts
in winter); the map generator scatters them under and downwind of trees.
"""
from __future__ import annotations

import numpy as np

FOLIAGE_PREFIX = ("canopy:", "tree_oak", "tree_birch", "bush_", "bigoak_")
FOLIAGE_EXACT = {"tree", "bush", "fern"}
ROOF_PREFIX = ("roof_", "eave_", "chimney_", "vane_")
GROUND_PREFIX = (
    "base_grass", "grass_", "creep:path", "shore:", "path_", "base_path", "pebbles", "cobble_", "shade_",
)
GROUND_EXACT = {"grass", "flower", "fence", "path", "board", "bin", "puddle", "stepping"}
FLORA_PREFIX = ("bloom_", "patch_", "rose_", "tallgrass", "fern_flat")
BOX_PREFIX = ("f_window_box", "p_flowerbed")

REMAP = {
    "summer": {
        "ground": {"new leaf": "sand"},
        "lush": {"new leaf": "sand"},
        "flora": {"new leaf": "sand"},
        "foliage": {"new leaf": "grass"},
    },
    "fall": {
        # the lawn stays green: autumn is told by the crowns and by leaf litter under the trees (seasonal_*)
        "lush": {"new leaf": "sand"},
        "flora": {"new leaf": "sand", "rose": "orange", "lilac": "plum"},
        "foliage": {
            "teal shade": "earth dark", "leaf dark": "soil", "leaf mid": "orange", "grass": "gold", "new leaf": "sand",
        },
        "evergreen": {"new leaf": "grass"},
    },
    "winter": {
        # snow is the calmest surface: almost every mark turns to ice white; drifts come from the lush patches
        "ground": {
            "grass": "ice white", "leaf mid": "ice white", "new leaf": "ice white", "leaf dark": "sky",
            "teal shade": "sky", "sand": "parchment", "wood": "sand",
        },
        "lush": {"grass": "ice white", "leaf mid": "ice white", "new leaf": "ice white", "leaf dark": "sky"},
        "foliage": {
            "teal shade": "dusk blue", "leaf dark": "teal shade", "leaf mid": "leaf dark", "grass": "ice white",
            "new leaf": "ice white", "red": "ice white", "rose": "ice white",
        },
        "evergreen": {"grass": "ice white", "new leaf": "ice white"},
        # window boxes and planters keep evergreen sprigs, not summer blooms
        "box": {"rose": "leaf mid", "red": "leaf dark", "gold": "leaf mid", "parchment": "leaf mid", "wine": "leaf dark"},
    },
}
CLEAR = {"winter": {"flora"}}


def category(name: str) -> str | None:
    if name.startswith("tree_pine"):
        return "evergreen"
    if name.startswith(FOLIAGE_PREFIX) or name in FOLIAGE_EXACT:
        return "foliage"
    if name.startswith(ROOF_PREFIX):
        return "roof"
    if name.startswith(FLORA_PREFIX):
        return "flora"
    if name.startswith(BOX_PREFIX):
        return "box"
    if name.startswith(("lush_", "gv_")):
        return "lush"
    if name.startswith(GROUND_PREFIX) or name in GROUND_EXACT:
        return "ground"
    return None


def season_sheets(
    sheet: np.ndarray,
    slot_names: list[str],
    cols: int,
    names: list[str],
    overrides: dict[str, dict[str, np.ndarray]] | None = None,
) -> dict[str, np.ndarray]:
    """Index sheet -> {season: index sheet}."""
    T = 16
    out = {}
    for season, table in REMAP.items():
        s = sheet.copy()
        over = (overrides or {}).get(season, {})
        for k, n in enumerate(slot_names):
            y, x = divmod(k, cols)
            tile = s[y * T : (y + 1) * T, x * T : (x + 1) * T]
            if n in over:
                tile[:] = over[n]
                continue
            cat = category(n)
            if cat in CLEAR.get(season, ()):
                tile[:] = -1
                continue
            if cat == "lush" and cat not in table:
                cat = "ground"
            if not cat or cat not in table:
                continue
            src = sheet[y * T : (y + 1) * T, x * T : (x + 1) * T]
            for a, b in table[cat].items():
                tile[src == names.index(a)] = names.index(b)
        out[season] = s
    return out
