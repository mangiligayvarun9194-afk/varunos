"""
CGM (Continuous Glucose Monitor) metrics.

Implements the international 2019 Time-in-Range consensus
(Battelino et al., Diabetes Care).

For non-diabetics (the screening use case):
  Goal TIR (70-180): > 95%
  Goal TBR (<70):    < 4%
  Goal TBR (<54):    < 1%
  Goal TAR (>180):   < 5%
  GMI:               < 6.0% ideal
  CV%:               < 36% stable

For T2DM:
  Goal TIR:          > 70%
  Goal TBR (<70):    < 4%
  Goal TBR (<54):    < 1%
  Goal TAR (>180):   < 25%
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class GlycemicMetrics:
    tir_70_180_pct: float      # time in range 70-180 mg/dL
    time_below_70_pct: float
    time_below_54_pct: float
    time_above_180_pct: float
    time_above_250_pct: float
    avg_mgdl: float
    cv_pct: float              # coefficient of variation
    gmi_pct: float             # glucose management indicator (= estimated A1c)
    sd_mgdl: float             # standard deviation
    n_readings: int


def cgm_metrics(
    readings_mgdl: list[float],
    *,
    n_readings_expected_per_day: int = 288,  # 5-min intervals
) -> GlycemicMetrics:
    """Compute CGM metrics from a series of readings.

    Pure function. No I/O. readings_mgdl is a list of sensor values.
    """
    if not readings_mgdl:
        raise ValueError("readings_mgdl must be non-empty")

    n = len(readings_mgdl)
    tir = sum(1 for x in readings_mgdl if 70 <= x <= 180) / n * 100
    tbr70 = sum(1 for x in readings_mgdl if x < 70) / n * 100
    tbr54 = sum(1 for x in readings_mgdl if x < 54) / n * 100
    tar180 = sum(1 for x in readings_mgdl if x > 180) / n * 100
    tar250 = sum(1 for x in readings_mgdl if x > 250) / n * 100

    avg = sum(readings_mgdl) / n
    var = sum((x - avg) ** 2 for x in readings_mgdl) / n
    sd = var ** 0.5
    cv = (sd / avg * 100) if avg > 0 else 0.0

    # GMI formula: 3.31 + 0.02392 * mean (mg/dL)
    gmi = round(3.31 + 0.02392 * avg, 2)

    return GlycemicMetrics(
        tir_70_180_pct=round(tir, 1),
        time_below_70_pct=round(tbr70, 1),
        time_below_54_pct=round(tbr54, 2),
        time_above_180_pct=round(tar180, 1),
        time_above_250_pct=round(tar250, 1),
        avg_mgdl=round(avg, 1),
        cv_pct=round(cv, 1),
        gmi_pct=gmi,
        sd_mgdl=round(sd, 1),
        n_readings=n,
    )


def tir_assessment(metrics: GlycemicMetrics, *, diabetic: bool = False) -> dict:
    """Apply Time-in-Range targets per international consensus 2019.

    diabetic=False → non-diabetic screening targets (stricter).
    """
    if diabetic:
        target_tir = 70.0
        target_tbr70 = 4.0
        target_tbr54 = 1.0
        target_tar180 = 25.0
    else:
        target_tir = 95.0
        target_tbr70 = 4.0
        target_tbr54 = 1.0
        target_tar180 = 5.0

    flags = []
    if metrics.tir_70_180_pct < target_tir:
        flags.append(f"TIR below {target_tir}% target")
    if metrics.time_below_70_pct > target_tbr70:
        flags.append("Too much time below 70")
    if metrics.time_below_54_pct > target_tbr54:
        flags.append("Hypoglycemia risk (<54)")
    if metrics.time_above_180_pct > target_tar180:
        flags.append("Too much time above 180")
    if metrics.cv_pct > 36:
        flags.append("High glycemic variability (CV>36%)")
    if metrics.gmi_pct > 5.7 and not diabetic:
        flags.append("GMI in prediabetes range; confirm with HbA1c")
    if metrics.gmi_pct >= 6.5:
        flags.append("GMI in diabetes range; confirm with HbA1c")

    if not flags:
        tier = "LOW"
    elif any("Hypoglycemia" in f or "diabetes range" in f for f in flags):
        tier = "HIGH"
    elif flags:
        tier = "ELEVATED"

    return {
        "tier": tier,
        "flags": flags,
        "targets": {
            "tir_70_180": target_tir,
            "tbr_70": target_tbr70,
            "tbr_54": target_tbr54,
            "tar_180": target_tar180,
        },
    }


# HOMA-IR = (fasting insulin * fasting glucose) / 405 (mg/dL) or /22.5 (mmol/L)
def homa_ir(fasting_insulin_uU_mL: float, fasting_glucose_mg_dL: float) -> float:
    """HOMA-IR — insulin resistance index. <2.0 ideal, >2.5 suspect."""
    return round((fasting_insulin_uU_mL * fasting_glucose_mg_dL) / 405, 2)


def homa_ir_tier(value: float) -> str:
    if value < 2.0:
        return "LOW"
    if value < 2.5:
        return "ELEVATED"
    return "HIGH"
