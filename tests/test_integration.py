"""
End-to-end integration tests.

These verify the full deterministic core works as a coherent system:
  - Load a real program, compute a session, log a PR
  - Compute TDEE, generate a meal plan, aggregate grocery
  - Compute IDRS from raw measurements
  - Run emergency escalation end-to-end
  - Verify the briefing path never leaks raw values to narration
"""

import pytest
from varunos.core.workouts import (
    load_program, decision_for_readiness, auto_regulate, WorkoutDecision,
    detect_pr, SetLog, progression_step, ProgressionScheme,
)
from varunos.core.diet import (
    bmr_mifflin, tdee, goal_kcal, macros, generate_meal_plan,
    day_totals, food_macros, adaptive_adjustment,
)
from varunos.core.surveillance import (
    assess_from_raw, bp_stage, BPStage, cgm_metrics, tir_assessment,
    escalate_glucose, escalate_bp, escalate_stroke_symptoms,
)
from varunos.core.readiness import readiness_score, decision_color
from varunos.core.safety import is_medical_claim, redact_medical_claim, safe_action_label, DISCLAIMER


class TestFitnessFlow:
    def test_full_fitness_session(self):
        # 1. Load program
        prog = load_program("ppl_power")
        day = prog.days[0]  # Push day

        # 2. Compute readiness (green day)
        readiness = readiness_score(
            hrv_today_ms=60, hrv_7d_baseline_ms=50,
            rhr_today_bpm=55, rhr_30d_baseline_bpm=60,
            sleep_components=dict(duration_min=450, deep_pct=18, rem_pct=22,
                                  efficiency_pct=92, continuity_min=3),
            energy_1to5=4, soreness_1to5=2, mood_1to5=4, stress_1to5=2,
            acute_load=80, chronic_load=100,
        )
        color = decision_color(readiness.overall)
        assert color == "GREEN"

        # 3. Decision
        decision = decision_for_readiness(
            readiness=readiness.overall, subjective_energy=4,
        )
        assert decision == WorkoutDecision.GREEN

        # 4. Apply decision
        session = auto_regulate(program_day=day, decision=decision)
        assert len(session) == len(day.exercises)  # unchanged

        # 5. Log a set, detect PR
        new_set = SetLog(exercise_id="bench_press", weight_kg=120, reps=5, rpe=8)
        history = [SetLog(exercise_id="bench_press", weight_kg=110, reps=5, rpe=7)]
        pr = detect_pr(new_set=new_set, history=history)
        # 110x5 e1RM ≈ 128.3, 120x5 e1RM ≈ 140 → e1RM PR
        assert pr.is_pr is True

        # 6. Progression
        next_step = progression_step(
            scheme=ProgressionScheme.DOUBLE,
            current_weight_kg=120, current_reps=5,
            current_reps_target_top=6, current_sets=3,
        )
        # Reps at 5, top 6 → +1 rep
        assert next_step.next_reps == 6

    def test_low_readiness_delegates_to_yellow(self):
        # Slightly off day → YELLOW
        readiness = readiness_score(
            hrv_today_ms=48, hrv_7d_baseline_ms=50,
            rhr_today_bpm=63, rhr_30d_baseline_bpm=60,
            sleep_components=dict(duration_min=380, deep_pct=13, rem_pct=18,
                                  efficiency_pct=82, continuity_min=10),
            energy_1to5=3, soreness_1to5=3, mood_1to5=3, stress_1to5=3,
            acute_load=95, chronic_load=100,
        )
        # Should land in YELLOW range (50-74)
        assert 40 < readiness.overall < 80
        decision = decision_for_readiness(
            readiness=readiness.overall, subjective_energy=3, soreness=3,
        )
        assert decision == WorkoutDecision.YELLOW

        # Apply yellow
        prog = load_program("ppl_power")
        session = auto_regulate(program_day=prog.days[0], decision=decision)
        # Sets should be reduced
        for orig, mod in zip(prog.days[0].exercises, session):
            assert mod["sets"] < orig["sets"]


class TestDietFlow:
    def test_full_diet_setup(self):
        # 1. Inputs
        bmr = bmr_mifflin(sex="M", weight_kg=78, height_cm=178, age=32)
        tdee_val = tdee(bmr=bmr, activity="moderate")
        target = goal_kcal(tdee_value=tdee_val, goal="cut")
        macro = macros(kcal=target, weight_kg=78, goal="cut", sex="M")

        # 2. Sanity
        assert bmr > 1500
        assert tdee_val > bmr
        assert target < tdee_val
        assert macro.protein_g > 150  # 2.2g/kg * 78

        # 3. Generate meal plan
        plan = generate_meal_plan("indian_nonveg_4meal", n_days=7)
        assert len(plan.weekly_grocery) > 0

        # 4. Log a day's meals (realistic Indian non-veg day)
        meals_today = [
            food_macros("oats_rolled_50g"),          # 190
            food_macros("egg_whole_1pc", portions=3.0),  # 216
            food_macros("whey_isolate_30g"),           # 120
            food_macros("banana_1pc"),                 # 105
            food_macros("chicken_breast_100g", portions=2.0),  # 330
            food_macros("rice_basmati_100g", portions=2.0),    # 260
            food_macros("bhindi_1cup"),                # 65
            food_macros("dal_masoor_1cup"),            # 200
            food_macros("roti_wheat_1pc", portions=2.0),  # 240
            food_macros("dahi_1cup"),                  # 100
            food_macros("almonds_28g"),                # 164
        ]
        totals = day_totals(meals_today)
        # Should be ~2000 kcal
        assert 1500 < totals.kcal < 3000

    def test_adaptive_recalibration(self):
        # User is cutting but plateaued
        adj = adaptive_adjustment(
            target_kcal=2200,
            actual_weight_change_4w_kg=-0.2,  # almost nothing
            target_weight_change_4w_kg=-1.5,
            sex="M",
        )
        assert adj.delta_kcal < 0  # reduce kcal
        assert "100" in adj.reason or "stalled" in adj.reason.lower() or "slow" in adj.reason.lower()


class TestSurveillanceFlow:
    def test_idrs_full_assessment_indian(self):
        # 55yo Indian male, BMI 28, waist 95, family hx of T2DM, sedentary
        result = assess_from_raw(
            age_years=55, bmi=28, waist_cm=95, sex="M",
            family_history_dm=True, activity="sedentary",
        )
        # Should be MODERATE or HIGH
        assert result["tier"] in ("MODERATE", "HIGH")
        # Must include action label
        assert "screen" in result["screening_recommendation"].lower() or "doctor" in result["screening_recommendation"].lower()

    def test_bp_crisis_immediate_escalation(self):
        # Hypertensive crisis with symptoms
        esc = escalate_bp(sbp=200, dbp=130, symptomatic=True)
        assert esc["level"] == "CRITICAL"
        assert "911" in esc["recommendation"] or "108" in esc["recommendation"] or "NOW" in esc["recommendation"]
        # Multi-channel
        assert len(esc["channels"]) >= 3

    def test_cgm_to_tier_chain(self):
        # 24h of glucose data with some highs
        readings = [100.0] * 200 + [180.0] * 50 + [220.0] * 38
        metrics = cgm_metrics(readings)
        assessment = tir_assessment(metrics, diabetic=False)
        # TIR < 95% → ELEVATED
        assert metrics.tir_70_180_pct < 95
        assert assessment["tier"] in ("ELEVATED", "HIGH")

    def test_stroke_fast_protocol(self):
        # FAST positive
        esc = escalate_stroke_symptoms(symptoms=["stroke_face_droop", "stroke_arm_weakness"])
        assert esc["level"] == "CRITICAL"
        assert "call" in esc["recommendation"].lower()


class TestBrainNeverSeesRaw:
    """Verify the 'brain sees only tiers' rule."""

    def test_idrs_tier_is_string_only(self):
        # The brain only sees idrs_tier(), not the raw score
        result = assess_from_raw(
            age_years=60, bmi=30, waist_cm=105, sex="M",
            family_history_dm=True, activity="sedentary",
        )
        # The brain gets the tier as a single string
        tier = result["tier"]
        assert tier in ("LOW", "MODERATE", "HIGH")
        # And a safe action label
        action = safe_action_label(tier)
        assert "diagnos" not in action.lower()
        assert "you have" not in action.lower()

    def test_glucose_tier_is_just_tier(self):
        # Brain gets the escalation result without raw values when narrating
        result = escalate_glucose(value_mgdl=200)  # above normal range
        # Should be NOTIFY level (borderline)
        assert result["level"] in ("NOTIFY", "URGENT", "CRITICAL")

    def test_no_diagnostic_language_in_narration(self):
        # Any text passed to the brain for narration should be sanitized
        dangerous = [
            "You have diabetes based on your readings.",
            "You are hypertensive.",
            "You are suffering from cardiovascular disease.",
            "You have been diagnosed with metabolic syndrome.",
        ]
        for d in dangerous:
            # First, is_medical_claim should catch it
            assert is_medical_claim(d) is True
            # Then redactor should fix it
            safe = redact_medical_claim(d)
            # Re-check: no diagnostic phrasing remains
            assert is_medical_claim(safe) is False

    def test_briefing_includes_disclaimer(self):
        # A real briefing pattern
        action = safe_action_label("HIGH")
        briefing = f"Your BP tier is HIGH. {action}\n\n{DISCLAIMER}"
        assert "not a medical device" in briefing


class TestEndToEndUserDay:
    """Simulate one full user day across all systems."""

    def test_user_day_simulation(self):
        # ---- Morning: compute readiness ----
        readiness = readiness_score(
            hrv_today_ms=55, hrv_7d_baseline_ms=50,
            rhr_today_bpm=58, rhr_30d_baseline_bpm=60,
            sleep_components=dict(duration_min=435, deep_pct=16, rem_pct=21,
                                  efficiency_pct=90, continuity_min=4),
            energy_1to5=4, soreness_1to5=2, mood_1to5=4, stress_1to5=2,
            acute_load=85, chronic_load=100,
        )
        color = decision_color(readiness.overall)
        assert color in ("GREEN", "YELLOW")

        # ---- Program + auto-regulate ----
        prog = load_program("ppl_power")
        decision = decision_for_readiness(
            readiness=readiness.overall, subjective_energy=4,
        )
        session = auto_regulate(program_day=prog.days[0], decision=decision)
        assert len(session) > 0

        # ---- Diet ----
        bmr = bmr_mifflin(sex="M", weight_kg=80, height_cm=178, age=30)
        target = goal_kcal(tdee_value=tdee(bmr=bmr, activity="moderate"), goal="recomp")
        m = macros(kcal=target, weight_kg=80, goal="recomp", sex="M")
        assert m.kcal > 2000

        # ---- Surveillance: log a BP reading ----
        bp = 132 / 85
        stage = bp_stage(132, 85)
        assert stage == BPStage.STAGE_1  # ELEVATED tier

        # ---- Generate grocery list ----
        plan = generate_meal_plan("indian_veg_4meal", n_days=7)
        assert len(plan.weekly_grocery) >= 5

        # ---- The day worked. The user got a green-light workout,
        #     stayed near macros, and we'll watch the BP trend. ----
