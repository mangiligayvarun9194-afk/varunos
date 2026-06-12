"""
VarunOS FastAPI server.

Production-shaped:
  - API key auth on all non-public endpoints (configurable via VARUNOS_API_KEY)
  - CORS allowlist (configurable via VARUNOS_ALLOWED_ORIGINS)
  - SQLite persistence
  - 30+ endpoints covering core math + logs + observability + surveillance

Public (no auth):
  GET  /healthz
  GET  /docs  (auto)
  GET  /redoc (auto)
  GET  /openapi.json  (auto)

Everything else: requires Authorization: Bearer <key> or X-API-Key: <key>.
"""

from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# Import the deterministic core
from varunos.core import (
    load_program, substitute_exercise, progression_step, auto_regulate,
    detect_pr, decision_for_readiness, block_for_week, ProgressionScheme,
    WorkoutDecision, SetLog,
    bmr_mifflin, tdee, goal_kcal, macros, food_macros, generate_meal_plan,
    day_totals, adaptive_adjustment, MacroTargets, MealPlan,
    readiness_score, ReadinessComponents,
    DISCLAIMER, safe_action_label,
)
from varunos.core import surveillance as surveillance_mod
from varunos.core.surveillance import (
    ascvd_risk, ascvd_tier, qrisk3_risk, ASCVDInput,
    bp_stage, BPStage, assess_bp,
    cgm_metrics, tir_assessment,
    escalate_glucose, escalate_bp, escalate_afib, escalate_stroke_symptoms,
    assess_from_raw,
)
from varunos.auth import require_auth, configured as auth_configured
from varunos import db

from varunos.api.endpoints_extra import router as extra_router


# ---- App + middleware -----------------------------------------------------

app = FastAPI(
    title="VarunOS API",
    description="Personal AI coach operating system — deterministic core.",
    version="2.1.1",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configurable CORS. In production, set VARUNOS_ALLOWED_ORIGINS to a
# comma-separated list of exact origins. "*" is allowed in dev mode only.
_allowed_origins_env = os.environ.get("VARUNOS_ALLOWED_ORIGINS", "*")
_allowed_origins = (
    ["*"] if _allowed_origins_env.strip() == "*"
    else [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Allow the PWA to send Authorization headers
    expose_headers=["*"],
)

# Mount the extra endpoints router (auth-required by default in the router)
app.include_router(extra_router)


# ---- Health (public) ------------------------------------------------------

@app.get("/healthz")
def healthz():
    return {
        "status": "ok",
        "ts": datetime.now(timezone.utc).isoformat(),
        "version": "2.1.1",
        "auth_configured": auth_configured(),
        "cors_origins": _allowed_origins,
    }


# ---- Pydantic models ------------------------------------------------------

class UserProfile(BaseModel):
    user_id: str
    sex: Literal["M", "F"]
    age: float
    height_cm: float
    weight_kg: float
    activity: Literal["sedentary", "light", "moderate", "very_active", "athlete"]
    goal: Literal["cut", "recomp", "lean_bulk", "bulk"]


class DailyCheckin(BaseModel):
    hrv_today_ms: float
    hrv_7d_baseline_ms: float
    rhr_today_bpm: float
    rhr_30d_baseline_bpm: float
    sleep_min: int
    sleep_deep_pct: float
    sleep_rem_pct: float
    sleep_eff_pct: float
    sleep_continuity_min: int = 0
    energy_1to5: int
    soreness_1to5: int
    mood_1to5: int
    stress_1to5: int
    acute_load: float
    chronic_load: float
    readiness_last_7d: list[float] = Field(default_factory=list)


class WorkoutRequest(BaseModel):
    program: str
    week: int
    day_index: int
    readiness: float
    subjective_energy: int
    soreness: int = 3
    acute_chronic_ratio: float = 1.0
    available_equipment: list[str] = Field(default_factory=list)


class SetLogRequest(BaseModel):
    exercise_id: str
    weight_kg: float
    reps: int
    rpe: float | None = None
    history: list[dict] = Field(default_factory=list)


class MealLogRequest(BaseModel):
    food_ids: list[str]
    portions: list[float] = Field(default_factory=list)


class DietCalcRequest(BaseModel):
    sex: Literal["M", "F"]
    weight_kg: float
    height_cm: float
    age: float
    activity: Literal["sedentary", "light", "moderate", "very_active", "athlete"]
    goal: Literal["cut", "recomp", "lean_bulk", "bulk"]


class MealPlanRequest(BaseModel):
    template: str
    n_days: int = 7


class IDRSRequest(BaseModel):
    age_years: float
    bmi: float
    waist_cm: float
    sex: Literal["M", "F"]
    family_history_dm: bool
    activity: Literal["vigorous", "mild", "sedentary"]


class ASCVDRequest(BaseModel):
    age: float
    sex: Literal["M", "F"]
    total_chol: float
    hdl_c: float
    sbp: float
    bp_treated: bool
    diabetes: bool
    smoker: bool
    race: Literal["white", "black", "other"] = "other"
    south_asian_adjustment: bool = False


class BPRequest(BaseModel):
    sbp: int
    dbp: int
    symptomatic: bool = False
    symptoms: list[str] = Field(default_factory=list)


class CGMRequest(BaseModel):
    readings_mgdl: list[float]


class EscalationGlucoseRequest(BaseModel):
    value_mgdl: float
    symptomatic: bool = False


class AdaptiveDietRequest(BaseModel):
    target_kcal: int
    actual_weight_change_4w_kg: float
    target_weight_change_4w_kg: float
    sex: Literal["M", "F"]
    strength_drop_pct: float = 0.0
    sleep_drop_pts: float = 0.0
    hunger_avg: float = 3.0
    workouts_missed_last_2w: int = 0
    adherence_pct_last_2w: float = 100.0


# ---- Auth-required core endpoints (workouts, diet, surveillance) ----------

@app.post("/v1/state/snapshot", dependencies=[Depends(require_auth)])
def state_snapshot(profile: UserProfile, checkin: DailyCheckin):
    """Morning briefing composite. Returns everything for a briefing card."""
    bmr = bmr_mifflin(sex=profile.sex, weight_kg=profile.weight_kg,
                      height_cm=profile.height_cm, age=profile.age)
    tdee_val = tdee(bmr=bmr, activity=profile.activity)
    target_kcal = goal_kcal(tdee_value=tdee_val, goal=profile.goal)
    macro = macros(kcal=target_kcal, weight_kg=profile.weight_kg,
                   goal=profile.goal, sex=profile.sex)
    readiness = readiness_score(
        hrv_today_ms=checkin.hrv_today_ms, hrv_7d_baseline_ms=checkin.hrv_7d_baseline_ms,
        rhr_today_bpm=checkin.rhr_today_bpm, rhr_30d_baseline_bpm=checkin.rhr_30d_baseline_bpm,
        sleep_components=dict(
            duration_min=checkin.sleep_min, deep_pct=checkin.sleep_deep_pct,
            rem_pct=checkin.sleep_rem_pct, efficiency_pct=checkin.sleep_eff_pct,
            continuity_min=checkin.sleep_continuity_min,
        ),
        energy_1to5=checkin.energy_1to5, soreness_1to5=checkin.soreness_1to5,
        mood_1to5=checkin.mood_1to5, stress_1to5=checkin.stress_1to5,
        acute_load=checkin.acute_load, chronic_load=checkin.chronic_load,
        readiness_last_7d=checkin.readiness_last_7d,
    )
    color = "GREEN" if readiness.overall >= 75 else "YELLOW" if readiness.overall >= 50 else "RED"
    return {
        "user_id": profile.user_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "readiness": {
            "overall": readiness.overall,
            "color": color,
            "components": {
                "hrv": readiness.hrv, "rhr": readiness.rhr,
                "sleep": readiness.sleep, "wellness": readiness.wellness,
                "load": readiness.load, "trend": readiness.trend,
            },
        },
        "diet": {
            "tdee": tdee_val, "target_kcal": target_kcal,
            "protein_g": macro.protein_g, "fat_g": macro.fat_g, "carbs_g": macro.carbs_g,
        },
        "disclaimer": DISCLAIMER,
    }


@app.post("/v1/workouts/today", dependencies=[Depends(require_auth)])
def workouts_today(req: WorkoutRequest):
    try:
        prog = load_program(req.program)
    except FileNotFoundError:
        raise HTTPException(404, f"Program not found: {req.program}")
    if req.day_index >= len(prog.days):
        raise HTTPException(400, f"day_index out of range (max {len(prog.days) - 1})")
    day = prog.days[req.day_index]
    decision = decision_for_readiness(
        readiness=req.readiness, subjective_energy=req.subjective_energy,
        soreness=req.soreness, acute_chronic_ratio=req.acute_chronic_ratio,
    )
    session = auto_regulate(program_day=day, decision=decision)
    block = block_for_week(req.week, prog.weeks, deload_week=prog.deload_week)
    if req.available_equipment:
        out = []
        for ex in session:
            ex_id = ex["id"]
            try:
                sub = substitute_exercise(prog, ex_id, req.available_equipment)
                ex = {**ex, "id": sub, "original_id": ex_id}
            except Exception:
                pass
            out.append(ex)
        session = out
    return {
        "program": prog.name, "week": req.week, "block": block.value,
        "day_name": day.name, "decision": decision.value, "exercises": session,
    }


@app.post("/v1/workouts/log", dependencies=[Depends(require_auth)])
def workouts_log(req: SetLogRequest):
    history = [SetLog(**s) for s in req.history]
    new_set = SetLog(exercise_id=req.exercise_id, weight_kg=req.weight_kg,
                     reps=req.reps, rpe=req.rpe)
    pr = detect_pr(new_set=new_set, history=history)
    return {
        "logged": {"exercise_id": new_set.exercise_id, "weight_kg": new_set.weight_kg,
                   "reps": new_set.reps, "rpe": new_set.rpe},
        "pr": {"is_pr": pr.is_pr, "pr_type": pr.pr_type,
               "previous": pr.previous, "current": pr.current},
    }


@app.post("/v1/diet/calc", dependencies=[Depends(require_auth)])
def diet_calc(req: DietCalcRequest):
    bmr = bmr_mifflin(sex=req.sex, weight_kg=req.weight_kg,
                      height_cm=req.height_cm, age=req.age)
    tdee_val = tdee(bmr=bmr, activity=req.activity)
    target = goal_kcal(tdee_value=tdee_val, goal=req.goal)
    macro = macros(kcal=target, weight_kg=req.weight_kg, goal=req.goal, sex=req.sex)
    return {
        "bmr": bmr, "tdee": tdee_val, "target_kcal": target,
        "protein_g": macro.protein_g, "fat_g": macro.fat_g, "carbs_g": macro.carbs_g,
        "p_per_kg": macro.p_per_kg, "f_per_kg": macro.f_per_kg, "c_per_kg": macro.c_per_kg,
    }


@app.post("/v1/diet/log", dependencies=[Depends(require_auth)])
def diet_log(req: MealLogRequest):
    portions = req.portions or [1.0] * len(req.food_ids)
    items = []
    for fid, p in zip(req.food_ids, portions):
        try:
            items.append(food_macros(fid, portions=p))
        except KeyError:
            raise HTTPException(404, f"Food not found: {fid}. Use /v1/foods/search to find valid IDs.")
    totals = day_totals(items)
    return {"items": items, "totals": totals}


@app.post("/v1/diet/plan", dependencies=[Depends(require_auth)])
def diet_plan(req: MealPlanRequest):
    try:
        plan = generate_meal_plan(req.template, n_days=req.n_days)
    except FileNotFoundError:
        raise HTTPException(404, f"Template not found: {req.template}")
    return plan


@app.post("/v1/diet/adaptive", dependencies=[Depends(require_auth)])
def diet_adaptive(req: AdaptiveDietRequest):
    return adaptive_adjustment(
        target_kcal=req.target_kcal,
        actual_weight_change_4w_kg=req.actual_weight_change_4w_kg,
        target_weight_change_4w_kg=req.target_weight_change_4w_kg,
        sex=req.sex,
        strength_drop_pct=req.strength_drop_pct,
        sleep_drop_pts=req.sleep_drop_pts,
        hunger_avg=req.hunger_avg,
        workouts_missed_last_2w=req.workouts_missed_last_2w,
        adherence_pct_last_2w=req.adherence_pct_last_2w,
    )


@app.post("/v1/surveillance/idrs", dependencies=[Depends(require_auth)])
def surveillance_idrs(req: IDRSRequest):
    return assess_from_raw(
        age_years=req.age_years, bmi=req.bmi, waist_cm=req.waist_cm,
        sex=req.sex, family_history_dm=req.family_history_dm,
        activity=req.activity,
    )


@app.post("/v1/surveillance/ascvd", dependencies=[Depends(require_auth)])
def surveillance_ascvd(req: ASCVDRequest):
    inp = ASCVDInput(
        age=req.age, sex=req.sex, total_chol=req.total_chol, hdl_c=req.hdl_c,
        sbp=req.sbp, bp_treated=req.bp_treated, diabetes=req.diabetes,
        smoker=req.smoker, race=req.race,
        south_asian_adjustment=req.south_asian_adjustment,
    )
    risk = ascvd_risk(inp)
    tier = ascvd_tier(risk)
    return {
        "risk_10yr_pct": risk, "tier": tier,
        "action_label": safe_action_label(tier), "disclaimer": DISCLAIMER,
    }


@app.post("/v1/surveillance/bp", dependencies=[Depends(require_auth)])
def surveillance_bp(req: BPRequest):
    stage = bp_stage(req.sbp, req.dbp)
    bp = assess_bp(req.sbp, req.dbp)
    out = {**bp}
    if stage in (BPStage.STAGE_2, BPStage.HYPERTENSIVE_CRISIS) or req.symptomatic:
        out["escalation"] = escalate_bp(
            sbp=req.sbp, dbp=req.dbp, symptomatic=req.symptomatic, symptoms=req.symptoms,
        )
    out["disclaimer"] = DISCLAIMER
    return out


@app.post("/v1/surveillance/cgm", dependencies=[Depends(require_auth)])
def surveillance_cgm(req: CGMRequest, diabetic: bool = False):
    if not req.readings_mgdl:
        raise HTTPException(400, "readings_mgdl must be non-empty")
    metrics = cgm_metrics(req.readings_mgdl)
    assessment = tir_assessment(metrics, diabetic=diabetic)
    return {"metrics": metrics, "assessment": assessment}


@app.post("/v1/surveillance/escalate/glucose", dependencies=[Depends(require_auth)])
def surveillance_escalate_glucose(req: EscalationGlucoseRequest):
    return escalate_glucose(value_mgdl=req.value_mgdl, symptomatic=req.symptomatic)


@app.post("/v1/surveillance/escalate/stroke", dependencies=[Depends(require_auth)])
def surveillance_escalate_stroke(symptoms: list[str] = Body(...)):
    return escalate_stroke_symptoms(symptoms=symptoms)


class DoctorShareRequest(BaseModel):
    user_id: str
    scope: Literal["cardio", "endo", "gp", "full"] = "full"
    biometrics: dict
    risk_assessments: list[dict] = Field(default_factory=list)
    family_history: list[dict] = Field(default_factory=list)
    lifestyle: dict = Field(default_factory=dict)
    symptoms_recent: list[str] = Field(default_factory=list)


@app.post("/v1/doctor/share", dependencies=[Depends(require_auth)])
def doctor_share(req: DoctorShareRequest):
    return {
        "user_id": req.user_id, "scope": req.scope,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ttl_hours": 24, "biometrics": req.biometrics,
        "risk_assessments": req.risk_assessments,
        "family_history": req.family_history, "lifestyle": req.lifestyle,
        "symptoms_recent": req.symptoms_recent, "disclaimer": DISCLAIMER,
    }


@app.get("/v1/programs", dependencies=[Depends(require_auth)])
def list_programs():
    programs_dir = os.path.join(os.path.dirname(__file__), "..", "data", "programs")
    programs = []
    for f in os.listdir(programs_dir):
        if f.endswith(".json"):
            with open(os.path.join(programs_dir, f)) as fp:
                programs.append(json.load(fp)["name"])
    return {"programs": programs}


@app.get("/v1/foods/search", dependencies=[Depends(require_auth)])
def search_foods(q: str = "", limit: int = 20):
    from varunos.core.diet import food_db
    db_ = food_db()
    results = []
    q_lower = q.lower()
    for fid, item in db_.items():
        if q_lower in item.name.lower() or q_lower in fid:
            results.append({
                "id": fid, "name": item.name,
                "kcal": item.kcal, "p": item.p, "c": item.c, "f": item.f,
                "category": item.category,
            })
            if len(results) >= limit:
                break
    return {"results": results, "n": len(results)}


# ---- Boot-time sanity check ----------------------------------------------

@app.on_event("startup")
def _startup_check():
    """Warn loudly if the server is running without auth in production-ish env."""
    env = os.environ.get("VARUNOS_ENV", "dev")
    if not auth_configured():
        import sys
        print(
            "WARNING: VARUNOS_API_KEY is not set. "
            "All endpoints (except /healthz) will return 503 Service Unavailable. "
            "Set VARUNOS_API_KEY in your environment or .env file.",
            file=sys.stderr,
        )
    if env == "production" and _allowed_origins_env == "*":
        import sys
        print(
            "WARNING: VARUNOS_ENV=production but VARUNOS_ALLOWED_ORIGINS=*. "
            "This is insecure. Set an explicit origin list.",
            file=sys.stderr,
        )


# Re-import json for the list_programs endpoint
import json

# ---- Serve the frontend from the same origin (optional, VARUNOS_SERVE_PWA) ----
# The React app (web/dist, committed so Render needs no Node build) is the
# primary UI at /. The legacy single-file PWA stays available at /legacy.
import os as _os
_PWA_DIR = _os.path.join(_os.path.dirname(__file__), "..", "..", "pwa")
_WEB_DIST = _os.path.join(_os.path.dirname(__file__), "..", "..", "web", "dist")
if _os.path.isdir(_PWA_DIR) and _os.environ.get("VARUNOS_SERVE_PWA", "1") != "0":
    # Mount static assets (manifest, icons, sw.js) under /static path so they
    # don't collide with API routes. The app's root / serves index.html.
    app.mount("/static", StaticFiles(directory=_PWA_DIR), name="pwa-static")
    if _os.path.isdir(_os.path.join(_WEB_DIST, "assets")):
        app.mount("/assets", StaticFiles(directory=_os.path.join(_WEB_DIST, "assets")),
                  name="web-assets")

    @app.get("/")
    def root_index():
        new_ui = _os.path.join(_WEB_DIST, "index.html")
        if _os.path.isfile(new_ui):
            return FileResponse(new_ui)
        return FileResponse(_os.path.join(_PWA_DIR, "index.html"))

    @app.get("/legacy")
    def legacy_index():
        return FileResponse(_os.path.join(_PWA_DIR, "index.html"))

    @app.get("/manifest.json")
    def root_manifest():
        return FileResponse(_os.path.join(_PWA_DIR, "manifest.json"))

    @app.get("/sw.js")
    def root_sw():
        return FileResponse(
            _os.path.join(_PWA_DIR, "sw.js"),
            media_type="application/javascript",
        )

    @app.get("/favicon.ico")
    def root_favicon():
        # Serve the 192 icon as favicon
        return FileResponse(_os.path.join(_PWA_DIR, "icons", "icon-192.svg"),
                            media_type="image/svg+xml")

    @app.get("/icons/{name}")
    def root_icons(name: str):
        return FileResponse(_os.path.join(_PWA_DIR, "icons", name))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
