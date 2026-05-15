# How many counting groups

**Identifier:** `n_how_many_counting_groups`  
**Spec version:** 1.1-DRAFT  
**Locale:** `en-ZA`

## Meta

| Field | Value |
|:---|:---|
| subject | Numeracy |
| activityFamily | Interactive - Drag |
| activityType | Drag and drop into a box (individual) |
| layoutTemplate | _(null)_ |
| description | Counting 1–10 items into an object according to audio instructions. Very early level game, kept simple (e.g. no done button). |
| subconstructs | N1.1, N1.2 |
| skillsMapping | N1.1.1-F, N1.2.1-G1 |
| senAffordances | _(none)_ |

## Suggested Global Params

_Hints only — the platform may override._

| Param | Value |
|:---|:---|
| `numberOfRounds` | 4 |
| `showDemo` | true |
| `showOutro` | true |

## Novel Parameters

### `totalItemsOnScreen`

**Type:** `integerRange`  
**Logic:** Equal to (target category items + 1) at minimum.

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| 3–10 | 4–20 | 5–20 |

### `numberOfItemCategories`

**Type:** `integer`  
**Logic:** Items from the target category must never have the same count as any other category on screen.

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| 2 | 3 | 4 |

### `categoryItemMax`

**Type:** `integer`  
**Logic:** Maximum count for any single category on screen.

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| 10 | 10 | 10 |

### `itemSizes`

**Type:** `string`  
**Enum:** `consistent, varied`

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| consistent | varied | varied |

### `feedbackTiming`

**Type:** `string`  
**Enum:** `instant, delayed`

| L1 | L2 | L3 |
|:-:|:-:|:-:|
| instant | instant | instant |


## Action Sequence

### Core

| Phase | Step | Required | Actions | Audio | SFX | Flags |
|:---|:---|:---|:---|:---|:---|:---|
| intro | 1 | no | character_enters | `intro_prompt` — Can you help {object_character} count? |  |  |
| demo | 1 | no | empty_container_appears, target_number_above_container, items_scattered_to_side, teacher_enters | `demo_pick_right_items` — We must pick the right items. |  |  |
| demo | 2 | no | target_number_emphasised | `demo_we_need_n_items` — We need {num_items} {items}. |  |  |
| demo | 3 | no | pointer_picks_item, pointer_drags_to_container | `demo_drag_instruction` — Drag the {items} into the {object}, like this. |  |  |
| demo | 4 | no | item_drops_into_container, container_fill_animation |  | scenario_drop_sfx |  |
| demo | 5 | no | target_reached_indicator | `demo_confirm_then_your_turn` — {num_items} {items}. Now it's your turn. |  | if `target_reached` |
| main | 1 | yes | container_resets, new_items_appear, new_target_number_displayed | `main_we_need_n_items` — We need {num_items} {items}. |  | repeat: `numberOfRounds` |
| main | 2 | yes | learner_drags_items_to_container, drop_animation_per_item |  | scenario_drop_sfx |  |
| main | 3 | yes | target_reached_indicator | `main_confirm_count` — {num_items} {items}. |  | if `target_reached` |
| main | 4 | no | container_top_view, full_container_reveal | `main_all_done` — It is all done. Good job! |  | if `all_items_used` |
| outro | 1 | no | random_outro_sequence |  | fanfare |  |

### Contextualised — `soup_pot`

| Phase | Step | Required | Actions | Audio | SFX | Flags |
|:---|:---|:---|:---|:---|:---|:---|
| intro | 1 | no |  | `cx_intro_oops` — {object_character} forgot! Mom is working tonight! (Oops!)<br>`cx_intro_not_worried` — {object_character} isn't worried. |  | scene: `cx_intro_scene_1` — Scene: An empty kitchen indicating dinner is coming up. {object_character} appears looking surprised, then poses with hands on hips, supremely confident. |
| intro | 2 | no |  | `cx_intro_help_make_dinner` — {object_character} is going to make dinner for when Mom gets home! Can you help? |  | scene: `cx_intro_scene_2` — {object_character} pulls on a chef hat and picks up a cooking tool, ready to go. |
| demo | 4 | no | splash_animation, steam_appears, steam_fades |  | splash |  |

## Strings

_All localisable text. Placeholders use `{name}` syntax resolved at runtime._

| Key | Text |
|:---|:---|
| `intro_prompt` | Can you help {object_character} count? |
| `demo_pick_right_items` | We must pick the right items. |
| `demo_we_need_n_items` | We need {num_items} {items}. |
| `demo_drag_instruction` | Drag the {items} into the {object}, like this. |
| `demo_confirm_then_your_turn` | {num_items} {items}. Now it's your turn. |
| `main_we_need_n_items` | We need {num_items} {items}. |
| `main_confirm_count` | {num_items} {items}. |
| `main_all_done` | It is all done. Good job! |
| `cx_intro_scene_1` | Scene: An empty kitchen indicating dinner is coming up. {object_character} appears looking surprised, then poses with hands on hips, supremely confident. |
| `cx_intro_oops` | {object_character} forgot! Mom is working tonight! (Oops!) |
| `cx_intro_not_worried` | {object_character} isn't worried. |
| `cx_intro_scene_2` | {object_character} pulls on a chef hat and picks up a cooking tool, ready to go. |
| `cx_intro_help_make_dinner` | {object_character} is going to make dinner for when Mom gets home! Can you help? |

## Characters

| Key | Name | Role | Description |
|:---|:---|:---|:---|
| `object_character` | Helper | protagonist | Generic helper character — replace with named character per setting |

## Content

**Default option:** `soup_pot`

### Options

#### `soup_pot` — Cooking vegetables in a soup pot

**Objects:** `pot`, `steam`

**Scenario SFX:** `splash`, `sizzle`

**Notes:** When an item is dropped: splash SFX, pot fills with liquid, steam appears briefly.

**Items:**

| Key | Label |
|:---|:---|
| `onion` | onion |
| `garlic` | garlic |
| `carrot` | carrot |
| `egg` | egg |
| `casava_root` | cassava root |
| `beans` | beans |
| `kale` | kale |
| `cabbage` | cabbage |
| `okra` | okra |
| `tomato` | tomato |
| `fish` | fish |
| `corn` | corn |
| `potato` | potato |
| `chicken` | chicken |
| `meat` | meat |

#### `insects_nest` — Worms / insects to chicks in a nest

**Objects:** `nest`

**Scenario SFX:** `chirping`

**Notes:** Add chirping SFX; chicks open and close beaks when each item is dropped.

**Items:**

| Key | Label |
|:---|:---|
| `worm` | worm |
| `spider` | spider |
| `caterpillar` | caterpillar |
| `grasshopper` | grasshopper |
| `ant` | ant |
| `ladybug` | ladybug |
| `beetle` | beetle |
| `moth` | moth |
| `fly` | fly |
| `bee` | bee |
| `praying_mantis` | praying mantis |
| `mosquito` | mosquito |

#### `toy_box` — Packing toys into a box

**Objects:** `toy_box`

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

#### `laundry_basket` — Packing laundry into a basket

**Objects:** `basket`

**Items:**

| Key | Label |
|:---|:---|
| `sock` | sock |
| `shirt` | shirt |
| `cap` | cap |
| `shorts` | shorts |
| `pants` | pants |
| `beanie` | beanie |
| `swimsuit` | swimsuit |
| `vest` | vest |
| `doek` | doek |
| `jacket` | jacket |
| `dress` | dress |

#### `shells_bucket` — Shells into a bucket

**Objects:** `bucket`

**Items:**

| Key | Label |
|:---|:---|
| `rock` | rock |
| `starfish` | starfish |
| `seashell` | seashell |
| `stick` | stick |
| `seaweed` | seaweed |
| `crab` | crab |

## SFX

| Key | Label | Category |
|:---|:---|:---|
| `splash` | Splash | interaction |
| `sizzle` | Sizzle | interaction |
| `chirping` | Chicks chirping | ambient |
| `fanfare` | Fanfare | celebration |

## Instructional Hints

- `Ih_drag_drop`
