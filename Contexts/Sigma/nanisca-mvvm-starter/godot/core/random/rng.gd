## Injectable random number generator.
##
## Models and ViewModels MUST use this instead of calling randf()/randi()
## directly. Otherwise tests are non-deterministic.
class_name Rng extends RefCounted

## Returns a float in [0.0, 1.0).
func randf() -> float:
	push_error("Rng.randf() must be overridden")
	return 0.0


## Returns an int in [from, to] inclusive.
func randi_range(from: int, to: int) -> int:
	push_error("Rng.randi_range() must be overridden")
	return from


## Returns a uniformly chosen element from `arr`. Returns null for empty arrays.
func pick(arr: Array) -> Variant:
	if arr.is_empty():
		return null
	return arr[randi_range(0, arr.size() - 1)]
