extends "res://addons/gut/test.gd"

## Tests for core/random/fake_rng.gd and core/random/seeded_rng.gd


func test_fake_rng_returns_queued_floats_in_order() -> void:
	var r := FakeRng.new()
	r.push_float(0.25).push_float(0.75)
	assert_almost_eq(r.randf(), 0.25, 0.0001)
	assert_almost_eq(r.randf(), 0.75, 0.0001)


func test_fake_rng_returns_zero_when_floats_exhausted() -> void:
	var r := FakeRng.new()
	assert_almost_eq(r.randf(), 0.0, 0.0001)


func test_fake_rng_returns_from_when_ints_exhausted() -> void:
	var r := FakeRng.new()
	assert_eq(r.randi_range(5, 10), 5)


func test_fake_rng_pick_returns_null_for_empty() -> void:
	var r := FakeRng.new()
	assert_null(r.pick([]))


func test_fake_rng_pick_uses_queued_int_as_index() -> void:
	var r := FakeRng.new()
	r.push_int(2)
	var arr := ["a", "b", "c"]
	assert_eq(r.pick(arr), "c")


func test_seeded_rng_is_deterministic_with_same_seed() -> void:
	var a := SeededRng.new(42)
	var b := SeededRng.new(42)
	assert_almost_eq(a.randf(), b.randf(), 0.0001)
	assert_almost_eq(a.randf(), b.randf(), 0.0001)


func test_seeded_rng_with_different_seeds_diverges() -> void:
	var a := SeededRng.new(1)
	var b := SeededRng.new(2)
	# Extremely unlikely they happen to produce identical values
	var any_different := false
	for i in 5:
		if not is_equal_approx(a.randf(), b.randf()):
			any_different = true
			break
	assert_true(any_different)
