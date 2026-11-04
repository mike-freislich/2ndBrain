

 ok ... and then I want to come back to this:

   I had a thought ... let's say that there are a maximum of 20 levels of difficulty. If we baked a map for each level that could handle a word at the maximum word length of 10 letter/safe tiles ... then in theory the map should work for any word between 3 and 10 letters.... where a running game level only needs say 3 letters, the other letter spots can be replaced with safes that unlock diamonds... that way we can validate 20 playable maps, and not need runtime generation at all.




## 14. Ambient soundtrack

The soundtrack is a procedural, real-time ambient bed. It is atmospheric, not melodic. Each level has its own key, mode and environmental layers. Tension rises across levels, within each level, and as the timer runs low.

### Layers present in every level

- A drone on the level's root note, with beating partials.
- A slow breathing pad that changes chord every 10–18 s.
- Water drips into a stereo echo.
- Low rumble swells.
- Creaks (wood, ice or metal).

### Per-level environment

|#|Theme|Environmental layers|Rare melody timbre|
|---|---|---|---|
|1|sandstone|strong gusting wind, sand trickles|flute|
|2|chalk|thin high wind, hollow resonance, frequent bright drips|glass|
|3|clay|low wind, mud plops, slow stream|marimba|
|4|moss|stream, crickets, bubbles|flute (high)|
|5|granite|deep hollow cavern, settling stones|organ|
|6|ice|ice creaks, frost tinkles, whistling wind|music box|
|7|slate|distant pick strikes, electrical hum|choir|
|8|iron|metal creaks, chains, machine thrum|anvil|
|9|verdigris|flooded tunnel: stream, many bubbles, copper pings|glass (high)|
|10|amethyst|glass hum, shimmer, high whistle|glass|
|11|crimson|furnace roar, steam bursts, embers, rock cracks|strings|
|12|basalt|magma bubbles, roar, heavy cracks, tremor|organ|
|13|obsidian|collapse: tremor, debris, cracks, metal creaks|strings|

### Escalation across levels

With `d = levelIndex / 12`:

- Tempo: `42 + 86d` BPM (42 → 128).
- A heartbeat thump starts at level 5 and grows stronger.
- Clock ticks start at level 10.
- The pad darkens: it uses darker chords from level 7 and adds tension intervals (tritone, minor 2nd) in later levels.
- Melody notes can clash by a semitone from level 9.

### Escalation within a level

- Over the first 200 s, a build value rises from 0 to 1 (smoothstep).
- The build makes events denser and layers louder, and adds heartbeat strength.

### Urgency (timer)

- Urgency = `clamp((30 − timeLeft) / 30, 0, 1)`. It rises over the last 30 s.
- Urgency speeds up the beat by up to 30%. It adds heartbeat and ticks, brightens the pad and wind, and widens the drone beating.

### Melody

- Short fragments of 3–5 notes play every 30–90 s. The first plays 18–45 s into the level.
- Melody is occasional and stays quiet. It never leads the mix.

### Mix behaviour

- A new level crossfades to its soundscape over 1.6 s.
- Level complete ducks the soundtrack to 35% over 1.2 s.
- The lock prompt sets urgency to 0.
- The soundtrack fades out when the app goes to the background and fades back in on return.
- The soundtrack plays 9 dB below the sound effects.


---

- [ ] When the score is adding the bonus at the end of the round, can we make this look prettier? At the moment it's just numbers on a box... 
	- [ ] perhaps it could show more visually what is happening, e.g.
	- [ ] show points for collection of sand, diamonds and other scoreable elements
	- [ ] drain the timer into the total score...  show the water flowing into the timer score.

- [ ] Perhaps the score can be represented instead of a number for the level, it could be a star-number out of 5... showing 5 star place holders and how many stars are actually filled.

- [ ] In game, if the game is reset when the timer runs out, please reset the score. 

--- 

## More layout tweaks
- [/] change the reset button - use a bottom left corner button asset for the reset button
- [/] change the map button - use a bottom right corner button asset for the map button
- [/] letter tray: round the placeholder boxes to match the letter tiles.
  and make them dotted lines.
- [/] Count down timer indicator - remove the timer bar from the title bar. create a fun vertical countdown timer component. Place it on the left of the screen, perhaps it can be something like water running out.

