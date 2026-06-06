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


@router.post("/v1/logs/checkins")
def log_checkin(payload: CheckinIn):
    uid = _user_id_from_default()
    date = payload.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    data = payload.model_dump(exclude={"date"}, exclude_none=True)
    row = db.upsert_checkin(uid, date, data)
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
