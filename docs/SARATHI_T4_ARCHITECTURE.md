# SARATHI T4 — "THE AWAKENING" · Architecture
### The Five Centres organism: onboarding-as-trials, Hermes-speaks-first, the Weekly Saga
Status: DESIGN FOR APPROVAL — no code until Varun signs off. Author: the architect. 2026-07-13.

---

## 0 · The architectural signature

One new pure engine — **`core/centres.py`** — computes, for any user, how *awake* each of their five element-pillars is, purely from real recorded data:

```
centres(user_data) -> { space: 0..1, air: 0..1, fire: 0..1, water: 0..1, earth: 0..1 }
```

- **space (आकाश · memory)** — depth of the record: vault entries, days of history
- **air (वायु · motion)** — coached/logged training recency & cadence
- **fire (अग्नि · fuel)** — meal-logging recency & consistency
- **water (आपस् · recovery)** — check-in/watch-data recency
- **earth (पृथ्वी · foundation)** — measurements present + training volume trend

Deterministic, explainable, unit-tested, no LLM, no I/O. **Every T4 surface is a projection of this one vector:**

```
                       ┌──────────────────────┐
                       │   core/centres.py    │  ← the spine (pure)
                       └──────────┬───────────┘
      ┌────────────┬──────────────┼───────────────┬───────────────┐
      ▼            ▼              ▼               ▼               ▼
 AWAKENING     TODAY strip    HERMES PUSH     WEEKLY SAGA     TWIN glow
 (first-run    (5 centres     (nudges only    (weekly Δ of    (chakra
  trials =     as the daily   when a centre   the vector =    sprites lit
  lighting     scoreboard)    dims/ignites)   the story)      by centres)
  centres)
```

The same vector doubles as the **activation metric** for investors: "a user is activated when ≥4 centres are lit." Marketing myth, product UX, retention engine, and business KPI become one number system.

**The invariants stand:** pure deterministic core (no httpx/LLM imports in `core/`), privacy gate (LLM sees tiers/scores/user text only — never raw biomarkers), honest empty states, per-user isolation via the existing auth contextvar.

---

## 1 · Feature A — THE AWAKENING (onboarding as the five trials)

**Concept.** First-run is the trailer made personal. Five acts in **ascending tattva order** — पृथ्वी → आपस् → अग्नि → वायु → आकाश, feet to crown — the classical ascent, opposite to the film's sky-down order: the film descends *to* you, you ascend *from* the foundation. Each act is a real product input that visibly ignites a centre on the user's own Twin.

| Act | Element | The user does | The gift they see | Reuses |
|---|---|---|---|---|
| 1 | पृथ्वी | Enters measurements | **Their Twin materializes at true size** | twinbody, Twin stage |
| 2 | आपस् | Six-tap check-in | **Readiness ring ignites** (real score) | checkins, readiness |
| 3 | अग्नि | Types one meal line | **Macros appear instantly** | meal parser |
| 4 | वायु | 30-sec camera rep test — *skippable without shame* | **A rep counted live** | FormCoach |
| 5 | आकाश | Nothing — the seal | **"All of it is now remembered"** — their vault, already holding acts 1–4 | vault |

**Design decision — progress is DERIVED, never stored.** `core/awakening.py` computes act status *from the existence of real records* (measurements? a check-in? a meal? a coached set?). No progress table to drift out of sync; existing users with history auto-complete instantly; abandoning mid-flow costs nothing. The only write is `db.log_event('awakening_act', …)` for timing analytics, and one `awakening_skipped` flag in user state.

- **Core:** `awakening_state(data) -> {acts:[{element,status,line}], next, complete, pct}` + `awaken_line(element)` (narrator voice bank).
- **API:** `GET /v1/awakening` · `POST /v1/awakening/skip`.
- **Frontend:** `Awakening.jsx` — obsidian film language: act intro line → the real input component (reused) → centre-ignition moment on a `TwinAwakenStage` (chakra sprites from the film stage, lit by the centres vector) → final act = full aura → Today. App routes new users here until complete/skipped.

## 2 · Feature B — HERMES SPEAKS FIRST (push proactivity)

**Concept.** A coach who waits to be visited is a dashboard. Hermes earns one morning briefing and at most one evening nudge — only when something *true* exists to say (the honesty gate reuses `observations()`; empty list = silence).

- **Core:** `core/proactive.py` — `plan_nudges(now_local, state) -> [Nudge]`. Pure decision engine: quiet hours, one-per-slot dedupe, priority (readiness warning > streak protection > goal progress > saga announcement). `Nudge = {kind, slot, text, deep_link}`.
- **Delivery (adapter pattern, I/O stays in api/):** channel providers behind one interface. **MVP channel: Telegram** (rails exist from the concierge bot; reliable on every phone, zero Apple friction). Web Push (VAPID + minimal service worker) is phase 2 — flagged: iOS needs 16.4+ and A2HS.
- **DB:** `push_subscriptions (user_id, channel, address, quiet_from, quiet_to, enabled)` · `nudge_log (user_id, kind, date)` — send-once idempotency.
- **Scheduler:** an in-process asyncio ticker (15-min cadence) calling `plan_nudges` per subscribed user + idempotent send. *Deployment truth:* a sleeping free-tier dyno cannot speak first — this feature quietly requires the always-on instance; noted as a cost decision, or Render Cron hitting `POST /v1/internal/tick` (shared secret) as the alternative.
- **Settings UI:** connect-Telegram deep-link code, quiet hours, master toggle.

## 3 · Feature C — THE WEEKLY SAGA

**Concept.** Every Sunday, the week retold in the mythic voice over real numbers — the product's shareable artifact.

- **Core:** `core/saga.py` — `week_aggregate(logs, sets, checkins) -> week_data` and `compose_saga(week_data, centres_delta) -> {title, chapters:[{element, line, stat}], wins, focus}`. Deterministic template voice bank keyed to what actually happened (PR week ≠ recovery week ≠ silent week — a silent week gets a gentle honest saga, never fake glory). Optional LLM polish later, behind the existing llm_guard.
- **DB:** `sagas (user_id, week_start, payload_json, created_at)` — idempotent per week.
- **API:** `GET /v1/saga/latest` · `POST /v1/saga/generate`.
- **Share card:** rendered **client-side on a `<canvas>`** (1080×1350, obsidian × gold, five-centre strip + one hero stat) → Web Share API / download. Zero new dependencies, zero server rendering.
- **Hooks:** Hermes announces it (Feature B, `saga_ready` nudge); Today shows the latest saga card Sunday–Tuesday.

---

## 4 · Territory map (parallel build, zero file collisions)

| Agent | Territory | Contract it owns |
|---|---|---|
| A1 | `core/centres.py` + tests | the centres vector (shape above) |
| A2 | `core/awakening.py` + tests | awakening state JSON |
| A3 | `core/proactive.py` + tests | Nudge JSON |
| A4 | `core/saga.py` + tests | saga payload JSON |
| B | `db/__init__.py` additions + `api/` endpoints + ticker | endpoint paths above |
| C | `web/src/screens/Awakening.jsx` + `TwinAwakenStage` | consumes /v1/awakening |
| D | Settings push UI + Telegram link flow | consumes subscriptions API |
| E | Saga UI + canvas share card | consumes /v1/saga/latest |

Verification gate (unchanged ritual): full pytest + web tests green, `npm run build`, live smoke on the running server, screenshots of Awakening acts 1–5, one real nudge sent to Telegram, one saga card downloaded. Commit only then.

## 5 · Honest risks
1. **Push requires an awake server** — the single real infra cost decision in T4.
2. **Camera act friction** — Act 4 must be one tap to skip; a shamed skip is a lost user.
3. **Telegram-first** is unfashionable but shippable this week; Web Push is a fast follow, not a blocker.
4. **Centres tuning** — initial weights will be wrong; they're constants in one file with tests, designed to be re-tuned from real beta data.

## 6 · Build order
Week 1: A1 → A2 → C (the Awakening ships end-to-end).
Week 2: A3 → B → D (Hermes speaks first).
Week 3: A4 → E (the Saga) → invite the first 20 users and *watch the centres light up per real human*.
