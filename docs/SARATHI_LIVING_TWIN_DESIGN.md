# SARATHI — THE LIVING TWIN · VFX & Motion Design
### The Twin as a companion: greetings, co-training, sweat, reminders, medication rituals, and phone-surface presence
Status: DESIGN v1.0 — art direction LOCKED by Varun (2026-07-16); build awaits go. 

---

## ART DIRECTION — LOCKED (Varun, 2026-07-16)

**The Living Twin is the stylized-CGI companion character from Varun's concept boards** — soft rounded forms, large expressive eyes, warm friendly proportions, simple athletic wear (blue tank, orange shorts), high squash-and-stretch tolerance. This is the character on every product surface: in-app Twin stage, rituals, co-training, widgets, notifications.

**Two-world brand architecture (keeps the soul whole):**
- **The Legend — the photoreal charioteer:** the myth. Trailer, homepage film, story chapters, investor deck. He is the epic *about* the product.
- **The Companion — the stylized Twin:** the product. He is the friend *inside* it — the one who greets you, trains with you, sweats with you, and taps his wrist about your medicine.
- Narrative bridge (one line, used everywhere): *the charioteer's spirit lives on in your Twin.* Same five centres, same gold accent language, same element colors — the two forms share a soul, not a silhouette.

**Asset pipeline for the new companion (proven route):**
1. Character identity locked from Varun's board renders (front-facing hero pose as master reference).
2. Image→3D with rigging (Meshy pipeline, as with twin-custom.glb) → `web/public/models/companion.glb`; verify twist-bone situation per Craft Book §1.2 before authoring clips.
3. Bake the ritual/greeting clip set (Meshy presets: `Wave_One_Hand`, `Stand_and_Drink`, workout loops) onto the new rig; marketplace bench-press clip retargeted offline.
4. Widget/notification pose PNGs rendered from this model (the boards' poses become the shot list: drinking, stretching, flexing, towel-wipe, ok-sign, pointing-at-watch).
5. Body-mirror morphs: the existing measurement→boneScales system carries over — stylized proportions still reflect *relative* change honestly (broader shoulders, tighter waist), which is the emotional job of the mirror.

**Design note (flagged for Varun, his call):** the board character reads young. For an adult health product carrying medication reminders, a *young-adult* companion (same style, slightly matured proportions) may age better with the audience — decide at model-generation time.

## PHONE-SURFACE UX SPEC v2 (from Varun's boards — now canonical)
Widget inventory: **Water Meter** (ritual pose + fill bar), **Posture Coach** (stretch pose + nudge line), **Streak Keeper** (flex pose + week bars), **Medication Due** (wrist-tap pose + Take/Snooze), **Meal Feedback** (satisfaction gesture post-log), **Post-Workout** (towel-wipe pose + recovery line). Notification anatomy: character pose image + one-line copy + up to two actions (Take/Snooze, Log/Later) — actions on Android web push today, both platforms under the Tier-1 native wrapper (native iOS notifications support images + action buttons; only *web* push is text-only on iOS). All surfaces draw from the same TwinMind pose state machine.

---

## 0 · Design philosophy (the motion director's law)

A character feels ALIVE when three things are true:
1. **It notices you** — it reacts to *your* arrival, *your* actions, *your* time of day. Never on a loop.
2. **It has a body budget** — it breathes, shifts weight, blinks its glow; it is never frozen, and never hyperactive.
3. **It earns its big moments** — grand animations (celebration, co-training) are triggered by real user events, so every performance means something. A Twin that dances at random is a screensaver; a Twin that racks the bar *because you logged a set* is a companion.

Everything below obeys the standing invariants: honest data only (the Twin performs only for real events), privacy gate untouched, wellness-not-medical framing for medication, pure logic in `core/`, all visuals reuse the proven Twin pipeline (Meshy-rigged GLB + baked clips + procedural rig + foot-lock).

## 1 · TWINMIND — the behavior brain (new, pure)

One state machine decides at every moment what the Twin is doing. No animation ever fires without TwinMind's say-so — this is what prevents the "random screensaver" failure.

```
core (pure, tested):  twinmind.decide(context) -> Performance | null
context = { time_of_day, last_seen_at, pending_reminders[], live_workout?,
            recent_events[], readiness_color, centres, quiet }
```

**Priority ladder (highest wins, one performance at a time):**
1. LIVE CO-TRAINING (user is mid-workout in the app)
2. EVENT PERFORMANCE (user just logged something → react NOW)
3. REMINDER RITUAL (a due reminder from the proactive engine)
4. ARRIVAL GREETING (first open of the day > returning-today wave)
5. AMBIENT LIFE (breath, weight shifts, glow — the idle floor, always on)

Frontend: `web/src/lib/twinmind.js` (pure, node-tested) + the existing `playGesture` runtime in Twin.jsx as the actor. TwinMind consumes T4's `plan_nudges` output — **the Living Twin is the third delivery channel** of the proactive engine (in-app performance, alongside Telegram + push).

## 2 · THE PERFORMANCE INVENTORY (motion design)

Naming: `perf.<family>.<variant>`. Each entry: trigger → motion spec → source (existing / bake / procedural) → duration. All end back in the idle pose (neutral hands, feet locked).

### Family A — ARRIVAL (it notices you)
| Perf | Trigger | Motion | Source |
|---|---|---|---|
| `arrival.dawn` | first open 04–12h | slow head raise → open-palm namaste bow → chest glow warms | exists (greeting gesture) + new namaste variant |
| `arrival.day` | first open 12–18h | raised-hand wave + slight bow | greeting variant |
| `arrival.dusk` | first open 18–04h | calm nod, aura dims to ember, slower breath | procedural (existing rig offsets) |
| `arrival.return` | re-open same day | quick glance + small nod (0.8s — never the full greeting twice) | procedural |
| `arrival.streak` | first open, streak ≥7d | wave → flex → the streak count pulses on aura | greeting + flex bake |

### Family B — CO-TRAINING (the Twin works out WITH you)
The Twin mirrors the exercise the user is logging/coaching, **in training clothes, sweating progressively**.
| Perf | Trigger | Motion | Source |
|---|---|---|---|
| `train.squat` | set in progress (squat family) | air squat loop, tempo synced to logged rep cadence | exists (mocap-air_squat.glb) |
| `train.curl` | curl family | bicep curl loop, bar/dumbbell FK in hands | exists (mocap-bicep_curl + bar FK) |
| `train.deadlift/row/press` | those families | procedural rep engine (proven, bar-in-hands) | exists |
| `train.bench` | bench family | **side-view bench station**: camera orbits to profile, bench prop mesh, lying press via procedural arms + bar FK | NEW — hardest perf, needs bench prop + lying pose; prone framing risk known from push-up clip |
| `train.rest` | between sets | towel wipe or bottle sip, heavier breath | bake/procedural |
| `train.pr` | PR detected | bar drop → arms up roar → aura shockwave (reuse level-up VFX) | celebration exists + variant |

**Sweat system (VFX, see cookbook §5):** sweat intensity = f(set count, session duration) — builds across the session, fades in rest, gone after cooldown. Never during greetings.

### Family C — REMINDER RITUALS (the Twin *demonstrates*, never nags)
The design law: the Twin performs the action it wants you to take.
| Perf | Trigger (from proactive engine) | Motion |
|---|---|---|
| `ritual.hydrate` | hydration reminder due | picks up bottle, drinks, exhales; water-blue aura ripple (adapts existing protein-shake gesture) |
| `ritual.meal` | meal window passed unlogged | bowl appears in hands, offering-to-fire motion toward chest ember, then eating beat |
| `ritual.medication` | med schedule due | **the med ritual**: small glowing pill-case appears in palm, Twin takes it with water sip, then a slow bow — respectful, calm, never comic. Aura flashes the med's assigned color. Persistent until user confirms "taken" (Twin repeats a gentle palm-open reminder every N min within the window) |
| `ritual.sleep` | wind-down time | stretch, aura dims to ember, sits into meditation pose |
| `ritual.move` | long inactivity (day) | neck roll + shoulder stretch + beckoning gesture |

### Family D — EVENT REACTIONS (existing, kept)
Workout logged → celebration; protein logged → shake gesture (both live today via CustomEvents); meal logged → satisfied nod + fire-centre pulse; check-in done → readiness color washes the stage.

## 3 · THE MEDICATION FEATURE (new product surface, wellness-framed)

**Positioning (non-negotiable):** Sarathi reminds what the USER prescribed for themselves — it never advises, doses, or interprets. Copy always: "as you planned" / "your schedule", never "you should take".

- **Onboarding (Awakening act extension):** after the check-in act, one optional question: "Do you take any regular medicines or supplements you'd like Sarathi to remember?" → name (free text), times per day, time windows, optional color tag. Skippable in one tap.
- **Data:** `medications (user_id, name, dose_label, times_json, color, active)` + `med_log (user_id, med_id, date, slot, taken_at)` — the log is the honesty layer: streaks and "taken" states are real records, and it feeds the Vault like everything else.
- **Core (pure):** `core/meds.py` — `due_slots(meds, now, med_log) -> [DueMed]`, adherence streaks, quiet-hour respect. Plugs into `plan_nudges` (priority above meal reminders — health first) and into TwinMind for the ritual.
- **API:** CRUD `/v1/meds`, `POST /v1/meds/{id}/taken`.
- **UI:** meds card on Today (due slots as chips → tap = taken → Twin performs a thank-you bow); manager in Settings.
- **Privacy:** medication names are user-text — they live in the Vault under the user's ownership, are exportable/deletable, and are NEVER sent to the LLM voice layer (the privacy gate already excludes raw health specifics; med names join that excluded class — nudge templates are deterministic).

## 4 · PHONE-SURFACE PRESENCE (widgets & lock screen) — research-verified truth
**The hard truth first (set expectations before any mockup):** continuous character animation is impossible on every widget/lock-screen surface, on both platforms, via supported APIs — iOS widgets are timeline *snapshots* (transitions capped at 2s, 40–70 refreshes/day budget), Android RemoteViews forbids GIF/Lottie/video, and a pure PWA gets **no widget at all** on either OS. iOS push notifications are **text + icon only** (no images). Sources in the research brief (Apple WidgetKit docs, Android RemoteViews reference, WebKit web-push notes).

**The winning pattern is the pose state machine** — the Duolingo model: ~25+ static poses of one living character keyed to time-of-day and state, swapped on OS schedule. Liveliness comes from *state variety and reactivity*, not video. Our Twin renders those poses **from the user's own model** — a personalization no competitor's mascot can match.

- **Tier 0 — pure PWA, ships now (days):** the fully animated Twin lives in-app; outside it: web push (Android carries Twin still images + action buttons; iOS text-only with `setAppBadge` counts), character-voiced notification copy, resubscribe-on-open safeguard.
- **Tier 1 — Capacitor native wrapper (a real 2–4 week project, not a plugin):** WidgetKit (iOS) + Glance (Android) home-screen widgets fed pre-rendered Twin pose PNGs via a shared-storage bridge (`capacitor-widget-bridge` / `@capgo/capacitor-widget-kit`); pose picked by the same TwinMind state machine (time-of-day, streak risk, next due ritual). Android bonus: a sanctioned ViewFlipper 2–8 frame breathing loop. Pixel lock-screen presence comes free (Android 16 QPR2+); **Samsung One UI 7 does not render third-party lock-screen widgets** — a large slice of the India market sees home-screen only.
- **Tier 2 — workout liveness (+1–2 weeks):** iOS **Live Activity** during sessions (Twin pose per exercise + 1Hz system timer + set count — the proven fitness-app pattern); Android foreground-service widget with fast frame updates while a session runs (the one place near-real animation is legal).
- **Tier 3 — horizon bet:** Android Remote Compose (alpha) is explicitly bringing real animation to widgets on Android 16+. Because our widget content is already a pose state machine, adopting it later is an enhancement, not a rebuild.

## 5 · VFX COOKBOOK (sweat, clothes, ambient life) — research-verified techniques

**Sweat / wet skin (physically grounded, tiered):** wetness is a *material* change first, droplets second. Real wet-surface physics: darken albedo ~0.3–0.5× AND lower roughness toward 0.1–0.3, together, masked by a wetness map.
- **Base tier (every phone):** one `wetness` uniform injected into `MeshStandardMaterial` via `onBeforeCompile` — lerps albedo darker + roughness down, masked by a slow scrolling noise texture. One extra texture fetch; convincing on its own.
- **Trickle layer (mid tier):** droplet normal-map trails scrolled *downward in world space* (character UVs aren't gravity-aligned) + a high-contrast scrolling mask over a static droplet normal map so drops pop in and out — all fragment shader, zero particles.
- **High tier (flagship/desktop only):** `MeshPhysicalMaterial` clearcoat + clearcoat roughness/normal maps (needs envMap; expensive — device-gated).
- **Forbidden:** `DecalGeometry` sweat on a deforming skinned mesh (cannot re-project per frame); GPU droplet particles below high tier — reserve for brief "hero drip" beats.
- The single **`exertion` state variable drives sweat uniform AND breath amplitude AND animation weight** — one number keeps material, motion, and sound-of-breath coherent.

**Training clothes (outfit swap on the rigged mesh):**
- Garments authored on the **identical skeleton** (same bone names) as the body; body + garments driven by **one `AnimationMixer` via `AnimationObjectGroup`** (the verified pattern — manual `SkinnedMesh.bind` sharing is unreliable).
- **Preload all garments, toggle `.visible`** (mid-animation lazy loads glitch); poke-through solved per-pixel with a body-part-ID mask + fragment `discard` under clothing (the gltf-avatar architecture) — no geometry surgery.
- Budget: body + 2–3 garment draws max, cloned materials, atlased textures. Cheapest variants: texture/material recolors of one garment set.
- `attire.default` (armor-lite) ↔ `attire.gym` (tee/shorts from the try-on catalog) with a 0.4s dissolve on workout start/end — co-training doubles as a **living try-on ad**; the gym clothes ARE catalog items.

**Ambient life floor (the never-frozen rule):**
- **Additive animation layering** (`AnimationUtils.makeClipAdditive`) stacks an organic sway clip on top of ANY base performance at adjustable weight, plus a near-free procedural sine on the chest bone for breath (calm ~0.25Hz → panting with exertion), a second non-harmonic slow sine for weight shift (kills the loop tell), aura flicker keyed to readiness color.
- Idle budget ≤2ms/frame on mobile; material tier ladder (Standard floor, Physical only device-gated).

## 5b · ANIMATION CLIP SUPPLY (research-verified)
- **Golden rule: never retarget at runtime.** `SkeletonUtils.retarget` on arbitrary rigs produces inverted feet/backward hands (documented, and matches our own Meshy-rig history). All retargeting happens **offline in Blender**, baked onto our one skeleton, shipped as a single GLB clip bank; runtime uses `subclip` + additive layering only.
- **Primary source — Meshy preset library (our rig natively, zero retarget risk):** `Wave_One_Hand` / `Big_Wave_Hello` (greetings ✓), `Stand_and_Drink` (hydration ritual ✓), plus the workout presets we already baked. **Bench press: not found in the library (verify in-app)** — plan for it from a marketplace barbell pack (~$15–40 one-time, 50 barbell motions incl. 3 bench variants, offline-retargeted).
- Fallbacks: Mixamo (free, commercial-OK, offline-converted; no gym lifts), CMU/CC0 libraries for filler idles. Verify Meshy preset export licensing for shipped-app redistribution before committing the full catalog.
- Realistic clip budget: **Meshy plan + <$50 marketplace** for the entire performance inventory.

## 6 · Territory map & build order — after approval
- L1 `web/src/lib/twinmind.js` + tests · L2 `core/meds.py` + tests · L3 db+api meds · L4 perf clips (bake list + procedural variants) · L5 sweat/attire VFX in Twin stage · L6 Awakening med act + Today med card · L7 notification stills pipeline · L8 (native wrapper — separate epic, research-gated)
- Sequence: TwinMind + rituals on existing gestures ship first (1 week, zero new deps) → meds feature (week 2) → sweat/attire VFX (week 2–3) → surfaces per research tiers.

## 7 · Honest risks
1. **Bench press staging** — prone poses framed poorly before (push-up clip dropped); the side-view bench station is a real scene-design problem, prototype before promising.
2. **Reminder fatigue** — every ritual obeys the proactive engine's honesty gate + quiet hours + max-2-per-day; the Twin demonstrating beats push-spam, but only if rare enough to stay special.
3. **Lock-screen animation is capped by the OS** — see truth table; we design for stills-with-state, not video, on those surfaces.
4. **Battery/perf** — ambient life budget enforced; sweat particles capped; widgets refresh on OS schedule, never polling.
