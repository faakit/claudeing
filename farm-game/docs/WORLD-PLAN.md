# The Dry Year: world plan

The full design behind [VISION.md](VISION.md). Build order and acceptance criteria: [MILESTONES.md](MILESTONES.md).
Everything here reuses the registries in [EXTENDING.md](EXTENDING.md); new state is called out in section 9.

Names used throughout: the valley and its river are **the Wend**. **Ilse** kept your farm for forty years (your
grandmother). **Bram Holt** was Clay's grandfather; Ilse and Bram founded the valley's seed house together. Finn's
boat is the **Heron**.

## 0. At a glance

| # | Broken place | Whose loss | Opens (area) | New mechanic | Year / season |
| - | ------------ | ---------- | ------------ | ------------ | ------------- |
| 1 | **The Old Spring** above the farm | Ilse's (the journal); Rosa | Spring Hollow; the farm creek runs | **Channels**: dig a water network that waters crops each morning | Y1 spring |
| 2 | **The Cold Forge** in town | Orin | Orin's forge and anvil | **Strike in time**: a 4-beat rhythm tap that forges the parts other places need | Y1 early summer |
| 3 | **The Weir at the Narrows** | Finn | The river returns to town; the Narrows | **Rowing**: board the *Heron*, row the river, fish and gather from the water | Y1 late summer |
| 4 | **Grandmother's Orchard** on Rosa's hill | Rosa | Orchard Hill | **Grafting**: take cuttings from living trees and bud them onto dead stumps | Y1 fall |
| 5 | **The Seed House** | Clay (and Bram's half of the seed tin) | The Seed House and its drawers | **Seed saving**: tag a crop, let it go to seed, bring varieties home | Y1 winter |
| 6 | **The Market Square** | Mara | Stalls in the square; the trade road | **Market day**: stock a stall, sell to visitors whose wants change | Y2 spring |
| - | **Lantern Hill** (finale, not a mechanic) | everyone | The finale ceremony | (lighting one lantern per household) | Y2 late fall |

Families come home behind four of the places (section 5.2): the Marl millers (Weir), Wren Ashby (Orchard), Dara Holt
and her children (Seed House), Tobin Reyes (Market).

## 1. Valley geography

Today: Farm (30x44) at the top, its south gate to Town (24x34); Town's west road to the Woods (20x30); the Woods'
north cave to the Mine (20x30); the House is the farm's interior. The plan adds four small maps and one interior,
each behind a broken place, and keeps every existing door where it is.

```
                               N (the hills)

                                          SPRING HOLLOW (new, 16x24)
   MINE                                   the Old Spring
    |                                        |  NE gap (29,3)
    | cave       ORCHARD HILL    W gate   +--+-----------------+
    |            (new, 20x28) --(0,20)--- | FARM (30x44)       |     THE NARROWS
    |            Rosa's land              | creek bed: x 26-27 |     (new, 20x26)
    |                                     | down to the pond   |     the weir,
    |                                     +--------+-----------+     upstream pool
    |                                              | south gate          |
  WOODS (20x30) ------- west road -------- TOWN (24x34) ---- east path --+
    |                                      forge, seed house,   (23,19)
    | W edge (0,6)                         market square,
  LANTERN HILL (new, 16x20)                river on the east side,
  opens Y2 fall                            the Heron at the dock
                                                   |
                                           south road: the trade road (Y2)
```

- **Spring Hollow** (from the farm's north-east corner; a gap in the east fence at 29,3): a fern-choked basin, a rockfall
  over the spring's mouth, a dry stream bed leading down to the farm. Open from day 1 (it is where the first broken
  place is); a few forage spots.
- **The farm creek**: a dry bed two tiles wide down the farm's free east strip (x 26-27, y 3-30) into the pond's
  east bank. Today that strip is grass with two trees (moved) and the edge of the weed zone (shrunk to x 3-25); it
  becomes a **delta region** (section 4) in every farm variant, so nothing fixed may sit there.
- **Orchard Hill** (Rosa's land, through a new west gate at 0,20 on the farm): eight dead stumps on terraces, Rosa's
  one living "bucket tree", a cottage that Wren later moves into. Open from Rosa's 4-heart event.
- **The Narrows** (from a new path off town's east edge, 23,19, north of the river): the broken weir, a rock shelf,
  the upstream pool. Reachable on foot once Finn asks for the weir (a fallen log is cleared on the Ask); by boat
  once rowing reaches it (v2).
- **The Seed House** (interior, 10x9, behind town's south-east cottage door at 15,18): drawers, a long table, a
  hole in the roof.
- **Lantern Hill** (from the woods' west edge, 0,6): a bare knoll with a cairn of old lantern posts. Opened by the
  finale letter.
- **Town**: the forge is the south-west building (2,15), Orin stands at its door (9,17 today). The market square is
  the road between the shop and the board (10-13, 10-20). The river is the east side (17,22 and down). Three
  neighbours' houses (14,3), (14,16) and a new lot at (3,27) are boarded until families return.

## 2. How a place is restored (the shared pattern)

Not bundles. Every place goes through the same four steps, all data in `src/data/valley.json`:

1. **Ask.** The person who lost it asks, in a letter or a heart scene, when its `ask` condition holds (hearts, a day,
   another place restored). Until then the site is a sign: "The Old Spring. Choked with rubble." The ask adds the
   place to **THE VALLEY** section at the top of Menu > Goal.
2. **Gather.** A small fund in the existing project sheet (`projects.json` row with `"place": "<id>"`, hidden from
   the board's list, opened from the site's sign): a little gold (300g to 5,000g), one or two basic goods, and,
   from the second place on, **one part forged at Orin's anvil** (place 2's mechanic). The project rules,
   `fund.<id>` stats and +100/+1,000 buttons are reused as they are.
3. **Work days.** Once funded, the site asks for 3 or 4 days of help: one Interact a day at the site, 20 energy and
   one game hour (the farmer swings a tool; the asking villager stands beside you). Each work day changes the
   site's sprite (rubble, cleared, scaffold, finished), so you see it advance on separate days. Missing days costs
   nothing. The HUD goal line shows "Work at the Old Spring (2 of 3)" on a day you have not worked yet, and the
   goal chain otherwise.
4. **Opening.** The morning after the last work day: the place's stat becomes restored, maps change variant
   overnight (section 4), the asking villager waits at the site with three lines, the new mechanic's tool or first
   item is handed over, and its one-off `intro` step in `tutorial.json` teaches it. A journal page and a letter
   follow.

State: stats only (`place.<id>`: 0 untouched, 1 asked, 2 funded, 3 restored; `site.<id>.work` and
`site.<id>.last` for work days), so the pattern needs no save change. Places count in a new stat `placesDone`; the
town projects keep `projectsDone` so goals 25, 41 and 45 keep their meaning.

Sketch (one place):

```json
"spring": {
  "name": "Old Spring", "map": "hollow", "site": [8, 7], "npc": "rosa",
  "ask": { "day": 3 }, "project": "place_spring", "workDays": 3,
  "sprites": ["obj_site_spring_0", "obj_site_spring_1", "obj_site_spring_2", "obj_site_spring_3"],
  "opens": { "item": "spade", "intro": "channels" }, "journal": 1
}
```

Mechanics register as usual (`src/mechanics/<name>.ts`, one import line). A new `systems/valley.ts` holds the place
rules (pure, unit tested) and `mechanics/valley.ts` registers the site interact, the morning opening hook (phase
`start`) and a perk source (some places grant perks the same way projects do).

## 3. The broken places

Every mechanic below has: verbs, the one-thumb input, the five-minute loop, the data model and registries, a v1 that
ships small and a v2 for later. All new tools are deliberate choices like the rod (not auto items) unless noted, so
smart targeting with seeds, can and hoe never changes.

### 3.1 The Old Spring: channels

- **Story.** The spring above Ilse's farm fed a creek down the east side. The flood's rockfall closed its mouth, the
  creek went dry, the dead trees along it are the ones you see from the house. Ilse's journal, page 1: "Where the
  water starts, the farm starts. Clear the stones and it will come back to you."
- **Who cares.** Ilse (through the journal) and Rosa, who carried buckets from the pond for years.
- **Restore.** Ask: day 3 (Rosa's letter brings Ilse's seed tin and journal). Gather: 300g and 20 stone (the mine
  opens day 3). No part (the forge is not lit yet). Work: 3 days (lifting stones). Expected: about day 10 to 18.
- **Opens.** Spring Hollow's pool, the farm creek (water in the bed), and **Ilse's spade**.
- **Mechanic: channels.** You dig narrow channels off the creek; each morning the water runs along every connected
  channel and waters the soil beside it.
  - *Verbs:* dig a channel, fill one back in, (v2) set a gate.
  - *One thumb:* select the spade (tool ring, as the rod). Action on a tile next to the creek or an existing channel
    digs it. The existing paint gesture (hold Action, drag) digs a line or a serpentine, so a field's channel is one
    drag. Action with the spade on a channel tile fills it back. Refusals: "Start next to water."
  - *Rule:* in the `pre-growth` day hook, a breadth-first walk from creek-adjacent channel tiles through
    4-connected channels reaches up to `flow` tiles (spring stage: 24 at opening, 64 once the Weir also raises the
    water table). Every tilled tile 4-adjacent to a reached channel is watered, like a sprinkler's square. Channels
    past the flow are dry and say so ("The water runs out before here.").
  - *The loop:* plan a field around a channel once, then mornings are harvest-and-replant without the can. It
    competes with sprinklers honestly: channels are free but take soil tiles and planning; sprinklers cost bars and
    go anywhere.
  - *Data:* `SoilTile.channel?: true` (new optional field: save version bump, section 9); `valley.json`
    `spring.flow: [24, 64]`; channel tiles are drawn by the soil renderer with animated water when reached.
    Registries: an action handler (`dig-channel`, priority 45) and `registerToolAction('dig')` for the spade, a day
    hook, no new panel.
  - *v1:* dig, fill, flow cap, watering. *v2:* sluice gate placeable (forged hinge) to send the flow down one branch;
    channels on Orchard Hill.
- **Reshaping.** Farm map goes **waking to restored**: the creek bed fills (delta region switches from cracked bed to
  water), the creek's dead trees become stumps you can later graft, frogs at dusk. Spring Hollow: rockfall gone,
  pool full, ferns green. Audio: a creek loop near water on the farm; the farm's evening music gets its accompaniment
  back (section 4.5).
- **Scenarios.** `valley-farm-dry` (day 1 look), `valley-farm-waking`, `spring-site-ask` (hollow, sign),
  `spring-site-work` (funded, work day 2), `spring-opened` (opening morning, Rosa at the site), `channels-first-dig`
  (farm, spade in hand beside the creek, east field tilled), `channels-flow-cap` (60 tiles dug, flow 24).

### 3.2 The Cold Forge: strike in time

- **Story.** Orin's bellows were driven by a wheel on the mill race. When the river left, the wheel stopped; his
  apprentice Tobin went to the city; Orin mends hinges by hand at a bench. "I haven't heard the anvil ring in six
  years."
- **Who cares.** Orin.
- **Restore.** Ask: summer 1, or earlier once the spring is restored and Orin is at 2 hearts. Gather: 1,500g,
  5 copper bars and 10 charcoal. Charcoal is new and cheap: a **charcoal kiln** machine (a `machines.json` row,
  `jar` behaviour: deadwood to charcoal in 1 day); **deadwood** is a forage good that spawns on dry maps (the
  drought's one gift, it thins out as maps heal). Work: 3 days (rebuilding a hand bellows, so the forge no longer
  needs the river). Expected: summer 5 to 12.
- **Opens.** The forge in town (a fixed interactable at its door) and Orin's commissions.
- **Mechanic: strike in time.** Forging is a short rhythm: the hammer rises and falls on a steady beat, and you strike
  as it meets the glowing metal.
  - *Verbs:* load a piece (pick a recipe), strike four times, quench (automatic).
  - *One thumb:* Interact at the anvil opens the forge sheet: the recipe list, then the anvil view. A single wide
    **Strike** button sits low on the sheet where the thumb rests (like "Present the basket"). A metronome hammer and
    a shrinking glow ring show each beat at 84 to 96 bpm; press on the beat. Timing is read from the press's own
    timestamp, Great within 90 ms, Good within 180 ms, otherwise Plain. Four strikes, about 6 seconds.
  - *No failure:* a Plain strike is still a strike. The piece's quality is the strikes' average (tier 0 to 2, the
    item quality system). Higher quality parts shorten a place's work days by one (gold) or give a small bonus in the
    mechanic they belong to (a gold sluice gate lets 4 more channel tiles flow).
  - *How it differs from fishing:* fishing is reacting to a random bite, then holding a bar. Forging is anticipating
    a steady, visible beat with discrete taps; nothing escapes.
  - *Accessibility:* Calm mode stills the ring (a static mark and a tick on each beat); an "Easy strike" option in
    Opts makes every strike Good.
  - *Products (v1):* the **parts** for later places: sluice gate (Weir), grafting knife (Orchard), stall frames
    (Market), lantern frames (finale); plus the iron hinge for v2 channel gates. Each needs bars and charcoal.
  - *Data:* `recipes.json` rows with `"station": "forge"` and `"beats": 4`; a `forge` section in `valley.json`
    (`bpm`, windows). Registries: a fixed interactable (like the mailbox) whose `interact` returns a panel;
    `ui/panels/ForgePanel.ts`; pure timing rules in `systems/forge.ts` (score from press times, unit tested).
  - *v1:* parts only. *v2:* tool tempers (one of two per tool, e.g. the can's Wide spout or Deep tank), forge level 2
    once the river returns (Orin's water wheel: 5 beats, a faster tempo, a better chance of gold).
- **Reshaping.** Town: smoke from the forge chimney, an orange glow in its window at night (a `lights` point), the
  anvil ring heard on the town map when Orin works (morning hours). The forge's boarded shutters come down (object
  sprite by place stat, not a map variant).
- **Scenarios.** `forge-cold` (town, the bench), `forge-work` (funded, work day 3), `forge-first-strike` (forge sheet
  open, bars and charcoal in the bag), `forge-calm` (Calm mode on), `kiln-deadwood` (farm, kiln ready).

### 3.3 The Weir at the Narrows: rowing

- **Story.** Upstream at the Narrows, a stone weir split the Wend: most of it into the valley, the rest east. The
  flood broke the weir and buried the valley side under the rockfall, so the whole river went east. Finn's *Heron*
  has sat on the mud by the town dock ever since; he scrapes her hull every spring anyway.
- **Who cares.** Finn.
- **Restore.** Ask: after the forge is lit and Finn is at 2 hearts (his letter: "I walked up to the Narrows today.
  It's only stones, you know. Stones can be moved."). Gather: 2,500g, 60 stone and a forged **sluice gate**. Work: 4
  days at the Narrows (Finn and Orin beside you on the last day). Expected: summer 15 to fall 5. If it is done by
  summer 21 the Fishing Derby is held on the river (section 6).
- **Opens.** The river comes back to town overnight, the *Heron* floats, the Narrows' pool, and rowing.
- **Mechanic: rowing.** You can take the *Heron* out on the river: a second way to move, on water.
  - *Verbs:* board, row, land; cast from the boat; pick things out of the water.
  - *One thumb:* Interact at a landing boards (the farmer sits in the boat). Movement is exactly the walking controls
    (stick, or tap a water tile to row there by the same path search over water). Interact at another landing (or
    the one you left) gets out. The rod works from the boat on any adjacent water, including **deep spots** only the
    boat reaches. Floating finds (driftwood, a lost bottle, reeds) bob on the water; Action beside one picks it up
    (forage rules, priority 95).
  - *Feel:* rowing is 0.8x walking speed with a gentle downstream drift when you stop (about 0.3 tiles a second,
    held at banks), so the river feels like a river. The feel agent owns the easing.
  - *The loop:* row out to the deep spots for a better catch, pick up 2 to 4 floating finds a day, reach Reed Island's
    forage. A five-minute river trip.
  - *Data:* a movement mode `boat` in the movement system (water passable, land solid, landings are Tiled objects
    `landing`); deep spots are `fishzone` objects with a weight table override in `fish.json` (`"zone": "deep"`);
    floating finds are a forage zone type `flotsam` on water tiles. On save or map change you are put ashore at the
    last landing, so the boat needs no saved state (`stat` `boat.trips` for jobs and goals). Fish rows gain an
    optional `"place": "weir"` so trout, salmon, the glimmer trout and the ice pike bite in town only once the river
    is back (section 6 covers the legends).
  - *v1:* the town river only (the restored town variant widens it into a channel down the whole east side with
    Reed Island in the middle), boarding at the dock, deep spots, flotsam. *v2:* row upstream to the Narrows' pool
    (a boat-only door), the mill landing.
- **Reshaping.** Town goes **dry to river**: the delta region of cracked mud becomes water, reeds and lily pads, the
  *Heron* afloat at the dock, the town palette turns from straw to green, a river ambience loop replaces the dry
  wind, the town piece regains its full arrangement. Woods: the lake shore rises (decals only, the water geometry
  is unchanged). Seven days later the **Marl family** returns and the mill wheel turns.
- **Scenarios.** `narrows-broken`, `weir-work` (funded, day 4, Finn and Orin present), `weir-opened-town` (the
  morning after: river full, Finn in the boat), `boat-board` (at the dock), `boat-deep-spot` (in the boat beside a
  deep spot, rod in hand), `boat-flotsam`, `derby-river` (summer 22 with the weir done), `derby-lake` (without).

### 3.4 Grandmother's Orchard: grafting

- **Story.** Rosa's grandmother planted the hill orchard; without the spring it died standing, all but one cherry
  tree Rosa kept alive by bucket (her "bucket tree"). The trunks are dead, but old roots under them are not.
- **Who cares.** Rosa.
- **Restore.** Ask: Rosa at 3 hearts and the spring restored. Her 4-heart scene, "Grandmother's orchard" (it exists
  today), now walks you up the hill. Gather: 2,000g, 30 fiber and a forged **grafting knife**. Work: 3 days (a flume
  from the hollow's pool and terraces mended). Expected: fall 3 to 15.
- **Opens.** Orchard Hill, its eight old stumps, and grafting anywhere.
- **Mechanic: grafting.** Take a cutting from a living fruit tree and bud it onto a dead stump; the old roots wake and
  grow the tree you grafted, at once full-sized.
  - *Verbs:* take a cutting, graft, (read a stump).
  - *One thumb:* with the knife selected, Action on a grown fruit tree takes a **cutting** of it (once per tree per
    season; `cherry cutting` is an item stack with `of: "cherry"` like jam). With a cutting selected, Action on a
    stump grafts it. Interact on a stump reads its roots ("Old pear roots. Sweet ground.").
  - *Roots are the choice:* every old stump has a rootstock (Tiled property) that adds one trait to whatever you graft:
    **sweet** (quality one step better more often), **hardy** (fruits one extra season), **heavy** (two fruit some
    mornings), **early** (fruits from the season's first day). Eight stumps, four fruits, four roots: which cutting goes
    where is the puzzle, and you can only learn a stump's roots by reading it.
  - *Growth:* a grafted stump shows buds for 7 days, then is a mature tree of that fruit (the `fruitTree` behaviour
    reused: a placeable created on the stump's tile with `data.roots`, never movable).
  - *Where:* the hill's eight stumps, and the dead trees on the farm's creek once the spring is restored (three
    stumps; this is the must-have "dead trees bud").
  - *Data:* `stump` Tiled objects with `roots`; `trees.json` gains `roots` modifiers; the knife is a tool with
    `registerToolAction('cut')`; grafting is an action handler (priority 55). Placed trees already save per map, so
    the only new state is a stat per graft.
  - *v1:* cuttings, eight hill stumps plus three farm stumps, four root traits. *v2:* graft a second cutting onto a
    grown grafted tree for a two-fruit tree; wild stumps in the woods.
- **Reshaping.** Orchard Hill goes **dead to blossom**: stumps bud one by one as you graft (per object, immediately
  visible), and when four are grafted the map variant changes (grass green, the flume full, petals drifting in
  spring). The farm's creek stumps bud. Next spring **Wren Ashby** (Rosa's niece, a beekeeper) moves into the hill
  cottage because the blossom will feed her bees.
- **Scenarios.** `orchard-dead` (hill, Rosa's 4-heart scene ready), `orchard-work`, `graft-first` (knife and a cherry
  cutting, beside a stump), `graft-roots` (all eight stumps read), `orchard-blossom` (spring, six grafted),
  `farm-creek-stumps`.

### 3.5 The Seed House: seed saving

- **Story.** Ilse and Bram Holt founded the Seed House: every farm saved seed from its best plants and stored it in
  the drawers, so the valley grew crops bred for its own ground. The roof fell in the year after the flood. Ilse kept
  half of the founding seeds in her tin; Bram's half went to his grandson, Clay, who has never told anyone.
- **Who cares.** Clay.
- **Restore.** Ask: Clay's new heart scene **"The other half"** (3 hearts and two places restored, or 2 hearts and a
  season won against him on the board): he opens his tin beside yours. Gather: 4,000g, 5 cloth, 3 iron bars. Work: 3
  days, **with Clay**: the first time he works beside you. Expected: winter 1 to 15, year 1.
- **Opens.** The Seed House drawers, the seed tag, heirloom seeds.
- **Mechanic: seed saving.** Instead of harvesting a crop, let it go to seed, and keep the seed.
  - *Verbs:* tag a crop, collect seed, return a variety.
  - *One thumb:* select the **seed tag** (a deliberate item, 10 of them from Clay) and Action on a growing or ripe
    crop to tie a ribbon on it. Smart targeting never harvests a tagged crop ("Tagged for seed: 2 more days."). Three
    days after ripe it bolts (a seed-head stage sprite); Action harvests 2 to 4 **heirloom seeds** of that crop and
    the tag comes back. In the Seed House, Interact at the drawers gives 5 heirloom seeds of a crop to fill its
    drawer.
  - *Heirloom crops:* planting an heirloom seed grows the Wend strain of that crop: a better chance of quality (one
    step, 25%) and **hardy** (it survives the first 3 days of the next season instead of withering). Shown with a
    small ribbon on the seed icon.
  - *The loop:* each season, give up a few plants of a crop you grow anyway to bank its strain; filled drawers are a
    collection (nine base crops, then the four rare crops). Each filled drawer gives Clay a heart point and lets
    Mara and Clay's stall sell that heirloom seed.
  - *How it differs from grafting:* grafting changes the world (dead objects to trees) by combining two things you
    find. Seed saving is patience and restraint in your own field over weeks: you choose not to harvest.
  - *Data:* `CropState.tag?: true` and `CropState.ripeFor?: number` (save bump), `crops.json`
    `heirloom: { seed, bolt: 3, yield: [2, 4] }`, heirloom seed items, a drawer page in `collections.json` style.
    Registries: an action handler for the tag (priority 60), the harvest handler checks the tag, a day hook ages
    ripe tagged crops.
  - *v1:* tag, bolt, heirloom seeds, nine drawers. *v2:* crossing (two tagged heirlooms of different crops that bolt
    side by side give a seed with both traits), drawers for the rare crops.
- **Reshaping.** Town: the Seed House roof mended, its lamp lit at night. Clay's lines and schedule change: he
  starts standing at the Seed House in the morning instead of the board. The season after it opens, **Dara Holt**
  (Clay's sister) comes home with her two children, Pip and Lu, to the boarded cottage at 3,27.
- **Scenarios.** `seedhouse-ruin`, `clay-other-half` (the heart scene ready), `seedhouse-work` (Clay working),
  `seed-tag-first` (tag in hand, ripe parsnips), `seed-bolted` (a tagged crop bolted), `seed-drawers` (Seed House,
  heirloom seeds in the bag).

### 3.6 The Market Square: market day

- **Story.** Saturday market was the valley's heartbeat: farm stalls, the Marls' bread, traders over the hills. When
  the traders stopped coming, Mara kept the store lit and the empty stall frames stood in the square. Her ledger
  still lists every family that left, none crossed out.
- **Who cares.** Mara.
- **Restore.** Ask: Mara, once three places are restored (year 2 spring at the latest). Gather: 5,000g, 5 cloth and
  three forged **stall frames**. Work: 3 days (raising awnings; returned families help). Expected: spring 5 to 20,
  year 2.
- **Opens.** Market day every week and your own stall; the families' stalls fill in as they return.
- **Mechanic: market day.** Once a week you stock a stall; visitors come by during the day and buy what they want,
  and what they want changes with the season and with what has already sold.
  - *Verbs:* stock, (chat to a buyer), collect.
  - *One thumb:* on market day (days 6, 13, 20 and 27; no festival falls on them), Interact at your stall opens a
    6-slot sheet: tap a bag item, then a slot (or "Fill" puts your six most wanted goods in). Then walk away or stay.
    From 9 AM to 3 PM visitors walk past with a want bubble (an icon: fruit, fish, flowers, something sweet, an egg)
    and buy from your stall if it has what they want. Tapping a visitor at your stall chats (one heart point, and
    that sale is 10% better). At 3 PM what is left is paid at bin price or goes back to the bag (an Opts choice):
    nothing is wasted.
  - *Demand:* each visitor wants one family or type; a good's price is its bin value x (1 + demand), demand starting
    at up to +50% for wanted goods and dropping 15% for each of the same item sold that day. So six different goods
    beat six of the same, and the board's flat requests and the bin's flat price stay different games.
  - *Visitors:* the villagers, then each returning family, then day traders (generic sprites) once the trade road
    opens. Each has `wants` by season, read from data.
  - *Data:* `market.json` (`days`, `slots`, `open`/`close`, `demand: { max: 0.5, step: 0.15 }`, `visitors`), state
    `market: { day, stall: (ItemStack|null)[], sold: string[] }` (save bump). Registries: a fixed interactable stall,
    a day hook that resolves sales lazily (like Clay's board turn, `applyMarket` when the stall or square is next
    seen, so it is exact in tests), `ui/panels/StallPanel.ts`.
  - *v1:* one stall, six slots, villagers and families as buyers, demand. *v2:* a second row of slots (Tobin builds it),
    a market day festival twice a year, special buyers with one-off wants.
- **Reshaping.** Town goes **river to market**: awnings and bunting over the square, the empty frames become stalls
  (one more per returned family), a crowd murmur and the town piece's market-day variation. Seven days after it
  opens **Tobin Reyes** (Orin's old apprentice, now a cartwright) arrives by the south road, and the Market Road
  project becomes his **Trade Road**.
- **Scenarios.** `market-empty` (square, frames), `market-work`, `market-day-stock` (market morning, a full bag),
  `market-day-buyers` (11 AM, visitors with wants), `market-day-close` (3 PM).

### 3.7 Lantern Hill: the finale (no mechanic)

When all six places are restored, Rosa writes: "Ilse's last page says the valley used to climb Lantern Hill when
the harvest was in, one lantern for every house. I counted. We have enough houses again." The hill opens. On the
next evening that is not a festival (7 PM to midnight), everyone is on the hill: one line each from Rosa, Mara,
Finn, Orin and Clay, then the lanterns light one household at a time, each named ("The Marls", "Wren", "Dara, Pip
and Lu", "Tobin", ... "Ilse's farm"). The last is yours: Interact at the cairn. A sheet follows, **"The Wend is
remembered"**: the six places and who is home, and "Keep playing". Lanterns stay lit on the hill every night after,
and "Lantern Night" becomes a yearly gathering on fall 27 (a festival row with no contest).

Scenarios: `finale-ready` (all six restored, the letter read), `finale-hill` (7 PM on the hill), `after-finale`
(free play, year 3 spring 1).

### 3.8 Ideas considered and not chosen

- A windmill with milling and baking: another processing machine (a jar row with art); the Marls' mill is flavour
  instead.
- A beehive meadow: the bee house already exists; Wren's return deepens it instead.
- An heirloom seed vault as a donation room: too close to bundles; the Seed House asks you to grow, not to hand in.
- Export orders on a trade road: too close to the board; the market's demand is the new part.
- A broken bridge: deliberately avoided (originality).

## 4. Map stages

### 4.1 The model

Each outdoor map has two to four **variants**. Which one loads is a pure function of place stats, chosen at a map
load. The current maps become the final variants and keep their file names, so every existing fixture and test
reference keeps working.

| Map | Variants (first to last) | Driven by |
| --- | ------------------------ | --------- |
| farm | `dry` (straw palette, dead creek trees), `waking` (green), `restored` (creek runs, stumps) | first week shipped; spring |
| hollow (new) | `dry`, `restored` | spring |
| town | `dry` (straw, river a two-tile trickle in cracked mud, boarded houses), `river`, `market` | weir; market |
| woods | `dry` (straw edges, low shore decals), `restored` | spring (the deep springs wake) |
| orchard (new) | `dead`, `blossom` | 4 grafts |
| narrows (new) | `broken`, `restored` | weir |
| mine, house, seedhouse, lanternhill | one each | - |

Smaller changes that do not move geometry are **objects keyed by stats**, not variants: site sprites by work day,
boarded or lit houses by family, the forge's smoke, the *Heron* afloat, stalls per family. They reuse the landmark
path (`landmarksOn` in `systems/projects.ts` gains a `when` condition).

Data (`valley.json`):

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

`maps.json` keeps one entry per map; the scene asks `systems/valley.ts mapVariant(state, map)` for the file
(`assets/maps/farm@dry.tmj`, `farm@waking.tmj`, `farm.tmj`) and the palette. `mapCache.ts` keys by file.

### 4.2 Gameplay rules (explicit, tested)

1. **Delta regions.** Each map declares rectangles where tiles may differ between variants (`delta` Tiled objects,
   written in every variant). Outside them, ground and collision are identical in every variant (a test).
2. **Nothing fixed in a delta region:** no door, door spawn, wake or start tile, villager schedule spot, landmark,
   trophy, mailbox, plot, plot sign, bin, board or shop, in any variant. Placing a placeable there is refused ("The
   old creek bed. Best left clear."). Forage zones may overlap a delta region only on tiles walkable in every
   variant, or are variant-specific (the mud flats' zone exists only in town `dry`).
3. **Every variant passes the existing map tests** (walkable spawns, connectivity, every spot reachable), run per
   variant.
4. **Swaps happen off-screen.** A variant is chosen when a map loads. The morning always starts in the house (`wake`),
   so a change made overnight is seen when you step outside. If a load ever puts the player on a tile that is solid
   in the new variant (only possible from a scenario), they are moved to the nearest door spawn.
5. **Doors never move.** Variants share door objects and ids; new exits (the hollow gap, the west gate, the east path)
   exist in all variants of a map, closed by a solid prop in the early variants only if the area is not open yet
   (the prop's tile is in a delta region).
6. **Scenarios pin variants** with a new semantic key `valley` (`{ "spring": 3, "weir": 0 }` sets place stats), and
   `tests/dev-scenarios.test.ts` loads each in the variant it pins. A scenario tile in a delta region must pin the
   variant.
7. **Water tiles define fishing.** A variant's water is where you can fish; fish rows with `place` add species once
   the place is restored.

### 4.3 The map generator and art layers

- `scripts/generate-maps.mjs`: each map block becomes `function town(v)` taking the variant name, and a `VARIANTS`
  table lists them. The function draws the final layout and applies the variant's differences inside the declared
  delta rects (mud for water, a log across the east path, stall frames instead of stalls). `flush()` writes one
  `.tmj` per variant; `map-art.mjs` bakes each variant (shores meander around the trickle as they do round ponds).
- `art-src/map-tiles.json` collects the baked tiles for all variants; identical tiles share a slot as now.
- New tiles: cracked mud (with its edge transitions), a dry stream bed, a dead crown (bare branches), a budding
  stump, a rockfall, reeds and lily pads (exist for ponds), stall frames and awnings, a weir in two states. Each gets
  its season swaps through `seasons.py` automatically.
- **The dry palette** is a palette swap like the seasons (`seasons.py` gains a `dry` remap: grass and foliage ramps
  to straw and grey-green, water untouched), producing `tiles_dry.png` and `tiles_<season>_dry.png`. It is loaded
  lazily, only while the current outdoor map's variant asks for `palette: "dry"`, and dropped once no outdoor map is
  dry. `tilesetFor()` in `src/art/mapLayers.ts` takes the palette as well as the season.

### 4.4 NPCs and objects per stage

- `npcs.json` schedule rows gain an optional `when` (Finn's afternoon spot is the dock once the weir is back; Clay
  stands at the Seed House after it opens). This is the same `when` the living-villagers plan's M6 adds; whichever
  lands first defines it, with place conditions as talk facts.
- Returning villagers are ordinary `npcs.json` entries with `"arrives": { "place": "weir", "days": 7 }`: not drawn and
  not counted anywhere until then. Their house's boarded sprite becomes a lit one the same morning.

### 4.5 Ambience and music

- The audio director reads the current variant: on a `dry` variant the season's piece plays thinned (the accompaniment
  pattern dropped to its bass and one voice; no new compositions), with a dry wind bed instead of birdsong. `waking`
  brings birdsong back; `restored` and later the full arrangement.
- New loops: creek (farm restored), river (town river and later), anvil ring (town mornings once the forge is lit),
  market crowd murmur (market days). One new piece for the finale and Lantern Night.

## 5. Villager arcs

Each arc names the loss, the wish, the heart beats (today's events kept where they fit, rewritten where they do not)
and the place it ties to.

**Built on the living-villagers plan** (`agents/PLAN-NPC-LLM.md` on branch `plan/npc-llm`: a rule-based dialogue
database, villager memory, barks, ties; no runtime LLM). The arcs here are content for those systems, not a parallel
dialogue system:

- **Tone by stage is talk rules, not a new line tier.** Its M1 (`dialogue.json`, `systems/dialogue.ts`) matches rules
  on `when` conditions; the valley registers talk facts with `registerTalkFact`: `place.<id>` (0-3), `variant.<map>`,
  `arrived.<family>`, `site.<id>.workedToday`, `valley.farmGreen`, `placesDone`. A villager's wistful lines are rules
  with `when: { place: "<theirs>", max: 2 }`; today's cheerful lines (Mara's "Business is booming") get
  `when: { place: "market", min: 3 }`. That fixes today's tone clash with data.
- **Memory carries the restorations.** Its M2 event log gains fact kinds `placeAsked`, `workedAt` (with which villager),
  `placeOpened`, `forged` (part and quality), `grafted`, `seedDrawer`, `arrived`, `marketSold`. Villagers then say "You
  were up at the Narrows at dawn again." or "Orin won't stop talking about that sluice gate."
- **Barks change as the valley heals.** Its M3 barks read `variant.<map>`: on a dry town Mara mutters "Quiet again."
  near the square; after the river, Finn calls "Hear that?" from the dock.
- **Ties are the families.** Its M5 `ties` and gossip: Mara and Senna (sisters), Clay and Dara (siblings), Orin and
  Tobin (master and apprentice), Rosa and Wren (aunt and niece), Finn and Rosa (lake-path neighbours). A restoration
  told to one villager reaches their ties the next morning.
- **Arcs are its M7 seasonal arcs**, scheduled by place stats instead of only dates; heart scenes stay `events` in
  `npcs.json` (three lines each, as today). Schedule `when` (section 4.4) is the same field as its M6.

Every villager below has a one-line voice (for its M8 voice sheets), a loss, a wish and the valley facts they react
to.

### 5.1 The five who stayed

**Rosa** (voice: practical, kind, talks to plants). *Loss:* her grandmother's orchard; and Ilse, her friend, who
died two winters ago with the farm unworked. *Wish:* blossom on the hill. *Beats:* day 1 greeter (unchanged); day 3
letter with Ilse's tin and journal; 2 hearts "Know your soil" (rewritten as Ilse's lesson); the spring's opening ("I'd
forgotten that sound."); 3 hearts letter and the orchard's Ask; 4 hearts "Grandmother's orchard" (walks you up the
hill, gives a cutting of the bucket tree); the orchard's opening; 5 hearts **"Blossom"** (replaces "Harvest thanks":
under the bucket tree in spring, she gives you Ilse's last journal page, which points to Lantern Hill). *Reacts to:*
channels on your farm, grafts, Wren's return.

**Mara** (voice: bright, a little too brave). *Loss:* the market, and her sister Senna, who left with the mill.
*Wish:* a Saturday market like they used to have. *Beats:* 2 hearts "The back shelf" (kept: "I kept the best seeds for
whoever came"); 3 hearts letter; 4 hearts **"The ledger"** (rewritten: the list of every family that left, none
crossed out, "I never closed their accounts"); the weir's opening brings Senna home seven days later (a letter,
then Senna at the mill); the market's Ask and opening (she rings the old market bell); 5 hearts "Best customer"
(kept, keg and "You have made this valley feel like home"). *Reacts to:* every arrival, market days, what you sell.

**Finn** (voice: quiet, dry humour, listens more than he talks). *Loss:* the *Heron* on the mud, and the river's
sound. *Wish:* to float her. *Beats:* 2 hearts "The quiet lake" (kept); 3 hearts letter; the weir's Ask (his walk to
the Narrows); 4 hearts **"The Heron"** (replaces "A secret spot": he shows you the hull he still scrapes each
spring); the weir's opening (Finn standing in the boat as the water lifts her); 5 hearts "The golden salmon" (kept,
now in the river). *Reacts to:* river level, legends, the Derby's venue.

**Orin** (voice: few words, every one a proverb about metal). *Loss:* the forge's fire and his apprentice Tobin.
*Wish:* to hear the anvil ring. *Beats:* 2 hearts "The forge" (rewritten: "Heat, hammer, patience. I've had only the
patience lately."); the forge's Ask and opening (your first strike together); 4 hearts "Tools that last" (kept); 5
hearts "Almost an apprentice" (kept: it now lands, because Tobin's letter follows: "Heard the forge is lit."). Tobin
arrives seven days after the market opens. *Reacts to:* parts you forged and their quality, tool upgrades.

**Clay** (voice: short sentences, proud, funny when he forgets to be prickly). *Loss:* his sister Dara and her
children, who left in year three; and the thing he will not say, that he kept the town fed alone and nobody noticed.
He does not think anyone new will stay ("You'll last till the first dry summer."). *Wish:* that the Holt farm and the
Seed House outlive him. *Rival to ally, earned by what you do, not only by gifts:*

1. *Day 7 letter* (rewritten voice, same rules): "I've fed this town alone for seven years. The board's first come,
   first served. Don't take it personally when I win."
2. *Year 1 board race* (unchanged rules and balance).
3. *The spring opens:* next morning there is a sack of fertilizer at your gate and a letter with no name ("(no
   name)", sent as `from: clay`, revealed in step 6).
4. *2 hearts "A friendly bet"* (kept); his `rivalLate` perk.
5. *The weir opens:* his fields get the river too. "Didn't ask for help." (a line, then he races less: the
   `rivalLate` perk also turns on here if he is below 2 hearts).
6. *"The other half"* (new scene, 3 hearts and two places restored, or a board season won and 2 hearts): his tin
   beside yours; Bram and Ilse; "the compost was me". The Seed House's Ask.
7. *Seed House work days:* he works beside you. Opening: "Grandad would've liked you. Don't tell anyone I said that."
8. *4 hearts "Clay's secret"* (kept, Speed-Gro); `rivalPolite`.
9. *Dara comes home* (the season after the Seed House): a short scene at her door; Clay says only "She's back.
   ...Thanks."
10. *5 hearts "Partners"* (kept, now also needs the Seed House restored): `rivalOff`; his crates become a stall at
    the market.
11. *Finale:* he lights the Holt lantern with Dara, then hands you the taper.

### 5.2 Families who come home

Each is one `npcs.json` villager (one sprite sheet) plus a house object; arrival letters come a week before. v1
gives each lines, loves and a stall; heart events are v2.

| Family | Comes after | Who you meet | House | Stall (market) | Ties |
| ------ | ----------- | ------------ | ----- | -------------- | ---- |
| The Marls (millers) | Weir + 7 days | Senna Marl (Mara's sister); Ivo is at the mill | NE house (14,3) and the mill on the river | Flour and bread (flour is a new cooking ingredient) | Mara |
| Wren Ashby (beekeeper) | Orchard, next spring 1 | Wren | Orchard Hill cottage | Honey; she buys flowers | Rosa's niece; bee houses yield more near blossom |
| Dara Holt, Pip and Lu | Seed House, next season 1 | Dara (the children are a two-frame decor sprite) | Cottage (3,27) | Eggs and cheese | Clay's sister |
| Tobin Reyes (cartwright) | Market + 7 days | Tobin | Above the forge | Tool repairs; cheaper bars | Orin's apprentice; the Trade Road |

## 6. Pacing

Restorations are paced by Ask conditions and small costs, not by gates on existing content. A typical player:

| When | Valley | Goal chain (today's) | Festival |
| ---- | ------ | -------------------- | -------- |
| Y1 spring 1-2 | Guided start on a dry farm; day 2 rain (unchanged) | gift ... sleep, buy | |
| Y1 spring 3 | Rosa's letter: Ilse's tin and journal; the spring's Ask | job1, harvest | |
| Y1 spring 4-7 | **First green**: the morning after you have shipped 5 goods (day 4 at the earliest), the farm turns `waking` | ship, fish, craft | |
| Y1 spring 8-18 | Old Spring gathered and worked; **channels** | place, preserve, order; Clay from day 8 | Flower Show (14), small: three tables, Rosa's idea |
| Y1 summer 1-12 | Forge asked, gathered, worked; **strike in time**; charcoal | quality, chicken, eggs | |
| Y1 summer 13-fall 5 | Weir asked, gathered, worked; **rowing**; the river returns | tree, friend, earn1k, upgrade | Fishing Derby (summer 22): on the river if the weir is done, else at the woods lake (Finn's "lake derby") |
| Y1 fall | The Marls arrive; Orchard asked, worked; **grafting** | bag, earn5k, land | Harvest Fair (16) |
| Y1 winter | Seed House: "The other half", worked with Clay; **seed saving** (kale and greenhouse) | project1 ... | Winter Feast (24): Clay comes, does not enter, judges your basket out loud |
| Y1 winter 28 | Year-end screen with a Valley row (places mended, households home) | | |
| Y2 spring | Dara home; Wren home; Market asked and worked; **market day** from about spring 15 | | Flower Show, the town decorated by returned families |
| Y2 summer | Tobin arrives; Trade Road (the old Market Road project) | | Fishing Derby on the river, from the *Heron* |
| Y2 fall | Lantern Hill opens when all six are mended; **finale** on the next free evening | | Harvest Fair; Lantern Night (27) from now on |
| Y3 spring 1 | **The Watermark** (below) | | |

- **Festivals come back** by looking different, not by being gated: in a `dry` town a festival is three tables and a
  handful of people; each restored place and family adds a stall, bunting or a crowd sprite to festival days.
  Rules, rivals and prizes are unchanged. The Derby's `stocked.maps` becomes `["town"]` when the weir is restored
  and `["woods"]` before (a `dryMaps` field).
- **Legendary fish:** the glimmer trout (spring rain, town river) and the ice pike (winter, town) need the weir; the
  legends letter (after 10 catches) says "once the river is back". Both are `aside` goals, so nothing is held up.
- **A slow player** is never stuck: Asks have fallbacks (the forge asks on summer 1 regardless; the market asks on Y2
  spring 1 if three places are done, else as soon as they are). Nothing expires. The finale can come in year 3 or 4.
- **A fast player** cannot rush past people: Asks need hearts, so friendship paces the middle.

### The Watermark (year-3 checkpoint, then every spring)

On spring 1 of year 3 (and every spring after), the morning note says "Rosa and Clay are down at the river stone."
On the riverbank stands the old Watermark, where the founders cut a notch for the river's height each spring. Interact:
a sheet, **"The Wend, year N"**: the river's height (dry, rising or full, from the weir and spring), places mended
(n of 6), households home (n of 9: five who stayed, four families), market days held, the villagers' warmest heart
level, and one sentence from Rosa chosen by how far the valley has come ("The river's still finding its way back.
So are we." up to "Ilse would have wept. Then she'd have put you to work."). Then you cut this year's notch (the
stone's sprite gains a notch per year, up to five). There is no grade and no failure line; the notch is always
higher than last year's. Data: a row in `valley.json` (`watermark` bands) and a stat `watermark.<year>`.

### The finale and free play

The finale (section 3.7) can happen any time all six are restored. Afterwards: weekly market days, Lantern Night each
fall, the Watermark each spring, the Founders' Stone levels, legendary fish, the mastery goals, and the v2 depth of
each mechanic (crossing, tempers, two-fruit trees, the upstream row). The year-end screen keeps its role for years
without a finale.

## 7. The opening

The guided start stays exactly as tuned (one line at a time, about 2-3 minutes to day 2). The letter adds no step.

- **The letter is the title screen.** On a first launch (no save), the title shows Rosa's letter on a parchment card
  under the logo, with **New game** beneath it, so reading it costs no time the player was not already spending on
  the title. With a save, the title is as now; the letter is in the mailbox as an already-read letter (re-readable).
- **Day 1 is visually dry, mechanically identical.** The farm loads its `dry` variant: the same geometry, the straw
  palette, dead crowns. The welcome strip's text changes to fit the letter: "You came! I'm Rosa. The farm's yours."
  (37 characters, shorter than today's 41-character "Hi, I'm Rosa! This old farm is yours now."). Rosa's three ripe parsnips are now visibly the only green thing
  on the farm.
- **Day 2 is unchanged:** rain (Rosa's rainy-day line becomes "Rain! The valley drinks it all by noon."), the mail
  step (Mara's welcome letter keeps its seeds and is reworded: "So glad the old farm has a keeper again. I kept the
  store lit for this."), the Menu's jobs, the walk to town.
- **Day 3** (first free day): Rosa's letter brings Ilse's seed tin (a key item, it shows the founding seeds as a
  checklist) and the journal (opens Menu > Goal's THE VALLEY section at page 1). It is one morning letter, after the
  guided days, so no tip rule is broken.
- **The first change** comes the morning after the player has shipped 5 goods, no earlier than day 4: the farm wakes
  (`valley.farmGreen` = 1), a morning note ("The farm looks greener this morning.") and Rosa: "First green this
  valley's seen in years. Don't let it go to your head."

## 8. Keep, rename, reframe, cut

| Today | Decision |
| ----- | -------- |
| Town projects (canopy, library, greenhouse, fair hall) | **Keep** as town projects (the town's own savings), shown on the board as now. |
| Fish Ladder project | **Reframe:** opens after the weir ("big fish swim up" now means something); `after` gains a place condition. |
| Hot Spring project | **Reframe:** opens after the spring (groundwater back), blurb "The warm spring runs again." |
| Seed Exchange project | **Reframe:** "traders over the hills" become the Marls' and Tobin's connections; opens after the weir. Rare seeds unchanged. |
| Market Road project | **Rename** to **Trade Road**, opens after Tobin arrives, same cost and perk. |
| Founder's Statue ("a statue of you") | **Reframe** to **the Founders' Stone**: the toppled stone of Ilse and Bram in the square (visible, broken, from day 1). Level 1 raises it; levels 2-6 carve the returned families' names, then yours. Costs and perks unchanged. |
| Goal names "Tiny Tycoon", "Master Farmer" | **Rename** to valley titles ("Keeper of the Wend", ...); stats unchanged. |
| Ranks (Seedling ... Harvest Legend) | **Keep.** |
| Clay's board race, crates, perks | **Keep** rules and balance; rewrite his letter and lines; perks re-gated per section 5.1. |
| Mara's "Business is booming", "Best customer in the valley", Rosa's "The whole valley is talking about it" | **Move** to post-restoration line tiers or rewrite (section 5). |
| Rosa's "Harvest thanks", Finn's "A secret spot", Mara's "ledger" events | **Rewrite** as "Blossom", "The Heron", "The ledger" (rewards kept). |
| Year-end screen | **Extend:** a Valley row and "The river remembers. See you in spring." replaces "A new spring awaits." |
| Festivals | **Keep** rules; dressed by town variant and families; the Derby's venue follows the river; add Lantern Night after the finale. |
| Legends letter | **Edit** the town river lines ("once the river is back"). |
| Bee house, fruit trees, machines, animals, orders, jobs, specials | **Keep** unchanged (Wren adds a bee bonus near blossom). |
| Cut | Nothing mechanical. Cut text only: lines that call the town thriving before it is, and "a statue of you". |

## 9. Systems impact

### 9.1 Save and state

| Change | State | Version |
| ------ | ----- | ------- |
| Places, work days, farm green, families, watermark, boat trips, grafts | stats only | none |
| Villager memory (living-villagers plan M2) | `villagers.log` | **18** in that plan; numbers below shift by one if it lands first |
| Letters, journal pages | mail and stats | none |
| Channels | `SoilTile.channel?: true` | **18** (sanitize accepts it; old saves have none) |
| Seed saving | `CropState.tag?`, `CropState.ripeFor?` | **19** (or batched into 18 if built together) |
| Market | `market: { day, stall, sold }` | **20** (or batched) |
| Grafted trees | placed `fruitTree` objects with `data.roots` (existing shape) | none |
| Goals | none inserted: places live in THE VALLEY section, not in `goals.json`; any new goal is appended | none |

Old saves load into a valley that matches their progress: a year-2 save starts with `valley.farmGreen` = 1 (set by
the migration from `shipped`) and every place at 0, asked by the normal conditions on the next morning. Nobody is
sent back to a dry farm they have already greened.

### 9.2 Economy guard rails (tests in `tests/balance*.test.ts` and `tests/sim.test.ts`)

- Restoration gold: year-1 places total at most 12,000g; all six at most 20,000g (the town projects are about 123k).
  Parts cost bars and charcoal, a sink for copper and iron.
- Channels: watered tiles at most 2 x `flow` (48, then 128). A test keeps a full channel field under the
  water-free value of the same tiles under quality sprinklers.
- Forge: parts are not sellable (refused by the bin like machines). Part quality only changes work days or a cap.
- Rowing: floating finds 2 to 4 a day, counted inside the existing forage-income bound (150 to 280g a day across
  maps); deep-spot weights keep fish income under the fisher sim's bound (under twice the median).
- Grafting: root traits keep per tile-day fruit income under melon and pumpkin (the rare-crop rule); hardy adds one
  season at most.
- Seed saving: heirloom quality bonus 25% one step; hardy only on the first 3 days of the next season.
- Market: at most 1.5x bin price per item, demand falls 15% per repeat, six slots; one market day earns at most twice
  the player's average daily shipping (sim test with a bot that stocks the stall).
- The sim bot does not restore places in its pinned median run; a new sim run restores them on schedule and must stay
  within +15% of the median.

### 9.3 Performance and art budgets

- **Draw calls (budget 12):** variants have the same layers; the dry palette is a texture choice (no draws); channel
  water is drawn by the soil layer; site sprites, stalls and visitors are atlas frames (batched). Rowing adds one
  boat sprite. Target: no scenario above 6 draws.
- **JS per frame (3.5 ms):** variant choice happens at map load; market sales resolve lazily; the flow walk runs once
  a night.
- **Tileset:** today 512x1024 and nearly full. Budget: grow to at most 512x1536 for all variants and new maps
  (about 1,000 new slots), never past the 2048 build limit. The dry palette adds one texture per season, loaded only
  while a dry outdoor map is shown.
- **Maps:** five new maps and about ten variant files, each 9 to 90 KB; the service worker caches them at runtime,
  not in the precache.
- **Characters:** four new villager sheets (20x32, four directions, 4-frame idle), the children decor, rowing frames
  for the player (four directions, two frames), the *Heron*.
- **Objects:** six site sprites in four stages, stumps and buds, the forge view (anvil, glow, hammer), stalls and
  awnings, lanterns, the Watermark stone (five notches), about 25 item icons (spade, knife, tag, cutting, deadwood,
  charcoal, parts, heirloom seeds, flour, honey).
- **Audio:** four loops, three cues (anvil, bellows, lantern chime), one piece (Lantern Night), and a thinned
  arrangement flag in the director.

## 10. Originality notes

The owner's premise (a letter to a grandchild, a fading town) has a famous neighbour. The execution differs on
purpose:

- The letter is from a **neighbour** who stayed, written to call you home, read on the title screen; nobody dies on
  screen and there is no office job.
- **No bundles, no donation room.** Places are working infrastructure (water, iron, river, roots, seed, trade), asked
  for by one person, paid with a small fund, a part you forge and days of work at the site.
- **No villain, no corporation, no magic helpers.** The flood is nobody's fault.
- **No broken bridge, no mine elevator, no community centre.** The Seed House is a working seed library you fill by
  growing, and its story belongs to Clay's family and yours.
- **The rival is a farmer who stayed**, and his turn is earned through restorations he benefits from, not a single
  reveal. The checkpoint is a notch on a river stone, every spring, never a verdict.
- Names: the Wend, Ilse, Bram, the Heron, the Marls, Wren Ashby, Dara Holt, Tobin Reyes: chosen not to echo any
  well-known farm game.

## 11. Open questions (for the owner)

1. Is year 2 the right length for the arc (finale in Y2 fall), or should it fit in year 1 for players who stop
   there?
2. Should day 1 really look dry (the straw farm on the guided start), or start green-around-the-house with dryness
   beyond the fence? The plan says dry, palette only, so the guided start's geometry and timing do not move.
3. Rowing's v1 is town-only. Is an upstream trip to the Narrows by boat worth a v2 map in year 1?
4. The forge's rhythm: is a timing mini-game welcome next to fishing, given "Easy strike" exists?
5. Families: four (one villager each) is the art budget proposed. More families as decor-only households?
