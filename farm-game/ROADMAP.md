# Tiny Acre roadmap

What we build next, in order. The direction is **The Dry Year**: read [docs/VISION.md](docs/VISION.md) first, then
[docs/WORLD-PLAN.md](docs/WORLD-PLAN.md) (the full design) and [docs/MILESTONES.md](docs/MILESTONES.md) (the build
order with acceptance criteria). Every item plugs into the existing registries ([docs/EXTENDING.md](docs/EXTENDING.md))
and is built scenario-first.

Guiding question for every item: **is it fun on a phone, with one thumb, in a 5-minute session, and does the valley
visibly heal because of it?**

## Where we are

A complete, portrait, one-handed farming game: farming with quality, foraging, fishing, the mine, crafting and
machines, animals, trees and a greenhouse, five villagers with schedules, hearts and heart events, daily jobs, the town
board and Clay's board race, special orders, festivals, town projects and the Founder's Statue, mail, the Book, a
guided start, real art and audio, and a dev sandbox of named scenarios. Earlier roadmap phases (R1 to R3 and the
depth items D1 to D10) are done; the reasoning behind each lives in [DECISIONS.md](DECISIONS.md) and git history.

What it lacked was a reason that ties the systems together. The Dry Year gives one: the river left the valley, most
families left with it, and you mend it place by place.

## Now: The Dry Year (docs/MILESTONES.md)

| # | Milestone | Owner areas |
| - | --------- | ----------- |
| M1 | The letter, the first green, and lines that fit the valley | onboarding, art, depth |
| M2 | Map variants: maps change shape with the valley; the farm's dry creek bed | art, depth |
| M3 | The restoration pattern and the Old Spring: ask, gather, work days, opening; the creek runs | depth, art, onboarding |
| M4 | Channels: dig a water network off the creek (and the plan's one save bump) | depth, feel, onboarding |
| M5 | The Cold Forge: strike in time, and the parts later places need | depth, feel, audio, art |
| M6 | The Weir: the river returns to town, the Heron floats | depth, art, audio |
| M7 | Towing timber, and the first family home in a house you rebuilt | depth, art, feel, audio |
| M8 | The Seed House: the seed library; Clay's turn from rival to ally | depth, art |
| M9 | The Bucket Orchard: grafting onto dead stumps | depth, art |
| M10 | The Market Field: market day, families' stalls, the Trade Road | depth, art, audio |
| M11 | Lantern Night finale, High Water, the year-end, the Founders' Stone | depth, onboarding, art, audio |

The minimum complete game is M1-M4, M6, M7, M8 and M11 (the spring, the weir and the Seed House).

After the first pass, each mechanic's v2 is its own small milestone (listed at the end of MILESTONES.md).

## Alongside

- **Living villagers** (`agents/PLAN-NPC-LLM.md`, branch `plan/npc-llm`): a rule-based dialogue database, villager
  memory, barks, reactive requests, ties and gossip, walking schedules, seasonal arcs; no runtime LLM. The Dry Year does not
  wait for it (its own M1 adds conditional villager lines); the plan's dialogue, memory, barks and ties enrich the
  arcs later (MILESTONES section E).
- **Open findings and per-area next steps** (onboarding, controls, feel, art, audio, depth): `agents/OPEN-FINDINGS.md`
  and `agents/NEXT-STEPS.md`. They keep their own order; where one touches a Dry Year milestone, it is fixed in that
  milestone.
- **Needs a human:** play on a real phone one-handed as a first-time player; listen to the audio; decide the open
  questions in WORLD-PLAN section 11 and in `agents/NEXT-STEPS.md`.

## Later: production polish

- [ ] **Localization.** Move every player-facing string into locale files; the text-fit tests catch overflow.
- [ ] **Store release.** Final app id, listings, privacy statement, crash reporting, signed builds; after a real
      device pass. Re-check the licence terms for generated art first (`ASSETS.md`).
- [ ] **Retention hooks.** Optional notifications ("your crops are ready"), seasonal cosmetics. No daily login
      streak (owner, 2026-10-08): the game never reads the real clock.
- [ ] **Cloud save and cross-device sync.** Optional account, conflict-safe merges; needs a backend decision.
- [ ] **Animals that roam and festival maps** (wait for the art they need).

## Engineering health (continuous)

- [ ] Keep `npm run verify` green on every change; a unit test with every system, an e2e check on a scenario for every
      player-facing flow, no new fixed waits.
- [ ] Every map variant passes the map tests; every scenario pins the variant it needs.
- [ ] Track perf per mechanic (budget 12 draws and 3.5 ms JS per frame; target 6 draws).
- [ ] Save compatibility: every state change bumps the version with a migration and a migration test; goals are
      append-only.

## How we decide what is next

1. Does it make the premise felt, or the first hour better? Do that first.
2. Can the player see it in the world? A restoration that only changes a menu is not done.
3. Is it data plus a module on an existing registry? Prefer it over touching the core.
4. Can it be verified without a device? If not, schedule a device pass right after it.
5. After each milestone, play a full in-game season and cut or rebalance anything that does not earn its place.
