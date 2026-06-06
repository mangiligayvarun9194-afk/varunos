# VarunOS — MVP Status (v2.2.0)

*This is the honest, granular status. Every cell links to the code or test that proves it.
No aspirational claims. "Not yet built" means not in the repo.*

Last updated: 2026-06-06. 260 tests passing.

---

## ✅ MVP-Ready (production-shaped, real, tested)

| Component | Evidence |
|---|---|
| **Deterministic core (workout, diet, readiness, surveillance)** | `tests/test_*.py` — 196 tests |
| **FastAPI server with 39 endpoints** | `varunos/api/server.py` + `varunos/api/endpoints_extra.py` |
| **API key authentication** | `varunos/auth.py`, `tests/test_api_auth.py` — 401/503 enforced |
| **Configurable CORS** | `varunos/api/server.py:34` — env var, fail-closed in prod |
| **SQLite persistence (8 tables)** | `varunos/db/__init__.py`, tested in `tests/test_api_auth.py` |
| **Surveillance consent gate (OFF by default)** | `varunos/db/__init__.py:set_surveillance_consent`, `tests/test_api_auth.py::TestSurveillanceConsent` |
| **BP tier + escalation (no raw stored if consent off)** | `varunos/api/endpoints_extra.py:log_bp` |
| **CGM TIR computation** | `varunos/core/surveillance/cgm.py` |
| **ASCVD 2018 risk** | `varunos/core/surveillance/ascvd.py` |
| **IDRS / FINDRISC** | `varunos/core/surveillance/idrs.py` |
| **Doctor share payload** | `varunos/api/server.py:doctor_share` + `n8n/workflows/10_doctor_share.json` |
| **Safety redactor (14 patterns)** | `varunos/core/safety.py` + `tests/test_surveillance.py` |
| **PWA: 5 tabs, real API calls, installable** | `pwa/index.html` + `pwa/manifest.json` |
| **PWA onboarding (5 steps)** | `pwa/index.html:onboard-*` |
| **PWA Settings (API base, API key, consent toggle, clear cache)** | `pwa/index.html:tab-settings` |
| **PWA served from same origin as API** | `varunos/api/server.py:root_index` |
| **n8n env-var URLs (no hardcoded localhost)** | 8/8 workflows use `{{$env.VARUNOS_API_BASE}}` |
| **n8n auth headers** | 8/8 workflows send `Authorization: Bearer $VARUNOS_API_KEY` |
| **Docker dev compose (with persistent volume)** | `deploy/docker/docker-compose.yml` |
| **Docker prod compose (env-driven, no exposed ports)** | `deploy/docker/docker-compose.prod.yml` |
| **Real deployment guide (VPS / Caddy / Cloudflare / Render / Fly)** | `docs/DEPLOYMENT_REAL.md` |
| **Privacy model (what is stored, how to delete, consent gate)** | `docs/PRIVACY_MODEL.md` |
| **Medical limitations (what the system does NOT claim)** | `docs/MEDICAL_LIMITATIONS.md` |
| **Production audit (what was wrong in v2.1.1, what was fixed)** | `docs/PRODUCTION_AUDIT.md` |
| **8 working n8n workflows** | `n8n/workflows/{01,02,03,04,06,10,11,99}_*.json` |

## 🟡 Prototype-grade (works for single user, not yet hardened)

| Component | Status | Risk |
|---|---|---|
| **SQLite, not Postgres** | MVP-decision. The schema is plain SQL. | Concurrent writes > 1 user = problems. |
| **API key in env var, not per-user** | MVP-decision. Fail-closed. | No per-user audit trail. |
| **No CSRF protection** | Not a concern for a personal PWA talking to a same-origin API. | If you put a public form on the same origin, add CSRF. |
| **No rate limiting** | None. | n8n self-test fires every hour; safe. A malicious actor could spam /v1/health/bp and pollute the DB. Add slowapi or nginx limit_req. |
| **No DB migrations system** | Schema is created with `CREATE TABLE IF NOT EXISTS`. | Adding a column requires manual SQL. |
| **No HTTPS in dev** | Tested via Caddy in prod. | For local testing on phone, use a tunnel (ngrok, cloudflared). |
| **No backup automation** | `docs/DEPLOYMENT_REAL.md` has the cron recipe. | Not enabled by default. |
| **The remaining 7 n8n workflows** | Scoped in `n8n/README.md`. | Do not pretend to work. |

## 🔲 Not yet built (and the team is being honest about it)

| Item | Why it matters | What's there |
|---|---|---|
| **SQLCipher encryption at rest** for the `health_reading` table | If a laptop is stolen, the raw BP/glucose are at rest unencrypted. | The table is isolated. Swap is 1 day. |
| **Multi-user auth** | For sharing with family. | The endpoints are all user-keyed. The auth layer is the work. |
| **Brain / LLM layer** | The system returns deterministic outputs today. The architecture is ready (tier-only payloads via `/v1/core/recompute_tiers`). | No LLM calls in v2.2.0. |
| **The doctor-share PDF generator** | Workflow 10 returns JSON, not a PDF. The CLI script `scripts/doctor_share_pdf.py` exists and works. | Bundle the script into workflow 10 next. |
| **7 n8n workflows** (photo analyzer, adaptive diet, grocery, lab import, travel mode, PR celebration, family onboarding, voice briefing) | Out-of-scope for the MVP. | The list is in `n8n/README.md`. |
| **Hindi / Spanish localization** | The user is in NY; English is fine for now. | All strings are inline in `pwa/index.html`. Easy to extract. |
| **PWA push notifications** | For emergency escalation alerts. | Needs a service worker that posts to a notification API. |
| **Apple Watch / Garmin / Whoop integrations** | For HRV / sleep source data. | Not in v2.2.0. |
| **`/v1/user/wipe` endpoint** | The user should be able to hard-delete from the PWA. | The DB has `DELETE FROM health_reading WHERE user_id='...'`; the endpoint is the work. |
| **TOTP / passkey for the PWA** | Right now the API key is the only auth. | For a personal app, this is OK. For a shared device, add it. |

## 🛑 Safety warnings (non-negotiable)

These are the safety rails. The system is honest about them.

1. **VarunOS is a personal-use educational tool. Not a medical device.**
   All health-related endpoints return a `disclaimer` field that says so.
2. **The system does not diagnose.** It computes risk tiers from validated screening tools.
3. **The system does not auto-dial 911 / 108 / 112.** The escalation flow shows the
   user the recommendation; the user must press the button.
4. **The system does not override user choices.** Dismissing a CRITICAL alert logs the
   dismissal but does not re-escalate against the user's will.
5. **Surveillance is OFF by default.** The raw BP/glucose values are tier-computed but
   NOT stored unless the user opts in.
6. **The brain (when added) will not see raw biomarkers.** It will only see tier
   strings and action labels via `/v1/core/recompute_tiers`.

If you find a bug in the safety rails, open a critical-priority issue. The team commits
to fix HIGH/CRITICAL safety bugs within 7 days. See `docs/MEDICAL_LIMITATIONS.md`.

## How to read this document

- "✅ MVP-Ready" — the code is in the repo, tests pass, you can deploy it.
- "🟡 Prototype-grade" — it works, but a security review or production-grade hardening would find things to fix.
- "🔲 Not yet built" — honest. The team is not faking it.
- "🛑 Safety warnings" — non-negotiable rails. The system won't let you bypass them.
