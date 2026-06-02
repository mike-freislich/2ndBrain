


## Review: guided_counting BT implementation (PR 803)

### Overall shape

[common/behavior_tree/activity_bt.tscn](common/behavior_tree/activity_bt.tscn) defines the lifecycle, and [common/behavior_tree/activity_bt_main.gd](common/behavior_tree/activity_bt_main.gd) is the actor base with `bt_<phase>_start()` / `bt_<phase>_is_done()` virtuals. The tree:

```
Sequence → Intro → WaffleSetup → Demo → UntilFail(Round) → Outro
Round   → CheckMoreRounds → NewRoundSetup → SelectorReactive(AlwaysFail(HintSeq) | Gameplay) → RoundTransition
```

The intent — push lifecycle into a declarative tree, leave the activity as small overridable callbacks — is sound. Below, organised against your four criteria.

---

### 1. Simplicity — biggest weakness

**Six near-identical action leaves.** [intro_action.gd](common/behavior_tree/intro_action.gd), [demo_action.gd](common/behavior_tree/demo_action.gd), [gameplay_action.gd](common/behavior_tree/gameplay_action.gd), [new_round_setup_action.gd](common/behavior_tree/new_round_setup_action.gd), [round_transition_action.gd](common/behavior_tree/round_transition_action.gd), [outro_action.gd](common/behavior_tree/outro_action.gd) are byte-for-byte identical except for the method names they dispatch to. ~110 lines of pure duplication; any bug-fix has to be made in all six.

A single parameterised `LifecycleAction` with an exported `phase: StringName` (or two `Callable` fields) collapses them into one file. The tree definition stays just as readable — the phase name moves from the script type to a property on the node.

**`SelectorReactive(AlwaysFail(HintSeq) | Gameplay)` is clever but opaque.** The interaction of three things — `SelectorReactive` re-evaluating every tick, `AlwaysFailDecorator` ensuring Gameplay still runs after a hint, and the *non-reactive* Sequence inside the hint branch preventing the consumed flag from being re-checked while `ShowHintAction` runs — encodes a subtle invariant. The comment in [is_hint_requested_condition.gd:5-6](common/behavior_tree/is_hint_requested_condition.gd) helps, but a reader still needs to mentally simulate the tree. Consider a small ASCII diagram + 2-line rationale in the tscn or a sibling README.

**Three different "is this phase done" idioms in one activity:**

| Phase | Done signal |
|---|---|
| intro / demo / outro | latched bool flipped by an `await`-chained coroutine ([main.gd:65-67](activities/guided_counting/scenes/main/main.gd#L65), [main.gd:117](activities/guided_counting/scenes/main/main.gd#L117), [main.gd:187](activities/guided_counting/scenes/main/main.gd#L187)) |
| round_setup / round_transition | bool reset in `_start` and flipped at the tail of the coroutine ([main.gd:127-141](activities/guided_counting/scenes/main/main.gd#L127), [main.gd:150-169](activities/guided_counting/scenes/main/main.gd#L150)) |
| gameplay | derived from model state — `_model.is_round_complete()` |

Pick one. Deriving from a model `Phase` enum, or always-bool with a uniform reset rule. The current mix makes it easy to forget a reset and ship a bug where round 2 never starts.

---

### 2. Code readability

**Good:**
- The tscn-as-state-diagram is genuinely nice — you can see the full lifecycle in 70 lines.
- `bt_*` naming is consistent and easy to grep.
- Section comments in [main.gd](activities/guided_counting/scenes/main/main.gd) (`# --- Lifecycle: Intro ---` etc.) make the phase boundaries obvious.

**Friction points:**
- `zzz_score` / `zzz_narrative_running` — what does the `zzz_` prefix signal? If it's "private but visible to tests", a one-line convention note in CLAUDE.md or a base class would help. Right now a new contributor will wonder.
- [main.gd:8-18](activities/guided_counting/scenes/main/main.gd#L8) — six unrelated booleans declared in a flat block (`with_demo`, `is_intro_skip`, then five `_*_done` flags). Group config vs state and the file becomes much easier to scan.
- `current_item` / `current_dot` / `dots` proxy properties on [main.gd:23-32](activities/guided_counting/scenes/main/main.gd#L23) — fine, but they read as if the activity owns the state. Either drop them and have callers go through `_model`, or make `_model` `public` and skip the proxies. The middle ground is the worst case.
- [activity_bt_main.gd:10](common/behavior_tree/activity_bt_main.gd#L10) — *"Exception: bt_gameplay_is_done() defaults false — override or gameplay never ends."* Good comment. But it begs the question: should the default behaviour leaf-by-leaf actually be defined per-action instead of by a magic-defaulting actor method? A reader has to know that one specific method has a foot-gun default.

---

### 3. Testability without UI tests

**Strengths.** The MVVM split is real and pays off:
- [GuidedCountingModel](activities/guided_counting/scenes/main/guided_counting_model.gd) is a pure `RefCounted` with 28 unit tests covering `has_more_rounds`, `is_round_complete`, `set_score`, `add_dot`, `apply_round_result`, `pick_item`. This is the most testable part of the activity.
- [GuidedCountingItemModel](activities/guided_counting/scenes/item/guided_counting_item_model.gd) extracts pure pixel-alpha hit detection into something headless-testable.

**Gaps.**

1. **The BT itself is not unit-testable.** Every action does `actor as ActivityBTMain`, which is a concrete `Node`-derived class with `@onready` references to a Waffle, an Item, a HintHelper, etc. To test "the tree advances from Intro to Demo when `bt_intro_is_done()` flips," you need a full scene tree. The fix: have actions depend on an interface (or use Duck-typed virtual calls without the cast). Beehave doesn't require the cast — `actor.bt_intro_start()` works fine on any Object that has the method, and you get free fake-actor tests.

2. **No test for the lifecycle contract.** No assertion that `bt_gameplay_is_done` is queried *after* `bt_gameplay_start` is called once, or that `_started` is reset on interrupt. These are the invariants that make six near-duplicate actions equivalent — and the place a refactor will silently break things. A handful of tests against a tree built in code (a `BeehaveTree` is just a Node) with a fake actor would be very high value.

3. **`pick_item()` recursion** is potentially non-terminating ([guided_counting_model.gd:71-94](activities/guided_counting/scenes/main/guided_counting_model.gd#L71)): if `used_items` ever grows to cover all non-demo items, every recursive sample is rejected. With `rounds = 4` and three types, probably fine; with arbitrary config, an infinite loop. No test asserts termination. A non-recursive "build filtered candidate list, pick one" is clearer and provably terminating.

4. **The async fire-and-forget pattern** (`_run_*_async()` started inside a `bt_*_start` and writing to a bool the BT later reads) is hard to verify in tests. Returning a `Signal` or `Awaitable` from `bt_*_start` and letting the action `await` it would be more testable (no polling, no flag) — though it does change the BT idiom.

---

### 4. Deterministic state model

**Weakest area in spirit, though it mostly works in practice.**

- **No explicit phase enum.** The BT *is* the state machine, but the activity has no `Phase.INTRO | DEMO | ROUND_SETUP | …` you can query. If a designer asks "what phase are we in?" there's no answer at the actor level — you'd have to inspect Beehave internals. Adding `var phase: Phase` updated in each `bt_*_start` would cost nothing and make logging, telemetry, and debugging trivially easier.

- **Side effects vs. transitions are mixed.** [main.gd:157-169](activities/guided_counting/scenes/main/main.gd#L157) `_run_round_transition_async()` increments the score, mutates the progress bar, plays sound, awaits a timer, animates the bar — all behind a single bool. If anything along that chain fails (or is interrupted), the state machine doesn't know. Splitting the side effects from the model state mutation (`_model.advance_round()` → fire signals → view reacts) would mean the BT only ever observes model state, never UI-tween state. That alone removes a class of "the bar finished animating but the score didn't update" bugs.

- **Hint flow has a hidden coupling.** `request_hint()` writes a blackboard flag; `IsHintRequestedCondition` consumes it; `ShowHintAction` calls `run_min_demo()` directly on the actor. So the path is: actor → blackboard → tree → back to actor. If a hint arrives while `ShowHintAction` is RUNNING, the flag is silently consumed-and-discarded by the next tick of the condition (the non-reactive Sequence prevents re-entry but only *because* of the structure, not enforced anywhere). Add a unit test for "hint requested during hint is no-op" and the invariant becomes machine-checked.

- **Interrupt semantics on the actor are absent.** Beehave actions implement `interrupt()` and reset `_started`, but the actor has no corresponding `bt_*_interrupt` hook. If a `SelectorReactive` reroutes from `Gameplay` to `HintSeq` mid-tick, the gameplay coroutine on the actor (if any were running — currently `bt_gameplay_start` is a no-op so OK) would keep going. This is a latent footgun for the next activity that does have async work inside gameplay.

---

### Concrete suggestions, ranked by ROI

1. **Collapse six action scripts to one parameterised `LifecycleAction`.** Pure win on simplicity and maintainability. ~100 fewer lines.
2. **Decouple actions from `ActivityBTMain` concrete type** — use duck-typing, not `as ActivityBTMain`. Unlocks fake-actor unit tests of the BT.
3. **Add a `Phase` enum on the model**, updated by each `bt_*_start`. Single source of truth, free debug aid, makes integration tests sane.
4. **Rewrite `pick_item()` non-recursively** + add a termination test.
5. **Promote `is_round_complete()`-style "derive done from model" as the standard idiom.** Drop the `_done` booleans where you can.
6. **Document the hint sub-tree's invariant** (selector-reactive + always-fail + non-reactive sequence) at the top of [activity_bt.tscn](common/behavior_tree/activity_bt.tscn) or in a short readme — the cleverness will not be obvious to whoever inherits it.
7. **Add a `bt_<phase>_interrupt` virtual** before another activity adds async gameplay.

Net: the architectural direction is right and the model layer is genuinely well-tested. The BT layer needs deduplication, a clearer "phase done" idiom, and decoupling from the concrete actor to deliver on its testability promise.


## Review: `guided_counting_sm` (MVVM + FSM)

### Architecture

```
View          GuidedCountingSmMain (276 lines) extends ActivityMain
              ├─ creates ViewModel, binds 7 signals
              ├─ forwards _process → vm.tick(delta)
              └─ disposes vm on _exit_tree

ViewModel     GuidedCountingViewModel (138 lines) extends ViewModelBase
              ├─ owns Model + TypeSelector + GameStateMachine
              ├─ commands in: begin / intro_done / demo_done / setup_done / place_dot / transition_done
              └─ signals out: phase_changed / demo_started / round_started / dot_added /
                               round_completed / progress_changed / game_finished

Model         GuidedCountingModel (63 lines) — pure RefCounted, dot counting + completion
              GuidedCountingTypeSelector (92 lines) — pure RefCounted, injected Rng

States        5 files, 12–28 lines each:
              intro_state  → forwards configured-next on intro_done
              demo_state   → setup on demo_done
              setup_state  → playing on setup_done
              playing_state→ model.add_dot() on place; round_end at target
              round_end_state → records round; setup-or-finished on transition_done

Framework     common/core/fsm/ (~100 lines)  + common/core/mvvm/ (~100 lines)
              common/core/random/ (Rng / SeededRng / FakeRng)
```

---

### 1. Simplicity — strong

Each state is 12–28 lines and does one thing. No duplication: every state has a distinct shape (`intro` forwards, `demo` and `setup` are trivial pass-throughs, `playing` increments and gates, `round_end` records and branches). Contrast with the BT branch's six near-identical `ActionLeaf` files.

The FSM core ([game_state_machine.gd](common/core/fsm/game_state_machine.gd), 72 lines) is small enough to read in a sitting. State entry / exit / event dispatch / transition signal — that's the whole API.

Two simplifying calls worth naming:
- **Hints don't go through the FSM.** `_on_teacher_button_pressed` and the two hint-helper signals all call `demo.start(self, "_min_demo")` directly ([main.gd:192-201](activities/guided_counting_sm/scenes/main/main.gd#L192)). No blackboard, no SelectorReactive trick. Trade-off discussed below.
- **`is_intro_skip` lives on the View.** The View checks it and calls `_vm.intro_done()` immediately ([main.gd:96-98](activities/guided_counting_sm/scenes/main/main.gd#L96)). The VM doesn't need to model "skipped" — it just gets a fast `intro_done()`. Right call.

---

### 2. Code readability — strong

- Every class has a file-level docstring naming its role and what it does *not* do ([GuidedCountingViewModel.gd:1-11](activities/guided_counting_sm/scenes/main/model/GuidedCountingViewModel.gd#L1), [GuidedCountingModel.gd:1-7](activities/guided_counting_sm/scenes/main/model/GuidedCountingModel.gd#L1), [game_state.gd:1-10](common/core/fsm/game_state.gd#L1)).
- Every state declares its event names as `const FOO := &"foo"` next to the dispatcher. The handler reads like English.
- The phase sequence is documented inline on the VM ([GuidedCountingViewModel.gd:9-11](activities/guided_counting_sm/scenes/main/model/GuidedCountingViewModel.gd#L9)).
- Section banners in [main.gd](activities/guided_counting_sm/scenes/main/main.gd) (`# region VM signal handlers`, `# region item input`, `# region presentation helpers`).

**Friction points:**

- **[item.gd](activities/guided_counting_sm/scenes/item/item.gd) regressed vs the BT branch.** It has the pixel hit-test logic duplicated — once as `check_position_inside_texture` (clean) and once inlined into `_on_gui_input` (66 lines). The BT branch already extracted this into `GuidedCountingItemModel` as a unit-testable RefCounted — the sm branch hasn't. Easy follow-up: copy that extraction.
- **Signal declaration is wrong.** [item.gd:11](activities/guided_counting_sm/scenes/item/item.gd#L11) declares `signal clicked(inside: bool)` but two `emit` sites pass `(bool, Vector2)`. Engine tolerates it, but the wrong signature is misleading.
- **`Variant` return types from the selector.** [GuidedCountingTypeSelector.gd:42](activities/guided_counting_sm/scenes/main/model/GuidedCountingTypeSelector.gd#L42), `:50`, `:67` etc. return `Variant` because typed return + nullability fight in GDScript. Comment explains the rule, but a typed `GuidedCountingSmType` with a sentinel "none" or an `Optional`-style wrapper would read better — minor.

---

### 3. Testability without UI — biggest win

The VM constructor takes plain data: `(types: Array, rng: Rng, total_rounds: int, with_demo, with_randomness)`. No Node, no autoload, no scene tree. The View is the *only* layer that touches Godot.

**648 lines of headless tests** across four files:

| File | What it tests |
|---|---|
| [guided_counting_model_test.gd](tests/activities/guided_counting_sm/guided_counting_model_test/guided_counting_model_test.gd) (153 lines) | Pure model: dot counting, clamping at target, signal emission, round/game completion |
| [guided_counting_type_selector_test.gd](tests/activities/guided_counting_sm/guided_counting_type_selector_test/guided_counting_type_selector_test.gd) (141 lines) | Selector rules — demo, first-round drum, no-repeat, randomness control (via FakeRng) |
| [states_test.gd](tests/activities/guided_counting_sm/states_test/states_test.gd) (160 lines) | Every state in isolation — direct `s.handle(&"event")` calls; transitions captured via `_capture(state)` |
| [guided_counting_view_model_test.gd](tests/activities/guided_counting_sm/guided_counting_view_model_test/guided_counting_view_model_test.gd) (194 lines) | End-to-end VM lifecycle — including `test_full_phase_sequence_single_round` which asserts `["intro","demo","setup","playing","round_end","finished"]` |

`FakeRng.push_int(1)` ([guided_counting_view_model_test.gd:164](tests/activities/guided_counting_sm/guided_counting_view_model_test/guided_counting_view_model_test.gd#L164)) is the punchline — "second round picks frog" is provably deterministic in one line.

**Gaps:**
- No tests of the View itself, including the wiring between VM signals and View handlers (the seam that actually breaks in practice).
- No test for the selector returning `null` after `MAX_TRIES = 100` exhausts (then `_enter_setup` returns silently with the FSM stuck in SETUP — latent bug).

---

### 4. Deterministic state model — biggest conceptual win

| Aspect | Sm |
|---|---|
| Where is "current phase"? | `fsm.current_name: StringName` — one variable, observable via `state_changed(from, to)` |
| Where do transitions happen? | Each state emits `transition_requested.emit(target, payload)`. Nothing else can transition. |
| How is randomness controlled? | Injected `Rng`. `FakeRng.push_int(...)` in tests; `SeededRng` in prod. No `randf()` / `randi()` calls in the model layer. |
| Side effects vs. transitions? | Side effects live in the View. States touch only `_model.add_dot()` / `_model.complete_round()` and emit transitions. |

The cleanest case is `playing_state.handle("place")`: dispatch the side-effect (`model.add_dot()`), then if the round just completed, request the transition. Read-then-write order is correct; you can write the property test "place N times → dots == min(N, max_dots)" trivially.

**Two warts to flag:**

1. **`SeededRng.new(0)` in production** ([main.gd:65](activities/guided_counting_sm/scenes/main/main.gd#L65)). Fixed seed = every game run picks the same items in the same order. Almost certainly a placeholder; ship-blocker if not fixed.
2. **Bounded retry without recovery.** If `_pick_random` exhausts `MAX_TRIES`, the selector returns `null` and the FSM gets stuck mid-SETUP. The BT branch had infinite recursion in the same path — bounded is better, but the failure mode is still wrong.

---

## Comparison: BT vs SM

### Side-by-side

| Dimension | BT (PR 803, `guided_counting`) | SM (`guided_counting_sm`) |
|---|---|---|
| Lifecycle representation | Beehave tree in a `.tscn` + 8 action leaves + 2 conditions + `bt_*_start`/`bt_*_is_done` virtuals on the actor | 5 small state classes + `GameStateMachine` (RefCounted) |
| Total framework lines | ~190 (tree + actions + conditions + base actor) | ~200 (game_state, machine, view_model_base, view_base, model_base) |
| Total activity-specific lines | ~530 (main 273, model 94, item_model 47, item 58, etc.) | ~720 (main 276, vm 138, model 63, selector 92, states 93, item 164) |
| Duplication | 6 near-identical action leaves (~110 lines) | None |
| Lifecycle as a diagram | Inspect tscn — visually obvious | Inspect VM + states — readable but text-only |
| "Current phase" introspection | None; BT internal | `fsm.current_name`, `state_changed` signal |
| Randomness | `Random.randomize()` in waffle_setup | Injected `Rng` (`SeededRng`/`FakeRng`) |
| Pure model tests | 1 file, model only | 4 files: model + selector + states + VM |
| FSM/BT-layer tests | None — actions require concrete `ActivityBTMain` cast | 5 states + full VM lifecycle, all headless |
| Async work + "done" idiom | Three different idioms (latched bool, reset-then-flip bool, model-derived) | One idiom (View reports milestone events; states are event-driven) |
| Hints | First-class lifecycle (blackboard flag, HintSequence, SelectorReactive + AlwaysFail decorator) | Not in the FSM — View calls `demo.start("_min_demo")` directly |
| Interrupt semantics | Beehave calls `interrupt()` on actions; actor has no `bt_*_interrupt` hook | None — VM is not interruptible |
| Skip flags (intro/outro) | Branch inside `bt_intro_start` to set `_intro_done = true` | View calls `_vm.intro_done()` immediately; VM doesn't know |

### Where each model wins

**SM wins on:**
- **Testability.** Pure-RefCounted core, injected RNG. 4× the test code, covering layers (states, selector, VM lifecycle) the BT branch can't reach at all.
- **State-model clarity.** A single source of truth for "what phase are we in" via `fsm.current_name`; uniform event-driven idiom; observable transitions via `state_changed`.
- **Simplicity per state.** No duplicate action leaves. Each state file is small enough to read in 30 seconds.
- **Determinism.** Production code path is deterministic by design — `randf()` is structurally absent from the model and selector. The BT branch shells out to `Random.randomize()`.

**BT wins on:**
- **Lifecycle visual.** The `.tscn` is a diagram. Opening it in the Godot editor gives a designer something to point at; reading the SM phase sequence requires opening 6 files (the VM + 5 states).
- **Hint as a first-class node.** When/if the design grows (e.g., "no hints during demo", "queue hint until current animation ends", "hints stack"), having Hint be a tree node with priority and reactive semantics is a powerful primitive. The SM's "View calls demo directly" approach buys simplicity but doesn't compose if hints get more rules.
- **Interrupt model.** Beehave actions implement `interrupt()` for free. The SM has no story for interruption; if an activity later needs to cancel work mid-phase, that has to be added to the framework.

### The decisive criterion

The user's stated criteria — **simplicity, readability, testability without UI, deterministic state model** — line up with SM on all four. The BT version's only structural advantage is the editor-visualised lifecycle, and most of that is recoverable by adding one ASCII state diagram comment to the VM.

The single most damning data point is testability: the BT branch has zero tests of the lifecycle (the actions are untestable as written because they cast to the concrete actor type), while the SM branch tests every state individually *and* a full single-round lifecycle (`["intro","demo","setup","playing","round_end","finished"]`) headlessly. Same activity, same rules, same View — but in SM the rules are inspectable in isolation.

### Recommendation

Adopt SM as the architecture pattern. Before doing so, fix three things that are easy and high-leverage:

1. **Replace `SeededRng.new(0)` with a real seed** at the View boundary ([main.gd:65](activities/guided_counting_sm/scenes/main/main.gd#L65)).
2. **Handle selector exhaustion** in [`_enter_setup`](activities/guided_counting_sm/scenes/main/model/GuidedCountingViewModel.gd#L127) — either reset `used`, or transition to FINISHED. Add a test for it.
3. **Re-extract the pixel hit-test** from [item.gd](activities/guided_counting_sm/scenes/item/item.gd) into a pure `GuidedCountingSmItemModel` (the BT branch already has the pattern in `GuidedCountingItemModel`). Fixes the duplicated hit-test code and the wrong `clicked` signal signature in one move.

Then port the BT version's one good idea — **a comment-as-diagram at the top of the VM** showing the state graph — so a new contributor doesn't have to assemble it from five files.