## Base class for ViewModel layer types.
##
## A ViewModel owns:
##   - A reference to its Model.
##   - A GameStateMachine driving its lifecycle.
##   - Injected services (Clock, Rng, repositories).
##   - Signals the View binds to (commands in, signals out).
##
## A ViewModel does NOT:
##   - reference Node, Control, or any scene-tree types
##   - read Input, Time, or randf() directly — use injected Clock and Rng
##   - hold a reference to its View (the View knows the VM, not the reverse)
class_name ViewModelBase extends RefCounted

## Emitted exactly once when dispose() is called. Views connect cleanup here.
signal disposed()

var fsm: GameStateMachine
var _disposed: bool = false


func _init() -> void:
	fsm = GameStateMachine.new()


## Per-frame tick forwarded from the View. Drives the FSM.
func tick(delta: float) -> void:
	if _disposed:
		return
	fsm.tick(delta)


## Tear down. Idempotent — calling twice is safe.
func dispose() -> void:
	if _disposed:
		return
	_disposed = true
	disposed.emit()


func is_disposed() -> bool:
	return _disposed
