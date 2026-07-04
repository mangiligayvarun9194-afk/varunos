# सारथि — THE TWIN ECONOMY · Master Plan v1
*How the avatar becomes a business: true-size fashion try-on, a living companion, and a
weather-real world. Founder's vision (Varun) + market research + build architecture.*

---

## 1 · THE VISION (the founder's dream, stated plainly)
> "I used to dream: if I had a great physique, I'd try clothes on characters like that."

That dream IS the product: **your Twin wears your real measurements** — waist, chest, inseam,
everything — and as you train, the Twin's body changes with yours. You try clothes on the body
you HAVE, and on the body you're BUILDING. When you arrive, the clothes are waiting.

**The one-liner:** *Every fitness app shows you numbers. Sarathi shows you the person you're
becoming — and dresses him.*

## 2 · WHY THIS WINS (validated market facts)
| Fact | Source |
|---|---|
| Virtual try-on market: **$12.1B (2025) → $15.3B (2026)**, ~26.5% CAGR → ~$39B by 2030 | Business Research Co. |
| Walmart **acquired Zeekit** to own this; their try-on cut returns **36%**, conversion ~20% | TechCrunch / Walmart |
| 3DLOOK case study: **47% fewer size-related returns**, 4× conversion, +30% AOV | 3DLOOK/PRWeb |
| ZEPETO: **123M avatar items sold per MONTH**; 2.5B+ items total; Gucci & Nike drops sell out; Walmart now sells **physical** goods through avatars | GEEIQ / DRESSX |
| **92%** of avatar users say avatar style matters; **64%** say it influences real-life purchases | ZEPETO research |

**Our unfair advantage (nobody in that list has it):** their avatars are static photos or
fantasy dolls. **Ours is a coach-verified, continuously-updated body** — the only avatar on
earth that gets *more accurate every week the user trains.* Fit data + progress data + intent
data (goals) = the most commercially valuable fitness profile that exists. *(Consistent with
our data stance: the record is power — no privacy-first marketing constraints.)*

## 3 · THE FOUR PILLARS

### P1 — THE TRUE-SIZE TWIN (foundation)
Your Twin, your dimensions.
- **Capture:** guided manual entry (waist/chest/hip/inseam/shoulder/height/weight) → later
  photo-based estimation (2 photos → measurements, 3DLOOK-style); wearable weight sync.
- **Body engine:** parametric humanoid (blend-shape morphs per measurement) — the master
  charioteer aesthetic applied to YOUR proportions. Every logged workout/weight nudges the morphs.
- **The Becoming slider:** drag between *today-you* → *goal-you* (coach-projected, honest
  ranges). This is the founder's dream feature and the emotional core.

### P2 — TWIN FASHION (the money)
- **True-fit try-on:** garments draped on your exact avatar; size recommended per brand's chart.
- **Goal-Fit Commerce** ★ our invention: try the shirt on *goal-you*; the app tells you
  "8 weeks at current pace." Buy it as a commitment, or one tap when you arrive. Motivation and
  commerce fused — no retailer can copy this without being a coach.
- **Revenue:** affiliate/commission on fitness & streetwear (8–20% typical), branded drops
  (ZEPETO model: limited digital+physical pairs), sponsored challenges ("earn the jacket").
- **India wedge:** ethnic + gym-wear brands first; sizes are notoriously inconsistent → true-fit
  solves a real Indian e-commerce pain (COD returns).

### P3 — THE LIVING TWIN (retention)
The Twin is a companion, not a statue — **event-driven rigged animations**:
| App event | Twin animation |
|---|---|
| App open | greeting gesture (namaste / nod / stretch, time-of-day aware) |
| Meal logged | **eats that meal type** (bowl, plate, fruit — mapped to meal category) |
| Protein logged | **shaker-bottle shake + drink** (the founder's exact spec) |
| Workout done | lift celebration, towel wipe, flex matched to muscle group trained |
| Readiness low / sleep logged | yawn, meditate, sit in rest |
| Streak milestone | element-armor flourish (see Kavach below) |
- Build: a library of ~12 rigged clips on the parametric rig (Kling/Meshy generation → cleanup,
  or one animator contract), triggered by the app's existing event bus (log endpoints already exist).

### P4 — THE LIVING WORLD (delight)
The Twin's chamber mirrors the user's reality:
- **Weather-true:** user location → free weather API (Open-Meteo) → environment preset:
  **snowfall, rainfall, scorching heat-haze**, fog, clear night. *Our particle engine already
  renders snow/rain/embers/dust — this is largely built.*
- **Time-true:** dawn/day/dusk/night lighting on the obsidian stage.
- **Season/festival touches:** Diwali diyas, monsoon, winter — India-first delight.

### + KAVACH (the element-armor economy — ties the brand to the business)
Earned cosmetics, not just bought: maintain the five elements in balance → unlock **element
armor pieces** (Akasha crown, Vayu wind-cape, Agni greaves, Apas core-gem, Prithvi gauntlets).
Full set = the Ascended Twin. Sellable premium skins later — ZEPETO proves avatar cosmetics
print money; ours are EARNED by health, which no fashion platform can claim.

## 4 · ARCHITECTURE (honest build path)
1. **Measurement schema + UI** (DB + Settings flow) — pure code, ships now.
2. **Parametric morphs** on the existing Twin GLB (twinSkin.js already maps muscle groups;
   extend with measurement-driven blend shapes) — hard but in-house skill exists.
3. **Weather world** — Open-Meteo fetch + map to existing particle/lighting presets — 1–2 days.
4. **Animation library** — generate/rig 12 clips (Kling credits or ~$500 animator) → event bus.
5. **Try-on v1** — start with **2D true-scale overlay** (garment images scaled to avatar
   proportions + size-chart engine) → partner catalog; graduate to 3D cloth later.
6. **Commerce** — affiliate links first (zero integration), then 1 brand pilot (gym-wear,
   India), then drops.

## 5 · REVENUE LADDER (sequenced, each step funds the next)
1. Affiliate commissions (month 1 of P2) → 2. Size-recommendation pilot with one brand
(returns-reduction pitch: the 3DLOOK numbers ARE the sales deck) → 3. Branded drops + sponsored
challenges → 4. Premium Kavach cosmetics + Twin customization → 5. Fit-intelligence API for
brands (aggregate, consented).

## 6 · ROADMAP
- **Phase T1 (weeks 1–2):** measurements + morphing Twin + weather world + 3 core animations
  (greet, meal, shaker). *Demo-able to investors immediately.*
- **Phase T2 (month 2):** full animation library, Becoming slider, affiliate closet v1.
- **Phase T3 (month 3–4):** brand pilot (true-fit + returns metrics), Kavach earning system.
- **Phase T4 (month 6+):** drops, goal-fit commerce, fit-API.

## 7 · KPIs & RISKS
- KPIs: avatar-setup completion %, D30 retention lift vs non-avatar users, try-on→purchase CVR,
  affiliate revenue/user, animation-interaction rate.
- Risks: 3D cloth physics is hard → start 2D-true-scale (Zeekit itself was 2D!); measurement
  friction → photo-estimate later, manual first; brand sales cycles → affiliate needs no
  permission; avatar uncanny valley → keep the neo-mythic stylization, not photoreal skin.

## 8 · Sources
Business Research Co. (VTO market) · TechCrunch/Walmart (Zeekit) · 3DLOOK YourFit case study ·
GEEIQ/DRESSX (ZEPETO commerce) · ZEPETO brand research (92%/64% stats).
