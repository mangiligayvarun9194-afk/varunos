"""
VarunOS CLI — command-line demo of the deterministic core.

Use this to demonstrate the system end-to-end without a UI.

Examples:
  python3 -m varunos.cli briefing
  python3 -m varunos.cli workout --program ppl_power --week 3 --readiness 82
  python3 -m varunos.cli diet --sex M --weight 78 --height 178 --age 30 --activity moderate --goal cut
  python3 -m varunos.cli surveillance --age 55 --sex M --bmi 28 --waist 95 --family-dm true
  python3 -m varunos.cli doctor-share --user varun --output share.pdf
"""

import argparse
import json
import sys
from datetime import datetime, timezone


def cmd_briefing(args):
    """Render a sample morning briefing."""
    from varunos.core import (
        bmr_mifflin, tdee, goal_kcal, macros,
        readiness_score, decision_color, safe_action_label, DISCLAIMER,
    )
    from varunos.core.surveillance import (
        assess_from_raw, bp_stage, BPStage,
    )
    from varunos.core.workouts import (
        load_program, decision_for_readiness, auto_regulate, block_for_week,
    )

    # User: 30yo M, 78kg, 178cm, moderate, recomp
    bmr = bmr_mifflin(sex="M", weight_kg=78, height_cm=178, age=30)
    tdee_val = tdee(bmr=bmr, activity="moderate")
    target = goal_kcal(tdee_value=tdee_val, goal="recomp")
    macro = macros(kcal=target, weight_kg=78, goal="recomp", sex="M")

    # Readiness (mock checkin)
    r = readiness_score(
        hrv_today_ms=58, hrv_7d_baseline_ms=50,
        rhr_today_bpm=58, rhr_30d_baseline_bpm=60,
        sleep_components=dict(duration_min=445, deep_pct=17, rem_pct=22,
                              efficiency_pct=92, continuity_min=3),
        energy_1to5=4, soreness_1to5=2, mood_1to5=4, stress_1to5=2,
        acute_load=85, chronic_load=100,
    )
    color = decision_color(r.overall)

    # Surveillance (mock)
    idrs = assess_from_raw(
        age_years=30, bmi=24.6, waist_cm=86, sex="M",
        family_history_dm=False, activity="vigorous",
    )

    # Workout
    prog = load_program("ppl_power")
    decision = decision_for_readiness(readiness=r.overall, subjective_energy=4)
    session = auto_regulate(program_day=prog.days[0], decision=decision)
    block = block_for_week(3, prog.weeks)

    print("=" * 60)
    print(f"  🧠 VarunOS Morning Briefing · {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    print()
    print(f"  Readiness:  {r.overall:.0f} ({color})")
    print(f"  HRV:        {r.hrv:.0f}  RHR: {r.rhr:.0f}  Sleep: {r.sleep:.0f}")
    print(f"  Wellness:   {r.wellness:.0f}  Load: {r.load:.0f}  Trend: {r.trend:.0f}")
    print()
    print(f"  Diet target:  {target} kcal · P{macro.protein_g} F{macro.fat_g} C{macro.carbs_g}")
    print(f"  TDEE:         {tdee_val:.0f} kcal")
    print()
    print("  Risk tiers (today):")
    print(f"    Glucose: {idrs['tier']}  (IDRS {idrs['score']})")
    print(f"    BP:      LOW  (last reading normal)")
    print(f"    CVD:     LOW  (under 5% 10-yr)")
    print()
    print(f"  Workout: {prog.name} · Week 3 of 8 ({block.value})")
    print(f"    Decision: {decision.value}")
    print(f"    {len(session)} exercises:")
    for ex in session:
        print(f"      - {ex['id']}: {ex['sets']}×{ex['reps']} ({ex.get('intensity', '')})")
    print()
    print("  Action labels:")
    print(f"    Glucose: {safe_action_label(idrs['tier'])}")
    print()
    print("-" * 60)
    print(DISCLAIMER[:200] + "...")
    print("=" * 60)


def cmd_workout(args):
    from varunos.core.workouts import (
        load_program, decision_for_readiness, auto_regulate, block_for_week,
    )
    prog = load_program(args.program)
    day = prog.days[args.day]
    decision = decision_for_readiness(
        readiness=args.readiness, subjective_energy=args.energy,
        soreness=args.soreness, acute_chronic_ratio=args.acr,
    )
    session = auto_regulate(program_day=day, decision=decision)
    block = block_for_week(args.week, prog.weeks, deload_week=prog.deload_week)
    print(json.dumps({
        "program": prog.name,
        "week": args.week,
        "block": block.value,
        "decision": decision.value,
        "exercises": session,
    }, indent=2))


def cmd_diet(args):
    from varunos.core.diet import bmr_mifflin, tdee, goal_kcal, macros
    bmr = bmr_mifflin(sex=args.sex, weight_kg=args.weight, height_cm=args.height, age=args.age)
    tdee_val = tdee(bmr=bmr, activity=args.activity)
    target = goal_kcal(tdee_value=tdee_val, goal=args.goal)
    macro = macros(kcal=target, weight_kg=args.weight, goal=args.goal, sex=args.sex)
    print(json.dumps({
        "bmr": bmr, "tdee": tdee_val, "target_kcal": target,
        "protein_g": macro.protein_g, "fat_g": macro.fat_g, "carbs_g": macro.carbs_g,
        "p_per_kg": macro.p_per_kg, "f_per_kg": macro.f_per_kg,
    }, indent=2))


def cmd_surveillance(args):
    from varunos.core.surveillance import (
        assess_from_raw, ascvd_risk, ascvd_tier, ASCVDInput, bp_stage, BPStage,
    )
    print("=" * 60)
    print("  🩺 Health Risk Assessment (educational, not diagnostic)")
    print("=" * 60)
    print()

    # IDRS
    idrs = assess_from_raw(
        age_years=args.age, bmi=args.bmi, waist_cm=args.waist,
        sex=args.sex, family_history_dm=args.family_dm,
        activity=args.activity,
    )
    print(f"  Indian Diabetes Risk Score (IDRS):")
    print(f"    Score: {idrs['score']}  Tier: {idrs['tier']}")
    print(f"    Recommendation: {idrs['screening_recommendation']}")
    print()

    # ASCVD (only valid for 40-79, mock)
    if 40 <= args.age <= 79:
        # Need cholesterol values, use reasonable defaults
        ascvd = ascvd_risk(ASCVDInput(
            age=args.age, sex=args.sex, total_chol=200, hdl_c=50, sbp=125,
            bp_treated=False, diabetes=False, smoker=False,
            south_asian_adjustment=True,  # Indian heuristic
        ))
        tier = ascvd_tier(ascvd)
        print(f"  10-year ASCVD risk (with Indian 1.3x adjustment):")
        print(f"    Risk: {ascvd:.2f}%  Tier: {tier}")
        print()
    else:
        print(f"  ASCVD: skipped (valid ages 40-79, got {args.age})")
        print()

    print("  This is risk-stratification, NOT diagnosis.")
    print("  Discuss any ELEVATED/HIGH results with your doctor.")
    print("=" * 60)


def cmd_doctor_share(args):
    from varunos.core import DISCLAIMER
    from varunos.api.server import app  # not used at runtime, just for completeness
    # Generate a structured JSON doctor-share payload
    payload = {
        "user_id": args.user,
        "scope": args.scope,
        "generated_at": datetime.now(timezone.utc).isoformat() + "Z",
        "ttl_hours": 24,
        "biometrics": {
            "blood_pressure": "last 30 days",
            "glucose": "HbA1c 5.4% (last 3 months)",
            "lipid_panel": "LDL 110, HDL 55, TG 90, TC 175",
        },
        "risk_assessments": [
            {"score": "IDRS", "value": 30, "tier": "LOW"},
            {"score": "ASCVD 10-yr", "value": 4.2, "tier": "LOW", "note": "with SA 1.3x adj"},
        ],
        "family_history": [
            {"relation": "father", "condition": "T2DM", "age_at_dx": 55},
        ],
        "lifestyle": {
            "smoking": "never",
            "alcohol_drinks_wk": 3,
            "exercise": "5x/wk resistance + 2x cardio",
        },
        "symptoms_recent": [],
        "disclaimer": DISCLAIMER,
    }
    if args.output:
        if args.output.endswith(".pdf"):
            from scripts.doctor_share_pdf import render_pdf
            render_pdf(payload, args.output)
            print(f"PDF written: {args.output}")
        else:
            with open(args.output, "w") as f:
                json.dump(payload, f, indent=2)
            print(f"JSON written: {args.output}")
    else:
        print(json.dumps(payload, indent=2))


def main():
    parser = argparse.ArgumentParser(description="VarunOS CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("briefing", help="Show sample morning briefing")

    p_workout = sub.add_parser("workout", help="Compute today's session")
    p_workout.add_argument("--program", default="ppl_power")
    p_workout.add_argument("--week", type=int, default=3)
    p_workout.add_argument("--day", type=int, default=0)
    p_workout.add_argument("--readiness", type=float, default=80.0)
    p_workout.add_argument("--energy", type=int, default=4)
    p_workout.add_argument("--soreness", type=int, default=2)
    p_workout.add_argument("--acr", type=float, default=1.0)

    p_diet = sub.add_parser("diet", help="Compute macro targets")
    p_diet.add_argument("--sex", choices=["M", "F"], default="M")
    p_diet.add_argument("--weight", type=float, default=78.0)
    p_diet.add_argument("--height", type=float, default=178.0)
    p_diet.add_argument("--age", type=float, default=30.0)
    p_diet.add_argument("--activity", default="moderate",
                        choices=["sedentary", "light", "moderate", "very_active", "athlete"])
    p_diet.add_argument("--goal", default="recomp",
                        choices=["cut", "recomp", "lean_bulk", "bulk"])

    p_surv = sub.add_parser("surveillance", help="Health risk assessment")
    p_surv.add_argument("--age", type=float, default=55.0)
    p_surv.add_argument("--sex", choices=["M", "F"], default="M")
    p_surv.add_argument("--bmi", type=float, default=28.0)
    p_surv.add_argument("--waist", type=float, default=95.0)
    p_surv.add_argument("--family-dm", type=lambda x: x.lower() == "true", default=True)
    p_surv.add_argument("--activity", default="sedentary",
                        choices=["vigorous", "mild", "sedentary"])

    p_doc = sub.add_parser("doctor-share", help="Generate doctor-share PDF/JSON")
    p_doc.add_argument("--user", default="varun")
    p_doc.add_argument("--scope", default="full", choices=["cardio", "endo", "gp", "full"])
    p_doc.add_argument("--output", help="Output file (.pdf or .json)")

    args = parser.parse_args()
    {
        "briefing": cmd_briefing,
        "workout": cmd_workout,
        "diet": cmd_diet,
        "surveillance": cmd_surveillance,
        "doctor-share": cmd_doctor_share,
    }[args.cmd](args)


if __name__ == "__main__":
    main()
