Godot's built-in **signal** system is essentially the binding primitive that plain C++ lacked, so MVVM maps onto it cleanly. A signal _is_ the observable: the ViewModel emits signals when its state changes, and the View connects to them and updates itself. Here's the same counter example in GDScript (Godot 4.x).

## Model — `counter_model.gd`

Pure data and logic, no Godot UI types, no signals needed. It extends `RefCounted` so it's a lightweight object rather than a scene node.

```gdscript
# counter_model.gd
class_name CounterModel
extends RefCounted

var _value: int = 0

func get_value() -> int:
    return _value

func increment() -> void:
    _value += 1

func reset() -> void:
    _value = 0
```

## ViewModel — `counter_view_model.gd`

Holds the Model, exposes **signals as bindable state** and **methods as commands**, and has zero reference to any View node.

```gdscript
# counter_view_model.gd
class_name CounterViewModel
extends RefCounted

# Bindable state: the View connects to this instead of being called directly
signal display_value_changed(text: String)

var _model: CounterModel

func _init() -> void:
    _model = CounterModel.new()

# Commands
func increment_command() -> void:
    _model.increment()
    _sync()

func reset_command() -> void:
    _model.reset()
    _sync()

# Call once after the View has connected, to push the initial state
func notify_initial() -> void:
    _sync()

func _sync() -> void:
    # ViewModel owns presentation formatting -> View-ready string
    display_value_changed.emit("Counter = " + str(_model.get_value()))
```

## View — `counter_view.gd`

A scene script that binds to the ViewModel's signal and routes button presses to its commands. The View knows the ViewModel; the ViewModel never knows the View.

```gdscript
# counter_view.gd  (attached to a Control node)
extends Control

@onready var label: Label = $Label
@onready var increment_button: Button = $IncrementButton
@onready var reset_button: Button = $ResetButton

var _view_model: CounterViewModel

func _ready() -> void:
    _view_model = CounterViewModel.new()

    # The binding: re-render automatically whenever state changes
    _view_model.display_value_changed.connect(_on_display_value_changed)

    # Wire UI events to ViewModel commands
    increment_button.pressed.connect(_view_model.increment_command)
    reset_button.pressed.connect(_view_model.reset_command)

    _view_model.notify_initial()   # show "Counter = 0"

func _on_display_value_changed(text: String) -> void:
    label.text = text
```

The accompanying scene (`counter_view.tscn`) would just be a `Control` with three children named `Label`, `IncrementButton`, and `ResetButton`. Press increment and the label updates on its own—the View never queries the Model, it only reacts to the signal.

## A few Godot-specific notes

The cleanest mapping is **signal = observable property, method = command**. Notice `increment_button.pressed.connect(_view_model.increment_command)` connects a UI signal _directly_ to a ViewModel command with no glue method in the View. That's about as close to declarative command binding as GDScript gets.

There's one nuance worth calling out: in real MVVM with rich frameworks, the View binds a _property_ and the framework diffs old/new values. Godot signals are events, not properties, so you emit explicitly whenever state changes (the `_sync()` call). If you want true property-style binding, Godot 4 does have a more automatic option—exporting properties and using `set`/`get`—but for ViewModel state the signal approach is more idiomatic and keeps the formatting logic where it belongs.

A common variation is to put the Model behind an **autoload (singleton)** when it represents global game state shared across scenes, while each scene gets its own ViewModel. That keeps per-screen presentation logic isolated while the underlying data stays centralized.

One caution specific to Godot: because `RefCounted` objects are freed when the last reference drops, the View must keep `_view_model` as a member (as above). If you create the ViewModel as a local variable in `_ready()`, it gets garbage-collected the moment `_ready()` returns and your signal connections silently die.

If you'd rather see this with Godot's C# bindings (Godot Mono), the structure is identical but you'd use C# `event`s or `[Signal]` delegates instead of GDScript signals—want me to write that version?