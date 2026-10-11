# The Dry Year: world plan

The full design behind [VISION.md](VISION.md). Build order and acceptance criteria: [MILESTONES.md](MILESTONES.md).
Everything here reuses the registries in [EXTENDING.md](EXTENDING.md); new state is called out in section 9.

Names used throughout: the valley and its river are **the Wend**. **Ilse** kept your farm for forty years (your
grandmother). **Bram Holt** was Clay's grandfather; Ilse and Bram founded the valley's Seed House together. Finn's
boat is the **Heron**; his father built her the year Finn was born.

## 0. At a glance

| # | Broken place | Whose loss | Where | New mechanic | Opens |
| - | ------------ | ---------- | ----- | ------------ | ----- |
| 1 | **The Old Spring** | Ilse's (her journal); Rosa | Wendhead (new map), west half | **Channels**: dig a water network that waters crops each morning | Y1 spring |
| 2 | **The Cold Forge** | Orin | Town, the south-west building | **Strike in time**: a 4-beat rhythm tap that forges the parts later places need | Y1 early summer |
| 3 | **The Weir** | Finn | Wendhead, east half | **Towing**: hook drift timber in the river and walk it to the slip; timber rebuilds the families' houses | Y1 late summer |
| 4 | **The Seed House** | Clay (Bram's half of the seed tin) | Town, building at 14,16 | **Seed library**: borrow a Wend strain, let some go to seed, return more than you took | Y1 fall |
| 5 | **The Bucket Orchard** | Rosa | The woods' north clearing | **Grafting**: take dormant cuttings and bud them onto dead stumps whose roots shape the tree | Y1 winter |
| 6 | **The Market Field** | Mara | Town, the south-west field | **Market day**: stock a stall; visitors' wants and repeats set the price | Y2 spring |
| - | **Lantern Night** (finale, not a mechanic) | everyone | The weir at Wendhead, at dusk | each household's lantern, made from its place; you open the sluice | Y2 fall 27 |

**The core three.** If only three places ever ship, they are the **Old Spring**, the **Weir** and the **Seed House**:
water comes back to the farm and the town, families come home (timber), and Clay turns from rival to ally. Without
the forge, their parts are bought from Orin for gold (the forge only changes how parts are made). Without the
market, families' goods go on Mara's shelf. The finale requires every place listed in `valley.json`, so it works with
three.

Families come home when their place is mended **and** their house is rebuilt with timber (section 5.2): the Marl
millers (after the Weir), Dara Holt and her children (after the Seed House), Wren Ashby (after the Orchard), Tobin
Reyes (after the Market).

## 1. Valley geography

Today: Farm (30x44) at the top, its south gate to Town (24x34); Town's west road to the Woods (20x30); the Woods'
north cave to the Mine (20x30); the House is the farm's interior. The plan adds **one** new map, Wendhead, and gives
farm, town and woods variants. Every existing door stays where it is.

```
                         N (the hills)
                                       WENDHEAD (new, 24x28): the valley's head
                                       west half: the Old Spring pool
                                       east half: the river gorge and the Weir
   MINE                                          |  door in the farm's NE fence (29,3)
    |                                    +-------+---------------+
    | cave                               | FARM (30x44)          |
    |                                    | creek bed x 26-27,    |
  WOODS (20x30)                          | spring to rain pond   |
  north clearing: the Bucket Orchard     +-----------+-----------+
  lake: deep springs, water unchanged                | south gate
    |                                                |
    +------------- west road --------------- TOWN (24x34)
                                             forge (SW building), Seed House (14,16),
                                             market field (SW, south of the west road),
                                             river (east side, x 17-22, y 22-31),
                                             the Heron, the log slip (south bank)
```

The river comes out of Wendhead's gorge, runs down the valley's east side beyond the farm fence (off-map) and into
town's east side, where today's pond is the river's visible reach. The farm creek comes from the spring.

- **Wendhead** (new, 24x28; door at the farm's north-east fence, 29,3, arriving at its south-west corner). Until the
  first green the door is Ilse's locked gate: the door object has `when: valley.farmGreen >= 1` and refuses with "Ilse's
  old gate. Locked." No geometry changes; the first-green letter carries the key. West half:
  the Old Spring under a rockfall, its pool, the head of the farm creek, ferns. East half: the dry gorge, the broken
  weir, stones. Open from the first-green morning (Rosa's letter points the way). One map for two places keeps the
  map budget to one.
- **The farm creek**: a dry bed two tiles wide down the farm's free east strip (x 26-27, y 3-30) into the pond's east
  bank. Today the strip is grass, two trees (26,4 and 27,7: moved) and the edge of the `field` weed zone (shrunk to
  x 3-25). It is a **delta region** (section 4) in every farm variant.
- **The Bucket Orchard** is the woods' north clearing (x 2-17, y 3-13, either side of the trail to the mine): eight dead
  stumps on two terraces, Rosa's one living "bucket tree", a ruined cottage Wren later moves into. The `clearing`
  forage zone shrinks to the tiles that stay open in every woods variant.
- **Town:** the forge is the south-west building (2,15; Orin stands at 9,17); the Seed House is the building at 14,16
  (its sign and door interactable at 15,19); the market field is the open lot south of the west road (x 2-9,
  y 26-32), off the main road so stalls never narrow it; the Marls' house is the north-east house (14,3); Tobin's rooms
  are above the forge. Dara moves back to the Holt farm with Clay (off-map, down the south road).

### Town variants (tile sketch of the east side and the market field)

Legend: `~` water, `m` cracked mud (walkable), `H` the Heron, `W` mill wheel (solid), `S` log slip (solid
interactable), `F` Finn's noon spot (16,22), `L` the retired Fish Ladder landmark (16,21), `s` stall (solid), `T`
tree, `.` grass, `[D]` a delta rect.

```
dry                           river (= today's water)      market (river + stalls)
x 14 16 18 20 22              x 14 16 18 20 22             x 2 4 6 8 (y 26-32, market field)
y21 . . L . . . . . . .       y21 . . L . . . . . . .      y26 . . . . . . . .
y22 . . F m m m m ~ ~ T       y22 . . F ~ ~ ~ ~ ~ ~ T      y27 . s s . s s . .
y23 . . . m m m m ~ ~ T       y23 . . . ~ H ~ ~ ~ ~ T      y28 . . . . . . . .
...   . m m H m ~ ~           ...   . ~ ~ ~ ~ ~ ~          y29 T s s . s s . .
y30 . . . m m m m ~ ~ T       y30 . . . ~ ~ ~ ~ W W T      y30 . . . . . . . .
y31 . . . m m m m ~ ~ T       y31 . . . ~ ~ ~ ~ W W T      y31 . s s . . . T .
y32 . . . . . . . . . T       y32 . . . . . S . . . T      y32 . . . . . . . .
      [D: x17-20, y22-31]           (slip at about 19,32)        [D: x2-9, y26-32]
```

- **Delta rects:** `D1` (17,22)-(20,31), mud in `dry`, water after; `D2` the market field (2,26)-(9,32), grass in
  `dry` and `river`, stalls in `market`. Nothing fixed is inside either (rule 4.2.2): Finn's spot (16,22), the
  `riverbank` forage zone (x 14-16) and the board, statue and every landmark are outside. The mill wheel sits on water
  tiles (x 21-22, y 30-31) that are solid in every variant. The log slip is placed by the art agent on open grass on
  the south bank, outside every zone.
- **`town.tmj` stays the final geometry for walkability.** Water and solid tiles in the `river` and `market`
  variants match today's town exactly outside D2; only art is added (the wheel, reeds, the Heron). The market variant
  adds solid stalls inside D2 only.
- **Fishable water:** 20 tiles in `dry` (the two-tile trickle), 60 after (today's).

## 2. How a place is restored (the shared pattern)

Not bundles. Every place goes through the same four steps, all data in `src/data/valley.json`:

1. **Ask.** The person who lost it asks, in a letter or a heart scene, when its `ask` condition holds. Until then the
   site is a sign ("The Old Spring. Choked with stones.").
2. **Gather.** A small fund in the existing project sheet (`projects.json` row with `"place": "<id>"`, hidden from the
   board's list, opened from the site): a little gold (300g to 4,000g), one basic good or timber, and from the second
   place on one **part** from Orin (forged by you once the forge is lit, bought for gold if the forge has not shipped).
3. **Work days.** Once funded, 3 or 4 days of help: one Interact a day at the site, 20 energy, and each work day is a
   **ten-second taste of that place's verb** (listed per place below), so the work previews the mechanic. The site's
   sprite changes each day. Missing days costs nothing.
4. **Opening.** The morning after the last work day: the place's stat becomes restored, maps change variant
   overnight (section 4), the villager waits at the site with three lines, the tool or first item is handed over, a
   one-off `intro` step teaches the verb, and a letter follows.

State: stats only (`place.<id>`: 0 untouched, 1 asked, 2 funded, 3 restored; `site.<id>.work`, `site.<id>.last`), so
the pattern needs no save change. A restoration increments both `placesDone` and `projectsDone` (section 8 explains
why the town project goals keep working).

**On the HUD.** There is one goal line. It shows, in this order: (1) a valley step that can be done today and has not
waited 3 days: "Rosa asked: the Old Spring" (the day of the ask), "Old Spring: ready to fund" (once the bag and purse
hold the fund), "Work at the Old Spring (2 of 3)" (a work day not done today), "The Old Spring is open!" (opening
morning); (2) otherwise the goal chain, with its existing aside and 3-day wait rules. A valley step with no progress
for 3 days waits like a goal and is listed under THE VALLEY in Menu > Goal (a section above the goals, one row per
asked place and its next step). The goal arrow points at the site for valley steps.

**Intro timing.** Valley intros use the onboarding rules: never during the guided days, held while `tipsHeldNow`, and
at most one new valley intro per morning, queued after any held tips are released (oldest first).

Sketch (one place):

```json
"spring": {
  "name": "Old Spring", "map": "wendhead", "site": [6, 8], "npc": "rosa",
  "ask": { "stat": "valley.farmGreen", "min": 1 }, "project": "place_spring", "workDays": 3,
  "taste": "channelTile", "sprites": ["obj_site_spring_0", "obj_site_spring_1", "obj_site_spring_2", "obj_site_spring_3"],
  "opens": { "item": "spade", "intro": "channels" }, "phrase": "The creek runs."
}
```

`systems/valley.ts` holds the place rules (pure, unit tested); `mechanics/valley.ts` registers the site interact, the
`start` hook for openings and a perk source.

## 3. The broken places

Each mechanic has verbs, the one-thumb input, the loop, the data model and registries, a v1 that ships small and a
v2. New tools are deliberate choices like the rod (not auto items), so smart targeting with seeds, can and hoe never
changes.

### 3.1 The Old Spring: channels

- **Story.** The spring at Wendhead fed a creek down Ilse's farm. The flood's rockfall closed its mouth; the creek died
  and so did the trees along it. Journal, page 1: "Where the water starts, the farm starts."
- **Who cares.** Ilse (through the journal) and Rosa, who carried buckets from the pond for years.
- **Restore.** Ask: the first-green morning (Rosa's letter brings Ilse's tin and journal, section 7). Gather: 300g and
  20 stone. Work: 3 days. *Taste:* days 1-2 lift stones (a pickaxe swing at the rockfall); day 3 Rosa hands you Ilse's
  spade and you dig the first channel tile from the pool, and the water follows it.
- **Opens.** The pool, the farm creek and the spade.
- **Mechanic: channels.** Dig narrow channels off the creek; each morning the water runs along every connected channel
  and waters the soil beside it.
  - *Verbs:* dig, fill in; (v2) set a gate.
  - *One thumb:* select the spade (tool ring). Action next to the creek or a channel digs; the existing paint gesture
    digs a line or serpentine in one drag. Action on a channel fills it in. Refusal: "Start next to water."
  - *Rule:* in the `pre-growth` day hook, a breadth-first walk from creek-adjacent channels through 4-connected channel
    tiles reaches up to `flow` tiles (24; 64 once the Weir raises the water table). Tilled tiles 4-adjacent to a reached
    channel are watered. Channels past the flow stay dry ("The water runs out before here.").
  - *Loop:* plan a field around a channel once; mornings become harvest and replant. Channels are free but cost soil
    tiles and planning; sprinklers cost bars and go anywhere.
  - *Data:* `SoilTile.channel?: true` (the one save bump, section 9); `valley.json` `spring.flow: [24, 64]`; channels
    drawn by the soil renderer. Registries: action handler `dig-channel` (priority 45), `registerToolAction('dig')`, a
    day hook.
  - *v1:* dig, fill, flow cap, watering. *v2:* a sluice gate (forged hinge) to send the flow one way.
  - *Site upgrade:* the **warm pool** at Wendhead is today's Hot Spring project moved off the board onto the spring's
    site sheet once the spring is open (same cost, same +30 max energy perk), so it ships with this place.
- **Reshaping.** Farm `waking` to `restored`: the creek fills, the creek's dead trees become graftable stumps, frogs at
  dusk. Wendhead `dry` to `spring`: the pool full, ferns green. Woods `dry` to `waking` (the deep springs wake).
  Audio: the creek loop; birdsong returns.
- **Scenarios:** `valley-farm-dry`, `valley-farm-green`, `spring-site-ask`, `spring-site-work`, `spring-opened`,
  `channels-first-dig`, `channels-flow-cap`.

### 3.2 The Cold Forge: strike in time

- **Story.** Orin's bellows were driven by a wheel on the mill race. When the river left, the wheel stopped; his
  apprentice Tobin went to the city; Orin mends hinges by hand. "I haven't heard the anvil ring in six years."
- **Restore.** Ask: summer 1, or earlier once the spring is open and Orin is at 2 hearts. Gather: 1,500g, 5 copper
  bars, 10 charcoal. **Deadwood** (a forage good that spawns only on `dry` variants: the drought's one gift) burns to
  **charcoal** in a kiln (a `machines.json` row, `jar` behaviour, 1 day). Work: 3 days rebuilding a hand bellows.
  *Taste:* each work day is one strike on the bellows' rivets (a single beat).
- **Mechanic: strike in time.** The hammer rises and falls on a steady beat; strike as it meets the glowing metal.
  - *Verbs:* pick a piece, strike four times (the quench is automatic).
  - *One thumb:* Interact at the anvil opens the forge sheet: the recipe list, then the anvil view with one wide
    **Strike** button low on the sheet. A metronome hammer and a shrinking glow ring show each beat at 84 to 96 bpm.
    Timing comes from the press's own event timestamp, minus the player's **strike offset**: Great within 90 ms,
    Good within 180 ms, else Plain. Four strikes, about 6 seconds.
  - *Calibration:* the first time, and from Opts, "Tune your strike": tap 8 times with the anvil's tick; the median
    offset (clamped to 0-150 ms) is saved as `settings.strikeOffset`, because touch latency varies 30-80 ms by phone.
  - *No failure:* Plain is still a strike. Quality is the strikes' average (tier 0-2). A gold part shortens its place's
    work by a day or nudges its mechanic (a gold sluice gate lets 4 more channel tiles flow).
  - *Versus fishing:* fishing reacts to a random bite and then holds a bar; forging anticipates a visible, steady beat
    with discrete taps, and nothing escapes.
  - *Accessibility:* Calm mode stills the ring (a static mark, a tick per beat); "Easy strike" in Opts makes every
    strike Good.
  - *Products (v1):* the parts: sluice gate (Weir), timber hook (Weir's tool), stall frames (Market), grafting knife
    (Orchard), iron hinge (v2 gates). Parts are refused by the bin.
  - *Data:* `recipes.json` rows with `"station": "forge"`, `"beats": 4`; `valley.json` `forge` (`bpm`, windows);
    `systems/forge.ts` (score from press times; pure); `ui/panels/ForgePanel.ts`; the anvil as a fixed interactable.
  - *v2:* tool tempers (one of two per tool), forge level 2 with the river (5 beats, faster).
- **Reshaping.** Town: chimney smoke, an orange window glow at night (`lights`), the anvil ring on town mornings, the
  forge's shutters down. Objects keyed by the place stat, not a variant.
- **Scenarios:** `forge-cold`, `forge-work`, `forge-first-strike`, `forge-tune`, `forge-calm`, `kiln-deadwood`.

### 3.3 The Weir: towing

- **Story.** In Wendhead's gorge a stone weir split the Wend: most of it into the valley. The flood broke the weir and
  buried the valley side, so the whole river went east. Finn's *Heron*, built by his father, has sat on the town mud
  ever since; Finn scrapes her hull every spring anyway.
- **Restore.** Ask: the spring open, the forge lit (or summer 15 without it) and Finn at 2 hearts ("I walked up to the
  gorge today. It's only stones. Stones can be moved."). Gather: 2,500g, 60 stone and a sluice gate. Work: 4 days with
  Finn (Orin on the last). *Taste:* on the last day the water comes through and the first log drifts down; you hook it
  and walk it into the weir's gap as its last beam.
- **Opens.** The river returns to town overnight, the *Heron* floats, drift timber, and the timber hook.
- **Mechanic: towing.** The returning river carries flood-felled trees down from the hills. You hook a drifting log
  and walk it along the bank to the log slip, where it becomes timber, and timber rebuilds the houses families come
  home to.
  - *Verbs:* hook, tow, tug free, land. Nothing else in the game moves a thing on water.
  - *One thumb:* with the timber hook selected, Action at the water's edge hooks a log up to 3 tiles out (a rope is drawn). Then
    walk as usual (stick or tap a bank tile); the log follows on the water, pulled toward you along a rope of up to 3
    tiles and pushed by the current. If the rope would cross a rock, a reed bed or a bank corner the log snags; Action
    tugs it free (or walk back a step). Action at the slip lands it.
  - *Logs:* a **short log** is 1 timber and swings free after one tug; a **long log** is 3 timber, swings wider on the
    rope and needs two tugs at a snag. 1 or 2 logs arrive each morning (at most 3 waiting, resting against the mill
    wheel, so nothing is lost by a day away); about one in three is long. The river runs all year: in winter ice
    rims the banks, logs drift at half speed and one arrives a day.
  - *Lanes, so tows differ:* the `river` variant puts two rock spurs and a reed bed on water tiles (solid to walking in
    every variant, so walkability is unchanged) that split the current into three lanes. Each log enters in one lane,
    chosen by a day hash, never the same lane twice in a row:

    ```
    x 16 17 18 19 20 21 22      W: west lane, near the bank, snags at the reed bed (R)
    y22 .  W  .  M  .  E  ~     M: middle lane, snags at the rock spur (r1)
    y24 .  W  R  M  .  E  ~     E: east lane, out of reach (the bank is x 16, the rope 3),
    y26 .  W  .  r1 .  E  ~        until the spur r2 at y 27 turns it west into reach
    y27 .  ~  ~  M  E< r2 ~
    y29 .  W  .  ME .  .  W W   (W W: the mill wheel)
    y31 .  .  .  .  .  .  W W
    y32 .  .  .  S  .  .  .     S: the slip on the south bank
    ```

    So a tow is a short walk down the west bank, a different snag to tug free each time, and the turn onto the south
    bank to the slip.
  - *What timber is for:* rebuilding the families' houses (the Marls' house 6, the Holt farm's east wing 5, Wren's
    cottage 5, Tobin's rooms 4), the Seed House roof (5) and the market's awnings (5): 30 timber in all, about 12 to 15
    visits over two seasons. A house shows scaffolding as timber is delivered (Interact at the house gives what you
    carry); a family arrives the morning after its house is finished and its place is restored. Timber sells for 5g.
  - *The loop:* one or two tows a visit, 15 to 25 seconds each, and a house filling up toward someone coming home.
  - *Data:* drift logs are runtime objects spawned from a daily count (stat `drift.<day>`), positions not saved (a save
    while towing returns the log to the water at the north edge); `valley.json` `weir.drift` (per day, speed, max
    waiting), `houses` (timber per house, family, place); house progress in stats (`house.<id>`). Registries: a tool
    action `hook`, an action handler for the slip and houses, a `morning` hook spawning drift, a small towing
    controller in the scene (rope, follow, snag), rules in `systems/towing.ts` (rope length, lanes, snag test against the
    water and obstacle mask; pure; a test runs ten consecutive days and checks no two in a row share a lane and snag).
  - *Fishing:* fish rows gain an optional `"place": "weir"`: trout, salmon, the glimmer trout and the ice pike bite in
    town only with the river back.
  - *v1:* one river, one slip, logs and houses. *v2:* tow from Wendhead's gorge down the restored river.
  - *Site upgrade:* the **Fish Ladder** is today's project moved off the board onto the weir's site sheet once the weir
    is open (same cost, same `fishWindow` perk).
- **Reshaping.** Town `dry` to `river`: D1's mud becomes water with reeds, the *Heron* afloat at the dock, the town
  palette turns green, the river loop replaces the dry wind, the mill wheel turns once the Marls are home. Wendhead
  `spring` to `restored`: the gorge runs.
- **Scenarios:** `weir-broken`, `weir-work`, `weir-opened-town`, `tow-first-log`, `tow-snag`, `tow-house-marls`
  (house at 5 of 6 timber), `marls-arrive`, `derby-lake` (summer 22, weir broken), `derby-river`.

### 3.4 The Seed House: the seed library

- **Story.** Ilse and Bram Holt founded the Seed House as a lending library: a farmer borrowed seed from a drawer,
  grew it, saved seed from the best plants and brought back more than they took, so the valley's crops were bred for
  its own ground. The roof fell in the year after the flood. Ilse kept three strains in her tin; Bram's three went to
  Clay, who has told no one.
- **Restore.** Ask: Clay's new scene **"The other half"** (3 hearts and two places restored, or 2 hearts and a board
  season won): his tin beside yours. Gather: 3,000g, 5 timber, 3 iron bars. Work: 3 days **with Clay**, the first time
  he works beside you. *Taste:* each day you tag one of Clay's plants for seed and he grumbles about how you tie the
  ribbon. Expected: fall 1-15, year 1.
- **Opens.** Six drawers (Ilse's spring strains: parsnip, potato, cauliflower; Bram's summer and fall strains: corn,
  pumpkin, yam; in fall, pumpkin and yam are usable at once), the seed tag, Wend strains.
- **Mechanic: the seed library.** Borrow, grow, save, return more.
  - *Verbs:* borrow, tag, collect seed, return.
  - *One thumb:* at the Seed House (Interact at its door) a sheet lists the drawers: **Borrow** takes 5 Wend seeds of a
    strain (one loan per strain at a time). In the field, select the **seed tag** (10 from Clay) and Action on a crop to
    tie a ribbon; smart targeting never harvests a tagged crop ("Tagged for seed: 2 more days."). Three days after ripe
    it bolts (a seed-head stage); Action collects 2 to 4 Wend seeds and the tag comes back. **Return** gives seeds back
    to the drawer.
  - *Returning more:* a loan returned at 2x or more (10 for 5) raises the strain's **generation**. Wend strains were
    bred for a dry valley, so generations grow along one axis only, **thirst**: generation 1 *slow thirst* (a watered
    Wend crop stays watered the next day too: water every other day), 2 *rain keeper* (a rain day keeps it watered for
    three days), 3 *dry-sown* (its first watering lasts until harvest). Quality and yield are never touched: those are
    the orchard's roots (3.5). Wend strains make the fields the channels cannot reach (the meadows, the lowland) worth
    planting. The drawer shows its generation and who borrowed from it last.
  - *Neighbours borrow too:* once a drawer holds 10 or more, Rosa, Clay and later Dara borrow from it each season (a
    few seeds go out) and their gardens, Clay's stall and the town planters grow that strain, visibly; they return
    more the next season. The library is a shared stock, not a checklist: drawers rise and fall.
  - *Versus grafting:* grafting changes the world's dead objects with what you find. The library is patience in your
    own field and a stock you keep with your neighbours.
  - *Data:* `CropState.tag?`, `CropState.ripeFor?` (in the same single save bump); drawers in stats
    (`seeds.<strain>.stock`, `.gen`, `.loan`); `valley.json` `seedhouse.strains` (crop, founder, season); Wend seeds
    are items with `of: <strain>`-style refs so the crop knows its generation. Registries: an action handler for the
    tag (priority 60), the harvest handler checks the tag, a `growth` hook ages tagged ripe crops, a `morning` hook for
    neighbours' loans, `ui/panels/SeedHousePanel.ts`.
  - *v1:* six strains, borrow and return, generations 1-3, neighbours' loans. *v2:* crossing two strains; strains for
    the other crops; the rare crops (today's Seed Exchange project is retired, its four rare seeds move to the Seed
    House's shelf once it opens, and the cart keeps selling them).
- **Reshaping.** Town: the Seed House roof mended, its lamp lit; planters by the board and Clay's stall grow the
  borrowed strains in their season; Clay stands at the Seed House in the mornings instead of the board. When the Holt
  east wing is rebuilt (5 timber), **Dara** comes home with Pip and Lu.
- **Scenarios:** `seedhouse-ruin`, `clay-other-half`, `seedhouse-work`, `seed-borrow`, `seed-tag-first`,
  `seed-bolted`, `seed-return-gen`, `neighbours-borrow` (Rosa's garden growing a strain), `dara-arrives`.

### 3.5 The Bucket Orchard: grafting

- **Story.** Rosa's grandmother planted the orchard in the woods' north clearing. When the springs failed it died
  standing, all but one cherry Rosa kept alive by bucket (her "bucket tree"). The trunks are dead; the old roots are
  not.
- **Restore.** Ask: Rosa at 3 hearts and the spring open; her 4-heart scene "Grandmother's orchard" (it exists) walks
  you there. Gather: 2,000g, 30 fiber, a grafting knife. Work: 3 days (a flume from the lake, terraces mended). *Taste:*
  day 1 you take a cutting from the bucket tree; day 3 you graft it onto the first stump. Expected: winter 1-14, year 1.
  Winter is right: real orchards graft dormant wood in late winter.
- **Mechanic: grafting.** Take a cutting from a living fruit tree and bud it onto a dead stump; the old roots wake.
  - *Verbs:* take a cutting, graft, read a stump.
  - *One thumb:* with the knife selected, Action on a grown fruit tree takes a **cutting** (once per tree per season, in
    any season: dormant wood works; a stack with `of: "cherry"` like jam). With a cutting selected, Action on a stump
    grafts it. Interact on a stump reads its roots ("Old pear roots. Sweet ground.").
  - *Roots are the choice:* each stump has a rootstock (Tiled property) adding one trait to what you graft: **sweet**
    (a better quality step more often), **long** (fruits one extra season), **heavy** (two fruit some mornings),
    **early** (fruits from the season's first day). Eight stumps, four fruits, four roots.
  - *Growth:* a grafted stump shows buds for 7 days and then is a mature tree of that fruit (the `fruitTree` behaviour:
    a placeable created on the stump's tile with `data.roots`, never movable). Grafted in winter, it blossoms on spring 1.
  - *Where:* the orchard's eight stumps and the farm creek's three stumps (after the spring): the must-have "dead trees
    bud".
  - *Data:* `stump` Tiled objects with `roots`; `trees.json` root modifiers; the knife (`registerToolAction('cut')`); a
    graft action handler (priority 55). Placed trees already save per map: no new state beyond stats.
  - *v1:* cuttings, eleven stumps, four roots. *v2:* a second graft for a two-fruit tree.
- **Reshaping.** Woods `waking` to `blossom` after 4 grafts: stumps bud one by one at once, then the clearing turns
  green with petals in spring. On spring 1 of year 2, if her cottage is rebuilt (5 timber), **Wren Ashby** (Rosa's
  niece, a beekeeper) moves in: blossom feeds her bees (bee houses within 6 tiles of a grafted tree yield a day sooner).
- **Scenarios:** `orchard-dead`, `orchard-work`, `graft-first`, `graft-roots`, `orchard-blossom` (Y2 spring 1),
  `farm-creek-stumps`, `wren-arrives`.

### 3.6 The Market Field: market day

- **Story.** Saturday market on the field by the west road was the valley's heartbeat. When the traders stopped coming
  Mara kept the store lit; her ledger still lists every family that left, none crossed out.
- **Restore.** Ask: Mara, once three places are open (by year 2 spring 1 at the latest, if three are open). Gather:
  4,000g, 5 timber, three stall frames. Work: 3 days raising awnings. *Taste:* on the last day you stock one slot and
  Mara buys it ("First sale in six years. I'm framing the coin."). Expected: year 2 spring 5-20.
- **Mechanic: market day.** Once a week you stock a stall; visitors buy what they want, and what they want changes with
  the season and with what has already sold.
  - *Verbs:* stock, chat to a buyer, collect.
  - *One thumb:* on market days (6, 13, 20, 27; no contest festival falls on them; Lantern Night on fall 27 is an evening gathering
    after the market closes), Interact at your stall opens a 6-slot sheet:
    tap a bag item, then a slot ("Fill" puts the six best-wanted goods in). From 9 AM to 3 PM visitors walk past with a
    want bubble (fruit, fish, flowers, sweet, eggs) and buy from your stall if it has what they want. Tapping a visitor
    at your stall chats (a heart point, that sale 10% better). At 3 PM leftovers go back to the bag or are paid at bin
    price (an Opts choice).
  - *Demand:* price = bin value x (1 + demand); demand starts at up to +50% for a wanted good and drops 15% per same item
    sold that day. Six different goods beat six of the same; the board's flat requests and the bin's flat price stay
    different games.
  - *Visitors:* villagers, then each returned family, then day traders once the Trade Road opens; `wants` by season.
  - *Data:* `market.json` (days, slots, hours, demand, visitors); the stall is a placed, unmovable object in town whose
    `data` holds the stock (saved by the existing placed-object path: no save bump); sales resolve lazily
    (`applyMarket` when the stall or field is next seen, exact in tests); `ui/panels/StallPanel.ts`.
  - *v1:* one stall, six slots, demand, villagers and families. *v2:* a second row (Tobin), market fairs twice a year.
- **Reshaping.** Town `river` to `market`: awnings, bunting and stalls on the field (one more per family home), a crowd
  murmur and the town piece's market-day variation. Seven days after it opens, and once his rooms are rebuilt (4
  timber), **Tobin Reyes** arrives by the south road; the Market Road project becomes his **Trade Road**.
- **Scenarios:** `market-empty`, `market-work`, `market-day-stock`, `market-day-buyers`, `market-day-close`,
  `tobin-arrives`.

### 3.7 Lantern Night: the finale (no mechanic, no new map)

Ilse's last journal page (Rosa's 5-heart scene, "Blossom"): "When the harvest is in, every house made a lantern from
its own work, and we let the weir carry them down to the ones who'd gone, so they'd know the way back." Lantern Night
is the evening of **fall 27** (after that day's market closes). It becomes the finale on the first fall 27 when every
place in `valley.json` is restored and every family is home; Rosa's letter on fall 20 says it is coming. If the valley
is not ready, that letter says what is still missing, warmly, and names next fall.

**At dusk (6 PM) the valley gathers at the weir in Wendhead**, the place the river came back through. Each household's
lantern is made of its place: Orin's forged frame, a shade of Wend seed paper from the Seed House (Clay and Dara),
Marl flour-sack cloth, Wren's beeswax, a husk of bucket-tree blossom (Rosa), a ledger page with "back" written beside
every name (Mara), a lantern hung from the *Heron*'s old oarlock (Finn), and Ilse's, which you bring (that morning the
forge, or Orin if it is not lit, gives you its frame). One line each from the five who stayed. Then the player's
action: you **open the sluice gate** (Interact), and the gathered lanterns ride the water through the weir together,
down the gorge and out of sight toward the valley, while the Lantern Night piece plays. Nobody launches a light alone,
nothing is counted, no names are read out. A sheet follows, **"The Wend is remembered"**: each restored place's phrase
("The creek runs. The forge rings. The river is home. ...") and "Keep playing". Lantern Night repeats every fall 27
after (a festival row with no contest).

### 3.8 Ideas considered and not chosen

- Rowing the *Heron* (draft 1): a movement mode wrapped around fishing and forage on 60 water tiles, the costliest
  mechanic. Replaced by towing, which is a verb only water has and feeds homecomings.
- A windmill with milling and baking: another processing machine. A beehive meadow: the bee house exists (Wren deepens
  it). Export orders on a trade road: too close to the board.
- A donation room for seeds: bundles by another name; the library lends instead.
- A broken bridge, a scored yearly evaluation: avoided (originality, section 10).

## 4. Map stages

### 4.1 The model

| Map | Variants (first to last) | Driven by |
| --- | ------------------------ | --------- |
| farm | `dry` (straw palette, dead creek trees), `waking` (green), `restored` (creek runs, stumps) | first green; spring |
| wendhead (new) | `dry`, `spring` (pool full, gorge dry), `restored` (gorge runs) | spring; weir |
| town | `dry` (straw, D1 mud, boarded north-east house), `river`, `market` | weir; market |
| woods | `dry` (straw edges, low shore decals, water unchanged), `waking`, `blossom` | spring; 4 grafts |
| mine, house | one each | - |

Eleven map files in all (four new variant files for farm and woods, two for town, three for Wendhead). Changes that do
not move geometry are **objects keyed by stats**, not variants: site sprites by work day, house scaffolding and lit
windows, the forge's smoke, the *Heron* afloat, family stalls, neighbours' planters. They reuse the landmark path
(`landmarksOn` gains an optional `when`).

```json
"maps": {
  "farm": [
    { "variant": "dry", "palette": "dry", "when": { "stat": "valley.farmGreen", "max": 0 } },
    { "variant": "waking", "when": { "place": "spring", "max": 2 } },
    { "variant": "restored" }
  ],
  "town": [
    { "variant": "dry", "palette": "dry", "when": { "place": "weir", "max": 2 } },
    { "variant": "river", "when": { "place": "market", "max": 2 } },
    { "variant": "market" }
  ]
}
```

`systems/valley.ts mapLook(state, map)` returns the file (`farm@dry.tmj`, `farm@waking.tmj`, `farm.tmj`) and the
palette; `mapCache.ts` keys by file. The final variant keeps today's file name.

### 4.2 Gameplay rules (explicit, tested)

1. **Delta regions.** Each map declares rectangles where tiles may differ between variants (`delta` objects in every
   variant). Outside them, ground and collision are identical across variants (a test).
2. **Nothing fixed in a delta region** in any variant: no door, door spawn, wake or start tile, villager schedule spot,
   landmark, trophy, mailbox, plot, plot sign, bin, board, shop, site or house. Placing a placeable there is refused
   ("The old creek bed. Best left clear."). A forage or weed zone may include a delta tile only if it is walkable in
   every variant, or the zone exists only in the variants where it is (the mud flats in town `dry`).
3. **Every variant passes the map tests** (walkable spawns, connectivity, every spot reachable).
4. **Swaps happen off-screen.** A variant is chosen at map load; mornings start in the house, so overnight changes are
   seen on stepping out. A load that puts the player on a tile solid in the new variant (only from a scenario) moves
   them to the nearest door spawn.
5. **Doors never move.** Variants share door objects and ids. The Wendhead door exists in every farm variant.
6. **Scenarios pin variants** with a semantic `valley` key (`{ "spring": 3, "weir": 0, "farmGreen": 1 }`);
   `tests/dev-scenarios.test.ts` loads each scenario in its pinned variant. A scenario tile in a delta region must pin it.
7. **Water defines fishing.** A variant's water tiles are its fishing spots; fish rows with `place` add species.

### 4.3 The map generator and art layers

- `scripts/generate-maps.mjs`: each map block becomes `function town(v)`; a `VARIANTS` table; the function draws the
  final layout and applies the variant's differences inside the delta rects only; `flush()` writes one `.tmj` per
  variant; `map-art.mjs` bakes each variant.
- New tiles: cracked mud and its edges, a dry creek bed, a dead crown, a budding stump, the rockfall, the weir in two
  states, stalls and awnings, house scaffolding. Season swaps come from `seasons.py` automatically.
- **The dry palette** is a palette swap like the seasons (`seasons.py` gains a `dry` remap: grass and foliage ramps to
  straw and grey-green; water, paths and roofs untouched), producing `tiles_dry.png` and `tiles_<season>_dry.png`.
  The current season's dry tileset is **resident while any outdoor map's variant is dry** (loaded in the morning, before
  the player leaves the house, never at a door) and released the first morning no outdoor map is dry, so doors stay
  under the feel bar of 0.3 s. `tilesetFor()` takes the palette.

### 4.4 NPCs per stage

- Villagers' line groups and heart events gain an optional `when` (section 5), owned by this plan (M1), so the tone
  fix needs nothing else to ship.
- Schedule rows gain an optional `when` (Finn's afternoon spot is the dock with the river back; Clay at the Seed House
  in the mornings). The living-villagers plan's M6 adds the same field; whichever lands first defines it.
- Returning villagers are `npcs.json` entries with `"arrives": { "place": "weir", "house": "marls" }`: not drawn or
  counted until the morning after both hold.

### 4.5 Ambience and music

- On a `dry` variant the season's piece plays thinned (its accompaniment reduced to bass and one voice; no new
  compositions) over a dry wind bed instead of birdsong; `waking` brings birdsong; `restored` the full arrangement.
- Loops: creek, river, anvil (town mornings), market murmur. One new piece: Lantern Night.

## 5. Villager arcs

**What this plan ships by itself:** `npcs.json` line groups and events gain an optional `when` over stats (`place.<id>`,
`valley.farmGreen`, `placesDone`, `arrived.<family>`). Each villager gets a few `dry`-conditioned lines (wistful, warm,
about their loss) and today's cheerful lines get conditions so they only play after the matching restoration (Mara's
"Business is booming" needs the market). That is Milestone 1, with no dependency on any other plan.

**Later enrichments, from the living-villagers plan** (`agents/PLAN-NPC-LLM.md`, branch `plan/npc-llm`; no runtime
LLM): when its dialogue database (its M1) lands it absorbs these `when` lines as rules, and the valley registers talk
facts (`place.<id>`, `variant.<map>`, `house.<id>`, `arrived.<family>`, `drift.waiting`). Its memory (M2) gains fact
kinds `placeAsked`, `workedAt` (with whom), `placeOpened`, `forged`, `towed`, `grafted`, `seedReturned`, `arrived`,
`marketSold`; its barks (M3) read the map variant ("Quiet again." in a dry town; "Hear that?" from Finn at the river);
its ties (M5) are the families (Mara and Senna sisters, Clay and Dara siblings, Orin and Tobin master and apprentice,
Rosa and Wren aunt and niece); its seasonal arcs (M7) are scheduled by place stats. Nothing in the Dry Year waits for
them.

### 5.1 The five who stayed

**Rosa** (voice: practical, kind, talks to plants). *Loss:* her grandmother's orchard, and Ilse, her friend, who died
two winters ago. *Wish:* blossom in the clearing. *Beats:* day 1 greeter (unchanged); the first-green letter with
Ilse's tin and journal; 2 hearts "Know your soil" (rewritten as Ilse's lesson); the spring's opening ("I'd forgotten
that sound."); 3 hearts letter; 4 hearts "Grandmother's orchard" (walks you to the stumps); the orchard's opening; 5
hearts **"Blossom"** (replaces "Harvest thanks": under the bucket tree in spring, Ilse's last page about Lantern Night).

**Mara** (voice: bright, a little too brave). *Loss:* the market, and her sister Senna, who left with the mill.
*Wish:* a Saturday market. *Beats:* 2 hearts "The back shelf" (kept: "I kept the best seeds for whoever came"); 4 hearts
**"The ledger"** (rewritten: every family that left, none crossed out); Senna's homecoming after the Weir; the market's
ask and opening (she rings the old market bell, and crosses out nothing: she writes "back" beside the Marls); 5 hearts
"Best customer" (kept).

**Finn** (voice: quiet, dry humour). *Loss:* the river, and his father's boat stranded on the mud: the *Heron* is the
last thing his father made. *Wish:* to float her. *Beats:* 2 hearts "The quiet lake" (kept); the weir's ask; 4 hearts
**"The Heron"** (replaces "A secret spot": the hull he scrapes, his father's initials); the opening (Finn in the boat as
the water lifts her); after Dara is home he takes Pip and Lu out on the *Heron* (a scene); 5 hearts "The golden salmon"
(kept, now in the river).

**Orin** (voice: few words, every one about metal). *Loss:* the forge's fire and his apprentice Tobin. *Wish:* to
hear the anvil ring. *Beats:* 2 hearts "The forge" (rewritten: "Heat, hammer, patience. I've had only the patience
lately."); the forge's opening (your first strike together); 4 hearts "Tools that last" (kept); 5 hearts "Almost an
apprentice" (kept: now Tobin's letter follows, "Heard the forge is lit.").

**Clay** (voice: short sentences, proud, funny when he forgets to be prickly). *Loss:* his sister Dara and her children,
who left in year three; and that he kept the town fed alone and nobody noticed. He thinks newcomers leave ("You'll last
till the first dry summer."). *Wish:* that the Holt farm and the Seed House outlive him. *Rival to ally, earned by what
you do:*

1. *Day 7 letter* (new voice, same rules): "I've fed this town alone for seven years. The board's first come, first
   served. Don't take it personally when I win."
2. *Year 1 board race* (rules and balance unchanged).
3. *The spring opens:* next morning a sack of fertilizer at your gate and a letter with no name (revealed in step 6).
4. *2 hearts "A friendly bet"* (kept); `rivalLate`.
5. *The weir opens:* his fields get the river too. "Didn't ask for help." (`rivalLate` turns on here if he is below 2
   hearts).
6. *"The other half"* (new, fall): his tin beside yours; Bram and Ilse; "The compost was me." The Seed House's ask.
7. *Seed House work days:* he works beside you. Opening: "Grandad would've liked you. Don't tell anyone I said that."
8. *Winter Feast, year 1:* he does not enter; he judges your basket out loud, and it is a compliment.
9. *4 hearts "Clay's secret"* (kept, Speed-Gro); `rivalPolite`.
10. *Dara comes home* (the Holt wing rebuilt with your timber): "She's back. ...Thanks."
11. *5 hearts "Partners"* (kept, now also needs the Seed House): `rivalOff`; his crates become a market stall.
12. *Lantern Night:* the Holt lantern's shade is Wend seed paper from the library he helped reopen.

### 5.2 Families who come home

Each is one `npcs.json` villager (one sheet) and a house rebuilt with timber; an arrival letter comes when the house is
half done. v1: lines, loves and a stall; heart events are v2. Each carries a loss of their own that coming home mends:

- **Senna Marl:** the mill her family ran for three generations, its wheel rusting in a dry race. Home, she hears it turn.
- **Dara Holt:** her children growing up with no ground of their own, and the brother she left. Home, Pip and Lu get the
  Holt fields, and Dara gets Clay back.
- **Wren Ashby:** her hives, sold when there was no blossom left to feed them. Home, the orchard lets her keep bees again.
- **Tobin Reyes:** the forge he trained at and the master he walked out on. Home, he works beside Orin again.

| Family | Needs | Who you meet | House (timber) | Stall | Ties |
| ------ | ----- | ------------ | -------------- | ----- | ---- |
| The Marls (millers) | Weir | Senna Marl (Ivo is at the mill) | North-east house, 14,3 (6) | Flour and bread (flour, a new cooking good) | Mara's sister |
| Dara Holt, Pip and Lu | Seed House | Dara (the children: a two-frame decor sprite) | The Holt farm's east wing, off-map (5) | Eggs and cheese | Clay's sister |
| Wren Ashby (beekeeper) | Orchard, spring 1 after | Wren | The orchard cottage, woods (5) | Honey; buys flowers | Rosa's niece |
| Tobin Reyes (cartwright) | Market + 7 days | Tobin | Rooms above the forge (4) | Tool repairs; cheaper bars | Orin's apprentice |

## 6. Pacing

| When | Valley | Goal chain (today) | Festival |
| ---- | ------ | ------------------ | -------- |
| Y1 spring 1-2 | Guided start on a dry farm; day 2 rain (unchanged) | gift ... sleep, buy | |
| Y1 spring 3 | Unchanged (waterDaily, settling-in jobs) | job1, harvest | |
| Y1 spring 5-7 | **First green** the morning after 5 shipped (day 5 at the earliest, after the settling-in days): the farm turns green, Rosa's letter with the tin and journal, the spring's ask | ship, fish, craft | |
| Y1 spring 8-20 | Old Spring funded and worked; **channels** | place, preserve, order; Clay from day 8 | Flower Show (14): three tables, Rosa's idea |
| Y1 summer 1-12 | Forge; **strike in time**; deadwood and charcoal | quality, chicken, eggs | |
| Y1 summer 13-fall 5 | Weir; the river returns; **towing** | tree, friend, earn1k, upgrade | Fishing Derby (22): at the woods lake if the weir is not done ("Finn's lake derby"), else on the river |
| Y1 fall | Marls' house rebuilt, the Marls home; "The other half"; Seed House; **seed library** (pumpkin and yam strains usable at once) | bag, earn5k, land | Harvest Fair (16) |
| Y1 winter | Orchard asked, worked; **grafting** (dormant wood); Holt wing rebuilt, Dara home (winter or Y2 spring 1) | project1 ... | Winter Feast (24): Clay judges your basket |
| Y1 winter 28 | Year-end screen: the place phrases so far, a line from Rosa | | |
| Y2 spring | The orchard blossoms on day 1; Wren home; Market asked and worked; **market day** from about day 15; the first **High Water** notch | | Flower Show, dressed by the families |
| Y2 summer | Tobin home; Trade Road; Clay's "Partners"; Finn takes Pip and Lu out on the *Heron*; houses finished | | Fishing Derby on the river, Dara's children cheering |
| Y2 fall | Rosa's fall 20 letter; **Lantern Night finale on fall 27** | | Harvest Fair |
| Y3 onward | Free play: market weekly, Lantern Night each fall 27, High Water each spring, the Founders' Stone, v2s | | |

- **Festivals come back** by looking different, not by gating: a `dry` town's festival is three tables; each restored
  place and family adds a stall, bunting or crowd sprites. Rules, rivals and prizes unchanged. The Derby's
  `stocked.maps` is `["woods"]` before the weir (a `dryMaps` field) and `["town"]` after.
- **Legendary fish:** the glimmer trout and the ice pike need the river; the legends letter says "once the river is
  back". Both are `aside` goals, so nothing waits on them.
- **A slow player** is never stuck: the forge asks on summer 1 regardless; the weir asks on summer 15 without the forge;
  the market asks as soon as three places are open; nothing expires; Lantern Night simply waits for a later fall.
- **A fast player** cannot rush people: asks need hearts.

### A player who stops after year 1

Winter 28 of year 1 is a resting point: the year-end screen leads with the place phrases you have earned ("The creek
runs. The forge rings. The river is home.") and Rosa's line ("Not bad for a first year. The Wend's breathing again."),
then the existing rows. By then a typical player has mended four places, met one returning family, and seen Clay judge
their Winter Feast basket kindly: a complete small arc.

### High Water (the yearly ritual and the year-3 checkpoint)

**Event-driven, not dated.** Once the weir is restored, the first spring morning after a rain day each year, the river
runs high. That morning Finn and Clay are at the old stone on the riverbank where the founders marked the water. You
cut a notch at the line the water reached (Interact). It records one thing: **how high the water came** (from the
spring, the weir and the warm pool's v2), shown as the notch's height on the stone's sprite. No sheet, no categories, no
score. Finn says one line about the river; Clay says one about last year.

**The checkpoint** (the owner's year-3 ask) is the **second notch, whichever year it falls in** (year 3 for a typical
player, later if the weir opened late): the first time two notches stand side by side on the stone, so you see at a glance how far the river, and with it the valley, has come since last spring. Clay's
line compares them ("Higher. Don't get smug."). There is no letter and no list of what is done or missing: Rosa's
fall 20 letter already says each year what Lantern Night still waits for. Until the weir is open the stone
stays dry and Finn says "One day."

## 7. The opening

The guided start stays as tuned. The letter adds no step and day 3 gets nothing new.

- **The letter is the title screen.** On a first launch (no save) the title shows Rosa's letter on parchment under the
  logo, with New game beneath it; reading it costs no time the player was not already spending there. With a save the
  title is unchanged; the letter is in the mailbox, already read.
- **Day 1 is visually dry, mechanically identical.** The farm loads its `dry` variant: same geometry, straw palette,
  dead crowns. The welcome strip reads "You came! I'm Rosa. The farm's yours." (37 characters, shorter than today's
  41). Rosa's three ripe parsnips are the only green thing on the farm.
- **Day 2 is unchanged:** the rain (Rosa's rainy line becomes "Rain! The valley drinks it all by noon."), the mail
  step (Mara's welcome letter reworded, seeds unchanged), the jobs, the walk to town.
- **Day 3 is unchanged.**
- **First green** (the morning after 5 shipped, day 5 at the earliest so it never shares a morning with the settling-in
  jobs of days 3-4; usually day 5-7): the farm wakes; the morning note
  "The farm looks greener this morning."; Rosa's letter "First green this valley's seen in years. Ilse said the soil
  remembers. She left this for whoever came." brings **Ilse's seed tin** (narrative: it opens at the Seed House) and
  **the journal** (it opens Menu > Goal's THE VALLEY section at page 1: the spring). One beat gives the green its cause
  and starts the valley.

## 8. Keep, rename, reframe, cut

| Today | Decision |
| ----- | -------- |
| Board Canopy project (1,200g) | **Keep, reframed:** "A roof over the board, so the notices stop fading." The town's first act of faith, cheap and early. |
| Town Library project | **Reframe as the Schoolhouse:** opens after Dara is home (children again), same cost and perk (`xpBonus`). |
| Greenhouse project | **Keep** (it is your farm); its `after` moves from the library to the canopy so the Schoolhouse's later gate does not delay it. |
| Fair Hall project | **Keep, re-gated:** after the market (the festivals come back properly). |
| Market Road project | **Rename to Trade Road**, after Tobin arrives; same cost and perk. |
| Founder's Statue ("a statue of you") | **Reframe as the Founders' Stone:** the toppled stone of Ilse and Bram in the square, visible and broken from day 1. Level 1 raises it; levels 2-6 carve the returned families' names, then yours. Costs and perks unchanged. |
| Fish Ladder project | **Fold** into the Weir: off the board, onto the weir's site sheet after the opening (same cost and perk). |
| Seed Exchange project | **Cut**, superseded by the Seed House; the four rare seeds move to its shelf; the cart keeps selling them. |
| Hot Spring project | **Fold** into the Old Spring: the warm pool on the spring's site sheet after the opening (same cost and perk). |
| Projects goals (25 project1, 41 project3, 45 projectAll "all 8") | **Keep stats:** restorations also count in `projectsDone`; texts become "Mend a place or fund a project", "...3...", "Finish 8 projects or restorations" (6 places + 5 board projects + 2 site upgrades remain). |
| Old saves with a cut project done | Its row stays in `projects.json` as `"retired": true`: hidden from the board, its perk and landmark kept for that save. |
| Clay's board race, crates and perks | **Keep** rules and balance; new letter and lines; perks re-gated per 5.1. |
| Thriving-town lines (Mara's "Business is booming", "Best customer in the valley"; Rosa's "The whole valley is talking about it") | **Condition** on the matching restoration (section 5). |
| Rosa's "Harvest thanks", Finn's "A secret spot", Mara's ledger event | **Rewrite** as "Blossom", "The Heron", "The ledger" (rewards kept). |
| Goal names "Tiny Tycoon", "Master Farmer" | **Rename** to valley titles ("Keeper of the Wend"); stats unchanged. |
| Year-end screen | **Extend** with the place phrases and Rosa's line; "The river remembers. See you in spring." replaces "A new spring awaits." |
| Festivals | **Keep** rules; dressed by variant and families; the Derby's venue follows the river; Lantern Night after the finale. |
| Legends letter | **Edit** the town river lines. |
| Rowing, a Lantern Hill map, a Narrows map, an Orchard map, a Seed House interior (draft 1) | **Cut** in this revision: one new map (Wendhead) instead of five. |

## 9. Systems impact

### 9.1 Save and state

| Change | State | Version |
| ------ | ----- | ------- |
| Places, work days, first green, houses, families, drift, drawers, High Water | stats only | none |
| Letters, journal pages | mail and stats | none |
| Channels, seed tags, strike offset | `SoilTile.channel?`, `CropState.tag?`, `CropState.ripeFor?`, `settings.strikeOffset?` | **one bump** (18, or 19 if the villagers plan's memory lands first), added together in M4 even though tags and the offset are used later |
| Market stall stock | `data` of a placed, unmovable stall object | none |
| Grafted trees | placed `fruitTree` objects with `data.roots` | none |
| Goals | none inserted (THE VALLEY is its own section); texts edited, stats unchanged | none |

Old saves: `sanitize` sets `valley.farmGreen` = 1 when `shipped` is at least 5, so nobody returns to a dry farm they
have already greened; every place starts at 0 and asks by the usual conditions.

### 9.2 Economy guard rails

- Restoration gold: year-1 places at most 10,000g in all; all six at most 14,000g (the remaining projects are about
  110k). Parts cost bars and charcoal; timber is a material, sold at 5g.
- Channels: watered tiles at most 2 x `flow` (48, then 128); a test keeps a channel field under the value of the same
  tiles under quality sprinklers.
- Forge parts are not sellable; quality only shortens work or nudges a cap.
- Towing: at most 2 logs a day (one in winter), 30 timber needed in all; timber's sale value bounded under 20g a day.
- Seed library: generations change only watering (never price, quality or yield), so income per tile-day is the plain
  crop's; a test checks a generation-3 field earns the same as a watered plain field.
- Grafting: root traits keep per tile-day fruit income under melon and pumpkin; long adds one season at most.
- Project re-gates (the Greenhouse after the canopy, earlier than today; the Schoolhouse's `xpBonus` after Dara, later;
  the rare seeds at the Seed House, later; the Fish Ladder and Hot Spring on site sheets) are part of the
  restore-on-schedule sim run, which must stay within +15% of the median and reports the Greenhouse's first harvest day.
- Market: at most 1.5x bin per item, demand -15% per repeat, six slots; one market day earns at most twice the average
  daily shipping (a sim bot that stocks the stall).
- The pinned sim median does not restore places; a second sim run restores them on schedule and stays within +15%.

### 9.3 Performance and art budgets

- **Draw calls (12):** variants have the same layers; the palette is a texture choice; channels draw in the soil layer;
  sites, houses, stalls, logs and visitors are atlas frames; the tow rope is one graphics line (measured; at most +1).
  Target: no scenario above 6.
- **JS per frame (3.5 ms):** variant choice at map load; market sales resolve lazily; the flow walk runs once a night;
  the towing controller is one object.
- **Tileset:** today 512x1024 and nearly full. Budget: at most +480 slots (512x1280) for all variants and Wendhead.
  The dry palette adds one texture per season, loaded only while a dry outdoor map is shown.
- **Maps:** one new map and seven new variant files (each 9 to 90 KB), cached at runtime, not precached.
- **Characters:** four villager sheets (20x32, four directions, 4-frame idle), the children decor.
- **Objects:** six site sprites in four stages, four houses with scaffolding stages, stumps and buds, logs, the anvil
  view, stalls and awnings, the river stone with notches, lanterns on water, about 20 item icons.
- **Audio:** four loops, three cues (anvil, bellows, log landing), the thinned-arrangement flag, one piece.

## 10. Originality notes

The owner's premise has a famous neighbour, so the execution differs on purpose:

- The letter is from a neighbour who stayed, read on the title screen; nobody dies on screen; no office job.
- No bundles or donation room. A place is working infrastructure (water, iron, river, seed, roots, trade) asked for
  by one person, paid with a small fund, a part and days of work that preview its verb. The Seed House lends.
- No villain, corporation or magic helpers; the flood was nobody's fault.
- No broken bridge, no community centre, no evaluation at a shrine. The yearly ritual is a notch on a river stone on
  the morning the water runs high: one measurement, no categories. The finale sends lanterns downriver together;
  nothing is counted.
- The rival is a farmer who stayed, turned by restorations he benefits from.
- Names (the Wend, Ilse, Bram, the Heron, the Marls, Wren Ashby, Dara Holt, Tobin Reyes) echo no well-known farm game.

## 11. Open questions (for the owner)

1. The finale is fixed on fall 27 of year 2 at the earliest. Should a year-1-only player get more than the winter 28
   resting point?
2. Day 1 dry (palette only, geometry and timing unchanged), or green around the house with dryness beyond the fence?
3. Is a timing mini-game welcome next to fishing (with calibration and "Easy strike")?
4. Four returning households, one villager each, is the art budget. More as decor-only households?
5. Towing is the Weir's verb; it makes timber the material of homecoming. Is the owner happy for the *Heron* to stay a
   boat you see (Finn's scenes), not one you drive?
