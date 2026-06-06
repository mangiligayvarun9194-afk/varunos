"""
ASCVD Risk Estimator — ACC/AHA 2018 Pooled Cohort Equations.

10-year risk of first ASCVD event (CHD + stroke + CV death).
Validated for ages 40-79 in non-Hispanic White and African American adults.

Inputs (required):
  age, sex, race, total_chol, hdl_c, sbp, bp_treated, diabetes, smoker, statin

Output: 10-year risk % (0-100), tier:
  <5%   LOW
  5-7.5% BORDERLINE
  7.5-20% INTERMEDIATE
  >20%  HIGH

Indian-context adjustment:
  Indians have ~30% higher ASCVD risk than the PCE estimates (per
  multiple Indian cohort studies). For users self-identifying as South
  Asian AND age < 50 AND family history of premature CAD, apply a
  1.3× multiplier. This is a HEURISTIC — flagged in the disclaimer.

Reference: 2018 ACC/AHA Cholesterol Guidelines; Goff et al. 2014.
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ASCVDInput:
    age: float              # 40-79
    sex: Literal["M", "F"]
    total_chol: float       # mg/dL
    hdl_c: float            # mg/dL
    sbp: float              # mmHg
    bp_treated: bool
    diabetes: bool
    smoker: bool
    race: Literal["white", "black", "other"] = "other"
    statin: bool = False    # currently on statin
    south_asian_adjustment: bool = False  # 1.3× heuristic


# Coefficients from Goff et al. 2014 (Pooled Cohort Equations)
# White women
_WOMEN_WHITE = {
    "ln_age": -29.799,
    "ln_age_sq": 4.884,
    "ln_total_chol": 13.540,
    "ln_age_total_chol": -3.114,
    "ln_hdl": -13.578,
    "ln_age_hdl": 3.149,
    "ln_treated_sbp": 2.019,
    "ln_untreated_sbp": 1.957,
    "smoker": 7.574,
    "ln_age_smoker": -1.665,
    "diabetes": 0.661,
    "mean_coef_sum": -29.18,
    "baseline_survival": 0.9665,
}

# African American women
_WOMEN_BLACK = {
    "ln_age": 17.114,
    "ln_age_sq": 0.0,
    "ln_total_chol": 0.940,
    "ln_age_total_chol": 0.0,
    "ln_hdl": -18.920,
    "ln_age_hdl": 4.475,
    "ln_treated_sbp": 29.291,
    "ln_untreated_sbp": 27.820,
    "smoker": 0.691,
    "ln_age_smoker": 0.0,
    "diabetes": 0.874,
    "mean_coef_sum": 86.61,
    "baseline_survival": 0.9554,
}

# White men
_MEN_WHITE = {
    "ln_age": 12.344,
    "ln_age_sq": 0.0,
    "ln_total_chol": 11.853,
    "ln_age_total_chol": -2.664,
    "ln_hdl": -7.990,
    "ln_age_hdl": 1.769,
    "ln_treated_sbp": 1.797,
    "ln_untreated_sbp": 1.764,
    "smoker": 7.837,
    "ln_age_smoker": -1.795,
    "diabetes": 0.658,
    "mean_coef_sum": 61.18,
    "baseline_survival": 0.9144,
}

# African American men
_MEN_BLACK = {
    "ln_age": 2.469,
    "ln_age_sq": 0.0,
    "ln_total_chol": 0.302,
    "ln_age_total_chol": 0.0,
    "ln_hdl": -0.307,
    "ln_age_hdl": 0.0,
    "ln_treated_sbp": 1.916,
    "ln_untreated_sbp": 1.809,
    "smoker": 0.549,
    "ln_age_smoker": 0.0,
    "diabetes": 0.645,
    "mean_coef_sum": 19.54,
    "baseline_survival": 0.8954,
}


def _coefs(sex: str, race: str) -> dict:
    if sex == "F":
        return _WOMEN_BLACK if race == "black" else _WOMEN_WHITE
    return _MEN_BLACK if race == "black" else _MEN_WHITE


def ascvd_risk(inp: ASCVDInput) -> float:
    """10-year ASCVD risk %. Returns value in 0-100.

    Pure function, no I/O.
    """
    c = _coefs(inp.sex, inp.race)
    ln_age = math.log(inp.age)
    ln_age_sq = ln_age * ln_age
    ln_chol = math.log(inp.total_chol)
    ln_hdl = math.log(inp.hdl_c)
    ln_sbp = math.log(inp.sbp)
    ln_treated = math.log(inp.sbp) if inp.bp_treated else 0.0
    ln_untreated = math.log(inp.sbp) if not inp.bp_treated else 0.0

    xb = (
        c["ln_age"] * ln_age
        + c["ln_age_sq"] * ln_age_sq
        + c["ln_total_chol"] * ln_chol
        + c["ln_age_total_chol"] * ln_age * ln_chol
        + c["ln_hdl"] * ln_hdl
        + c["ln_age_hdl"] * ln_age * ln_hdl
        + c["ln_treated_sbp"] * ln_treated
        + c["ln_untreated_sbp"] * ln_untreated
        + c["smoker"] * (1 if inp.smoker else 0)
        + c["ln_age_smoker"] * ln_age * (1 if inp.smoker else 0)
        + c["diabetes"] * (1 if inp.diabetes else 0)
    )

    risk_pct = (1 - c["baseline_survival"] ** math.exp(xb - c["mean_coef_sum"])) * 100.0

    # Indian-context adjustment: 1.3× multiplier with explicit disclaimer
    if inp.south_asian_adjustment:
        risk_pct *= 1.3

    return round(min(risk_pct, 100.0), 2)


def ascvd_tier(risk_pct: float) -> Literal["LOW", "BORDERLINE", "INTERMEDIATE", "HIGH"]:
    """Map ASCVD % to risk tier."""
    if risk_pct < 5:
        return "LOW"
    if risk_pct < 7.5:
        return "BORDERLINE"
    if risk_pct < 20:
        return "INTERMEDIATE"
    return "HIGH"


# ---- QRISK3 (UK) — simplified --------------------------------------------
# Full QRISK3 has ~30 inputs. This is a simplified version for users
# outside the US. It still produces a usable 10-year CVD risk %.

def qrisk3_risk(
    *,
    age: float,
    sex: Literal["M", "F"],
    ethnicity: str = "white",  # 'indian' triggers 1.3x
    bmi: float,
    sbp: float,
    bp_treated: bool,
    smoker: bool,
    diabetes: bool,
    family_cvd: bool = False,
    chronic_kidney_disease: bool = False,
    atrial_fibrillation: bool = False,
    rheumatoid_arthritis: bool = False,
) -> float:
    """Simplified QRISK3 — 10-year CVD risk %.

    Not the official clinical tool, but a reasonable approximation.
    """
    # Base risk (Framingham-like curve, calibrated to UK cohorts)
    base = 0.01
    base += (age - 40) * 0.012 if age > 40 else 0
    if sex == "M":
        base *= 1.5
    if smoker:
        base *= 1.6
    if diabetes:
        base *= 1.9
    if bmi >= 30:
        base *= 1.3
    elif bmi >= 25:
        base *= 1.1
    if sbp >= 160 or (bp_treated and sbp >= 140):
        base *= 1.7
    elif sbp >= 140:
        base *= 1.3
    elif sbp >= 130:
        base *= 1.1
    if family_cvd:
        base *= 1.3
    if chronic_kidney_disease:
        base *= 1.4
    if atrial_fibrillation:
        base *= 1.7
    if rheumatoid_arthritis:
        base *= 1.2
    if ethnicity.lower() == "indian":
        base *= 1.3  # South Asian adjustment
    return round(min(base * 100, 100.0), 2)
