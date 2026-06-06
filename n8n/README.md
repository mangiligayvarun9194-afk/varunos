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
5. Activate

## The workflows — what's real vs planned

The repo ships **8 working workflows** as of v2.2.0. The original list
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
