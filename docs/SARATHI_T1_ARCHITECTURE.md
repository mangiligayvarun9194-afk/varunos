# सारथि — TWIN ECONOMY · PHASE T1 ARCHITECTURE (build spec)
*The founding phase of the Twin Economy: True-Size measurements → morphing Twin → weather-true
world. Three parallel workstreams with locked contracts; the architect (main session) owns
integration. Conventions: JSX + inline styles (no TS/Tailwind), pure-core modules with tests
(pytest for python, node .test.mjs for web), per-user auth isolation as in existing endpoints.*

## System overview
```
 Settings UI ──PUT /v1/twin/measurements──▶ FastAPI ──▶ core/twinbody.py (pure)
     │                                        │              validate + derive_morphs
     │◀────────── {measurements, morphs} ◀────┘              store + history append
     ▼
 twinmorph.js (pure, client mirror) ──▶ bone-scale map ──▶ Twin 3D rig (integration: architect)
 weatherworld.js (pure) ◀── Open-Meteo (no key) ◀── geolocation (graceful fallback)
     └──▶ preset {mode,night,tint,intensity} ──▶ WeatherBackdrop canvas (self-contained)
```

## Contract 1 — Measurements JSON (canonical, cm/kg floats, all optional)
`{ height_cm, weight_kg, chest_cm, waist_cm, hip_cm, shoulder_cm, inseam_cm, sleeve_cm, neck_cm }`
Plausibility ranges (validation): height 120–230 · weight 30–250 · chest 60–170 · waist 50–160 ·
hip 60–170 · shoulder 30–60 · inseam 50–110 · sleeve 40–80 · neck 25–55.

## Contract 2 — Morph dict (derived, deterministic)
`{ chest, waist, hips, shoulders, arms, legs, height }` — each **0.80–1.25**, 1.0 = baseline.
Baseline male anthropometry (fraction of height): chest .55 · waist .47 · hip .53 · shoulder
.259 · inseam .45 · sleeve .33. `morph_x = clamp(actual/(coef*height_cm), .8, 1.25)`;
`height = clamp(height_cm/175, .85, 1.15)`; waist additionally nudged by BMI:
`waist *= clamp(1 + (bmi-23)*0.01, .93, 1.12)` when weight present. Missing input → 1.0.
**Python and JS implementations MUST produce identical outputs (shared test vectors below).**
Test vectors: (175,70,100,80,95,45,79,58,38) → chest≈1.039 waist≈0.973(±bmi) hips≈1.024;
(160,None,88,…) etc. — each impl asserts 4 shared vectors to 3 decimals.

## Contract 3 — Weather preset
`{ mode: 'snow'|'rain'|'heat'|'fog'|'clear', night: bool, tint: '#hex', intensity: 0..1, label }`
WMO map: 71–77,85,86→snow · 51–67,80–82,95–99→rain (95+→intensity 1) · 45,48→fog ·
`temp≥38°C`→heat · else clear. night = `!is_day`. Tints: snow #a8c5e0 · rain #6f8cff ·
heat #ff9e5e · fog #8e9ab8 · clear-day #f5b572 · clear-night #c5b3ff.
API: `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current_weather=true`
(free, keyless). Geolocation denied/timeout → fallback preset from local hour (clear day/night).

## Workstreams (locked file boundaries)
| | Warrior | Creates | Modifies | Must NOT touch |
|---|---|---|---|---|
| A | Backend | `varunos/core/twinbody.py`, `varunos/tests/test_twinbody.py` | `varunos/db.py` (measurements CRUD + history), `varunos/api/server.py` (GET/PUT `/v1/twin/measurements`) | web/ |
| B | Morph-Front | `web/src/lib/twinmorph.js`, `web/test/twinmorph.test.mjs` | `web/src/screens/Settings.jsx` (Measurements sheet) | Twin.jsx, SarathiStory/Pitch, varunos/ |
| C | World | `web/src/lib/weatherworld.js`, `web/test/weatherworld.test.mjs`, `web/src/screens/WeatherBackdrop.jsx` | — | all existing screens, varunos/ |

## API spec (workstream A)
- `GET /v1/twin/measurements` → `{measurements: {...}|null, morphs: {...}, updated_at}` (auth user)
- `PUT /v1/twin/measurements` body = Contract 1 subset → validate (reject out-of-range with 422
  and per-field errors) → upsert current + append history row → return same shape as GET.
- Follow existing endpoint idioms in server.py (auth resolve, JSON errors, tests hit via TestClient).

## Bone-scale map (workstream B, pure)
`boneScalesFromMorphs(morphs, boneNames)` → `{ [boneName]: {x,y,z} }` by regex best-effort:
/spine2|chest/i→chest(x,z) · /hips|pelvis/i→waist+hips(x,z) · /shoulder|clavicle/i→shoulders(x) ·
/upperarm|forearm/i→arms(x,z) · /upleg|thigh|calf|leg/i→legs(x,z) · root/hips y→height.
Unknown rigs degrade gracefully (empty map). No three.js import — pure data in/out.

## Acceptance (phase T1 foundations)
1. `pytest varunos/tests/test_twinbody.py` green; endpoint isolation test (user A can't read B).
2. `node web/test/twinmorph.test.mjs` + `node web/test/weatherworld.test.mjs` green; shared
   vectors match python to 3 decimals.
3. `npm run build` clean. Settings shows the Measurements sheet, saves, reloads.
4. WeatherBackdrop renders each mode standalone (visual check by architect).
5. Integration (architect, after review): morphs → Twin rig; WeatherBackdrop behind Twin screen.
```
