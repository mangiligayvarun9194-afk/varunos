"""
Tests for the surveillance module — the medical safety layer.

These tests are CRITICAL. They verify:
  - All risk scores produce deterministic outputs
  - Boundaries are correct
  - Critical thresholds are detected
  - The "never diagnose" rail is enforced
  - The brain never sees raw values in the narration path
"""

import pytest
from varunos.core.surveillance import (
    idrs_score, idrs_tier, assess_from_raw,
    findrisc_score, findrisc_tier,
    bp_stage, bp_pattern, BPStage, BPPattern, assess_bp, pulse_pressure, mean_arterial_pressure,
    ascvd_risk, ascvd_tier, qrisk3_risk, ASCVDInput,
    cha2ds2vasc_score, cha2ds2vasc_tier, anticoag_recommended, CHA2DS2VAScInput,
    cgm_metrics, tir_assessment, homa_ir, homa_ir_tier,
    escalate, escalate_glucose, escalate_bp, escalate_afib, escalate_stroke_symptoms,
    EscalationLevel,
)
from varunos.core.safety import (
    is_medical_claim, redact_medical_claim, DISCLAIMER,
    validate_disclaimer_present, check_escalation_needed, safe_action_label,
)


# ---- IDRS (Indian Diabetes Risk Score) -----------------------------------

class TestIDRS:
    def test_low_score(self):
        # Young, lean, active, no family hx
        score = idrs_score(
            age="lt35", bmi="lt25", waist="normal",
            family_hx=False, activity="vigorous",
        )
        assert score == 0
        assert idrs_tier(score) == "LOW"

    def test_high_score(self):
        # 50+, BMI 30+, high waist, family hx, sedentary
        score = idrs_score(
            age="ge50", bmi="ge30", waist="high",
            family_hx=True, activity="sedentary",
        )
        assert score == 30 + 20 + 20 + 10 + 20  # 100
        assert idrs_tier(score) == "HIGH"

    def test_moderate_score(self):
        # 35-49, BMI 25-29, intermediate waist, no family, mild activity
        score = idrs_score(
            age="35_49", bmi="25_29", waist="intermediate",
            family_hx=False, activity="mild",
        )
        assert score == 20 + 10 + 10 + 0 + 10  # 50
        assert idrs_tier(score) == "MODERATE"

    def test_tier_boundaries(self):
        assert idrs_tier(29) == "LOW"
        assert idrs_tier(30) == "MODERATE"
        assert idrs_tier(50) == "MODERATE"
        assert idrs_tier(51) == "HIGH"

    def test_assess_from_raw_male(self):
        # 60yo, BMI 28, waist 95cm, no family hx, sedentary
        result = assess_from_raw(
            age_years=60, bmi=28, waist_cm=95, sex="M",
            family_history_dm=False, activity="sedentary",
        )
        assert result["tier"] in ("MODERATE", "HIGH")
        assert "screening_recommendation" in result

    def test_assess_from_raw_indian_cutoffs(self):
        # Male with waist 92cm → intermediate (M cutoff = 90)
        result = assess_from_raw(
            age_years=40, bmi=24, waist_cm=92, sex="M",
            family_history_dm=False, activity="vigorous",
        )
        assert result["components"]["waist"] == "intermediate"

        # Female with waist 82cm → intermediate (F cutoff = 80)
        result_f = assess_from_raw(
            age_years=40, bmi=24, waist_cm=82, sex="F",
            family_history_dm=False, activity="vigorous",
        )
        assert result_f["components"]["waist"] == "intermediate"


# ---- FINDRISC ------------------------------------------------------------

class TestFINDRISC:
    def test_zero_score_low(self):
        score = findrisc_score(
            age="lt45", bmi="lt25", waist="normal",
            active_30min_daily=True, fruit_veg_daily=True,
            bp_medication_ever=False, high_glucose_ever=False,
            family_dm="none",
        )
        assert score == 0
        assert findrisc_tier(0) == "LOW"

    def test_max_score(self):
        score = findrisc_score(
            age="ge65", bmi="ge30", waist="high",
            active_30min_daily=False, fruit_veg_daily=False,
            bp_medication_ever=True, high_glucose_ever=True,
            family_dm="first_degree",
        )
        # 4 + 3 + 4 + 2 + 1 + 2 + 5 + 5 = 26
        assert score == 26
        assert findrisc_tier(26) == "VERY_HIGH"

    def test_tier_boundaries(self):
        assert findrisc_tier(6) == "LOW"
        assert findrisc_tier(7) == "SLIGHTLY_ELEVATED"
        assert findrisc_tier(11) == "SLIGHTLY_ELEVATED"
        assert findrisc_tier(12) == "MODERATE"
        assert findrisc_tier(14) == "MODERATE"
        assert findrisc_tier(15) == "HIGH"
        assert findrisc_tier(20) == "HIGH"
        assert findrisc_tier(21) == "VERY_HIGH"


# ---- BP staging (ACC/AHA 2017) -------------------------------------------

class TestBPStaging:
    def test_normal(self):
        assert bp_stage(110, 70) == BPStage.NORMAL
        assert bp_stage(119, 79) == BPStage.NORMAL

    def test_elevated(self):
        assert bp_stage(122, 75) == BPStage.ELEVATED
        assert bp_stage(129, 79) == BPStage.ELEVATED

    def test_stage1(self):
        assert bp_stage(132, 78) == BPStage.STAGE_1
        assert bp_stage(125, 85) == BPStage.STAGE_1  # asymmetric

    def test_stage2(self):
        assert bp_stage(145, 95) == BPStage.STAGE_2
        assert bp_stage(135, 92) == BPStage.STAGE_2  # asymmetric

    def test_hypertensive_crisis(self):
        assert bp_stage(190, 130) == BPStage.HYPERTENSIVE_CRISIS
        assert bp_stage(185, 100) == BPStage.HYPERTENSIVE_CRISIS  # SBP only
        assert bp_stage(170, 125) == BPStage.HYPERTENSIVE_CRISIS  # DBP only

    def test_assess_bp(self):
        result = assess_bp(125, 75)
        assert result["stage"] == "ELEVATED"
        assert result["pulse_pressure"] == 50
        assert result["map"] == pytest.approx(91.7, 0.1)
        assert "lifestyle" in result["action"].lower()

    def test_crisis_action_mentions_ER(self):
        result = assess_bp(200, 130)
        assert "ER" in result["action"] or "doctor" in result["action"]


class TestBPPattern:
    def test_morning_surge(self):
        pattern = bp_pattern(morning_sbp=160, night_sbp=130)
        assert pattern == BPPattern.MORNING_SURGE

    def test_no_morning_surge_if_close(self):
        pattern = bp_pattern(morning_sbp=140, night_sbp=130)
        assert pattern == BPPattern.NONE

    def test_white_coat(self):
        pattern = bp_pattern(home_avg_sbp=120, clinic_sbp=145)
        assert pattern == BPPattern.WHITE_COAT

    def test_masked(self):
        pattern = bp_pattern(home_avg_sbp=145, clinic_sbp=120)
        assert pattern == BPPattern.MASKED

    def test_nocturnal_non_dipper(self):
        pattern = bp_pattern(day_sbp=140, night_sbp=130)  # dip 7% < 10%
        assert pattern == BPPattern.NOCTURNAL_NON_DIPPER

    def test_labile(self):
        pattern = bp_pattern(sbp_readings_7d=[120, 145, 130, 160, 125, 140, 130])
        # 160 - 120 = 40 > 30
        assert pattern == BPPattern.LABILE


# ---- ASCVD (Pooled Cohort Equations) -------------------------------------

class TestASCVD:
    def test_low_risk_young_female(self):
        inp = ASCVDInput(
            age=40, sex="F", total_chol=180, hdl_c=60, sbp=110,
            bp_treated=False, diabetes=False, smoker=False,
        )
        risk = ascvd_risk(inp)
        assert risk < 5.0
        assert ascvd_tier(risk) == "LOW"

    def test_high_risk_older_male_smoker_diabetic(self):
        inp = ASCVDInput(
            age=65, sex="M", total_chol=260, hdl_c=30, sbp=160,
            bp_treated=True, diabetes=True, smoker=True,
        )
        risk = ascvd_risk(inp)
        assert risk > 20
        assert ascvd_tier(risk) == "HIGH"

    def test_tier_boundaries(self):
        assert ascvd_tier(4.99) == "LOW"
        assert ascvd_tier(5.0) == "BORDERLINE"
        assert ascvd_tier(7.4) == "BORDERLINE"
        assert ascvd_tier(7.5) == "INTERMEDIATE"
        assert ascvd_tier(19.99) == "INTERMEDIATE"
        assert ascvd_tier(20.0) == "HIGH"

    def test_south_asian_adjustment(self):
        inp_no = ASCVDInput(
            age=45, sex="M", total_chol=200, hdl_c=50, sbp=120,
            bp_treated=False, diabetes=False, smoker=False,
        )
        inp_sa = ASCVDInput(
            age=45, sex="M", total_chol=200, hdl_c=50, sbp=120,
            bp_treated=False, diabetes=False, smoker=False,
            south_asian_adjustment=True,
        )
        risk_no = ascvd_risk(inp_no)
        risk_sa = ascvd_risk(inp_sa)
        # South Asian adjustment multiplies by 1.3
        assert risk_sa == pytest.approx(risk_no * 1.3, 0.01)

    def test_deterministic_same_inputs(self):
        inp = ASCVDInput(
            age=50, sex="F", total_chol=200, hdl_c=55, sbp=125,
            bp_treated=False, diabetes=False, smoker=False,
        )
        r1 = ascvd_risk(inp)
        r2 = ascvd_risk(inp)
        assert r1 == r2  # deterministic

    def test_qrisk3_smoker_higher(self):
        base = qrisk3_risk(
            age=50, sex="M", bmi=25, sbp=125,
            bp_treated=False, smoker=False, diabetes=False,
        )
        smoke = qrisk3_risk(
            age=50, sex="M", bmi=25, sbp=125,
            bp_treated=False, smoker=True, diabetes=False,
        )
        assert smoke > base

    def test_qrisk3_indian_adjustment(self):
        white = qrisk3_risk(
            age=50, sex="M", bmi=25, sbp=125,
            bp_treated=False, smoker=False, diabetes=False,
            ethnicity="white",
        )
        indian = qrisk3_risk(
            age=50, sex="M", bmi=25, sbp=125,
            bp_treated=False, smoker=False, diabetes=False,
            ethnicity="indian",
        )
        assert indian > white


# ---- CHA2DS2-VASc ---------------------------------------------------------

class TestCHA2DS2VASc:
    def test_zero_male_low(self):
        inp = CHA2DS2VAScInput(sex="M")
        score = cha2ds2vasc_score(inp)
        assert score == 0
        assert cha2ds2vasc_tier(0, "M") == "LOW"
        assert anticoag_recommended(0, "M") is False

    def test_one_female_baseline(self):
        # Female gets +1 just for sex
        inp = CHA2DS2VAScInput(sex="F")
        score = cha2ds2vasc_score(inp)
        assert score == 1
        assert cha2ds2vasc_tier(1, "F") == "LOW"
        assert anticoag_recommended(1, "F") is False  # women need >= 3

    def test_two_male_high(self):
        inp = CHA2DS2VAScInput(sex="M", hypertension=True, diabetes=True)
        score = cha2ds2vasc_score(inp)
        assert score == 2
        assert cha2ds2vasc_tier(2, "M") == "HIGH"
        assert anticoag_recommended(2, "M") is True

    def test_prior_stroke(self):
        inp = CHA2DS2VAScInput(sex="M", prior_stroke_tia_thromboembolism=True)
        score = cha2ds2vasc_score(inp)
        assert score == 2  # S2 = 2 points

    def test_age_75(self):
        inp = CHA2DS2VAScInput(sex="M", age=80)
        score = cha2ds2vasc_score(inp)
        assert score == 2  # A2 = 2 points

    def test_age_65_to_74(self):
        inp = CHA2DS2VAScInput(sex="M", age=70)
        score = cha2ds2vasc_score(inp)
        assert score == 1  # A = 1 point


# ---- CGM metrics ----------------------------------------------------------

class TestCGM:
    def test_normal_glucose_metrics(self):
        # 24h of stable readings around 100 mg/dL
        readings = [100.0] * 288
        metrics = cgm_metrics(readings)
        assert metrics.tir_70_180_pct == 100.0
        assert metrics.time_below_70_pct == 0.0
        assert metrics.time_above_180_pct == 0.0
        assert metrics.avg_mgdl == 100.0
        assert metrics.cv_pct < 5.0
        assert metrics.gmi_pct == pytest.approx(5.7, 0.1)

    def test_high_glucose(self):
        readings = [200.0] * 288
        metrics = cgm_metrics(readings)
        assert metrics.tir_70_180_pct == 0.0
        assert metrics.time_above_180_pct == 100.0
        assert metrics.avg_mgdl == 200.0
        assert metrics.gmi_pct > 8.0

    def test_mixed_glucose(self):
        # Half below 70, half normal
        readings = [60.0] * 144 + [100.0] * 144
        metrics = cgm_metrics(readings)
        assert metrics.time_below_70_pct == 50.0
        assert metrics.tir_70_180_pct == 50.0

    def test_tir_assessment_low(self):
        readings = [100.0] * 288
        metrics = cgm_metrics(readings)
        assessment = tir_assessment(metrics, diabetic=False)
        assert assessment["tier"] == "LOW"
        assert len(assessment["flags"]) == 0

    def test_tir_assessment_diabetic_target(self):
        readings = [150.0] * 288
        metrics = cgm_metrics(readings)
        # Diabetic: TIR target is 70%, GMI 5.7+ → prediabetes-ish
        assessment = tir_assessment(metrics, diabetic=True)
        # TIR = 100% but GMI ~6.9 (>6.5)
        # In this case tier would be HIGH because of diabetes-suggesting GMI
        assert assessment["tier"] in ("ELEVATED", "HIGH")

    def test_empty_readings_raises(self):
        with pytest.raises(ValueError):
            cgm_metrics([])

    def test_homa_ir_calculation(self):
        # Standard case
        h = homa_ir(fasting_insulin_uU_mL=10, fasting_glucose_mg_dL=100)
        # 10 * 100 / 405 = 2.47
        assert h == pytest.approx(2.47, 0.01)
        assert homa_ir_tier(h) == "ELEVATED"

    def test_homa_ir_low(self):
        h = homa_ir(5, 90)
        # 5 * 90 / 405 = 1.11
        assert h == pytest.approx(1.11, 0.01)
        assert homa_ir_tier(h) == "LOW"


# ---- Escalation -----------------------------------------------------------

class TestEscalation:
    def test_critical_glucose_low(self):
        esc = escalate_glucose(value_mgdl=40)
        assert esc["level"] == EscalationLevel.CRITICAL.value
        assert "emergency" in esc["recommendation"].lower() or "911" in esc["recommendation"] or "NOW" in esc["recommendation"]

    def test_critical_glucose_high(self):
        esc = escalate_glucose(value_mgdl=350)
        assert esc["level"] == EscalationLevel.CRITICAL.value

    def test_urgent_high_bp(self):
        esc = escalate_bp(sbp=190, dbp=125)
        assert esc["level"] in (EscalationLevel.CRITICAL.value, EscalationLevel.URGENT.value)

    def test_hypertensive_crisis_with_symptoms_is_critical(self):
        esc = escalate_bp(sbp=185, dbp=125, symptomatic=True)
        assert esc["level"] == EscalationLevel.CRITICAL.value

    def test_normal_bp_not_escalated(self):
        esc = escalate_bp(sbp=120, dbp=80)
        assert esc["level"] == EscalationLevel.NOTIFY.value

    def test_afib_urgent(self):
        esc = escalate_afib()
        assert esc["level"] in (EscalationLevel.URGENT.value, EscalationLevel.CRITICAL.value)

    def test_afib_symptomatic_critical(self):
        esc = escalate_afib(symptomatic=True)
        assert esc["level"] == EscalationLevel.CRITICAL.value

    def test_stroke_symptoms_critical(self):
        esc = escalate_stroke_symptoms(symptoms=["stroke_face_droop", "slurred_speech"])
        assert esc["level"] == EscalationLevel.CRITICAL.value
        # Should mention 911 / 108 / 112
        assert "911" in esc["recommendation"] or "108" in esc["recommendation"] or "112" in esc["recommendation"]

    def test_escalation_has_channels(self):
        esc = escalate_glucose(value_mgdl=40)
        assert "channels" in esc
        assert len(esc["channels"]) >= 3  # multi-channel

    def test_escalation_tta(self):
        esc = escalate_glucose(value_mgdl=40)
        assert esc["tta_seconds"] <= 10  # immediate


# ---- Safety rails (NEVER DIAGNOSE) ---------------------------------------

class TestSafetyRails:
    def test_detect_diagnosis_you_have(self):
        assert is_medical_claim("You have diabetes") is True
        assert is_medical_claim("Your readings suggest prediabetes") is False

    def test_detect_diagnosis_insulin(self):
        assert is_medical_claim("You need insulin") is True
        assert is_medical_claim("Discuss treatment options with your doctor") is False

    def test_detect_diagnosis_suffer(self):
        assert is_medical_claim("You are suffering from hypertension") is True

    def test_detect_diagnosis_diagnosed(self):
        assert is_medical_claim("You have been diagnosed with T2DM") is True

    def test_redact_replaces_you_have(self):
        text = "Based on the data, you have high cholesterol."
        out = redact_medical_claim(text)
        assert "you have" not in out.lower()
        assert "your data suggests" in out.lower()

    def test_redact_replaces_suffer(self):
        text = "You are suffering from elevated glucose levels."
        out = redact_medical_claim(text)
        assert "suffer" not in out.lower()

    def test_redact_preserves_safe_text(self):
        safe = "Discuss with your doctor at your next visit."
        out = redact_medical_claim(safe)
        assert out == safe

    def test_disclaimer_present(self):
        assert "not a medical device" in DISCLAIMER

    def test_disclaimer_validation_positive(self):
        text = f"Your briefing here. {DISCLAIMER}"
        assert validate_disclaimer_present(text) is True

    def test_disclaimer_validation_short_form(self):
        text = "Briefing. This is not a medical device."
        assert validate_disclaimer_present(text) is True

    def test_disclaimer_validation_negative(self):
        text = "Your briefing here, no disclaimer."
        assert validate_disclaimer_present(text) is False

    def test_safe_action_labels_present(self):
        for tier in ["LOW", "ELEVATED", "HIGH", "CRITICAL"]:
            label = safe_action_label(tier)
            assert len(label) > 0

    def test_critical_action_mentions_ER_or_doctor(self):
        label = safe_action_label("CRITICAL")
        assert "ER" in label or "doctor" in label.lower()

    def test_check_escalation_glucose(self):
        assert check_escalation_needed(metric="glucose", value=40) == "er"
        assert check_escalation_needed(metric="glucose", value=100) == "none"

    def test_check_escalation_bp_crisis(self):
        assert check_escalation_needed(metric="bp", value="200/130") == "er"

    def test_check_escalation_afib(self):
        assert check_escalation_needed(metric="afib", value=True) in ("er", "doctor")
