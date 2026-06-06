"""
Indian Diabetes Risk Score (IDRS) — Mohan et al. 2005.

Validated in Indian populations. The PRIMARY diabetes screening tool
for this system, because the user base is Indian-context.

Inputs (all categorical):
  age:        <35 | 35-49 | >=50
  bmi:        <25 | 25-29 | >=30
  waist:      'normal' (M<90/F<80) | 'intermediate' (M90-99/F80-89) | 'high' (M>=100/F>=90)
  family_hx:  True/False  (parent/sibling with diabetes)
  activity:   'vigorous' | 'mild' | 'sedentary'

Output: integer score 0-100, tier (LOW/MODERATE/HIGH).

Tiers (per published IDRS):
  <30   LOW       annual screening
  30-50 MODERATE  screen every 6 months, consider lifestyle
  >50   HIGH      screen now, refer to doctor
"""

from __future__ import annotations
from typing import Literal

# ---- Point tables (deterministic) ----------------------------------------

_AGE_SCORE = {  # type: ignore[var-annotated]
    "lt35": 0,
    "35_49": 20,
    "ge50": 30,
}

_BMI_SCORE = {
    "lt25": 0,
    "25_29": 10,
    "ge30": 20,
}

_WAIST_SCORE = {
    "normal": 0,         # M<90cm or F<80cm
    "intermediate": 10,  # M 90-99 or F 80-89
    "high": 20,          # M >=100 or F >=90
}

_FAMILY_SCORE = {True: 10, False: 0}

_ACTIVITY_SCORE = {
    "vigorous": 0,
    "mild": 10,
    "sedentary": 20,
}


def idrs_score(
    age: Literal["lt35", "35_49", "ge50"],
    bmi: Literal["lt25", "25_29", "ge30"],
    waist: Literal["normal", "intermediate", "high"],
    family_hx: bool,
    activity: Literal["vigorous", "mild", "sedentary"],
) -> int:
    """Return IDRS score (0-100).

    Pure function. No I/O. No side effects. Fully testable.
    """
    s = 0
    s += _AGE_SCORE[age]
    s += _BMI_SCORE[bmi]
    s += _WAIST_SCORE[waist]
    s += _FAMILY_SCORE[family_hx]
    s += _ACTIVITY_SCORE[activity]
    return s


def idrs_tier(score: int) -> Literal["LOW", "MODERATE", "HIGH"]:
    """Map IDRS score to risk tier.

    LOW:       score < 30   — screen annually
    MODERATE:  score 30-50  — screen every 6 mo, consider lifestyle
    HIGH:      score > 50   — screen now, refer to doctor
    """
    if score < 30:
        return "LOW"
    if score <= 50:
        return "MODERATE"
    return "HIGH"


# ---- Convenience: full assessment from raw numbers ------------------------

def assess_from_raw(
    *,
    age_years: float,
    bmi: float,
    waist_cm: float,
    sex: Literal["M", "F"],
    family_history_dm: bool,
    activity: Literal["vigorous", "mild", "sedentary"],
) -> dict:
    """Convenience wrapper: take raw measurements, return score + tier + components.

    Returns a dict so callers can pass it to the AI brain for narration.
    The brain NEVER sees raw values for the narrative; it sees only the tier
    plus an action label. The dict here is for the deterministic core and
    the encrypted vault.
    """
    if age_years < 35:
        age_cat = "lt35"
    elif age_years < 50:
        age_cat = "35_49"
    else:
        age_cat = "ge50"

    if bmi < 25:
        bmi_cat = "lt25"
    elif bmi < 30:
        bmi_cat = "25_29"
    else:
        bmi_cat = "ge30"

    # ICMR Indian cutoffs: M 90/F 80
    if sex == "M":
        if waist_cm < 90:
            waist_cat = "normal"
        elif waist_cm < 100:
            waist_cat = "intermediate"
        else:
            waist_cat = "high"
    else:
        if waist_cm < 80:
            waist_cat = "normal"
        elif waist_cm < 90:
            waist_cat = "intermediate"
        else:
            waist_cat = "high"

    score = idrs_score(age_cat, bmi_cat, waist_cat, family_history_dm, activity)
    tier = idrs_tier(score)

    return {
        "score": score,
        "tier": tier,
        "components": {
            "age": age_cat,
            "bmi": bmi_cat,
            "waist": waist_cat,
            "family_hx": family_history_dm,
            "activity": activity,
        },
        "screening_recommendation": {
            "LOW": "Annual screening",
            "MODERATE": "Screen every 6 months; consider lifestyle changes",
            "HIGH": "Screen now and refer to doctor",
        }[tier],
    }
