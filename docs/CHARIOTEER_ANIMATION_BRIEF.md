# Charioteer — Animation Brief (gesturing character for the homepage tour)

**Goal:** make the Divine Charioteer on the homepage *physically gesture* per beat (point
to his head for Hermes, hand on heart for Readiness, present his hands for Form Coach,
touch his core for the Vault, a strong stance for the Twin, an ascended reveal for the
CTA). The current homepage already has the full **camera + lighting + scroll engine**
(`web/src/screens/GuidedTour.jsx`); the only missing piece is character motion. This brief
specifies exactly what to produce so it drops into that engine with a tiny code change.

The character is **original IP** (the user's "Divine Charioteer-Warrior"). Keep the design
consistent with the existing renders in `web/public/img/charioteer-hero.png` /
`charioteer-ascended.png` (obsidian armor, warm-gold halo + filigree, calm-powerful face).

---

## The 7 beats (must match `BEATS` in GuidedTour.jsx)
| # | Beat | Body part the camera frames | Gesture / pose to add | Accent |
|---|------|------------------------------|------------------------|--------|
| 0 | You are the chariot | full figure | calm idle, breathing, subtle weight shift | gold `#f5b572` |
| 1 | The mind · **Hermes** | head/face | raise a hand toward the temple / a glow at the brow | `#ffd9a8` |
| 2 | The heart · **Readiness** | chest | open palm over the heart; chest "pulses" with the readiness ring | `#5fd0bd` |
| 3 | The hands · **Form Coach** | arms/hands | present both hands forward, palms up (offering) | `#7fd4f0` |
| 4 | The core · **The Vault** | torso/core | one hand at the core; faint "vault" sigil ignites | `#4cc9f0` |
| 5 | The foundation · **The Twin** | legs | grounded power stance, slight lean, weight settling | `#f5b572` |
| 6 | Become (CTA) | full → ascended | rise / shoulders back, halo flares (ascended armor) | `#ffdeba` |

Idle motion (always on, all beats): slow breathing, a 6–7s float, micro head/cape sway.
Transitions between beats should be **scrub-driven** (tied to scroll progress 0..1), not
time-based, so they sync to the existing camera.

---

## Option A — Rive (recommended; true rig, data-bound)
Deliverable: **one `.riv` file** at `web/public/rive/charioteer.riv`.

- **Artboard:** `Charioteer`, ~1080×1600, transparent background.
- **State machine:** `Tour` with these inputs (the runtime sets them):
  - `progress` (Number 0..1) — scroll progress; blends the 7 beat poses along a 1D blend.
  - `readiness` (Number 0..100) — drives the heart-pulse intensity at beat 2 (optional).
  - `level` (Number) / `ascend` (Boolean) — triggers the ascended armor/halo at beat 6.
  - `reducedMotion` (Boolean) — when true, hold the beat-0 idle pose, no looping motion.
- **Layers:** body rig (bones), cape/cloth (secondary motion), halo (glow/scale), face
  (brow glow for Hermes), FX emitters left to the web layer (we already render embers).
- **Export:** runtime-ready `.riv` (not the editor file). Keep < ~400 KB.

Runtime integration (small, ~1 file): add `@rive-app/canvas` (MIT), mount a `<Rive>` in
`GuidedTour` in place of the `<img>` stack, and in the existing rAF loop set
`progress`/`readiness`/`ascend` inputs instead of the image transform. The camera,
spotlight, embers, panels, dots and CTA all stay exactly as they are.

## Option B — Pose sprite set (cheaper, no rig; works with today's engine)
Deliverable: **7 full-body renders** (one per beat above), same character + framing as the
current hero, each on a **transparent or solid near-black (#05070d)** background.

- Files: `web/public/img/charioteer-b0.webp … charioteer-b6.webp` (export PNG, we convert to
  WebP with `cwebp -q 82`; ~80–110 KB each).
- Specs: identical camera distance / crop / lighting across all 7 so they crossfade cleanly;
  ~912×1440; centered; consistent armor + halo; b6 = the ascended look.
- Integration (small code change): add a `pose` field to each entry in `BEATS`
  (`pose: '/img/charioteer-b1.webp'`), preload them, and crossfade to the active beat's pose
  by scroll proximity (mirrors how `hero`↔`ascended` already crossfade). The camera push-in,
  spotlight, reticle and narrative remain unchanged.
- **Cost (generate path):** the image MCP is 8 credits / 2k render → ~**56 credits** for 7
  poses (plus a couple retries). Today's balance is 8.18, so this needs a top-up first.

> Recommendation: **Option B first** (fastest visible win, drops into the current engine),
> then **Option A** later for buttery true motion + data binding.

---

## Acceptance criteria
- Gestures read clearly at each beat and sync to scroll (no time-drift).
- Character identity is consistent across all poses/states (same face, armor, halo).
- `prefers-reduced-motion` holds a single calm pose (no looping).
- Total added weight < ~800 KB (Rive) or < ~700 KB (7 WebP poses).
- No third-party or copyrighted characters — original IP only.

## Where it plugs in
- Engine: `web/src/screens/GuidedTour.jsx` — `BEATS[]` (add `pose`/Rive inputs), the rAF
  loop (set image src / Rive inputs), the image stack (swap to `<Rive>` for Option A).
- Assets: `web/public/img/charioteer-b*.webp` (B) or `web/public/rive/charioteer.riv` (A);
  both already served via the `/img` (and `/rive`) static mounts in
  `varunos/api/server.py` (the `/rive` mount is already in place — drop the `.riv` into
  `web/public/rive/` and rebuild; it serves at `/rive/charioteer.riv`).

---

## Artist handoff (Rive route)

**Style reference (send these with the brief):**
`web/public/img/charioteer-hero.png` and `charioteer-ascended.png` — match the face, obsidian
armor, gold halo + filigree, and proportions exactly. Original character; no other IP.

**Deliverable checklist for the artist:**
- [ ] `charioteer.riv` (runtime export), artboard `Charioteer`, transparent bg, < ~400 KB.
- [ ] State machine `Tour` with inputs: `progress` (Number 0–1), `readiness` (Number 0–100),
      `ascend` (Boolean), `reducedMotion` (Boolean).
- [ ] 7 keyed poses along `progress` (the table above), continuous (scrub-able), looping idle.
- [ ] `ascend` swaps to the ascended armor/halo (beat 6).
- [ ] `reducedMotion=true` holds a single calm pose.
- [ ] Source `.rev` file delivered too (for future edits).

**Where to source a Rive artist:** the Rive community Discord, Rive's "Hire" listings,
Toptal/Upwork/Contra (search "Rive animator"), or Dribbble/Behance "Rive" tag. Budget guide:
a single rigged, state-machine character like this is typically a few days of work.

## Drop-in integration (the day the `.riv` lands) — already scoped
Our side is prepped: `/rive` is served, and the brief maps 1:1 to `GuidedTour.jsx`. Steps:
1. `npm i @rive-app/react-canvas` (MIT).
2. In `GuidedTour.jsx`, replace the two `<img>` elements with the Rive canvas and read the
   inputs in the existing rAF loop (the camera transform code is removed; everything else —
   spotlight, reticle, embers, panels, dots, CTA, smoothing — stays):

```jsx
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
// inside GuidedTour():
const { rive, RiveComponent } = useRive({ src: '/rive/charioteer.riv', stateMachines: 'Tour', autoplay: true });
const progressIn = useStateMachineInput(rive, 'Tour', 'progress');
const ascendIn   = useStateMachineInput(rive, 'Tour', 'ascend');
// in the rAF frame(), instead of setCam(...):  if (progressIn) progressIn.value = cur;  if (ascendIn) ascendIn.value = ascend > 0.5;
// render: <RiveComponent style={{ position:'absolute', inset:0 }} />   // replaces the <img> stack
```
That's the whole runtime change — a single file, ~20 lines.
