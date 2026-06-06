"""
FINDRISC — Finnish Diabetes Risk Score (8 questions).

Validated European tool, secondary for Indian-context.
Range 0-26. Tiers: <7 low, 7-11 slightly elevated,
12-14 moderate, 15-20 high, >20 very high.

Inputs (point values per published tool):
  age:         <45=0, 45-54=2, 55-64=3, >64=4
  bmi:         <25=0, 25-30=1, >30=3
  waist:       M<94/F<80=0, M94-102/F80-88=3, M>102/F>88=4
  activity:    daily 30min yes=0, no=2
  fruit_veg:   daily yes=0, no=1
  bp_meds:     no=0, yes=2
  high_glucose_ever: no=0, yes=5
  family_dm:   none=0, 2nd degree=3, 1st degree=5
"""

from __future__ import annotations
from typing import Literal

# 1. Age
_AGE_SCORE = {
    "lt45": 0,
    "45_54": 2,
    "55_64": 3,
    "ge65": 4,
}

# 2. BMI
_BMI_SCORE = {
    "lt25": 0,
    "25_30": 1,
    "ge30": 3,
}

# 3. Waist circumference (sex-specific cutoffs)
_WAIST_SCORE = {
    "normal": 0,         # M<94 / F<80
    "intermediate": 3,   # M 94-102 / F 80-88
    "high": 4,           # M>102 / F>88
}

# 4. Daily physical activity 30 min
_ACTIVITY_SCORE = {True: 0, False: 2}  # active=no points

# 5. Daily fruit/vegetable intake
_FRUIT_VEG_SCORE = {True: 0, False: 1}  # yes=no points

# 6. Ever used BP medication
_BP_MEDS_SCORE = {True: 2, False: 0}

# 7. History of high blood glucose
_HIGH_GLUCOSE_SCORE = {True: 5, False: 0}

# 8. Family history of diabetes
_FAMILY_DM_SCORE = {
    "none": 0,
    "second_degree": 3,   # grandparent, uncle/aunt
    "first_degree": 5,    # parent, sibling, child
}


def findrisc_score(
    age: Literal["lt45", "45_54", "55_64", "ge65"],
    bmi: Literal["lt25", "25_30", "ge30"],
    waist: Literal["normal", "intermediate", "high"],
    active_30min_daily: bool,
    fruit_veg_daily: bool,
    bp_medication_ever: bool,
    high_glucose_ever: bool,
    family_dm: Literal["none", "second_degree", "first_degree"],
) -> int:
    """Return FINDRISC score (0-26)."""
    s = 0
    s += _AGE_SCORE[age]
    s += _BMI_SCORE[bmi]
    s += _WAIST_SCORE[waist]
    s += _ACTIVITY_SCORE[active_30min_daily]
    s += _FRUIT_VEG_SCORE[fruit_veg_daily]
    s += _BP_MEDS_SCORE[bp_medication_ever]
    s += _HIGH_GLUCOSE_SCORE[high_glucose_ever]
    s += _FAMILY_DM_SCORE[family_dm]
    return s


def findrisc_tier(score: int) -> Literal["LOW", "SLIGHTLY_ELEVATED", "MODERATE", "HIGH", "VERY_HIGH"]:
    """Map FINDRISC score to 5-tier risk.

    <7    LOW             (1 in 100 will develop T2DM in 10y)
    7-11  SLIGHTLY_ELEVATED (1 in 25)
    12-14 MODERATE        (1 in 6)
    15-20 HIGH            (1 in 3)
    >20   VERY_HIGH       (1 in 2)
    """
    if score < 7:
        return "LOW"
    if score < 12:
        return "SLIGHTLY_ELEVATED"
    if score < 15:
        return "MODERATE"
    if score <= 20:
        return "HIGH"
    return "VERY_HIGH"
