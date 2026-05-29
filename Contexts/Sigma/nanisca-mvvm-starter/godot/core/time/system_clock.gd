## Production Clock. Wraps Time.get_ticks_msec().
## Construct once at the scene bootstrap and inject into ViewModels.
class_name SystemClock extends Clock

func now_ms() -> int:
	return Time.get_ticks_msec()
