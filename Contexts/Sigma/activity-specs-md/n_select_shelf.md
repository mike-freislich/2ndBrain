# Select Shelf with X Items

**Identifier:** `n_select_shelf`  
**Spec version:** 1.1-DRAFT  
**Locale:** `en-ZA`

## Meta

| Field | Value |
|:---|:---|
| subject | Numeracy |
| activityFamily | Interactive - Tap |
| activityType | Tap to select answer with audio clue |
| layoutTemplate | layout_1 |
| description | Choose the correct number of items to match an audio clue |
| subconstructs | N1.1, N1.2 |
| skillsMapping | N1.1.1-F, N1.2.1-F |
| senAffordances | Consider the colour contrast and how visible items will be for those with colour blindness or other sight impairments |

## Suggested Global Params

_Hints only — the platform may override._

| Param | Value |
|:---|:---|
| `numberOfRounds` | 5 |

## Novel Parameters

### `numberOfItemsPerShelf`

**Type:** `integerRange`  
**Logic:** No shelves must have the same number of items.

| L1 | L2 | L3 | L4 |
|:-:|:-:|:-:|:-:|
| 1–5 | 1–5 | 1–10 | 1–10 |

### `numberOfShelves`

**Type:** `integer`

| L1 | L2 | L3 | L4 |
|:-:|:-:|:-:|:-:|
| 2 | 3 | 3 | 3 |

### `itemHomogeneity`

**Type:** `string`  
**Enum:** `same, mixed`

| L1 | L2 | L3 | L4 |
|:-:|:-:|:-:|:-:|
| same | same | same | mixed |

### `feedbackTiming`

**Type:** `string`  
**Enum:** `instant, delayed`  
**Logic:** If shelf clicked is incorrect, shelf outlines in red with incorrect effect and SFX with audio.

| L1 | L2 | L3 | L4 |
|:-:|:-:|:-:|:-:|
| instant | instant | delayed | delayed |


## Action Sequence

### Core

| Phase | Step | Required | Actions | Audio | SFX | Flags |
|:---|:---|:---|:---|:---|:---|:---|
| intro | 1 | no | character_enters | `intro_prompt` — Can you help {object_character} choose the {object} with the correct amount of items? |  |  |
| demo | 1 | no | shelves_appear, items_randomised, target_number_displayed | `demo_tap_instruction` — Tap the {object} with {num_items} {items}. |  |  |
| demo | 2 | no | pointer_counts_shelf_1, pointer_counts_shelf_2, pointer_clicks_correct | `demo_count_shelf_1` — {num_items_shelf_1}<br>`demo_count_shelf_2` — {num_items_shelf_2}<br>`demo_click_instruction` — Click on the {object} with {num_items} {items}. | pop_appear |  |
| demo | 3 | no | colour_block_appears, number_appears_right | `demo_confirm_count` — There are {num_items} {items}. |  |  |
| main | 1 | yes | shelves_appear_randomised, audio_target_prompt | `main_choose_shelf` — Choose the {object} with {num_items} {items}. | pop_appear | repeat: `numberOfRounds` |
| main | 2 | yes | colour_block_appears, number_confirmed | `main_confirm_count` — There are {num_items} {items}. | swoosh | if `correct_selection` |
| main | 3 | yes | three_shelf_layout |  |  | variant: `three_shelves` · if `level >= L2` |
| main | 4 | yes | mixed_items_layout, check_button_displayed | `main_mixed_check_instruction` — Choose the {object} with {num_items} items. When you're done, tap the check mark to check your work. |  | variant: `mixed_items_with_check` · if `level >= L3` |
| main | 5 | yes | shelf_outlines_red, incorrect_effect | `feedback_incorrect` — That's not right, try again! | troubleshoot_fail | variant: `incorrect_feedback` · if `incorrect_selection` |
| outro | 1 | no | character_appears | `outro_celebration` — Good job! | fanfare |  |

### Contextualised — `spaza_shop`

| Phase | Step | Required | Actions | Audio | SFX | Flags |
|:---|:---|:---|:---|:---|:---|:---|
| intro | 1 | no |  | `cx_intro_narrator_1` — {object_character_uncle_jaba} needs help at the spaza shop today. He asks {object_character_phalo} if he can help serve customers.<br>`cx_intro_character_1` — I can help! | ambient_town_music | scene: `cx_intro_scene_1` — Scene: Street scene with Spaza shop clearly in the background. {object_character_uncle_jaba} is already on the screen standing in front of the spaza shop. Ambient sound of a town with African music tinkle plays in background. {object_character_phalo} walks on. {object_character_phalo} smiles and gives a thumbs up. |
| intro | 2 | no |  | `cx_intro_ready` — I'm ready to help!<br>`cx_intro_customer_needs` — This customer needs {num_items} {items}. |  | scene: `cx_intro_scene_2` — Scene: Spaza shop counter. {object_character_phalo} walks up to counter. {object_character_woman_1} walks up to counter. Speech bubble with text appears. {object_character_phalo} gives thumbs up and turns and walks out of frame. |
| intro | 3 | no |  | `cx_intro_help_prompt` — Can you help {object_character_phalo} select the shelf with the right amount of items? |  | scene: `cx_intro_scene_3` — {object_character_phalo} walks onto frame and stops and looks out to user. |
| demo | 4 | no |  | `cx_thank_customer` — Thank you for helping the customer! |  | scene: `cx_demo_customer_thanks` — Scene: Spaza shop counter. Items appear on counter with {object_character_phalo} standing behind the counter. {object_character_woman_1} speech bubble with text appears. Scene fades. |
| demo | 5 | no |  | `cx_next_customer_needs` — This customer needs {num_items} {items}. |  | scene: `cx_demo_next_customer` — Scene: Spaza shop counter. {object_character_phalo} is at the counter. {object_character_man_1} walks up to counter. Speech bubble with text appears. |
| main | 3 | yes |  | `cx_thank_customer` — Thank you for helping the customer! |  | if `correct_selection` · scene: `cx_main_customer_thanks` — Scene: Spaza shop counter. Items appear on counter with {object_character_phalo} standing behind the counter. {object_character_man_1} speech bubble with text appears. Scene fades. |

## Strings

_All localisable text. Placeholders use `{name}` syntax resolved at runtime._

| Key | Text |
|:---|:---|
| `intro_prompt` | Can you help {object_character} choose the {object} with the correct amount of items? |
| `demo_tap_instruction` | Tap the {object} with {num_items} {items}. |
| `demo_count_shelf_1` | {num_items_shelf_1} |
| `demo_count_shelf_2` | {num_items_shelf_2} |
| `demo_click_instruction` | Click on the {object} with {num_items} {items}. |
| `demo_confirm_count` | There are {num_items} {items}. |
| `main_choose_shelf` | Choose the {object} with {num_items} {items}. |
| `main_confirm_count` | There are {num_items} {items}. |
| `main_mixed_check_instruction` | Choose the {object} with {num_items} items. When you're done, tap the check mark to check your work. |
| `feedback_incorrect` | That's not right, try again! |
| `outro_celebration` | Good job! |
| `cx_intro_scene_1` | Scene: Street scene with Spaza shop clearly in the background. {object_character_uncle_jaba} is already on the screen standing in front of the spaza shop. Ambient sound of a town with African music tinkle plays in background. {object_character_phalo} walks on. {object_character_phalo} smiles and gives a thumbs up. |
| `cx_intro_narrator_1` | {object_character_uncle_jaba} needs help at the spaza shop today. He asks {object_character_phalo} if he can help serve customers. |
| `cx_intro_character_1` | I can help! |
| `cx_intro_scene_2` | Scene: Spaza shop counter. {object_character_phalo} walks up to counter. {object_character_woman_1} walks up to counter. Speech bubble with text appears. {object_character_phalo} gives thumbs up and turns and walks out of frame. |
| `cx_intro_ready` | I'm ready to help! |
| `cx_intro_customer_needs` | This customer needs {num_items} {items}. |
| `cx_intro_scene_3` | {object_character_phalo} walks onto frame and stops and looks out to user. |
| `cx_intro_help_prompt` | Can you help {object_character_phalo} select the shelf with the right amount of items? |
| `cx_demo_customer_thanks` | Scene: Spaza shop counter. Items appear on counter with {object_character_phalo} standing behind the counter. {object_character_woman_1} speech bubble with text appears. Scene fades. |
| `cx_thank_customer` | Thank you for helping the customer! |
| `cx_demo_next_customer` | Scene: Spaza shop counter. {object_character_phalo} is at the counter. {object_character_man_1} walks up to counter. Speech bubble with text appears. |
| `cx_next_customer_needs` | This customer needs {num_items} {items}. |
| `cx_main_customer_thanks` | Scene: Spaza shop counter. Items appear on counter with {object_character_phalo} standing behind the counter. {object_character_man_1} speech bubble with text appears. Scene fades. |

## Characters

| Key | Name | Role | Description |
|:---|:---|:---|:---|
| `object_character_phalo` | Phalo | protagonist | Young boy who helps at the spaza shop |
| `object_character_uncle_jaba` | Uncle Jaba | supporting | Spaza shop owner |
| `object_character_woman_1` | Woman 1 | customer | First customer at the spaza shop |
| `object_character_man_1` | Man 1 | customer | Second customer at the spaza shop |

## Content

**Default option:** `spaza_shop`

### Options

#### `spaza_shop` — Spaza shop with kitchen items on shelves

**Objects:** `shelf`

**Ambient SFX:** `ambient_town_music` (African town ambient)

**Items:**

| Key | Label |
|:---|:---|
| `bars_of_soap` | bars of soap |
| `soda_bottles` | soda bottles |
| `chip_packets` | chip packets |
| `chocolates` | chocolates |
| `boxes_of_milk` | boxes of milk |
| `tuna_cans` | tuna cans |
| `bottles_of_oil` | bottles of oil |
| `bags_of_sugar` | bags of sugar |
| `bags_of_flour` | bags of flour |
| `cans_of_beans` | cans of beans |

#### `toy_shelves` — Toys on shelves

**Objects:** `shelf`

**Items:**

| Key | Label |
|:---|:---|
| `teddy_bear` | teddy bear |
| `robot` | robot |
| `soccer_ball` | soccer ball |
| `block` | block |
| `doll` | doll |
| `kite` | kite |
| `stacking_tower` | stacking tower |
| `drum` | drum |
| `tambourine` | tambourine |
| `shaker` | shaker |
| `toy_truck` | toy truck |
| `wire_car` | wire car |

#### `garden_sprouts` — Sprouts in a dirt row

**Objects:** `dirt_row`

**Items:**

| Key | Label |
|:---|:---|
| `sprout_1` | sprout |
| `sprout_2` | sprout |
| `sprout_3` | sprout |
| `sprout_4` | sprout |
| `sprout_5` | sprout |

#### `canoe_people` — People in a canoe

**Objects:** `canoe`

**Items:**

| Key | Label |
|:---|:---|
| `boat_character_1` | person |
| `boat_character_2` | person |
| `boat_character_3` | person |
| `boat_character_4` | person |
| `boat_character_5` | person |
| `boat_character_6` | person |
| `boat_character_7` | person |
| `boat_character_8` | person |
| `boat_character_9` | person |
| `boat_character_10` | person |

#### `flower_bush` — Flowers on a bush

**Objects:** `bush_row`

**Items:**

| Key | Label |
|:---|:---|
| `flower_pink` | pink flower |
| `flower_lblue` | light blue flower |
| `flower_dblue` | dark blue flower |
| `flower_yellow` | yellow flower |
| `flower_orange` | orange flower |
| `flower_red` | red flower |
| `flower_white` | white flower |
| `flower_purple` | purple flower |

## SFX

| Key | Label | Category |
|:---|:---|:---|
| `pop_appear` | Pop / appear | transition |
| `swoosh` | Swoosh / woosh | success |
| `fanfare` | Fanfare | celebration |
| `troubleshoot_fail` | Troubleshoot fail alert | error |
| `ambient_town_music` | African town ambient | ambient |

## Instructional Hints

- `nh_counting_items_target`
- `nh_counting_items`
- `nh_item_target`
- `nh_tap_for_number`
