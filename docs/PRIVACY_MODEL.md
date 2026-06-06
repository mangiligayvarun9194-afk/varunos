# VarunOS — Privacy Model

*Last updated: 2026-06-06. This is the actual behavior, not the aspirational one.*

---

## 1. What VarunOS stores

| Category | Examples | Default | Opt-out |
|---|---|---|---|
| **Profile** | name, age, sex, height, weight, activity, goal | Always stored (fitness features require it) | Hard delete wipes |
| **Daily check-ins** | HRV, RHR, sleep, energy, soreness, mood, stress, hunger, load | Always stored | Hard delete wipes |
| **Workout logs** | program, day, sets, reps, weight, RPE | Always stored | Hard delete wipes |
| **Meal logs** | food_id, portions, kcal/macros | Always stored | Hard delete wipes |
| **Health readings (BP, glucose, ECG, weight, CGM)** | raw values | **OFF by default** | Turned off via `POST /v1/user/surveillance {"on": false}` |
| **Observability events** | "briefing sent", "tier changed", etc. | Always stored (audit trail) | Hard delete wipes |

Storage is **SQLite** at `$VARUNOS_DB_PATH` (default `./varunos.db`). MVP storage is **not** encrypted at rest. The "encrypted medical vault" promise in `docs/SAFETY_RAILS.md` is the next-step SQLCipher upgrade and is **not yet implemented** in this MVP. The data IS separated into a dedicated `health_reading` table so a future SQLCipher upgrade can encrypt just that one table without rewriting the rest of the app.

## 2. Surveillance consent

Surveillance is **off by default**. To enable it, the user must:

1. Call `POST /v1/user/surveillance` with `{"on": true, "acknowledged_medical_disclaimer": true}`
2. The system records the consent timestamp
3. Only then will `POST /v1/health/*` persist the raw values to the database

If surveillance is off, `POST /v1/health/bp` will:
- Compute and return the stage, tier, and action label
- Run the escalation logic (if hypertensive crisis, still alerts)
- **NOT** persist the raw SBP/DBP values to the database
- Log a generic observability event (`bp_reading`) without the raw value
- Return `"persisted": false` so the caller knows

To disable surveillance, call:
```
POST /v1/user/surveillance  {"on": false}
```
Existing data is **not** auto-deleted. Use the hard-delete command (below) to wipe it.

## 3. API authentication

All endpoints (except `/healthz`, `/docs`, `/redoc`, `/openapi.json`) require an API key:

```
Authorization: Bearer <VARUNOS_API_KEY>
```
or
```
X-API-Key: <VARUNOS_API_KEY>
```

The server is **fail-closed**: if `VARUNOS_API_KEY` is not set, the server starts but every protected endpoint returns `503 Service Unavailable` and a warning is printed to stderr at startup. **Do not deploy with auth misconfigured.**

Generate a key:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 4. CORS

Default in dev: `allow_origins=["*"]`. For production, set `VARUNOS_ALLOWED_ORIGINS` to a comma-separated list of exact origins. The server logs a warning at startup if it detects `VARUNOS_ENV=production` and `*`.

## 5. Doctor-share

The `/v1/doctor/share` endpoint returns a structured payload. The default TTL for the share link is 24 hours (the field `ttl_hours: 24` in the response). The MVP does not generate the share link itself — that's a future work item (a signed URL that the user emails/shares). For now, the user can paste the JSON into a chat with their doctor.

The share payload **does not** include the user's name, address, or any PII the user did not enter into the system. The `biometrics` field is whatever the user (or the system on the user's behalf) put into the system. The user is expected to review the payload before sharing.

## 6. Logging

The server does not log request bodies. The default Python logging level is WARNING. The observability table records only the **kind** of event (e.g. `bp_reading`), not the raw values, unless the user has opted in to surveillance.

## 7. Hard delete

A future `/v1/user/wipe` endpoint will:
- Delete all rows for the user from every table
- Print a clear log message
- Be irreversible (no soft delete)

This is **not yet implemented** in the MVP. For now, the user can:
- `rm varunos.db` to wipe everything
- `DELETE FROM health_reading WHERE user_id='...'` to wipe just the medical table

## 8. What the system does NOT do (privacy guarantees)

- Does not share data with insurance, employers, or third parties. There is no such code path in the codebase.
- Does not train any model on user data. There is no such code path in the codebase.
- Does not auto-dial 911. The system shows the user a recommendation to call; the user must press the button.
- Does not store data outside the SQLite file the user controls.

## 9. What to tell your users

When you ship VarunOS, give the user this minimum disclosure:

> Your fitness data and (if you opt in) your health readings are stored locally on the server you set up. Nothing leaves the box except what you explicitly share. You can hard-delete everything. The system is not a medical device; it computes risk tiers from validated screening tools but does not diagnose. If you have symptoms, see a doctor. If you have an emergency, call 911/108/112.

That paragraph is also what the API returns as the `disclaimer` field on every health-related endpoint.
