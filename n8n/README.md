# VarunOS — n8n Workflow Library

The visual automation brain. Workflows wire external services (Twilio, WhatsApp, email,
calendar, photo analysis) to the VarunOS FastAPI core.

## How to import

1. Open n8n (default: `http://localhost:5678`)
2. **Workflows → Import from File...** → select any JSON
3. Set credentials (Twilio, OpenAI, etc.) in the n8n credential store
4. Set environment variables on the n8n container or instance:
   - `VARUNOS_API_BASE` — e.g. `http://core:8000` (in compose) or `https://varunos.yourdomain.com`
   - `VARUNOS_API_KEY` — your server's `VARUNOS_API_KEY` from `.env`
   - `VARUNOS_USER_ID` — defaults to `default`
   - `VARUNOS_TZ` — e.g. `America/New_York`
   - `TELEGRAM_BOT_TOKEN` — bot token from BotFather
   - `TELEGRAM_CHAT_ID` — the chat/user id where VarunOS should message you
5. Activate

## Telegram setup

1. In Telegram, message `@BotFather`, create a bot, and copy the bot token.
2. Start a chat with the bot so Telegram is allowed to deliver messages.
3. Find your chat id by opening:
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`
   after sending the bot any message. Use the `message.chat.id` value.
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` on Render for the VarunOS
   service and on the n8n instance/container.
5. Redeploy Render, then call `POST /v1/notify/test` with your VarunOS API key.
   A successful setup returns `{"configured": true, "sent": true}`.

## The workflows — what's real vs planned

The repo ships **11 working workflows** as of v2.3.0. The original list
referenced 15 — the rest are **scoped but not yet implemented**. They are
not mock files; they are simply not in the repo. The honest status:

| # | Workflow | File | Status | Trigger |
|---|---|---|---|---|
| 1 | Morning Briefing | `01_morning_briefing.json` | ✅ Working | cron 5:30am |
| 2 | Health Aggregator | `02_health_aggregator.json` | ✅ Working | webhook |
| 3 | Workout Logger | `03_workout_logger.json` | ✅ Working | webhook |
| 4 | Meal Logger | `04_meal_logger.json` | ✅ Working | webhook |
| 5 | Photo Analyzer | `05_photo_analyzer.json` | 🔲 Planned | image upload |
| 6 | Weekly Report | `06_weekly_report.json` | ✅ Working | cron Sun 8pm |
| 7 | Adaptive Diet | `07_adaptive_diet.json` | 🔲 Planned | workflow 6 |
| 8 | Grocery Generator | `08_grocery_generator.json` | 🔲 Planned | workflow 6 or request |
| 9 | Lab Import | `09_lab_import.json` | 🔲 Planned | email/photo |
| 10 | Doctor Share | `10_doctor_share.json` | ✅ Working | webhook |
| **11** | **Emergency Escalation** | `11_emergency_escalation.json` | ✅ Working | EVT_CRITICAL |
| 12 | Travel Mode | `12_travel_mode.json` | 🔲 Planned | calendar/text |
| 13 | PR Celebration | `13_pr_celebration.json` | 🔲 Planned | EVT_PR |
| 14 | Family Onboarding | `14_family_onboarding.json` | 🔲 Planned | admin command |
| 15 | Voice Briefing | `15_voice_briefing.json` | 🔲 Planned | cron or request |
| 20 | Wearable Poller | `20_wearable_poller.json` | ✅ Working | cron 7:30am |
| 21 | Post-Sync Briefing | `21_post_sync_briefing.json` | ✅ Working | webhook |
| 22 | Momentum Notifier | `22_momentum_notifier.json` | ✅ Working | cron 8pm |
| 30 | Telegram Concierge | `30_telegram_concierge.json` | ✅ Working | Telegram webhook |
| 33 | Grocery Price Watch | `33_grocery_price_watch.json` | ✅ Working | cron weekly |
| 34 | Weekly Insight Digest | `34_weekly_insight_digest.json` | ✅ Working | cron Sun 7pm |
| 99 | Self-Test | `99_self_test.json` | ✅ Working | cron hourly |

The 7 "Planned" workflows are scoped in `docs/ROADMAP.md`. They are not
mock JSON; the team's position is that a stub workflow that pretends
to work is worse than no workflow, so the file is not in the repo
until the real implementation is built and tested.

## The event taxonomy

The system speaks a small set of internal events. Every n8n workflow subscribes to
one or more. The core emits; surfaces react.

| Event | Payload | Emitter |
|---|---|---|
| EVT_BRIEFING_READY | {user_id, ts, readiness, tiers, summary} | workflow 1 |
| EVT_WORKOUT_SET_LOGGED | {user_id, ts, exercise, set, weight, reps, rpe} | workflow 3 |
| EVT_MEAL_LOGGED | {user_id, ts, kcal, p, c, f, items} | workflow 4 |
| EVT_BP_READING | {user_id, ts, sbp, dbp, pulse, source} | `POST /v1/health/bp` |
| EVT_GLUCOSE_READING | {user_id, ts, mgdl, source, context} | `POST /v1/health/glucose` |
| EVT_HRV_READING | {user_id, ts, ms, baseline_diff} | `POST /v1/logs/checkins` |
| EVT_SLEEP_READY | {user_id, ts, duration_min, deep_pct, rem_pct, eff} | `POST /v1/logs/checkins` |
| EVT_TIER_CHANGED | {user_id, scope, from_tier, to_tier, ts} | `POST /v1/core/recompute_tiers` |
| EVT_CRITICAL_THRESHOLD | {user_id, scope, value, ts, action_required} | `POST /v1/surveillance/escalate/*` |
| EVT_PR | {user_id, exercise, kg, reps, pr_type} | `POST /v1/workouts/log` |
| EVT_GOAL_DELTA | {user_id, goal, projected_kg, days_remaining} | workflow 7 (planned) |
| EVT_DOCTOR_SHARE_READY | {user_id, share_id, ttl_h, url} | workflow 10 |

## Why n8n (vs hard-coded Python)

| Aspect | Python | n8n |
|---|---|---|
| Add new data source | Code + redeploy | Drag node + API key |
| Add new trigger | Code | Drag trigger node |
| User tweaks flow | No | Edit in UI |
| Failure | Crash app | One workflow fails, others continue |
| Visibility | Read code | Visual graph |

n8n doesn't replace the deterministic core. It orchestrates around it.

## A real workflow (workflow 3, workout logger)

Import `03_workout_logger.json`. Wire a Twilio WhatsApp number to the
webhook URL `https://<your-n8n-host>/webhook/varunos-log-workout`. Send
yourself a message like:

```json
{
  "program": "PPL",
  "day_name": "Push",
  "week": 1,
  "day_index": 0,
  "decision": "GREEN",
  "sets": [
    {"exercise_id": "bench_press", "set_index": 1, "weight_kg": 100, "reps": 5, "rpe": 8},
    {"exercise_id": "bench_press", "set_index": 2, "weight_kg": 100, "reps": 5, "rpe": 8}
  ]
}
```

The workflow:
1. POSTs to `$VARUNOS_API_BASE/v1/logs/workouts` (auth via `$VARUNOS_API_KEY`)
2. The API persists the workout + sets in SQLite
3. Returns the `workout_id`
4. The workflow logs `workout_logged_via_n8n` to `/v1/observability/log`
5. The PWA's Log tab will show the new session next time you open it

That's a real workflow hitting a real endpoint, persisting real data.

## Workflow 30 — Telegram Concierge (snap a meal, or ask the coach)

A single **two-way** Telegram bot that turns the messaging app you already
have open into VarunOS's fastest input surface. One inbound webhook, fanned
out by message type:

- **📸 Photo of a plate →** OpenAI vision (`gpt-4o-mini`) estimates the meal's
  kcal/protein/carbs/fat → `POST /v1/logs/meals` (which accepts direct macros
  with a free-text label, so no food-DB lookup is needed) → a confirmation
  reply with the day's running total. This is the long-planned **Photo
  Analyzer (#05)**, finally shipped.
- **🎙️ Voice note →** Whisper (`whisper-1`) transcribes "two rotis, a bowl of
  dal, and a glass of milk" → an LLM turns the words into macros → same
  `POST /v1/logs/meals` → confirmation. Hands-free logging while you cook.
- **💬 Any text →** `POST /v1/coach/ask` → the answer comes straight back in
  the chat. The notifier bot becomes a real conversational coach.
- **Anything else →** a friendly nudge on how to use it.

### Setup (one time)

1. Set two extra env vars on your n8n instance (in addition to the ones above):
   - `OPENAI_API_KEY` — for the meal-photo vision call.
   - `TELEGRAM_BOT_TOKEN` — the same bot you already use for notifications.
2. Import `30_telegram_concierge.json` and **activate** it. Copy its production
   webhook URL (ends in `/webhook/varunos-telegram`).
3. Point your bot at that URL once:
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<your-webhook-url>`
4. Message the bot a photo of a meal, or just type a question.

> A Telegram bot can have **only one** webhook. This workflow owns the bot's
> inbound webhook; the other workflows (briefings, momentum) are *outbound*
> only (they `sendMessage`), so they don't conflict.

### Privacy

The meal photo / voice note (food only) is sent to OpenAI — a **food photo or a
spoken meal, never a biomarker** — so it does not touch the Brain privacy gate.
The coach branch calls `/v1/coach/ask`, where `build_brain_context()` already
enforces tiers/scores/labels only, server-side — the LLM never sees raw BP,
glucose, or HRV. No new privacy surface is opened.

> The voice branch uploads the audio file to OpenAI Whisper as multipart form
> data — the one node most likely to need a tweak across n8n versions. If voice
> logging errors on import, check the **Whisper transcribe** node's binary field
> (`inputDataFieldName: data`); photo and text branches are independent and
> unaffected.

## Workflows 33 & 34 — grocery price watch + weekly insight digest

**33 Grocery Price Watch** — a weekly cron fetches one product page, an LLM
reads the current price, and you get a Telegram alert *only* when it is at or
below your target. A human always taps buy; there is no auto-checkout. It is
fully self-contained — it touches no health data and no VarunOS endpoint.
Configure three env vars:
- `GROCERY_PRODUCT_URL` — the product page to watch.
- `GROCERY_TARGET_PRICE` — alert at/below this number.
- `OPENAI_API_KEY` — for price extraction.

**34 Weekly Insight Digest** — every Sunday 7pm it pulls `/v1/insights` (the
deterministic correlation/anomaly engine) and Telegrams the top patterns it
found in *your* data ("low sleep → low energy next day"). Labels and
plain-English text only — never raw biomarkers. No extra env vars beyond the
core `VARUNOS_*` and `TELEGRAM_*`.

## Research: the n8n catalog scan, and what we did with it

A scan of the public n8n template catalog for patterns that fit a personal
health OS (not generic lead-gen), and the disposition of each:

| Pattern seen in the wild | VarunOS enhancement | Status |
|---|---|---|
| "Log meal nutrition from food photos with AI" | Meal-photo macro logger | ✅ Built — wf 30 (Photo Analyzer #05) |
| "Turn Telegram voice notes into X with Whisper" | Voice meal logging | ✅ Built — wf 30 voice branch |
| "Multi-agent assistant from Telegram" | Two-way coach over Telegram | ✅ Built — wf 30 text branch |
| "Detect pricing anomalies / track prices" | Grocery price-watch + alert | ✅ Built — wf 33 |
| "Weekly habit & mood insights digest" | Sunday insight digest | ✅ Built — wf 34 |
| "Monitor & alert" (cron poller) pattern | Reused for the price watch and digest cadence | ✅ folded in |
| "PDF/photo OCR → extract values" | Lab-report import (blood panel → tiers) | ⛔ **Deliberately not built** |

**Why lab-report OCR was *not* built:** every cloud-OCR template sends the
document image to a third-party LLM. For a meal photo that is fine; for a
**blood panel it means shipping raw biomarkers to OpenAI**, which is exactly
what VarunOS's privacy posture exists to prevent. Lab import is worth doing —
but with **on-device / self-hosted OCR** (e.g. Tesseract or a local
Ollama-vision model) digitizing the values *before* anything leaves the box,
plus a proper `/v1/labs/import` endpoint that respects the surveillance consent
gate. That is a backend task, not a quick cloud-LLM n8n hack, and is left for a
deliberate, tested build.

Rule for everything here: orchestration only. Health math stays in
`varunos/core/`, and nothing puts raw biomarkers in front of an LLM or in a
Telegram message — tiers, scores, and labels only.
