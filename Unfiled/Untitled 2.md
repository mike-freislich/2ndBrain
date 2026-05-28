# Scene + Model Component Pattern

This document describes the architecture introduced in
`feature/3285-Create-a-small-component-POC-for-new-MVC-and-testing-architecture`
for reusable UI components in `common/scenes/`.

> If this file is helpful, please copy it into the
> [project wiki](https://github.com/0xFFF8000000000000/godot-nanisca/wiki)
> under *Coding conventions → Component architecture*.

---

## Why we are doing this

Pre-existing UI components mixed three concerns in a single `Node` script:

1. **State** — the counter's current value, the score's max, etc.
2. **Logic** — clamping, boundary detection, "what should fire when X happens".
3. **Presentation** — labels, button enabled/disabled state, animations,
   children layout.

That mix is expensive to test. To assert "incrementing past the max stops at
the max and emits `max_reached`" you would have to instantiate the scene,
walk the tree, simulate input events, then read children's properties back.
Those tests are slow, require `--ignoreHeadlessMode`, are sensitive to
unrelated layout / texture changes, and tend to be the first to be skipped
when CI gets noisy.

The new pattern splits each component into **two files**:

| Layer    | Type           | Holds                                  | Tested by                  |
| ---      | ---            | ---                                    | ---                        |
| Model    | `RefCounted`   | State + logic + signals                | **Pure unit tests** (fast) |
| Scene    | `Node` subtree | Layout + presentation + delegation     | **Thin wiring tests**      |

The result: ~80% of the tests run in milliseconds against the Model with
zero scene tree, and only a handful of slower `scene_runner` tests are needed
to verify that the Scene relays user input into the Model and reflects the
Model's signals back in the UI.

---

## The pattern, by example

The first three components migrated to this pattern live in:

- `common/scenes/counter/` — `Counter` + `CounterModel`
- `common/scenes/progress_bar/` — `CommonProgressBar` + `CommonProgressBarModel`
- `common/scenes/score/` — `Score` + `ScoreModel`

### Model (logic) — `*_model.gd`

```gdscript
class_name CounterModel
extends RefCounted

signal count_changed(new_val: int)
signal max_reached
signal min_reached

var min_value: int
var max_value: int
var count: int


func _init(start: int, p_min: int, p_max: int) -> void:
    min_value = p_min
    max_value = p_max
    count = clampi(start, p_min, p_max)


func increment() -> void:
    if count >= max_value:
        return
    count += 1
    count_changed.emit(count)
    if count == max_value:
        max_reached.emit()
```

Key properties of a Model:

- **Extends `RefCounted`** — no scene tree, no `_ready`, no nodes. Pure data + functions.
- **Declares all public signals.** Boundary conditions (`max_reached`,
  `max_value_reached`, `min_reached`) live here, not in the Scene.
- **Validates input** in the constructor (`clampi`, `clampf`, etc.) and on
  every mutation. The Scene must never need to "fix up" a value before
  handing it down.
- **Is instantiable in one line in a test.** Anything that requires `await`,
  a node tree, a timer, or autoloads to construct does not belong in the
  Model.

### Scene (presentation) — `<component>.gd` + `.tscn`

```gdscript
class_name Counter
extends HBoxContainer

@onready var _decrement_button: Button = %DecrementButton
@onready var _count_label: Label = %CountLabel
@onready var _increment_button: Button = %IncrementButton

var _model: CounterModel

func _ready() -> void:
    setup()

func setup(start: int = 0, min_val: int = -10, max_val: int = 10) -> void:
    _model = CounterModel.new(start, min_val, max_val)
    _model.count_changed.connect(_on_count_changed)
    _decrement_button.pressed.connect(_model.decrement)
    _increment_button.pressed.connect(_model.increment)
    _refresh()


func _on_count_changed(_new_val: int) -> void:
    _refresh()


func _refresh() -> void:
    _count_label.text = str(_model.count)
    _decrement_button.disabled = _model.count <= _model.min_value
    _increment_button.disabled = _model.count >= _model.max_value
```

Key properties of a Scene:

- **`_ready()` calls `setup()` with safe defaults** so the component can be
  dropped into the editor and just work.
- **`setup(...)` is the single re-entry point** for configuring the component.
  Consumers may call it again to reconfigure.
- **The Scene never owns state.** Read everything from `_model`. Anything the
  Scene "knows" about the current value would be a duplication bug waiting to
  happen.
- **The Scene's job is one-way:** UI events in → Model methods; Model
  signals out → DOM updates. No business logic.
- If the Scene needs to expose signals to outside consumers (see `Score`),
  it **re-emits Model signals** rather than letting consumers reach into
  `_model` directly:
  ```gdscript
  _model.value_changed.connect(func(v: int, m: int): value_changed.emit(v, m))
  ```

### Public API surface

Consumers should only ever touch the Scene's public API:

- `setup(...)` to configure
- Methods named for the user's intent (`increase()`, `clear()`, `set_score(x)`)
- Signals declared on the Scene

Treat `_model` as private. Tests are the only acceptable caller.

---

## Testing strategy

Tests live under `tests/common/scenes/<component>_test/` and split along the
same line as the production code.

### Model tests — the bulk of coverage

`tests/common/scenes/counter_test/counter_model_test.gd`:

```gdscript
class_name CounterModelTest
extends NanTestSuite


func _make_model(start: int = 0, p_min: int = 0, p_max: int = 10) -> CounterModel:
    return CounterModel.new(start, p_min, p_max)


func test_increment_to_max_emits_max_reached() -> void:
    var model := _make_model(9, 0, 10)
    monitor_signals(model)
    model.increment()
    assert_signal(model).is_emitted("max_reached")
```

Conventions:

- One factory helper (`_make_model`) per file, with defaults that match the
  most common test case.
- `# region <name>` / `# endregion` groups by method (`init`, `increment`,
  `reset`, …).
- Signal coverage uses `monitor_signals(model)` immediately before the action
  and `assert_signal(model).is_emitted("name", [payload])` after.
- Cover both directions of every conditional: the "boundary hit" *and* the
  "boundary not hit" case.
- **No `scene_runner`, no `await`, no autoloads, no node tree.** If a model
  test imports any of those, the abstraction has leaked — fix the production
  code, not the test.

### Scene tests — wiring only

When (and *only* when) needed, add a thin `<component>_test.gd` next to the
model test:

```gdscript
class_name CounterTest
extends NanTestSuite

var runner: GdUnitSceneRunner
var scene: Counter

func before_test() -> void:
    scene = auto_free(load("res://common/scenes/counter/counter.tscn").instantiate()) as Counter
    runner = scene_runner(scene)


func test_pressing_increment_button_updates_label_and_disables_at_max() -> void:
    scene.setup(0, 0, 1)
    scene._increment_button.pressed.emit()
    assert_str(scene._count_label.text).is_equal("1")
    assert_bool(scene._increment_button.disabled).is_true()
```

Scene tests should answer **only** these questions:

1. Does `_ready()` produce a valid initial UI state?
2. Does pressing a button / receiving input call the right Model method?
3. Does a Model signal cause the expected UI change (label text, disabled
   state, re-emitted Scene signal)?

Anything that can be expressed as "given a Model in state X, when method Y
is called, then ..." belongs in the Model test, not here.

A useful rule of thumb: if you find yourself writing a third Scene test for
the same logical case (just at the boundary, just below, just above), the
case belongs in the Model test instead.

---

## Adding a new component

1. Create `common/scenes/<name>/<name>_model.gd` (`extends RefCounted`).
   Define state, signals, and methods. Validate everything in `_init` and
   on every mutation.
2. Create `common/scenes/<name>/<name>.tscn` + `<name>.gd`. The script
   `extends` whatever node type makes sense for the layout
   (`Control`, `HBoxContainer`, `TextureProgressBar`, …).
3. In the Scene script:
   - `var _model: <Name>Model`
   - `func _ready(): setup()` with safe defaults
   - `func setup(...)` instantiates the Model, connects its signals, then
     calls a private `_refresh()` (or equivalent) to seed the UI
   - delegate every public method to `_model.<method>()`
   - re-emit any Model signals you want to expose
4. Create `tests/common/scenes/<name>_test/<name>_model_test.gd`. Aim for
   exhaustive coverage of state transitions, signal payloads, and edge
   cases (negative values, boundary re-entry, idempotent calls, etc.).
5. If — *and only if* — there is real wiring to verify, add
   `tests/common/scenes/<name>_test/<name>_test.gd` using `scene_runner`.
   Keep it minimal.

---

## When this pattern is the wrong choice

This split is overkill for components whose entire job is layout (e.g.
a styled container with no behavior), for one-off scenes that exist in a
single activity and have no testable invariants, or for components whose
state is genuinely owned by an autoload / scene parent and the component is
just a view.

The heuristic: if you cannot write down at least three meaningful assertions
about the component's behavior that do **not** mention "the screen", a Model
is unnecessary.

---

## Open considerations

While migrating components to this pattern, watch for the following gotcha,
which is currently shared by all three POC components:

- `_ready()` unconditionally calls `setup()` with defaults. If a consumer
  also calls `setup(custom_args)` later, the old Model is replaced. For
  Scenes that connect *node* signals to Model methods (e.g. `Counter`
  connects buttons to `_model.increment`), the previous `Callable` keeps
  the old Model alive and a single click can fire callbacks on both Models.
  The user-visible label still ends up correct, but orphan boundary signals
  can fire.
- Mitigation options (PR-review-level discussion, not landed):
  - Guard `_ready` with `if _model == null: setup()`; require consumers that
    customise to construct the component without `_ready` running first, or
  - Have `setup()` disconnect existing node-signal connections before
    reconnecting to the new Model.

Pick one and apply it consistently to all future Scene scripts that follow
this pattern.