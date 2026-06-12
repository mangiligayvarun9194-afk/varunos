# VarunOS v3 — Master Plan: "The Living Health OS"

*Written as: founder/CTO planning doc. Researched 2026-06-12. Design-first, implementation second.*

---

## The product thesis

VarunOS v2 proved the engine: deterministic readiness, insights, forecasting, privacy-gated Brain — 293 tests green, deployed. v3 makes it feel **alive**: data arrives by itself, the day greets you, the coach celebrates you, groceries buy themselves (with one tap), and a digital twin grows muscle alongside you.

Six epics. Each has a "ship cheap first, upgrade later" path — that's how we stay a one-person unicorn.

---

## EPIC 1 — Wearable Autopilot (n8n automation)

### Research findings
- **Optimal cloud-API sync window is 7–10 AM local**: overnight sleep/HRV data is processed and available by then for Oura/Fitbit/Whoop. Earlier polls often return incomplete data.
- Users sync late or nap — the system must **tolerate missing data** (retry, don't error).
- Apple Watch has no cloud API → the **iOS Shortcut bridge** (already built, `POST /v1/sync/wearable`) remains the Apple path. Trigger: alarm-dismissed or first-unlock automation, not fixed time — this matches "user availability" perfectly.
- Fitbit offers **webhook subscriptions** (push, not poll) — best-in-class when configured.

### The n8n design (per-user adaptive sync)
```
WF-20  wearable_poller        cron 07:30 local → for each connected provider:
                              pull sleep/HRV/RHR/steps → POST /v1/sync/wearable
                              (idempotent: dedup_key makes retries free)
WF-21  retry_ladder           if any metric missing → re-poll at 09:00, 11:00, 14:00
                              give up silently after 14:00, flag "partial day"
WF-22  fitbit_webhook_rx      webhook → instant ingest when Fitbit pushes
WF-23  post_sync_briefing     fires once after FIRST successful sync of the day:
                              readiness + today's workout + AQI → Telegram/push
WF-24  token_refresher        nightly: refresh OAuth tokens before expiry
WF-25  data_quality_sentinel  daily 15:00: 3+ days no sync → nudge user once
```
Key engineering decisions: **idempotent ingest** (already true via `dedup_key`), **briefing waits for data** (event-driven, not a blind 7 AM cron that reports stale numbers), and **per-provider adapters** behind one normalized payload.

---

## EPIC 2 — The Wake-Up Experience

When the user opens the app in the morning:
1. **Greeting header**: "Good morning, Varun" + readiness ring (already computed from auto-synced data — zero taps).
2. **Today's Workout card**: pulled from the active program (6 built-in programs exist), adjusted by readiness color (GREEN = as planned, YELLOW = -1 set, RED = swap to recovery).
3. **Workout window preference**: profile gains `workout_time_pref` (morning / evening / flexible). Briefing and reminders schedule around it. Evening users get a 16:30 "session starts soon" nudge instead of morning pressure.
4. **Custom plan upload**: `POST /v1/programs/custom` accepting:
   - structured JSON (documented template),
   - CSV (day, exercise, sets, reps, %1RM),
   - free text → parsed by the Brain into the JSON schema, user confirms before save.
   Custom plans live in the same `programs` format so the whole engine (PR detection, readiness adjustment) works on them unchanged.

---

## EPIC 3 — Trainer-Grade Logging + Motivation Engine + Login

### Logging like a personal trainer
- **Set-by-set flow**: tap exercise → previous session's numbers pre-filled ("beat this") → log set → auto rest-timer (90s/180s by lift type) → RPE via the existing effort words (Easy/Solid/Hard/Max).
- **Plate calculator**: shows which plates to load for the target weight.
- **Session summary**: total volume, e1RM per lift, vs-last-week delta.

### Motivation engine (deterministic, event-driven)
New core module `varunos/core/momentum.py`:
| Event | Trigger | Message style |
|---|---|---|
| PR | e1RM > all-time best | 🏆 celebration + confetti in PWA |
| Progress | volume or e1RM > last week same lift | 💪 "You put 5 kg on your squat vs last Tuesday" |
| Streak | N consecutive planned sessions done | 🔥 streak counter |
| Comeback | first session after 7+ day gap | "Welcome back — eased the plan for today" |
| Consistency | 4-week adherence ≥ 80% | weekly report highlight |
Events write to `health_event` (spine pattern), surface in-app instantly, and WF-26 `momentum_notifier` pushes the best one per day to Telegram. **Never more than one hype message a day** — scarcity keeps it meaningful.

### Login redesign
Single-user product → kill the pasted-API-key UX:
- **Device pairing**: first device shows a QR code; new device scans it → key transferred. Feels like WhatsApp Web.
- **Passkey-style PIN + biometric unlock** (WebAuthn where available) for the PWA.
- Beautiful first-run screen designed with the design system below.

---

## EPIC 4 — Grocery Autopilot

### Research findings (this shapes the whole design)
- **Instacart Developer Platform** is the real path: its API creates a **shopping-list page** from line items and returns a deep link — user clicks, picks store (Costco, Sam's Club, Kroger and most majors are ON Instacart), cart is pre-filled, user pays. Official, free, ToS-clean.
- **Walmart** has no public purchase API (affiliate/read-only only; programmatic buying = third-party services like Zinc, paid + fragile).
- **Kroger** has a genuine public API with products, prices, and cart support — best source for **price tracking**.
- Fully automated checkout violates retailer ToS and removes the human from a money decision. **Design decision: the system builds the cart, the human taps "buy".** One tap is automation enough.

### The pipeline
```
diet plan (templates already in repo)
  → ingredient aggregation (7-day quantities)
  → pantry model (purchase history depletes over time; don't rebuy rice weekly)
  → price check (Kroger API + optional scraping for trends)
  → Instacart "create shopping list page" API → deep link
  → Telegram bot message: "🛒 Week's groceries ready — est. $84.20 (↓$3 vs last week). [Open cart]"
  → user taps → store choice → checkout in Instacart
WF-30 grocery_cart_builder   cron Sunday 17:00
WF-31 price_tracker          daily: log staple prices → price history table → "chicken ↓12%, stock up"
```
New tables: `pantry_item`, `price_history`. New endpoints: `/v1/grocery/list`, `/v1/grocery/cart`.

---

## EPIC 5 — The Avatar: "Twin"

### Research findings
- **Ready Player Me**: free avatar creator from a selfie → exports GLB, loads in three.js. Proven pipeline.
- **Mixamo** (Adobe, free): auto-rigged animation clips — idle, squat, bench, deadlift, biceps-flex, celebration dance — retargetable onto the RPM skeleton.
- **Morph targets / skeleton scaling** in three.js can widen shoulders/arms/chest progressively = visible muscle growth.
- True Pixar-grade CGI in a browser is a 10-person studio problem. The unicorn move is **stylized 3D that ships**, not photoreal that doesn't.

### Two-phase plan
**Phase A (ship in days)** — "Vee", a 2.5-D animated mascot in the PWA:
- SVG/CSS rigged character, 5 physique stages (lean → built), driven by `avatar_level` = f(training volume trend, streak, PRs).
- States: idle breathing, sleeping (before check-in), lifting animation during logged sets, celebration on PR, coughing when AQI is "avoid" (context fusion → personality!).
**Phase B (the showpiece)** — three.js Twin tab:
- RPM avatar from user's selfie, GLB + Mixamo clips, `react-three-fiber` not required (vanilla three.js keeps the single-file PWA).
- Morph/skeleton scaling per `avatar_level`; **exercise mirroring**: when the user logs squats, Twin performs the squat clip.
- Lazy-loaded (three.js ~150 KB gzip + GLB ~2-4 MB) so the core app stays instant.

`avatar_level` (0–100) is deterministic and auditable like everything else:
`40% × 4-week volume trend + 30% × streak score + 20% × PR recency + 10% × check-in consistency`.

---

## EPIC 6 — Design System ("claude design skills")

One pass over the whole PWA with a real design system:
- **Tokens**: 8-pt spacing grid, type scale (SF/Inter), dark-first palette with the readiness colors as the only saturated accents.
- **Motion**: 150–250 ms ease-out micro-transitions; readiness ring animates on load; confetti on PR; skeleton loaders instead of spinners.
- **Components**: unified card, chip, sheet-modal, tab bar. The emoji pickers and sliders stay — they tested well.
- Login screen, Today, Log, Twin, Insights, Settings all re-skinned on the same tokens.

---

## Build order (ruthless founder prioritization)

| Phase | Ships | Why first |
|---|---|---|
| **P0 (week 1)** | Epic 2 (wake-up screen + workout pref) · Epic 3 logging + momentum engine · Phase A avatar | Pure software, zero external deps, daily-felt value |
| **P1 (week 2)** | Epic 1 n8n suite + Telegram bot · Epic 6 design pass | Needs n8n host + Telegram token; transforms retention |
| **P2 (week 3)** | Epic 4 grocery autopilot | Needs Instacart dev account approval (apply day 1!) |
| **P3 (week 4)** | Phase B three.js Twin | Highest wow, highest effort — build on a stable base |

## Risks & honest calls
1. **Auto-checkout**: not building it. ToS violation + money should need a human tap. Cart-built + one-tap-buy is the defensible product.
2. **Walmart/Costco/Sam's direct**: no public APIs. Costco & Sam's Club are reachable *through* Instacart — that's the route.
3. **Avatar scope**: Phase A guarantees the feature exists; Phase B makes it spectacular. Never block the product on 3D.
4. **n8n hosting**: needs an always-on instance (free on Render worker or local). Shortcut bridge keeps working regardless.
5. **Apple Watch stays Shortcut-based** — no cloud API exists, period. We document it as "your phone is the bridge".
