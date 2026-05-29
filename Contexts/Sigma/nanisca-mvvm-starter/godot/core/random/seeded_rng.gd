## Production Rng backed by Godot's RandomNumberGenerator.
## Pass a non-zero seed for reproducibility; pass 0 for randomize().
class_name SeededRng extends Rng

var _rng: RandomNumberGenerator


func _init(seed_value: int = 0) -> void:
	_rng = RandomNumberGenerator.new()
	if seed_value != 0:
		_rng.seed = seed_value
	else:
		_rng.randomize()


func randf() -> float:
	return _rng.randf()


func randi_range(from: int, to: int) -> int:
	return _rng.randi_range(from, to)
