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
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import re
from fastapi import APIRouter, Depends, HTTPException, Body, Query, Response, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from varunos import auth as auth_mod
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
from varunos import notify


router = APIRouter(dependencies=[Depends(require_auth)])
# Public router: signup + login have no prior credential, so they skip require_auth.
public_router = APIRouter()


# ---- Multi-user accounts (signup / login / logout / me) -------------------

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SignupIn(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


def _issue_session(uid: str) -> str:
    """Mint a session token, store only its hash, return the plaintext once."""
    token = auth_mod.new_session_token()
    db.create_session(auth_mod.hash_token(token), uid, auth_mod.session_expiry_iso())
    return token


@public_router.post("/v1/auth/signup")
def auth_signup(payload: SignupIn):
    email = (payload.email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(payload.password or "") < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    uid = auth_mod.new_user_id()
    try:
        db.create_account(uid, email, auth_mod.hash_password(payload.password),
                          name=payload.name)
    except ValueError:
        raise HTTPException(status_code=409, detail="That email is already registered.")
    if payload.name:
        db.upsert_profile(uid, {"name": payload.name.strip(), "user_id": uid})
    token = _issue_session(uid)
    db.log_event(uid, "account_created", channel="auth")
    return {"token": token, "user": {"user_id": uid, "email": email, "name": payload.name}}


@public_router.post("/v1/auth/login")
def auth_login(payload: LoginIn):
    acc = db.get_account_by_email(payload.email or "")
    if not acc or not auth_mod.verify_password(payload.password or "", acc.get("password") or ""):
        # Same message either way — don't reveal whether the email exists.
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    db.touch_last_login(acc["user_id"])
    token = _issue_session(acc["user_id"])
    return {"token": token,
            "user": {"user_id": acc["user_id"], "email": acc["email"], "name": acc.get("name")}}


@router.post("/v1/auth/logout")
def auth_logout(request: Request):
    token = auth_mod.extract_token(request)
    if token:
        db.delete_session(auth_mod.hash_token(token))
    return {"ok": True}


@router.get("/v1/auth/me")
def auth_me():
    uid = _user_id_from_default()
    acc = db.get_account(uid)
    if acc:
        return {"user_id": uid, "email": acc.get("email"), "name": acc.get("name"),
                "account": True}
    # Legacy owner (authenticated by the shared key) has no account row.
    return {"user_id": uid, "email": None, "name": None, "account": False}


# ---- Helper ---------------------------------------------------------------

def _user_id_from_default() -> str:
    """The authenticated user for this request.

    Resolves to the per-account user_id set by require_auth (multi-user), or the
    env owner when called outside an authed request (CLI/tests). Every endpoint
    that calls this is therefore automatically scoped to the logged-in account."""
    from varunos.auth import current_user_id
    return current_user_id()


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


@router.get("/v1/insights/strength")
def insights_strength():
    """Strength Intelligence: per-lift e1RM/volume trends, stalls, PRs, and
    muscle-group balance over the user's full logged history."""
    uid = _user_id_from_default()
    from varunos.core import strength_intel as si
    from varunos.core import exercises as ex
    sets = db.list_sets_since(uid, "1970-01-01")
    name_of = lambda i: (ex.get_exercise(i) or {}).get("name", i)
    return si.analyze(sets, name_of=name_of)


class LegalAcceptIn(BaseModel):
    version: str


@router.post("/v1/legal/accept")
def legal_accept(payload: LegalAcceptIn):
    """Record that the current user accepted the Privacy Policy + Terms (version).
    Auditable via the event log; the version lets us require re-acceptance later."""
    uid = _user_id_from_default()
    db.log_event(uid, "legal_accepted", channel="api", payload={"version": payload.version})
    return {"ok": True, "version": payload.version}


class ImportHevyIn(BaseModel):
    csv: str


@router.post("/v1/import/hevy")
def import_hevy(payload: ImportHevyIn):
    """Import a Hevy CSV export into the user's real workout history. Idempotent:
    re-importing the same file skips sessions already present (matched on ts)."""
    uid = _user_id_from_default()
    from varunos.core.import_hevy import parse_hevy_csv
    parsed = parse_hevy_csv(payload.csv)
    imported, skipped = 0, 0
    for session in parsed["sessions"]:
        wid = db.import_workout_session(uid, session)
        if wid:
            imported += 1
        else:
            skipped += 1
    db.log_event(uid, "history_imported", channel="api",
                 payload={"imported": imported, "skipped_existing": skipped,
                          **parsed["summary"]})
    return {"imported": imported, "skipped_existing": skipped, "summary": parsed["summary"]}


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
        # A partial profile (e.g. weight logged before onboarding finished) can
        # have null height/age; .get(k, default) keeps None, so coerce here.
        from varunos.core.diet import bmr_mifflin, tdee, goal_kcal, macros
        sex = profile.get("sex") or "M"
        goal = profile.get("goal") or "recomp"
        bmr = bmr_mifflin(sex=sex, weight_kg=profile["weight_kg"],
                          height_cm=profile.get("height_cm") or 175,
                          age=profile.get("age") or 30)
        tv = tdee(bmr=bmr, activity=profile.get("activity") or "moderate")
        tk = goal_kcal(tdee_value=tv, goal=goal)
        m = macros(kcal=tk, weight_kg=profile["weight_kg"], goal=goal, sex=sex)
        diet = {"target_kcal": tk, "protein_g": m.protein_g, "fat_g": m.fat_g, "carbs_g": m.carbs_g}
    meals = db.list_meals(uid)
    consumed = sum(mm.get("kcal", 0) for mm in meals if (mm.get("ts") or "").startswith(today))
    insights = build_insights(_build_daily_features(uid))

    ctx = build_brain_context(readiness=readiness, diet=diet, insights=insights,
                              consumed_kcal=consumed or None)

    answer = _llm_or_template(payload.question, ctx, SAFE_SYSTEM_PROMPT, uid)
    db.log_event(uid, "coach_ask", channel="api", payload={"q": payload.question[:120]})
    return {"answer": answer, "context_used": list(ctx.keys()),
            "engine": "llm" if os.environ.get("ANTHROPIC_API_KEY") else "deterministic",
            "disclaimer": DISCLAIMER}


def _llm_or_template(question: str, ctx: dict, system: str, uid: str = "default") -> str:
    from varunos.core.brain import narrate_template
    from varunos.core import llm_guard
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return narrate_template(question, ctx)
    allowed, _reason = llm_guard.reserve(uid)
    if not allowed:
        return narrate_template(question, ctx)   # over budget → deterministic answer
    try:
        import httpx, json as _json
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={
                "model": os.environ.get("VARUNOS_LLM_MODEL", "claude-haiku-4-5"),
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


# ---- Natural-language agent: act on plain English ------------------------

class CoachActIn(BaseModel):
    text: str


def _match_food_id(term: str) -> Optional[str]:
    """Best deterministic food-DB match for a plain term (e.g. 'eggs')."""
    from varunos.core.diet import food_db
    term = (term or "").strip().lower().rstrip("s")  # naive singularise
    if not term:
        return None
    best = None
    for fid, item in food_db().items():
        name = item.name.lower()
        if term in fid or term in name:
            # prefer the shortest matching name (closest to the bare food)
            if best is None or len(name) < best[1]:
                best = (fid, len(name))
    return best[0] if best else None


def _dispatch_action(uid: str, intent) -> Optional[dict]:
    """Execute a structured Intent. Returns a response dict for action intents,
    or None for a question (the caller then routes to the coach narrator).
    Shared by both the deterministic parse and the LLM-fallback path."""
    from varunos.core.agent import split_food_terms, LOG_WORKOUT, LOG_WEIGHT, LOG_MEAL

    if intent.action == LOG_WEIGHT:
        kg = intent.fields["weight_kg"]
        db.upsert_profile(uid, {"weight_kg": kg})
        db.log_event(uid, "weight_logged", channel="agent", payload={"weight_kg": kg})
        return {"action": "log_weight", "reply": f"Got it — updated your weight to {kg} kg.",
                "fields": intent.fields}

    if intent.action == LOG_WORKOUT:
        ex = intent.fields["exercise"]
        weight = float(intent.fields["weight_kg"])
        reps = int(intent.fields["reps"])
        # prior best weight for this exercise (last ~365d), before this set
        since = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
        prior = [s for s in db.list_sets_since(uid, since) if s["exercise_id"] == ex]
        prev_best = max((s["weight_kg"] for s in prior), default=0.0)
        wid = db.create_workout_log(uid, {"program": "freeform", "day_name": "Quick log",
                                          "decision": "GREEN"})
        db.add_set(uid, wid, ex, 1, weight, reps, None)
        is_pr = weight > prev_best
        db.log_event(uid, "workout_logged", channel="agent",
                     payload={"exercise_id": ex, "weight_kg": weight, "reps": reps, "pr": is_pr})
        nice = ex.replace("_", " ")
        reply = (f"\U0001F389 New PR! {nice} {weight:g} kg × {reps}. Logged." if is_pr
                 else f"Logged: {nice} {weight:g} kg × {reps}.")
        return {"action": "log_workout", "reply": reply, "fields": intent.fields, "pr": is_pr}

    if intent.action == LOG_MEAL:
        from varunos.core.diet import food_macros
        terms = split_food_terms(intent.fields.get("foods_text", ""))
        logged, total = [], 0.0
        for qty, term in terms:
            fid = _match_food_id(term)
            if not fid:
                continue
            m = food_macros(fid, portions=qty)
            db.add_meal(uid, fid, qty, m["kcal"], m["p"], m["c"], m["f"], context="agent")
            logged.append(f"{m['name']} ×{qty:g}")
            total += m["kcal"]
        if logged:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            db.log_event(uid, "meal_logged", channel="agent",
                         payload={"items": logged, "kcal": total})
            return {"action": "log_meal",
                    "reply": "Logged: " + ", ".join(logged)
                             + f". Today so far: {round(db.day_kcal(uid, today))} kcal.",
                    "fields": {"items": logged}}
        return {"action": "log_meal",
                "reply": "I couldn't match those foods to the database. Try the "
                         "Log → meal search, or a photo of the plate.",
                "fields": intent.fields}

    return None  # question -> caller routes to the coach


def _llm_extract_intent(text: str, uid: str = "default"):
    """Best-effort LLM fallback for phrasings the deterministic parser misses.

    Asks the cheap model for a structured action, then runs it through the SAME
    pure validator the tests cover — so a hallucinated or out-of-range value can
    never become a logged entry. Returns a validated action Intent, or None
    (network off, no key, parse failure, or low confidence -> let the coach
    answer). Never raises."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    from varunos.core import llm_guard
    allowed, _reason = llm_guard.reserve(uid)
    if not allowed:
        return None   # over budget → deterministic parser only
    try:
        import httpx, json as _json
        from varunos.core.agent import intent_from_extraction, QUESTION
        system = (
            "You convert a short fitness/nutrition message into ONE JSON object and "
            "nothing else: {\"action\": \"log_workout\"|\"log_weight\"|\"log_meal\"|\"none\", "
            "\"exercise\": string, \"weight_kg\": number, \"reps\": integer, "
            "\"foods_text\": string}. Use \"none\" for questions, greetings, or anything "
            "that is not the user explicitly logging a set they did, their bodyweight, or a "
            "meal they ate. Only fill fields you are certain about from the message. "
            "NEVER invent numbers."
        )
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": os.environ.get("VARUNOS_LLM_MODEL", "claude-haiku-4-5"),
                  "max_tokens": 200, "system": system,
                  "messages": [{"role": "user", "content": text[:500]}]},
            timeout=20,
        )
        if r.status_code != 200:
            return None
        blocks = r.json().get("content", [])
        raw = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
        if "{" not in raw:
            return None
        data = _json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
        intent = intent_from_extraction(data)
        return intent if intent.action != QUESTION else None
    except Exception:
        return None


_GOAL_CUES = ("my goal is", "i want to", "i'd like to", "i would like to",
              "trying to", "i aim to", "help me", "i need to")
_PREF_CUES = ("i prefer", "i like to", "i usually", "i always", "i hate", "i can't",
              "i cannot", "i don't", "i avoid", "i'm vegetarian", "i am vegetarian",
              "i'm vegan", "i am vegan")
_STRUGGLE_CUES = ("i struggle with", "i keep", "i can never", "i always skip",
                  "my problem is")


def _capture_memory(uid: str, text: str) -> None:
    """Deterministically remember a goal/preference/struggle the user states in
    plain language. No LLM — just honest cue matching. Safe content only (the
    user's own words), so nothing here can ever leak a raw biomarker."""
    t = (text or "").strip()
    low = t.lower()
    if len(t) < 6 or len(t) > 280:
        return
    kind = None
    if any(c in low for c in _STRUGGLE_CUES):
        kind = "struggle"
    elif any(c in low for c in _GOAL_CUES):
        kind = "goal"
    elif any(low.startswith(c) or f" {c}" in low for c in _PREF_CUES):
        kind = "preference"
    if kind:
        db.add_memory(uid, kind, t, source="agent")


@router.post("/v1/coach/act")
def coach_act(payload: CoachActIn):
    """The plain-language brain. Turns how a person actually types into an
    action (log a set / weight / meal) OR a coaching answer — no commands.

    Deterministic-first: the pure parser in `varunos/core/agent.py` handles the
    common phrasings with no LLM and no network. Anything it can't classify
    falls back to a validated LLM extraction (when a key is set), and only then
    to the coach narrator — which keeps the tier-only privacy gate."""
    from varunos.core.agent import parse_intent, QUESTION
    uid = _user_id_from_default()

    # Every turn grows the bond — this is how Hermes's mind levels up.
    try:
        db.bump_hermes_interaction(uid)
        _capture_memory(uid, payload.text)
    except Exception:
        pass  # memory is best-effort; never block a reply on it

    intent = parse_intent(payload.text)
    # Fallback: a message the parser couldn't classify might still be an action
    # phrased in a way we didn't anticipate. Try the validated LLM extractor.
    if intent.action == QUESTION:
        upgraded = _llm_extract_intent(payload.text, uid)
        if upgraded is not None:
            intent = upgraded

    # Execute actions defensively — a logging hiccup returns a friendly message,
    # never a 500 in the user's face.
    try:
        resp = _dispatch_action(uid, intent)
    except Exception:
        return {"action": "error",
                "reply": "I hit a snag logging that — give it another go, or use the Log tab."}
    if resp is not None:
        # A PR is a win worth remembering.
        if resp.get("pr"):
            try:
                db.add_memory(uid, "win", resp.get("reply", "").lstrip("🎉 ").rstrip("."),
                              source="agent")
            except Exception:
                pass
        return resp

    # Question -> the coach (tier-only gate). Coach has its own template fallback.
    try:
        out = coach_ask(CoachAskIn(question=payload.text))
        return {"action": "answer", "reply": out["answer"], "engine": out.get("engine")}
    except Exception:
        return {"action": "answer",
                "reply": "I'm having trouble thinking right now — try again in a moment."}


# ---- Health Vault: your story as open, linked Markdown you own ----------

def _vault_files(uid: str):
    from varunos.core.vault import build_vault
    profile = db.get_profile(uid) or {}
    since = (datetime.now(timezone.utc) - timedelta(days=3650)).isoformat()
    sets = db.list_sets_since(uid, since)
    meals = db.list_meals(uid)
    return build_vault(profile, sets, meals), len(sets), len(meals)


@router.get("/v1/vault/preview")
def vault_preview():
    """Stats + a sample note so the UI can show what the download contains."""
    uid = _user_id_from_default()
    files, n_sets, n_meals = _vault_files(uid)
    return {
        "files": len(files),
        "days": sum(1 for p in files if p.startswith("days/")),
        "exercises": sum(1 for p in files if p.startswith("exercises/")),
        "sets": n_sets,
        "meals": n_meals,
        "sample": files.get("README.md", "")[:1400],
    }


@router.get("/v1/vault/export")
def vault_export():
    """Download the whole vault as a .zip of Markdown files the user owns."""
    import io, zipfile
    uid = _user_id_from_default()
    files, _, _ = _vault_files(uid)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for path, content in files.items():
            z.writestr(f"sarathi-health-vault/{path}", content)
    db.log_event(uid, "vault_exported", channel="api", payload={"files": len(files)})
    return Response(
        content=buf.getvalue(), media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="sarathi-health-vault.zip"'},
    )


# ---- Hermes: the companion that grows with you --------------------------

def _days_known(state: dict) -> int:
    fs = state.get("first_seen")
    if not fs:
        return 0
    try:
        d0 = datetime.fromisoformat(fs).date()
        return max(0, (datetime.now(timezone.utc).date() - d0).days)
    except Exception:
        return 0


def _hermes_snapshot(uid: str) -> dict:
    """Hermes's current mind: level, stage, unlocked skills, how it knows you."""
    from varunos.core.hermes import hermes_level, hermes_stage, hermes_skills
    state = db.get_hermes_state(uid)
    mem_count = db.count_memories(uid)
    days = _days_known(state)
    level = hermes_level(
        days_known=days,
        interactions=state.get("interaction_count") or 0,
        memories=mem_count,
        briefings_seen=state.get("briefings_seen") or 0,
    )
    return {
        "level": level,
        "stage": hermes_stage(level),
        "skills": hermes_skills(level),
        "days_known": days,
        "interactions": state.get("interaction_count") or 0,
        "memories": mem_count,
        "briefings_seen": state.get("briefings_seen") or 0,
        "name": state.get("custom_name"),
    }


def _streak_weeks(uid: str) -> int:
    from varunos.core.momentum import weekly_streak
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        return weekly_streak(db.list_workout_dates(uid, days=120), today)
    except Exception:
        return 0


def _last_win(uid: str) -> Optional[str]:
    """Most recent PR, phrased safely (no biomarkers)."""
    for ev in db.list_events(uid, limit=50):
        if ev.get("kind") == "workout_logged":
            p = ev.get("payload") or {}
            if isinstance(p, dict) and p.get("pr"):
                ex = str(p.get("exercise_id", "")).replace("_", " ")
                return f"{ex} {p.get('weight_kg')}kg × {p.get('reps')}".strip()
    return None


def _best_weight_for(uid: str, exercise_id: str) -> Optional[float]:
    """Heaviest weight ever logged for one exercise — fuels goal progress."""
    since = (datetime.now(timezone.utc) - timedelta(days=3650)).isoformat()
    best = None
    for s in db.list_sets_since(uid, since):
        if s.get("exercise_id") == exercise_id and s.get("weight_kg") is not None:
            best = max(best or 0, float(s["weight_kg"]))
    return best


def _days_since_last_workout(uid: str) -> Optional[int]:
    dates = db.list_workout_dates(uid, days=120)
    if not dates:
        return None
    try:
        last = max(datetime.fromisoformat(d).date() if "T" not in d else
                   datetime.fromisoformat(d).date() for d in
                   [x[:10] for x in dates])
        return (datetime.now(timezone.utc).date() - last).days
    except Exception:
        return None


def _hermes_observations(uid: str, snap: dict) -> list[dict]:
    """The specific, true things Hermes can say right now — goal progress,
    patterns from the insights engine, memory recall. Pure-core does the ranking;
    this just gathers the (already safe) inputs. Never fabricates."""
    from varunos.core.hermes import parse_goal, goal_progress, observations
    from varunos.core.insights import build_insights

    memories = db.list_memories(uid, limit=30)
    month = datetime.now(timezone.utc).month

    # Goal progress for any goal we can actually measure.
    goal_lines: list[str] = []
    for m in memories:
        if m.get("kind") != "goal":
            continue
        g = parse_goal(m.get("text", ""))
        if not g:
            continue
        cur = _best_weight_for(uid, g["exercise"]) if g["kind"] == "strength" else None
        p = goal_progress(g, current_kg=cur, month=month)
        if p.get("text"):
            goal_lines.append(p["text"])

    # Patterns from the existing insights engine (titles only — already safe).
    try:
        ins = build_insights(_build_daily_features(uid))
    except Exception:
        ins = {}
    warnings = [a.get("title") for a in ins.get("anomalies", []) if a.get("title")]
    correlations = [c.get("title") for c in ins.get("correlations", []) if c.get("title")]

    # Strength intelligence over the full logged history (stalls, PRs, balance).
    try:
        from varunos.core import strength_intel as si
        from varunos.core import exercises as ex
        sets = db.list_sets_since(uid, "1970-01-01")
        strength = si.analyze(sets, name_of=lambda i: (ex.get_exercise(i) or {}).get("name", i))
    except Exception:
        strength = None

    return observations(
        goal_lines=goal_lines,
        warnings=warnings,
        correlations=correlations,
        memories=memories,
        last_workout_days=_days_since_last_workout(uid),
        streak_weeks=_streak_weeks(uid),
        strength=strength,
        level=snap.get("level", 0),
    )


@router.get("/v1/hermes")
def hermes_state_endpoint():
    """Hermes's relationship state — the second growth bar (your coach's mind)."""
    uid = _user_id_from_default()
    return _hermes_snapshot(uid)


class HermesNameIn(BaseModel):
    name: str = ""


@router.post("/v1/hermes/name")
def hermes_set_name(payload: HermesNameIn):
    uid = _user_id_from_default()
    db.set_hermes_name(uid, payload.name)
    return _hermes_snapshot(uid)


@router.get("/v1/hermes/observations")
def hermes_observations():
    """The specific things Hermes has noticed — goal progress, patterns, recall.
    Read-only; doesn't count as a briefing."""
    uid = _user_id_from_default()
    return {"observations": _hermes_observations(uid, _hermes_snapshot(uid))}


@router.get("/v1/hermes/briefing")
def hermes_briefing(part: Optional[str] = None):
    """A proactive briefing — morning plan, midday nudge, or evening reflection.
    Built deterministically from safe inputs; phrasing optionally polished by the
    LLM (tier-only gate). Marks that you've shared a briefing (grows the bond)."""
    from varunos.core.hermes import compose_briefing, briefing_text, part_of_day
    uid = _user_id_from_default()

    pod = part if part in ("morning", "midday", "evening") else \
        part_of_day(datetime.now(timezone.utc).hour)

    snap = _hermes_snapshot(uid)
    profile = db.get_profile(uid) or {}
    rd = readiness_today()
    readiness = rd if rd.get("has_data") else None

    composed = compose_briefing(
        part_of_day=pod,
        name=profile.get("name"),
        readiness=readiness,
        streak_weeks=_streak_weeks(uid),
        memories=db.list_memories(uid, limit=20),
        last_win=_last_win(uid),
        level=snap["level"],
    )
    # What Hermes actually noticed — goal progress, patterns, recall. This is the
    # wedge: specific memory instead of generic advice.
    obs = _hermes_observations(uid, snap)
    composed["observations"] = [o["text"] for o in obs]
    text = briefing_text(composed)
    if obs:
        text += " " + obs[0]["text"]

    # Optional: let the LLM rephrase the SAME deterministic substance more warmly.
    # It only ever sees the composed (safe) briefing — never raw biomarkers.
    engine = "template"
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        voiced = _hermes_voice(composed, snap, uid)
        if voiced:
            text, engine = voiced, "llm"

    db.mark_briefing_seen(uid)
    return {"briefing": composed, "text": text, "engine": engine,
            "observations": obs, "part_of_day": pod, "hermes": snap}


def _hermes_voice(composed: dict, snap: dict, uid: str = "default") -> Optional[str]:
    """Rephrase a composed briefing in Hermes's voice. Safe-context only."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    from varunos.core import llm_guard
    allowed, _reason = llm_guard.reserve(uid)
    if not allowed:
        return None   # over budget → the deterministic briefing stands
    try:
        import httpx, json as _json
        stage = snap.get("stage", {}).get("title", "")
        system = (
            "You are Hermes, a warm, sharp personal health companion who travels "
            "with the user day to day. Rephrase the given briefing parts into 2-4 "
            "short, natural sentences in your own voice. Rules: never invent numbers "
            "or facts beyond what's given; never give medical diagnoses; keep it "
            f"encouraging and concise. Your relationship stage with them is '{stage}'."
        )
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": os.environ.get("VARUNOS_LLM_MODEL", "claude-haiku-4-5"),
                  "max_tokens": 220, "system": system,
                  "messages": [{"role": "user", "content":
                      "Briefing parts (safe, no raw values):\n" + _json.dumps(composed, indent=2)}]},
            timeout=20)
        if r.status_code == 200:
            blocks = r.json().get("content", [])
            txt = "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
            return txt or None
        return None
    except Exception:
        return None


class MemoryIn(BaseModel):
    kind: str = "fact"
    text: str


@router.get("/v1/hermes/memory")
def hermes_list_memory():
    uid = _user_id_from_default()
    return {"memories": db.list_memories(uid, limit=100)}


@router.post("/v1/hermes/memory")
def hermes_add_memory(payload: MemoryIn):
    uid = _user_id_from_default()
    mid = db.add_memory(uid, payload.kind, payload.text, source="user")
    if not mid:
        raise HTTPException(status_code=400, detail="empty memory")
    return {"id": mid, "memories": db.list_memories(uid, limit=100),
            "hermes": _hermes_snapshot(uid)}


@router.delete("/v1/hermes/memory/{memory_id}")
def hermes_delete_memory(memory_id: int):
    uid = _user_id_from_default()
    ok = db.delete_memory(uid, memory_id)
    if not ok:
        raise HTTPException(status_code=404, detail="memory not found")
    return {"deleted": memory_id, "memories": db.list_memories(uid, limit=100)}


# ---- Exercise form library (coach-grade reference) -----------------------

@router.get("/v1/exercises")
def exercises_list(group: Optional[str] = None, q: Optional[str] = None):
    """The strength-training library — list or search. Static reference content."""
    from varunos.core import exercises as ex
    if q:
        return {"exercises": ex.search(q), "groups": ex.groups()}
    return {"exercises": ex.list_exercises(group), "groups": ex.groups()}


@router.get("/v1/exercises/{exercise_id}")
def exercise_detail(exercise_id: str):
    """Full form detail for one exercise: muscles, ROM, execution, cues, mistakes."""
    from varunos.core import exercises as ex
    e = ex.get_exercise(exercise_id)
    if not e:
        raise HTTPException(status_code=404, detail="exercise not found")
    return e


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

def _coerce_number(v):
    """Turn whatever Apple Health / a Shortcut sends into a clean float, or None.

    Health Shortcuts are messy in the wild: numbers arrive as strings, with units
    appended ("65 ms", "7.5 hr", "8,041 steps"), as the literal text the "Get
    Health Sample" action returns ("No Data", empty), as a list of samples, or as
    a dict with a `value` key. A senior ingest tolerates all of it instead of
    rejecting the whole sync — partial data is still useful data.
    """
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        f = float(v)
        return f if f == f and f not in (float("inf"), float("-inf")) else None  # drop NaN/inf
    if isinstance(v, (list, tuple)):
        for x in reversed(list(v)):          # prefer the most recent sample
            c = _coerce_number(x)
            if c is not None:
                return c
        return None
    if isinstance(v, dict):
        for k in ("value", "v", "qty", "quantity", "amount"):
            if k in v:
                return _coerce_number(v[k])
        return None
    s = str(v).strip().lower().replace(",", "")
    if s in ("", "null", "none", "nil", "-", "—", "n/a", "na", "nan", "no data", "nodata"):
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", s)      # first number anywhere in the string
    return float(m.group()) if m else None


# Plausible physiological ranges. Anything outside is treated as a bad reading and
# dropped (-> None) so one glitchy sample can never poison the rolling baselines.
_WEARABLE_RANGES = {
    "hrv_ms": (1, 500), "rhr_bpm": (20, 240), "sleep_hours": (0, 24),
    "sleep_minutes": (0, 1440), "sleep_deep_pct": (0, 100), "sleep_rem_pct": (0, 100),
    "sleep_efficiency_pct": (0, 100), "steps": (0, 250000), "active_kcal": (0, 30000),
    "spo2": (0, 100), "weight_kg": (1, 600),
}


class WearableSyncIn(BaseModel):
    """Normalized payload from ANY wearable source.

    Apple Health Shortcut, Fitbit, Oura, Whoop and Garmin all map onto this.
    Every field is optional — send whatever the source provides. Numeric fields are
    coerced from strings/units/lists and range-checked, so a real-world Shortcut
    payload never 400s; bad values are simply dropped.
    """
    date: Optional[str] = None
    source: str = "apple_health"
    dry_run: bool = False                       # validate + echo, persist nothing
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

    @field_validator(
        "hrv_ms", "rhr_bpm", "sleep_hours", "sleep_minutes", "sleep_deep_pct",
        "sleep_rem_pct", "sleep_efficiency_pct", "steps", "active_kcal", "spo2",
        "weight_kg", mode="before",
    )
    @classmethod
    def _clean_numbers(cls, v):
        return _coerce_number(v)

    @field_validator("date", "source", mode="before")
    @classmethod
    def _clean_strings(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None

    @model_validator(mode="after")
    def _range_check(self):
        for field, (lo, hi) in _WEARABLE_RANGES.items():
            val = getattr(self, field)
            if val is not None and not (lo <= val <= hi):
                setattr(self, field, None)
        # ints stay ints for the columns that expect them
        if self.steps is not None:
            self.steps = int(round(self.steps))
        if self.sleep_minutes is not None:
            self.sleep_minutes = int(round(self.sleep_minutes))
        if self.source is None:
            self.source = "apple_health"
        return self


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

    # dry_run = "Test connection": validate, parse and compute readiness, but write
    # nothing — so a user can confirm the pipe works without polluting their history.
    if not payload.dry_run:
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
    for kind, val, unit in ([] if payload.dry_run else [
        ("hrv", payload.hrv_ms, "ms"), ("rhr", payload.rhr_bpm, "bpm"),
        ("sleep", sleep_min, "min"), ("steps", payload.steps, "count"),
        ("active_kcal", payload.active_kcal, "kcal"), ("spo2", payload.spo2, "%"),
        ("weight", payload.weight_kg, "kg"),
    ]):
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

    # Self-describing receipt: tell the client exactly which metrics landed, so a
    # Shortcut or "Test connection" button can show "✓ HRV, RHR, Sleep, Steps".
    _metric_map = {
        "HRV": payload.hrv_ms, "RHR": payload.rhr_bpm, "Sleep": sleep_min,
        "Steps": payload.steps, "Active kcal": payload.active_kcal,
        "SpO₂": payload.spo2, "Weight": payload.weight_kg,
    }
    received = [k for k, v in _metric_map.items() if v is not None]
    rd = readiness.get("overall") if isinstance(readiness, dict) else None
    band = readiness.get("color") if isinstance(readiness, dict) else None
    if received:
        verb = "Connection OK — would sync" if payload.dry_run else "Synced"
        msg = f"{verb} {len(received)} metrics: {', '.join(received)}."
        if rd is not None:
            msg += f" Readiness {rd}{(' ' + str(band).upper()) if band else ''}."
    else:
        msg = ("No usable metrics in this payload — check the Shortcut is reading "
               "real Health samples (not 'No Data').")
    return {
        "synced": not payload.dry_run, "ok": bool(received), "dry_run": payload.dry_run,
        "date": date, "source": payload.source,
        "received": received, "metrics_count": len(received),
        "message": msg,
        "baselines": {"hrv_7d": hrv_base, "rhr_30d": rhr_base},
        "readiness": readiness,
        "disclaimer": DISCLAIMER,
    }


@router.get("/v1/sync/status")
def sync_status():
    """When did we last sync, from what, and the full latest readings snapshot —
    everything the in-app 'Your readings' view shows, with baselines so the UI can
    render trend arrows (today vs your rolling baseline)."""
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ci = db.get_checkin(uid, today)
    profile = db.get_profile(uid) or {}
    if not ci or not ci.get("synced_at"):
        return {"connected": False, "last_sync": None, "source": None,
                "weight_kg": profile.get("weight_kg")}
    return {
        "connected": True,
        "last_sync": ci.get("synced_at"),
        "source": ci.get("wearable_source"),
        "today": {
            "hrv_ms": ci.get("hrv_today_ms"),
            "rhr_bpm": ci.get("rhr_today_bpm"),
            "sleep_min": ci.get("sleep_min"),
            "sleep_deep_pct": ci.get("sleep_deep_pct"),
            "sleep_rem_pct": ci.get("sleep_rem_pct"),
            "sleep_eff_pct": ci.get("sleep_eff_pct"),
            "steps": ci.get("steps"),
            "active_kcal": ci.get("active_kcal"),
            "spo2": ci.get("spo2"),
            "weight_kg": profile.get("weight_kg"),
        },
        "baselines": {
            "hrv_ms": ci.get("hrv_7d_baseline_ms"),
            "rhr_bpm": ci.get("rhr_30d_baseline_bpm"),
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
        "muscles": _muscle_growth(all_sets, level),
    }


_MUSCLE_KEYWORDS = {
    "legs": ("squat", "leg", "lunge", "deadlift", "rdl", "calf", "glute", "hip"),
    "chest": ("bench", "chest", "fly", "dip", "push_up", "pushup"),
    "back": ("row", "pull", "lat", "chin", "deadlift"),
    "shoulders": ("overhead", "ohp", "shoulder", "lateral", "raise", "press"),
    "arms": ("curl", "tricep", "extension", "pushdown", "skull"),
    "core": ("plank", "crunch", "ab", "situp", "leg_raise"),
}


def _muscle_growth(all_sets: list[dict], level: int) -> dict:
    """Per-muscle growth 0-100. Overall level scaled by how much of your training
    volume hit each group, so the group you train most visibly grows most.
    No data -> the level spread evenly (honest, never fabricated emphasis)."""
    groups = list(_MUSCLE_KEYWORDS)
    vol = {g: 0.0 for g in groups}
    for s in all_sets:
        if not (s.get("weight_kg") and s.get("reps")):
            continue
        ex = (s.get("exercise_id") or "").lower()
        v = s["weight_kg"] * s["reps"]
        for g, kws in _MUSCLE_KEYWORDS.items():
            if any(k in ex for k in kws):
                vol[g] += v
    total = sum(vol.values())
    out = {}
    for g in groups:
        if total <= 0:
            out[g] = level
        else:
            share = vol[g] / total              # 0..1 of total volume
            emphasis = 0.55 + min(1.0, share * len(groups)) * 0.45  # 0.55..1.0
            out[g] = round(min(100, level * emphasis))
    return out


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


@router.post("/v1/notify/test")
def notify_test():
    """Send a tiny Telegram smoke-test message."""
    sent = notify.send_telegram("Sarathi is connected")
    return {"configured": notify.telegram_configured(), "sent": sent}


@router.post("/v1/momentum/push")
def momentum_push():
    """Push today's single best momentum event to Telegram once per day."""
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prior = [
        e for e in db.list_events(uid, kind="momentum_pushed", limit=20)
        if (e.get("ts") or "").startswith(today)
    ]
    if prior:
        return {
            "pushed": False,
            "already_pushed": True,
            "configured": notify.telegram_configured(),
            "event": prior[0].get("payload", {}).get("event"),
        }

    event = _momentum_state(uid, today)["best_event"]
    if not event:
        return {
            "pushed": False,
            "already_pushed": False,
            "configured": notify.telegram_configured(),
            "event": None,
        }

    text = f"{event['title']}\n{event['detail']}"
    sent = notify.send_telegram(text)
    db.log_event(uid, "momentum_pushed", channel="telegram",
                 payload={"event": event, "sent": sent})
    return {
        "pushed": True,
        "already_pushed": False,
        "configured": notify.telegram_configured(),
        "sent": sent,
        "event": event,
    }


@router.get("/v1/avatar/state")
def avatar_state():
    """Physique stage for the mascot. Deterministic from training history."""
    uid = _user_id_from_default()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    st = _momentum_state(uid, today)
    return {"avatar": st["avatar"], "streak_weeks": st["streak_weeks"],
            "volume_trend_pct_per_week": st["volume_trend_pct_per_week"],
            "days_since_pr": st["days_since_pr"], "muscles": st["muscles"],
            "consistency_4w": st["consistency_4w"]}


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
