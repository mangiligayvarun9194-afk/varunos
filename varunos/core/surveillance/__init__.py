"""
VarunOS Health Risk Surveillance Module.

This is the SAFETY-CRITICAL layer. All functions here are PURE and DETERMINISTIC.
No LLM, no AI, no narration. Just validated medical screening tools.

Hard rules (encoded throughout):
  1. Never diagnose. Outputs are risk tiers, never "you have X".
  2. Never replace a doctor. ≥ELEVATED tiers prompt "see doctor".
  3. Raw biomarker values stay in the encrypted vault. The brain sees only tiers.
  4. CRITICAL thresholds trigger immediate escalation, not coaching.
  5. Opt-in. Off by default. User explicitly enables with `surveillance on`.
  6. All outputs are educational. Not a medical device.

References:
  - IDRS (Mohan et al. 2005) — Indian Diabetes Risk Score
  - FINDRISC — Finnish Diabetes Risk Score
  - ACC/AHA 2017 Hypertension Guidelines — BP staging
  - 2018 ACC/AHA Pooled Cohort Equations — ASCVD risk
  - QRISK3 (UK, 2017) — alternative CVD risk
  - CHA2DS2-VASc — stroke risk in AFib
  - ADA Standards of Care 2024 — prediabetes/diabetes thresholds
  - ICMR Guidelines — Indian BMI/waist cutoffs (23/27, M90/F80)
  - Battelino et al. 2019 — Time-in-Range consensus
"""

from .idrs import idrs_score, idrs_tier, assess_from_raw
from .findrisc import findrisc_score, findrisc_tier
from .bp import bp_stage, bp_pattern, BPStage, BPPattern, assess_bp, pulse_pressure, mean_arterial_pressure, bp_tier
from .ascvd import ascvd_risk, ascvd_tier, qrisk3_risk, ASCVDInput
from .cha2ds2vasc import cha2ds2vasc_score, cha2ds2vasc_tier, anticoag_recommended, CHA2DS2VAScInput
from .cgm import cgm_metrics, tir_assessment, GlycemicMetrics, homa_ir, homa_ir_tier
from .escalation import escalate, EscalationLevel, escalate_glucose, escalate_bp, escalate_afib, escalate_stroke_symptoms

__all__ = [
    "idrs_score", "idrs_tier",
    "findrisc_score", "findrisc_tier",
    "bp_stage", "bp_pattern", "BPStage", "BPPattern",
    "ascvd_risk", "ascvd_tier", "qrisk3_risk", "ASCVDInput",
    "cha2ds2vasc_score", "cha2ds2vasc_tier", "anticoag_recommended",
    "cgm_metrics", "tir_assessment", "GlycemicMetrics",
    "escalate", "EscalationLevel",
    "escalate_glucose", "escalate_bp", "escalate_afib", "escalate_stroke_symptoms",
]
