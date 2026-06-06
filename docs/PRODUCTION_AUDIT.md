# VarunOS — Production Audit

*Date: 2026-06-06. Author: senior engineering review.*

This is the honest state of the codebase. No marketing, no aspirational claims.

---

## Test status

```
196 passed in 0.4s
```

196 unit + integration tests, all green. They cover the **deterministic core** thoroughly (workouts, diet, surveillance, readiness, safety). They do **not** cover HTTP-level behavior (auth, persistence, CORS, real endpoints). That is a gap filled in this round of work.

---

## What actually works (verified)

| Component | Status | Evidence |
|---|---|---|
| Deterministic core (workouts/diet/surveillance/readiness/safety) | ✅ Solid | 196 tests |
| CLI briefing | ✅ Works | `python3 -m varunos.cli briefing` produces formatted output |
| CLI surveillance | ✅ Works | Returns IDRS + ASCVD tier |
| Doctor-share PDF | ✅ Works | Valid PDF 1.4 generated |
| FastAPI server | ✅ Boots | 17 endpoints respond |
| PWA frontend (last revision) | ⚠️ Loads, calls live API, profile/check-in persist in localStorage |

---

## What is fake / mock / aspirational (honest list)

### Endpoints referenced by n8n / PWA that DO NOT EXIST in server.py

| Endpoint | Called by | Status |
|---|---|---|
| `POST /v1/surveillance/escalate/bp` | n8n workflow 02 | ❌ 404 |
| `POST /v1/core/recompute_tiers` | n8n workflow 02 | ❌ 404 |
| `POST /v1/observability/log` | n8n workflow 01, 11 | ❌ 404 |
| `POST /v1/observability/ack_check` | n8n workflow 11 | ❌ 404 |
| `GET /v1/user/profile` | none yet | ❌ 404 |
| `PUT /v1/user/profile` | none yet | ❌ 404 |
| `POST /v1/logs/workouts` | none (PWA uses `/v1/workouts/log` which is different) | ❌ 404 |
| `POST /v1/logs/meals` | none | ❌ 404 |
| `POST /v1/logs/checkins` | none | ❌ 404 |

**Consequence:** n8n workflows that try to log observability events or recompute tiers will 404. PWA logs a workout but doesn't persist it server-side.

### Persistence

**There is none.** The API is fully in-memory. Every request recomputes from inputs. No SQLite. No JSONL. Restart the server, lose all state. (The deterministic core doesn't need persistence, but the *user* state — profile, check-ins, logged sets — does.)

### Auth

**None.** Every endpoint is open. `allow_origins=["*"]`. CORS wide open. A real PWA exposed this way would let any browser-script on the open Internet read your BP.

### Surveillance consent

**Not enforced.** The PWA calls `/v1/surveillance/bp` and `/v1/surveillance/escalate/glucose` directly. There is no consent state. Anyone hitting the API can write health data. (When persistence is added, this becomes a real PII risk.)

### n8n

**3 of 15 workflows exist** (`01_morning_briefing.json`, `02_health_aggregator.json`, `11_emergency_escalation.json`). The other 12 are missing. The README and `n8n/README.md` claim all 15 work — they don't.

### Doctor-share PDF

The `scripts/doctor_share_pdf.py` works (it uses the deterministic payload directly, not the API), but it does not use the `/v1/doctor/share` endpoint. The endpoint exists, the workflow doesn't.

### PWA on phone

`API_BASE` defaults to `http://127.0.0.1:8000` — fine for a developer, useless for a real user on a phone. The PWA does have a configurable override, but it's hidden in the URL field; not in the Settings tab.

### PWA onboarding

**None.** The PWA dumps the user straight into the app. No profile setup, no goal selection, no safety disclaimer, no surveillance consent step. A real user would see tier chips for things they never opted in to.

### Service worker

`pwa/sw.js` is a basic cache-first stub. It doesn't include any app-shell version pinning, so a deploy could leave users stuck on the old PWA.

### Docker

`docker-compose.yml` uses the older Compose v2 fields, references `image: varunos:2.1.1` (the build context is `.` — works, but the path is `deploy/docker/Dockerfile`, and compose is in `deploy/docker/`, so `context: .` resolves to `deploy/docker/`, not the project root). **This is a build bug.** The container would fail to find `varunos/`, `tests/`, etc. There's no `docker-compose.prod.yml`, no production env-file pattern, no persistent volume declaration for SQLite.

### Tests not in the suite

- HTTP auth (no test for 401 when no key)
- CORS preflight
- Persistence round-trip
- Surveillance consent (default-deny)
- Missing endpoints (no test for 404 vs 200 contract)
- PWA config file (no test that the PWA has configurable API base)

### Things still aspirational (won't fix in this round)

- Vision form check (no real model wired)
- Apple Watch / Garmin / Whoop integrations (no OAuth)
- Twilio WhatsApp / voice (creds + webhook routing, not built)
- n8n execution on a real box (the workflows are JSON; running n8n is ops)
- Multi-user / family modes
- Encrypted SQLCipher medical vault (currently SQLite is unencrypted; the medical tables are *separated* but not encrypted)

---

## What is dangerous for real health use

| Risk | Mitigation in this PR |
|---|---|
| Diagnostic language from brain | Already encoded in `varunos.core.safety` (8 regex patterns, 14 tests). Verified. |
| BP/glucose written to disk without consent | Consent gate added. Surveillance off by default. |
| Critical alerts missed if API auth leaked | Auth required for all write endpoints. |
| Hardcoded "danger" thresholds firing on bad data | Input validation in the new endpoints; out-of-range BP/glucose rejected before escalation logic runs. |
| API in a public deployment with no auth | `VARUNOS_API_KEY` required; `VARUNOS_ALLOWED_ORIGINS` configurable; .env.example provided. |

---

## What must be built before any public user touches this

1. ✅ All endpoints referenced by n8n/PWA implemented and tested.
2. ✅ Persistence (SQLite, with proper migrations down the road).
3. ✅ Auth (API key) on every non-public endpoint.
4. ✅ CORS allowlist (no more `*` in production).
5. ✅ Surveillance consent flow with opt-in, opt-out, and hard delete.
6. ✅ PWA onboarding + API key entry.
7. ✅ Production docker-compose with persistent volumes.
8. ✅ Real deployment guide (Render/Fly.io/Hetzner).
9. ✅ Honest README + MVP_STATUS.md.

After this PR, items 1–9 are real. Items aspirational above remain aspirational.
