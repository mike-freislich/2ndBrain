## Base class for game state machine states.
##
## States are pure logic. They do not:
##   - extend Node or touch the scene tree
##   - read Input, Time, or randf() directly
##   - reference Views or scene-specific node paths
##
## States receive semantic events via handle() and request transitions by
## emitting `transition_requested(target, payload)`. The owning
## GameStateMachine listens and performs the change.
class_name GameState extends RefCounted

## Emitted when this state wants the machine to transition.
signal transition_requested(target: StringName, payload: Dictionary)

## Called when the state machine activates this state.
## Override to set up local data, subscribe to model signals, etc.
func enter(_payload: Dictionary = {}) -> void:
	pass

## Called just before the state machine deactivates this state.
## Override to unsubscribe signals, stop timers, etc.
func exit() -> void:
	pass

## Called by the state machine to dispatch a semantic event.
## Override to react and optionally request a transition.
func handle(_event: StringName, _payload: Dictionary = {}) -> void:
	pass

## Called every tick (forwarded from the ViewModel) while this state is active.
## Override for timer-based or per-frame logic.
func tick(_delta: float) -> void:
	pass
