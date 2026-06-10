# Background
Almost all games in Nanisca, have the need for high quality speech that provides hints and in-game instructions. Because we are running on offline low-spec'd tablets, we need all audio files to reside on device. Because of this, we need to generate all spoken audio using TTS AI models in the content collider toolset. These files are ultimately stored as .ogg files in our nanisca-content repository.

A common attribute of the spoken text in games, is that there are sentences that are repeated throughout a game, where sections of the sentence are variable e.g.
- "Choose the shelf with [seven] items" should allow substitution of the word "seven", with other words like "six" or "two" at runtime, while still sounding natural.
We want to avoid generating and storing this sentence 20 times, if for example their are 20 variants. Instead we want to generate the template audio, together with the insert point, and the list of insert words. We need to generate those insert words in a way that the phrasing sounds natural when inserting.
# How I want this to work:

## content-collider server
The content collider should:
1. receive the text, e.g. "Tap the shelf with [seven] items".
2. generate the whole sentence using TTS
3. receive the audio file back
4. discover the start and end sampleLocations for the word "seven", probably by identifying transients and counting the number of words (but open to ideas here).
5. cut the word seven out of the audio and create a new insert_seven.ogg file
6. generate the template_audio.ogg file that literally has the "seven" deleted from it e.g. "Tap the shelf with items".
7. store the sampleLocation of the insert point together with the assets.
8. Then, with a provided text list of insert words e..g "one, two, three ..... twenty":
	1. generate the whole sentence audio again with each insert word e.g. "Tap the shelf with three items", "Tap the shelf with four items"
	2. for each of these new full sentence audio streams, extract, just the inserted word out into it's own file e.g. insert_one.ogg, insert_two.ogg .... insert_twenty.ogg
	3. These audio words should now sound natural when inserted into the template at the insert sampleLocation during gameplay in Nanisca.

# Nanisca Games (Godot)

Each nanisca game should have access to a common godot refcounted class (SampleSplicer) that, when given the right data structure, can construct a new audiostream of the complete sentence at runtime.

The data structure to receive:
- AudioTemplate file reference - a reference to the ogg file containing the template audio. Alternatively this could be an audioStream object
- InsertSampleLocation - the number of samples into the stream at which new audio should be inserted
- InsertAudio file reference - a reference to the ogg file containing the template audio. Alternatively this could be an audioStream object.

The SampleSplicer should then return a new AudioStream object that contains the template audio with the InsertAudio inserted at the InsertSampleLocation.

The resulting SplicedAudio AudioStream object can then be passed to an audio player.

