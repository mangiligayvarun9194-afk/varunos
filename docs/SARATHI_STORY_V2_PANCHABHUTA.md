# सारथि — Story v2: THE FIVE ELEMENTS (Pancha Bhuta)
*Supersedes the v1 body-travel storyboard (`SARATHI_STORYBOARD.md`). The charioteer stays;
the journey is rewritten around the Pancha Bhutas.*

## The one-line story
**The universe built itself in five steps. So does your strength.**
You are made of the five elements — space, air, fire, water, earth. Sarathi, the divine
charioteer, reads all five in you and brings them into balance. When the five align — you rise.

## Why this is stronger than v1
1. **Authentic + unprecedented:** Taittiriya Upanishad 2.1 gives the emanation order —
   from the Self came **Akasha** (space), from space **Vayu** (air), from air **Agni** (fire),
   from fire **Apas** (water), from water **Prithvi** (earth). The scroll follows the exact
   order of creation, top of the body to the ground — subtle → solid. The page IS the cosmology.
2. **Ayurveda-true feature mapping** (not decoration): mind/space in the head, breath/motion in
   the chest, the digestive fire (agni) in the belly, the waters (fluids/rhythm) at the heart,
   earth (bone/muscle) in the legs. Each element = one real Sarathi power.
3. **It adds a missing pillar:** v1 had no nutrition beat. Agni (metabolic fire) gives food/fuel
   a mythic home — Sarathi gets visibly stronger as a product story.
4. **The data story is reframed as power, not privacy:** Akasha is the space that *records* —
   your living record. The more it holds, the wiser Sarathi becomes. No privacy claims anywhere
   in the narrative; the record is the engine of personalization and future intelligence.

## The element → feature → body map
| # | Element | Body seat (Ayurveda) | Sarathi power | Accent | Element VFX |
|---|---|---|---|---|---|
| 1 | **AKASHA** आकाश (space) | the head, the mind | **Hermes + the Record** — remembers every session, meal, heartbeat; grows wiser as the record grows | soft violet `#c5b3ff` | starfield motes, halo fills with glyphs |
| 2 | **VAYU** वायु (air) | breath, motion, the hands | **Form Coach** — sees and grades every rep in real time; motion made visible | cyan `#7fd4f0` | drifting air-streaks, cyan pose-lines |
| 3 | **AGNI** अग्नि (fire) | the belly — digestive fire | **Fuel** — one-line meal logging, macros, metabolism read and balanced | fire `#ff9e5e` | rising embers intensify, core furnace glow |
| 4 | **APAS** आपस् (water) | the heart — blood, rhythm, tides | **Readiness** — sleep, HRV, strain flow into one score; the armor-opens-to-heart reveal lives HERE | teal `#2ec4b6` | ripple rings, heartbeat pulse (existing core bloom) |
| 5 | **PRITHVI** पृथ्वी (earth) | bones, muscle, the legs | **The Twin** — train and watch yourself visibly grow stronger | bronze-gold `#d9b26a` | slow dust motes, grounded low-angle |
| — | **BALANCE** | the whole | **CTA** — the five lights align in a column through his body; halo flares | gold-hi `#ffdeba` | all five glints orbit into alignment |

## The site structure (7 sections, engine unchanged)
1. **GATE — The Charioteer.** Master standing, flame-ring halo. Headline unchanged. New subtext
   drops the privacy line: *"A living Twin that grows as you train, a charioteer who remembers
   every day of your body — five elements, read and brought into balance."*
2. **AKASHA · space · the mind — "Space remembers."** Hermes + the Record.
3. **VAYU · air · the breath — "Air moves you."** Form Coach. *(No "nothing leaves your phone" line.)*
4. **AGNI · fire · the furnace — "Fire transforms you."** Fuel/nutrition. *(NEW beat.)*
5. **APAS · water · the tides — "Water restores you."** Readiness + the armor→heart reveal.
6. **PRITHVI · earth · the foundation — "Earth is what you build."** The Twin.
7. **BALANCE — "When the five align, you rise."** Open-hand invitation → Meet your Twin.

## Scene-video prompts (generate from the locked master, one per element)
All: same character (`sarathi-master-v1`), obsidian+gold, black void, ARRI/film grain, 16:9 + 9:16.
- **S2 AKASHA:** slow rise to head-and-shoulders; the flame-ring halo deepens into a starfield and
  fills with faint flowing golden glyphs orbiting like memory; violet-white light breathes.
- **S3 VAYU:** he performs a slow controlled guiding motion; silver-cyan currents of air trace his
  arms; faint luminous pose-lines and joint nodes follow the movement.
- **S4 AGNI:** camera drops to his core; the gold filigree over the belly ignites like a clean
  furnace; warm fire-light pulses upward through the armor seams; embers surge.
- **S5 APAS ★ centerpiece:** dolly to the chest; plates unlock outward in concentric mandala
  rings revealing a molten-gold heart with the teal core beating inside; teal ripple-rings
  radiate with each beat like tides. *(First frame: sealed armor. Last frame: heart revealed.)*
- **S6 PRITHVI:** low-angle; he plants his stance; dust motes rise; musculature and armor
  visibly strengthen; bronze-gold light climbs from the ground through his legs.
- **S7 BALANCE:** five small lights — violet, cyan, fire, teal, bronze — orbit him, then align
  in a vertical column through his body; the halo flares to full; he extends an open hand.

## Team plan (manager / architect / engineer)
- **Manager (sequencing):** Phase A (today): rewrite the live site copy/beats to v2 — zero asset
  cost, story ships immediately. Phase B: Varun generates S5 (centerpiece) then S2/S3/S4/S6/S7
  from the master; Claude wires each on landing. Phase C: per-element particle systems + the
  five-lights alignment finale. Phase D: cutover to production homepage + investor reel.
- **Architect (constraints):** engine (`SarathiStory.jsx`) already beat-driven — v2 is data +
  copy + accents, no structural rewrite. Element VFX are accent-parameterized layers on the
  existing halo/ember/core systems. Videos drop into existing per-beat slots. Reduced-motion
  fallbacks inherited. **No privacy claims in narrative copy anywhere** (product docs may state
  facts; marketing story stays silent) — keeps future server-side intelligence unconstrained.
- **Engineer (today's diff):** BEATS array (ids/eyebrows/titles/copy/accents/rail = elements),
  gate subtext, rail labels in Devanagari + English, Agni beat added, privacy lines removed.

## Acceptance
- A first-time scroller can retell: "I'm made of five elements and this guide balances them."
- Each beat names its element in Sanskrit + English and lands ONE product power.
- The record/Akasha beat reads as intelligence, not surveillance — and makes zero privacy claims.
- Nothing in copy blocks future cloud/AI features.
