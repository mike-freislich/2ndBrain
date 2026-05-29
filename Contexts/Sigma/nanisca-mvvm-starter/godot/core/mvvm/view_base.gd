## Base class for View layer scene scripts.
##
## A View owns:
##   - A reference to its ViewModel (set via bind()).
##   - Scene tree manipulation, animations, audio, input handling.
##
## A View does NOT:
##   - implement game rules, scoring, or item selection
##   - mutate the Model directly
##   - read or write the FSM state
##
## Subclass and override _on_bind() to subscribe to VM signals.
class_name ViewBase extends Control

var _vm: ViewModelBase


## Bind the view to its ViewModel. Call once after instantiation.
func bind(vm: ViewModelBase) -> void:
	assert(_vm == null, "View already bound. Use a fresh view for a new VM.")
	_vm = vm
	_on_bind()


## Override to subscribe to VM signals.
func _on_bind() -> void:
	pass


## Forward per-frame ticks from the engine to the ViewModel.
func _process(delta: float) -> void:
	if _vm != null and not _vm.is_disposed():
		_vm.tick(delta)


## Dispose the ViewModel when the View leaves the tree.
func _exit_tree() -> void:
	if _vm != null and not _vm.is_disposed():
		_vm.dispose()
