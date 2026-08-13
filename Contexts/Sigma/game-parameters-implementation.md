# Game parameters — what's common, what's novel, what's environment

**Status:** local working report, 2026-08-13. Not a decision record yet.

**Sources read**

| Source | Ref |
|---|---|
| Godot parameter atlas | `godot-nanisca@origin/develop:docs/Game-Parameters-Reference.md` (auto-generated from `get_game_parameter()` call sites) |
| Godot per-activity defaults | `godot-nanisca@origin/develop:common/autoloads/config_manager/game_state_defaults.gd` |
| Godot runtime seams | `common/scenes/activity_main/activity_main.gd`, `common/core/hints/hint_director.gd`, `common/scenes/waffle/waffle.gd`, `addons/nanisca/pck_config_builder/configs/**` |
| Shared systems | `content/imports/shared-systems/{commonParams,environments,feedbackTypes,hints}.json` |
| Canonical schema | [`web/server/games/parameters.ts`](../../web/server/games/parameters.ts), [`web/server/shared_systems/types.ts`](../../web/server/shared_systems/types.ts) |
| Authored corpus | 57 specs in `content/seed/games/` + `content/imports/games/` |

**Caveat on the atlas.** It catalogues `get_game_parameter()` call sites only. Anything an activity configures through `@export` values or scene resources is invisible to it — so "the game doesn't implement X" below means *X is not runtime-configurable*, not that the behaviour is absent.

---

## 1. Executive summary

Five findings drive everything else:

1. **The two sides don't share a shape.** Content-collider emits a structured block (`gameParameters.novel[]` / `gameParameters.content[]` + `systemParameters{}`, camelCase). Godot consumes a flat snake_case `game_parameters` dict per variant config. Nothing translates between them today — every Godot variant config in `addons/nanisca/pck_config_builder/configs/` is hand-written. **A compiler is the missing piece**, not more parameters.

2. **The common contract is authored but barely implemented.** Of the 9 `commonParams` fields, Godot implements 4½: `rounds`, `skip_intro`, `skip_outro`, `skip_demo`, and `show_progress_bar` (one activity only). `progressMode`, `progressType`, `hideTeacher` have **no runtime at all**; `progressPosition` supports only TOP/BOTTOM against a contract that allows left/right.

3. **`rounds` is being authored twice.** It is `commonParams.numberOfRounds` *and* a hand-written novel param in several specs (`n_trace_and_count_number-names` → `numberOfRounds`; `bubble_pop_review` → "Number of rounds"; `match_card_to_drop_zone_numerals` → "Number of rounds"). Same for feedback: it is `systemParameters.feedback.modes` *and* a novel param called "Feedback" in 10 specs. These are the strikethroughs in §5.

4. **`minimal_intro` is common in all but name.** Nine activities read it. It belongs in `commonParams` as part of an `introMode` tri-state, not as a per-game novel param.

5. **Environment doesn't exist on the Godot side.** `ActivityMain` reads a raw `background_path` defaulting to a hardcoded `res://…/environments/savanna/savanna_plain.svg`. The registry, the phase-split backgrounds, the flat-colour fallback and the content-bank affinity in `environments.json` have no runtime counterpart. This is the single highest-leverage change: one `environment` key replaces a path, a prop set, an audio id, and (in `select_line_x_items`) eight separate visual params.

**Corpus health, 57 seed specs:** 24 have zero novel params (placeholders); 4 declare content params; 13 declare environments; **0 have customised `commonParams`** — every spec carries the untouched default block, while Godot's per-activity round defaults are 1, 3, 4, 5 and -1. The authored side is as thin as the runtime side.

---

## 2. The two contracts

### Content-collider (canonical, `1.2-DRAFT`)

```jsonc
{
  "gameParameters": {
    "novel":   [ { "name", "mode": "range|text", "min", "max", "levels": [...] } ],
    "content": [ { "key", "type": "contentBank|string|count", "logicComment", "default" } ]
  },
  "systemParameters": {
    "commonParams": { /* the 9 fields in §3 */ },
    "supportedEnvironments": ["savanna", "riverside"],
    "backgroundType": "scene" | "color" | "none",
    "feedback": { "modes": ["instant", "delayed"] },
    "hintsSystem": true
  }
}
```

`novel` carries a **5-level difficulty grid**; `content` carries **typed slots** (bank slice / string / integer); `systemParameters` carries **single per-game values**.

### Godot (as consumed today)

```jsonc
{
  "game_parameters": { "skip_demo": true, "rounds": 5, "item": ["6"],
                       "background_path": "res://…/savanna/savanna.svg" },
  "game_strings": {},
  "game_assets": {}
}
```

Flat, snake_case, single-valued, no level grid, no types.

### The compile seam

A build step must resolve **spec + chosen level + chosen environment → one flat dict**. The rules it needs:

| Rule | Detail |
|---|---|
| Case | `numberOfRounds` → `number_of_rounds` (or keep Godot's `rounds` alias — see §3) |
| Level collapse | `novel[].levels[n]` → scalar; `mode:"range"` yields `{min,max}` or a drawn value depending on the key |
| Polarity flip | `showIntro: true` → `skip_intro: false` (three inversions: intro/outro/tutorial) |
| Feedback fold | `feedback.modes` → whichever of `delayed_feedback` / `feedback_type` / `feedback` the activity reads (§3) |
| Environment expand | `environment: "riverside"` → `background_path` + prop textures + ambience, via the registry |
| Content resolve | `content[]` bank slices → the concrete items/audio ids the activity expects |

Recommendation: **do the flip and the fold once, in the compiler, and normalise the Godot keys** rather than teaching 19 activities a new vocabulary. But the three inversions (`skip_*`) are worth fixing at the source — a negative boolean that the compiler must invert is a permanent bug magnet.

---

## 3. Common parameters — definition, intent, status

### The nine `commonParams`

| Parameter | What it's for | Godot key today | Status |
|---|---|---|---|
| `numberOfRounds` (int 1–10, dflt 5) | Main-phase rounds per session | `rounds` | **Implemented** — 17 of 19 activities. Missing in `multiple_choice`, `set_the_scene` |
| `showIntro` (bool, dflt true) | Play the intro cut-scene | `skip_intro` (**inverted**) | **Implemented** in `ActivityMain` — universal |
| `showOutro` (bool, dflt true) | Play the outro cut-scene | `skip_outro` (**inverted**) | **Implemented** in `ActivityMain` — universal |
| `showTutorial` (bool, dflt false) | Play the demo before round 1 | `skip_demo` (**inverted**) | **Implemented** in `ActivityMain` — universal. Note the contract defaults it **off** while Godot defaults `skip_demo` **false** (demo on) — opposite defaults |
| `showProgress` (bool, dflt true) | Render the progress indicator at all | `show_progress_bar` | **Partial** — read by `multiple_choice` only; the Waffle owns `show_progress_bar()` / `hide_progress_bar()` but no other activity exposes it |
| `progressMode` (`answer`\|`round`\|`sequence`) | What advances the indicator | — | **Not implemented** |
| `progressType` (`stars`\|`animalTracks`\|`animalTrackPairs`\|`hearts`) | Indicator artwork family | — | **Not implemented** — `CommonProgressBar` is a bare `TextureProgressBar` with no artwork families |
| `progressPosition` (`top`\|`bottom`\|`left`\|`right`) | Screen edge it docks to | `Waffle.PROGRESS_BAR_POSITION` | **Partial** — enum is `{TOP, BOTTOM}`; `left`/`right` are uncons­tructable. Not exposed as a game parameter |
| `hideTeacher` (bool, dflt false) | Hide the teacher character entirely | — | **Not implemented** |

### The three other system parameters

| Parameter | What it's for | Godot key(s) | Status |
|---|---|---|---|
| `feedback.modes` (⊆ `instant`, `delayed`; ≥1) | Which correctness-timing modes the game supports. `instant` = confirm on each action; `delayed` = confirm on CHECK press | `delayed_feedback` (bool) ×5 · `feedback_enabled` + `feedback_type` (String) ×1 · `feedback` (bool) ×1 | **Implemented three different ways.** `new_guided_counting_grid`'s `feedback_type: "delayed"` is closest to canonical |
| `hintsSystem` (bool, dflt true) | Master switch for the auto-hint ladder | `auto_hints_enabled` | **Implemented** in `HintDirector`. Godot also reads `hint_max_severity` (int, dflt 3) — **not in the contract** |
| `supportedEnvironments` + `backgroundType` | Which settings the game can be dressed in; how the backdrop paints | `background_path` (raw `res://` path) | **Not implemented** — see §4 |

### Proposed additions to the common contract

These are things the Godot side already treats as cross-cutting but the contract doesn't name:

| Proposed | Replaces | Why |
|---|---|---|
| `introMode: "full" \| "minimal" \| "none"` | `showIntro` + `minimal_intro` | `minimal_intro` is read by **9 of 19** activities. A tri-state removes both the novel param and the `skip_intro` inversion |
| `tutorialMode: "full" \| "simple" \| "none"` | `showTutorial` + `simple_demo` | Same shape, one level down; `letter_number_tracing.simple_demo` and `guided_counting.demo_target` are demo-shaping, not game rules |
| `hintMaxSeverity: int (0–3)` | — | `HintDirector` already reads it; the contract has only the on/off bit |
| `pacing: { betweenScreens, betweenQuestions, betweenRounds }` (seconds) | `TimerManager` defaults | Three `time_transition_between_*` params exist in shared code with no authored home |

Counter-proposal worth considering: **drop** `progressMode` / `progressType` / `hideTeacher` from the contract until there's runtime for them. Authoring fields nothing can honour is how the corpus ends up with 57 identical default blocks.

---

## 4. Environment — one key, everything it should select

An environment key is a **dressing selector**. Picking `savanna` or `spaza-shop` should decide, in one move:

| What it selects | Registry field | Godot today |
|---|---|---|
| Backdrop art, split by phase (intro / gameplay / outro) | `backgrounds.{intro,gameplay,outro}[]` (asset manifest ids) | One flat `background_path`, no phase split |
| Flat backdrop colour when `backgroundType: "color"` | `defaultBackgroundColor` | Nothing |
| Art folder root | `assetCategory` → `res://common/shared-game-assets/environments/<assetCategory>/` | Path is hand-written per variant config |
| Prop / item art sets | *(not yet modelled)* | Hand-passed per game: `item_textures`, `short_line_texture`, `images`, … |
| Ambience & SFX flavour | *(not yet modelled)* | `item_pop_audio_id: "leaf_sfx"` |
| Which content banks make sense here | `contentBanks[]` | Nothing |

### Target contract

```jsonc
"game_parameters": {
  "environment": "riverside",     // registry key; "none" = play unstyled
  "background_type": "scene"      // scene | color | none
}
```

…replacing `background_path` entirely. Everything else resolves from the registry at load.

### Gaps to close first

- **Key ↔ folder mismatch.** `riverside` → `river/`, `spaza-shop` → `spaza_shop/`. The `assetCategory` field already exists to absorb this — but only 4 of 7 registry entries set it.
- **Three environments have no art.** `home`, `market`, `village-path` have no `assetCategory` and no folder under `environments/`. Godot art exists for `river`, `savanna`, `school`, `spaza_shop` only.
- **Phase split is filename convention, not manifest.** The art is already flavoured (`savanna_plain`, `savanna_reveal`, `spaza-shop_outro_flat`, `school_interior_zoomed`, `river_girl_positive`) but nothing binds those names to the registry's `backgrounds.{intro,gameplay,outro}` ids. Two of seven entries populate `backgrounds` at all.
- **`defaultBackgroundColor` has no consumer.** `backgroundType: "color"` is authorable on all 57 specs and honoured by none.
- **The hardcoded default is a savanna.** `GameStateDefaults.CommonDefaults.BACKGROUND_PATH` — every activity that isn't told otherwise plays on savanna plain.

**Layout vs environment.** Keep these separate. Environment selects *art*; layout (`show_grid`, `item_scale`, `card_orientation`, `waffle_template`) is game geometry and should stay with the game. Note `meta.layoutTemplate` was retired from `GameMeta` — `set_the_scene`'s `waffle_template` currently has no home in the spec at all.

---

## 5. Per-game breakdown

Legend: ~~struck~~ = replace with a common / content / environment parameter. **Bold** = genuinely novel, keep.

---

### `bubble_pop` — CC: `bubble_pop_review`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ → `numberOfRounds` · ~~`minimal_intro`~~ → `introMode` · ~~`number_range`~~ → content · ~~`content_json`~~ → content slots · **`bubble_fall_seconds`** · **`bubble_fall_seconds_min`** · **`bubble_fall_seconds_max`** · **`bubble_spawn_interval`** · **`max_bubbles_on_screen`** · **`required_pops_per_round`** |
| **Spec novel params** | ~~"Number of rounds"~~ · **"Max bubbles"** · **"Bubble speed"** · **"Variations of target"** · **"Number of targets on screen"** · **"Number of targets per round"** · **"Target shows on screen"** |
| **Common implemented** | rounds, intro/outro/tutorial (via ActivityMain) |
| **Common missing** | showProgress, feedback modes (instant-only by nature — declare it), environments (spec has `[]`) |
| **Content needed** | `targets` (contentBank, number bank slice) — replaces `number_range` **and** the `content_json` blob. Spec already declares a `TargetNum` slot; wire it |
| **Environment** | Needed. Bubbles float over any backdrop — all 7 keys viable |
| **Note** | `content_json: String` is a JSON blob passed as a parameter. This is the clearest case for typed content slots replacing stringly-typed config |

---

### `guided_counting` — CC: `counting_dots`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ · ~~`delayed_feedback`~~ → `feedback.modes` · ~~`demo_target`~~ → tutorial content · **`game_max_dots`** · **`counting_in_2s_enabled`** · **`with_randomness`** |
| **Spec novel params** | ~~"Feedback"~~ · ~~"Number Range"~~ → content · **"Counting pattern"** |
| **Common implemented** | rounds, intro/outro/tutorial, feedback (as `delayed_feedback`) |
| **Common missing** | progress, environments |
| **Content needed** | `dotRange` (count) — spec's "Number Range" is content, not difficulty |
| **Environment** | Needed |
| **Note** | `counting_in_2s_enabled` (bool) and the spec's "Counting pattern" (text levels) model the same thing at different resolutions. Prefer the spec's — skip-counting is 2s/5s/10s, not a boolean. **Likely superseded by `new_guided_counting_grid`** — confirm before investing |

---

### `l_alphabetic_principle_intro_to_letter_names` — CC: `l_tap_the_letter` / `letter_select`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`feedback`~~ → `feedback.modes` · ~~`set_number`~~ → content · ~~`current_round`~~ → **not a parameter** |
| **Spec novel params** | (`l_tap_the_letter`) **`distractorCount`** · **`promptMode`** · **`letterCase`** — none implemented in Godot |
| **Common implemented** | rounds, intro/outro/tutorial, feedback (as `feedback` bool) |
| **Common missing** | progress, environments (spec says `school`) |
| **Content needed** | `letterSet` (contentBank slice) — replaces `set_number: int` pointing at a hardcoded set |
| **Environment** | `school` per spec |
| **Note** | **`current_round` is runtime state leaking into config.** It has a default of 1 and is read as a parameter; nothing should be able to set it. Remove. After the strikethroughs this activity has **zero novel params** — it is fully expressible in common + content |

---

### `l_listening_grid`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ — that's all |
| **Spec counterpart** | None obvious (`l_tap_the_first_sound` is closest) |
| **Common implemented** | rounds, intro/outro/tutorial |
| **Common missing** | everything else |
| **Content needed** | `soundSet` / `wordSet` (contentBank slice) |
| **Novel it should have** | grid dimensions (rows × cols), distractor count, replay-audio allowance |
| **Environment** | Needed |
| **Note** | Under-parameterised — recently migrated to MVVM+FSM (`cd1e8347`), so the parameter surface is the next step, not a rewrite |

---

### `l_match_word`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ — that's all |
| **Spec counterpart** | `l_tap_the_word` (**`distractorCount`**, **`wordSimilarity`**) — neither implemented |
| **Content needed** | `wordSet` (contentBank slice) |
| **Novel it should have** | `distractorCount`, `wordSimilarity` (the spec already names them), matching mode |
| **Environment** | Needed |

---

### `letter_number_tracing` — CC: `trace` / `number_tracing_placeholder`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`simple_demo`~~ → `tutorialMode` · ~~`item`~~ → content · **`auto_complete_mistakes`** |
| **Spec novel params** | ~~"Demo"~~ → `tutorialMode` · **"Outline for letter/number present"** · **"Guide"** — neither implemented |
| **Common implemented** | rounds, intro/outro/tutorial |
| **Common missing** | progress, feedback modes, environments |
| **Content needed** | `glyphSet` (contentBank slice) — `item: Array[String]` defaulting to `["A"]` is a content slot wearing a parameter's clothes |
| **Environment** | Needed. The one shipped variant config hardcodes `…/savanna/savanna.svg` |
| **Note** | The spec's tracing affordances (outline present, guiding arrow — cf. `guidingArrowForTrace` in `n_trace_and_count`) are authored but unimplemented. This is the largest authored-vs-runtime gap on a literacy game |

---

### `multiple_choice` — CC: `multiple_choice`

| | |
|---|---|
| **Godot params** | ~~`show_progress_bar`~~ → `commonParams.showProgress` · ~~`questions`~~ (String) → content |
| **Spec novel params** | ~~"Show if right or wrong"~~ → `feedback.modes` · **"Number of answer tiles"** · **"Read answers"** |
| **Common implemented** | intro/outro/tutorial, showProgress (**the only activity that does**) |
| **Common missing** | **`numberOfRounds` — this activity does not read `rounds` at all.** Also feedback modes (spec declares `delayed`) |
| **Content needed** | `questions` as typed slots. Spec declares a `content1` slot — wire it and drop the JSON string |
| **Environment** | Spec declares **all 8** keys (`none` + 7). Nothing honours them |
| **Note** | The most environment-ready spec in the corpus and the least environment-aware activity. Best proving ground for the environment key |

---

### `n_guided_counting`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ — **zero novel params** |
| **Note** | Fully expressible in common params. Almost certainly superseded by `new_guided_counting_grid`; confirm and retire rather than parameterise |

---

### `n_l_match_card_to_drop_zone` — CC: `match_card_to_drop_zone_numerals`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ · ~~`content_family`~~ → content · **`card_count`** · **`zone_count`** · **`distractors`** · **`zone_selection`** · **`matching_type`** · *(layout)* `show_grid`, `item_scale`, `card_orientation` |
| **Spec novel params** | 19 authored, ~~"Number of rounds"~~ and ~~"Feedback"~~ struck. Implemented: card counts, distractor cards, distractor drop zones, card layout. **Not implemented:** "Card background", "% new content", "Distractor variance", "Wrong answer behaviour", "Placed card behaviour", "Card behaviour on pickup", "Number of correct matches per card", "Drop box order", item-layout vertical/horizontal |
| **Common implemented** | rounds, intro/outro/tutorial |
| **Common missing** | feedback modes (spec: `instant`), progress, environments (spec: `village-path`) |
| **Content needed** | `cards` (contentBank slice) — replaces `content_family: "teen_numbers"`, a string key into hardcoded sets |
| **Environment** | `village-path` per spec; "Card background" is arguably environment-owned |
| **Note** | Widest authored-vs-implemented gap in the corpus: 19 authored vs 8 honoured. Worth a triage pass — some of those 19 read like design notes rather than parameters |

---

### `n_select_shelf` — CC: `n_select_shelf`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`delayed_feedback`~~ → `feedback.modes` · **`number_of_shelves`** · **`number_of_items_per_shelf`** · **`item_distribution`** |
| **Spec novel params** | ~~"Feedback"~~ · ~~"Items"~~ → content · **"Number of shelves"** · **"Number of items per shelf"** |
| **Common implemented** | rounds, intro/outro/tutorial, feedback |
| **Common missing** | progress, environments (spec declares `home`, `school`, `spaza-shop`, `market`) |
| **Content needed** | `stock` (contentBank slice) — the spec's "Items" novel param is content |
| **Environment** | Strong fit: shelf contents *are* the environment (spaza shop vs market vs home). `env.contentBanks` should drive the stock |
| **Note** | Does not read `minimal_intro`, unlike its sibling `select_line_x_items` — inconsistent |

---

### `n_trace_and_count_number_names` — CC: `n_trace_and_count_number-names`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ · ~~`delayed_feedback`~~ · ~~`min_number`~~ / ~~`max_number`~~ → content · **`sequential`** · **`tens_frame_prefilled`** · **`show_item_numbers`** |
| **Spec novel params** | ~~`numberOfRounds`~~ (**duplicates `commonParams`**) · ~~`feedback`~~ · ~~`numbersVisibleToSelectFrom`~~ → content · **`tensFrameAppearance`** (= `tens_frame_prefilled`) · **`numberAppearsOnItemWhenTransparent`** (= `show_item_numbers`) · **`guidingArrowForTrace`** ✗ · **`numberOfTensFrames`** ✗ · **`totalNumberOfObjectsOnScreen`** ✗ · **`SelctItemMechanic`** ✗ *(sic — typo in the seed)* · **`NumberSelect`** ✗ |
| **Common implemented** | rounds, intro/outro/tutorial, feedback |
| **Common missing** | progress, environments (spec has `[]` but the action sequence is explicitly a river bank) |
| **Content needed** | `numbers` (contentBank slice) replacing `min_number`/`max_number`; `countables` (contentBank) for the huts/snakes/frogs set currently living in `content.options[].items` |
| **Environment** | **`riverside`** — the spec's own `content.defaultOption` is `river_bank` and `river/` art exists. Set it |
| **Note** | Best-documented spec in the repo and still carries a duplicated `numberOfRounds` plus a typo'd param name. Fix both when the compiler lands. `sequential` has no spec counterpart — add it |

---

### `new_guided_counting_grid` — CC: `counting_grid`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ · ~~`feedback_enabled`~~ + ~~`feedback_type`~~ → `feedback.modes` · ~~`min_target`~~ / ~~`max_target`~~ / ~~`target`~~ → content |
| **Spec novel params** | ~~"Target number"~~ → content · ~~"Feedback"~~ · ~~"Feedback type"~~ · **"Number of tens frames"** ✗ |
| **Common implemented** | rounds, intro/outro/tutorial, feedback (**closest to canonical — `feedback_type` already takes `"delayed"`/`"instant"` strings**) |
| **Common missing** | progress, environments |
| **Content needed** | `targets` (count range) |
| **Environment** | Needed |
| **Note** | **After the strikethroughs, zero novel params survive on the Godot side** — the grid is entirely common + content. Adopt its `feedback_type` spelling as the canonical Godot key |

---

### `see_and_say` — CC: `see_and_say`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ · ~~`items`~~ → content |
| **Spec novel params** | ~~"Demonstration"~~ → `tutorialMode` · **"Repeat back"** ✗ · **"Feedback for no audio"** ✗ |
| **Common implemented** | rounds, intro/outro/tutorial |
| **Common missing** | progress, feedback modes, environments |
| **Content needed** | `prompts` (contentBank slice). `items: Array[Dictionary]` of `{text, audio_id}` is exactly a bank slice with audio bindings — the strongest argument in the codebase for typed content slots |
| **Environment** | Needed; `main.gd` already touches environment/background code |

---

### `select_line_x_items` — CC: `select_line_with_x_items`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ · ~~`delayed_feedback`~~ · **`number_of_lines`** · **`number_of_items_per_line`** · **`item_distribution`** · ~~`short_line_texture`~~ ~~`long_line_texture`~~ ~~`item_textures`~~ ~~`item_pop_audio_id`~~ ~~`show_left_trunk`~~ ~~`show_right_trunk`~~ ~~`branch_rotation`~~ ~~`items_behind_line`~~ → **all environment** |
| **Spec novel params** | **"Number of lines"** · **"Number of items per line"** · **"Same or mixed items"** ✗ |
| **Common implemented** | rounds, intro/outro/tutorial, feedback |
| **Common missing** | progress, environments |
| **Content needed** | Spec already declares `item` and `content2` slots — wire them |
| **Environment** | **The poster child.** Eight of fourteen parameters are tree/branch/leaf dressing: trunk visibility, branch rotation, line textures, item textures, the `"leaf_sfx"` pop sound, z-ordering. One `environment: "savanna"` should supply all eight |
| **Note** | Prove the environment key here first — the payoff is measurable and the game is already spec-backed |

---

### `set_the_scene`

| | |
|---|---|
| **Godot params** | ~~`waffle_template`~~ → layout · ~~`steps`~~ → `actionSequence` |
| **Spec counterpart** | None |
| **Note** | Not a game — it's a cut-scene player whose `steps: Array[Dictionary]` is an action sequence passed as a parameter. Two options: (a) treat it as engine and exclude it from the parameter contract, or (b) make it the runtime for spec `actionSequence.core[]`, which would let every spec's authored intro/demo/outro actually play. **(b) is the interesting one** and deserves its own investigation. `waffle_template` needs a home now that `meta.layoutTemplate` is retired |

---

### `shadow_select` — CC: `shadow_select`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`images`~~ → content + environment |
| **Spec novel params** | **"Parameter"** — a literal placeholder; the spec is unauthored |
| **Common implemented** | rounds, intro/outro/tutorial |
| **Common missing** | everything else |
| **Content needed** | `silhouettes` (contentBank slice). Current default is three hardcoded `res://common/assets/art/{car,dog,house}.png` — not village content, not localisable |
| **Novel it should have** | distractor count, silhouette similarity, rotation allowance |
| **Environment** | Needed — the object set should follow the environment (savanna animals vs spaza goods) |
| **Note** | Spec needs authoring before the runtime work is worth doing |

---

### `sorting_boxes` — CC: `sorting_boxes`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ · ~~`minimal_intro`~~ · ~~`delayed_feedback`~~ · ~~`card_faces`~~ / ~~`numbers`~~ → content · **`boxes_per_round`** · **`cards_per_round`** · **`number_grouping`** · **`scattered_cards`** · **`ordered_cards`** |
| **Spec novel params** | ~~"Feedback"~~ · **"Number of [boxes]"** · **"Number of [items] total"** · **"Box specificity & labels"** ✗ |
| **Common implemented** | rounds, intro/outro/tutorial, feedback |
| **Common missing** | progress, environments |
| **Content needed** | `cards` (contentBank slice) replacing the `card_faces` / `numbers` array pair |
| **Environment** | Needed |
| **Note** | `rounds` / `boxes_per_round` / `cards_per_round` all default to **-1** (sentinel for "derive from content"). Worth making explicit in the contract — a `null`-means-derive rule beats a magic number |

---

### `sorting_type_shape_colour`

| | |
|---|---|
| **Godot params** | ~~`rounds`~~ — that's all |
| **Spec counterpart** | None |
| **Content needed** | `items` (contentBank slice with shape/colour/type attributes) |
| **Novel it should have** | sort dimension (type / shape / colour), box count, item count, mixed-dimension allowance |
| **Environment** | Needed |

---

### `vanilla` / `template`

Reference implementations. `vanilla` reads `rounds` only; `template` reads nothing. Both should demonstrate the **full** common block once it exists — they're what new activities get copied from.

---

### Shared code (not per-game)

| Component | Params | Disposition |
|---|---|---|
| `ActivityMain` | `background_path`, `skip_intro`, `skip_outro`, `skip_demo` | → `environment` + `backgroundType`; → `commonParams` with polarity fixed |
| `HintDirector` | `auto_hints_enabled`, `hint_max_severity` | → `hintsSystem`; add `hintMaxSeverity` to the contract |
| Nanisca activity generator | `rounds`, `option_count` | `rounds` → common; `option_count` is a generator concern |
| `TimerManager` | `time_transition_between_screens` / `_questions` / `_rounds` | → proposed `pacing` block |

---

## 6. Summary matrix

`●` implemented · `◐` partial · `○` absent · `—` n/a

| Activity | rounds | intro/outro | tutorial | progress | feedback | hints | env | content slots needed |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `bubble_pop` | ● | ● | ● | ○ | ○ | ◐ | ○ | targets |
| `guided_counting` | ● | ● | ● | ○ | ● | ◐ | ○ | dotRange |
| `l_alphabetic_principle…` | ● | ● | ● | ○ | ● | ◐ | ○ | letterSet |
| `l_listening_grid` | ● | ● | ● | ○ | ○ | ◐ | ○ | soundSet |
| `l_match_word` | ● | ● | ● | ○ | ○ | ◐ | ○ | wordSet |
| `letter_number_tracing` | ● | ● | ● | ○ | ○ | ◐ | ○ | glyphSet |
| `multiple_choice` | **○** | ● | ● | ● | ○ | ◐ | ○ | questions |
| `n_guided_counting` | ● | ● | ● | ○ | ○ | ◐ | ○ | — |
| `n_l_match_card_to_drop_zone` | ● | ● | ● | ○ | ○ | ◐ | ○ | cards |
| `n_select_shelf` | ● | ● | ● | ○ | ● | ◐ | ○ | stock |
| `n_trace_and_count_number_names` | ● | ● | ● | ○ | ● | ◐ | ○ | numbers, countables |
| `new_guided_counting_grid` | ● | ● | ● | ○ | ● | ◐ | ○ | targets |
| `see_and_say` | ● | ● | ● | ○ | ○ | ◐ | ○ | prompts |
| `select_line_x_items` | ● | ● | ● | ○ | ● | ◐ | ○ | items |
| `set_the_scene` | — | ● | ● | ○ | ○ | ◐ | ○ | (action sequence) |
| `shadow_select` | ● | ● | ● | ○ | ○ | ◐ | ○ | silhouettes |
| `sorting_boxes` | ● | ● | ● | ○ | ● | ◐ | ○ | cards |
| `sorting_type_shape_colour` | ● | ● | ● | ○ | ○ | ◐ | ○ | items |
| `vanilla` | ● | ● | ● | ○ | ○ | ◐ | ○ | — |

`hints` is `◐` everywhere: `HintDirector` reads `auto_hints_enabled` globally, but no activity or spec exercises it.

---

## 7. Suggested order of work

1. **Write the compiler** (spec + level + environment → flat `game_parameters`). Nothing else pays off until content-collider output can reach Godot without a human retyping it. Start with the six games that already have real specs *and* real runtimes: `n_trace_and_count_number_names`, `select_line_x_items`, `n_select_shelf`, `sorting_boxes`, `multiple_choice`, `new_guided_counting_grid`.
2. **Land the environment key** — `environment` + `background_type` replacing `background_path`, registry-driven. Prove it on `select_line_x_items` (8 params collapse to 1), then `multiple_choice` (8 environments already declared).
3. **Unify feedback** on `new_guided_counting_grid`'s `feedback_type` spelling; delete `delayed_feedback` and the `feedback` bool.
4. **Promote `minimal_intro`** into `introMode`, and fix the three `skip_*` inversions at the source.
5. **Resolve the progress contract** — either implement `progressType` / `progressMode` / `hideTeacher`, or cut them. Fix `progressPosition` to `top`/`bottom`.
6. **Strike the duplicates** in the authored specs: `numberOfRounds` as a novel param, "Feedback" as a novel param (10 specs), "Items"/"Number Range"/"Target number" as novel rather than content.
7. **Backfill content slots** — only 4 of 57 specs declare any. Every `content_json`, `questions`, `items`, `images`, `card_faces`, `item`, `content_family`, `set_number` and `min/max_number` on the Godot side is a content slot in disguise.
8. **Fill the environment registry gaps** — `assetCategory` for `home` / `market` / `village-path` (and the art to back them), phase-split `backgrounds` for all 7.

## 8. Open questions

- Are `guided_counting`, `n_guided_counting` and `new_guided_counting_grid` three games or one game and two dead ends? Three of nineteen activities is a lot of surface to maintain.
- Should `set_the_scene` become the runtime for spec `actionSequence`? Every spec authors intro/demo/main/outro steps that nothing currently plays.
- Does the 5-level difficulty grid survive the trip to Godot, or does the compiler always collapse it? If a lesson can shift level mid-session, the flat dict is the wrong delivery shape.
- Who owns prop art — the environment registry (not modelled yet) or the game? `select_line_x_items` says environment; `n_l_match_card_to_drop_zone`'s "Card background" is ambiguous.
