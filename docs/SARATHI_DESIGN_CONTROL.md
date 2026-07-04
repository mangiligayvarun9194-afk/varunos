# सारथि — DESIGN CONTROL — The Definitive Design & Architecture Plan
*Reference class: cula.tech (Awwwards nominee — C4D/AE pre-rendered video + typographic
discipline + scroll storytelling). Our story: v3 "The Field and the Charioteer" (Pancha Bhuta).
This document is the design constitution: every pixel, every millisecond, governed.*

---

## 0. The thesis
**Control is the aesthetic.** Control of timing. Control of spacing. Control of attention.
Every movement deliberate. Every element purposeful. Nothing fights for attention — yet
everything lands. Sarathi's version of this: **a temple, not a theme park.** The visitor
doesn't browse the page; they are *walked through it* by the charioteer.

## 1. The Ten Laws (the constitution — violations are bugs)
1. **One idea per viewport.** Each full screen makes exactly one claim. If two things compete, cut one.
2. **One motion per moment.** Never two entrances at once; motions are sequenced, not parallel.
3. **The figure is the sun.** In every viewport there is ONE focal point (95% of the time: the
   guardian or his active element). Everything else orbits dimmer.
4. **One accent per viewport.** Obsidian + gold are the constants; the active element's color is
   the ONLY accent on screen. Two accents visible = a bug.
5. **Text never fights light.** Copy sits in reserved darkness (the scrim side); the figure owns
   the light side. Fixed 40/60 split, alternating per chapter.
6. **The spatial grid is sacred:** 8px base unit; 12-col grid; copy max-width 34rem; display
   max 12 words per line; body max 62ch.
7. **Timing is composed, not decorated:** exactly three easings site-wide —
   `--ease-walk: cubic-bezier(.22,1,.36,1)` (entrances) · springs `stiffness 85 / damping 17`
   (copy) · `linear` (scroll-scrubbed only). One duration scale: 200/400/700/1200ms. Nothing else.
8. **Velocity hierarchy = depth:** background moves slowest (0.2×), figure 0.6×, VFX 0.8×,
   copy 1× with scroll. The parallax IS the 3D.
9. **Breaths are content.** Between chapters: a 40vh near-black "breath" — only the element's
   Sanskrit glyph, tiny, centered. Silence makes the next beat land. (Cula's whitespace, our darkness.)
10. **Reduce, then reduce again.** Any element that survives only because it's pretty — cut.

## 2. Typography system (locked)
| Role | Font | Size | Rules |
|---|---|---|---|
| Display (titles) | Space Grotesk 600 | `clamp(2.2rem, 5vw, 4.2rem)`, lh 1.04, ls −0.025em | masked line-reveal only; never fades |
| Eyebrow | JetBrains Mono | 11px, ls 0.22em, uppercase | element color; appears BEFORE title (300ms lead) |
| Shloka | Inter italic | `clamp(12px, 1.15vw, 13.5px)`, lh 1.55, #9aa6c4 | citation chip in element color |
| Body | Inter 400 | `clamp(14px, 1.3vw, 17px)`, lh 1.65, #aab4cc | max 62ch; one paragraph per beat, never two |
| Numerals/rail | JetBrains Mono | 10–11px | scene numbers `01–07`, Devanagari rail labels |

## 3. Color discipline
- Constants: obsidian `#04060a→#0a0e16` (radial, never flat), gold `#f5b572` (the charioteer's light).
- Element accents (only one live at a time): Akasha `#c5b3ff` · Vayu `#7fd4f0` · Agni `#ff9e5e`
  · Apas `#2ec4b6` · Prithvi `#d9b26a` · Balance `#ffdeba`.
- The page's ambient tint crossfades to the active element over 1200ms linear-scrub (already
  accent-driven halos; extend to the bg radial).
- Grain 0.35 constant; god-rays only where the figure is; pure black only in breaths.

## 4. Page architecture (the walk)
```
00 GATE (100vh)            — the charioteer; intro video slot; invocation copy; CTA
   breath (40vh)           — आकाश glyph alone
01 AKASHA (130vh scroll)   — space · Hermes/the Record
   breath                  — वायु
02 VAYU (130vh)            — air · Form Coach
   breath                  — अग्नि
03 AGNI (130vh)            — fire · Fuel
   breath                  — आपस्
04 APAS (160vh) ★          — water · Readiness · armor→heart (longest, the centerpiece)
   breath                  — पृथ्वी
05 PRITHVI (130vh)         — earth · the Twin
   breath                  — (five tiny glyphs converging)
06 BALANCE (140vh)         — five lights align → CTA
07 PROOF (100vh)           — "the engine is real": 3 product cards (Cula's move) —
                             live app clips: Form Coach counting reps · Twin growing ·
                             readiness ring filling. Myth above, receipts below.
08 FINAL CTA + footer      — "Meet your Twin" · minimal footer
```
The 130vh chapters give scroll *time*: content pins ~centered while progress drives choreography.

## 5. Scroll choreography (per chapter — the control spec)
Progress `p ∈ [0,1]` per chapter; scrubbed values linear, reveals sprung:
| p | What happens (in order — never simultaneous) |
|---|---|
| 0.00–0.15 | ambient tint begins shifting to element color; figure fades up from 0.18 (scrub) |
| 0.15–0.25 | element VFX seeds in at low intensity (motes/streaks/embers/ripples/dust) |
| 0.25 | accent rule draws (700ms walk-ease) → eyebrow rises (spring, +300ms) |
| 0.32 | title mask-reveal, line by line (springs, 110ms stagger) |
| 0.42 | shloka fades up (400ms) — a beat AFTER the title lands (reverence = a pause) |
| 0.50 | body paragraph rises (spring); element VFX reaches full; previous beat's residue fully gone |
| 0.50–0.85 | HOLD. Nothing new enters. Figure parallax + VFX breathe. The viewer *reads*. |
| 0.85–1.00 | copy dims to 0.35 and drifts up 24px (scrub); tint hands off to next element |
Reverse-scroll plays it backward. APAS adds: at p 0.5–0.7 the vault-core bloom intensifies
heartbeat-synced (existing `.st-core`), ripple rings at each pulse.

## 6. Attention flow (the eye-path contract)
Every chapter: eye enters at figure (light) → accent rule pulls to copy block → eyebrow → title
→ shloka → body → (nothing else exists) → figure again as VFX peaks → scroll. Achieved by:
brightness order (figure 1.0, title 0.96, body 0.62, everything else ≤0.4), one-accent law,
and dimming-the-past (previous chapter's copy at 0.35 before the next begins).

## 7. Asset manifest (what Varun provides — I integrate)
| Asset | Spec | Beat |
|---|---|---|
| `scene-1-gate.mp4` | 6s loopable, master pushed-in, halo breathing | Gate intro/bg |
| `scene-2-akasha.mp4` … `scene-6-prithvi.mp4` | 5–8s each, 16:9 + 9:16, per v3 prompts (element VFX in-shot) | chapters |
| `scene-7-balance.mp4` | 8s, five lights align → open hand | finale |
| Poster stills | 1 per scene, webp ≤250KB | instant paint + reduced-motion |
| **Proof clips ×3** | screen-recordings: Form Coach live rep-count · Twin morph · readiness ring; 4–6s loops, 4:5 crop | PROOF band |
| Budget | ≤800KB/clip target (≤1.5MB hard), lazy-loaded, posters-first | all |

## 8. Engineering phases
- **P1 — The Control Pass (no assets needed):** timing/easing tokens unified; chapter heights
  130vh + pin; the p-timeline choreography (replace threshold IO with progress-driven sequence);
  breaths with glyphs; ambient tint crossfade; dim-the-past; hold-zone. *This alone gets 80% of
  the Cula feel with current stills.*
- **P2 — PROOF band:** 3 product cards, Cula-style, with placeholder posters until clips land.
- **P3 — Scene videos:** drop-in per chapter (slots exist), scrub-or-play tuning per clip.
- **P4 — Finale alignment VFX** (five lights converge) + final perf/a11y pass.
- Budgets hold: 60fps on 2020 hardware, LCP <2.5s, initial <4MB, reduced-motion = full static story.

## 9. Definition of "landed"
A first-time visitor scrolls once, never confused about where to look, feels walked-through,
can retell the five elements, believes the product is real (PROOF band), and clicks the CTA —
and a designer screenshots any random viewport and finds zero violations of the Ten Laws.
