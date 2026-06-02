I now have the complete picture. Let me confirm the diagnosis before touching anything, then apply the fix.

## Diagnosis

The "too loud" trigger has nothing to do with mic gain — it's a **miscalibrated reference amplitude** in the loudness math. And the loud ambient noise on playback is a *separate* issue (playback boost), not record gain.

**The core bug — [`audio_recorder.gd:33`](common/helpers/recorder/audio_recorder.gd:33):**

```gdscript
@export var loudness_reference_amplitude : float = 0.02
```

This is the raw **linear** amplitude that maps to a loudness score of `1.0`. The whole 0.0–1.0 scale is computed as `clamp(amplitude / 0.02, 0, 1)` ([line 146](common/helpers/recorder/audio_recorder.gd:146)).

The problem: `0.02` linear ≈ **−34 dBFS**. So the entire loudness scale is squeezed into the range below −34 dBFS, and:

- `high_volume_threshold = 0.9` → too-loud fires at raw amplitude `0.9 × 0.02 = 0.018` ≈ **−35 dBFS**.
- Normal speech into a tablet mic peaks/RMSes well above −35 dBFS, so it instantly saturates the scale to ~1.0 and trips "too loud."
- To stay under, you must whisper (keep the signal below ≈ −35 dBFS). **Exactly your symptom.**

The final HIGH/OK/LOW verdict that drives the reaction is the RMS path in [`_analyze_recording_loudness()`](common/helpers/recorder/audio_recorder.gd:106) — and it divides the recording's RMS by that same tiny `0.02`, so normal-speech RMS clamps to 1.0 → `HIGH`.

**The "loud ambient noise on playback" is a different thing — not mic gain:**

- The Record bus is at **unity** (`volume_db = 0.0`, no amplify effect) — [`default_bus_layout.tres:36-47`](default_bus_layout.tres:36). The input is *not* gain-boosted.
- The recording is actually quiet. Playback compensates with [`recording_ui.gd:197`](common/scenes/recording_ui/recording_ui.gd:197): `audio_stream.volume_linear = 8` (**+18 dB**). That 8× boost amplifies everything — including the noise floor of a quiet recording — which is why ambient noise sounds huge on playback. So the recording is quiet at the mic but *both* (a) flagged as too loud and (b) played back +18 dB hotter than captured. The two systems are calibrated against each other inconsistently.

## Fix

The single correct knob is `loudness_reference_amplitude`: it must represent the amplitude that genuinely means "too loud," i.e. much closer to full scale. Raising it un-saturates the scale so normal speech lands mid-range and only real shouting reaches `0.9`. The normalized thresholds (`0.05`, `0.9`, `0.03`) all stay meaningful since they're fractions of this reference.