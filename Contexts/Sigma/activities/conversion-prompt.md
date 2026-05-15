# Activity Spec → Manifest JSON Conversion Prompt

This prompt converts a Nanisca activity specification (typically a Google Sheet exported as markdown or plain text) into a conforming activity manifest JSON document. Use it in Claude Code, a CLI, or directly with the API.

---

## Prompt

```
You are converting a Nanisca activity specification into a conforming activity manifest JSON. The source is provided as plain text (typically a Google Sheets export with tabular sections).

Follow the schema defined in `activity-manifest-schema.md` (version 1.1-DRAFT). Produce a single, valid JSON document with this exact top-level structure and order:

{
  "specVersion": "1.1-DRAFT",
  "locale": "en-ZA",
  "meta": { ... },
  "novelParams": { ... },
  "actionSequence": { "core": [...], "contextualised": [...] },
  "strings": { ... },
  "characters": { ... },
  "content": { "defaultOption": "...", "options": [...] },
  "sfx": { ... },
  "instructionalHints": [ ... ]
}

## Mapping rules

### meta
- `identifier`: convert to snake_case (e.g. "Counting Lines" -> "n_counting_lines"). Preserve the leading subject prefix (n_, l_, g_) if present in the source.
- `subconstructs` and `skillsMapping`: parse semicolon- or comma-separated lists into arrays.
- If the source mentions a number of rounds (e.g. "Number of rounds: 4"), add it to `meta.suggestedGlobalParams` as `numberOfRounds`. DO NOT put it in `novelParams`.
- If a global parameter such as `showIntro`, `showDemo`, `showOutro` is referenced or implied, include in `suggestedGlobalParams`.

### novelParams
- Only include parameters specific to this activity. Exclude any parameter whose name matches a global parameter (see Global Parameters Specification).
- Normalise level keys to `L1, L2, L3, ...`. If the source uses `V0/V1/V2`, map to `L1/L2/L3`. If `Levels` column is missing, treat the entire row as a constant and emit `L1` only.
- Map types:
  - Range values like "1-5", "2-10": `type: "integerRange"`, `levels: { Lx: { min, max } }`
  - Single integers: `type: "integer"`
  - Boolean-equivalents (yes/no, On/Off, true/false): `type: "boolean"`
  - Constrained strings (Immediate/Delayed, single/mixed, consistent/varied): `type: "string"`, include `enum`
- Use camelCase for parameter names. Examples:
  - "Number of items per shelf" -> `numberOfItemsPerShelf`
  - "Required touch count" -> `requiredTouchCount`
  - "Feedback" or "Feedback timing" -> `feedbackTiming`
- Preserve the source's "Logic" column verbatim in the `logic` field.

### actionSequence
- One step per row in the Action Sequence table.
- Parse the `Activity` column to `phase`: Intro->`intro`, Demo->`demo`, Main->`main`, Outro->`outro`.
- Parse `Step` as an integer.
- Parse `Required` column: Yes/No -> true/false.
- Decompose `Action Sequence` text into a small set of semantic `actions[]` keys (snake_case, short). Do not preserve the prose verbatim in `actions` — that goes in `strings` if it's audio, or in `sceneDirection` if it's a scene description.
- Move every audio line into `strings` with a meaningful key (e.g. `demo_count_shelf_1`) and reference via `{ "$ref": "#/strings/<key>" }`. If a single step has multiple audio lines, use an array of `$ref` objects.
- SFX cells map to `sfx` keys (snake_case from the SFX library), or `null` if empty.
- If a step has narrative/scene direction (typical in contextualised flows), put the prose in `strings` (prefixed `cx_`) and reference via `sceneDirection: { "$ref": ... }`.
- If the source has TWO action sequence tables (e.g. a "core" generic one and a "contextualised" narrative one), parse them as `core` and one entry under `contextualised` with the appropriate `settingKey`.
- If the source has only one action sequence table that is already contextualised, extract the generic structure into `core` and put the narrative additions into `contextualised`.

### strings
- All localisable text from audio cells, scene directions, and any other learner-facing or production-facing prose.
- Convert source placeholders `[name;value]` and `[name]` to `{name}` form. Drop the `;value` part — concrete values resolve at runtime.
- Normalise placeholder names:
  - `[object;X]` and `[object]` -> `{object}`
  - `[items;X]` and `[items]` -> `{items}`
  - `[item;X]` -> `{item}`
  - `[num;X]` and `[number;X]` -> `{num}` (or `{num_items}` when contextually a count)
  - `[target_number;X]` -> `{num_items}`
  - `[object_character;Name]` -> `{object_character_<name_snake_case>}`
  - `[character_name]` or `[character]` -> `{object_character}`
- Use snake_case keys with phase prefix: `intro_*`, `demo_*`, `main_*`, `outro_*`, and `cx_*` for contextualised strings.

### characters
- Add one entry per named character referenced in any string placeholder.
- If the source mentions a character generically (e.g. "[object;character]"), include a single `object_character` entry with role "protagonist" and a generic description.

### content
- The Settings/Mockups table drives `content.options`. Each column (or row, depending on table orientation) is one option.
- Each option:
  - `key`: snake_case derived from the setting name (e.g. "Cooking vegetables in a soup pot" -> `soup_pot`)
  - `label`: the human-readable setting name
  - `objects`: ALWAYS a plural array, even if there is one object. Parse the [object] row and split on commas if multiple.
  - `items`: array of `{ key, label }`. Convert item names to snake_case keys; preserve labels as written.
  - `ambient`: SFX key for background ambience, or null.
  - `scenarioSfx`: array of SFX keys triggered by gameplay events in this scene, or omit.
  - `notes`: free-text implementation notes from the source (e.g. "* add splash SFX when each item is dropped").
- Choose `defaultOption` as the first setting (typically the one used in the action sequence's demo/intro). If unclear, pick the most "canonical" or generic setting.
- DO NOT include a separate `content.objects` block. Everything is in `options`.

### sfx
- Only include SFX referenced by this manifest (in `actionSequence` or `content`).
- For each, provide `label` and `category` from: `transition`, `success`, `celebration`, `error`, `interaction`, `ambient`.

### instructionalHints
- Copy from the "Instructional Hint" cell at the bottom of the source (typically `nh_*`, `lh_*`, or `Ih_*` codes).

## Critical rules

1. Output a SINGLE JSON object. No commentary, no markdown fences in the output if writing to a file. (If invoked conversationally, you may briefly note conversion decisions before/after the JSON, but the JSON itself must be a single parseable document.)
2. Validate that every `$ref` points into `#/strings/...`.
3. Validate that every SFX key used resolves into the `sfx` map.
4. Validate that every character key used in strings exists in `characters`.
5. Validate that `content.defaultOption` exists in `content.options`.
6. Validate that every `contextualised[].settingKey` exists in `content.options`.
7. If the source has ambiguous or missing data, leave the field as `null` (for nullable fields), an empty array (for lists), or omit (for optional fields). Do not invent content.
8. Preserve all difficulty levels present in the source, even if values are identical across levels.

## When unclear

If a source value is ambiguous or contradictory, flag it in a `_conversionNotes` array at the top of the document. Remove this array before finalising. Example:
```
"_conversionNotes": [
  "Source uses both 'beads' and 'items' interchangeably in audio; standardised on 'items' in placeholders.",
  "Source 'Number of rounds: 4' moved to meta.suggestedGlobalParams (not novel)."
]
```

## Input
The activity specification text follows below:

---
<PASTE THE ACTIVITY SPECIFICATION TEXT HERE>
---
```

---

## Usage examples

### Claude Code

```bash
# Save the spec text to a file, then:
cat my_activity_spec.txt | claude --system "$(cat conversion-prompt.txt)" > my_activity.json
```

### API call (curl)

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d @- <<EOF
{
  "model": "claude-opus-4-7",
  "max_tokens": 16000,
  "messages": [
    {
      "role": "user",
      "content": "$(cat conversion-prompt.txt | jq -Rs .)\n\n$(cat my_activity_spec.txt | jq -Rs .)"
    }
  ]
}
EOF
```

### Programmatic batch (Python pseudocode)

```python
import json
from anthropic import Anthropic

client = Anthropic()
prompt_template = open("conversion-prompt.txt").read()

for spec_file in spec_files:
    spec_text = open(spec_file).read()
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=16000,
        messages=[{
            "role": "user",
            "content": prompt_template.replace("<PASTE THE ACTIVITY SPECIFICATION TEXT HERE>", spec_text)
        }]
    )
    manifest = json.loads(response.content[0].text)
    output_path = f"manifests/{manifest['meta']['identifier']}.json"
    with open(output_path, "w") as f:
        json.dump(manifest, f, indent=2)
```

---

## Validation step (recommended)

After conversion, run a JSON Schema validator (or the checklist in §13 of the schema doc) against each manifest. A minimal pass:

```bash
# Confirm JSON validity
python3 -c "import json; json.load(open('manifest.json'))"

# Confirm no legacy placeholders survived
grep -E '\[[a-z_]+;' manifest.json && echo "WARNING: legacy placeholders found"
```

---

## Iterating on outputs

If a conversion produces an imperfect result, prefer these tactics over rewriting the prompt:

1. **Refine the source.** Most "bad" conversions trace back to ambiguous source text. Clean the spreadsheet first.
2. **Add an addendum to the prompt** for known edge cases (e.g. "This activity has no demo phase — emit an empty demo phase in core").
3. **Post-process** with a small script for repetitive cleanups (e.g. ensuring all item labels are lowercase).
4. **Only modify the core prompt** if the same issue appears across three or more activities — that signals a real schema gap, not a one-off.
