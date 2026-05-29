extends "res://addons/gut/test.gd"

## Tests for core/time/fake_clock.gd


func test_fake_clock_starts_at_zero() -> void:
	var c := FakeClock.new()
	assert_eq(c.now_ms(), 0)


func test_fake_clock_advance_accumulates() -> void:
	var c := FakeClock.new()
	c.advance(500)
	assert_eq(c.now_ms(), 500)
	c.advance(250)
	assert_eq(c.now_ms(), 750)


func test_fake_clock_set_now_overrides() -> void:
	var c := FakeClock.new()
	c.advance(100)
	c.set_now(0)
	assert_eq(c.now_ms(), 0)
	c.set_now(9999)
	assert_eq(c.now_ms(), 9999)
