## Test Clock. Advances only when advance() is called. Deterministic.
class_name FakeClock extends Clock

var t_ms: int = 0


func now_ms() -> int:
	return t_ms


func advance(ms: int) -> void:
	t_ms += ms


func set_now(ms: int) -> void:
	t_ms = ms
