"""
CHA2DS2-VASc score — stroke risk in atrial fibrillation.

For patients with AFib, estimates annual stroke risk and guides
anticoagulation decision (per ESC 2020 / AHA guidelines).

Points:
  C   congestive HF                                        +1
  H   hypertension                                          +1
  A2  age >= 75                                            +2
  D   diabetes                                              +1
  S2  prior stroke / TIA / thromboembolism                 +2
  V   vascular disease (MI, PAD, aortic plaque)            +1
  A   age 65-74                                             +1
  Sc  sex category (female)                                 +1

Score -> annual stroke risk %, anticoagulation recommendation:
  0  (men) / 1 (women)     LOW         no anticoagulation
  1  (men)                INTERMEDIATE consider
  >=2 (men) / >=3 (women) HIGH         anticoagulation recommended
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class CHA2DS2VAScInput:
    congestive_hf: bool = False
    hypertension: bool = False
    age: float = 0.0
    diabetes: bool = False
    prior_stroke_tia_thromboembolism: bool = False
    vascular_disease: bool = False
    sex: Literal["M", "F"] = "M"


def cha2ds2vasc_score(inp: CHA2DS2VAScInput) -> int:
    s = 0
    if inp.congestive_hf:
        s += 1
    if inp.hypertension:
        s += 1
    if inp.age >= 75:
        s += 2
    if inp.diabetes:
        s += 1
    if inp.prior_stroke_tia_thromboembolism:
        s += 2
    if inp.vascular_disease:
        s += 1
    if 65 <= inp.age < 75:
        s += 1
    if inp.sex == "F":
        s += 1
    return s


def cha2ds2vasc_tier(score: int, sex: Literal["M", "F"]) -> Literal["LOW", "INTERMEDIATE", "HIGH"]:
    """Stroke-risk tier.

    Note the asymmetric thresholds by sex because women get a +1 baseline.
    """
    if sex == "M":
        if score == 0:
            return "LOW"
        if score == 1:
            return "INTERMEDIATE"
        return "HIGH"
    else:
        if score <= 1:
            return "LOW"
        if score == 2:
            return "INTERMEDIATE"
        return "HIGH"


def anticoag_recommended(score: int, sex: Literal["M", "F"]) -> bool:
    """Per ESC 2020: anticoagulation recommended for men >=2, women >=3."""
    if sex == "M":
        return score >= 2
    return score >= 3


# Approximate annual stroke risk by score (per AHA/ESC data)
ANNUAL_STROKE_RISK_PCT = {
    0: 0.2, 1: 0.6, 2: 2.2, 3: 3.2, 4: 4.8,
    5: 7.2, 6: 9.7, 7: 11.2, 8: 10.8, 9: 12.2,
}
