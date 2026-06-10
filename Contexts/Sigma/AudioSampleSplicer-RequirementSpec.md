# Audio Sample Splicer — Requirement Specification

**Identifier:** `feat_audio_sample_splicer`
**Spec version:** 1.0-DRAFT
**Status:** Draft — open questions in §13 to be resolved before implementation
**Date:** 2026-06-10
**Source brief:** [[AudioSampleSplicer]]
**Applies to:** ContentCollider (content pipeline) · Nanisca Games (Godot runtime)
**Engineering bar:** [[sigma-engineering-standards]] · Godot work follows [[appendix-godot]]
**Reference activity:** [[n_select_shelf]] (a consumer of this feature)

---

## 1. Background & Problem Statement

Nanisca games run on **offline, low-spec tablets**, so every audio asset must ship on-device. All spoken audio is generated ahead of time by **TTS AI models inside ContentCollider** and stored as `.ogg` files in the `nanisca-content` repository.

A large fraction of in-game speech is **templated**: the same sentence recurs with one variable word, e.g.

> "Choose the shelf with **[seven]** items"

where `seven` is substituted at runtime with `six`, `two`, … up to ~20 variants. Generating and storing the full sentence once per variant is wasteful (≈20× the audio for one line) and scales badly across a content set.

**The feature:** generate the sentence **once** as a *template* with the variable word removed, plus a set of independently-generated *insert words* that sound natural when spliced back into the template at runtime. ContentCollider produces the assets and the splice metadata; the Nanisca Godot runtime reconstructs the full sentence on demand.

The naturalness requirement is the crux: a flatly-generated standalone "three" sounds wrong next to template prosody. Insert words must therefore be generated **in sentence context** and extracted, so they carry the correct intonation and coarticulation.

---

## 2. Goals & Non-Goals

### Goals
- **G1** — Generate, per templated line, one template audio asset plus N insert-word assets, all natural-sounding when spliced.
- **G2** — Emit a machine-readable **splice contract** (metadata) that the runtime consumes without guesswork.
- **G3** — Provide a reusable Godot `SampleSplicer` type that returns a play-ready `AudioStream` for any (template, insert) pair.
- **G4** — Reduce on-device audio footprint versus storing every full-sentence variant.
- **G5** — Splice quality is **click/pop-free** and indistinguishable from a natively-generated full sentence in blind listening for the target locale (`en-ZA` first).

### Non-Goals
- **NG1** — Real-time TTS on device. All generation is offline in ContentCollider.
- **NG2** — More than one insert slot per sentence (single variable word in v1 — see §13 Q1).
- **NG3** — Runtime pitch/time-stretch or DSP correction of mismatched takes. Naturalness is a generation-time responsibility, not a runtime fix.
- **NG4** — Authoring UI / content-tooling UX. This spec defines the engine and the contract, not the editor surface.

---

## 3. Glossary

| Term | Meaning |
|:---|:---|
| **Templated line** | A sentence with exactly one variable word, authored with the variable in brackets, e.g. `Tap the shelf with [seven] items`. |
| **Template audio** | The sentence with the variable word removed, e.g. spoken "Tap the shelf with … items", with a defined insert point. |
| **Insert word** | A single variable word (`one`…`twenty`) extracted from a full in-context generation, stored as its own asset. |
| **Insert point / `insertSampleLocation`** | The sample index in the decoded template PCM at which insert audio is spliced. |
| **Splice contract** | The metadata record binding a template to its insert point, audio format, and the set of insert words. The interface between the two teams. |
| **Sample location** | A position expressed as a count of audio frames (samples per channel) from the start of the **decoded PCM** stream — *not* bytes, *not* a compressed-packet offset, *not* seconds. |
| **Frame** | One sample across all channels (mono: 1 value; stereo: 2). All sample locations are frame indices. |

---

## 4. System Overview

```
  ContentCollider (offline pipeline)                 nanisca-content repo            Nanisca Game (Godot, on-device)
 ┌───────────────────────────────────┐              ┌──────────────────────┐        ┌──────────────────────────────┐
 │ 1. TTS full sentence              │              │ *.template.ogg       │        │ load assets + splice contract│
 │ 2. align + locate variable word   │  ──emit──▶   │ *.insert_<word>.ogg  │ ──▶    │ decode ogg → PCM (once)      │
 │ 3. cut template + extract inserts │              │ *.splice.json        │        │ SampleSplicer.splice(...)    │
 │ 4. write splice contract          │              │ (the splice contract)│        │ → AudioStream → player       │
 └───────────────────────────────────┘              └──────────────────────┘        └──────────────────────────────┘
```

The two teams are coupled **only** through the artifacts in `nanisca-content`: the audio files and the splice contract (§6). Either side may change internally as long as the contract holds.

---

## 5. The Shared Contract (Interface) — Normative

> This section is the **authoritative interface** between ContentCollider and Nanisca Games. Changes here require sign-off from both teams and a contract `schemaVersion` bump.

### 5.1 Asset naming & layout

Per templated line `<id>`:

| Artifact | Path pattern | Notes |
|:---|:---|:---|
| Template audio | `<dir>/<id>.template.ogg` | Sentence with the variable word removed. |
| Insert word audio | `<dir>/<id>.insert_<word_key>.ogg` | One per variant; `<word_key>` is a stable slug (`one`, `two`, …). |
| Splice contract | `<dir>/<id>.splice.json` | Sidecar metadata, one per templated line. |

### 5.2 Splice contract schema (`*.splice.json`)

```json
{
  "schemaVersion": 1,
  "id": "n_select_shelf__choose_count",
  "locale": "en-ZA",
  "sourceText": "Choose the shelf with [seven] items",
  "audioFormat": {
    "codec": "ogg-vorbis",
    "sampleRate": 48000,
    "channels": 1,
    "sampleFormat": "f32"
  },
  "template": {
    "file": "n_select_shelf__choose_count.template.ogg",
    "durationSamples": 131072,
    "insertSampleLocation": 72345
  },
  "inserts": [
    {
      "wordKey": "one",
      "text": "one",
      "file": "n_select_shelf__choose_count.insert_one.ogg",
      "durationSamples": 9800,
      "leadSilenceSamples": 240,
      "trailSilenceSamples": 320
    }
  ],
  "splice": {
    "crossfadeSamples": 128,
    "snapToZeroCrossing": true
  },
  "provenance": {
    "ttsModel": "<model id + version>",
    "generatedAtUtc": "2026-06-10T00:00:00Z",
    "colliderVersion": "<semver>"
  }
}
```

### 5.3 Contract invariants (both sides MUST honour)

- **I1 — Uniform format.** Every template and every insert in one contract share identical `audioFormat` (sample rate, channel count, sample format). The runtime MUST reject a contract whose decoded assets disagree.
- **I2 — Frame-indexed locations.** `insertSampleLocation`, `durationSamples`, and all silence fields are **frame counts in decoded PCM**, measured after any codec priming/delay has been compensated (§9.4). Seconds and byte offsets are never used in the contract.
- **I3 — Bounds.** `0 ≤ insertSampleLocation ≤ template.durationSamples`.
- **I4 — Self-describing.** The runtime never infers the insert point from the audio; it reads it from the contract. ContentCollider is the sole authority for the insert point.
- **I5 — Versioned.** A consumer that does not recognise `schemaVersion` MUST soft-fail (§11), not guess.
- **I6 — Stable keys.** `wordKey` values are stable identifiers used by game code to select a variant; renaming one is a breaking content change.

---

## 6. ContentCollider Requirements (Component A)

The pipeline is a **content build-time** process (Tier 1 per [[sigma-engineering-standards]] §7 — real data, internal/tooling audience). Functional requirements:

- **CC-1 — Accept a templated line.** Input is text with exactly one bracketed variable word, e.g. `Tap the shelf with [seven] items`, plus the insert-word list (e.g. `one … twenty`) and a target `locale`.
- **CC-2 — Generate the in-context exemplar.** Synthesize the **full** sentence with the bracketed word in place (e.g. "Tap the shelf with seven items") via TTS.
- **CC-3 — Locate the variable word.** Determine the start/end sample boundaries of the variable word within the exemplar.
  - **Recommended approach: forced alignment**, not blind transient detection. Use word-level timestamps from the TTS engine if available, otherwise a forced aligner (e.g. an alignment model over the known transcript). Transient/energy detection is permitted only as a fallback and MUST be validated against the alignment. *(Rationale + decision: §13 Q2.)*
  - Boundaries are snapped to the nearest zero crossing and may include a small configurable guard (lead/trail) to preserve coarticulated edges.
- **CC-4 — Produce the template.** Remove the variable word's span from the exemplar to yield `*.template.ogg` (e.g. "Tap the shelf with … items"), and record the resulting `insertSampleLocation` (the join point).
- **CC-5 — Extract the seed insert.** Cut the variable word's span into `*.insert_<word_key>.ogg` (the word the template was generated around, e.g. `seven`).
- **CC-6 — Generate the variant inserts.** For each word in the insert list:
  1. Synthesize the **whole sentence in context** with that word substituted (e.g. "Tap the shelf with three items").
  2. Align and extract **only the inserted word** into `*.insert_<word_key>.ogg`.
  - Extracting from an in-context generation (not a standalone word) is **mandatory** — this is what makes the spliced result sound natural (correct prosody/coarticulation).
- **CC-7 — Normalise across assets.** Template and all inserts MUST be emitted at one uniform `audioFormat` (§5.3 I1), loudness-normalised to a common target so no variant is louder/quieter than the template bed.
- **CC-8 — Emit the splice contract.** Write `*.splice.json` (§5.2) with frame-accurate locations, silence guards, and provenance.
- **CC-9 — Self-verify.** Before publishing, the pipeline MUST splice each insert into the template using the **same algorithm the runtime uses** (or a reference implementation of it) and run automated quality checks (§10) — no asset ships unverified.
- **CC-10 — Determinism & provenance.** Record TTS model id/version and collider version in the contract. Re-running with the same inputs and model version SHOULD reproduce equivalent assets (supply-chain/provenance, [[sigma-engineering-standards]] §6).
- **CC-11 — Reject bad input.** Zero or multiple bracketed words, an empty insert list, or a word that fails alignment confidence → fail the build for that line with a clear, actionable error. No silent partial output ([[sigma-engineering-standards]] §3 Rule 8).

---

## 7. Nanisca Games Requirements (Component B)

A Godot **`SampleSplicer`** type, reusable across all Nanisca games, that reconstructs a full-sentence `AudioStream` at runtime. Godot work follows [[appendix-godot]] in full (fully typed GDScript, RefCounted lifecycle, soft-fail on missing assets, target = low-end tablet).

### 7.1 Functional

- **NG-1 — Reconstruct at runtime.** Given a template, an insert, and an insert sample location, return a new `AudioStream` of the complete sentence, ready to hand to an `AudioStreamPlayer`.
- **NG-2 — Contract-driven.** Game code selects a variant by `wordKey`; `SampleSplicer` consumes the values from the splice contract. The result for insert `w` is, in PCM frames:
  `result = template[0 : L] ⊕ insert ⊕ template[L : end]`, where `L = insertSampleLocation` and `⊕` is a click-free join (§9.3).
- **NG-3 — PCM operation.** Splicing happens on decoded PCM frames at a single uniform format (§9.1). The class MUST reject mismatched inputs (different sample rate/channel count) rather than produce a corrupt or pitch-shifted stream.
- **NG-4 — Decode once, splice many.** `.ogg` assets are decoded to PCM **once** per line at level/activity load and cached; per-utterance splicing reuses the cached PCM. Decoding on every play is prohibited on tablet hardware (perf, [[appendix-godot]] §9).
- **NG-5 — Offline & self-contained.** No network dependency on any path. All inputs are on-device assets ([[appendix-godot]] §12).
- **NG-6 — Soft-fail.** A missing/corrupt asset or an out-of-range insert point logs via `push_error` and returns either a usable fallback (e.g. the template alone, or silence of correct format) — **never a crash** in front of a child ([[appendix-godot]] §8).

### 7.2 Proposed Godot API (illustrative — finalise in code review)

```gdscript
class_name SampleSplicer extends RefCounted

## Splice `insert` into `template` at `insert_sample_location` (frame index in the
## template's PCM), returning a new, play-ready stream. Inputs must share sample rate
## and channel count; returns a zero-length stream and push_error on mismatch.
static func splice(
        template: AudioStreamWAV,
        insert: AudioStreamWAV,
        insert_sample_location: int,
        opts: SpliceOptions = null
) -> AudioStreamWAV
```

```gdscript
class_name SpliceOptions extends RefCounted

@export_range(0, 2048, 1) var crossfade_samples: int = 128
@export var snap_to_zero_crossing: bool = true
@export var trim_insert_silence: bool = true   # honour lead/trail silence from contract
```

- **NG-7 — Return type.** Returns an `AudioStreamWAV` (or equivalent sample-backed stream) constructed from spliced PCM, suitable for direct assignment to `AudioStreamPlayer.stream`. (Whether to back this with `AudioStreamWAV` vs. an `AudioStreamGenerator` feed is an implementation choice — §13 Q3.)
- **NG-8 — Bounded & pure.** `splice` allocates one output buffer of known size (`template.len + insert.len − overlap`), does no unbounded work, mutates no shared state, and frees nothing it did not allocate ([[sigma-engineering-standards]] §3 Rules 2, 3, 6).
- **NG-9 — Validated at the boundary.** Every input checked: non-null streams, matching format, `0 ≤ insert_sample_location ≤ template length`, `crossfade_samples` not exceeding either segment ([[sigma-engineering-standards]] §3 Rule 5).
- **NG-10 — Reusable as a refcounted utility.** Pure logic, no scene-tree dependency, GUT-testable in isolation; stateless static methods preferred so it can be called from any activity.

### 7.3 Ogg → PCM responsibility

The contract stores `.ogg` (compact for on-device storage). `SampleSplicer` operates on PCM. A companion loader is therefore required to decode `AudioStreamOggVorbis` → `AudioStreamWAV`/PCM frames once at load, applying codec-delay compensation so frame indices match the contract (§9.4). This loader is part of Component B's deliverable. *(If sample-accurate ogg decode proves impractical on-device, see §13 Q4 — store splice-critical assets losslessly.)*

---

## 8. Worked Example (informative)

Line `Tap the shelf with [seven] items`, inserts `one … twenty`, `en-ZA`:

1. **CC** synthesizes "Tap the shelf with seven items", aligns, finds `seven` at frames `[72345, 82145)`.
2. **CC** writes `…template.ogg` = "Tap the shelf with … items" with `insertSampleLocation = 72345`, and `…insert_seven.ogg` = the cut "seven".
3. **CC** synthesizes "Tap the shelf with three items", extracts "three" → `…insert_three.ogg`; repeats for every word.
4. **CC** self-splices each, runs §10 checks, writes `…splice.json`, publishes to `nanisca-content`.
5. **Game** at activity load decodes the template + needed inserts to PCM (cached).
6. On a round needing "three", game calls `SampleSplicer.splice(template_pcm, insert_three_pcm, 72345)` → full "Tap the shelf with three items" → `AudioStreamPlayer`.

---

## 9. Audio-Technical Requirements (Normative)

- **9.1 Uniform PCM.** All splicing is on PCM at one sample rate and channel count for a given line (§5.3 I1). 48 kHz mono is the recommended default for speech; the contract is authoritative.
- **9.2 Frame-accurate indexing.** All positions are frame indices (§3). Mixing seconds/bytes/frames is a defect.
- **9.3 Click-free joins.** Each splice boundary (template→insert and insert→template) MUST avoid discontinuities:
  - snap the cut to the nearest **zero crossing** where possible, and/or
  - apply an equal-power **crossfade** of `crossfadeSamples` (default 128 @ 48 kHz ≈ 2.7 ms) across the boundary.
  - The same parameters are used by CC self-verification (CC-9) and the runtime, so build-time and on-device results match.
- **9.4 Codec priming/delay.** Ogg Vorbis carries encoder delay and may not be sample-exact across decode. Frame indices in the contract are defined against **delay-compensated decoded PCM**. Both the CC extraction step and the runtime decoder MUST apply the same compensation so a contract frame index means the same sample on both sides. *(Validate empirically; this is the single most likely source of "off by a few ms" splice errors.)*
- **9.5 Loudness & timbre continuity.** Inserts are loudness-matched to the template bed (CC-7); no audible level jump at the seam.
- **9.6 Silence guards.** `leadSilenceSamples`/`trailSilenceSamples` let the runtime optionally trim dead air at insert edges for tighter timing; honoured when `trim_insert_silence` is set.

---

## 10. Quality & Acceptance Criteria

### 10.1 Automated (CI / pipeline self-verify — CC-9)
- **AC-1** — For every (template, insert) pair, the spliced PCM contains **no inter-sample discontinuity** exceeding a configured amplitude-delta threshold at either seam (click detector).
- **AC-2** — Spliced duration equals `template.durationSamples + insert.durationSamples − overlap`, within tolerance.
- **AC-3** — Output format equals the contract `audioFormat` exactly.
- **AC-4** — Loudness of each spliced result is within ±1 LU of the natively-generated full sentence for the seed word.
- **AC-5** — Contract validates against the schema; all invariants §5.3 hold; all referenced files exist.

### 10.2 Perceptual (sign-off gate for a locale)
- **AC-6** — Blind A/B: for a sample of variants, listeners cannot reliably distinguish spliced vs. natively-generated full sentences (target: ≤ chance + small margin) for `en-ZA`.

### 10.3 Runtime (Godot, GUT + on-device)
- **AC-7** — `SampleSplicer.splice` unit tests: correct length, format preserved, boundary samples within crossfade expectation, idempotent/pure.
- **AC-8** — Boundary tests: `insert_sample_location` of `0`, `len`, and out-of-range; null/empty streams; mismatched sample rate; mismatched channels — each soft-fails per NG-6.
- **AC-9** — Decode-once caching verified: N plays of M variants decode each asset at most once.
- **AC-10** — Profiled on **target-tier tablet** ([[appendix-godot]] §9): per-splice time and memory within the activity's frame/heap budget; no per-frame allocation; no audible latency between selection and playback start.

---

## 11. Edge Cases & Error Handling

| Case | Required behaviour |
|:---|:---|
| Unrecognised `schemaVersion` | Soft-fail, log, skip line (I5). |
| Missing template or insert file | `push_error`, fall back to template-only or silence; never crash (NG-6). |
| `insertSampleLocation` out of range | Reject in `splice`, log, return safe fallback. |
| Format mismatch between template and insert | Reject; do **not** resample/pitch-shift silently (NG-3). |
| Alignment confidence too low (CC) | Fail that line's build with actionable error (CC-11). |
| Zero or multiple bracketed words (CC) | Reject input (CC-11). |
| Insert longer than expected / clips template | Allowed (insert is additive); validate only the join, not relative length. |
| Empty insert (silence-only) | Permitted; yields template with a pause — log a warning. |

No silent failures on either side ([[sigma-engineering-standards]] §3 Rule 8).

---

## 12. Non-Functional Requirements

- **NFR-1 Offline-first.** Zero network dependency at runtime ([[appendix-godot]] §12).
- **NFR-2 Footprint.** Total on-device audio for a templated line (template + N inserts) MUST be materially smaller than N full-sentence variants — the core justification (G4). Report the ratio per line in the build.
- **NFR-3 Runtime cost.** Splice is O(template + insert) in frames, one allocation, no per-frame work; fits the tablet frame budget (AC-10).
- **NFR-4 Typed & linted.** GDScript fully typed, `gdformat`/`gdlint` clean, strict warnings as errors ([[appendix-godot]] §1–2).
- **NFR-5 Testable.** Both components ship automated tests (GUT for runtime, pipeline checks for CC) at Tier 1+ ([[sigma-engineering-standards]] §8 rule 7).
- **NFR-6 Observable.** Pipeline logs per-line provenance and verification results; runtime logs splice failures with context (no PII/secrets).
- **NFR-7 Localisation-ready.** Contract carries `locale`; nothing in the design assumes English ordering. Each locale is a separate perceptual sign-off (AC-6).

---

## 13. Open Questions / Decisions Needed

Resolve before or during implementation; record the decision back into this spec.

- **Q1 — Multiple insert slots?** v1 assumes one variable word per sentence. If any line needs two (e.g. "Choose **[seven]** **[red]** items"), the contract needs an ordered list of insert points. *Recommendation: keep v1 single-slot; design the schema's `inserts`/`insertSampleLocation` so multi-slot is an additive v2 change.*
- **Q2 — Word-boundary detection method.** Forced alignment (preferred) vs. transient counting. *Recommendation: forced alignment with TTS-native timestamps when available; transient detection only as validated fallback (CC-3).* Confirm what the chosen TTS model exposes.
- **Q3 — Runtime stream backing.** `AudioStreamWAV` (simplest, fully buffered) vs. `AudioStreamGenerator` (streamed). *Recommendation: `AudioStreamWAV` for these short utterances — simpler, bounded, no buffer-underrun risk.*
- **Q4 — On-device sample-accurate ogg decode.** Confirm Godot can decode `.ogg` → PCM with reliable delay compensation on target tablets (§9.4). If not, decide whether splice-critical assets ship in a lossless/sample-exact format at a size cost, or whether a small decode tolerance + crossfade absorbs the error. *Recommendation: prototype the decode path first; it gates the whole runtime design.*
- **Q5 — Crossfade defaults.** Confirm `crossfadeSamples` default and whether it lives only in the contract or also as a runtime override. *Recommendation: contract is authoritative; `SpliceOptions` overrides for tuning only.*
- **Q6 — Asset directory & manifest integration.** How `*.splice.json` relates to the existing activity manifests (cf. `manifest-to-markdown` tooling in [[n_select_shelf]]'s folder) — sidecar vs. embedded. *Recommendation: sidecar JSON now; reference it from the activity manifest.*

---

## 14. Out of Scope / Future

- Multi-slot templates (Q1) — candidate for v2.
- Runtime DSP correction (pitch/time) of mismatched takes — explicitly rejected (NG-3); fix at generation time.
- Authoring/editor UX for marking templated lines.
- Non-speech splicing (music/SFX beds).
- Cross-locale automatic re-alignment.

---

## 15. Deliverables Summary

| Team | Deliverable |
|:---|:---|
| **ContentCollider** | TTS generation + alignment + cut/extract pipeline (CC-1…CC-11); splice-contract emitter; pipeline self-verification (AC-1…AC-5); provenance. |
| **Nanisca Games** | `SampleSplicer` RefCounted type + `SpliceOptions` (NG-1…NG-10); ogg→PCM cached loader (§7.3); GUT tests (AC-7…AC-9); on-device profiling (AC-10). |
| **Shared** | The splice contract schema (§5) under change control; perceptual sign-off per locale (AC-6). |

---

*Spec authored from [[AudioSampleSplicer]]. Conforms to [[sigma-engineering-standards]] v1.2 and [[appendix-godot]] v1.0. Status DRAFT until §13 is resolved with both teams.*
