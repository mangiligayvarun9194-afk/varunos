"""
VarunOS extra endpoints.

The original server.py has the "core" 17 endpoints (workout calc, diet calc,
surveillance risk scores, doctor share, etc.). This module adds the rest
that real-world MVP needs:

  Auth / Profile / Surveillance consent
    POST /v1/auth/check             - healthcheck for the auth header
    GET  /v1/user/profile           - get the current user profile
    PUT  /v1/user/profile           - update profile
    POST /v1/user/surveillance      - opt-in / opt-out of health surveillance
    GET  /v1/user/surveillance      - read consent state

  Logs (persistence)
    POST /v1/logs/workouts          - persist a workout session + sets
    POST /v1/logs/meals             - persist a meal
    POST /v1/logs/checkins          - persist a daily check-in
    GET  /v1/logs/workouts          - list recent workouts
    GET  /v1/logs/meals             - list recent meals

  Health readings (consent-gated persistence)
    POST /v1/health/bp              - log BP, returns tier + persistence
    POST /v1/health/glucose         - log glucose, returns tier + persistence
    GET  /v1/health/recent          - list recent readings

  Observability (n8n writes these)
    POST /v1/observability/log      - record an event
    GET  /v1/observability/events    - list events
    POST /v1/observability/alert     - create an alert
    POST /v1/observability/ack       - acknowledge an alert
    POST /v1/observability/ack_check - check ack state

  Tiers recompute (n8n calls this)
    POST /v1/core/recompute_tiers   - recompute from a normalized payload
                                     returns TIER-ONLY output (no raw values)

  BP escalation (n8n calls this)
    POST /v1/surveillance/escalate/bp  - CRITICAL/URGENT/INFO routing

All endpoints are auth-required except /healthz.
All persistence endpoints respect surveillance consent.
"""

from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field

from varunos.auth import require_auth
from varunos.core import (
    DISCLAIMER, safe_action_label, is_medical_claim, redact_medical_claim,
)
from varunos.core.surveillance import (
    escalate_bp, escalate_glucose, escalate_afib, escalate_stroke_symptoms,
    bp_stage, BPStage, assess_bp,
)
from varunos.core.surveillance.cgm import cgm_metrics, tir_assessment
from varunos.core.surveillance.ascvd import ASCVDInput, ascvd_risk, ascvd_tier
from varunos.core.surveillance.idrs import assess_from_raw
from varunos.core import readiness_score, surveillance as surveillance_mod
from varunos import db


router = APIRouter(dependencies=[Depends(require_auth)])


# ---- Helper ---------------------------------------------------------------

def _user_id_from_default() -> str:
    """MVP: single-user mode. Replace with auth-resolved user_id later."""
    return os.environ.get("VARUNOS_USER_ID", "default")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- Auth check -----------------------------------------------------------

@router.get("/v1/auth/check")
def auth_check():
    """Confirms the API key is valid. Useful for the PWA to verify its key."""
    return {"ok": True, "user_id": _user_id_from_default(), "ts": _now()}


# ---- Profile --------------------------------------------------------------

class ProfileIn(BaseModel):
    name: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[float] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    activity: Optional[str] = None
    goal: Optional[str] = None
    workout_time_pref: Optional[str] = None   # morning | evening | flexible
    active_program: Optional[str] = None      # built-in or custom program name
    planned_per_week: Optional[int] = None    # target sessions/week
    avatar_url: Optional[str] = None          # Ready Player Me .glb for the 3D Twin


@router.get("/v1/user/profile")
def get_profile():
    uid = _user_id_from_default()
    p = db.get_profile(uid)
    if not p:
        return {"user_id": uid, "exists": False}
    return {"user_id": uid, "exists": True, "profile": p}


@router.put("/v1/user/profile")
def put_profile(payload: ProfileIn):
    uid = _user_id_from_default()
    p = db.upsert_profile(uid, payload.model_dump(exclude_none=True))
    return {"user_id": uid, "profile": p}


# ---- Surveillance consent -------------------------------------------------

class ConsentIn(BaseModel):
    on: bool
    acknowledged_medical_disclaimer: bool = False


@router.get("/v1/user/surveillance")
def get_consent():
    uid = _user_id_from_default()
    on = db.get_surveillance_consent(uid)
    return {"user_id": uid, "surveillance_on": on,
            "disclaimer": DISCLAIMER}


@router.post("/v1/user/surveillance")
def set_consent(payload: ConsentIn):
    uid = _user_id_from_default()
    if payload.on and not payload.acknowledged_medical_disclaimer:
        raise HTTPException(
            status_code=400,
            detail="You must acknowledge_medical_disclaimer=true to enable surveillance.",
        )
    out = db.set_surveillance_consent(uid, payload.on)
    out["disclaimer"] = DISCLAIMER
    return out


# ---- Logs: workouts, meals, checkins -------------------------------------

class SetIn(BaseModel):
    exercise_id: str
    set_index: int
    weight_kg: float
    reps: int
    rpe: Optional[float] = None
    tempo: Optional[str] = None
    rest_s: Optional[int] = None


class WorkoutIn(BaseModel):
    program: str
    day_name: str
    week: int
    day_index: int
    decision: str
    duration_min: Optional[int] = None
    avg_rpe: Optional[float] = None
    total_volume_kg: Optional[float] = None
    notes: Optional[str] = None
    sets: list[SetIn] = Field(default_factory=list)


@router.post("/v1/logs/workouts")
def log_workout(payload: WorkoutIn):
    uid = _user_id_from_default()
    wid = db.create_workout_log(uid, payload.model_dump(exclude={"sets"}))
    set_ids = []
    for s in payload.sets:
        sid = db.add_set(uid, wid, s.exercise_id, s.set_index,
                         s.weight_kg, s.reps, s.rpe)
        set_ids.append(sid)
        db.log_event(uid, "set_logged", channel="api",
                     payload={"workout_id": wid, "set_id": sid,
                              "exercise": s.exercise_id, "kg": s.weight_kg,
                              "reps": s.reps, "rpe": s.rpe})
    return {"workout_id": wid, "set_ids": set_ids}


@router.get("/v1/logs/workouts")
def list_workouts(limit: int = Query(20, ge=1, le=200)):
    uid = _user_id_from_default()
    return {"workouts": db.list_workout_logs(uid, limit)}


class MealIn(BaseModel):
    food_id: str
    portions: float = 1.0
    context: str = ""
    kcal: Optional[float] = None
    p_g: Optional[float] = None
    c_g: Optional[float] = None
    f_g: Optional[float] = None


@router.post("/v1/logs/meals")
def log_meal(payload: MealIn):
    uid = _user_id_from_default()
    # If macros not provided, look them up in the deterministic food DB
    if payload.kcal is None or payload.p_g is None or payload.c_g is None or payload.f_g is None:
        from varunos.core.diet import food_macros
        try:
            m = food_macros(payload.food_id, portions=payload.portions)
        except KeyError:
            raise HTTPException(404, f"Food not found: {payload.food_id}. Use /v1/foods/search to find valid IDs.")
        kcal = m["kcal"]; p = m["p"]; c = m["c"]; f = m["f"]
    else:
        kcal, p, c, f = payload.kcal, payload.p_g, payload.c_g, payload.f_g

    mid = db.add_meal(uid, payload.food_id, payload.portions,
                      kcal, p, c, f, payload.context)
    db.log_event(uid, "meal_logged", channel="api",
                 payload={"meal_id": mid, "food_id": payload.food_id,
                          "kcal": kcal, "p": p, "c": c, "f": f})
    # Day total
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_total = db.day_kcal(uid, today)
    return {"meal_id": mid, "kcal": kcal, "p": p, "c": c, "f": f,
            "day_kcal_total": day_total}


@router.get("/v1/logs/meals")
def list_meals(since: Optional[str] = None, limit: int = Query(50, ge=1, le=200)):
    uid = _user_id_from_default()
    return {"meals": db.list_meals(uid, since_iso=since)[:limit]}


class CheckinIn(BaseModel):
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today UTC
    hrv_today_ms: Optional[float] = None
    hrv_7d_baseline_ms: Optional[float] = None
    rhr_today_bpm: Optional[float] = None
    rhr_30d_baseline_bpm: Optional[float] = None
    sleep_min: Optional[int] = None
    sleep_deep_pct: Optional[float] = None
    sleep_rem_pct: Optional[float] = None
    sleep_eff_pct: Optional[float] = None
    sleep_continuity_min: Optional[int] = 0
    energy_1to5: Optional[int] = None
    soreness_1to5: Optional[int] = None
    mood_1to5: Optional[int] = None
    stress_1to5: Optional[int] = None
    hunger_1to5: Optional[int] = None
    acute_load: Optional[float] = None
    chronic_load: Optional[float] = None
    notes: Optional[str] = None


class SimpleReadinessIn(BaseModel):
    """Human-first readiness inputs — answers a person knows on waking."""
    sleep_hours: float = 7.0
    sleep_quality_1to5: int = 3
    energy_1to5: int = 3
    soreness_1to5: int = 3
    mood_1to5: int = 3
    stress_1to5: int = 3
    # Optional: only if the user has a wearable
    hrv_today_ms: Optional[float] = None
    hrv_baseline_ms: Optional[float] = None
    rhr_today_bpm: Optional[float] = None
    rhr_baseline_bpm: Optional[float] = None


@router.post("/v1/readiness/simple")
def readiness_simple_endpoint(payload: SimpleReadinessIn):
    """Compute readiness from simple human answers. No wearable needed."""
    from varunos.core.readiness import readiness_simple
    return readiness_simple(
        sleep_hours=payload.sleep_hours,
        sleep_quality_1to5=payload.sleep_quality_1to5,
        energy_1to5=payload.energy_1to5,
        soreness_1to5=payload.soreness_1to5,
        mood_1to5=payload.mood_1to5,
        stress_1to5=payload.stress_1to5,
        hrv_today_ms=payload.hrv_today_ms,
        hrv_baseline_ms=payload.hrv_baseline_ms,
        rhr_today_bpm=payload.rhr_today_bpm,
        rhr_baseline_bpm=payload.rhr_baseline_bpm,
    )


@router.get("/v1/logs/checkins")
def get_checkin_today(date: Optional[str] = None):
    """Get the check-in for a given date (default today). Returns null if none logged."""
    uid = _user_id_from_default()
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = db.get_checkin(uid, target)
    return {"date": target, "checkin": row}


# ---- Insight engine: personal correlations + early warnings ----------------

def _build_daily_features(uid: str, days: int = 60) -> list[dict]:
    """Assemble one feature row per day from check-ins, meals and workouts."""
    from varunos.core.readiness import (
        compute_readiness, wellness_score,
        sleep_score_from_components, sleep_score_from_hours_quality,
    )
    checkins = db.list_checkins(uid, days)
    by_date: dict[str, dict] = {}

    for ci in checkins:
        d = ci["date"]
        feat: dict = {"date": d}
        if ci.get("hrv_today_ms"):
            feat["hrv"] = ci["hrv_today_ms"]
        if ci.get("rhr_today_bpm"):
            feat["rhr"] = ci["rhr_today_bpm"]
        if ci.get("sleep_min"):
            feat["sleep_hours"] = round(ci["sleep_min"] / 60, 2)
        if ci.get("steps"):
            feat["steps"] = ci["steps"]
        if ci.get("stress_1to5") is not None:
            feat["stress"] = ci["stress_1to5"]
        # Per-day readiness (recomputed deterministically)
        sleep = None
        if ci.get("sleep_min"):
            if ci.get("wearable_source"):
                sleep = sleep_score_from_components(
                    duration_min=ci["sleep_min"],
                    deep_pct=ci.get("sleep_deep_pct") if ci.get("sleep_deep_pct") is not None else -1,
                    rem_pct=ci.get("sleep_rem_pct") if ci.get("sleep_rem_pct") is not None else -1,
                    efficiency_pct=ci.get("sleep_eff_pct") if ci.get("sleep_eff_pct") is not None else 85,
                )
            else:
                hrs = ci["sleep_min"] / 60
                q = max(1, min(5, round(((ci.get("sleep_eff_pct") or 82) - 55) / 9)))
                sleep = sleep_score_from_hours_quality(hrs, q)
        well = None
        if ci.get("energy_1to5") is not None:
            well = wellness_score(
                energy_1to5=ci["energy_1to5"], soreness_1to5=ci.get("soreness_1to5", 3),
                mood_1to5=ci.get("mood_1to5", 3), stress_1to5=ci.get("stress_1to5", 3))
        if sleep is not None or well is not None:
            rd = compute_readiness(
                sleep=sleep, wellness=well,
                hrv_today_ms=ci.get("hrv_today_ms"), hrv_baseline_ms=ci.get("hrv_7d_baseline_ms"),
                rhr_today_bpm=ci.get("rhr_today_bpm"), rhr_baseline_bpm=ci.get("rhr_30d_baseline_bpm"))
            feat["readiness"] = rd["overall"]
        by_date[d] = feat

    # Meals → daily kcal + "late meal" flag (any item after 21:00 local-ish/UTC)
    for m in db.list_meals(uid):
        ts = m.get("ts", "")
        d = ts[:10]
        if not d:
            continue
        f = by_date.setdefault(d, {"date": d})
        f["kcal"] = f.get("kcal", 0) + (m.get("kcal") or 0)
        try:
            hour = int(ts[11:13])
            if hour >= 21:
                f["late_meal"] = 1
        except Exception:
            pass
    # default late_meal=0 for days that had any meal logged
    for f in by_date.values():
        if "kcal" in f and "late_meal" not in f:
            f["late_meal"] = 0

    # Workouts → training load (set count proxy)
    for w in db.list_workout_logs(uid, limit=200):
        d = (w.get("ts") or "")[:10]
        if not d:
            continue
        f = by_date.setdefault(d, {"date": d})
        f["training_load"] = f.get("training_load", 0) + 1

    return [by_date[k] for k in sorted(by_date)]


@router.get("/v1/insights")
def get_insights():
    """Personal patterns: correlations + early-warning anomalies, computed
    deterministically from the user's own history."""
    from varunos.core.insights import build_insights
    uid = _user_id_from_default()
    daily = _build_daily_features(uid)
    result = build_insights(daily)
    result["disclaimer"] = DISCLAIMER
    return result


# ---- Readiness forecast ---------------------------------------------------

@router.get("/v1/readiness/forecast")
def readiness_forecast():
    """Project tomorrow's readiness from recent trend + sleep + load."""
    from varunos.core.forecast import forecast_readiness
    uid = _user_id_from_default()
    daily = _build_daily_features(uid)
    recent = [d["readiness"] for d in daily if d.get("readiness") is not None][-10:]
    if len(recent) < 3:
        return {"available": False,
                "reason": "Need at least 3 days of readiness history."}
    last = daily[-1] if daily else {}
    fc = forecast_readiness(
        recent,
        last_sleep_hours=last.get("sleep_hours"),
        trained_today=bool(last.get("training_load")),
    )
    return {"available": True, **(fc or {})}


# ---- Environmental context (AQI + weather → training advice) --------------

class LocationIn(BaseModel):
    city: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


def _geocode(city: str) -> Optional[dict]:
    import httpx
    try:
        r = httpx.get("https://geocoding-api.open-meteo.com/v1/search",
                      params={"name": city, "count": 1}, timeout=8)
        results = r.json().get("results") or []
        if results:
            g = results[0]
            return {"lat": g["latitude"], "lon": g["longitude"],
                    "city": f"{g['name']}, {g.get('country_code','')}"}
    except Exception:
        return None
    return None


@router.post("/v1/context/location")
def set_location(payload: LocationIn):
    uid = _user_id_from_default()
    if payload.city and (payload.lat is None or payload.lon is None):
        g = _geocode(payload.city)
        if not g:
            raise HTTPException(404, f"Could not find location: {payload.city}")
        db.upsert_profile(uid, g)
        return {"saved": True, **g}
    if payload.lat is not None and payload.lon is not None:
        data = {"lat": payload.lat, "lon": payload.lon, "city": payload.city or "Custom"}
        db.upsert_profile(uid, data)
        return {"saved": True, **data}
    raise HTTPException(400, "Provide a city name or lat+lon.")


@router.get("/v1/context/today")
def context_today():
    """Live weather + air quality for the user's location, with training advice."""
    from varunos.core.context import training_advice, aqi_category
    import httpx
    uid = _user_id_from_default()
    p = db.get_profile(uid) or {}
    lat, lon = p.get("lat"), p.get("lon")
    if lat is None or lon is None:
        return {"available": False,
                "reason": "Set your location first (Settings → location)."}
    out: dict = {"available": True, "city": p.get("city")}
    try:
        w = httpx.get("https://api.open-meteo.com/v1/forecast", params={
            "latitude": lat, "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,weather_code",
        }, timeout=8).json().get("current", {})
        temp = w.get("temperature_2m")
        hum = w.get("relative_humidity_2m")
        out["weather"] = {"temp_c": temp, "humidity_pct": hum}
    except Exception:
        temp = hum = None
    try:
        aq = httpx.get("https://air-quality-api.open-meteo.com/v1/air-quality", params={
            "latitude": lat, "longitude": lon, "current": "us_aqi,pm2_5",
        }, timeout=8).json().get("current", {})
        aqi = aq.get("us_aqi")
        if aqi is not None:
            label, color = aqi_category(aqi)
            out["air_quality"] = {"us_aqi": aqi, "label": label, "color": color,
                                  "pm2_5": aq.get("pm2_5")}
    except Exception:
        aqi = None
    out["advice"] = training_advice(us_aqi=aqi, temp_c=temp, humidity_pct=hum)
    return out


# ---- The Brain (tier-only coaching; LLM optional) ------------------------

class CoachAskIn(BaseModel):
    question: str


@router.post("/v1/coach/ask")
def coach_ask(payload: CoachAskIn):
    """Coaching answer. Uses an LLM if ANTHROPIC_API_KEY is set, else a
    deterministic template narrator. Either way the brain sees TIERS ONLY."""
    from varunos.core.brain import build_brain_context, narrate_template, SAFE_SYSTEM_PROMPT
    from varunos.core.insights import build_insights
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Gather tier-only context
    readiness = readiness_today(today)
    readiness = readiness if readiness.get("has_data") else None
    profile = db.get_profile(uid) or {}
    diet = None
    if profile.get("weight_kg"):
        from varunos.core.diet import bmr_mifflin, tdee, goal_kcal, macros
        bmr = bmr_mifflin(sex=profile.get("sex", "M"), weight_kg=profile["weight_kg"],
                          height_cm=profile.get("height_cm", 175), age=profile.get("age", 30))
        tv = tdee(bmr=bmr, activity=profile.get("activity", "moderate"))
        tk = goal_kcal(tdee_value=tv, goal=profile.get("goal", "recomp"))
        m = macros(kcal=tk, weight_kg=profile["weight_kg"], goal=profile.get("goal", "recomp"),
                   sex=profile.get("sex", "M"))
        diet = {"target_kcal": tk, "protein_g": m.protein_g, "fat_g": m.fat_g, "carbs_g": m.carbs_g}
    meals = db.list_meals(uid)
    consumed = sum(mm.get("kcal", 0) for mm in meals if (mm.get("ts") or "").startswith(today))
    insights = build_insights(_build_daily_features(uid))

    ctx = build_brain_context(readiness=readiness, diet=diet, insights=insights,
                              consumed_kcal=consumed or None)

    answer = _llm_or_template(payload.question, ctx, SAFE_SYSTEM_PROMPT)
    db.log_event(uid, "coach_ask", channel="api", payload={"q": payload.question[:120]})
    return {"answer": answer, "context_used": list(ctx.keys()),
            "engine": "llm" if os.environ.get("ANTHROPIC_API_KEY") else "deterministic",
            "disclaimer": DISCLAIMER}


def _llm_or_template(question: str, ctx: dict, system: str) -> str:
    from varunos.core.brain import narrate_template
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return narrate_template(question, ctx)
    try:
        import httpx, json as _json
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={
                "model": os.environ.get("VARUNOS_LLM_MODEL", "claude-3-5-haiku-latest"),
                "max_tokens": 350,
                "system": system,
                "messages": [{"role": "user", "content":
                    f"My data (tiers only, no raw values):\n{_json.dumps(ctx, indent=2)}\n\n"
                    f"Question: {question}"}],
            }, timeout=30)
        if r.status_code == 200:
            blocks = r.json().get("content", [])
            text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
            return text.strip() or narrate_template(question, ctx)
        return narrate_template(question, ctx)
    except Exception:
        return narrate_template(question, ctx)


# ---- Cloud wearable connectors (OAuth: Fitbit / Oura) --------------------

_PROVIDERS = {
    "fitbit": {
        "authorize": "https://www.fitbit.com/oauth2/authorize",
        "token": "https://api.fitbit.com/oauth2/token",
        "scope": "heartrate sleep activity",
        "client_id_env": "FITBIT_CLIENT_ID",
        "client_secret_env": "FITBIT_CLIENT_SECRET",
    },
    "oura": {
        "authorize": "https://cloud.ouraring.com/oauth/authorize",
        "token": "https://api.ouraring.com/oauth/token",
        "scope": "daily heartrate",
        "client_id_env": "OURA_CLIENT_ID",
        "client_secret_env": "OURA_CLIENT_SECRET",
    },
}


@router.get("/v1/connect/providers")
def connect_providers():
    """Which cloud wearables are configured (have credentials) and connected."""
    uid = _user_id_from_default()
    connected = db.list_connected_providers(uid)
    out = []
    for name, cfg in _PROVIDERS.items():
        out.append({
            "provider": name,
            "configured": bool(os.environ.get(cfg["client_id_env"])),
            "connected": name in connected,
        })
    return {"providers": out,
            "note": "Apple Health (via the Shortcut) needs no OAuth and covers most devices."}


@router.get("/v1/connect/{provider}/start")
def connect_start(provider: str, redirect_uri: str):
    """Return the provider's authorize URL to open in a browser."""
    cfg = _PROVIDERS.get(provider)
    if not cfg:
        raise HTTPException(404, f"Unknown provider: {provider}")
    client_id = os.environ.get(cfg["client_id_env"])
    if not client_id:
        raise HTTPException(503, f"{provider} not configured. Set {cfg['client_id_env']} "
                                 f"and {cfg['client_secret_env']} on the server.")
    import urllib.parse
    params = urllib.parse.urlencode({
        "response_type": "code", "client_id": client_id,
        "scope": cfg["scope"], "redirect_uri": redirect_uri,
    })
    return {"authorize_url": f"{cfg['authorize']}?{params}"}


class OAuthCallbackIn(BaseModel):
    code: str
    redirect_uri: str


@router.post("/v1/connect/{provider}/callback")
def connect_callback(provider: str, payload: OAuthCallbackIn):
    """Exchange an auth code for tokens and store them."""
    cfg = _PROVIDERS.get(provider)
    if not cfg:
        raise HTTPException(404, f"Unknown provider: {provider}")
    cid = os.environ.get(cfg["client_id_env"])
    secret = os.environ.get(cfg["client_secret_env"])
    if not cid or not secret:
        raise HTTPException(503, f"{provider} not configured.")
    import httpx, base64
    uid = _user_id_from_default()
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    try:
        r = httpx.post(cfg["token"], headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        }, data={
            "grant_type": "authorization_code", "code": payload.code,
            "redirect_uri": payload.redirect_uri, "client_id": cid,
        }, timeout=20)
        tok = r.json()
        if "access_token" not in tok:
            raise HTTPException(400, f"Token exchange failed: {tok}")
        db.save_oauth_token(uid, provider, access_token=tok["access_token"],
                            refresh_token=tok.get("refresh_token"),
                            expires_at=str(tok.get("expires_in")),
                            scope=tok.get("scope"))
        return {"connected": True, "provider": provider}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"OAuth error: {e}")


# ---- Wearable sync (Apple Health Shortcut / Fitbit / Oura / Whoop / Garmin) ----

class WearableSyncIn(BaseModel):
    """Normalized payload from ANY wearable source.

    Apple Health Shortcut, Fitbit, Oura, Whoop and Garmin all map onto this.
    Every field is optional — send whatever the source provides.
    """
    date: Optional[str] = None
    source: str = "apple_health"
    hrv_ms: Optional[float] = None              # overnight HRV (SDNN/rMSSD)
    rhr_bpm: Optional[float] = None             # resting heart rate
    sleep_hours: Optional[float] = None
    sleep_minutes: Optional[int] = None
    sleep_deep_pct: Optional[float] = None
    sleep_rem_pct: Optional[float] = None
    sleep_efficiency_pct: Optional[float] = None
    steps: Optional[int] = None
    active_kcal: Optional[float] = None
    spo2: Optional[float] = None
    weight_kg: Optional[float] = None


@router.post("/v1/sync/wearable")
def sync_wearable(payload: WearableSyncIn):
    """Ingest one day of wearable metrics, compute rolling baselines, and
    return today's readiness — fully automatic, no taps required."""
    from varunos.core.readiness import (
        compute_readiness, wellness_score,
        sleep_score_from_components, sleep_score_from_hours_quality,
    )
    uid = _user_id_from_default()
    date = payload.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    sleep_min = payload.sleep_minutes
    if sleep_min is None and payload.sleep_hours is not None:
        sleep_min = int(round(payload.sleep_hours * 60))

    # Rolling baselines from history (excluding today)
    hrv_base = db.hrv_baseline(uid, date) if payload.hrv_ms else None
    rhr_base = db.rhr_baseline(uid, date) if payload.rhr_bpm else None
    # First reading ever? Seed baseline with today's value so it isn't penalized.
    if payload.hrv_ms and not hrv_base:
        hrv_base = payload.hrv_ms
    if payload.rhr_bpm and not rhr_base:
        rhr_base = payload.rhr_bpm

    db.merge_checkin(uid, date, {
        "hrv_today_ms": payload.hrv_ms,
        "hrv_7d_baseline_ms": hrv_base,
        "rhr_today_bpm": payload.rhr_bpm,
        "rhr_30d_baseline_bpm": rhr_base,
        "sleep_min": sleep_min,
        "sleep_deep_pct": payload.sleep_deep_pct,
        "sleep_rem_pct": payload.sleep_rem_pct,
        "sleep_eff_pct": payload.sleep_efficiency_pct,
        "steps": payload.steps,
        "active_kcal": payload.active_kcal,
        "spo2": payload.spo2,
        "wearable_source": payload.source,
        "synced_at": _now(),
    })
    if payload.weight_kg:
        db.upsert_profile(uid, {"weight_kg": payload.weight_kg})

    db.log_event(uid, "wearable_synced", channel=payload.source, payload={
        "hrv": payload.hrv_ms, "rhr": payload.rhr_bpm, "sleep_min": sleep_min,
        "steps": payload.steps,
    })

    # Also append to the canonical event spine (idempotent per source+kind+day)
    _ev_ts = f"{date}T00:00:00+00:00"
    for kind, val, unit in [
        ("hrv", payload.hrv_ms, "ms"), ("rhr", payload.rhr_bpm, "bpm"),
        ("sleep", sleep_min, "min"), ("steps", payload.steps, "count"),
        ("active_kcal", payload.active_kcal, "kcal"), ("spo2", payload.spo2, "%"),
        ("weight", payload.weight_kg, "kg"),
    ]:
        if val is not None:
            db.add_health_event(uid, kind, {"v": val}, source=payload.source,
                                ts=_ev_ts, unit=unit)

    # Sleep sub-score from whatever sleep data we have
    sleep = None
    if sleep_min:
        sleep = sleep_score_from_components(
            duration_min=sleep_min,
            deep_pct=payload.sleep_deep_pct if payload.sleep_deep_pct is not None else -1,
            rem_pct=payload.sleep_rem_pct if payload.sleep_rem_pct is not None else -1,
            efficiency_pct=payload.sleep_efficiency_pct if payload.sleep_efficiency_pct is not None else 85,
        )

    # Fold in subjective wellness if the user already did a manual check-in today
    ci = db.get_checkin(uid, date) or {}
    wellness = None
    if ci.get("energy_1to5") is not None:
        wellness = wellness_score(
            energy_1to5=ci["energy_1to5"], soreness_1to5=ci.get("soreness_1to5", 3),
            mood_1to5=ci.get("mood_1to5", 3), stress_1to5=ci.get("stress_1to5", 3),
        )

    readiness = compute_readiness(
        sleep=sleep, wellness=wellness,
        hrv_today_ms=payload.hrv_ms, hrv_baseline_ms=hrv_base,
        rhr_today_bpm=payload.rhr_bpm, rhr_baseline_bpm=rhr_base,
    )
    return {
        "synced": True, "date": date, "source": payload.source,
        "baselines": {"hrv_7d": hrv_base, "rhr_30d": rhr_base},
        "readiness": readiness,
        "disclaimer": DISCLAIMER,
    }


@router.get("/v1/sync/status")
def sync_status():
    """When did we last sync, from what, and what's the latest snapshot."""
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ci = db.get_checkin(uid, today)
    if not ci or not ci.get("synced_at"):
        return {"connected": False, "last_sync": None, "source": None}
    return {
        "connected": True,
        "last_sync": ci.get("synced_at"),
        "source": ci.get("wearable_source"),
        "today": {
            "hrv_ms": ci.get("hrv_today_ms"),
            "rhr_bpm": ci.get("rhr_today_bpm"),
            "sleep_min": ci.get("sleep_min"),
            "steps": ci.get("steps"),
            "active_kcal": ci.get("active_kcal"),
            "spo2": ci.get("spo2"),
        },
    }


@router.get("/v1/readiness/today")
def readiness_today(date: Optional[str] = None):
    """Server-computed readiness for today from whatever is stored (manual taps,
    wearable sync, or both). Single source of truth for the Today screen."""
    from varunos.core.readiness import (
        compute_readiness, wellness_score,
        sleep_score_from_components, sleep_score_from_hours_quality,
    )
    uid = _user_id_from_default()
    d = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ci = db.get_checkin(uid, d)
    has_subjective = bool(ci and ci.get("energy_1to5") is not None)
    has_wearable = bool(ci and (ci.get("hrv_today_ms") or ci.get("sleep_min")))
    if not ci or (not has_subjective and not has_wearable):
        return {"has_data": False}

    # Sleep sub-score
    sleep = None
    if ci.get("sleep_min"):
        if ci.get("wearable_source"):
            sleep = sleep_score_from_components(
                duration_min=ci["sleep_min"],
                deep_pct=ci.get("sleep_deep_pct") if ci.get("sleep_deep_pct") is not None else -1,
                rem_pct=ci.get("sleep_rem_pct") if ci.get("sleep_rem_pct") is not None else -1,
                efficiency_pct=ci.get("sleep_eff_pct") if ci.get("sleep_eff_pct") is not None else 85,
            )
        else:
            hours = ci["sleep_min"] / 60
            quality = max(1, min(5, round(((ci.get("sleep_eff_pct") or 82) - 55) / 9)))
            sleep = sleep_score_from_hours_quality(hours, quality)

    wellness = None
    if has_subjective:
        wellness = wellness_score(
            energy_1to5=ci["energy_1to5"], soreness_1to5=ci.get("soreness_1to5", 3),
            mood_1to5=ci.get("mood_1to5", 3), stress_1to5=ci.get("stress_1to5", 3),
        )

    r = compute_readiness(
        sleep=sleep, wellness=wellness,
        hrv_today_ms=ci.get("hrv_today_ms"), hrv_baseline_ms=ci.get("hrv_7d_baseline_ms"),
        rhr_today_bpm=ci.get("rhr_today_bpm"), rhr_baseline_bpm=ci.get("rhr_30d_baseline_bpm"),
    )
    r["has_data"] = True
    r["source"] = ci.get("wearable_source") or "manual"
    r["synced_at"] = ci.get("synced_at")
    return r


@router.post("/v1/logs/checkins")
def log_checkin(payload: CheckinIn):
    uid = _user_id_from_default()
    date = payload.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    data = payload.model_dump(exclude={"date"}, exclude_none=True)
    # merge so a manual mood check-in never wipes wearable HRV/sleep (and vice-versa)
    row = db.merge_checkin(uid, date, data)
    db.log_event(uid, "checkin_logged", channel="api",
                 payload={"date": date, "energy": data.get("energy_1to5")})
    return {"date": date, "checkin": row}


# ---- Health readings (consent-gated) -------------------------------------

class BPIn(BaseModel):
    sbp: int
    dbp: int
    symptomatic: bool = False
    symptoms: list[str] = Field(default_factory=list)
    source: str = "manual"


@router.post("/v1/health/bp")
def log_bp(payload: BPIn):
    """Log a BP reading.

    If surveillance is on, persists the raw value. If off, returns the
    tier only and does not persist raw biomarkers.

    Returns: stage, tier, escalation (if any), action_label.
    """
    uid = _user_id_from_default()
    stage = bp_stage(payload.sbp, payload.dbp)
    assess = assess_bp(payload.sbp, payload.dbp)
    esc = escalate_bp(sbp=payload.sbp, dbp=payload.dbp,
                      symptomatic=payload.symptomatic,
                      symptoms=payload.symptoms)

    out = {
        "user_id": uid,
        "stage": assess["stage"],
        "tier": assess["tier"],
        "action_label": safe_action_label(assess["tier"]),
        "pulse_pressure": assess["pulse_pressure"],
        "map": assess["map"],
        "escalation": esc,
        "persisted": False,
    }

    if db.get_surveillance_consent(uid):
        from varunos.core.surveillance.bp import bp_tier as _bp_tier
        db.add_health_reading(
            user_id=uid, kind="bp",
            value={"sbp": payload.sbp, "dbp": payload.dbp, "pulse": assess["pulse_pressure"]},
            unit="mmHg", source=payload.source,
            tier=assess["tier"],
            tier_reason=f"Stage {assess['stage']}",
        )
        out["persisted"] = True

    db.log_event(uid, "bp_reading", channel="api",
                 payload={"sbp": payload.sbp, "dbp": payload.dbp,
                          "tier": assess["tier"], "escalation_level": esc["level"]})

    if esc["level"] in ("CRITICAL", "URGENT"):
        event_id = f"bp_{uid}_{int(datetime.now(timezone.utc).timestamp())}"
        db.create_alert(event_id, uid)

    out["disclaimer"] = DISCLAIMER
    return out


class GlucoseIn(BaseModel):
    value_mgdl: float
    context: str = "random"
    symptomatic: bool = False
    source: str = "manual"


@router.post("/v1/health/glucose")
def log_glucose(payload: GlucoseIn):
    uid = _user_id_from_default()
    esc = escalate_glucose(value_mgdl=payload.value_mgdl, symptomatic=payload.symptomatic)
    if payload.value_mgdl < 70:
        tier = "ELEVATED" if payload.value_mgdl >= 54 else "CRITICAL"
    elif payload.value_mgdl > 180:
        tier = "ELEVATED" if payload.value_mgdl <= 300 else "CRITICAL"
    else:
        tier = "LOW"

    out = {
        "user_id": uid,
        "value_mgdl": payload.value_mgdl,
        "tier": tier,
        "action_label": safe_action_label(tier),
        "escalation": esc,
        "persisted": False,
    }

    if db.get_surveillance_consent(uid):
        db.add_health_reading(
            user_id=uid, kind="glucose",
            value={"mgdl": payload.value_mgdl, "context": payload.context},
            unit="mg/dL", source=payload.source,
            tier=tier, tier_reason=esc.get("level", ""),
        )
        out["persisted"] = True

    db.log_event(uid, "glucose_reading", channel="api",
                 payload={"mgdl": payload.value_mgdl, "tier": tier,
                          "escalation_level": esc["level"]})

    if esc["level"] in ("CRITICAL", "URGENT"):
        event_id = f"glu_{uid}_{int(datetime.now(timezone.utc).timestamp())}"
        db.create_alert(event_id, uid)

    out["disclaimer"] = DISCLAIMER
    return out


@router.get("/v1/health/recent")
def list_recent_health(kind: Optional[str] = None, limit: int = Query(50, ge=1, le=200)):
    """List recent health readings. Requires surveillance consent."""
    uid = _user_id_from_default()
    if not db.get_surveillance_consent(uid):
        raise HTTPException(
            status_code=403,
            detail="Surveillance is off. Enable it in /v1/user/surveillance to read health history.",
        )
    return {"readings": db.list_health_readings(uid, kind=kind, limit=limit)}


# ---- Observability (n8n writes these) -------------------------------------

class ObservabilityEvent(BaseModel):
    kind: str
    user_id: Optional[str] = None
    channel: Optional[str] = None
    payload: Optional[dict] = None


@router.post("/v1/observability/log")
def observability_log(payload: ObservabilityEvent):
    uid = payload.user_id or _user_id_from_default()
    eid = db.log_event(uid, payload.kind, channel=payload.channel, payload=payload.payload)
    return {"event_id": eid, "logged": True}


@router.get("/v1/observability/events")
def observability_events(kind: Optional[str] = None, limit: int = Query(50, ge=1, le=200)):
    uid = _user_id_from_default()
    return {"events": db.list_events(uid, kind=kind, limit=limit)}


class AlertIn(BaseModel):
    event_id: Optional[str] = None
    user_id: Optional[str] = None


@router.post("/v1/observability/alert")
def create_alert(payload: AlertIn):
    uid = payload.user_id or _user_id_from_default()
    eid = payload.event_id or f"evt_{uid}_{int(datetime.now(timezone.utc).timestamp())}"
    aid = db.create_alert(eid, uid)
    return {"event_id": eid, "alert_id": aid}


class AckIn(BaseModel):
    event_id: str
    acked_via: str = "user"


@router.post("/v1/observability/ack")
def ack_alert(payload: AckIn):
    return db.acknowledge_alert(payload.event_id, payload.acked_via)


@router.post("/v1/observability/ack_check")
def ack_check(payload: AckIn):
    return db.check_alert(payload.event_id)


# ---- Tiers recompute (n8n calls this) -------------------------------------

class RecomputeTiersIn(BaseModel):
    """Normalized payload from any health/fitness source.

    The brain / narrative layer ONLY sees the tier output — never the raw
    values. This endpoint enforces that boundary.
    """
    user_id: Optional[str] = None
    bp: Optional[dict] = None              # {"sbp": 120, "dbp": 80}
    glucose: Optional[dict] = None         # {"mgdl": 95, "context": "fasting"}
    heart_rate: Optional[dict] = None      # {"bpm": 72}
    hrv: Optional[dict] = None             # {"ms": 50}
    weight: Optional[dict] = None           # {"kg": 78.4}
    sleep: Optional[dict] = None           # {"duration_min": 450, ...}
    readiness_inputs: Optional[dict] = None  # full readiness composite inputs


@router.post("/v1/core/recompute_tiers")
def recompute_tiers(payload: RecomputeTiersIn):
    """Recompute risk tiers and the readiness composite.

    Returns TIER-ONLY output. Raw values stay in the encrypted vault;
    this response is what the AI brain is allowed to see.
    """
    uid = payload.user_id or _user_id_from_default()
    out = {"user_id": uid, "ts": _now(), "tiers": {}, "readiness": None, "changed": False}

    # BP tier
    if payload.bp and "sbp" in payload.bp and "dbp" in payload.bp:
        s = bp_stage(int(payload.bp["sbp"]), int(payload.bp["dbp"]))
        from varunos.core.surveillance.bp import bp_tier
        out["tiers"]["bp"] = {"stage": s.value, "tier": bp_tier(s)}

    # Glucose tier
    if payload.glucose and "mgdl" in payload.glucose:
        v = float(payload.glucose["mgdl"])
        if v < 54: tier = "CRITICAL"
        elif v < 70: tier = "ELEVATED"
        elif v > 300: tier = "CRITICAL"
        elif v > 180: tier = "ELEVATED"
        else: tier = "LOW"
        out["tiers"]["glucose"] = {"tier": tier}

    # Readiness composite
    if payload.readiness_inputs:
        try:
            r = readiness_score(**payload.readiness_inputs)
            if r.overall >= 75: color = "GREEN"
            elif r.overall >= 50: color = "YELLOW"
            else: color = "RED"
            out["readiness"] = {"overall": round(r.overall, 1), "color": color,
                                "components": {
                                    "hrv": round(r.hrv, 1), "rhr": round(r.rhr, 1),
                                    "sleep": round(r.sleep, 1), "wellness": round(r.wellness, 1),
                                    "load": round(r.load, 1), "trend": round(r.trend, 1),
                                }}
        except Exception as e:
            out["readiness"] = {"error": str(e)}

    # CVD tier (if we have cholesterol + age + sbp)
    if payload.bp and "sbp" in payload.bp:
        # We don't have a full ASCVD input here; skip unless we get cholesterol
        pass

    # Log the recompute as an observability event
    db.log_event(uid, "tiers_recomputed", channel="n8n",
                 payload={"tiers": list(out["tiers"].keys())})

    return out


# ---- BP escalation (n8n calls this directly) -----------------------------

class BPescalateIn(BaseModel):
    sbp: int
    dbp: int
    symptomatic: bool = False
    symptoms: list[str] = Field(default_factory=list)


@router.post("/v1/surveillance/escalate/bp")
def surveillance_escalate_bp(payload: BPescalateIn):
    """Same as /v1/health/bp escalation, but the lighter version n8n uses
    when it just needs to know the routing decision (channels, tta_seconds)
    without persisting anything."""
    out = escalate_bp(sbp=payload.sbp, dbp=payload.dbp,
                      symptomatic=payload.symptomatic, symptoms=payload.symptoms)
    out["disclaimer"] = DISCLAIMER
    return out


# ---- CGM endpoint (used by the PWA / CGM adapters) ------------------------

class CGMIn(BaseModel):
    readings_mgdl: list[float]
    diabetic: bool = False


@router.post("/v1/health/cgm")
def log_cgm(payload: CGMIn):
    """Compute CGM metrics from a sensor stream. If surveillance is on, persist."""
    if not payload.readings_mgdl:
        raise HTTPException(400, "readings_mgdl must be non-empty")
    metrics = cgm_metrics(payload.readings_mgdl)
    assessment = tir_assessment(metrics, diabetic=payload.diabetic)
    uid = _user_id_from_default()
    persisted = False
    if db.get_surveillance_consent(uid):
        db.add_health_reading(
            user_id=uid, kind="cgm",
            value={"tir": metrics.tir_70_180_pct, "gmi": metrics.gmi_pct,
                   "avg_mgdl": metrics.avg_mgdl, "cv_pct": metrics.cv_pct},
            unit="mg/dL", source="cgm",
            tier=assessment["tier"],
            tier_reason="; ".join(assessment["flags"]) or "normal",
        )
        persisted = True
    return {"metrics": metrics, "assessment": assessment, "persisted": persisted}


# ---- Weekly report / daily summary (powers email, Notion, CLI) -----------

@router.get("/v1/report/daily")
def daily_report(date: Optional[str] = None):
    """Generate a structured daily summary. Powers email reports, Notion sync, CLI."""
    uid = _user_id_from_default()
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Meals
    all_meals = db.list_meals(uid)
    day_meals = [m for m in all_meals if m.get("ts", "").startswith(target_date)]
    total_kcal = sum(m.get("kcal", 0) for m in day_meals)
    total_p = sum(m.get("p_g", 0) for m in day_meals)
    total_c = sum(m.get("c_g", 0) for m in day_meals)
    total_f = sum(m.get("f_g", 0) for m in day_meals)

    # Workouts
    all_workouts = db.list_workout_logs(uid, limit=50)
    day_workouts = [w for w in all_workouts if w.get("ts", "").startswith(target_date)]

    # Checkin
    checkin = db.get_checkin(uid, target_date)

    # Health readings (if consented)
    health = []
    if db.get_surveillance_consent(uid):
        all_health = db.list_health_readings(uid, limit=50)
        health = [h for h in all_health if h.get("ts", "").startswith(target_date)]

    return {
        "user_id": uid,
        "date": target_date,
        "meals": {
            "count": len(day_meals),
            "total_kcal": round(total_kcal, 1),
            "total_protein_g": round(total_p, 1),
            "total_carbs_g": round(total_c, 1),
            "total_fat_g": round(total_f, 1),
            "items": [{"food": m["food_id"], "kcal": m["kcal"],
                       "context": m.get("context", "")} for m in day_meals],
        },
        "workouts": {
            "count": len(day_workouts),
            "sessions": [{"program": w["program"], "day": w["day_name"],
                          "decision": w["decision"]} for w in day_workouts],
        },
        "checkin": checkin,
        "health_readings": health,
    }


@router.get("/v1/report/weekly")
def weekly_report():
    """Generate a weekly summary. Powers email digest and Notion weekly page."""
    uid = _user_id_from_default()
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=6)

    all_meals = db.list_meals(uid, since_iso=week_start.isoformat())
    all_workouts = db.list_workout_logs(uid, limit=100)

    days = []
    total_kcal = 0
    workout_count = 0
    for i in range(7):
        d = (week_start + timedelta(days=i)).isoformat()
        day_meals = [m for m in all_meals if m.get("ts", "").startswith(d)]
        day_wk = [w for w in all_workouts if w.get("ts", "").startswith(d)]
        day_kcal = sum(m.get("kcal", 0) for m in day_meals)
        total_kcal += day_kcal
        workout_count += len(day_wk)
        days.append({
            "date": d,
            "kcal": round(day_kcal, 1),
            "meals": len(day_meals),
            "workouts": len(day_wk),
        })

    return {
        "user_id": uid,
        "week_start": week_start.isoformat(),
        "week_end": today.isoformat(),
        "summary": {
            "avg_daily_kcal": round(total_kcal / 7, 1),
            "total_workouts": workout_count,
            "total_meals_logged": len(all_meals),
        },
        "days": days,
    }


# ---- Custom programs (user-uploaded plans) ---------------------------------

class CustomProgramIn(BaseModel):
    """Same JSON schema as the built-in programs in data/programs/."""
    name: str
    goal: str = "custom"
    split: list[str] = Field(default_factory=list)
    days_per_week: int = 3
    weeks: int = 8
    deload_week: Optional[int] = None
    progression_rule: str = "double_progression"
    days: list[dict]   # [{name, exercises: [{id, sets, reps, intensity, rest_s}]}]


@router.post("/v1/programs/custom")
def upload_custom_program(payload: CustomProgramIn):
    """Upload your own training plan. Stored per-user; usable everywhere a
    built-in program is (PR detection, readiness auto-regulation, wake-up card)."""
    import json as _json
    uid = _user_id_from_default()
    if not payload.days:
        raise HTTPException(422, "Program must have at least one day")
    for d in payload.days:
        if not d.get("name") or not isinstance(d.get("exercises"), list) or not d["exercises"]:
            raise HTTPException(422, f"Each day needs a name and a non-empty exercises list (bad day: {d.get('name')!r})")
        for ex in d["exercises"]:
            if not ex.get("id"):
                raise HTTPException(422, f"Every exercise needs an id (day {d['name']})")
    data = payload.model_dump()
    db.save_custom_program(uid, payload.name, _json.dumps(data))
    db.upsert_profile(uid, {"active_program": payload.name})
    return {"saved": True, "name": payload.name, "days": len(payload.days),
            "active": True}


@router.get("/v1/programs/custom")
def list_custom():
    uid = _user_id_from_default()
    return {"custom_programs": db.list_custom_programs(uid)}


def _resolve_program(uid: str, name: str) -> Optional[dict]:
    """Custom program first, then the built-in JSON library. Returns plain dict."""
    custom = db.get_custom_program(uid, name)
    if custom:
        return custom
    try:
        from varunos.core.workouts import load_program
        p = load_program(name)
        return {"name": p.name, "days_per_week": p.days_per_week,
                "days": [{"name": d.name, "exercises": d.exercises} for d in p.days]}
    except FileNotFoundError:
        return None


# ---- Momentum + avatar -------------------------------------------------------

def _week_key(date_str: str):
    from datetime import date as _date
    return _date.fromisoformat(date_str[:10]).isocalendar()[:2]


def _momentum_state(uid: str, today: str) -> dict:
    """Shared assembly for /v1/momentum/today and /v1/avatar/state."""
    from datetime import date as _date, timedelta as _td
    from varunos.core import momentum as mo

    since = (_date.fromisoformat(today) - _td(days=90)).isoformat()
    all_sets = db.list_sets_since(uid, since)
    session_dates = db.list_workout_dates(uid)
    profile = db.get_profile(uid) or {}
    planned = profile.get("planned_per_week") or 3

    # Group sets by exercise and ISO week
    cur_wk = _week_key(today)
    prev_wk = _week_key((_date.fromisoformat(today) - _td(days=7)).isoformat())
    by_ex_week: dict[str, dict[tuple, list[dict]]] = {}
    for s in all_sets:
        if not s.get("weight_kg") or not s.get("reps"):
            continue
        wk = _week_key(s["ts"])
        by_ex_week.setdefault(s["exercise_id"], {}).setdefault(wk, []).append(s)

    # Week-over-week progress per exercise
    progress = []
    for ex, weeks in by_ex_week.items():
        if cur_wk in weeks and prev_wk in weeks:
            ev = mo.exercise_progress(ex, weeks[cur_wk], weeks[prev_wk])
            if ev:
                progress.append(ev)

    # PRs set today: best e1RM today beats everything before today
    pr_titles = []
    last_pr_date = None
    running_best: dict[str, float] = {}
    for s in sorted(all_sets, key=lambda x: x["ts"]):
        if not s.get("weight_kg") or not s.get("reps"):
            continue
        e1 = mo.best_1rm_estimate(s["weight_kg"], s["reps"])
        prev_best = running_best.get(s["exercise_id"])
        if prev_best is not None and e1 > prev_best:
            last_pr_date = s["ts"][:10]
            if s["ts"][:10] == today:
                pr_titles.append(
                    f"{s['exercise_id'].replace('_', ' ').title()} "
                    f"{s['weight_kg']:g} kg × {s['reps']} (e1RM {e1:.0f} kg)")
        running_best[s["exercise_id"]] = max(prev_best or 0, e1)

    events = mo.build_events(
        pr_titles=pr_titles, progress_events=progress,
        session_dates=session_dates, today=today, planned_per_week=planned,
    )
    best = mo.pick_best_event(events)

    # Avatar level inputs
    weekly_vol: dict[tuple, float] = {}
    for s in all_sets:
        if s.get("weight_kg") and s.get("reps"):
            wk = _week_key(s["ts"])
            weekly_vol[wk] = weekly_vol.get(wk, 0) + s["weight_kg"] * s["reps"]
    vols = [v for _, v in sorted(weekly_vol.items())][-4:]
    trend_pct = 0.0
    if len(vols) >= 2 and vols[0] > 0:
        trend_pct = ((vols[-1] / vols[0]) ** (1 / (len(vols) - 1)) - 1) * 100
    days_since_pr = None
    if last_pr_date:
        days_since_pr = (_date.fromisoformat(today) - _date.fromisoformat(last_pr_date)).days
    streak = mo.weekly_streak(session_dates, today)
    cons = mo.consistency_4w(session_dates, today, planned)
    level = mo.avatar_level(volume_trend_pct=trend_pct, streak_weeks=streak,
                            days_since_pr=days_since_pr, consistency=cons)
    return {
        "events": [e.to_dict() for e in events],
        "best_event": best.to_dict() if best else None,
        "streak_weeks": streak,
        "consistency_4w": cons,
        "volume_trend_pct_per_week": round(trend_pct, 1),
        "days_since_pr": days_since_pr,
        "avatar": mo.avatar_stage(level),
    }


@router.get("/v1/logs/sets/last")
def last_sets():
    """Most recent logged set per exercise — powers the 'beat this' prefill."""
    uid = _user_id_from_default()
    rows = db.list_sets_since(uid, "1970-01-01")
    latest: dict[str, dict] = {}
    for s in rows:  # oldest→newest, so later writes win
        if s.get("weight_kg") and s.get("reps"):
            latest[s["exercise_id"]] = {
                "weight_kg": s["weight_kg"], "reps": s["reps"],
                "rpe": s.get("rpe"), "ts": s["ts"],
            }
    return {"last_sets": latest}


@router.get("/v1/momentum/today")
def momentum_today():
    """Today's motivational state: at most ONE message worth pushing, plus the
    full event list and streak/consistency stats for the UI."""
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return _momentum_state(uid, today)


@router.get("/v1/avatar/state")
def avatar_state():
    """Physique stage for the mascot. Deterministic from training history."""
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    st = _momentum_state(uid, today)
    return {"avatar": st["avatar"], "streak_weeks": st["streak_weeks"],
            "volume_trend_pct_per_week": st["volume_trend_pct_per_week"],
            "days_since_pr": st["days_since_pr"]}


# ---- Wake-up: the one call the Today screen makes in the morning -------------

@router.get("/v1/wakeup")
def wakeup():
    """Everything the user needs on waking: greeting, readiness, today's
    workout auto-adjusted to readiness, and the day's momentum message."""
    from varunos.core.workouts import (
        decision_for_readiness, auto_regulate, ProgramDay, WorkoutDecision,
    )
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    profile = db.get_profile(uid) or {}

    r = readiness_today()
    ci = db.get_checkin(uid, today) or {}

    # Today's session from the active program
    prog_name = profile.get("active_program") or "ppl_power"
    prog = _resolve_program(uid, prog_name)
    workout = None
    if prog and prog.get("days"):
        # Day index advances with each session this ISO week, cycling the split
        wk = _week_key(today)
        done_this_week = sum(1 for d in db.list_workout_dates(uid, days=14)
                             if _week_key(d) == wk and d != today)
        day = prog["days"][done_this_week % len(prog["days"])]
        if r.get("has_data"):
            decision = decision_for_readiness(
                readiness=r.get("overall", 70),
                subjective_energy=ci.get("energy_1to5") or 3,
                soreness=ci.get("soreness_1to5") or 3,
            )
        else:
            decision = WorkoutDecision.GREEN  # no data yet — show the plan as written
        exercises = auto_regulate(
            program_day=ProgramDay(day["name"], day["exercises"]),
            decision=decision,
        )
        workout = {
            "program": prog.get("name", prog_name),
            "day_name": day["name"],
            "decision": decision.value,
            "exercises": exercises,
            "is_custom": bool(db.get_custom_program(uid, prog_name)),
        }

    hour = datetime.now(timezone.utc).hour
    greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 17 else "Good evening")
    name = profile.get("name")

    return {
        "greeting": f"{greeting}, {name}" if name else greeting,
        "date": today,
        "readiness": r,
        "workout": workout,
        "workout_time_pref": profile.get("workout_time_pref") or "flexible",
        "momentum": _momentum_state(uid, today)["best_event"],
    }
