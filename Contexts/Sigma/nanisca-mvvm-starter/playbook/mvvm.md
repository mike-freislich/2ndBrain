# MVVM Playbook

**Audience:** Engineers working on Nanisca's Godot codebase.
**Status:** Living document. Update when conventions evolve.
**Scope:** Per-game architecture, outer game-sequence architecture, testing conventions, code-review checklist.

This document is the source of truth for "how we organize Godot code in Nanisca." If you find yourself doing something the playbook doesn't cover, write down what you did and PR an addition.

---

## TL;DR

1. **Three layers per game: Model, ViewModel, View.** Code review enforces the split.
2. **Only Views are `Node`s.** Models, ViewModels, states, services — all `RefCounted`.
3. **The View knows the ViewModel; the ViewModel does not know the View.** Communication is *commands in* (method calls) and *signals out* (the View subscribes).
4. **Time and randomness are injected.** Models and ViewModels never call `Time.*` or `randf()` directly. Use `Clock` and `Rng`.
5. **Every Model and ViewModel has a test file.** Tests run without a `SceneTree`.

---

## The three layers

### Model

Holds data and pure business rules.

**Responsibilities**

- Game-specific data structures (items, prompts, answers, scores, learner ability).
- Pure functions over that data (CAT item selection, scoring, ability updates).
- Optional signals when state changes that the ViewModel needs to observe.

**Rules**

- Extends `ModelBase` (which extends `RefCounted`).
- Never references `Node`, `Control`, `SceneTree`, or any scene-tree type.
- Never calls `Time.get_ticks_msec()`, `randf()`, `Input.*`, or autoload services directly. Receives them as constructor parameters.
- Has no signals unless they are observed by the ViewModel. The View never connects to a Model signal.

**Lives in:** `games/<game_name>/model/`

### ViewModel

Mediates between Model and View. Owns the state machine that drives game progression.

**Responsibilities**

- Holds the Model and any injected services.
- Owns a `GameStateMachine` and registers the game's states.
- Translates user intents (View → command method calls) into state transitions and Model mutations.
- Emits signals describing what changed, for the View to react to.

**Rules**

- Extends `ViewModelBase` (which extends `RefCounted`).
- Never references `Node`, `Control`, or any scene-tree type.
- Never holds a reference to its View. If you find yourself wanting one, you're solving the wrong problem.
- Commands from the View are method calls (`on_answer_selected(id)`). Outputs to the View are signals (`feedback_shown(was_correct)`).
- Lifecycle: created with explicit dependencies, `start()` called once, `dispose()` called once when the View tears down.

**Lives in:** `games/<game_name>/view_model/` (and `view_model/states/` for per-game states)

### View

The scene. Renders the ViewModel and forwards user input.

**Responsibilities**

- Scene tree, animations, audio, particles.
- Translates raw input (`InputEventScreenTouch`, button presses) into semantic commands on the ViewModel.
- Subscribes to ViewModel signals and updates the scene accordingly.

**Rules**

- Extends `ViewBase` (which extends `Control`) or another `Node` type for non-UI Views.
- Implements no game rules, scoring, or item selection.
- Never reaches into the Model. Goes through the ViewModel.
- Never reads or writes `fsm.current_name` to decide what to do. Reacts to signals.

**Lives in:** `games/<game_name>/view/`

---

## Directory and naming conventions

### Directory layout

```
res://
├── core/                                # framework code, no game specifics
│   ├── fsm/
│   ├── mvvm/
│   ├── time/
│   ├── random/
│   ├── events/
│   └── persistence/
├── session/                             # reusable outer game-sequence
│   ├── game_session_model.gd
│   ├── game_session_view_model.gd
│   ├── game_session_view.tscn
│   ├── game_session_view.gd
│   └── states/
├── games/
│   └── <game_name>/
│       ├── model/
│       ├── view_model/
│       │   └── states/
│       └── view/
├── shared_ui/                           # reusable UI widgets, no game logic
└── tests/                               # mirrors source layout
    ├── core/
    ├── session/
    └── games/
        └── <game_name>/
```

### File naming

- Snake-case file names matching the `class_name`: `cosmic_catcher_view_model.gd` declares `CosmicCatcherViewModel`.
- States named for what they *are*, not what triggers them: `prompt_state.gd`, not `show_prompt_state.gd`.
- Test files: `test_<name_of_unit_under_test>.gd`.

### Class naming

- Models: `<GameName>Model` (e.g. `CosmicCatcherModel`).
- ViewModels: `<GameName>ViewModel`.
- Views: `<GameName>View`.
- States: `<StateName>State` (e.g. `PromptState`, `FeedbackState`).

### State name constants

Declare StringName constants inside the ViewModel class. Never use raw string literals when registering or dispatching.

```gdscript
class_name CosmicCatcherViewModel extends ViewModelBase

const STATE_INTRO:    StringName = &"intro"
const STATE_PROMPT:   StringName = &"prompt"
const STATE_FEEDBACK: StringName = &"feedback"
const STATE_FINISHED: StringName = &"finished"

func _build_states() -> void:
    fsm.register(STATE_INTRO,    IntroState.new(self))
    fsm.register(STATE_PROMPT,   PromptState.new(self, model, clock))
    # ...
```

States emit transitions using these constants too — import the VM type and reference them: `transition_requested.emit(CosmicCatcherViewModel.STATE_FEEDBACK, payload)`.

---

## The FSM contract

States are pure logic. They:

- Receive semantic events via `handle(event, payload)`.
- Request transitions by emitting `transition_requested(target, payload)`.
- Optionally drive timers in `tick(delta)`.

States must never:

- Call back into the View.
- Mutate Model fields that other states are also mutating, without going through a clear method on the Model.
- Hold references to GameState siblings. If two states need to share data, the data lives on the Model.

### State payload conventions

Payloads are `Dictionary` for flexibility. Document the expected keys at the top of the receiving state's `enter()`.

```gdscript
## Feedback state.
## Expected enter payload:
##   - was_correct: bool       — required
##   - response_ms: int         — required
##   - delta_theta: float       — required, change in ability after this response
class_name FeedbackState extends GameState

var _vm: CosmicCatcherViewModel
var _model: CosmicCatcherModel

func _init(vm, model) -> void:
    _vm = vm
    _model = model

func enter(payload: Dictionary = {}) -> void:
    assert(payload.has("was_correct"))
    _vm.feedback_shown.emit(payload.was_correct, _model.ability)
```

### Commands in, signals out

The ViewModel exposes two surfaces:

**Commands** are public method names starting with `on_`. They represent user intent.

```gdscript
func on_answer_selected(id: StringName) -> void:
    fsm.dispatch(&"answer", {"id": id, "at_ms": clock.now_ms()})

func on_pause_requested() -> void:
    fsm.dispatch(&"pause")

func on_intro_finished() -> void:
    fsm.dispatch(&"continue")
```

**Signals** are past-tense and describe what happened.

```gdscript
signal round_started(item: Item)
signal feedback_shown(was_correct: bool, ability: float)
signal score_changed(new_score: int)
signal session_finished(summary: Dictionary)
```

Why past-tense? It forces the signal contract to be *about state change*, not *about UI behavior*. `play_correct_sound()` would couple the VM to a specific UI choice; `feedback_shown(was_correct: true)` lets the View decide what "showing positive feedback" means.

---

## Dependency injection

Models and ViewModels accept dependencies through `_init()`. This is non-negotiable for things that affect testability:

- `Clock` — anything that needs to read time
- `Rng` — anything that needs randomness
- Repositories — anything that reads from disk, network, or the Android bridge
- Event buses — anything that emits cross-cutting signals

```gdscript
class_name CosmicCatcherViewModel extends ViewModelBase

var model: CosmicCatcherModel
var clock: Clock
var rng: Rng
var responses_repo: ResponsesRepository

func _init(
    p_model: CosmicCatcherModel,
    p_clock: Clock,
    p_rng: Rng,
    p_responses_repo: ResponsesRepository
) -> void:
    super._init()
    model = p_model
    clock = p_clock
    rng = p_rng
    responses_repo = p_responses_repo
    _build_states()
```

In production, the scene that hosts the View constructs these:

```gdscript
# main.gd
func _ready() -> void:
    var clock := SystemClock.new()
    var rng := SeededRng.new(0)
    var repo := SqliteResponsesRepository.new()
    var model := CosmicCatcherModel.new(_load_item_bank())
    var vm := CosmicCatcherViewModel.new(model, clock, rng, repo)
    $CosmicCatcherView.bind(vm)
    vm.start()
```

In tests, you swap each one for a fake:

```gdscript
func before_each() -> void:
    clock = FakeClock.new()
    rng = FakeRng.new()
    repo = InMemoryResponsesRepository.new()
    model = CosmicCatcherModel.new(_fixture_items())
    vm = CosmicCatcherViewModel.new(model, clock, rng, repo)
```

---

## Testing patterns

### What to test

| Layer | Tests |
|---|---|
| Model | Every public method. Edge cases on data. Pure functions are gold here. |
| ViewModel | Every command produces the expected state transitions and signal emissions. |
| State | Optional. Most state behavior is covered through the ViewModel's tests. Test directly only when state logic is complex enough to warrant focused tests. |
| View | Avoid. If you find yourself wanting to test a View, you have logic in the View that belongs in the ViewModel. |

### Test shape

```gdscript
extends "res://addons/gut/test.gd"

var vm: CosmicCatcherViewModel
var clock: FakeClock
var rng: FakeRng
var model: CosmicCatcherModel

func before_each() -> void:
    clock = FakeClock.new()
    rng = FakeRng.new()
    model = CosmicCatcherModel.new()
    model.item_bank = _fixture_bank()
    vm = CosmicCatcherViewModel.new(model, clock, rng, InMemoryResponsesRepository.new())


func test_correct_answer_emits_positive_feedback_and_advances() -> void:
    var feedback_log: Array = []
    vm.feedback_shown.connect(func(c, _a): feedback_log.append(c))

    vm.start()
    vm.on_intro_finished()
    assert_eq(vm.fsm.current_name, CosmicCatcherViewModel.STATE_PROMPT)

    clock.advance(800)
    vm.on_answer_selected(_correct_id())
    assert_eq(vm.fsm.current_name, CosmicCatcherViewModel.STATE_FEEDBACK)
    assert_eq(feedback_log, [true])

    vm.on_feedback_acknowledged()
    assert_eq(vm.fsm.current_name, CosmicCatcherViewModel.STATE_PROMPT)
```

Conventions:

- One assertion focus per test name. `test_correct_answer_emits_positive_feedback_and_advances` is fine; one test that asserts a dozen unrelated things isn't.
- `before_each()` builds a fresh VM. Never share state between tests.
- Use `FakeClock` and `FakeRng` always. Tests must be deterministic.
- Assert on observable behavior: signal emissions and `current_name` after dispatch. Don't poke private state.

### Running tests in CI

Tests should run headless in GitHub Actions on every PR. The GUT command-line entry point is `gut -gdir=res://tests -gexit`. With the Godot headless flag (`--headless`), the tree of `RefCounted`-only tests runs in seconds.

---

## Code review checklist (the smells)

If a PR has any of these, ask the author to fix before merging.

### Layer-boundary smells

- [ ] `extends Node` (or any subclass) in `core/`, `session/{model,view_model,states}`, or `games/<x>/{model,view_model}`.
- [ ] A View script importing or referencing anything from a sibling game's Model or ViewModel.
- [ ] A ViewModel storing a reference to a `Node`, `Control`, `Scene`, or any scene-tree type.
- [ ] A State script with `@onready` or `get_node()` calls.

### Dependency smells

- [ ] Direct calls to `Time.get_ticks_msec()`, `Time.get_unix_time_from_system()` in a Model or ViewModel. Use `Clock`.
- [ ] Direct calls to `randf()`, `randi()`, `randf_range()` in a Model or ViewModel. Use `Rng`.
- [ ] Direct calls to `Input.*` in a ViewModel. Input is the View's job; surface it as a semantic command.
- [ ] An autoload reference inside a Model or ViewModel. Inject the service instead.

### Signal-and-command smells

- [ ] A ViewModel signal in the present tense (`show_feedback`, `play_sound`). Rename to past tense (`feedback_shown`).
- [ ] A View calling `vm.fsm.dispatch()` or `vm.fsm.change_to()` directly. Add an `on_*` command method.
- [ ] A View reading `vm.fsm.current_name` to decide what to render. React to signals instead.
- [ ] A View setting Model fields directly. Go through the ViewModel.

### State machine smells

- [ ] Raw string literals as state names (`fsm.start(&"intro")` is OK as a one-liner inside the VM, but anywhere a state name is referenced from elsewhere it should be a const).
- [ ] A state holding a reference to a sibling state.
- [ ] A state mutating multiple Model fields without going through a Model method.
- [ ] A `match` over `fsm.current_name` inside the View (the View should already know via signals).

### Test smells

- [ ] No `before_each()` — shared state between tests.
- [ ] Tests that `await get_tree().create_timer(...)`. Use `FakeClock.advance()`.
- [ ] Tests that `Input.parse_input_event()`. Call the VM's command method directly.
- [ ] Tests that `assert_eq(vm._private_field, ...)`. Test observable behavior.

---

## Worked example: end-to-end mini-game

A complete Cosmic Catcher mini-game wired up the right way.

### Model

```gdscript
# games/cosmic_catcher/model/cosmic_catcher_model.gd
class_name CosmicCatcherModel extends ModelBase

var item_bank: Array[Item] = []
var current_item: Item = null
var ability: float = 0.0
var responses: Array[Response] = []

func _init(items: Array[Item] = []) -> void:
    item_bank = items

func select_next_item(rng: Rng) -> Item:
    # Pure CAT 1PL: pick item with difficulty closest to current ability
    var best: Item = null
    var best_dist := INF
    for item in item_bank:
        if responses.any(func(r): return r.item_id == item.id):
            continue  # already shown
        var d := abs(item.difficulty - ability)
        if d < best_dist:
            best_dist = d
            best = item
    current_item = best
    return best

func record_response(answer_id: StringName, rt_ms: int, clock_now_ms: int) -> Response:
    var was_correct := current_item != null and answer_id == current_item.correct_id
    var r := Response.new(current_item.id, was_correct, rt_ms, clock_now_ms)
    responses.append(r)
    ability = CatEngine.update_ability(ability, current_item.difficulty, was_correct)
    return r

func is_session_complete() -> bool:
    return responses.size() >= item_bank.size() or responses.size() >= 10
```

### ViewModel

```gdscript
# games/cosmic_catcher/view_model/cosmic_catcher_view_model.gd
class_name CosmicCatcherViewModel extends ViewModelBase

const STATE_INTRO:    StringName = &"intro"
const STATE_PROMPT:   StringName = &"prompt"
const STATE_FEEDBACK: StringName = &"feedback"
const STATE_FINISHED: StringName = &"finished"

signal round_started(item: Item)
signal feedback_shown(was_correct: bool, ability: float)
signal session_finished(summary: Dictionary)

var model: CosmicCatcherModel
var clock: Clock
var rng: Rng
var responses_repo: ResponsesRepository

func _init(
    p_model: CosmicCatcherModel,
    p_clock: Clock,
    p_rng: Rng,
    p_repo: ResponsesRepository
) -> void:
    super._init()
    model = p_model
    clock = p_clock
    rng = p_rng
    responses_repo = p_repo
    _build_states()

func _build_states() -> void:
    fsm.register(STATE_INTRO,    IntroState.new(self))
    fsm.register(STATE_PROMPT,   PromptState.new(self, model, clock, rng))
    fsm.register(STATE_FEEDBACK, FeedbackState.new(self, model))
    fsm.register(STATE_FINISHED, FinishedState.new(self, model, responses_repo))

func start() -> void:
    fsm.start(STATE_INTRO)

# Commands
func on_intro_finished() -> void:                fsm.dispatch(&"continue")
func on_answer_selected(id: StringName) -> void: fsm.dispatch(&"answer", {"id": id, "at_ms": clock.now_ms()})
func on_feedback_acknowledged() -> void:         fsm.dispatch(&"continue")
```

### View

```gdscript
# games/cosmic_catcher/view/cosmic_catcher_view.gd
class_name CosmicCatcherView extends ViewBase

@onready var prompt_label: Label = %PromptLabel
@onready var answer_buttons: HBoxContainer = %AnswerButtons
@onready var feedback_banner: Control = %FeedbackBanner
@onready var animation_player: AnimationPlayer = $AnimationPlayer

func _on_bind() -> void:
    var vm := _vm as CosmicCatcherViewModel
    vm.round_started.connect(_on_round_started)
    vm.feedback_shown.connect(_on_feedback_shown)
    vm.session_finished.connect(_on_session_finished)

func _on_round_started(item: Item) -> void:
    prompt_label.text = item.prompt_text
    _populate_answer_buttons(item.answers)
    animation_player.play("prompt_in")

func _on_feedback_shown(was_correct: bool, _ability: float) -> void:
    feedback_banner.visible = true
    animation_player.play("celebrate" if was_correct else "encourage")

func _on_session_finished(summary: Dictionary) -> void:
    animation_player.play("session_complete")

func _on_answer_button_pressed(id: StringName) -> void:
    (_vm as CosmicCatcherViewModel).on_answer_selected(id)
```

That's the whole pattern. Logic in the Model, orchestration in the ViewModel, scene-tree work in the View, FSM driving transitions, signals carrying state changes outward, commands carrying intent inward.

---

## When to break the rules

- **Trivial games** (a 20-line tap-the-pattern game): a single ViewModel without an FSM is fine. The pattern scales down. Don't introduce states you don't need.
- **Mini-games with their own physics loop** (swarm-style, particle-based): the View may need its own internal node-based FSM for animation/visual state. That's fine *as long as* it sits below the VM and emits no business signals.
- **One-shot screens** (splash, error pages): a plain scene script is acceptable. MVVM is for screens with non-trivial state.

When you break a rule, write a comment at the top of the file explaining why. Code review checks for the rule first and the comment second.

---

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-05-29 | Initial version. | (initial) |
