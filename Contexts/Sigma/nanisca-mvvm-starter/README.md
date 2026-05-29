# Nanisca MVVM Starter

A starter bundle for the Godot side of Nanisca. Drop-in scaffold for the MVVM + `RefCounted` FSM architecture proposed in the architecture report.

## What's in here

```
nanisca-mvvm-starter/
├── README.md                          # this file
├── playbook/
│   └── mvvm.md                        # conventions, smells, worked example
├── prompts/
│   └── migrate-to-mvvm.md             # Claude Code prompt to migrate existing games
└── godot/                             # copy into res:// of the Godot project
    ├── core/
    │   ├── fsm/
    │   │   ├── game_state.gd
    │   │   └── game_state_machine.gd
    │   ├── mvvm/
    │   │   ├── model_base.gd
    │   │   ├── view_model_base.gd
    │   │   └── view_base.gd
    │   ├── time/
    │   │   ├── clock.gd
    │   │   ├── system_clock.gd
    │   │   └── fake_clock.gd
    │   └── random/
    │       ├── rng.gd
    │       ├── seeded_rng.gd
    │       └── fake_rng.gd
    └── tests/
        └── core/
            ├── test_game_state_machine.gd
            ├── test_clock.gd
            └── test_rng.gd
```

## Integration steps

1. **Copy the scaffold.** Copy `godot/core/` to `res://core/` and `godot/tests/core/` to `res://tests/core/` in the Nanisca project.
2. **Install GUT** (if not already): https://github.com/bitwes/Gut. The included tests assume GUT at `res://addons/gut/`.
3. **Run the tests** to confirm the scaffold is healthy:

   ```
   godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests -gexit
   ```

   You should see ~16 passing tests across `test_game_state_machine.gd`, `test_clock.gd`, and `test_rng.gd`.

4. **Place the playbook.** Copy `playbook/mvvm.md` into the repo's documentation folder (or the engineering playbook repo if Nanisca's docs live there).
5. **Place the migration prompt.** Copy `prompts/migrate-to-mvvm.md` into `prompts/` or wherever the team keeps Claude Code prompts.
6. **Open a tracking ticket** for the first mini-game migration. Recommended first target: whichever mini-game has the least Android-bridge coupling.

## What you do NOT get from this bundle

Deliberately out of scope:

- A reference mini-game implementation. The playbook contains a worked example for Cosmic Catcher; turning that into actual code is the first migration ticket, not a bundle deliverable.
- The `session/` outer-FSM. That's a separate piece of work — same pattern, different states. Build it when you're ready to wire up the catalog → game → feedback flow end-to-end.
- A `core/persistence/` repository pattern. The playbook references it; the actual SQLite implementation depends on the Android bridge shape and is best built per the existing native-Android conventions.
- Imagegen / animation tooling. Views own their own animation; nothing here changes that.

## Versioning

This bundle assumes Godot 4.4+ (typed `Dictionary[K, V]` syntax). If the project is on 4.3 or earlier, `_states: Dictionary[StringName, GameState]` in `game_state_machine.gd` needs to be changed to plain `Dictionary`.

## Sequence of work after dropping this in

| Step | Outcome | Estimate |
|---|---|---|
| 1 | Scaffold in place, tests green in CI | 0.5 day |
| 2 | First migration: pick one mini-game, run `migrate-to-mvvm.md` in analyze/plan/apply mode | 2–3 days |
| 3 | Build `session/` outer game-sequence FSM with tests | 2 days |
| 4 | Wire the migrated mini-game into the outer session | 1 day |
| 5 | Migrate remaining mini-games (each subsequent one is faster as the playbook matures) | varies |

## License / attribution

Internal Sigma Digital material. Reuse freely inside the org.
