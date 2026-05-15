# Pair picture with number

**Identifier:** `n_pair_picture_with_number`  
**Spec version:** 1.1-DRAFT  
**Locale:** `en-ZA`

## Meta

| Field | Value |
|:---|:---|
| subject | Numeracy |
| activityFamily | Interactive - Drag |
| activityType | Drag and drop into boxes (multiple) |
| layoutTemplate | _(null)_ |
| description | Learners drag and drop to match images of groups of beads (1–10) to the correct number. |
| subconstructs | Counting |
| skillsMapping | N1.1.1-F |
| senAffordances | _(none)_ |

## Suggested Global Params

_Hints only — the platform may override._

| Param | Value |
|:---|:---|
| `showDemo` | true |
| `showOutro` | true |

## Novel Parameters

### `numberOfDominoes`

**Type:** `integer`  
**Logic:** Total number of dominoes (number+picture pairs) presented in a round.

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| 3 | 6 | 3 |

### `numberRange`

**Type:** `integerRange`  
**Logic:** Range of numbers that can appear on dominoes.

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| 1–10 | 1–10 | 1–10 |

### `distractorsEnabled`

**Type:** `boolean`  
**Logic:** When true, additional unmatched picture cards are included.

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| false | false | true |

### `dominoPlacement`

**Type:** `string`  
**Enum:** `ascending, random`

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| random | ascending | random |

### `feedbackTiming`

**Type:** `string`  
**Enum:** `instant, delayed`

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| instant | delayed | delayed |


## Action Sequence

### Core

| Phase | Step | Required | Actions | Audio | SFX | Flags |
|:---|:---|:---|:---|:---|:---|:---|
| intro | 1 | no | character_enters | `intro_prompt` — Can you help {object_character} match the pictures with the numbers? |  |  |
| demo | 1 | no | dominoes_appear_with_numbers, picture_cards_appear_in_selection_area, teacher_enters | `demo_match_amounts` — We need to match the amount of {items} to the right number. |  |  |
| demo | 2 | no | pointer_drags_card_to_domino_1 | `demo_drag_instruction` — Drag the card with {num_items} {item} to match with the number {num_items}, like this. |  |  |
| demo | 3 | no | pointer_repeats_drag_for_remaining_cards, check_button_activates_on_last_placement | `demo_tap_check` — Tap the check button when you are ready to check your work. |  |  |
| demo | 4 | no | pointer_taps_check_button | `demo_your_turn` — Now it's your turn. |  |  |
| main | 1 | no | dominoes_appear_with_numbers, picture_cards_appear_in_random_order | `main_match_amounts` — Match the amounts of {items} to the right numbers. |  | repeat: `numberOfRounds` |
| main | 2 | yes | learner_drags_cards_to_dominoes, check_button_activates_when_all_placed |  |  |  |
| outro | 1 | no | random_outro_sequence, may_include_counting_outro_set |  | fanfare |  |

_No contextualised flows._

## Strings

_All localisable text. Placeholders use `{name}` syntax resolved at runtime._

| Key | Text |
|:---|:---|
| `intro_prompt` | Can you help {object_character} match the pictures with the numbers? |
| `demo_match_amounts` | We need to match the amount of {items} to the right number. |
| `demo_drag_instruction` | Drag the card with {num_items} {item} to match with the number {num_items}, like this. |
| `demo_tap_check` | Tap the check button when you are ready to check your work. |
| `demo_your_turn` | Now it's your turn. |
| `main_match_amounts` | Match the amounts of {items} to the right numbers. |

## Characters

| Key | Name | Role | Description |
|:---|:---|:---|:---|
| `object_character` | Helper | protagonist | Generic helper character — replace with named character per setting |

## Content

**Default option:** `dominoes_beads`

### Options

#### `dominoes_beads` — Dominoes with numerals and bead groups

**Objects:** `domino`

**Items:**

| Key | Label |
|:---|:---|
| `card` | card |
| `bead_group_1` | 1 bead |
| `bead_group_2` | 2 beads |
| `bead_group_3` | 3 beads |
| `bead_group_4` | 4 beads |
| `bead_group_5` | 5 beads |
| `bead_group_6` | 6 beads |
| `bead_group_7` | 7 beads |
| `bead_group_8` | 8 beads |
| `bead_group_9` | 9 beads |
| `bead_group_10` | 10 beads |

#### `monsters_eyes` — Monsters with eyes

**Objects:** `domino`

**Items:**

| Key | Label |
|:---|:---|
| `monster_0_eye` | monster with 0 eyes |
| `monster_1_eye` | monster with 1 eye |
| `monster_2_eye` | monster with 2 eyes |
| `monster_3_eye` | monster with 3 eyes |
| `monster_4_eye` | monster with 4 eyes |
| `monster_5_eye` | monster with 5 eyes |
| `monster_6_eye` | monster with 6 eyes |
| `monster_7_eye` | monster with 7 eyes |
| `monster_8_eye` | monster with 8 eyes |
| `monster_9_eye` | monster with 9 eyes |
| `monster_10_eye` | monster with 10 eyes |

#### `plants_garden_beds` — Plants in garden beds

**Objects:** `domino`, `garden_box`

**Items:**

| Key | Label |
|:---|:---|
| `sprout_1` | 1 sprout |
| `sprout_2` | 2 sprouts |
| `sprout_3` | 3 sprouts |
| `sprout_4` | 4 sprouts |
| `sprout_5` | 5 sprouts |

## SFX

| Key | Label | Category |
|:---|:---|:---|
| `fanfare` | Fanfare | celebration |

## Instructional Hints

- `Ih_drag_drop`
