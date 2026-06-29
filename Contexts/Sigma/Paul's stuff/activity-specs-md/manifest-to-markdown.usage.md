# `manifest-to-markdown.ts` — Usage

Convert Nanisca activity manifest JSON into human-readable Markdown. A single TypeScript file with no third-party dependencies, designed to run in Deno (preferred), Node 22+, Bun, GitHub Actions, or as a library import.

---

## 1. CLI

### Deno (preferred)

```bash
deno run --allow-read --allow-write manifest-to-markdown.ts n_select_shelf.json
# → writes n_select_shelf.md beside the input

deno run --allow-read --allow-write manifest-to-markdown.ts input.json output.md
# → custom output path
```

The script's shebang (`#!/usr/bin/env -S deno run --allow-read --allow-write`) lets you execute it directly:

```bash
chmod +x manifest-to-markdown.ts
./manifest-to-markdown.ts n_select_shelf.json
```

### Node 22+ (fallback)

Node 22 ships with native TypeScript via `--experimental-strip-types`:

```bash
node --experimental-strip-types manifest-to-markdown.ts n_select_shelf.json
```

### Bun

```bash
bun manifest-to-markdown.ts n_select_shelf.json
```

### Batch conversion

```bash
# Bash
for f in manifests/*.json; do
  deno run --allow-read --allow-write manifest-to-markdown.ts "$f"
done

# Or with a single command using xargs
ls manifests/*.json | xargs -I{} deno run --allow-read --allow-write manifest-to-markdown.ts {}
```

---

## 2. GitHub Action

Drop the script into `tools/manifest-to-markdown.ts` and add a workflow that regenerates `.md` files whenever any `.json` manifest changes.

`.github/workflows/manifests.yml`:

```yaml
name: Generate manifest markdown

on:
  push:
    paths:
      - 'manifests/**/*.json'
      - 'tools/manifest-to-markdown.ts'
  pull_request:
    paths:
      - 'manifests/**/*.json'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Convert all manifests
        run: |
          for f in manifests/*.json; do
            deno run --allow-read --allow-write tools/manifest-to-markdown.ts "$f"
          done

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add manifests/*.md
          git diff --staged --quiet || git commit -m "chore: regenerate manifest markdown"
          git push
        if: github.event_name == 'push'
```

For pull-request validation only (no auto-commit, just fail if `.md` is out of date):

```yaml
      - name: Verify markdown is up to date
        run: |
          for f in manifests/*.json; do
            deno run --allow-read --allow-write tools/manifest-to-markdown.ts "$f"
          done
          git diff --exit-code manifests/*.md
```

---

## 3. Server / library use

The script exports `manifestToMarkdown(manifest)` as a pure function. Import it directly from any TypeScript file.

```typescript
import { manifestToMarkdown } from "./manifest-to-markdown.ts";

const manifest = JSON.parse(jsonText);
const markdown = manifestToMarkdown(manifest);
```

### Express / Hono / etc.

```typescript
import { Hono } from "hono";
import { manifestToMarkdown } from "./manifest-to-markdown.ts";

const app = new Hono();

app.post("/render", async (c) => {
  const manifest = await c.req.json();
  const md = manifestToMarkdown(manifest);
  return c.text(md, 200, { "Content-Type": "text/markdown" });
});

export default app;
```

### Deno Deploy

```typescript
import { manifestToMarkdown } from "./manifest-to-markdown.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST a manifest JSON", { status: 405 });
  const manifest = await req.json();
  return new Response(manifestToMarkdown(manifest), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
});
```

---

## 4. What the output looks like

The script produces a structured Markdown document with these sections:

1. **Title block** — title, identifier, spec version, locale.
2. **Meta** — subject, activity family/type, layout template, description, subconstructs, skills mapping, SEN affordances.
3. **Suggested Global Params** (if present) — `numberOfRounds`, `showIntro`, etc.
4. **Novel Parameters** — one sub-section per parameter with a level-by-level table.
5. **Action Sequence** — core flow table; one table per contextualised flow.
6. **Strings** — every localisable string referenced by `$ref`.
7. **Characters** — table of named characters.
8. **Content** — default option key, then one sub-section per content option with objects, ambient SFX, scenario SFX, notes, and items table.
9. **SFX** — table of SFX keys, labels, categories.
10. **Instructional Hints** — bulleted list.

Audio cells in the action sequence resolve `$ref` pointers to show both the key and the resolved string text inline, so reviewers don't have to scroll between sections.

---

## 5. Round-trip considerations

The Markdown output is intended for human review, not machine parsing. It is **not** a lossless representation:

- Action sequence steps are flattened into table rows. The `actions` array is comma-joined.
- Some optional metadata (e.g. `_comment` fields) is omitted.
- Whitespace in long string values is normalised for table cells.

If you need a round-trippable text format, generate the Markdown from the JSON for review, but treat the JSON as the source of truth. Edits should be made to the JSON; the Markdown is regenerated.

---

## 6. LLM fallback prompt

When running code isn't an option (e.g. one-off conversation with Claude, no Deno/Node available), use this prompt:

```
Convert the following Nanisca activity manifest JSON into a human-readable Markdown document. Follow this exact structure:

1. Title block:
   - H1 with the activity title from meta.title
   - Bold "Identifier:" with meta.identifier as inline code
   - Bold "Spec version:" with specVersion
   - Bold "Locale:" with locale as inline code

2. ## Meta — a two-column Markdown table (Field | Value) with rows for: subject, activityFamily, activityType, layoutTemplate, description, subconstructs (comma-joined), skillsMapping (comma-joined), senAffordances (semicolon-joined). Use "_(null)_" for null values and "_(none)_" for empty arrays.

3. ## Suggested Global Params — omit if meta.suggestedGlobalParams is absent. Otherwise a two-column table (Param | Value) with each entry as inline-code param name.

4. ## Novel Parameters — one ### sub-section per parameter. For each:
   - Sub-heading: ### `paramName`
   - **Type:** `type` (inline code)
   - **Enum:** comma-joined values (inline code, if enum present)
   - **Logic:** the logic string (if present)
   - A horizontal table with one column per level key (L1, L2, …) showing the values. For integerRange, render as "min–max" with an en-dash. For booleans, render as "true"/"false".

5. ## Action Sequence
   - ### Core: a 7-column table (Phase | Step | Required | Actions | Audio | SFX | Flags).
     - Required: "yes"/"no"
     - Actions: comma-joined
     - Audio: resolve $ref pointers to show "`key` — text" inline. For arrays of refs, join with "<br>".
     - Flags: combine variant, condition, repeat, sceneDirection as "key: `value`" joined with " · ".
   - One ### Contextualised — `settingKey` table per contextualised entry, same column structure.
   - If no contextualised flows: "_No contextualised flows._"

6. ## Strings — a two-column table (Key | Text) with each key as inline code. Skip the _comment entry. Escape pipes in values as \|.

7. ## Characters — a four-column table (Key | Name | Role | Description). Use "_None._" if absent.

8. ## Content
   - Bold "Default option:" with the key as inline code.
   - ### Options — one #### sub-section per option:
     - Sub-heading: #### `key` — label
     - **Objects:** comma-joined inline-code keys
     - **Ambient SFX:** inline-code key + label in parens (if present)
     - **Scenario SFX:** comma-joined inline-code keys (if present)
     - **Notes:** the notes string (if present)
     - **Items:** preceded by this label, then a two-column table (Key | Label) with keys as inline code.

9. ## SFX — three-column table (Key | Label | Category).

10. ## Instructional Hints — bulleted list of inline-code hint keys. Use "_None._" if empty.

Output the Markdown only — no preamble, no commentary, no code fences around the whole document.

Manifest JSON:
<PASTE JSON HERE>
```

This prompt mirrors the script's output exactly. If the script's behaviour changes, update both this prompt and the structural description above.
