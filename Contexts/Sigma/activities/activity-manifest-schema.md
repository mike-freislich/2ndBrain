# Activity Manifest — Schema & Semantics

**Version:** 1.1-DRAFT  
**Status:** Working draft  
**Applies to:** `specVersion: "1.1-DRAFT"`

This document describes the canonical structure of an activity manifest, the semantics of every section, and the rules that govern how the manifest is interpreted by the platform. It is the authoritative reference for content authors, learning designers, and developers writing or consuming activity specs.

---

## 1. Purpose

An activity manifest is a declarative description of a single learning activity. It is consumed by the platform at activity load and used to:

1. Populate the activity's novel parameters in the state store (see *Global Parameters Specification*).
2. Drive the activity's lifecycle (intro → demo → main → outro).
3. Supply the asset vocabulary (objects, items, scenes) the activity can render.
4. Provide all human-readable strings the activity needs.

The manifest **declares** content; it does not contain executable logic.

---

## 2. Document Shape

A conforming manifest contains the following top-level sections, in this order:

```
{
  "specVersion":         "1.1-DRAFT",
  "locale":              "en-ZA",
  "meta":                { ... },
  "novelParams":         { ... },
  "actionSequence":      { core: [...], contextualised: [...] },
  "strings":             { ... },
  "characters":          { ... },
  "content":             { defaultOption, options: [...] },
  "sfx":                 { ... },
  "instructionalHints":  [ ... ]
}
```

Every section except `characters` and `instructionalHints` is **required**. The `contextualised` array inside `actionSequence` may be empty for activities without a contextualised narrative.

---

## 3. `specVersion` and `locale`

| Field | Type | Description |
|-------|------|-------------|
| `specVersion` | string | The manifest schema version this document conforms to. Used by tooling for migration. |
| `locale` | string | The locale of all strings in this manifest, in `language-REGION` form. A future localisation pipeline will produce per-locale variants. |

---

## 4. `meta`

Activity identity and pedagogical classification. Drives discovery, indexing, and skills mapping.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identifier` | string | yes | Unique machine-readable key (e.g. `n_select_shelf`). Must be unique across all activities. Snake case. |
| `title` | string | yes | Human-readable activity name. |
| `subject` | string | yes | Curriculum subject (e.g. `Numeracy`, `Literacy`). |
| `subconstructs` | string[] | yes | Curriculum subconstruct codes (e.g. `["N1.1", "N1.2"]`). |
| `skillsMapping` | string[] | yes | Specific skill codes targeted (e.g. `["N1.1.1-F"]`). |
| `activityFamily` | string | yes | Interaction modality (e.g. `Interactive - Tap`, `Interactive - Drag`). |
| `activityType` | string | yes | Specific interaction pattern (e.g. `Tap to select answer with audio clue`). |
| `layoutTemplate` | string \| null | no | Optional UI layout variant. |
| `description` | string | yes | Brief description of the learning objective. |
| `senAffordances` | string[] | no | Accessibility considerations. May be empty. |
| `suggestedGlobalParams` | object | no | Hints at default values for global parameters (e.g. `numberOfRounds`). Informational only — the platform may override. |

---

## 5. `novelParams`

Activity-specific parameters unique to this activity type. These have no meaning outside the activity. Each parameter declares its type, optional logic note, and per-level values.

```json
"novelParams": {
  "<paramName>": {
    "type": "integer" | "integerRange" | "string" | "boolean",
    "enum": ["..."],                          // required when type=string with constrained values
    "logic": "Human-readable constraint",     // optional
    "levels": {
      "L1": <value>, "L2": <value>, ...
    }
  }
}
```

### Parameter types

| Type | `levels` value shape | Example |
|------|---------------------|---------|
| `integer` | a number | `"L1": 2` |
| `integerRange` | `{ "min": n, "max": n }` | `"L1": { "min": 1, "max": 5 }` |
| `string` | a string from `enum` | `"L1": "same"` |
| `boolean` | `true` / `false` | `"L1": true` |

### Level keys

Levels are named `L1`, `L2`, `L3`, etc. Any number of levels is permitted, but **at least two**. Levels represent a progression from easiest (`L1`) to hardest (`Ln`). If the source spec uses other naming (e.g. `V0/V1/V2`), normalise to `L1/L2/L3` on conversion.

### What goes in `novelParams`

Only parameters specific to this activity type. **Do not include** global parameters such as `numberOfRounds`, `showIntro`, `progressType` — those are governed by the *Global Parameters Specification* and supplied by the platform at runtime. If a manifest needs to hint at a global default, put it in `meta.suggestedGlobalParams`.

---

## 6. `actionSequence`

The step-by-step interaction flow. Split into `core` (the generic flow) and `contextualised` (variations bound to specific content settings).

```json
"actionSequence": {
  "core": [ <Step>, <Step>, ... ],
  "contextualised": [
    {
      "settingKey": "<content.options key>",
      "steps": [ <Step>, ... ]
    }
  ]
}
```

### `Step` shape

```json
{
  "phase":     "intro" | "demo" | "main" | "outro",
  "step":      <integer>,
  "required":  <boolean>,
  "repeat":    "numberOfRounds" | null,         // optional; marks looped steps
  "variant":   "<variant_key>",                 // optional; identifies one of several alternative paths
  "condition": "<expression>",                  // optional; gate expression (e.g. "level >= L2", "correct_selection")
  "actions":      [ "<action_key>", ... ],      // semantic action descriptors
  "sceneDirection": { "$ref": "#/strings/..." },// optional; scene description (contextualised flows)
  "audio":     null | { "$ref": "#/strings/..." } | [ { "$ref": "..." }, ... ],
  "sfx":       null | "<sfx_key>"
}
```

### Phase semantics

| Phase | Gated by global param | Purpose |
|-------|----------------------|---------|
| `intro` | `showIntro` | Character introduction, setup narrative. |
| `demo` | `showDemo` | Tutorial walkthrough with pointer guidance. |
| `main` | always runs | Gameplay loop. Steps with `repeat: "numberOfRounds"` execute once per round. |
| `outro` | `showOutro` | Celebratory closing. |

### `required` semantics

- `true`: the step is mandatory for a conforming implementation.
- `false`: the step is recommended but may be omitted without violating conformance.

### `condition` semantics

Free-form expression evaluated at runtime. Common forms:
- `level >= L2` — gate by current difficulty.
- `correct_selection` / `incorrect_selection` — gate by learner response.
- `target_reached` / `all_items_used` — gate by game state predicates.
- `<paramName> == <value>` — gate by a novel param's current value.

The platform interprets these; the manifest does not implement them.

### `variant` semantics

Identifies alternative paths through the same step number. Two `main` steps with the same `step` value but different `variant` keys represent mutually exclusive variations (e.g. `touch_count_required` vs `check_button_required`).

### Contextualised flows

A contextualised entry adds or overrides steps for a specific setting. It does **not** replace the core flow entirely. The runtime merges: for any step where the contextualised flow has an entry at the same `phase` + `step` + `variant`, the contextualised entry takes precedence (typically by adding `sceneDirection` or substituting audio).

---

## 7. `strings`

All localisable text. Referenced from `actionSequence` via JSON Pointers (`{ "$ref": "#/strings/<key>" }`).

```json
"strings": {
  "_comment": "All localisable strings. Placeholders use {param} syntax resolved at runtime.",
  "<key>": "<text with {placeholders}>"
}
```

### Placeholder syntax

Placeholders are wrapped in curly braces and resolved at runtime against the active content option, characters, and game state. **Use** `{name}` syntax. **Do not use** the source-sheet form `[name;value]`.

| Placeholder | Resolves to |
|-------------|-------------|
| `{object}` | The active option's primary `objects[0]` label. |
| `{objects}` | Plural form. |
| `{item}` | A single item's label. |
| `{items}` | A plural form. |
| `{num}` | A numeric value. |
| `{num_items}` | The target item count (often the round's correct answer). |
| `{num_items_line_N}` | Count for a specific positional element. |
| `{object_character}` | The active character. |
| `{object_character_<key>}` | A specific character by key (matches `characters` map). |

If you need to embed a literal brace, escape with backslash: `\{`.

### Key naming convention

- Generic flow strings start with the phase: `intro_*`, `demo_*`, `main_*`, `outro_*`.
- Contextualised strings are prefixed with `cx_`: `cx_intro_scene_1`, `cx_thank_customer`.
- Scene direction strings (visual descriptions, not learner-facing audio) live in `strings` like any other localisable text — they may still be translated for production teams.

---

## 8. `characters`

Named dramatis personae used by the activity. May be empty for activities without named characters; in that case, use a single generic `object_character` entry as a placeholder.

```json
"characters": {
  "<character_key>": {
    "name":        "<display name>",
    "role":        "protagonist" | "supporting" | "customer" | "narrator" | ...,
    "description": "<brief description>"
  }
}
```

Character keys are referenced from `strings` placeholders (e.g. `{object_character_phalo}` references `characters.object_character_phalo`).

---

## 9. `content`

The asset vocabulary the activity can render, organised as a set of self-contained scene options. The `defaultOption` points to the canonical/example scene used by the demo and (in the absence of override) by the main phase.

```json
"content": {
  "defaultOption": "<options key>",
  "options": [
    {
      "key":     "<unique key>",
      "label":   "<human-readable label>",
      "objects": [ "<object_key>", ... ],
      "items":   [ { "key": "<item_key>", "label": "<item label>" }, ... ],
      "ambient": "<sfx_key>" | null,
      "scenarioSfx": [ "<sfx_key>", ... ],
      "notes":   "<optional implementation notes>"
    }
  ]
}
```

### Why one unified structure

The earlier shape (`content.objects` + `content.settings`) duplicated information for the default scene. The unified `options` model treats every scene as a complete, self-contained content set. The default is expressed as a key pointer, eliminating duplication and producing a uniform shape across activities.

### `objects` semantics

`objects` is **always an array of strings**, even when there is only one object. A scene with a single receptacle has `["shelf"]`; a scene with multiple linked objects has `["pot", "steam"]`. Item keys reference the items the object(s) can hold.

### `items` semantics

Each item is an object with a `key` and a `label`. The `label` is localisable; the `key` is stable across locales and used in placeholder resolution.

### `ambient` and `scenarioSfx`

- `ambient`: a single SFX key for background ambience (referenced in `sfx`).
- `scenarioSfx`: an array of SFX keys for one-off events specific to this scene (e.g. `splash`, `sizzle`).

### Setting selection

Whether the platform selects the active option at `ACTIVITY_LOADED`, rotates options across rounds, or exposes the choice to the learner is an **implementation concern**, not a manifest concern. The manifest only declares what is available.

---

## 10. `sfx`

A flat map of SFX keys to their metadata. SFX keys referenced from `actionSequence` and `content` resolve here.

```json
"sfx": {
  "<sfx_key>": {
    "label":    "<human-readable label>",
    "category": "transition" | "success" | "celebration" | "error" | "interaction" | "ambient"
  }
}
```

Only include SFX actually used by this manifest. The platform's SFX library is the authoritative source; the manifest's `sfx` section is a local reference table.

---

## 11. `instructionalHints`

A list of instructional hint identifiers from the platform's hint library, applicable to this activity. May be empty.

```json
"instructionalHints": [ "nh_counting_items_target", "nh_tap_for_number" ]
```

---

## 12. Authoring rules

1. **No global parameters in `novelParams`.** Global params live in the *Global Parameters Specification*. Use `meta.suggestedGlobalParams` for hints only.
2. **No executable logic.** The manifest is declarative. Rules go in `logic` strings; the platform implements them.
3. **No hard-coded values in placeholders.** `{num_items}` resolves at runtime. Do not write `[num;3]` or embed concrete numbers.
4. **`objects` is always a plural array.** Even with one object.
5. **Levels normalise to `L1, L2, …`.** Source sheets using `V0/V1/V2` or other names are normalised on import.
6. **JSON Pointers (`$ref`) only point into `#/strings/…`.** Other cross-references (SFX, characters, content options) use plain keys.
7. **Every referenced string, SFX, character, and content option must exist.** Validators should reject manifests with dangling references.

---

## 13. Validation checklist

A manifest is valid if:

- [ ] `specVersion` matches a known schema version.
- [ ] `meta.identifier` is snake-case and unique.
- [ ] Every `novelParams.*.levels` has at least two level keys named `L1`, `L2`, …
- [ ] No `novelParams` key shadows a global parameter name.
- [ ] Every `actionSequence` step has `phase`, `step`, and `required`.
- [ ] Every `$ref` in `actionSequence` resolves into `strings`.
- [ ] Every SFX key in `actionSequence` and `content` resolves into `sfx`.
- [ ] Every character key referenced in `strings` exists in `characters`.
- [ ] `content.defaultOption` matches an entry in `content.options`.
- [ ] Every `content.options[].objects` is a non-empty array.
- [ ] Every `contextualised[].settingKey` matches a `content.options` key.
- [ ] No placeholder string contains the legacy `[name;value]` syntax.

---

## 14. Change log

| Version | Date | Changes |
|---------|------|---------|
| 1.0-DRAFT | 2026-04-17 | Initial draft based on `n_select_shelf`. |
| 1.1-DRAFT | 2026-04-18 | Unified `content.objects`/`content.settings` into `content.options` + `content.defaultOption`. Standardised `objects` as plural array. Added `meta.suggestedGlobalParams`. Standardised level naming on `L1, L2, …`. Made `actionSequence.contextualised` an array (was an object). |
