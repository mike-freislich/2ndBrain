## Test Rng. Returns values from queues you preload; falls back to 0.0 / `from`
## when the queue is empty.
##
## Use push_float() and push_int() to queue return values in advance.
class_name FakeRng extends Rng

var _floats: Array[float] = []
var _ints: Array[int] = []


## Queue a float to be returned by the next randf() call. Chainable.
func push_float(v: float) -> FakeRng:
	_floats.append(v)
	return self


## Queue an int to be returned by the next randi_range() call. Chainable.
func push_int(v: int) -> FakeRng:
	_ints.append(v)
	return self


func randf() -> float:
	if _floats.is_empty():
		return 0.0
	return _floats.pop_front()


func randi_range(from: int, _to: int) -> int:
	if _ints.is_empty():
		return from
	return _ints.pop_front()
