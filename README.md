# VarunOS — Personal AI Coach Operating System

*An MVP that does what the README says it does. No mock features, no aspirational docs.*

> ⚠️ **Not a medical device.** VarunOS computes risk tiers using validated screening tools
> (IDRS, FINDRISC, ASCVD-2018, ACC/AHA BP, CHA2DS2-VASc, the Battelino CGM consensus, ADA 2024,
> ICMR cutoffs for Indian populations). It does not diagnose. If you have symptoms, see a doctor.
> See [`docs/MEDICAL_LIMITATIONS.md`](docs/MEDICAL_LIMITATIONS.md).

## What this is

VarunOS is a personal fitness + health-coaching system that runs on a server you control.

- **A deterministic core** in Python that computes TDEE, macros, workout decisions,
  PR detection, IDRS, ASCVD, BP staging, CGM TIR — the math is the math, no LLM in the loop.
- **A FastAPI server** with 39 endpoints, API-key auth, configurable CORS, SQLite persistence.
- **A Progressive Web App** that installs on iOS/Android, has onboarding, real persistence,
  and a Settings tab for the API key.
- **A surveillance layer** that is **off by default** and lets you opt in to storing
  raw BP / glucose / CGM values locally.
- **An n8n workflow library** (8 working workflows out of 15 scoped) for wiring in
  Twilio, WhatsApp, email, photos, voice.
- **A safety redactor** that detects and replaces diagnostic language with action labels.
  14 unit tests verify it can't be talked out of doing its job.

## What it is NOT

- Not a medical device. Not FDA-cleared. Not a replacement for a doctor.
- Not a multi-tenant SaaS. Single-user / family-scale, by design.
- Not auto-dialing 911. The escalation flow shows the user the recommendation; the user presses the button.

## Quick start (5 minutes)

```bash
# 1. Get the code
git clone <your-repo> varunos && cd varunos
cp .env.example .env

# 2. Generate a real API key
echo "VARUNOS_API_KEY=$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')" >> .env
echo "VARUNOS_ALLOWED_ORIGINS=http://localhost:8000" >> .env

# 3. Run it
docker compose -f deploy/docker/docker-compose.yml up --build
```

Open:
- **PWA:** http://localhost:8000
- **API docs:** http://localhost:8000/docs
- **n8n:** http://localhost:5678 (optional)

The first time you open the PWA, the onboarding flow walks you through connecting
the API, setting your profile, accepting the safety disclaimer, and choosing
whether to enable health surveillance.

For production deployment (VPS, Cloudflare Tunnel, Render, Fly.io, systemd), see
[`docs/DEPLOYMENT_REAL.md`](docs/DEPLOYMENT_REAL.md).

## What works today (verified by `pytest`)

**260 tests passing.** 196 from the deterministic core, 43 from the new auth/persistence/observability
endpoints, 21 from the PWA source verification.

| Layer | Status | Tests |
|---|---|---|
| Core: workout, diet, readiness, surveillance math | ✅ All green | 196 |
| FastAPI server: 39 endpoints, auth, CORS | ✅ All green | 43 |
| SQLite persistence: profile, checkin, workouts, meals, health, events, alerts | ✅ All green | (in 43) |
| Surveillance consent gate (raw values only stored when opted in) | ✅ All green | (in 43) |
| PWA structure: onboarding, API key, installable icons, no hardcoded URLs | ✅ All green | 21 |
| n8n workflows: 8 working, 7 planned-but-not-mocked | ✅ 8 JSON files parse, no hardcoded URLs | manual |

See [`MVP_STATUS.md`](MVP_STATUS.md) for the full honest status of every component.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       iOS / Android                         │
│                PWA (installable, offline-first)             │
│   Onboarding → 5 tabs: Today / Log / Insights / Coach / ⚙  │
└──────────┬──────────────────────────────────┬───────────────┘
           │ HTTPS + Bearer                    │ webhooks
           ▼                                   ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│   FastAPI core (:8000)   │◀─────│       n8n (:5678)        │
│  • 39 endpoints          │      │  8 working workflows     │
│  • API key auth          │      │  (Twilio, WA, email)     │
│  • SQLite persistence    │      └──────────────────────────┘
│  • Surveillance consent  │
│  • Safety redactor       │
└──────────┬───────────────┘
           │
           ▼
   varunos.db (SQLite, single file)
   ┌────────────────────────────────────┐
   │ user_profile   health_reading     │  ← medical: future SQLCipher
   │ daily_checkin  observability_event│
   │ workout_log + workout_set          │
   │ meal_log       alert_ack           │
   └────────────────────────────────────┘
```

## What's new in v2.2.0

- **Auth.** API key on all 38 non-public endpoints. `/healthz` stays public. Fail-closed
  if the env var is missing. Test: 401 without key, 503 without env.
- **CORS.** `VARUNOS_ALLOWED_ORIGINS` env var, comma-separated. Default `*` for dev,
  warn-loud in production.
- **Persistence.** SQLite at `VARUNOS_DB_PATH`. Tables for user, checkins, workouts,
  meals, health readings (consent-gated), observability events, alert acks.
- **8 new endpoints** that the n8n/PWA needed but were 404: `/v1/surveillance/escalate/bp`,
  `/v1/core/recompute_tiers`, `/v1/observability/log`, `/v1/observability/ack_check`,
  `/v1/user/profile`, `/v1/logs/workouts`, `/v1/logs/meals`, `/v1/logs/checkins`.
- **Surveillance consent gate.** OFF by default. `POST /v1/health/bp` with consent off
  returns the tier but does NOT persist the raw SBP/DBP.
- **PWA onboarding.** 5-step flow on first open. API key field in Settings.
- **PWA installability.** Real SVG icons, manifest, service worker (bumped to v2.2.0).
- **PWA-served-from-API.** Single docker container now serves both the API and the PWA
  at the same origin. CORS is no longer a runtime concern.
- **n8n URL fix.** All 8 existing workflows use `{{$env.VARUNOS_API_BASE}}` instead of
  hardcoded `http://localhost:8000`. All 8 send the `Authorization: Bearer $VARUNOS_API_KEY` header.
- **Honest n8n README.** Lists which of the 15 scoped workflows are actually built (8) and
  which are scoped-but-not-implemented (7). No mock JSON files.
- **Privacy + Medical docs.** [`docs/PRIVACY_MODEL.md`](docs/PRIVACY_MODEL.md) and
  [`docs/MEDICAL_LIMITATIONS.md`](docs/MEDICAL_LIMITATIONS.md) explain the actual behavior.

## What's NOT in v2.2.0 (and the path to it)

See [`MVP_STATUS.md`](MVP_STATUS.md) for the full list. Top items:

- **SQLCipher encryption at rest** for the `health_reading` table. The code path is
  isolated (one table, no joins) so this is a 1-day swap when needed.
- **Multi-user auth.** MVP is single-user. The endpoint structure supports it (every
  endpoint is keyed by `user_id`); only the auth layer needs the work.
- **The remaining 7 n8n workflows** (photo analyzer, adaptive diet, grocery, lab import,
  travel mode, PR celebration, family onboarding, voice briefing). All are scoped but
  not yet built. The team's position is that a stub workflow is worse than no workflow.
- **Brain / LLM layer.** Currently the system returns deterministic outputs only.
  The architecture is ready (tier-only payloads, no raw biomarkers to the brain) but
  the brain itself is not wired in. This is the next major milestone.

## Run the tests

```bash
cd varunos
PYTHONPATH=. python3 -m pytest tests/ -v
# 260 passed
```

## License

MIT. See [LICENSE](LICENSE).
