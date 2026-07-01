# TheMod-HW PCB Layout Review — v2.0

**Board:** `Hardware/TheMod-HW.kicad_pcb`
**Date:** 2026-06-30
**Reviewer:** opencode (Claude)
**Scope:** Placement, ground planes, trace width — with focus on pot ADC noise and audio quality

---

## Table of Contents

- [Key Facts Established](#key-facts-established)
- [1. Placement](#1-placement)
  - [Good](#good)
  - [Concerns](#concerns)
- [2. Ground Planes](#2-ground-planes)
- [3. Trace Widths](#3-trace-widths)
- [4. Noise Immunity: Pot ADC Readings](#4-noise-immunity-pot-adc-readings)
- [5. Audio Quality](#5-audio-quality)
- [6. Prioritized Fix List](#6-prioritized-fix-list)
- [7. Unverified Items](#7-unverified-items)

---

## Key Facts Established

- **2-layer board**, 1.6 mm FR4, 1 oz Cu each side, 98.4 × 108.0 mm (`TheMod-HW.kicad_pcb:50-64`)
- **No ATmega32u4** on this board — ADC is an onboard **MCP3208** (U17 at `(170.51, 79.8)`) feeding the ESP32 via a 74AHCT125 level shifter. (CLAUDE.md is out of sync with the hardware.)
- **Ground is split** into `GNDA` and `GNDD` as **separate copper pours on both F.Cu and B.Cu** — 4 ground zones total (`:94896`, `:98607`, `:106050`, `:107754`)
- **Pot VREF = 2.048 V** from LM4040-2.0 (U4), not 3.3 V — good for ratiometric accuracy
- **Only 4 trace widths** used on the whole board: 0.4 / 0.3 / 0.2 / 0.15 mm
- **No ESP32 antenna keepout** — only one keepout exists, on the buck regulator switch node (`:66493`)

---

## Fix Status Dashboard

> Live view of all fix items (sections 4–6). Tick the boxes in their sections below — this table updates automatically. (Requires the **Dataview** community plugin.)

```dataview
TABLE WITHOUT ID
  t.section AS Section,
  t.text AS Fix,
  choice(t.completed, "✅", "☐") AS Status
FROM "Contexts/InfinityModular/TheMod/fixes.md"
FLATTEN file.tasks AS t
SORT t.line ASC
```

---

## 1. Placement

### Good

- PCM5102A DAC (U13, `(198.3, 58.8)`) sits right next to the ESP32 (U10, `(182.8, 59.0)`) — I²S traces stay short.
- MCP3208 (U17, `(170.5, 79.8)`) is close to the pots (Y=86) and to the 74AHCT125 (U15, `(181.5, 73.4)`) — SPI paths are short.
- CV jacks (Y=134.7) are physically separated from the digital cluster (ESP32 + DAC + level shifter) at the top.

### Concerns

**C1. ESP32 antenna has no keepout.** U10 sits at `(182.8, 59.0)` rotated 180°, ~16 mm from the top board edge. The ESP32-S3-WROOM-1U's PCB antenna must be clear of copper on **all layers** for ~15 mm beyond the antenna end. With GNDD poured across the whole top of the board (zone at `:94896`), the antenna is sitting in a sea of copper — this will detune it, kill WiFi/BLE range, and the digital noise on that copper will couple into the LNA.

**C2. Pots and audio share the mid-board band.** RV1–RV4 at Y≈86, RV5–RV8 at Y≈105, the audio NJM4556A (U19) at `(206.7, 77.3)`, PCM5102 at `(198.3, 58.8)`. The right-hand pots (RV4 at X=202.2) are within ~5 mm of the headphone driver. Audio return currents and pot wiper currents share copper. Not catastrophic, but the analog "keep left, digital/audio keep right" separation is weak on the right edge.

**C3. Buck regulator (U3) at `(149.0, 62.7)` sits above the pots.** The MP2393 switching node is the loudest EMI source on the board. It's ~23 mm from RV1's wiper. There's a keepout on the SW node pad itself (`:66485`) which is good, but the inductor L1 (SD7030, `(150.5, 55.7)`) is an unshielded/semi-shielded part radiating H-field. Confirm L1 is a **shielded** drum-core inductor (SD7030 series is available shielded) — if not, switch to one. Keep the 5V buck away from the ADC input bank on the next spin.

---

## 2. Ground Planes

**This is the biggest issue.**

**G2.1. No dedicated ground plane layer.** On a 2-layer board with 1.51 mm FR4 core, return currents on the opposite layer are spread over a wide, high-impedance path. For mixed-signal audio + 12-bit ADC work this is the single biggest noise lever you have. **Strong recommendation: move to a 4-layer stack** with a continuous GND plane on an inner layer. Cost delta is ~$2-3 per board at JLCPCB/PCBWay for this size — trivial vs. the noise benefit. Standard stack: SIG / GND / PWR / SIG, with GND as a solid unbroken plane.

**G2.2. GNDA/GNDD split with no visible star bridge.** The two grounds are poured as separate zones on **both** layers. I could not find a single explicit star-tie between them (no zero-ohm jumper, no ferrite bead bridge footprint, no copper stitch). If they tie only at the DC input connector, return currents from the digital section have to travel a long loop back to the star — that loop is an antenna and a crosstalk path into the analog ADC references.

**G2.3. Splitting ground on a 2-layer board can make things worse, not better.** The split-ground strategy comes from 4+ layer boards where a solid plane under each domain guarantees low-impedance returns. On 2 layers with poured zones, a signal trace that crosses the GNDA/GNDD boundary has **no continuous return path** — its return current must detour through the star bridge, creating a large loop and *more* radiation, not less. **Recommendation for a 2-layer board:** use a **single unified GND pour** (one net), and control noise by **routing discipline** (keep digital traces out of the analog region, don't run I²S parallel to wipers, etc.). Reserve the split-plane strategy for when you go 4-layer. This is the single most impactful change you can make without respinning to 4 layers.

**G2.4. MCP3208 AGND and DGND both tied to GNDA.** That's a defensible choice (the ADC's digital noise stays on the analog side, close to the star). But it means the SPI return currents from the 74AHCT125 flow through GNDA. Make sure the 74AHCT125's GND pin and the MCP3208's DGND pin are close together and that the SPI signal pairs have a clean GNDA return path directly underneath.

---

## 3. Trace Widths

**T3.1. ADC input trace widths are inconsistent — fix this.**

| Net      | Width      | Notes                            |
| -------- | ---------- | -------------------------------- |
| ADC_POT1 | 0.2 mm     | `:88312`                         |
| ADC_POT2 | 0.2 mm     | `:87248`                         |
| ADC_POT3 | **0.4 mm** | `:92056` — wider than the others |
| ADC_POT4 | **0.4 mm** | `:83183` — wider than the others |
| ADC_CV1  | 0.3–0.4 mm | `:83247`                         |
| ADC_CV2  | 0.4 mm     | `:92400`                         |
| ADC_CV3  | 0.2 mm     | `:92432`                         |
| ADC_CV4  | 0.2 mm     | `:92488`                         |

Width itself doesn't matter much here (currents are µA). What matters is that the inconsistency suggests these traces were routed without a coherent strategy. **For ADC inputs, pick one width (0.2 mm is fine) and use it uniformly**, and — more importantly — **route each wiper with a ground guard trace alongside it on the same layer, or ensure it has a continuous GND pour on the opposite layer underneath it**. Right now ADC_POT3/4 at 0.4 mm with no guard is just a fatter antenna.

**T3.2. No series resistors on pot wipers.** The wiper traces run from RV1–RV4 (Y=86) to MCP3208 CH0–CH3 (Y≈80) with no series R and no decoupling C. Two consequences:
- **Source impedance:** a B100K pot at mid-position presents ~25 kΩ to the ADC. The MCP3208 datasheet specifies max source impedance for full 12-bit accuracy (typically <1 kΩ, or use the sample-time formula). At 25 kΩ you'll see sampling error and noise. **Either** (a) drop the pots to **B10K** (Alps RK09F is available in B10K, same footprint), **or** (b) add a 10–47 nF cap from each wiper to GNDA at the ADC pin (this forms a divider with the wiper impedance and averages noise, but slows response — fine for a pot that's polled every few ms).
- **The cap is missing entirely.** I found 70 caps on the board but none sitting on the wiper nets near U17. Add one per channel.

**T3.3. No series termination on the SPI bus to MCP3208.** SPI clocks from the 74AHCT125 are fast (likely 1–4 MHz) with sub-ns edges. Fast edges ring and couple into the adjacent ADC inputs and audio path. Add a **22–33 Ω series resistor on SCK, MOSI, and /SS** placed at the driver (74AHCT125) output. This is a 5-cent fix with a big noise payoff.

**T3.4. I²S traces at 0.2 mm routed through the audio area.** I²S_BCK / DATA / LRCLK run from the ESP32 down to the PCM5102 (`:85904`–`:86184`) through the same band where the audio op-amps and the right-hand pots live. I²S is a constant-edge-rate digital bus — it's a strong noise source. Confirm these traces do **not** run parallel to any audio trace (LINE_OUT_L/R, AUDIO_TOFILTER_*, EURO_OUT_*) for more than a few mm. If they do, reroute or add a GND guard between them.

**T3.5. Power traces adequate.** 0.4 mm on 1oz Cu at 1.6mm board gives ~0.8A capacity for a 10°C rise — fine for 3.3V/5V rails at these currents. The +12V/-12V pours as local islands are fine. No concerns here.

---

## 4. Noise Immunity: Pot ADC Readings

- [ ] **1. B100K source impedance too high for MCP3208** _(High)_ — Change to B10K, or add 47nF wiper-to-GNDA caps
- [ ] **2. No wiper decoupling caps at all** _(High)_ — Add 10–100nF per wiper at U17 pin
- [ ] **3. 2-layer board, no GND plane** _(High)_ — Move to 4-layer (SIG/GND/PWR/SIG) on next spin
- [ ] **4. Split GNDA/GNDD on 2 layers with no clear star** _(High)_ — Either unify to single GND pour, or add one explicit star bridge at power entry
- [ ] **5. ADC trace widths inconsistent (0.2 vs 0.4)** _(Medium)_ — Standardize at 0.2 mm + GND guard
- [ ] **6. Buck inductor near pots** _(Medium)_ — Use shielded inductor; relocate buck on next spin
- [ ] **7. No SPI series termination** _(Medium)_ — Add 22–33Ω on SCK/MOSI/SS at the 74AHCT125

---

## 5. Audio Quality

- [ ] **8. No ESP32 antenna keepout** _(High)_ — Add F.Cu+B.Cu keepout past antenna end
- [ ] **9. I²S traces routed through audio band** _(Medium)_ — Verify no parallel runs with audio; reroute if needed
- [ ] **10. Audio traces at 0.2 mm near digital cluster** _(Low)_ — Acceptable if not parallel to I²S; add GND guard if doubt
- [ ] **11. PCM5102 / NJM4556A / pots all on right edge** _(Low)_ — Acceptable; watch the pot-to-headphone-amp proximity

---

## 6. Prioritized Fix List

Ordered by impact-per-effort. Check off as completed.

- [ ] **1. Add wiper decoupling caps** (10–100 nF, X7R, at U17 pins 1–4 to GNDA) — cheapest, biggest ADC noise win.
- [ ] **2. Add a single GNDA↔GNDD star bridge** at the power entry if you keep the split. (Or unify to one GND — even better on 2 layers.)
- [ ] **3. Add 22–33 Ω series resistors** on the 3208_* SPI lines at the 74AHCT125.
- [ ] **4. Add ESP32 antenna keepout** on both copper layers.
- [ ] **5. Standardize ADC input trace widths** at 0.2 mm and route a GND guard alongside.
- [ ] **6. Verify the buck inductor is shielded**; if not, swap the part.
- [ ] **7. Next respin: go 4-layer** with a solid inner GND plane. This makes items 2, 3, and the split-ground debate all moot.

---

## 7. Unverified Items

- Whether GNDA and GNDD actually bridge somewhere (I found no explicit bridge footprint). Worth confirming in KiCad's layout view with the net-highlight tool.
- The exact parallel-run relationships between I²S and audio traces — needs the interactive canvas or a more expensive trace-by-trace analysis.
- Whether RV5–RV8 (the second row of pots at Y=105) are user pots or trimpots — the PCB lists them as B100K Alps RK09K (user-grade vertical pots), but the schematic agent flagged some as trimpots. If RV5–RV8 are user pots, they have the same wiper issues as RV1–RV4.
