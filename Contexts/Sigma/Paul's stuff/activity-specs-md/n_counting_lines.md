# Counting Lines

**Identifier:** `n_counting_lines`  
**Spec version:** 1.1-DRAFT  
**Locale:** `en-ZA`

## Meta

| Field | Value |
|:---|:---|
| subject | Numeracy |
| activityFamily | Interactive - Tap |
| activityType | Tap to select answer with audio clue |
| layoutTemplate | _(null)_ |
| description | Count, compare and choose the correct number of items in a line out of 2–3 options according to audio. |
| subconstructs | Counting |
| skillsMapping | N1.1.1-F |
| senAffordances | _(none)_ |

## Suggested Global Params

_Hints only — the platform may override._

| Param | Value |
|:---|:---|
| `showDemo` | true |
| `showIntro` | true |
| `showOutro` | true |

## Novel Parameters

### `beadsPerLine`

**Type:** `integerRange`  
**Logic:** Lines must never have the same number of items.

| L1 | L2 | L3 | L4 | L5 |
|:-:|:-:|:-:|:-:|:-:|
| 1–5 | 1–5 | 2–10 | 2–10 | 2–10 |

### `numberOfLines`

**Type:** `integer`

| L1 | L2 | L3 | L4 | L5 |
|:-:|:-:|:-:|:-:|:-:|
| 2 | 3 | 3 | 3 | 3 |

### `shapeUniformity`

**Type:** `string`  
**Enum:** `single, mixed`  
**Logic:** Per line.

| L1 | L2 | L3 | L4 | L5 |
|:-:|:-:|:-:|:-:|:-:|
| single | single | single | single | mixed |

### `sizeUniformity`

**Type:** `string`  
**Enum:** `single, mixed`  
**Logic:** Per line.

| L1 | L2 | L3 | L4 | L5 |
|:-:|:-:|:-:|:-:|:-:|
| single | single | single | mixed | single |

### `spacingUniformity`

**Type:** `string`  
**Enum:** `consistent, varied`  
**Logic:** Per line.

| L1 | L2 | L3 | L4 | L5 |
|:-:|:-:|:-:|:-:|:-:|
| consistent | consistent | varied | consistent | varied |

### `requiredTouchCount`

**Type:** `boolean`  
**Logic:** When true, learners must touch and count every item on every line before selecting. Touched items reduce lightness by 20% with SFX.

| L1 | L2 | L3 | L4 | L5 |
|:-:|:-:|:-:|:-:|:-:|
| true | true | false | false | false |

### `feedbackTiming`

**Type:** `string`  
**Enum:** `instant, delayed`  
**Logic:** Instant: as soon as item is tapped, if incorrect the line goes 50% transparent with incorrect SFX. Delayed: feedback only after check button.

| L1 | L2 | L3 | L4 | L5 |
|:-:|:-:|:-:|:-:|:-:|
| instant | instant | delayed | delayed | delayed |


## Action Sequence

### Core

| Phase | Step | Required | Actions                                                              | Audio                                                                                                                                                                | SFX           | Flags                                                                                        |
| :---- | :--- | :------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :------------------------------------------------------------------------------------------- |
| intro | 1    | no       | character_enters                                                     | `intro_prompt` — Can you help {object_character} select the {object} with the correct number of {items}?                                                             |               |                                                                                              |
| demo  | 1    | no       | lines_appear_with_items_centered                                     | `demo_tap_count_instruction` — Tap each {item} to count how many {items} are on each {object}.                                                                       | bead_slide    |                                                                                              |
| demo  | 2    | no       | pointer_counts_line_1, pointer_counts_line_2, pointer_counts_line_3  | `demo_count_line_1` — {num_items_line_1} {object} 1.<br>`demo_count_line_2` — {num_items_line_2} {object} 2.<br>`demo_count_line_3` — {num_items_line_3} {object} 3. | bead_click    |                                                                                              |
| demo  | 3    | no       | item_lightness_reduced_per_touch                                     | `demo_click_target_line` — Click on the {object} with {num_items} {items}.                                                                                           | success_chime | if `all_items_touched`                                                                       |
| demo  | 4    | no       | number_appears_right                                                 | `demo_confirm_count` — There are {num_items} {items} on this {object}.                                                                                               | pop_appear    | if `correct_selection`                                                                       |
| main  | 1    | yes      | lines_appear, audio_target_prompt                                    | `main_count_choose` — Count the {items} and then choose the {object} with {num_items} {items}.                                                                       | bead_slide    | variant: `touch_count_required` · if `requiredTouchCount == true` · repeat: `numberOfRounds` |
| main  | 2    | yes      | learner_touches_each_item, item_lightness_reduced_per_touch          |                                                                                                                                                                      | bead_click    | variant: `touch_count_required` · if `requiredTouchCount == true`                            |
| main  | 3    | yes      | incorrect_line_50pc_transparent_on_incorrect_tap                     | `main_confirm_count` — There are {num_items} {items}.                                                                                                                | success_chime | variant: `touch_count_required` · if `feedbackTiming == instant`                             |
| main  | 4    | yes      | check_button_displayed                                               | `main_choose_then_check` — Choose the {object} with {num_items} {items} and then click the check mark when you're done.                                              |               | variant: `check_button_required` · if `requiredTouchCount == false`                          |
| main  | 5    | yes      | learner_selects_line, learner_taps_check                             |                                                                                                                                                                      |               | variant: `check_button_required` · if `requiredTouchCount == false`                          |
| main  | 6    | yes      | correct_or_incorrect_effect_and_sfx, incorrect_line_50pc_transparent | `main_confirm_count` — There are {num_items} {items}.                                                                                                                |               | variant: `check_button_required` · if `feedbackTiming == delayed`                            |
| outro | 1    | no       | character_appears                                                    | `outro_celebration` — Good job!                                                                                                                                      | fanfare       |                                                                                              |

_No contextualised flows._

## Strings

_All localisable text. Placeholders use `{name}` syntax resolved at runtime._

| Key | Text |
|:---|:---|
| `intro_prompt` | Can you help {object_character} select the {object} with the correct number of {items}? |
| `demo_tap_count_instruction` | Tap each {item} to count how many {items} are on each {object}. |
| `demo_count_line_1` | {num_items_line_1} {object} 1. |
| `demo_count_line_2` | {num_items_line_2} {object} 2. |
| `demo_count_line_3` | {num_items_line_3} {object} 3. |
| `demo_click_target_line` | Click on the {object} with {num_items} {items}. |
| `demo_confirm_count` | There are {num_items} {items} on this {object}. |
| `main_count_choose` | Count the {items} and then choose the {object} with {num_items} {items}. |
| `main_confirm_count` | There are {num_items} {items}. |
| `main_choose_then_check` | Choose the {object} with {num_items} {items} and then click the check mark when you're done. |
| `outro_celebration` | Good job! |

## Characters

| Key | Name | Role | Description |
|:---|:---|:---|:---|
| `object_character_rapelang` | Rapelang | protagonist | Helper character used in the necklace/string contextualisation |

## Content

**Default option:** `beads_on_string`

### Options

#### `beads_on_string` — Beads on a string

**Objects:** `string`

**Items:**

| Key | Label |
|:---|:---|
| `bead_blue_star_med` | blue star bead |
| `bead_blue_star_small` | blue star bead |
| `bead_blue_star_big` | blue star bead |
| `bead_red_circle_med` | red circle bead |
| `bead_red_circle_small` | red circle bead |
| `bead_red_circle_big` | red circle bead |
| `bead_purple_heart_med` | purple heart bead |
| `bead_purple_heart_small` | purple heart bead |
| `bead_orange_elipses_big` | orange ellipse bead |
| `bead_orange_elipses_med` | orange ellipse bead |
| `bead_orange_elipses_small` | orange ellipse bead |
| `bead_green_diamond_med` | green diamond bead |
| `bead_green_diamond_small` | green diamond bead |
| `bead_green_diamond_big` | green diamond bead |

#### `fruits_on_skewer` — Fruits on a skewer

**Objects:** `skewer_stick`

**Items:**

| Key | Label |
|:---|:---|
| `apple_slice` | apple slice |
| `banana_slice` | banana slice |
| `mango_slice` | mango slice |
| `orange_slice` | orange slice |
| `tangerine_slice` | tangerine slice |
| `strawberry` | strawberry |
| `watermelon_slice` | watermelon slice |
| `pineapple_slice` | pineapple slice |
| `blueberry` | blueberry |
| `grape` | grape |

#### `cars_on_road` — Cars on a road

**Objects:** `road`

**Items:**

| Key | Label |
|:---|:---|
| `car_red` | red car |
| `car_blue` | blue car |
| `car_yellow` | yellow car |
| `car_black` | black car |
| `car_green` | green car |
| `car_purple` | purple car |
| `truck` | truck |
| `bicycle` | bicycle |
| `motorbike` | motorbike |
| `tractor` | tractor |
| `pickup` | pickup |
| `bus` | bus |
| `minibus` | minibus |
| `scooter` | scooter |

#### `insects_on_branches` — Insects on branches

**Objects:** `sticks_with_leaves`

**Items:**

| Key | Label |
|:---|:---|
| `spider` | spider |
| `ladybug` | ladybug |
| `ant` | ant |
| `bee` | bee |
| `grasshopper` | grasshopper |
| `fly` | fly |
| `praying_mantis` | praying mantis |
| `dung_beetle` | dung beetle |
| `moth` | moth |
| `mosquito` | mosquito |
| `snail` | snail |

#### `birds_on_line` — Birds on a line

**Objects:** `string`

**Items:**

| Key | Label |
|:---|:---|
| `mousebird` | mousebird |
| `starling` | starling |
| `weaver` | weaver |
| `bulbul` | bulbul |
| `sunbird` | sunbird |
| `finch` | finch |
| `canary` | canary |
| `wagtail` | wagtail |
| `sparrow` | sparrow |
| `flycatcher` | flycatcher |
| `crow` | crow |
| `pigeon` | pigeon |
| `dove` | dove |
| `robin` | robin |
| `ox_pecker` | ox pecker |

## SFX

| Key | Label | Category |
|:---|:---|:---|
| `bead_slide` | Beads sliding | interaction |
| `bead_click` | Bead click | interaction |
| `pop_appear` | Pop / appear | transition |
| `success_chime` | Correct / success chime | success |
| `fanfare` | Fanfare | celebration |

## Instructional Hints

- `nh_counting_items_target`
