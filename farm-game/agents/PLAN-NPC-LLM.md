# Plan: living villagers, and whether a tiny on-device LLM should write their lines

Planning agent, 2026-10-11, branch `plan/npc-llm` (from `integration/round4-2026-10-11`). This is a plan. No game
code changed. Measurements and throwaway spikes live outside the repo in `C:/Users/andre/dev/tiny-acre/npc-llm-spikes/`
(`scores.md` has every scored line). Sources are cited inline. Research was done on 2026-10-11; vendor numbers are
labelled as vendor numbers, and "unverified" means I could not confirm a claim from a primary source.

## 1. Recommendation

**Do not ship a runtime LLM now. Build "alive" villagers systemically, with a rule-based dialogue database whose
lines are written at build time (an LLM may help draft them, a human reviews them), and ship them as JSON
(architecture C).** Keep one door open: an optional, opt-in, native-only "Living villagers" experiment
(architecture D, paraphrasing the line C already picked) behind go/no-go criteria that today's tiny models fail.
Cloud inference (E) is out of scope.

Why, in one paragraph each:

1. **The quality isn't there at the sizes a phone can afford.** I ran five current sub-500 MB models (LFM2-350M,
   LFM2.5-350M, Granite 4.0 350M, SmolLM2-360M, Qwen2.5-0.5B) on 20 real game situations, with JSON-schema
   constrained output. Asked to write a line from facts (architecture A), the best model produced **4 good lines in
   20** and **11 wrong ones**; the others produced 0 to 2 good and 9 to 15 wrong. Wrong means wrong speaker
   ("Thanks for the Daffodil, dear Mara", said by Mara), inverted facts ("Happy birthday, dear farmer!" on Finn's
   birthday), contradictions ("The water's frozen" when the lake is open), invented numbers, prompt leaks and a
   language switch. Asked to paraphrase an authored line (architecture B), three models copied it verbatim 11 to
   15 times in 20 (safe, but zero value), and when they did change the wording, roughly half the changes broke a
   fact or the tone ("About Holly yesterday, but you're a disappointment."). My string validators caught only 1 to
   6 of the 9 to 15 bad lines per model: the errors are semantic (who did what), and checks on strings cannot see
   them.
2. **The web build cannot run it at an acceptable speed.** The game ships as a GitHub Pages PWA, and GitHub Pages
   cannot send the COOP/COEP headers that multi-threaded WASM needs, so a browser build runs llama.cpp
   single-threaded. On a fast desktop (Ryzen 7 5700X3D), wllama 3.8.1 single-threaded took **6 to 10 s to the first
   token** for a 350M model and **27 s** for Qwen2.5-0.5B; a phone is several times slower. WebGPU helps on iOS 26+
   and Android Chrome, but Android System WebView (the Capacitor Android shell) has no confirmed WebGPU.
3. **The cost is out of proportion.** Today a player downloads about 5 MB (2.3 MB audio, 1.2 MB Phaser, 0.5 MB
   game code, maps and art). The smallest usable model is 220 to 230 MB, 45 times the whole game, before the
   runtime (wllama's WASM is 8.8 MB uncompressed). It also costs battery and heat, a store review surface
   (in-app reporting, age-rating answers, AI labelling under EU AI Act Article 50 since 2 August 2026), and
   determinism: today's lines are the same all day by design, and one of my runs gave a different line for the
   same seed.
4. **The biggest "alive" wins need no LLM.** Villagers have 11 lines each today (55 in all), say the same line
   all day, never mention what you did, and teleport between spots. Memory of recent events, ambient barks,
   gossip, visible schedules, small requests and seasonal arcs are what make villagers in Stardew-like games feel
   alive, and every one of them fits the existing registries (day hooks, stat watchers, jobs, mail, scenarios).
   A rule-based dialogue database (the "dynamic dialog" pattern Valve used for Left 4 Dead: Elan Ruskin, "Rule
   Databases for Contextual Dialog and Game Logic", GDC 2012) gives most of what an LLM promises (lines that
   react to state) with zero runtime cost, exact facts, reviewable text and localization.

**Under what conditions to revisit D (the go/no-go gate, section 9):** a model of at most about 300 MB, or one the
OS provides (Apple Foundation Models on iOS 26+, Gemini Nano through ML Kit), paraphrases our bank lines with
**at least 90% judged good and at most 2% wrong** on a 200-line held-out set, scored blind; and a median line on a
mid-range phone (Snapdragon 7-class, or iPhone 13) comes back in **under 1.5 s**, generated while the player is
not waiting. The likeliest way to pass is fine-tuning (LoRA) a 270M to 1B model on our own reviewed bank, the
recipe Arm used for its mobile NPC demo (section 3.3). Until then the experiment is not worth its size.

## 2. How villagers work today (what an LLM, or a rule database, could build on)

Read from `src/data/npcs.json`, `src/systems/friendship.ts`, `src/systems/npcs.ts`, `src/mechanics/villagers.ts`,
`src/ui/panels/NpcPanel.ts`, `src/game/NpcRenderer.ts`, `src/systems/rival.ts`, `src/systems/mail.ts`,
`src/data/mail.json`, `DECISIONS.md` (Animals and villagers, Schedules, Heart events, Mailbox, The rival farmer).

- **Five villagers**: Mara (shop), Finn (fisher, woods), Rosa (neighbour, farm), Orin (smith), Clay (rival). Each
  has loves, likes, dislikes, a daily gift once friends (`giftHearts` 3), perks by heart level (shop discount,
  fishing window, quality, upgrade discount; Clay's are rivalry rules: comes later, leaves the best request, stops
  competing), a birthday, a schedule and three heart events (2, 4, 5 hearts; three lines each, then a reward).
- **Dialogue**: `lineFor()` picks one line from `stranger` (0-1 hearts), `friend` (2-3), `close` (4-5) or `rain`
  (wet days, one day in three), three lines per pool (two for rain), indexed by `absoluteDay + id.length * 7`.
  Birthdays override with one fixed line. **That is 11 lines per villager, 55 in all, plus 4 gift replies shared by
  everyone.** Lines never mention what the player did. The pick is deterministic per day and never touches the
  random stream (`DECISIONS.md`: "the same villager says the same thing all day").
- **The chat**: opening a villager's sheet is the chat (+10 points once a day, x2 on birthdays); a bobbing "!"
  marks anyone not yet greeted. Gifts: once a day, love +80, like +45, neutral +15, dislike -20, x3 on birthdays;
  reactions are remembered as stats `gift.<npc>.<item>`. Heart events play once, stored as `event.<npc>.<id>`.
- **Where they are**: `schedule` entries "from minute M, be on map/tile", `away` = at home. The renderer checks
  once per game minute and fades them in and out: they teleport, they never walk. Weather does not change
  schedules (ROADMAP R3.1 promised it; only time of day was done).
- **The talk area** (`NpcPanel.buildTalk`): the line is drawn quoted at (8, 42), 184 px wide, in the hand-built
  5x7 pixel font (87 glyphs: ASCII letters, digits and punctuation, no accented letters), wrapping at spaces, with
  11 px rows; the "+10 friendship" row sits at y 88. **So a line has 4 rows at most, about 110 to 130 characters,
  ASCII only.** `fitText`/`measureText` are pure and tests use them (`docs/EXTENDING.md` section 6).
- **Mail**: `mail.json` letters with `when` (day, stat milestone, hearts, date) and optional gifts; code sends
  festival notices, birthday hints and Clay's season results (`rival.ts settleSeason`).
- **Clay's race**: from day 8 he takes the best board request at 2 PM (`rival.startDay`), lazily resolved; season
  tallies in stats (`board.<season>.you/.rival`, `board.last.*`, `boardWins`, `rivalTook`); festival rival scores
  name him.

**What a villager could know right now, from `GameState`** (the facts a rule or a prompt can use): time (year,
season, day, minute), today's weather and tomorrow's forecast, money, energy, the farm's soil and crops (ripe, dry,
withered, by crop), placed objects (coop, sprinklers, greenhouse, decor), animals and their happiness, inventory
(what the player is carrying, including a villager's loved items), skills and levels, goals (`goalIndex`, the
current goal), board orders (and which Clay took), the special order, today's jobs (by giver), letters, friendship
per villager, heart events seen, festival results and wins (`festivals`, `festivalWins`), the board race tally,
and about 40 lifetime counters in `stats` (`harvested`, `caught`, `mined`, `gifted`, `cooked`, `legends`...).

**What a villager cannot know yet:** anything _recent_. Stats are lifetime counters; only a few carry a day stamp
(`rival.day`, `board.last.day`, `special.last.<id>`, `ate.day`). There is no record of "yesterday you gave me a
Daffodil", "you won the Flower Show on Spring 14" or "Clay took your potato request today". **A short event log
(milestone M2) is the single piece of state that most of the "alive" work needs, with or without an LLM.**

**Budgets that apply** (`scripts/perf.mjs`, `agents/NEXT-STEPS-DEVTOOLS.md`): at most 12 GL draw calls and 3.5 ms
of JS per frame (hardware-independent regression budgets), frame pacing p95 at most 8 ms steady at 1x, p99 at most
14 ms at 4x, map changes at most 34 ms at 4x; a tap's planning at most 2 ms. The workflow is scenario-first
(`docs/EXTENDING.md` section 0): stage the feature as a scenario, develop in it, ship e2e checks that load it and
wait on game events, with no new fixed waits.

## 3. Research

### 3.1 Runtimes and the support matrix

| Runtime                                          | iOS Safari                                 | iOS WKWebView (Capacitor)                  | Android Chrome                      | Android WebView (Capacitor)                 | Native plugin                                                                      | Low-end phone (3-4 GB, Mali or old Adreno)                      |
| ------------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| transformers.js 4.3 / ONNX Runtime Web, **WASM** | Yes                                        | Yes                                        | Yes                                 | Yes                                         | n/a                                                                                | Partial: 135M-360M only, slow                                   |
| transformers.js / ORT, **WebGPU**                | Yes, iOS 26+ (4.3 enabled Safari)          | Likely on iOS 26+, unverified in Capacitor | Yes, Android 12+, Qualcomm/ARM GPUs | **Unconfirmed, treat as no**                | n/a                                                                                | Partial: shader-f16 gaps, memory crashes at long context        |
| WebLLM (MLC) 0.2.x                               | Yes, iOS 26+                               | Likely, unverified                         | Yes                                 | Unconfirmed (WebGPU only, no WASM fallback) | n/a                                                                                | Partial: needs q4f32 builds on old Adreno                       |
| wllama 3.8 (llama.cpp in WASM; WebGPU in v3)     | CPU yes; WebGPU only in a slow compat mode | CPU yes                                    | Yes                                 | CPU yes                                     | n/a                                                                                | Partial: single-thread without COOP/COEP                        |
| MediaPipe LLM Inference web / LiteRT-LM JS       | Partial                                    | Unverified                                 | Yes                                 | Unverified                                  | n/a                                                                                | MediaPipe is maintenance-only; LiteRT-LM JS is an early preview |
| Chrome built-in Prompt API (Gemini Nano)         | No                                         | No                                         | **No (desktop only)**               | No                                          | n/a                                                                                | No                                                              |
| llama.cpp through a Capacitor plugin             | n/a                                        | n/a                                        | n/a                                 | n/a                                         | Android yes, iOS yes (Metal); plugins immature                                     | Yes on CPU, 135M-0.6B                                           |
| LiteRT-LM / MediaPipe native (e.g. Capgo plugin) | n/a                                        | n/a                                        | n/a                                 | n/a                                         | Android yes; iOS Swift API in preview                                              | Partial                                                         |
| ML Kit GenAI Prompt API (Gemini Nano, AICore)    | n/a                                        | n/a                                        | n/a                                 | n/a                                         | Flagships only (Pixel 9+, Galaxy S26...), foreground only, structured output alpha | No                                                              |
| Apple Foundation Models (about 3B, iOS 26+)      | n/a                                        | n/a                                        | n/a                                 | n/a                                         | iPhone 15 Pro and later with Apple Intelligence on; `@Generable` guided generation | No                                                              |

Sources and notes:

- transformers.js releases: 4.0 (new C++ WebGPU runtime), 4.3.0 (16 Sep 2026: experimental structured output by
  JSON schema or regex; WebGPU enabled for Safari 26+), 4.3.1 (7 Oct 2026) —
  https://github.com/huggingface/transformers.js/releases. Models are cached in the Cache API by default.
- ONNX Runtime Web runs WASM multi-threaded only when the page is `crossOriginIsolated`, otherwise single-threaded —
  https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html. **GitHub Pages cannot set
  COOP/COEP**; `coi-serviceworker` fakes them with a reload, but COEP `require-corp` then breaks cross-origin model
  downloads without CORP headers, and older iOS versions are reported to fail with it (Zoom developer forum,
  https://devforum.zoom.us/t/session-failing-when-using-sharedarraybuffer-on-ios/122170). Design for single-thread.
- WebLLM: WebGPU only, JSON schema through XGrammar, cache in Cache API, IndexedDB or OPFS; prebuilt small models
  with VRAM needs in `src/config.ts` (SmolLM2-360M q4f16 376 MB, Qwen2.5-0.5B 945 MB, Qwen3-0.6B 1,403 MB, Gemma 3
  1B 711 MB, Llama 3.2 1B 879 MB) — https://github.com/mlc-ai/web-llm,
  https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts.
- wllama 3.8.1: README says multi-threading needs COOP/COEP (falls back to single-thread), 2 GB per file. **Grammar
  is supported**: I checked the 3.8.1 package types (`SamplingParams.grammar`, and `response_format` with
  `json_schema` on `createChatCompletion`), and my spike used it — https://github.com/ngxson/wllama.
- WebGPU status: Chrome Android 121+ on Android 12+ with Qualcomm, ARM and Intel GPUs; Safari on by default from
  iOS 26; Firefox Android behind a flag — gpuweb Implementation Status (edited 2026-10-02),
  https://github.com/gpuweb/gpuweb/wiki/Implementation-Status, https://caniuse.com/webgpu. WKWebView "when it's
  enabled by default" (Apple forum, https://developer.apple.com/forums/thread/770862), no Capacitor confirmation.
  **Android System WebView: caniuse shows no support and WebView release notes up to v154 (2026-09-10) do not
  mention WebGPU**; the WebGPU compatibility-mode intent to ship lists WebView as a target. Unresolved: test
  `navigator.gpu.requestAdapter()` on a device.
- shader-f16 (needed for q4f16 builds): Android 86% overall, Adreno 6xx about 30%, Adreno 7xx 97%, iOS 100% —
  web3dsurvey (crowdsourced, undated), https://web3dsurvey.com/webgpu/features/shader-f16/platform/Android.
- Memory: iOS WebContent processes are killed at roughly 1.5 GB on many iPhones (WebKit engineer comment, 2024,
  older than 12 months); 2 GB on an iPhone 17 Pro (https://developer.apple.com/forums/thread/823061). On Mali
  Valhall and PowerVR, 270M-0.6B models ran at an empty KV cache but crashed at 2,048 tokens of context (LlamaWeb,
  arXiv 2605.20706, May 2026, https://arxiv.org/html/2605.20706v1). Keep a browser model at 400 MB or less and the
  context short.
- Chrome Prompt API: "Chrome for Android, iOS ... are not yet supported"; desktop needs 22 GB free disk and a 4 GB+
  GPU — https://developer.chrome.com/docs/ai/prompt-api (updated 2026-08-26).
- Capacitor plugins: official `@capacitor/local-llm` (CapacitorLABS, experimental, iOS Foundation Models plus
  Android Gemini Nano, no web, Android output capped at 256 tokens) — https://capacitorjs.com/docs/apis/local-llm;
  Capgo `@capgo/capacitor-llm` (Apple Intelligence; Gemini Nano or LiteRT-LM `.task`/`.litertlm` models on
  Android; no schema API) — https://capgo.app/docs/plugins/llm/getting-started/; `llama-cpp-capacitor` (7 stars,
  npm 0.1.5, Feb 2026: immature, would need vetting or a fork) — https://github.com/arusatech/llama-cpp. The
  reference implementation is React Native's `llama.rn` (JSON schema to GBNF). **A thin custom plugin around
  llama.cpp is the only route that runs one custom model on every device.**
- ML Kit GenAI Prompt API: Beta, structured output Alpha, foreground only with battery quotas, flagship devices —
  https://developers.google.com/ml-kit/genai (updated 2026-10-08). Apple Foundation Models: about 3B on-device,
  4,096-token context, `@Generable`, guardrails that cannot be disabled, iOS 26+, Apple Intelligence devices —
  https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/.
  These two are free (nothing to download) and high quality, but cover only recent high-end phones.
- Storage: Chromium allows up to 60% of disk per origin; Safari 17+ about 60% for the browser and Home Screen apps
  but **about 15% for apps embedding WKWebView** (WebKit, 2023-08-10, https://webkit.org/blog/14403/updates-to-storage-policy/);
  Safari deletes script-written storage after 7 days without interaction outside Home Screen apps (MDN,
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). In Capacitor,
  download a model natively into the app sandbox instead (`@capacitor/file-transfer` is foreground only;
  resumable background downloads need a third-party plugin).

### 3.2 Phone speed (published)

| Source                                                      | Device                                       | Model, runtime                      | Prefill / decode tok/s                                |
| ----------------------------------------------------------- | -------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| LiteRT-LM overview (vendor, 2026-10-06)                     | Vivo X300 Pro                                | Qwen3-0.6B, CPU / GPU               | 165 / 9; 580 / 21                                     |
| same                                                        | Galaxy S24 Ultra                             | Gemma 3 1B, CPU / GPU               | 177 / 33; 1,191 / 24                                  |
| same                                                        | Galaxy S25 Ultra                             | FunctionGemma (about 270M), CPU     | 2,238 / 154                                           |
| Qualcomm model card                                         | Snapdragon 8 Elite Gen 5                     | Qwen3-0.6B Q4_0, llama.cpp, 512 ctx | TTFT 0.18-0.76 s, about 110 decode                    |
| Liquid AI (vendor)                                          | Galaxy S25 Ultra                             | LFM2.5-1.2B Q4_0, llama.cpp CPU     | 335 / 70                                              |
| Meta model card                                             | OnePlus 12                                   | Llama 3.2 1B SpinQuant, ExecuTorch  | 260 / 50, 1.9 GB RSS                                  |
| TokForge leaderboard (crowdsourced, unverified, 2026-10-11) | Galaxy A05 (low-end)                         | Qwen3-0.6B Q4_K_M, GGUF             | 17.9 / 7.1                                            |
| same                                                        | Snapdragon 7-series (SM7325)                 | Qwen3.5-0.8B, MNN                   | 74.7 / 24.4                                           |
| same                                                        | iPhone 15 Pro                                | Llama 3.2 1B Q4_K_M, llama.cpp      | 479 / 41                                              |
| LlamaWeb, arXiv 2605.20706                                  | Adreno 7xx, Mali Valhall, PowerVR, iPhone 15 | 270M-0.6B, **browser WebGPU**       | **about 4-17 decode**                                 |
| Arm "First Contact" (2026-08-05)                            | Pixel 9                                      | Gemma 3 1B + LoRA, int8, LiteRT-LM  | TTFT 813 ms, 18.3 decode                              |
| arXiv 2603.23640                                            | iPhone 16 Pro / Galaxy S24 Ultra             | sustained generation                | throttles from about 40 to 22.6 / about 25 to 5 tok/s |

Sources: https://developers.google.com/edge/litert-lm/overview, https://huggingface.co/qualcomm/Qwen3-0.6B,
https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct, https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct,
https://tokforge.ai/leaderboard/, https://arxiv.org/html/2605.20706v1,
https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/first-contact-a-mobile-architecture-for-llm_2d00_powered-game-characters,
https://arxiv.org/html/2603.23640v1. No published WebLLM or transformers.js numbers on phones were found, and
none for iPhone 13 or 14.

**What it means for one line** (a 120 to 150 token prompt, 20 to 35 tokens out): native on a flagship, well under
a second; native on a mid-range phone, 1.5 to 3 s; on a low-end phone, 7 to 12 s; in a mobile browser on WebGPU,
2 to 8 s; in a mobile browser on single-thread WASM, tens of seconds (my desktop already needs 6 to 10 s).

### 3.3 Candidate models

| Model                     | Params                       | GGUF Q4 (MB)                  | Web build (MB)                            | Licence (commercial redistribution)                                                                         | Gated | Languages                      | Notes                                                                                                                                                     |
| ------------------------- | ---------------------------- | ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SmolLM2-135M-Instruct     | 135M                         | 105                           | WebLLM q0f16 360                          | Apache-2.0 (yes)                                                                                            | No    | EN                             | IFEval 29.9; template-level coherence only                                                                                                                |
| SmolLM2-360M-Instruct     | 360M                         | 271 (official repo: Q8_0 386) | ONNX q4f16 273; WebLLM 376                | Apache-2.0 (yes)                                                                                            | No    | EN                             | IFEval 41.0; **spiked**                                                                                                                                   |
| Gemma 3 270M IT           | 270M (170M of it embeddings) | 253                           | ONNX q4f16 273; LiteRT 249                | Gemma Terms (yes, with conditions: pass on the prohibited-use policy, NOTICE file, Google may restrict use) | Yes   | 140+ (weak)                    | IFEval 51.2; Google says it is for fine-tuning, "not designed for complex conversational use cases"; 25 conversations used 0.75% of a Pixel 9 Pro battery |
| LFM2-350M                 | 350M                         | 229                           | ONNX                                      | LFM Open License v1.0 (yes below $10M annual revenue)                                                       | No    | EN, AR, ZH, FR, DE, JA, KO, ES | IFEval 65.1 (vendor); **spiked**                                                                                                                          |
| LFM2.5-350M (Mar 2026)    | 350M                         | 229 (Q4_0 219)                | ONNX q4f16 255                            | LFM Open License v1.0                                                                                       | No    | + PT                           | IFEval 77 (vendor); built for structured output; vendor recommends temperature 0.1; **spiked**                                                            |
| Granite 4.0 350M / H-350M | 340-350M                     | 237 / 223                     | ONNX q4f16 350                            | Apache-2.0 (yes)                                                                                            | No    | 12                             | IFEval 55.4 / 61.6; the only published safety scores here (SALAD-Bench 93-97); **spiked**                                                                 |
| Qwen2.5-0.5B-Instruct     | 0.49B                        | 491 (Q4_0 429)                | WebLLM 945                                | Apache-2.0 (yes)                                                                                            | No    | 29+                            | IFEval 31.6 (SmolLM2 card); hallucination 25.2% (HalluLens); **spiked**                                                                                   |
| Qwen3-0.6B                | 0.6B                         | 397                           | ONNX q4f16 570; WebLLM 1,403; LiteRT 345+ | Apache-2.0 (yes)                                                                                            | No    | 100+                           | thinking on by default (turn off); "DO NOT use greedy decoding"                                                                                           |
| Qwen3.5-0.8B (Mar 2026)   | 0.8B                         | 533                           | ONNX about 584                            | Apache-2.0 (yes)                                                                                            | No    | 201                            | IFEval 52-60; card warns of loops                                                                                                                         |
| Gemma 3 1B IT             | 1.0B                         | 806                           | ONNX 763; WebLLM 711; LiteRT 555          | Gemma Terms                                                                                                 | Yes   | effectively EN                 | IFEval 80.2 (Google) / about 63 (Liquid's re-run); used in Arm's NPC demo                                                                                 |
| Llama 3.2 1B Instruct     | 1.23B                        | 808                           | WebLLM 879                                | Llama 3.2 Community License (yes; "Built with Llama", AUP)                                                  | Yes   | 8                              | IFEval 59.5                                                                                                                                               |
| LFM2.5-1.2B-Instruct      | 1.17B                        | 731                           | ONNX 760                                  | LFM Open License v1.0                                                                                       | No    | 8                              | IFEval 86 (vendor); 70 tok/s decode on a Galaxy S25 CPU (vendor)                                                                                          |
| TinyLlama 1.1B Chat       | 1.1B                         | 670                           | WebLLM 697                                | Apache-2.0                                                                                                  | No    | EN                             | dated; 55% persona consistency in an NPC study (arXiv 2511.10277)                                                                                         |
| MobileLLM-R1 (Meta)       | 140M-950M                    | n/a                           | n/a                                       | FAIR non-commercial (**no**)                                                                                | Yes   | EN                             | math/code only; excluded                                                                                                                                  |
| Apple Foundation Models   | about 3B                     | 0 (in the OS)                 | n/a                                       | Apple acceptable-use requirements                                                                           | n/a   | Apple Intelligence languages   | iOS 26+, iPhone 15 Pro+ only                                                                                                                              |
| Gemini Nano (ML Kit)      | n/a                          | 0 (in the OS)                 | n/a                                       | ML Kit GenAI terms, Google prohibited-use policy                                                            | n/a   | n/a                            | flagship Android only                                                                                                                                     |

Sources: model cards on Hugging Face (fetched 2026-10-11): HuggingFaceTB/SmolLM2-360M-Instruct,
google/gemma-3-270m-it, LiquidAI/LFM2-350M, LiquidAI/LFM2.5-350M, ibm-granite/granite-4.0-350m,
Qwen/Qwen2.5-0.5B-Instruct, Qwen/Qwen3-0.6B, Qwen/Qwen3.5-0.8B, meta-llama/Llama-3.2-1B-Instruct,
LiquidAI/LFM2.5-1.2B-Instruct, facebook/MobileLLM-R1-950M; Gemma terms https://ai.google.dev/gemma/terms;
LFM licence https://www.liquid.ai/lfm-license; Gemma 270M announcement
https://developers.googleblog.com/en/introducing-gemma-3-270m/; HalluLens https://arxiv.org/pdf/2504.17550. Most
IFEval numbers are self-reported by the vendor (Liquid's tables re-score competitors lower than their own cards).
GGUF sizes for the five spiked models were read from the official Hugging Face repos.

No published benchmark measures sub-1B models on role-play or safety, and the general finding is that smaller
models hallucinate more. Evidence from game work: Ubisoft's NEO NPC prototype needed writer-authored backstories,
guardrails and player-input analysis to avoid "flat, robotic" output and remained a prototype
(https://news.ubisoft.com/en-us/article/5qXdxhshJBXoanFZApdG3L/how-ubisofts-new-generative-ai-prototype-changes-the-nature-of-npcs);
an NPC-persona study found TinyLlama reached 55% persona factual consistency against 93% for Mistral-7B
(https://arxiv.org/html/2511.10277v1); **Arm's mobile demo fine-tuned Gemma 3 1B with LoRA on about 19K synthetic
samples built from an NPC profile, an intent table and 50 topics, and says engines handle about 400M parameters
efficiently on phones** (link above). Fine-tuning on our own bank is the realistic path if D is ever revisited.

### 3.4 Store, legal and precedent

- **Apple**: no guideline names generative AI. 1.2 (user-generated content: filtering, reporting, blocking,
  contact info) and 4.7 / 4.7.5 (chatbots: content flagging above the age rating, age gate) clearly bite on a
  cloud chatbot; a bundled or downloaded model producing NPC lines probably does not, but reporting and filtering
  are cheap insurance. Downloading **weights as data** is accepted practice (Core ML documents downloading and
  compiling models on device; a developer citing Apple DTS says weights do not violate 2.5.2), provided all code
  ships in the binary. The 2025 age-rating questionnaire (13+/16+/18+, mandatory answers since 31 Jan 2026) asks
  how features, including chatbot functionality, affect sensitive content. On-device processing is "not
  collected" in the privacy label. Foundation Models has its own acceptable-use rules. Sources:
  https://developer.apple.com/app-store/review/guidelines/, https://developer.apple.com/news/?id=updated-guidelines,
  https://developer.apple.com/documentation/coreml/downloading-and-compiling-a-model-on-the-user-s-device,
  https://developer.apple.com/forums/thread/793267 (second-hand), https://developer.apple.com/app-store/app-privacy-details/.
  A June 2026 revision reportedly tightened review of AI features with weak safety controls (second-hand;
  clause text not found).
- **Google Play**: the AI-Generated Content policy applies to apps whose AI generation is a central feature and
  requires prevention of restricted content and **in-app reporting without leaving the app**; static pre-written
  lines are out of scope. A model fits one on-demand Play Asset Delivery pack (up to 1.5 GB) or a plain HTTPS
  download; downloaded executable code is banned, data is fine. Sources:
  https://support.google.com/googleplay/android-developer/answer/13985936,
  https://support.google.com/googleplay/android-developer/answer/9859372,
  https://support.google.com/googleplay/android-developer/answer/16273414.
- **EU AI Act Article 50** has applied since 2 August 2026: users must be told they are interacting with an AI
  unless it is "obvious", and providers of systems generating synthetic text must mark it machine-readably. There
  is no hobby or open-source exemption for Article 50 (Art. 2(12)). **Human-reviewed, build-time text is outside
  Article 50.** Sources: https://artificialintelligenceact.eu/article/2/,
  https://www.bakerbotts.com/thought-leadership/publications/2026/september/eu-ai-act-article-50-transparency-obligations-go-live
  (Sep 2026); the "AI NPCs may be obvious" reading is commentary (Chambers, Aug 2026), not verified in the guidelines.
- **GitHub Pages** caps sites at 1 GB with a soft 100 GB per month bandwidth limit
  (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): a 230 MB model
  would have to be hosted elsewhere (Hugging Face's CDN), which adds a third-party request to a game that makes none.
- **Precedents**: Fortnite's AI Darth Vader said slurs within hours of launch (May 2025,
  https://decrypt.co/320500/fortnite-ai-powered-darth-vader-saying-slurs); Where Winds Meet players talked AI NPCs
  into handing over quest rewards (Nov 2025) — never let generated text decide game state; inZOI shipped its
  on-device NVIDIA ACE model as an opt-in "experimental" toggle (Mar 2025); Steam requires disclosing
  live-generated AI content and its guardrails. I found no documented store rejection of in-game AI dialogue.

## 4. The spike

### 4.1 What ran

- **Runtime 1, native llama.cpp** (node-llama-cpp 3.22.1, CPU only, prebuilt binaries from npm): stands in for a
  Capacitor llama.cpp plugin. JSON-schema grammar on every call.
- **Runtime 2, wllama 3.8.1 (llama.cpp compiled to WASM) in headless Chromium** (the repo's Playwright Chromium),
  served with and without COOP/COEP: stands in for the browser and WebView builds. No WebGPU (headless).
- **Models** (official Hugging Face repos, all ungated, 219-429 MB): LFM2-350M Q4_K_M (229 MB, LFM Open License),
  LFM2.5-350M Q4_K_M (229 MB, LFM Open License), Granite 4.0 350M Q4_K_M (237 MB, Apache-2.0), SmolLM2-360M-Instruct
  Q8_0 (386 MB, Apache-2.0; the official repo has only Q8_0), Qwen2.5-0.5B-Instruct Q4_0 (429 MB, Apache-2.0).
  Gemma 3 270M was not tested: the official repo is gated behind Google's terms.
- **20 situations from real data** (`situations.mjs`): every villager, every season, rain, storm and snow, 0 to 5
  hearts, a loved gift yesterday, a disliked gift, Clay taking a request, the Flower Show result, birthdays today
  and tomorrow, the Derby and the Fair tomorrow, ripe and dry crops, a tool upgrade, the board tally, partners
  with Clay, the Greenhouse, the year's end.
- **Tasks**: **A**, write a line from the facts, output `{topic: enum (the situation's whitelist), mood: enum,
line: string <= 110}`; **B**, "rewrite this authored line in your own voice, keep every fact"; **B2**, the same
  with "say it in different words" at temperature 0.9 (because B mostly copied). Prompts of 115 to 150 tokens.
- **Checks** (`checks.mjs`, what a runtime validator would do): every glyph in the 5x7 font, fits 4 rows of
  184 px using the game's own `measureText`, no item names, numbers or villagers outside the facts, no money
  claims or promises, a small unsafe-word list, AI self-reference, the speaker's own name. Then I read and scored
  every line by hand (`scores.md`): **G** good, **M** harmless filler, **V** verbatim copy, **X** wrong.

### 4.2 Speed and memory (desktop, Ryzen 7 5700X3D, Windows 11)

| Model                   | Runtime, threads                                     | Median TTFT   | Median line   | Decode tok/s | Prefill tok/s | Peak RSS |
| ----------------------- | ---------------------------------------------------- | ------------- | ------------- | ------------ | ------------- | -------- |
| LFM2.5-350M Q4_K_M      | native, 4                                            | 0.20 s        | 0.41 s        | 72           | 626           | 582 MB   |
| LFM2.5-350M Q4_K_M      | native, 2                                            | 0.44 s        | 0.89 s        | 55           | 340           | 576 MB   |
| LFM2.5-350M Q4_K_M      | native, 1                                            | 0.78 s        | 1.38 s        | 42           | 192           | 572 MB   |
| LFM2-350M Q4_K_M        | native, 4                                            | 0.20 s        | 0.50 s        | 99           | 678           | 578 MB   |
| Granite 4.0 350M Q4_K_M | native, 4 / 1                                        | 0.15 / 0.62 s | 0.60 / 1.64 s | 62 / 34      | 863 / 244     | 614 MB   |
| SmolLM2-360M Q8_0       | native, 4                                            | 0.36 s        | 1.37 s        | 29           | 369           | 630 MB   |
| Qwen2.5-0.5B Q4_0       | native, 4 / 1                                        | 0.21 / 0.90 s | 0.84 / 2.26 s | 56 / 31      | 584 / 162     | 856 MB   |
| LFM2.5-350M Q4_K_M      | **WASM, 1 thread (no COOP/COEP, like GitHub Pages)** | **9.9 s**     | **13.4 s**    | 11           | about 14      | n/a      |
| LFM2.5-350M Q4_K_M      | WASM, 4 threads (with COOP/COEP)                     | 2.7 s         | 3.8 s         | 33           | about 55      | n/a      |
| Granite 4.0 350M Q4_K_M | WASM, 1 thread                                       | 5.8 s         | 9.5 s         | 9.5          | about 25      | n/a      |
| Qwen2.5-0.5B Q4_0       | WASM, 1 thread                                       | **27.3 s**    | **40.4 s**    | 3.2          | about 5       | n/a      |

Peak RSS includes Node itself (about 105 MB). Constrained JSON output was valid 100% of the time in every run
(the grammar guarantees the shape, not the content). Loading took 0.3 to 1.3 s native and 2.6 to 4.8 s in WASM
(from local disk, not counting a download).

**A desktop is not a phone.** A Zen 3 core is roughly 2 to 4 times faster than a phone's big core and much faster
than a low-end phone's, and a desktop does not throttle. Read the native one- and two-thread rows as the
_best case_ for a phone, and the WASM rows as proof that the single-thread browser path is not viable at all:
if a desktop needs 6 to 10 s before the first word, a mid-range phone needs 30 s or more. Determinism: with a fixed
seed and the same thread count, 10 of 11 runs repeated the same first line; one Granite run (4 threads) did not, which is why generated lines would
have to be stored, not regenerated (section 6).

### 4.3 Quality

| Model            | A (write from facts): G / M / X | B (rewrite): V / G / M / X | B2 (different words): V / G / M / X | Bad A lines the string checks caught |
| ---------------- | ------------------------------- | -------------------------- | ----------------------------------- | ------------------------------------ |
| LFM2-350M        | 4 / 5 / 11                      | 1 / 7 / 5 / 7              | 0 / 4 / 3 / 13                      | 3 of 11                              |
| LFM2.5-350M      | 0 / 8 / 12                      | 0 / 4 / 6 / 10             | 0 / 3 / 7 / 10                      | 6 of 12                              |
| Granite 4.0 350M | 0 / 8 / 12                      | 15 / 0 / 1 / 4             | 12 / 1 / 2 / 5                      | 1 of 12                              |
| SmolLM2-360M     | 2 / 9 / 9                       | 14 / 0 / 5 / 1             | 14 / 0 / 2 / 4                      | 2 of 9                               |
| Qwen2.5-0.5B     | 0 / 5 / 15                      | 11 / 2 / 0 / 7             | 4 / 0 / 3 / 13                      | 2 of 15                              |

Read it like this: **no model wrote more than 4 good lines in 20 from facts, and every model wrote at least 9
wrong ones.** When paraphrasing, the models that kept the facts did so by copying (V); the models that varied
the wording broke facts or tone on roughly half the lines they changed. A few good lines did appear and show the
ceiling ("Three gold pumpkins bloomed like hope on the hill", LFM2.5 B2; "Tomorrow's Harvest Fair. Bring a
bountiful vegetable, a juicy fruit, and some wild surprises.", Granite B2), but at this rate a player sees a broken
line every few chats. Typical failures, verbatim:

- wrong speaker: Mara: "Thanks for the Daffodil, dear Mara"; Clay: "Well done, Clay."
- inverted facts: "Happy birthday, dear farmer!" (Finn's birthday); "It is Melons' birthday today. Between us, he
  loves Clay."; Rosa: "Today is hot. I have a lot of crops that need water." (the farmer's crops)
- contradictions: "The water's frozen" (the lake is open); "Catfish grow big when it rains" (they bite more)
- wrong numbers: "Only 2 extra potatoes for 5 gold" (5 potatoes for 180 gold)
- prompt leaks: "Finn fishes the lake in the woods all day. Quiet, dry humour..."; "I'm proud and competitive,
  but I'm not an AI."
- language switch: two Qwen lines in Chinese (also outside the font's glyphs)
- tone: Rosa: "About Holly yesterday, but you're a disappointment."
- grammar-valid but empty: "snow", "a", "afar"

**Conclusions from the spike**: (1) grammar-constrained decoding works everywhere and guarantees shape, not
truth; (2) string validators catch glyphs, length, foreign items and numbers, but most errors are semantic; (3)
speed is fine natively on a desktop and plausible natively on a mid-range phone, and not viable in a
single-threaded browser; (4) out of the box, 350M to 500M models are not good enough for this game's villagers in
either the A or B role. Caveats: one prompt style, English only, one temperature per task, no few-shot examples,
no fine-tuning, my own judgement as the only scorer. Few-shot prompts would lengthen prefill, which is the slow
part on a phone. Fine-tuning is the lever that could change the verdict, and the plan keeps it as the D gate.

## 5. Constraints for this game

| Constraint                                   | Today                                        | With a runtime LLM                                                                                                                                     | With architecture C                                                                           |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Download size                                | about 5 MB total (2.3 MB audio cached apart) | +220-430 MB model, +2-9 MB runtime; hosted off GitHub Pages                                                                                            | +15-40 KB of JSON (about 500-1,500 lines, gzip)                                               |
| Battery and heat                             | negligible                                   | each line is a CPU/GPU burst; sustained use throttles (S24 Ultra about 25 to 5 tok/s); Gemma 270M: 0.75% battery per 25 conversations on a Pixel 9 Pro | negligible                                                                                    |
| Latency vs one-thumb, five-minute sessions   | instant                                      | 0.3-3 s native mid-range, 7-12 s low-end, 10-40 s+ browser WASM; must be hidden by pre-generation                                                      | instant                                                                                       |
| Offline                                      | works (service worker)                       | works only after the download; first run needs a network                                                                                               | works                                                                                         |
| Determinism, save and replay                 | same line all day, no random stream          | output depends on runtime build, backend and thread count; one spike run differed for the same seed; generated text must be saved                      | same as today: pick by day and rule id                                                        |
| Content safety (cozy)                        | authored                                     | needs a blocklist, validators, fallback, in-app report, AI label; semantic errors slip through                                                         | authored and reviewed                                                                         |
| Hallucinated facts (prices, items, promises) | none                                         | frequent at this size (section 4.3)                                                                                                                    | none: facts come from slots filled by code                                                    |
| Fitting the 184 px sheet                     | tests prove it                               | must validate and re-generate or fall back                                                                                                             | tests prove it for every line and slot value                                                  |
| Localization                                 | ASCII-only 5x7 font; English                 | each language multiplies the review problem; small models are weakest outside English                                                                  | keyed lines translate like any string table (the font still needs glyphs: a separate project) |
| Store rules                                  | none special                                 | AI content policy (Play), reporting, age-rating answers, EU Article 50 label                                                                           | none special (human-reviewed text)                                                            |

## 6. Architectures

### A. Runtime LLM, grounded and constrained

```
GameState --facts()--> prompt (persona, 3-6 facts, topic whitelist)  [~130 tokens]
      |                        |
      |                  tiny LLM + JSON-schema grammar
      |                        |
      |                 {topic, mood, line}
      |                        v
      |              validate: glyphs, fit 4 rows, items/numbers/villagers in facts,
      |              blocklist, self-name, language  --fail--> authored fallback line
      |                        v
      +--------------------> NpcPanel (and save the line for the day)
```

Pros: in principle, endless reactive lines. Cons: the spike's A results (0 to 4 good in 20); the validator cannot
see inversions or wrong speakers; prefill-heavy (the slow part on phones); needs every risk mitigation in section 8.
A _strict_ A, where the model only picks an intent and slots and authored templates render the text, is safe but
adds nothing a rule database cannot do deterministically. **Verdict: no.**

### B. LLM as paraphraser of authored templates

```
GameState --> rule database picks line + slots (C's engine) --> "Your {crop} are ripe today."
                                                                     |
                                     tiny LLM: "say it in your voice" + grammar
                                                                     |
                                validate (as A) + every slot value still present
                                + similarity to the source within bounds --fail--> source line
                                                                     v
                                                               NpcPanel
```

Pros: facts come from the game; the fallback is always a good line. Cons: in the spike, models either copied the
line (no value) or broke it on about half the changes; to be worth its size it needs a fine-tuned model.
**Verdict: only as the optional layer of D, behind the gate.**

### C. No runtime LLM: rule database plus build-time authored banks

```
build time (developer machine or an agent session, never the player's device)
  rule skeletons (situation keys) --large model drafts--> candidate lines --human review--> dialogue.json
  lint: glyphs, fit (measureText), slots exist, no banned words, no duplicates, tone tags

runtime
  GameState + event log --facts registry--> matching rules (most specific wins, cooldowns)
            --> pick by hash(absoluteDay, npc, rule) --> fill slots from state --> NpcPanel / bark / letter
```

Pros: zero runtime cost, exact facts, offline, deterministic, reviewable, testable (every line proven to fit),
localizable, no store or legal surface. Cons: finite (but 500 to 1,500 lines with slots and combinations go a long
way in five-minute sessions); writing effort (an LLM drafts, a human edits: cheap). **Verdict: yes, the default.**

### D. Hybrid: C by default, optional on-device LLM

```
C picks the line (always) --> [Living villagers on AND model ready AND device capable]
       |                                   |
       |                         generate during idle (sleep screen, map change,
       |                         walking up to a villager) into a per-day cache
       |                                   |
       |                         B's validator --fail--> C's line
       v                                   v
   NpcPanel shows the cached variant if valid, else C's line; "report line" button; AI label
```

Pros: the base game stays small, safe and offline; enthusiasts on capable devices opt in. Cons: everything A/B
costs, for a subset of players; two content paths to test. **Verdict: a gated experiment after the systemic
milestones (M9), native-only first, only if the go/no-go criteria in section 9 pass.**

### E. Cloud inference

```
game --HTTPS--> proxy (Cloudflare Worker: key, rate limit, attestation) --> hosted model --> line --> validate
```

Pros: big-model quality; cheap at hobby scale (1,000 players x 10 lines a day at about 300 tokens is about $5 to
$15 a month on Groq, Cloudflare Workers AI, GPT-5 nano or Gemini Flash-Lite; second-hand prices, Sep 2026).
Cons: needs a server and a secret (a static site cannot hide a key), abuse protection, a spend cap; sends game
state off the device (privacy labels, Apple 5.1.2(i) consent for "third-party AI"); breaks offline play; review
lens of a chatbot (Apple 4.7, Play AI content). **Verdict: out of scope for a static personal project.** The one
cloud use worth keeping is _build time_: a large model drafting the C bank on the developer's machine.

## 7. Making villagers feel alive (no LLM needed), ranked by impact per effort

| #   | Feature                                                                                                                                                             | Player impact                                       | Effort here                                         | Fits                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | **Rule-based dialogue database** (lines react to season, weather, time, hearts, place, festivals, goals, farm state)                                                | High: every daily chat changes; the core of "alive" | Medium                                              | `data/dialogue.json`, `systems/dialogue.ts`, replaces `lineFor()`    |
| 2   | **Memory of recent events** (gifts, help, festival results, Clay's race, heart events, birthdays, jobs done)                                                        | High: "they noticed"                                | Small-medium; one new save field                    | event log state (v18) + `mechanics/memory.ts` on existing hooks      |
| 3   | **Ambient barks** (one-line bubbles when you pass: weather, holding their loved item, a ripe field, Clay after 2 PM)                                                | High: the world talks without a tap                 | Medium; perf-sensitive                              | `NpcRenderer`, same rules with `channel: "bark"`                     |
| 4   | **Small requests that react to the farm** ("Rosa: could you spare a Pumpkin?" when you have one ripe)                                                               | Medium-high: personal, uses what you grow           | Small: extends jobs                                 | `jobs.json` style rows with `when`, `registerStatWatcher`            |
| 5   | **Opinions and gossip** (a fact told to one villager reaches their friends next morning) and **NPC relationships** (Mara and Rosa are friends, Orin taught Clay...) | Medium: a village, not five kiosks                  | Small-medium                                        | `npcs.json` `ties`, a `morning` day hook                             |
| 6   | **Visible schedules and activities** (walk between spots, weather and day-of-week variants, a prop per activity)                                                    | Medium-high visually                                | Medium-large; needs art (idles exist, props do not) | `npcs.json` schedule variants, `NpcRenderer` + `systems/pathfind.ts` |
| 7   | **Seasonal arcs** (3-4 beats per villager per season: Finn and the golden salmon, Orin's winter forge)                                                              | Medium: reasons to come back                        | Medium (mostly writing)                             | rules + letters + heart-event style scenes                           |
| 8   | **Surprise moments** (rare, deterministic: Mara leaves seeds in the mailbox on the first snow; Clay waves from his cart)                                            | Medium: delight                                     | Small each                                          | rules with `chance` keyed by day hash, mail                          |

## 8. Risks and mitigations

| Risk                                         | Applies to | Mitigation                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Off-tone, unsafe or lore-breaking lines      | A, B, D, E | Default to C (reviewed text). In D: generate only from C's line, grammar, blocklist, self-name and speaker checks, slot-preservation check, fallback to C's line, a "report this line" button that also turns the line off locally, opt-in with an "AI-written" label, villagers never accept free-text input from the player |
| Hallucinated facts (prices, items, promises) | A, B, D    | Facts only through slots filled by code; generated text never changes state (no rewards, prices or quests from text); validator rejects item names, numbers or villagers not in the slots                                                                                                                                     |
| Size (220-430 MB)                            | D          | Opt-in, lazy, Wi-Fi prompt with the size; never in the precache; separate cache that survives releases; deletable from Options; native download in Capacitor                                                                                                                                                                  |
| Battery and heat                             | D          | Generate a handful of lines at idle moments (sleep screen, map change), not per frame; cap per day; skip on low battery (`navigator.getBattery` where available, native status in Capacitor) and when `reduceMotion`-like "battery saver" is set                                                                              |
| Latency                                      | D          | Never generate on the tap: show C's line instantly, use a cached variant only if it is ready                                                                                                                                                                                                                                  |
| Determinism and save/replay                  | D          | Store the chosen variant per villager per day in the save (a small `talk.cache` field), so a reload shows the same line; C's pick stays deterministic                                                                                                                                                                         |
| Store rules                                  | D, E       | Bundle all code, download only weights; Play AI-content reporting in-app; Apple age-rating answers for the worst plausible output; review notes; EU Article 50 label; no third-party data flow (on device only)                                                                                                               |
| Licences                                     | D          | Prefer Apache-2.0 (Granite, Qwen, SmolLM2); LFM Open License is fine below $10M revenue (keep notices); Gemma terms require passing on the prohibited-use policy and a NOTICE file; avoid non-commercial licences (MobileLLM-R1)                                                                                              |
| Hosting                                      | D          | GitHub Pages limits (1 GB site, about 100 GB a month) rule out hosting the model there; use the publisher's Hugging Face URL with a pinned revision and a hash check, or ship it in a Play asset pack / iOS Background Assets                                                                                                 |
| Localization                                 | all        | C: keyed lines, a per-locale bank, the font needs glyphs first; D: English-only, off in other locales                                                                                                                                                                                                                         |
| Writing load for C                           | C          | An LLM drafts in bulk at build time (an agent session is enough, no API key in the game), a human edits; lint and tests keep the bank honest                                                                                                                                                                                  |
| Scope creep in the systemic work             | C          | Each milestone small, scenario-first, measured; perf budgets per milestone (section 9)                                                                                                                                                                                                                                        |

## 9. Milestones

Every milestone follows `docs/EXTENDING.md` section 0: scenarios first, rules as pure functions in `systems/` with
unit tests, wiring in `mechanics/`, data in JSON with load-time validation, UI text proven to fit, e2e checks on
the scenarios with the await helpers and no fixed waits, `npm run verify:fast` per commit and `npm run verify`
before merge. Budgets: no milestone may push `perf.mjs` past 12 draws or 3.5 ms JS per frame or the pacing gates;
the entry bundle grows by at most the stated amount (gzip, measured by `scripts/check-bundle.mjs` plus a size line).

### M1. Talk rules: a rule-based dialogue database (replaces `lineFor`)

- **Goal**: every daily chat line reacts to the situation, deterministically, with exact facts, and remains
  provably within the sheet.
- **Files**: `src/data/dialogue.json` (new), `src/systems/dialogue.ts` (new: facts, matching, scoring, slot fill),
  `src/systems/friendship.ts` (`lineFor` delegates; birthday line becomes a rule), `src/data/index.ts`
  (validation), `src/ui/panels/NpcPanel.ts` (no layout change), `docs/EXTENDING.md` (a "Talk rules" section).
- **Data**: a rule is `{ id, npc | "any", channel: "chat", when: {...}, lines: ["..."], weight?, cooldownDays?,
priority? }`. `when` reuses the vocabulary of the tutorial conditions where it fits (`systems/tutorial.ts`:
  `day`, `map`, `minute`, `wet`, `stat`/`min`/`max`, `goal`, `any/all/not`) plus `season`, `hearts`
  (min/max), `weather`, `forecast`, `time` (morning/afternoon/evening), `festival` (`today`, `tomorrow`,
  `won`, `lost`), `rival` (`tookToday`, `leadBy`, `trailBy`, `partners`), `has` (carrying an item or family),
  `farm` (`ripe`, `dry`, `greenhouse`, `animalsHungry`), `birthday` (`self`, `npc`, `tomorrow`). Slots:
  `{crop}`, `{item}`, `{n}`, `{villager}`, `{festival}`, `{season}`, `{farmer}` (no player name exists today),
  resolved by a registered fact provider: `registerTalkFact(name, (state) => value | null)`, so a mechanic adds
  facts without editing the core. Specificity wins (more matched conditions beats fewer, then priority), then a
  pick by `hash(absoluteDay, npc, rule.id)` (no random stream), with a per-rule cooldown kept in stats
  (`talk.<rule>.day`). Today's 55 lines become the base rules (`hearts` tiers, `wet`), so nothing is lost.
- **Content target for M1**: about 15 situational rules per villager (75 rules, about 200 lines): weather and
  seasons, each festival's eve and day, Clay's race, ripe and dry fields, the current goal, birthdays (self,
  others', tomorrow), time of day. Lines drafted by an LLM in an agent session, edited by a human.
- **Scenarios** (new, real maps): `talk-rain-finn` (woods, rain, Finn 1 heart), `talk-festival-eve`
  (Spring 13, Mara 2 hearts), `talk-ripe-field-rosa` (farm, ripe parsnips, Rosa 3 hearts),
  `talk-clay-took-request` (town, day 8 after 14:00; reuses `town-clay-race` with the clock moved), and
  `talk-birthday-eve` (Spring 11, Mara).
- **Tests**: every line in every rule fits 4 rows at 184 px in the 5x7 font with the _longest_ value of each
  slot (pure, `measureText`); every character is a glyph; every slot has a provider; every rule is reachable (a
  generated state satisfies it); the same state gives the same line all day and across a save round trip;
  `lineFor` never reads `state.rng`; specificity ordering; cooldowns. e2e on each scenario: open the villager's
  sheet (`farm.tapButton('INTERACT')`, `farm.panel('npc')`) and read the line from the panel's state.
- **Acceptance**: in a 28-day simulated season (the sim bot, talking to everyone daily) no villager repeats a
  line within 7 days and at least half the chats use a situational rule; zero lines fail the fit test; save
  version unchanged.
- **Budgets**: dialogue JSON at most 25 KB gzip in M1; selection under 0.5 ms per chat on the perf profile (it
  runs once per sheet open, not per frame); no draw-call change.

### M2. Villager memory: a short event log

- **Goal**: villagers mention what happened recently: gifts (and the reaction), a heart event, a festival result,
  Clay taking or losing a request, a board season result, a job done for them, a birthday remembered or missed,
  your first harvest of a crop, a legendary fish.
- **Files**: `src/state/GameState.ts` (`villagers: { log: VillagerFact[] }`, at most 32 entries, oldest dropped),
  `src/systems/save.ts` (default, sanitize, **save version 18** with a migration that starts an empty log),
  `src/systems/memory.ts` (new: `remember(state, fact)`, `recent(state, kind, withinDays)`),
  `src/mechanics/memory.ts` (new: hooks into `giveGift`/`completeEvent` results through `gameEvents`
  (`friendsChanged`, `heartUp`), stat watchers for `festivalWins`, `rivalTook`, `jobsDone`, `legends`, and the
  existing day hooks for season ends), `src/systems/dialogue.ts` (facts `recent.gift`, `recent.festival`...).
  A fact is `{ day, kind, npc?, item?, n?, result? }`: ids and numbers only, so it is small and safe to sanitize.
- **Data**: about 40 memory rules ("Thank you again for the {item}. It's on my counter.", "Second place at the
  {festival}. Enjoy it. Next year is mine.").
- **Scenarios**: `memory-gift-yesterday` (Mara, a loved Daffodil logged yesterday), `memory-disliked-gift`
  (Rosa, Holly), `memory-after-flower-show` (Spring 15, won; Clay second), `memory-clay-took-request`.
  The scenario format gets a semantic `memory` key (a list of facts relative to today), validated like `friends`.
- **Tests**: log bounds and order; sanitize drops unknown villagers and items; migration 17 to 18; each hook
  records exactly once (gifting twice is impossible; festival recorded once); rules read only facts within their
  window; scenario round trip.
- **Acceptance**: in the scenarios the villager's line names the right item and event; a 28-day sim logs at
  most 32 facts at any time; old saves load with an empty log.
- **Budgets**: save grows at most 2 KB; no per-frame work.

### M3. Ambient barks

- **Goal**: the world talks: when the player walks within 2 tiles of a villager, a short bubble (at most 2 rows,
  about 24 characters a row) can appear for 2.5 s: weather, the time of day, the item in your hand ("Is that a
  Melon? For me?"), Clay after 2 PM, a reaction to a storm or the first snow. At most one bubble on screen, at
  most one per villager per in-game hour, never while a sheet is open, never over the dock.
- **Files**: `src/game/NpcRenderer.ts` (a bubble per shown villager, reusing the existing bitmap-font `Label`
  like the "!" marker), `src/systems/dialogue.ts` (`channel: "bark"`, shorter fit rule), `src/data/dialogue.json`
  (bark rules), settings (`barks: on/off` in Options, default on).
- **Scenarios**: `barks-town-noon` (town 12:00, Mara, Orin and Clay in reach), `barks-rain-woods`,
  `barks-holding-loved-item` (Clay, a Melon in hand).
- **Tests**: bark fit (2 rows at the bubble width); rate limits (pure); no bark while `panelOpen`; reduced motion
  shows the bubble without the pop tween. e2e: walk into reach (`farm.tapTile`), `wait.until` a bubble exists,
  screenshot for the critic.
- **Acceptance**: in `barks-town-noon` a bubble appears within one in-game minute of walking into reach and
  disappears after 2.5 s; no overlap with the "!" marker.
- **Budgets**: at most +1 draw call while a bubble shows (target 0: same font texture as the marker; measure it
  in `perf.mjs` with a bubble on screen), at most 0.1 ms JS per frame; bark matching runs once per game minute,
  not per frame.

### M4. Requests that react to the farm

- **Goal**: personal, one-off asks that use what the player grows or catches ("Rosa: could you spare a Pumpkin
  for my pie?" when the farm has a ripe pumpkin or the bag holds one), shown in the villager's sheet with a Give
  button and in Menu > Goal; reward friendship plus a remembered thank-you (M2) and sometimes a letter.
- **Files**: `src/data/requests.json` (new, like `jobs.json` rows with `when` from M1 and an `item`/`qty`),
  `src/systems/requests.ts`, `src/mechanics/requests.ts` (morning day hook posts at most one per day across the
  village; expires after 3 days), `NpcPanel` (a request row), Goal tab line.
- **Scenarios**: `request-rosa-pumpkin` (fall, ripe pumpkin on the farm), `request-finn-bait`.
- **Tests**: posting conditions, expiry, all-or-nothing reward, no request for an item the player cannot get
  this season, fit of the row text.
- **Acceptance**: a fall sim posts 3 to 8 requests a season, each satisfiable when posted; jobs and requests
  never ask the same villager twice the same day.
- **Budgets**: one row in an existing sheet; no draw change outside the sheet.

### M5. Opinions, gossip and NPC relationships

- **Goal**: the village is connected: `ties` between villagers (Mara and Rosa old friends, Orin taught Clay,
  Finn and Rosa neighbours on the lake path), a fact remembered by one villager reaches their ties next morning
  ("Rosa told me about your gold pumpkins!"), and villagers have opinions of player actions (Rosa approves of
  sprinklers and fertilizer, Clay is jealous of board wins, Finn notices legendary fish).
- **Files**: `src/data/npcs.json` (`ties`, `opinions`), `src/systems/memory.ts` (gossip: copy a fact as
  `heardFrom`), `src/mechanics/memory.ts` (a `morning` day hook, deterministic), dialogue rules for second-hand
  facts.
- **Scenarios**: `gossip-next-morning` (a loved gift to Rosa yesterday, Mara asked today).
- **Tests**: gossip is one hop, once, within 2 days; deterministic; respects the log bound.
- **Acceptance**: in the scenario Mara references Rosa's gift; no villager gossips about themselves.
- **Budgets**: none beyond M2.

### M6. Visible schedules and activities

- **Goal**: villagers walk between their spots instead of fading, and their spots vary with weather (Finn goes to
  the town pier when it storms; Rosa stays in on rainy mornings) and day of week (Orin closes the forge on day 7
  of each week); at a spot they do something visible (Finn's line in the water, Orin's sparks, Mara sweeping).
- **Files**: `src/data/npcs.json` (`schedule` entries gain `when` and `activity`), `src/systems/npcs.ts`
  (`npcLocation` picks the matching entry, plus the walking segment), `src/game/NpcRenderer.ts` (walk along a
  route from `systems/pathfind.ts`; activity frames), art (activity props and frames: owner and art agent).
- **Scenarios**: `villager-commute` (12:00 in town: Finn and Rosa arriving), `storm-schedules`.
- **Tests**: every schedule tile walkable (extend `tests/dev-scenarios.test.ts` style checks to schedules),
  routes exist between consecutive spots, a villager never stands on the player's tile, `villagerSpot` covers
  route tiles where building is blocked.
- **Acceptance**: no teleport in daylight on the shown map; frame pacing unchanged with two villagers walking.
- **Budgets**: walking villagers share the sprite atlas (0 extra draws); route planning once per schedule change,
  at most 2 ms (the tap-planning budget).

### M7. Seasonal arcs and surprise moments

- **Goal**: each villager has one small arc per season (3 or 4 beats, each a rule, a letter or a short heart-event
  style scene gated by date and facts), and a few rare surprise moments keyed by a day hash.
- **Files**: `src/data/dialogue.json` (arc beats as rules with `arc` and `beat`), `mail.json` (beat letters),
  `src/systems/dialogue.ts` (arc progress in stats `arc.<id>`), optional `events` reuse in `npcs.json`.
- **Scenarios**: one per first beat (`arc-finn-golden-salmon-1`, `arc-orin-winter-forge-1`), `surprise-first-snow`.
- **Tests**: beats in order, never skipped, never repeated; surprises at most once a season per villager.
- **Acceptance**: in a simulated year each villager's arcs complete if the player keeps chatting; none blocks a goal.
- **Budgets**: dialogue JSON at most 40 KB gzip in total after M7.

### M8. Build-time authoring pipeline (the safe use of an LLM)

- **Goal**: scale the bank without lowering the bar: an LLM drafts lines offline for rule skeletons; a human
  reviews; tooling lints.
- **Files**: `scripts/dialogue-lint.mjs` (fit with `measureText`, glyphs, slot names, banned words, duplicates and
  near-duplicates, per-villager voice tags, reading level), `agents/briefs/BRIEF-DIALOGUE.md` (voice sheets per
  villager, the rule format, the review checklist), a review file format (`dialogue.drafts.json`, never loaded by
  the game). Drafting happens in an agent session (no API key in the repo or the game).
- **Tests**: the lint runs in `verify:fast`; drafts cannot be imported by the game (bundle check).
- **Acceptance**: a 100-line batch goes from draft to merged in one review pass with zero lint failures.
- **Budgets**: zero runtime.

### M9 (optional, gated). "Living villagers" experiment (architecture D)

Only after M1 to M8, and only if the gate passes. Steps, each a stop point:

1. **Offline evaluation, no game change**: fine-tune (LoRA) a candidate (Gemma 3 270M or 1B, LFM2.5-350M,
   Qwen3-0.6B, Granite 4.0 H-350M) on the M1-M8 bank as "source line plus facts -> variant" pairs, the Arm recipe;
   score blind on 200 held-out situations. **Gate: at least 90% G, at most 2% X, at most 300 MB quantized.**
   Also test the OS models (Apple Foundation Models with `@Generable`, Gemini Nano with structured output), which
   need no download.
2. **Device measurement**: the chosen model through a thin Capacitor llama.cpp plugin (native) on a mid-range
   Android and an iPhone 13-class device. **Gate: median line under 1.5 s, under 3% battery per 30-minute
   session, no thermal throttling in a 5-minute session.**
3. **Opt-in feature** in the native apps only (the web build keeps C), as specified in section 10.

## 10. If D ever ships: prompt, grammar, fallback, opt-in and caching

**Prompt** (short: prefill is the slow part on phones; about 100 tokens):

```
system: You are {name}, {one-line voice from npcs.json}. You speak in a cozy farming game.
user:   Say this in your own words, keep every [fact]: "{C line with [slot] markers}"
```

**Grammar** (GBNF or JSON schema; the line is the only free field):

```json
{
  "type": "object",
  "required": ["line"],
  "properties": {
    "line": {
      "type": "string",
      "minLength": 12,
      "maxLength": 110,
      "pattern": "^[A-Za-z0-9 !\",.:;'?()-]+$"
    }
  }
}
```

The pattern restricts output to the font's glyphs, which also stops language switches.

**Validator** (all must pass, else C's line): fits 4 rows (`measureText`); every slot value from C's line appears
unchanged; no other item names, numbers or villager names; not the speaker's own name; blocklist; not identical to
the source (otherwise there was no point); length ratio 0.6 to 1.6 of the source. Then show it with a small
"AI" tag and a long-press "Report line" that hides it, logs the source rule locally and falls back for that rule.

**When to generate**: never on the tap. Pre-generate tomorrow's variants for the villagers you are likely to meet
on the sleep screen (about 5 lines) and on map changes; keep at most one per villager per day in
`talk.cache` in the save (so replays and reloads match). If none is ready, C's line shows: the player never waits.

**Opt-in UX**: Options > "Living villagers (experimental)": a sheet that says what it does, that lines are
AI-written on the device, the download size and Wi-Fi advice, battery use, and that it can be turned off and the
model deleted any time. Shown only on capable devices (native, enough RAM, the model's runtime available).
Off by default; nothing is downloaded until the player confirms.

**Download and caching**:

- Web (only if the web build ever gets D, with WebGPU): a separate Cache API cache (`tiny-acre-model`, like the
  existing `tiny-acre-audio` that survives releases, in `scripts/sw-plugin.mjs`), never in the precache list;
  `navigator.storage.persist()` requested on opt-in; pinned revision URL plus a SHA-256 check; resumable by
  ranged chunks (wllama loads split GGUF files of at most 512 MB in parallel); a progress row in Options.
- Capacitor: a native download into the app sandbox (resumable plugin; `@capacitor/file-transfer` is foreground
  only), or a Play on-demand asset pack and iOS Background Assets; memory-mapped by the native runtime; the
  WebView never holds the weights. Delete from Options.
- Never on GitHub Pages (1 GB site and bandwidth limits): the publisher's Hugging Face URL, pinned.

## 11. Open questions for the owner

1. **Do you agree to skip a runtime LLM for now** and put the effort into M1 to M8 (rule-based talk, memory,
   barks, requests, gossip, schedules, arcs, the authoring pipeline)?
2. **Writing voice**: can an agent draft villager lines with you as the final reviewer, and do you want a voice
   sheet per villager first (M8's brief) before M1's content?
3. **A player name**: villagers can only say "farmer" today. Add a name at New Game (one text field; needs a
   keyboard on mobile and save version handling)?
4. **Barks on by default?** They are the most visible change and the only one with a per-frame cost.
5. **Walking villagers (M6)** need new art (walk cycles exist for the farmer, not activity props for villagers).
   Worth an art round?
6. **Localization**: is any language besides English planned? It decides whether the font gets accented glyphs
   and whether rule keys must be translation-ready from M1.
7. **If you still want to try an LLM**, is a native-only, opt-in experiment acceptable (the web build stays as
   it is), and would you accept the Gemma terms if a fine-tuned Gemma 3 270M or 1B wins the evaluation?
8. **Age rating and audience**: is the game meant for children (Google Families)? That would rule out runtime AI
   text entirely.
