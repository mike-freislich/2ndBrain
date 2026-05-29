## A pure-logic finite state machine.
##
## States are GameState subclasses registered under StringName keys. Transitions
## happen when a state emits `transition_requested(target, payload)`, or when
## external code calls `change_to(target, payload)`.
##
## The machine is RefCounted — instantiate it in a ViewModel or test directly.
## No Node, no scene tree, no autoload required.
class_name GameStateMachine extends RefCounted

## Emitted after a transition completes. `from` is &"" on first start().
signal state_changed(from: StringName, to: StringName)

## Name of the currently active state, or &"" before start().
var current_name: StringName = &""

var _states: Dictionary[StringName, GameState] = {}
var _current: GameState = null
var _started: bool = false


## Register a state under a name. Returns self for chaining.
func register(name: StringName, state: GameState) -> GameStateMachine:
	assert(not _states.has(name), "State already registered: %s" % name)
	_states[name] = state
	state.transition_requested.connect(_on_transition_requested)
	return self


## Start the machine in `initial`. Calls enter() on that state.
## Asserts if called more than once.
func start(initial: StringName, payload: Dictionary = {}) -> void:
	assert(not _started, "State machine already started")
	_started = true
	_change_to(initial, payload)


## Dispatch a semantic event to the current state.
func dispatch(event: StringName, payload: Dictionary = {}) -> void:
	if _current != null:
		_current.handle(event, payload)


## Advance the current state by `delta` seconds.
func tick(delta: float) -> void:
	if _current != null:
		_current.tick(delta)


## Force a transition externally. Prefer states emitting `transition_requested`.
func change_to(target: StringName, payload: Dictionary = {}) -> void:
	_change_to(target, payload)


## Returns true if `name` has been registered.
func has_state(name: StringName) -> bool:
	return _states.has(name)


func _on_transition_requested(target: StringName, payload: Dictionary) -> void:
	_change_to(target, payload)


func _change_to(target: StringName, payload: Dictionary) -> void:
	assert(_states.has(target), "Unknown state: %s" % target)
	var previous := current_name
	if _current != null:
		_current.exit()
	_current = _states[target]
	current_name = target
	_current.enter(payload)
	state_changed.emit(previous, target)
