# Review 13 (round 4 pass 1: animation frames + well), art/round4 a5c262f, 2026-10-10

Frozen copy round-11/farm-game: build ok; atlases world 512x256, ui 512x128, chars 512x512, tilesets 512x1024; zero
off-palette and zero semi-alpha pixels in every atlas/tileset (script); perf 2-7 draws, <=1.40 ms JS at 1x.
Evidence: agents/out/art-shots/round4/strips/*, well_before_after.png.

Verdict: a solid, consistent first pass: head identity and planted feet are enforced by tests, outlines are clean, idles
have personality, the well finally reads. Two feel issues in the tool swings.

Good: walk onion skin shows a stable head and spine; tool contact frame fixed at index 2; R5-5 head matches; villager
signature beats (Rosa's hat lift, Finn's hat, Orin's weight shift, Clay's head tilt); squash/stretch pop authored on the
grid; crop lean is subtle; splash crown; well 24x32 with roof overhead.

1. major - raised arms too long: hoe/pick down frame 0 and hoe/rod side frame 0 reach ~16-17 px from the shoulder (idle
   arm ~8-9 px) and the hands break the crown guide (tool_hoe_down_strip, tool_hoe_right_strip frame 0). Raised arm
   <= 11 px, hands at or just above the crown; let the tool carry the height.
2. major - rigid torso in every tool swing: only the arms move, so it reads mechanical. Wind-up: upper body 1 px back;
   contact: upper body 1 px down (knees implied); follow-through: back to rest. Move the head with the body as a unit
   (same pixels, offset), so head identity holds.
3. minor - up/down walk: arms barely swing (walk_down/up_strip). Add a 1-2 px alternating hand swing.
4. minor - side walk: the far hand shows as a skin blob behind the hip on contact frames (walk_right frames 0, 1, 7).
   Tuck it behind the body or give it a sleeve pixel.
5. minor - door: the jamb pops (frame 0 rounded wooden top, frames 1-3 square corners with a navy lintel). Keep jamb and
   outline identical; only leaf and interior change.
6. minor - town at night 4 -> 7 draws (budget fine). Find the cause (chars atlas interleaving with world sprites by depth?)
   and note it for the feel agent, who will add effects on top.

Decision (walk cadence for the feel agent): 16 fps for the 8-frame cycle at base speed, scaled with actual speed
(clamp 10-20 fps); accept the residual slide. True planted feet at 64 px/s would need ~37 fps, too busy for a cozy read.
Optionally widen the side contact stride to 9 px to cut the slide.
