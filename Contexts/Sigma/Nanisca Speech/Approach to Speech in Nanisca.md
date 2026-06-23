

# Approaches available for Nanisca Spoken Narrative
## Q1
*We need a lot of spoken narrative in the games that we provide, since learners can't be assumed literate. All instruction is needed in English, Chichewa, French and Swahili. Since we can't run online, we can't use text to speech TTS from the cloud. Our approach so far is to produce the audio via prompting Gemini TTS, and converting the wav files to .ogg to satisfy storage constraints.

## A1
Much of the spoken text requires template sentences with "insert" words ... e.g. "Place the {object} on the {container}"...

with insert words such as objects["banana", "number", "bottle of oil", "monkey"] and container["shelf", "branch"]

we are generating the insert words, and the templates, and then splicing the audio at runtime. The problem is, that many of the spliced sentences don't sound natural, due to the intonation of the insert words in context of the sentence.

Is there a way to solve this? And... what are other approaches that we might use, that create natural language on an offline tablet that has very limited CPU, GPU, RAM and Storage?*

There are actually two problems tangled together here, and separating them is the key to fixing it.

**Problem 1 is acoustic** — the intonation mismatch you've noticed. A word generated in isolation gets "citation form": full stress, slow, with a falling pitch contour as if it were the end of a list. Dropped into the middle of a sentence it sounds wrong because connected speech has _declination_ (pitch drifts downward across the whole utterance), the final word carries a boundary tone the medial words don't, and durations get compressed. So your spliced word is carrying the wrong pitch and the wrong length for its slot.

**Problem 2 is morphosyntactic**, and it's the sneakier one because it makes sentences not just unnatural but _wrong_ — and it bites hardest in exactly the languages you've chosen:

- **French**: the article is part of the slot, not the carrier. "la banane" vs "le singe" (gender), and elision/liaison across boundaries ("l'orange", liaison consonants). You cannot hold "Pose la ___" fixed and swap the noun.
- **Chichewa and Swahili** are Bantu noun-class languages: verbs, demonstratives, and adjectives take agreement concords that change with the noun class of the inserted word. A fixed carrier with a swapped noun can be ungrammatical, not just awkward. Chichewa additionally has _lexical and grammatical tone_, so pitch isn't decorative — splicing can change meaning.
- **English** is the easy one (just a/an).

So the design rule that falls out of this: **your splice unit should be the whole constituent — the full noun phrase including its article and any agreement — not the bare noun, and your cut points should land at phrase boundaries** (e.g. before a prepositional phrase), where coarticulation and pitch are most stable. Splitting mid-phrase is what makes seams audible.

**The highest-leverage move: pre-render full sentences at build time wherever the space is bounded.** You're splicing at runtime presumably to save storage, but with Opus the math is probably in your favour and you may be solving a problem you don't have. Use Opus (not Vorbis) in the .ogg container — it's dramatically better for speech at low bitrate. At ~24 kbps mono, a 3-second instruction is about 9 KB; 2,000 fully-rendered sentences is roughly 18 MB. So the first thing to actually compute is your real combinatorial size per language. If 50 templates average ~10 combinations, that's 500 sentences × 4 languages and you should just render every one as a finished file. Runtime then plays a file — zero CPU, zero splicing, perfect prosody, and the French/Bantu grammar problems disappear because each sentence is generated whole.

Splicing only earns its keep where the space genuinely explodes — almost always **numbers** (counting, math problems with unbounded operands). That's the bucket to optimize hard, and it's also where list-vs-sentence intonation differs most.

**If you must concatenate, here's how to make it sound natural:**

1. _Generate the insert tokens inside carrier phrases, not in isolation._ Use Gemini as your prosody source. To get a medial "banana," prompt it to say a full sentence with "banana" mid-sentence and extract that segment; for a sentence-final slot, extract from a sentence where it's final. Store 2–3 prosodic variants per unit (medial, final, focused). This alone fixes most of what you're hearing, because the tokens now carry connected-speech pitch and timing.
    
2. _Use forced alignment at build time_ (Montreal Forced Aligner, or a Whisper-based aligner) to find exact word boundaries for clean extraction — runs on your machine, never the tablet.
    
3. _At the seam:_ cut at zero crossings, apply a short (10–30 ms) crossfade, and loudness-normalize everything to EBU R128 so clips match.
    
4. _Use TD-PSOLA for prosody._ It's a time-domain technique that shifts pitch and duration cheaply — no neural net, runs fine on weak CPUs. The strong version of this is **contour templating**: at build time, render a few complete example sentences per template, extract the target F0-and-duration curve for each slot position (a few bytes to store), and at runtime warp your concatenated units onto that stored curve with PSOLA. You get sentence-level declination and boundary tones from almost no stored data.
    

**Do the heavy work at build time, not runtime.** The only reason to splice on the tablet is if prompts are generated procedurally and unboundedly at runtime. If they're authored, do all the alignment, PSOLA, crossfading and compression offline on a real machine and ship finished files. Even your large numeric set can often be pre-stitched into finished clips offline.

**On-device neural TTS** (Piper/VITS, Kokoro, or robotic-but-tiny eSpeak-NG) is a real option for English, French and probably Swahili, and would eliminate splicing — but **Chichewa is the blocker**: it's very unlikely to have a pretrained voice, and training one needs data and effort. Since you're already pre-rendering with Gemini, you sidestep the whole question — you don't need on-device synthesis at all for bounded content. (Voice coverage for these engines does change; I can check the current Piper/eSpeak language lists if that path interests you.)

One concrete recommendation regardless of approach: get a native speaker of Chichewa and a French speaker to validate that your carriers are actually invariant across each insert set. That's where the silent grammatical bugs live.

If you can tell me roughly how big your combinatorial space is per language, and whether the prompts are authored ahead of time or generated procedurally on the device, I can tell you fairly precisely which of these to build and where the storage lands.

# Combinatorial solutions
## Q2
*we have about 500 lessons, each of which has multiple (between 5 and 15) games, each of which has content banks of insert words e.g. numbers from 0 to 1000 or animals, and can be used across about 15 scenes (environments e.g. inside the school, in the jungle, by the river), which creates a huge amount of variance of sentences and inserts.*

## A2
The scale doesn't change the storage math as much as it looks like it should, because the variance is **multiplicative in sentences but additive in components**. You'll never store the cross-product, and you don't need to. You store a library of reusable parts, and the library is small even when the sentence space is astronomical. The real work is deciding which parts to render whole, which to assemble, and — the part that actually saves you — recognizing that one of your banks behaves completely differently from the rest.

**Almost all your banks are small and bounded.** Animals, objects, containers, scene framings — these are tens to low hundreds of items. Numbers 0–1000 is the _only_ genuinely unbounded bank you've named, and it's also the grammatically nastiest. So the right move is to split your pipeline in two: treat everything-except-numbers one way, and give numbers their own dedicated path. Conflating them is what makes the problem feel unbounded.

**For the bounded banks**, the reachable set is far smaller than the theoretical cross-product. Within a single game-in-a-scene, the lesson fixes the templates and the scene activates one bank, so the sentences a learner can actually hit is templates × active-bank — typically dozens to low hundreds, not millions. That means you have two cheap options that dominate runtime splicing:

- _Pre-render per game-instance._ Where a template's active bank is small (10 templates × 50 animals = 500 sentences), just render all of them whole at build time. Perfect prosody, no seams, grammar handled because each is generated complete. At ~9 KB per 3-second Opus clip, even 50,000 such sentences is under 500 MB across all four languages — and you won't have nearly that many distinct ones once you dedupe shared templates and banks.
- _Assemble-and-cache on first use._ For the long tail, splice on device the first time a sentence is needed, then cache the rendered .ogg. The working set any learner actually traverses is tiny, so the cache fills fast and the CPU cost is paid once.

**To make the assembled ones sound natural at this scale, use contour templating keyed to the template, not the sentence.** There are maybe hundreds to low-thousands of distinct templates across your 5,000 games, not millions. For each template, render one or two complete exemplar sentences at build time, extract the F0-and-duration curve at each slot position (a few hundred bytes), and store that. At runtime, drop in the insert constituent and TD-PSOLA-warp it onto the stored contour. You get sentence-level declination and the right boundary tones from almost no stored data, and it scales because contours are per-template, which is bounded.

**Numbers need their own synthesis, and here's the efficient shape:** pre-render 0–100 whole (101 clips — trivial; this is where all the irregularity and liaison lives, especially in French), and compose 100–1000 as hundreds-word + the 0–99 remainder. There's a single seam, and it lands at the hundreds boundary, which is a natural phrase break anyway — the easiest possible place to cut.

But there's a landmine here you should check before building any of it. **In Chichewa and Swahili, numbers used as quantifiers agree with the noun class of what they're counting.** "Five bananas" and "five monkeys" may use different forms of "five." French has a milder version (liaison: "deux ans"). This breaks the assumption that "numbers 0–1000" is a single reusable bank that drops into any counting template. The fix is to factor by _agreement class, not by noun_: counted nouns in these languages cluster into a handful of classes, so you render number × class (a small multiplier) rather than number × every object. When a number is used as a bare label or answer ("the answer is 342", "find house number 7"), it's free-standing and the composition approach above works untouched. So you actually have two number sub-banks: agreeing quantifiers and free-standing labels.

The thing I'd most strongly recommend before committing the architecture: have a Chichewa speaker and a French speaker go through your template-and-bank pairings and confirm the carrier is genuinely invariant across each insert set. With banks this large, the silent grammatical bugs — wrong concord, wrong gender, missing elision — multiply just as fast as the sentences do, and they won't show up in English testing at all.

If you can tell me how many _distinct templates_ you have (the deduplicated count, not templates × games) and roughly how the banks break down by size, I can give you a concrete storage estimate per language and tell you where the pre-render / assemble line should fall.

# Using TTS on low performance offline device
## Q3
*ok ... and what effective TTS models that can run locally can handle the languages we need?*

## A3
This is exactly the question where my training data could be stale — TTS language coverage changes constantly, and Chichewa is the make-or-break language. Let me check current support.Piper covers English and French well but I don't see Swahili or Chichewa in its voice list. The critical question is Chichewa. Let me check Meta's MMS, which is the broadest multilingual model, and search specifically for these two languages.The short version: **Meta's MMS is the only locally-runnable model that covers all four of your languages, including Chichewa — which is the one that rules almost everything else out.** But it comes with two catches that probably push you back toward your build-time Gemini pipeline rather than on-device synthesis. Here's the landscape.

**MMS (Massively Multilingual Speech), from Meta.** Separate VITS checkpoint per language, and it has all four: English (`mms-tts-eng`), French (`mms-tts-fra`), Swahili (`mms-tts-swh`), and crucially Chichewa (`mms-tts-nya`). The Chichewa checkpoint is real and documented. The project supports 1107 languages on the VITS architecture. Finding any TTS that does Chichewa at all is rare, so this is the headline. Two important catches, though:

- **License is CC-BY-NC-4.0 — non-commercial.** MMS-TTS uses the VITS architecture under a CC-BY-NC-4.0 license. For a deployed educational product this is a genuine blocker you'd need to clear with whoever handles your licensing, and it likely extends to audio you generate from it. I'm not a lawyer and this is the kind of thing worth checking properly before building on it.
- **Quality varies sharply by language, and the low-resource ones are weakest.** The African-language MMS checkpoints were largely trained on read religious recordings (New Testament audio), so Chichewa especially can come out with a narrow, "reading-aloud" prosody and shaky coverage of everyday vocabulary and numbers. Acceptable for some uses, but you'd want a native Chichewa speaker to judge whether it clears your bar for children's instruction before you commit.

A practical note: MMS ships as PyTorch/Transformers checkpoints (~100–200 MB each), which is heavy for a weak tablet. People do export the VITS graph to ONNX to run it leaner, but that's engineering work, and inference on a low-end CPU for every utterance is a real cost you're currently avoiding.

**Piper** is the better-engineered option and the one purpose-built for exactly your hardware constraints — real-time on a Raspberry Pi 5 on CPU alone with a small RAM footprint, voices tens of megabytes each, 30+ languages. But its trained voices cover English and French and **not Swahili or Chichewa**, so it can't be your whole solution. Active development moved to OHF-Voice/piper1-gpl and the license is now GPL-3.0 (the old MIT repo is archived), which is another licensing wrinkle to weigh.

**The others don't help you here.** Coqui/XTTS, StyleTTS 2, F5-TTS, Kokoro — all are English-heavy or cover only major languages, several are non-commercial or GPU-hungry, and none reach Chichewa. Not worth pursuing for your case.

**Where this leaves you, given the earlier conversation.** The honest conclusion is that on-device neural TTS doesn't clearly beat what you're already doing. Your content is mostly bounded and authored ahead of time, you have Gemini producing high-quality audio at build time, and the only model that even covers Chichewa locally (MMS) is non-commercial, heavy, and weakest in exactly that language. So the on-device route would mean shipping a worse Chichewa voice, paying CPU cost per utterance, and taking on a license problem — to solve a problem you've largely already solved by pre-rendering.

The one scenario where local TTS genuinely earns its place is if you have content that's generated procedurally _on the device_ and can't be enumerated at build time. If that's not the case, I'd keep Gemini-at-build-time as the spine and use the contour-templating + PSOLA approach for the unbounded numeric tail, rather than putting a neural model on the tablet.

If MMS's Chichewa quality is something you want to evaluate, the fastest path is to run the four checkpoints over a representative sample of your actual lesson sentences and have native speakers rate them — that tells you in an afternoon whether it's even a candidate. Want me to sketch what that evaluation set should cover so it surfaces the prosody and number-agreement problems rather than hiding them?