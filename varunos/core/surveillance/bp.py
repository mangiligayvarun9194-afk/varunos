"""
Blood pressure staging — ACC/AHA 2017 guidelines.

Categories (mmHg):
  NORMAL           SBP<120  AND DBP<80
  ELEVATED         SBP 120-129 AND DBP<80
  STAGE_1          SBP 130-139 OR DBP 80-89
  STAGE_2          SBP >=140  OR DBP >=90
  HYPERTENSIVE_CRISIS  SBP>180 OR DBP>120  → URGENT

Pattern detection (deterministic):
  MORNING_SURGE    AM SBP > 25 above night SBP
  WHITE_COAT       Home normal, clinic high (informational)
  MASKED           Home high, clinic normal
  NOCTURNAL_NON_DIPPER  Night BP doesn't drop >=10% from day
  LABILE           Large swings (>30 mmHg) within week

Inputs:
  sbp: int  (systolic, mmHg)
  dbp: int  (diastolic, mmHg)
"""

from __future__ import annotations
from enum import Enum
from typing import Optional


class BPStage(str, Enum):
    NORMAL = "NORMAL"
    ELEVATED = "ELEVATED"
    STAGE_1 = "STAGE_1"
    STAGE_2 = "STAGE_2"
    HYPERTENSIVE_CRISIS = "HYPERTENSIVE_CRISIS"


class BPPattern(str, Enum):
    NONE = "NONE"
    MORNING_SURGE = "MORNING_SURGE"
    WHITE_COAT = "WHITE_COAT"
    MASKED = "MASKED"
    NOCTURNAL_NON_DIPPER = "NOCTURNAL_NON_DIPPER"
    LABILE = "LABILE"


def bp_stage(sbp: int, dbp: int) -> BPStage:
    """Apply ACC/AHA 2017 staging rules. The higher stage wins if asymmetric."""
    if sbp > 180 or dbp > 120:
        return BPStage.HYPERTENSIVE_CRISIS
    if sbp >= 140 or dbp >= 90:
        return BPStage.STAGE_2
    if sbp >= 130 or dbp >= 80:
        return BPStage.STAGE_1
    if 120 <= sbp <= 129 and dbp < 80:
        return BPStage.ELEVATED
    if sbp < 120 and dbp < 80:
        return BPStage.NORMAL
    # Edge case: SBP normal but DBP 80-89 — stage 1
    if sbp < 130 and 80 <= dbp <= 89:
        return BPStage.STAGE_1
    return BPStage.NORMAL


def bp_tier(stage: BPStage) -> str:
    """Map BP stage to risk tier used by the brain."""
    return {
        BPStage.NORMAL: "LOW",
        BPStage.ELEVATED: "ELEVATED",
        BPStage.STAGE_1: "ELEVATED",
        BPStage.STAGE_2: "HIGH",
        BPStage.HYPERTENSIVE_CRISIS: "CRITICAL",
    }[stage]


def bp_pattern(
    *,
    morning_sbp: Optional[int] = None,
    night_sbp: Optional[int] = None,
    day_sbp: Optional[int] = None,
    home_avg_sbp: Optional[int] = None,
    clinic_sbp: Optional[int] = None,
    sbp_readings_7d: Optional[list[int]] = None,
) -> BPPattern:
    """Detect common BP patterns from a week's data.

    All inputs optional. Pattern detection is best-effort.
    """
    if (morning_sbp is not None and night_sbp is not None
            and morning_sbp - night_sbp > 25):
        return BPPattern.MORNING_SURGE

    if home_avg_sbp is not None and clinic_sbp is not None:
        # SBP-only check (we don't always have DBP in pattern detection)
        if home_avg_sbp < 130 and clinic_sbp >= 140:
            return BPPattern.WHITE_COAT
        if home_avg_sbp >= 135 and clinic_sbp < 130:
            return BPPattern.MASKED

    if day_sbp is not None and night_sbp is not None and night_sbp > 0:
        dip_pct = (day_sbp - night_sbp) / day_sbp * 100
        if dip_pct < 10:
            return BPPattern.NOCTURNAL_NON_DIPPER

    if sbp_readings_7d is not None and len(sbp_readings_7d) >= 3:
        if max(sbp_readings_7d) - min(sbp_readings_7d) > 30:
            return BPPattern.LABILE

    return BPPattern.NONE


def pulse_pressure(sbp: int, dbp: int) -> int:
    """Pulse pressure = SBP - DBP. 40-60 ideal. >60 = arterial stiffness risk."""
    return sbp - dbp


def mean_arterial_pressure(sbp: int, dbp: int) -> float:
    """MAP = (SBP + 2*DBP) / 3. Normal 70-100. <65 tissue perfusion risk."""
    return round((sbp + 2 * dbp) / 3, 1)


def assess_bp(sbp: int, dbp: int) -> dict:
    """Single-reading BP assessment."""
    stage = bp_stage(sbp, dbp)
    return {
        "stage": stage.value,
        "tier": bp_tier(stage),
        "pulse_pressure": pulse_pressure(sbp, dbp),
        "map": mean_arterial_pressure(sbp, dbp),
        "action": _bp_action(stage),
    }


def _bp_action(stage: BPStage) -> str:
    """Plain-English action. NEVER diagnostic."""
    return {
        BPStage.NORMAL: "Continue healthy habits; recheck annually.",
        BPStage.ELEVATED: "Lifestyle changes recommended; recheck in 3-6 months.",
        BPStage.STAGE_1: "Discuss with your doctor; recheck in 1-2 weeks.",
        BPStage.STAGE_2: "See your doctor within 1 week.",
        BPStage.HYPERTENSIVE_CRISIS: "Call your doctor today or go to the ER if you have symptoms.",
    }[stage]
