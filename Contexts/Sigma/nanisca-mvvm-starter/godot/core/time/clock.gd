## Injectable clock interface.
##
## Models and ViewModels MUST use this instead of calling Time.* directly —
## otherwise tests need to run the engine to advance time.
class_name Clock extends RefCounted

func now_ms() -> int:
	push_error("Clock.now_ms() must be overridden")
	return 0
