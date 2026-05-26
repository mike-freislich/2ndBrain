# Plan: Refactor `guided_counting` to a reactive state/UI pattern

## Context

`guided_counting` was just Waffle-migrated upstream (commit `73672c13`). It works, but `main.gd` (311 lines) freely interleaves game-rule logic (round progression, item picking, dot-overlap rules) with presentation (tweens, audio, label markup, hint timers, demo control). `demo.gd` worsens this by reaching directly into the view (`item`, `dot_container`, `waffle`) to script the tutorial — there is no single source of truth for "what should be on screen right now."

The user wants to adopt the **reactive-state pattern** from [godot-state-testing](https://github.com/0xFFF8000000000000/godot-state-testing) so that:

1. Game state lives in a plain GDScript object with no scene/Node dependencies.
2. Mutations to state emit signals; the view re-renders by subscribing.
3. Player input and the demo both drive the activity through the **same** state API — UI behaves identically whether a tap or the demo triggered it.
4. Pure logic becomes testable without a scene runner.

This is a proof-of-concept on `guided_counting`. If it lands cleanly, the same shape can be extended to the other activities still being refactored.

## Branch

`refactor/guided-counting-react-ui` (already created off `test-waffle-migrations` @ `9584bdd1`).

---

## Step 1 — Port Reactive primitives into `common/reactive/`

Copy the five primitives from the reference repo into a new folder. They're small, dependency-free, and intended to be reused.

New files:

- `common/reactive/reactive.gd` — base class; emits `reactive_changed(self)`, supports owner-chain `_propagate()`
- `common/reactive/reactive_int.gd`
- `common/reactive/reactive_string.gd`
- `common/reactive/reactive_array.gd` — `append/erase/pop/clear/manually_emit`
- `common/reactive/reactive_object.gd` — auto-reconnects nested Reactives when `.value` is reassigned

Each gets a `class_name` so they're globally available. Behaviour and API should match the reference repo verbatim; if anything needs adjusting for project conventions (e.g. typed Array semantics, formatting), keep changes minimal so the pattern remains recognisable.

---

## Step 2 — Introduce `GuidedCountingState`

New file: `activities/guided_counting/scenes/main/guided_counting_state.gd`

A `class_name GuidedCountingState extends Reactive` object owned by `main.gd`. Holds **all** mutable game state and **all** game-rule logic. **No Node, scene, or autoload references** (so it's unit-testable without a runner). The one exception: it accepts a `Random`-like seed/PRNG so tests can pin item selection.

### Reactive fields

| Field | Type | Replaces |
|---|---|---|
| `dots_placed` | `ReactiveInt` | `dots` ([main.gd:18](activities/guided_counting/scenes/main/main.gd:18)) |
| `max_dots` | `ReactiveInt` | `max_dots` ([main.gd:9](activities/guided_counting/scenes/main/main.gd:9)) |
| `score` | `ReactiveInt` | `zzz_score` ([main.gd:23](activities/guided_counting/scenes/main/main.gd:23)) |
| `current_type` | `ReactiveObject<GuidedCountingType>` | `selected_type` / `current_item` / `dot_texture` / `dot_scale` / `current_dot` / `dot_counting_in_2s` |
| `phase` | `ReactiveString` | implicit flags `with_demo`, `finished_act`, `number_spoken_out` collapsed into `"idle" \| "demo" \| "playing" \| "transitioning" \| "finished"` |
| `can_place` | `ReactiveInt` (used as bool) | `item.can_place` (mirrored into view) |
| `dot_positions` | `ReactiveArray[Vector2]` | implicit — currently derived by walking `dot_container.get_children()` for overlap checks |

### Non-reactive (plain) members

`rounds`, `with_demo`, `with_randomness`, `last_item`, `used_items`, `guided_counting_types` (the loaded `.tres`).

### Actions (pure methods, no Node access)

These are the API the view and the demo call into:

- `configure(rounds, with_demo, with_randomness, types)`
- `start_first_round()` → picks demo item (or first non-demo if `with_demo == false`), sets `phase`
- `begin_play_round()` → after demo finishes; sets `phase = "playing"`, `can_place = 1`
- `attempt_dot(pos: Vector2, inside_item: bool) -> Result` → returns one of `MISS`, `OVERLAP`, `PLACED`, `PLACED_AND_COMPLETED_ROUND`, `IGNORED`. **All overlap math lives here** (uses `dot_positions`, `current_type.dot_scale`). Mutates state on success.
- `advance_round()` → increments score, picks next non-demo non-used item, resets `dots_placed`/`dot_positions`
- `finish()` → `phase = "finished"`

The Result enum lets the view decide which audio/animation to play without re-running the rules.

### Signals exposed

Inherited from `Reactive` (`reactive_changed`) plus per-field `reactive_changed` on each reactive member. View subscribes to whichever it cares about.

---

## Step 3 — Thin `main.gd` to a view/controller

Modify [activities/guided_counting/scenes/main/main.gd](activities/guided_counting/scenes/main/main.gd) so its only responsibilities are:

1. **Construct & configure** `state` in `start()`.
2. **Subscribe** state signals → view update functions.
3. **Forward input** from `item.clicked` and corner button into state actions.
4. **Perform presentation** in subscribers: tweens, audio, label markup, hint helper bookkeeping.

Concrete subscriptions (representative):

```gdscript
state.dots_placed.reactive_changed.connect(_on_dots_placed_changed)  # updates RichTextLabel
state.current_type.reactive_changed.connect(_on_type_changed)        # sets item sprite, %ItemAudio.stream, dot_texture/scale used at spawn-time
state.phase.reactive_changed.connect(_on_phase_changed)              # drives item slide-out/in, demo start, finish() call
state.score.reactive_changed.connect(_on_score_changed)              # animates progress bar
```

The `attempt_dot` result drives audio choice in `_on_item_clicked`:

```gdscript
match state.attempt_dot(pos, inside):
    GuidedCountingState.Result.MISS, GuidedCountingState.Result.OVERLAP:
        SoundManager.play_id("sfx_failure"); hint_helper.mistake_made()
    GuidedCountingState.Result.PLACED:
        _spawn_dot_visual(pos); SoundManager.play_id("number_%s" % state.dots_placed.value); ...
    GuidedCountingState.Result.PLACED_AND_COMPLETED_ROUND:
        _spawn_dot_visual(pos); await SoundManager.play_id_async("sfx_success"); ...
hint_helper.reset_timer()
```

Removed from `main.gd`: `pick_item`, the rule-y branches inside `check_dots`, `clear_item`, overlap math, `number_spoken_out` gating, `used_items`/`last_item` tracking — all of which migrate into `GuidedCountingState`.

Kept in `main.gd`: the actual tween/audio/scene-tree work — `add_round_audio`, the dot instantiation/positioning, item slide tweens, demo invocation, hint helper wiring.

Target size: ≤ ~150 lines (down from 311).

---

## Step 4 — Refactor `demo.gd` to mutate state

Modify [activities/guided_counting/scenes/demo/demo.gd](activities/guided_counting/scenes/demo/demo.gd) so the tutorial drives the activity through `activity.state` instead of touching `activity.item` / `activity.dot_container` directly.

Pattern:

```gdscript
# Old (illustrative): activity.add_dot(some_pos)
# New:
tutorial.add_callable_runs(func(): activity.state.attempt_dot(pos, true))
```

The hand-pointer movement still needs scene-space coordinates, so `add_hand_pointer_moves(target_node)` calls remain — but **state changes** flow through `state` only. This guarantees the demo and the player exercise the same code path.

`_on_teacher_button_pressed`, `_on_hint_helper_on_idle_timeout`, `_on_hint_helper_on_too_many_mistakes` continue to call `demo.start(self, "_min_demo")` — unchanged.

---

## Step 5 — `item.gd` minor changes

[activities/guided_counting/scenes/item/item.gd](activities/guided_counting/scenes/item/item.gd) stays as the input-detection view component. The only change: optionally accept a state reference and listen to `state.can_place.reactive_changed` instead of having `main.gd` toggle `item.can_place` imperatively. **Decide during implementation** — if it makes `item.gd` cleaner, do it; if it adds coupling without payoff, leave it imperative. Pixel-perfect click detection stays in `item.gd` (it's a view concern about the texture).

---

## Step 6 — Unit tests for the state object

New file: `tests/activities/guided_counting/state_test/state_test.gd`

GdUnit suite that instantiates `GuidedCountingState` directly (no scene runner). Coverage:

- `attempt_dot` returns `MISS` when `inside == false`
- `attempt_dot` returns `OVERLAP` when within `dot_radius` of a placed dot
- `attempt_dot` returns `PLACED` and increments `dots_placed` when valid
- `attempt_dot` returns `PLACED_AND_COMPLETED_ROUND` on the final dot
- `attempt_dot` returns `IGNORED` when `phase != "playing"`
- `advance_round` increments `score`, resets `dots_placed`, picks a fresh `current_type` that isn't `last_item`
- `dot_counting_in_2s` types add 2 per placement
- Subscribers receive `reactive_changed` exactly once per mutation (sanity-check of the wrapper integration)

Keep the existing scene-runner integration tests in `tests/activities/guided_counting/scenes/main_test/main_test.gd` running unchanged — they validate the view wiring.

---

## Files at a glance

**New**

- `common/reactive/reactive.gd`
- `common/reactive/reactive_int.gd`
- `common/reactive/reactive_string.gd`
- `common/reactive/reactive_array.gd`
- `common/reactive/reactive_object.gd`
- `activities/guided_counting/scenes/main/guided_counting_state.gd`
- `tests/activities/guided_counting/state_test/state_test.gd`

**Modified**

- `activities/guided_counting/scenes/main/main.gd` — thinned to controller/view
- `activities/guided_counting/scenes/demo/demo.gd` — drives state instead of view
- `activities/guided_counting/scenes/item/item.gd` — optional `can_place` binding

**Unchanged**

- `main.tscn`, `item.tscn`, `dot.tscn`, `Type.gd`, `Types.gd`, `Types.tres`
- `common/scenes/activity_main/activity_main.gd` and all Waffle infrastructure

---

## Verification

1. **Unit tests** — run the new state suite headlessly:
   `godot --headless --path . -s addons/gdUnit4/bin/GdUnitCmdTool.gd -a tests/activities/guided_counting/state_test/`
2. **Existing integration tests** — run `tests/activities/guided_counting/scenes/main_test/main_test.gd` and `item_test.gd`; expect zero regressions.
3. **Manual smoke test** — open `activities/guided_counting/scenes/main/main.tscn` in the editor and play:
   - Full demo plays cleanly on round 1
   - Tap inside item → dot appears, number audio plays
   - Tap outside item → failure sfx, mistake counter increments
   - Tap on top of an existing dot → failure sfx, no new dot
   - Round transitions through all 4 rounds; progress bar fills correctly
   - Idle ~30s → hint demo triggers
   - Teacher button → mini demo triggers
   - Final round → `finish_activity` runs and outro starts
4. **Regression check** — verify no other activities import or depend on `guided_counting` (`rg "guided_counting" --type-not tres -g '!activities/guided_counting/*'`).