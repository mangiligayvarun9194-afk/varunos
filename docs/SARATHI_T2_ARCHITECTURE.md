# सारथि — T2 · THE EMOTIONAL LOOP (Investor Module) — build spec
*The loop: measurements → Twin changes → workout logged → Twin reacts → progress visible →
(try-on intent). Everything deterministic, tested, per-user isolated, wellness-framed (никогда
diagnosis). Conventions unchanged: JSX + inline styles, pure cores + tests, existing auth idiom.*

## The loop, mapped to modules
```
Settings measurements ──▶ /v1/twin/measurements {morphs, goal_morphs}   (A extends)
        │                                   │
        ▼                                   ▼
   Twin rig morph (T1, live)      BECOMING slider (lerp today→goal)     (B lib + architect wires)
        │                                   │
 workout logged ──▶ Twin REACTS (celebrate clip) · app open ──▶ greeting · protein ──▶ shaker (B clips)
        │
        ▼
 TryOn v0: 8 gymwear items → fits-today / fits-goal / size  (A engine + C panel)
        │
        ▼
 Investor dashboard (#investors): body history, workouts, level, retention, try-on intent (A metrics + C screen)
```

## Contracts
**C1 · Goal measurements (pure, deterministic).** `derive_goal_measurements(m, goal)` where
goal ∈ cut|recomp|lean_bulk|bulk (default recomp). Multipliers (then clamped to validation
ranges): cut: waist×.92 hip×.96 weight×.92 · recomp: waist×.94 chest×1.04 shoulder×1.03 ·
lean_bulk: chest×1.06 shoulder×1.05 sleeve×1.04 waist×.98 · bulk: chest×1.08 shoulder×1.06
waist×1.02 weight×1.08. Untouched fields pass through. `goal_morphs = derive_morphs(goal_m)`.
GET /v1/twin/measurements response gains `goal_morphs` (goal from stored profile if present,
else recomp; optional `?goal=` override).

**C2 · Becoming lerp (client, pure).** `lerpMorphs(today, goal, t)` per-key linear, t∈[0,1];
missing keys → 1.0. `becomingLabel(t)` → "today" | "the road" | "goal-you".

**C3 · Living clips (client, pure data).** Semantic pose functions, NO three.js:
`clipGreeting()`, `clipCelebrate()`, `clipShake()` each → `{ duration, loop, poseAt(t01) }`
returning `{ head, spine, hips, lArm, rArm, lForeArm, rForeArm, lLeg, rLeg }` with per-part
`{rx, ry, rz}` radians (≤0.9 rad, smooth: poseAt(0)≈poseAt(1) when loop). Greeting = namaste
bow (4s, once); celebrate = double fist-raise + hop (2.6s, once); shake = right hand raises
shaker to chest, rhythmic 3-shake, drink tilt (5s, once). Tests assert continuity, bounds,
determinism. The architect maps semantic parts → actual rig bones in Twin.jsx (which already
owns a procedural engine + bone lookups).

**C4 · Try-on engine (backend, pure).** `varunos/core/tryon.py`: CATALOG of 8 gymwear items
(id, name, kind tee|tank|hoodie|joggers|shorts, price_inr, sizes S–XXL with chest[lo,hi] for
tops / waist[lo,hi] for bottoms — realistic Indian gymwear charts). `fit_item(item, m)` →
`{size|null, verdict 'true'|'size_up'|'size_down'|'no_fit'|'need_measurements'}` (smallest size
containing the governing measurement; nearest-size verdicts). `fit_catalog(m, goal_m)` → per
item `{..., today: fit, goal: fit}`. Endpoints: GET /v1/tryon/catalog → fits for current user
(today + goal). POST /v1/tryon/intent {item_id, size, mode:'today'|'goal'} → stored
(tryon_intents table: user, item, size, mode, ts) → {ok}. Both auth'd.

**C5 · Investor metrics (backend).** GET /v1/metrics/investor (auth) →
`{users_total, measurements_set, workouts_total, workouts_7d, avg_twin_level,
tryon_intents_total, tryon_intents_7d, measurement_history_points, generated_at}` — computed
ONLY from tables that exist (inspect db; anything unavailable returns 0 with a `notes` list —
honest metrics, no fabrication). Plus `series`: last-8-weeks workout counts for a bar chart.

**C6 · Dashboard + panel (frontend, new files only).** `TryOnPanel.jsx` (props: none; fetches
catalog; garment cards in house style: name/kind/price, "Today: M · true to size", "Goal-you:
L", intent button "I'd buy this" → POST intent, toast). `InvestorDashboard.jsx` (#investors):
obsidian stat cards (users, workouts, intents, avg level), SVG bar chart of weekly workouts,
measurement-history sparkline per field (GET history via measurements endpoint if exposed,
else omit), retention note, all real API data with graceful zeros. No new deps, no chart libs.

## Workstreams (locked territories)
| | Warrior | Creates | Modifies | Must NOT touch |
|---|---|---|---|---|
| A | Backend | core/tryon.py · tests/test_tryon.py | core/twinbody.py (+goal fns, +tests in test_twinbody.py) · db (tryon_intents + history getter) · server.py (goal_morphs, catalog, intent, metrics) | web/ |
| B | Motion | web/src/lib/becoming.js · web/src/lib/twinacts.js · web/test/becoming.test.mjs · web/test/twinacts.test.mjs | — (may READ Twin.jsx) | all screens, varunos/ |
| C | Product-UI | web/src/screens/TryOnPanel.jsx · web/src/screens/InvestorDashboard.jsx | — | all existing files, varunos/ |
| 🏛 | Architect | — | Twin.jsx (slider, clips, panel mount, workout-react hook) · main.jsx (#investors) | — |

## Guardrails (from the council)
- Wellness language only: "readiness", "recovery", "balance" — never diagnosis/treatment.
- No deity likeness claims; the character remains an original sacred-tech guardian.
- History already versioned (T1); `body_state_snapshot` deferred to T3 (noted, not built).
- Determinism everywhere; every formula tested; no network in pure cores.

## Acceptance
A: pytest green (incl. full suite), goal vectors pinned; C4 fits verified against chart edges.
B: node tests green; clips continuous/bounded; lerp exact. C: esbuild compile + house style.
Architect: the LOOP demos end-to-end — enter measurements → Twin reshapes → drag Becoming →
body morphs live → log workout → Twin celebrates → dashboard counts it → try-on shows sizes.
