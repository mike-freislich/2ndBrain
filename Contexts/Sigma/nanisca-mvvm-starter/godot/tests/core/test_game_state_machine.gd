extends "res://addons/gut/test.gd"

## Tests for core/fsm/game_state_machine.gd
## No SceneTree, no nodes, no plugins — pure RefCounted exercise.


class TestState extends GameState:
	var entered: int = 0
	var exited: int = 0
	var handled: Array = []
	var ticked_delta: float = 0.0
	var last_enter_payload: Dictionary = {}

	func enter(payload: Dictionary = {}) -> void:
		entered += 1
		last_enter_payload = payload

	func exit() -> void:
		exited += 1

	func handle(event: StringName, payload: Dictionary = {}) -> void:
		handled.append({"event": event, "payload": payload})

	func tick(delta: float) -> void:
		ticked_delta += delta

	func request(target: StringName, payload: Dictionary = {}) -> void:
		transition_requested.emit(target, payload)


var fsm: GameStateMachine
var s_a: TestState
var s_b: TestState
var changes: Array


func before_each() -> void:
	fsm = GameStateMachine.new()
	s_a = TestState.new()
	s_b = TestState.new()
	changes = []
	fsm.state_changed.connect(func(from, to): changes.append([from, to]))


func test_register_returns_self_for_chaining() -> void:
	var returned := fsm.register(&"a", s_a)
	assert_eq(returned, fsm)


func test_start_enters_initial_and_emits_state_changed() -> void:
	fsm.register(&"a", s_a)
	fsm.start(&"a")
	assert_eq(s_a.entered, 1)
	assert_eq(fsm.current_name, &"a")
	assert_eq(changes, [[&"", &"a"]])


func test_start_forwards_payload_to_initial_enter() -> void:
	fsm.register(&"a", s_a)
	fsm.start(&"a", {"x": 1})
	assert_eq(s_a.last_enter_payload.get("x", 0), 1)


func test_dispatch_forwards_event_to_current_state() -> void:
	fsm.register(&"a", s_a).register(&"b", s_b)
	fsm.start(&"a")
	fsm.dispatch(&"poke", {"value": 42})
	assert_eq(s_a.handled.size(), 1)
	assert_eq(s_a.handled[0].event, &"poke")
	assert_eq(s_a.handled[0].payload.value, 42)
	assert_eq(s_b.handled.size(), 0)


func test_state_requested_transition_runs_exit_then_enter() -> void:
	fsm.register(&"a", s_a).register(&"b", s_b)
	fsm.start(&"a")
	s_a.request(&"b", {"reason": "ready"})
	assert_eq(s_a.exited, 1)
	assert_eq(s_b.entered, 1)
	assert_eq(s_b.last_enter_payload.get("reason", ""), "ready")
	assert_eq(fsm.current_name, &"b")
	assert_eq(changes, [[&"", &"a"], [&"a", &"b"]])


func test_tick_forwards_delta_to_current_state_only() -> void:
	fsm.register(&"a", s_a).register(&"b", s_b)
	fsm.start(&"a")
	fsm.tick(0.016)
	assert_almost_eq(s_a.ticked_delta, 0.016, 0.0001)
	assert_almost_eq(s_b.ticked_delta, 0.0, 0.0001)


func test_change_to_performs_external_transition() -> void:
	fsm.register(&"a", s_a).register(&"b", s_b)
	fsm.start(&"a")
	fsm.change_to(&"b")
	assert_eq(fsm.current_name, &"b")


func test_has_state() -> void:
	fsm.register(&"a", s_a)
	assert_true(fsm.has_state(&"a"))
	assert_false(fsm.has_state(&"b"))
