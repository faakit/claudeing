# Review 10 (review-9 fixes), art/round3 4cd86a9, 2026-10-09

Frozen copy round-8/farm-game: build ok, perf 2-4 draws, <=1.44 ms JS at 1x. Agent shots: round3/proportions/after/r9-*.

Verdict: fixed. R9-1: crisp see-through hole with a 2 px checker rim, player and marker never tinted (r9-fruit_zoom,
r9-night_zoom). R9-2: lamp tops on their own never-cut layer, thin placed sprites skip the hole. R9-3: farm lawn trees
are full size; woods interior spots inside forage zones became bushes/stumps (accepted).

Open:

- minor: add a perf scenario with the player standing under a crown and behind a placed tree (mask active), since
  geometry masks can break batching; the current scenarios never trigger the hole.
- R9-4 minor: 32x28 barn source needs a Flow fetch by the coordinator (this art session cannot download).
- R9-5 nit: well 20x30, baked map fences, item-pop tween snap.
