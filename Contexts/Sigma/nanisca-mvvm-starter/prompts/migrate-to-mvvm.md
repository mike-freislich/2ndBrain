# migrate-to-mvvm

**Purpose:** Convert an existing Godot mini-game (script-and-scene blob, or partially organized code) into the Nanisca MVVM layout described in `playbook/mvvm.md`.

**Audience:** Claude Code (or another coding agent) operating on a Godot 4 repository.

**Invariants:**
- Idempotent: re-running the prompt on a partially migrated codebase must converge, not re-do work.
- Auto-discovering: the prompt detects existing structure rather than asking the user where things are.
- Non-destructive in `analyze` and `plan` modes.
- Safe to interrupt: each phase produces a checkpoint artifact on disk.

---

## Inputs

Required:
- `--game-path`: path under `res://games/` for the mini-game being migrated (e.g. `res://games/cosmic_catcher`). If absent, the prompt scans `res://games/` and asks the user to pick.

Optional:
- `--mode`: `analyze` (default) | `plan` | `apply` | `verify`
- `--report-dir`: where to write phase artifacts (default `./migration-reports/<game-name>/`)
- `--accept-bucket`: `A` (default) | `A,B` | `A,B,C` — which finding buckets to actually apply in `apply` mode

---

## Mode routing

| Mode | What it does | Side effects |
|---|---|---|
| `analyze` | Reads the repo, classifies code by likely layer, writes findings to `report-dir`. | None on source. |
| `plan` | Reads the analyze report (or runs analyze first), produces a per-file migration plan with target paths and split points. | None on source. |
| `apply` | Executes the plan up to `--accept-bucket`. Generates new files, leaves originals as `.legacy.gd` for one cycle. | Creates new files; renames originals. |
| `verify` | Re-scans the result, confirms the layout matches `playbook/mvvm.md`, runs tests, lists any remaining smells. | None on source. |

Default flow for a first run: `analyze` → human reviews → `plan` → human reviews → `apply --accept-bucket=A` → `verify`. Then iterate on B and C buckets.

---

## Phase 1 — Reconnaissance

### 1.1 Detect existing structure

Scan `--game-path` and classify what you find:

| Signal | Interpretation |
|---|---|
| Only `.tscn` and one matching `.gd` per scene | Single-script game. High coupling. Expect to extract Model and ViewModel from a fat scene script. |
| `model/`, `view_model/`, `view/` subfolders already present | Partial migration. Run idempotently: only fill gaps and move misplaced files. |
| Multiple `.gd` scripts but no folder structure | Mid-stage. Files probably belong in different layers but are co-located. |
| Autoloads referenced from inside `--game-path` | Likely cross-cutting state. Flag as a separate concern; do not migrate the autoload itself. |
| Calls to `Time.*`, `Input.*`, `randf()` from non-View scripts | Dependencies that must become injected services (`Clock`, `Rng`, semantic commands). |

Write `report-dir/01-structure.md` describing the existing shape. Include:
- File tree of `--game-path`.
- For each `.gd` file: extends, `class_name`, signals defined, signals emitted, methods called on `Time`/`Input`/`randf`/autoloads, references to specific node paths.
- Identified scene → script bindings.

### 1.2 Identify candidates per layer

For each script in `--game-path`, assign one of:

- **Model candidate.** Pure data, pure functions, no scene-tree access, no input handling. Example markers: `class_name *Data`, methods returning calculated values, no `_process`, no `_input`, no `$NodeName` references.
- **ViewModel candidate.** Orchestrates state transitions, holds references to model objects, exposes "commands" (methods called from buttons/input), receives signals from model. May currently extend `Node` — that's a smell to fix, not a disqualifier.
- **View candidate.** Extends `Control`, `Node2D`, `CharacterBody2D`, etc. Calls `play()` on animation players, accesses `$ChildNode`, plays audio.
- **Mixed.** Touches multiple layers. Flag for split.
- **Unclear.** Needs human input.

Write `report-dir/02-layer-candidates.md` with the classification.

### 1.3 Map dependencies

For each script, list:
- Inbound: who calls this, who connects to its signals.
- Outbound: what other scripts/autoloads it imports or references.
- Tight couplings: direct node path access across scripts that should go through a layer boundary.

Write `report-dir/03-dependencies.md`. Include a simple ASCII dependency graph if there are more than three scripts.

### 1.4 Identify high-risk migrations

Flag for slow / careful migration:
- Scripts that interact with the Android bridge (JNI calls, OS.request_permission, etc.).
- Scripts that persist data to disk or to SQLite.
- Scripts referenced by autoloads.
- Scripts that handle audio with timing dependencies.

Write `report-dir/04-risks.md`.

---

## Phase 2 — Bucketing

Sort every proposed change into one of three buckets:

### Bucket A: Clear wins

Apply automatically in `--accept-bucket=A`. Criteria:
- Pure data classes that move into `model/` with no API change.
- Pure functions extracted from a fat script into a Model method.
- `RandomNumberGenerator` / `randf()` calls replaced with an injected `Rng` parameter.
- `Time.get_ticks_msec()` replaced with an injected `Clock` parameter.
- Renaming scripts and folders to match the convention.
- Adding `extends ModelBase` / `extends ViewModelBase` / `extends ViewBase` and removing nothing else.

### Bucket B: Judgement calls

Apply only with explicit user opt-in. Criteria:
- Splitting a fat scene script into View and ViewModel where the seam isn't obvious.
- Introducing state machine states where the current code uses booleans or `match` statements over an enum. The state machine improvement might be a refactor for a separate PR.
- Moving signals from a Model to a ViewModel because the View was connecting directly to the Model.
- Renaming a signal from present-tense (`show_feedback`) to past-tense (`feedback_shown`).

### Bucket C: Deferred

Document but do not attempt to migrate. Criteria:
- Game logic embedded in shader code or animation `call_method_track` calls.
- Code with tight Android-bridge coupling that needs a separate repository abstraction first.
- Scripts already passing tests that would require >50% of test rewrites to migrate.

Write `report-dir/05-buckets.md` listing every proposed change in one of A/B/C with a one-line rationale.

---

## Phase 3 — Plan (run in `plan` mode)

For each Bucket A and Bucket B item, produce:

```
ORIGINAL: res://games/cosmic_catcher/player_state.gd
ACTION:   split
TARGETS:
  - res://games/cosmic_catcher/model/cosmic_catcher_model.gd        (data + select_next_item + record_response)
  - res://games/cosmic_catcher/view_model/cosmic_catcher_view_model.gd  (state registration, commands, signals)
  - res://games/cosmic_catcher/view_model/states/prompt_state.gd    (existing PromptState logic, stripped of Node deps)
  - res://games/cosmic_catcher/view/cosmic_catcher_view.gd          (existing scene-tree wiring, animations)
NOTES:
  - Replace direct calls to `Time.get_ticks_msec()` (line 47) with injected `clock.now_ms()`.
  - The signal `play_correct_sound` (line 92) becomes `feedback_shown(was_correct: bool, ability: float)` in the VM; sound choice moves to the View.
DEPENDENCIES:
  - Requires `core/time/clock.gd` and `core/random/rng.gd` to be present (verify before applying).
```

Write to `report-dir/06-plan.md`. The plan must be readable by a human in 10 minutes — keep entries terse.

---

## Phase 4 — Apply (run in `apply` mode)

### Preconditions

- The plan exists in `report-dir/06-plan.md`. If absent, run Phase 3 first.
- The `core/` scaffold (`game_state.gd`, `game_state_machine.gd`, `view_model_base.gd`, etc.) is present in the repo. If absent, copy from the starter bundle's `godot/core/` first.
- Git working tree is clean. Abort with a clear message if it isn't.

### For each plan item in the accepted buckets

1. **Generate target files.** Use the templates in `playbook/mvvm.md` (the worked example section) as the structural skeleton.
2. **Move the original to `.legacy.gd`.** Don't delete. One migration cycle later, after `verify` passes, the legacy file can be removed in a follow-up PR.
3. **Rewrite `.tscn` references.** When a scene previously attached `player_state.gd`, rewrite the script reference to point at the new View location.
4. **Update imports / `preload(...)` calls** across the codebase to reference the new paths.
5. **Generate a test file stub** at `tests/games/<game_name>/test_<unit>.gd` if one doesn't exist. The stub registers a single failing test so it shows up red until the developer fills it in.

### Idempotence rules

- If a target file already exists with matching `class_name`, do not overwrite. Instead, write a `report-dir/07-conflicts.md` entry describing the conflict.
- If the original file no longer exists but the target does, treat the migration as already done. Note it in `report-dir/08-applied.md` and skip.
- If the original file is identical (by hash) to a previously-recorded legacy file, treat as a no-op.

### Output

Write `report-dir/08-applied.md` listing every change actually made, with paths and a one-line description.

---

## Phase 5 — Verify (run in `verify` mode)

### 5.1 Layout audit

Walk the result and confirm:
- No `extends Node` (or subclass) in `core/`, `session/{model,view_model,states}`, or `games/<x>/{model,view_model,view_model/states}`.
- Every game directory has `model/`, `view_model/`, `view/` subfolders.
- Every Model, ViewModel has a corresponding test file in `tests/`.
- No raw string literals as state names outside the VM that owns them.

### 5.2 Smell audit

Run the code-review checklist from `playbook/mvvm.md` § "Code review checklist (the smells)". For each smell found, report:
- File and line number.
- Which smell it is.
- Suggested fix.

Write `report-dir/09-smells.md`.

### 5.3 Test run

Invoke GUT (or GdUnit4) headless:

```
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://tests -gexit
```

Capture pass/fail counts and write to `report-dir/10-test-results.md`. If tests don't run (e.g. GUT not installed), flag it and skip — don't fail verification.

### 5.4 Final report

Write `report-dir/11-summary.md` with:
- Buckets applied this cycle.
- Smells remaining (count by category).
- Test results.
- Recommended next prompt invocation (see Phase 6).

---

## Phase 6 — Follow-up prompts

Based on `11-summary.md`, generate one or more follow-up prompt invocations. Common patterns:

- **Smells remain in applied files.** Generate `follow-up: fix-smells-<game>.md` with specific file/line targets.
- **Bucket B items deferred.** Generate `follow-up: bucket-b-<game>.md` listing them for human review.
- **Tests missing.** Generate `follow-up: write-tests-<game>.md` with a stub list of test names to implement.
- **Bucket C items.** Generate `follow-up: investigate-<topic>.md` describing each deferred concern.

Write follow-up prompts to `report-dir/follow-ups/`. Each is a self-contained Claude Code prompt that can be invoked independently.

---

## Hard constraints

- **Never delete files in `apply` mode.** Rename to `.legacy.gd` only.
- **Never modify `.tscn` files in `analyze` or `plan` mode.**
- **Never edit `core/` itself in any mode.** The framework is a fixed dependency.
- **Never invent new conventions.** If the playbook doesn't cover a case, leave it in Bucket C and surface it in `11-summary.md` for human resolution.
- **Never assume Godot version > 4.4** unless the project file confirms it. Typed dictionaries (`Dictionary[K, V]`) require 4.4+; degrade gracefully to untyped if needed.

---

## Example invocations

Discover the shape of a game, no changes:

```
claude-code run prompts/migrate-to-mvvm.md \
  --game-path=res://games/cosmic_catcher \
  --mode=analyze
```

Generate a plan after analysis is reviewed:

```
claude-code run prompts/migrate-to-mvvm.md \
  --game-path=res://games/cosmic_catcher \
  --mode=plan
```

Apply only the clear wins:

```
claude-code run prompts/migrate-to-mvvm.md \
  --game-path=res://games/cosmic_catcher \
  --mode=apply \
  --accept-bucket=A
```

Verify the result and produce follow-up prompts:

```
claude-code run prompts/migrate-to-mvvm.md \
  --game-path=res://games/cosmic_catcher \
  --mode=verify
```

---

## Stop conditions

Abort the prompt with a clear message if any of these hold:
- The repository has uncommitted changes (in `apply` mode only).
- `core/` is missing — the scaffold has not been added to the project.
- `playbook/mvvm.md` is missing — the prompt has no convention to reference.
- The `--game-path` doesn't exist or is empty.
- The `report-dir` is not writable.

Abort with no side effects. The user resolves the precondition and re-invokes.
