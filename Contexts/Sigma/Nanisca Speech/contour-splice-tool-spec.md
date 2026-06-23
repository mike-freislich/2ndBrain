# Contour-Templating Splice Tool — Technical Specification

**Working name:** `prosody-splice`
**Purpose:** Author prosodic *templates* from a reference sentence + its rendered audio, so that arbitrary insert words can be spliced into the carrier at runtime and warped (via TD-PSOLA) onto the reference's pitch-and-timing contour, producing natural connected-speech prosody on a low-resource device.

---

## 1. Scope

There are two halves to this system, and they must share one code path:

- **Build-time (authoring):** ingest a reference sentence + audio, detect slots, extract per-slot contours, slice out the insert word(s), build the carrier, and write a template (`.json` sidecar + `.opus` carrier segments).
- **Runtime (engine):** given a template + an insert-word audio clip, warp the insert onto the stored contour and splice it into the carrier. This is the lightweight code that ships to the tablet.

The **preview** feature (requirement 5) is just the runtime engine driven over a preset list of insert words, run on the authoring machine, with optional F0 visualisation. Building it this way means preview is a faithful test of on-device output, not a separate approximation.

Everything heavy — alignment, pitch tracking, contour extraction, Opus encode — happens **build-time only**. The runtime path does PCM decode, TD-PSOLA, gain match, and overlap-add. Nothing else.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Reference sentence** | A fully-rendered exemplar, e.g. `Place the {object} on the {container}.` realised as `Place the banana on the shelf.` |
| **Slot** | A position in the template to be filled at runtime (`{object}`, `{container}`). |
| **Insert word** | The word/phrase rendered in citation form that fills a slot at runtime (`monkey`, `bottle of oil`). |
| **Carrier** | The reference audio with the insert word(s) removed, stored as one or more fixed segments. |
| **Contour** | The stored prosodic target for a slot: normalised F0 shape, boundary F0 anchors, reference duration, syllable count, voicing mask. |
| **Pitch mark / GCI** | Glottal closure instant; the anchor point for pitch-synchronous OLA. |
| **TD-PSOLA** | Time-Domain Pitch-Synchronous Overlap-Add: shifts F0 and duration by respacing/duplicating Hann-windowed pitch-synchronous grains. Formants are preserved because each grain keeps its own short-term spectral envelope. |

---

## 3. System overview

```
BUILD-TIME (authoring machine, heavy)
  reference.wav + transcript + slot map
        │
        ▼
  [A] Align & detect slots ───► word boundaries
        │
        ▼
  [B] Pitch analysis ─────────► F0(t), pitch marks, voicing
        │
        ▼
  [C] Extract & normalise contour per slot
        │
        ▼
  [D] Slice insert(s) out, build carrier segments
        │
        ▼
  template.json  +  seg*.opus   ◄── deliverable

RUNTIME (tablet, light) — also drives PREVIEW
  template + insert_word.opus/.wav
        │
        ▼
  [E] Warp insert onto contour (TD-PSOLA)
        │
        ▼
  [F] Gain-match + splice with crossfades
        │
        ▼
  output PCM ───► play (preview) or cache as .opus
```

---

## 4. Inputs (build-time)

Required:

1. **`reference_audio`** — WAV, mono, the rendered reference sentence. Internal sample rate fixed at **48 kHz** (Opus-native; avoids resample artifacts). If input differs, resample once on ingest.
2. **`template_text`** — the templated string with named slots, e.g. `Place the {object} on the {container}.`
3. **`reference_fillers`** — the concrete word(s) used in `reference_audio` per slot, e.g. `{object: "banana", container: "shelf"}`.

One of:

4a. **`alignment`** — word-level timestamps (from forced alignment), OR
4b. nothing, in which case the tool runs forced alignment itself (see Stage A).

Optional:

5. **`syllable_counts`** — per filler; if absent, estimate from a pronunciation lexicon or grapheme heuristic per language.
6. **`language`** — `en` / `fr` / `sw` / `ny`; selects the aligner acoustic model and syllable heuristic.
7. **`boundary_hint`** per slot — `medial` | `final`; advisory metadata, not used by the DSP (the contour itself encodes position).

> **Authoring rule (document this for content authors):** record the reference with the slot in the *same prosodic position* it will occupy at runtime. A slot that is sentence-medial in use must be medial in the reference, or it inherits the wrong boundary tone. For tone languages (Chichewa), a native speaker must confirm the carrier is invariant across the insert set before a template is accepted.

---

## 5. Stage A — Alignment & slot detection

- If `alignment` not supplied, run forced alignment of `reference_audio` against the realised transcript. Candidate engines: Montreal Forced Aligner (best per-language control), WhisperX, or aeneas. This is build-time, so cost is irrelevant.
- Map each slot's filler word(s) to a `[start, end]` interval in the reference.
- **Refine boundaries** in two passes:
  1. Snap each boundary to the nearest pitch mark (from Stage B) so cuts land between glottal periods.
  2. Snap to the nearest zero crossing within ±2 ms for click-free cuts.
- Expose boundaries in an inspector (waveform + word tier) for **manual nudging**; alignment on short TTS clips is usually good but boundary errors poison everything downstream, so a human confirm step is part of the authoring loop.

Output: refined `[start_sample, end_sample]` per slot.

---

## 6. Stage B — Pitch analysis

Run once over the whole reference.

- **F0 estimation:** WORLD (Harvest + StoneMask via `pyworld`) or pYIN (`librosa`). Frame step 5 ms. Produces `f0[t]` (Hz) and per-frame voicing.
- **Pitch marks (GCIs):** REAPER (`pyreaper`) preferred; fallback = peak-pick on the low-pass-filtered LP residual using `f0[t]` to bound period search.
- **F0 post-processing:** median filter (window 5 frames) + octave-jump correction (reject frame-to-frame jumps > 6 semitones, re-interpolate) to kill pitch doubling/halving. Linearly interpolate F0 across short unvoiced gaps (< 60 ms) for contour continuity; keep a separate `voiced_mask` so synthesis knows where pitch is real.

Output: `f0[t]`, `voiced_mask[t]`, `pitch_marks[]` (sample indices) for the whole reference.

---

## 7. Stage C — Contour extraction & normalisation

For each slot, using its refined interval and the Stage B data:

1. **Boundary anchors (critical for seamless splicing):**
   - `f0_left_hz` = F0 of the carrier sample *immediately before* the slot start (last voiced frame of the preceding fixed segment).
   - `f0_right_hz` = F0 of the carrier sample *immediately after* the slot end (first voiced frame of the following fixed segment).
   - These are the pitch values the warped insert must hit at its first and last pitch mark, so there is no pitch step across either seam. If a neighbour is unvoiced at the boundary, fall back to the slot word's own edge F0.

2. **Normalised shape:** resample the slot's F0 onto a fixed grid of `N = 32` points over normalised time `[0,1]`. Store as **semitones relative to `f0_left_hz`** (voice-pitch-agnostic; lets you offset for a different voice later) plus the absolute anchors above. Carry the `voiced_mask` resampled to the same 32 points.

3. **Duration model:**
   - `ref_dur_ms` = slot interval length.
   - `ref_syllables` = syllable count of the reference filler.
   - Stored so runtime can target the slot's *speaking rate* (ms per syllable), not a fixed length.

4. **Energy (optional but recommended):** store a coarse (8-point) RMS contour over the slot, normalised, for amplitude shaping + gain matching.

Output: a `Contour` object per slot (schema in §9).

---

## 8. Stage D — Carrier construction & slicing

- Remove each slot interval from the reference. What remains is an ordered list of **fixed segments** interleaved with **slot placeholders**:
  `[fixed seg0][slot object][fixed seg1][slot container][fixed seg2]`
- Each fixed segment is encoded to **Opus** (mono, 48 kHz, VBR ~24–32 kbps for speech). Store decoder pre-skip handling metadata (Opus injects ~3840 priming samples at 48 kHz; runtime must trim these on decode before assembly or seams gain a gap).
- Optionally retain the extracted reference insert word(s) as `.opus` for A/B comparison in preview. Not shipped to device.

Output: `seg0.opus … segK.opus` + the segment/slot ordering written into the template.

---

## 9. Template data model

A template is a directory: `template.json` + `seg*.opus`.

```jsonc
{
  "template_id": "place_object_on_container_en_001",
  "schema_version": 1,
  "text": "Place the {object} on the {container}.",
  "language": "en",
  "voice_id": "gemini-tts-voiceX",      // timbre must match insert words
  "sample_rate": 48000,
  "splice": {
    "crossfade_ms": 15,                  // equal-power
    "loudness_match": "rms_voiced",      // or "lufs"
    "target_lufs": -16.0
  },
  "sequence": [
    { "type": "fixed", "file": "seg0.opus", "dur_ms": 612 },
    {
      "type": "slot",
      "name": "object",
      "ref_filler": "banana",
      "ref_dur_ms": 384,
      "ref_syllables": 3,
      "boundary": "medial",
      "contour": {
        "n": 32,
        "shape_semitones": [ 0.0, 0.3, 0.5, /* …32 vals rel to f0_left */ -2.1 ],
        "voiced_mask": [ 1,1,1, /* … */ 1 ],
        "f0_left_hz": 178.0,             // anchor: carrier F0 just before slot
        "f0_right_hz": 171.0,            // anchor: carrier F0 just after slot
        "energy_rms": [ 0.4,0.7,0.9,0.8,0.7,0.6,0.5,0.3 ]
      },
      "defaults": { "contour_strength": 0.75, "duration_policy": "syllable_rate" }
    },
    { "type": "fixed", "file": "seg1.opus", "dur_ms": 268 },
    {
      "type": "slot",
      "name": "container",
      "ref_filler": "shelf",
      "ref_dur_ms": 421,
      "ref_syllables": 1,
      "boundary": "final",
      "contour": { /* … as above, final-position contour … */ }
    },
    { "type": "fixed", "file": "seg2.opus", "dur_ms": 190 }
  ]
}
```

Notes:
- `voice_id` is advisory but important: TD-PSOLA does **not** repair timbre mismatch. Insert words must come from the same TTS voice as the carrier.
- Storing shape in semitones-relative + explicit Hz anchors keeps the boundary-continuity math exact while remaining portable.

---

## 10. Stage E — Runtime warp (TD-PSOLA)

Input: a `Contour` + an insert-word PCM clip `w` (decoded from its own `.opus`/`.wav`).

1. **Analyse `w`:** F0, pitch marks, voicing (same methods as Stage B; on-device these run once per insert, cached after first use). Estimate `w_syllables` (from lexicon at build time, shipped alongside the insert clip; do **not** estimate on device).

2. **Target duration:**
   - `syllable_rate` policy: `T_target = (ref_dur_ms / ref_syllables) * w_syllables`.
   - `fixed` policy: `T_target = ref_dur_ms`.
   - Clamp the resulting time-scale factor `α = T_target / natural_dur(w)` to `[0.6, 1.7]` to prevent gross stretching artifacts; if clamped, log it.

3. **Target F0 trajectory:**
   - For each synthesis pitch mark at normalised position `p ∈ [0,1]`, read `shape_semitones(p)` (interpolated) and convert to Hz against `f0_left_hz`.
   - **Anchor enforcement:** force first synthesis mark to `f0_left_hz` and last to `f0_right_hz` (smooth the first/last ~15% of the trajectory toward the anchors). This is what makes both seams pitch-continuous.
   - **Blend by `contour_strength` `s ∈ [0,1]`:**
     `f0_final(p) = s · f0_target(p) + (1−s) · f0_tilt(p)`,
     where `f0_tilt` is the insert's own F0 retargeted only by a linear fit between the two anchors (preserves the word's micro-prosody, applies just the slot's declination/boundary). `s=1` fully imposes the reference shape; `s≈0.7` is a good default for single-syllable inserts into multi-syllable reference slots.

4. **PSOLA resynthesis:**
   - **Time-scale** to `T_target`: lay down synthesis marks across `[0, T_target]`; map each to the nearest analysis mark by the time ratio, duplicating/skipping analysis grains as needed.
   - **Pitch-scale:** at each synthesis mark set local spacing `= 1 / f0_final`; overlap-add the analysis grain (Hann window, width = 2× local analysis period) centred at the synthesis mark.
   - **Unvoiced regions:** time-scale by grain repetition only; never pitch-shift (avoid the classic "buzzy fricative").

5. **Energy shaping (optional):** multiply by the ratio of stored `energy_rms` to the insert's own envelope, lightly, so stressed/unstressed shape matches the slot.

Output: warped insert PCM, duration `T_target`, F0 hitting both anchors.

---

## 11. Stage F — Splice / assembly

1. Decode each fixed `seg*.opus` to PCM (trim Opus pre-skip).
2. **Gain-match** each warped insert to the carrier: scale to equal RMS over voiced frames (or to `target_lufs` if `loudness_match: lufs`).
3. Concatenate in `sequence` order. At every fixed↔slot boundary:
   - cut both sides at the nearest zero crossing,
   - apply an **equal-power crossfade** of `crossfade_ms` (default 15 ms).
4. Final pass: single loudness normalise of the assembled utterance to `target_lufs` (EBU R128).
5. Output PCM. Preview plays it; production caches it as `.opus`.

> Assemble in **PCM**, never by concatenating Opus streams (priming-sample gaps + lossy-boundary artifacts). Encode only the final cached result.

---

## 12. Preview tool (requirement 5)

A thin driver over Stages E–F:

- **Input:** a template + a preset insert list per slot, e.g. `object: [banana, monkey, bottle of oil, number]`, `container: [shelf, branch]`. Insert clips are rendered citation-form audio (same voice).
- **Output for each combination:**
  - playable audio (warped+spliced),
  - optional **A/B**: same splice with `contour_strength = 0` (raw citation insert, no warp) vs the warped version, so authors hear what the contour is buying,
  - optional **F0 overlay plot**: reference contour, raw insert F0, warped insert F0, with the two anchors marked — this is the fastest way to diagnose a bad slot.
- **Controls exposed live:** `contour_strength`, `duration_policy`, `crossfade_ms`. Re-warp is fast enough to be interactive.
- **Form factor:** a Gradio or Streamlit page is sufficient; a CLI batch mode (`preview --template … --inserts inserts.json --out previews/`) is required for regression runs.

---

## 13. CLI / API surface

```
prosody-splice build \
    --audio reference.wav --text "Place the {object} on the {container}." \
    --fillers object=banana container=shelf \
    --language en [--alignment align.json] \
    --out templates/place_object_on_container_en_001/

prosody-splice inspect templates/<id>/        # waveform + boundaries + contours, manual nudge

prosody-splice preview templates/<id>/ \
    --inserts inserts.json [--contour-strength 0.75] [--ab] [--plot] \
    --out previews/

prosody-splice render templates/<id>/ \         # runtime engine, batch
    --fill object=monkey container=branch --out out.opus
```

Library API mirrors these: `build_template()`, `load_template()`, `warp_insert()`, `splice()`, `render()`. `warp_insert` + `splice` + `render` are the only functions ported to the device runtime.

---

## 14. Parameters & tunables (defaults)

| Param | Default | Notes |
|---|---|---|
| `sample_rate` | 48000 | Opus-native; fixed internally. |
| `f0_frame_ms` | 5 | analysis step |
| `contour_points N` | 32 | normalised shape resolution |
| `contour_strength` | 0.75 | per-slot overridable |
| `duration_policy` | `syllable_rate` | or `fixed` |
| `time_scale_clamp` | [0.6, 1.7] | guards against gross stretch |
| `octave_jump_reject` | 6 st | F0 cleanup |
| `crossfade_ms` | 15 | equal-power |
| `loudness_match` | `rms_voiced` | or `lufs` |
| `target_lufs` | −16.0 | final normalise |
| `opus_bitrate` | 24–32 kbps | mono speech |

---

## 15. Dependencies / stack

The DSP is one **C++ core** (`libprosody`, §16) compiled to two targets — WASM for the collider, ARM64 GDExtension for the tablet — so preview and on-device runtime execute identical code. Dependencies are chosen to be C++-native and WASM-compilable, with the single exception of forced alignment, which is authoring-only and stays out of the core.

- **Core language:** C++17, no platform dependencies in the core, buffer-in/buffer-out API (§16.2).
- **F0 / vocoder:** WORLD (C++) — the same core `pyworld` wraps. *Optional upgrade:* WORLD analysis-synthesis as a higher-quality alternative resynthesiser to PSOLA if seams remain audible — same contour data, swappable backend.
- **Pitch marks:** REAPER (C++) — the same core `pyreaper` wraps.
- **Opus:** libopus + libogg (C++); mind pre-skip trimming. Compiles to WASM and ARM.
- **Loudness:** libebur128 (C) for EBU R128.
- **WASM build:** Emscripten; exposed to the collider via Embind or a C ABI + JS glue.
- **Godot build:** `godot-cpp` (GDExtension), built per Android ABI (arm64-v8a; armeabi-v7a only if 32-bit devices are still in scope).
- **Alignment (authoring-only, NOT in the core):** Montreal Forced Aligner / WhisperX / aeneas. Python/Kaldi, does not compile to WASM; run server-side or as a local pre-process that feeds word boundaries into the collider. Everything downstream of "here are the word boundaries" lives in `libprosody`.
- **Preview UI:** browser (the collider itself) — WASM core + Canvas/WebAudio for the F0 plots and playback; no separate UI stack.

---

## 16. Implementation architecture

### 16.1 One core, two targets

All DSP lives in a single platform-agnostic C++ library, **`libprosody`**. It is compiled to two artifacts from the same source:

- **`prosody.wasm`** (Emscripten) — loaded by the Content Collider web module. Powers authoring *and* preview.
- **`libprosody.so`** (GDExtension via `godot-cpp`, ARM64) — loaded by stock Godot on the Android tablet. Powers runtime synthesis.

The non-negotiable invariant: **preview in the collider and playback on the tablet call the same compiled core.** The spec makes preview a faithful proxy for on-device output (§12); that only holds if there is exactly one implementation of warp+splice. Two implementations (e.g. a C++ preview and a GDScript runtime) silently diverge, and authors would approve contours that sound different in the game. So GDScript never touches a sample.

```
                       libprosody (C++17, no platform deps)
                       ├─ analysis   (WORLD, REAPER)      ── build-time only
                       ├─ contour     extract / normalise ── build-time only
                       ├─ warp        TD-PSOLA            ── runtime + preview
                       ├─ splice      xfade / gain / asm  ── runtime + preview
                       └─ codec       libopus dec/enc
                              │                    │
                ┌─────────────┘                    └─────────────┐
                ▼                                                 ▼
        prosody.wasm  (Emscripten)                     libprosody.so (godot-cpp, arm64-v8a)
        Content Collider — authoring + preview         Godot runtime — render on demand
```

### 16.2 Core API surface

C ABI (stable, trivial to bind from both Embind and `godot-cpp`). Buffers are interleaved-free mono `float32` at 48 kHz. Handles are opaque pointers; no STL crosses the boundary.

**Build-time (links into WASM target only — the `.so` never calls these):**

```c
// Analyse a reference; returns word boundaries already supplied by the
// external aligner, plus F0/pitch-marks computed here.
PReference* pr_reference_analyze(const float* pcm, int n, int sr,
                                 const PWordSpan* words, int n_words);

// Extract + normalise the contour for one slot, given its [start,end].
PContour*   pr_contour_extract(const PReference* ref, int slot_start, int slot_end);

// Build the carrier: returns fixed-segment PCM spans with slots removed.
PCarrier*   pr_carrier_build(const PReference* ref, const PSlotSpan* slots, int n_slots);

// Serialise template.json + encode fixed segments to Opus.
int         pr_template_write(const PCarrier*, const PContour**, /*…*/ const char* dir);
```

**Runtime (links into BOTH targets — this is the shipped hot path):**

```c
PTemplate*  pr_template_load(const char* json, const PSegment* opus_segs, int n);

// THE call. One per utterance. insert = decoded PCM of the chosen insert word,
// with its precomputed F0 + pitch marks attached (shipped, not analysed here).
// Returns assembled PCM (caller frees). contour_strength/policy override defaults.
int         pr_render(const PTemplate* tpl,
                      const PInsert*   inserts, int n_inserts,
                      float            contour_strength,   // -1 = use template default
                      int              duration_policy,    // -1 = use template default
                      float**          out_pcm, int* out_n);

void        pr_free(void* handle);
```

The boundary is **one call per utterance**, never per sample — so cross-language marshalling cost is negligible and identical on both targets.

### 16.3 Insert words carry their own analysis

The insert bank is known at author time, so each insert clip ships as `{opus_audio, f0[], pitch_marks[], syllable_count}`. The tablet **never runs F0 estimation or pitch marking** — those (the only genuinely heavy ops) are precomputed in the collider and baked into the asset bundle. On-device, `pr_render` does just: Opus-decode → TD-PSOLA grain overlap-add → gain-match → equal-power crossfade assembly. A few hundred grains per utterance; sub-millisecond-class work in native ARM.

### 16.4 Godot integration (GDScript ↔ GDExtension)

GDScript owns **orchestration only**, where it is pleasant and has no hot loop: active template, scene's chosen insert, playback, the rendered-clip cache, lesson flow. The native boundary is coarse and called once per sentence.

```gdscript
# GDScript — orchestration layer
var clip := ProsodySplice.render(template_id, {"object": "monkey", "container": "branch"})
# clip is a PackedFloat32Array returned across the GDExtension boundary
var stream := AudioStreamWAV.new()
stream.format = AudioStreamWAV.FORMAT_16_BITS   # (or write float frames)
stream.mix_rate = 48000
stream.data = _f32_to_pcm16(clip)
$AudioStreamPlayer.stream = stream
$AudioStreamPlayer.play()
```

- `ProsodySplice` is the GDExtension-registered class wrapping `pr_render`; the `PackedFloat32Array` it returns wraps the core's output buffer with no copy beyond the marshalling boundary.
- **Cache:** on first use of a (template, fillers) tuple, encode the rendered PCM to Opus and store it; subsequent plays skip the core entirely. GDScript manages this cache. The PSOLA cost is paid once per distinct sentence, ever.
- **GDExtension, not an engine module:** the `.so` loads into stock Godot via the standard Android export — no custom export templates to build or maintain. Build one `.so` per ABI; arm64-v8a is the only one that matters unless 32-bit devices remain in scope.

### 16.5 Why not GDScript for the DSP

Functionally it could run the one-time warp in tolerable time (especially with caching), but it is the wrong choice on two counts. Per-sample inner loops are GDScript's worst case — interpreted, no JIT, ~an order of magnitude slower than native — turning a sub-millisecond warp into tens-to-hundreds of ms on a weak ARM tablet. More importantly it would be a *second, divergent implementation* of the most delicate code, breaking the build==preview invariant (§16.1) to save effort already spent building the WASM core. GDScript stays in orchestration; C++ owns every sample.

### 16.6 Build matrix

| Artifact | Toolchain | Links | Consumer |
|---|---|---|---|
| `prosody.wasm` + glue | Emscripten | analysis + contour + warp + splice + codec | Content Collider (authoring + preview) |
| `libprosody.so` (arm64-v8a) | NDK + `godot-cpp` | warp + splice + codec (runtime subset) | Godot on tablet |
| `libprosody.so` (armeabi-v7a) | NDK + `godot-cpp` | runtime subset | Godot on 32-bit tablet (optional) |
| `libprosody` (host) | native clang/gcc | full | CI golden-render regression (§17) |

The host build is what runs the §18 regression suite, so the same core that authors and ships is also the one tested.

---

## 17. Failure modes & fallbacks

| Condition | Behaviour |
|---|---|
| F0 detection fails on insert (whispered/unvoiced) | Skip pitch warp; apply duration warp + anchor-tilt only; flag in preview. |
| Insert much longer/shorter than slot | Clamp time-scale, log; suggest authoring a closer-length reference. |
| Boundary neighbour unvoiced | Anchor to insert's own edge F0; widen crossfade slightly. |
| Alignment boundary error | Caught at `inspect` manual-confirm step before template is accepted. |
| Timbre mismatch (different voice) | Out of scope for repair; build rejects insert whose `voice_id` ≠ template unless `--force`. |
| Opus seam gap | Pre-skip trim enforced in decode; unit-tested. |

---

## 18. Validation / acceptance tests

1. **Boundary continuity:** assembled-utterance F0 has no step > 1 semitone across either seam (automated check over the preset matrix).
2. **No clicks:** peak inter-sample discontinuity at seams below threshold; spectral-flux spike check.
3. **Rate consistency:** measured ms/syllable of warped insert within ±15% of slot's reference rate.
4. **A/B MOS:** native-speaker listening test, warped vs raw-citation splice, per language — **Chichewa and French are mandatory** in the panel (tone + liaison/elision are where silent failures hide).
5. **Regression:** golden preview set re-rendered on each build; perceptual + F0-RMSE diff against approved baselines.

---

## 19. Out of scope (and future)

- **Timbre/voice conversion** — assume one TTS voice per language.
- **Grammatical agreement** — the tool moves *audio*; it does not fix French gender/elision or Bantu concord. The insert set per slot must be grammatically valid in the carrier, validated by a native speaker. (This belongs in the content/templating layer, upstream of this tool.)
- **Unbounded numerics** — number composition (0–100 whole, 100–1000 stitched, class-agreeing quantifiers) is a separate generator; it can *consume* this tool's runtime engine for its seams but defines its own banks.
- **Future:** WORLD-backend resynthesis option; cross-voice contour transfer via the semitone-relative shape; learned duration model per language to replace the syllable-rate heuristic.
