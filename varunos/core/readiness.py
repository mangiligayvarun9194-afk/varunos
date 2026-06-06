"""
Readiness, sleep, and wellness composite scores.

Pure functions. Inputs come from the deterministic aggregator.
The brain narrates; the core computes.

Weights per published research (WHOOP, Oura, academic):
  readiness = 0.30*HRV + 0.20*RHR + 0.20*sleep + 0.15*wellness + 0.10*load + 0.05*trend

Each sub-score is 0-100, normalized against the user's own baseline
(7-day for HRV, 30-day for RHR, 14-day for sleep).
"""

from __future__ import annotations
from dataclasses import dataclass
from statistics import mean


@dataclass(frozen=True)
class ReadinessComponents:
    hrv: float
    rhr: float
    sleep: float
    wellness: float
    load: float
    trend: float
    overall: float


def hrv_score(*, hrv_today_ms: float, hrv_7d_baseline_ms: float) -> float:
    """0-100. Higher HRV vs baseline = higher score."""
    if hrv_7d_baseline_ms <= 0:
        return 50.0
    pct = (hrv_today_ms - hrv_7d_baseline_ms) / hrv_7d_baseline_ms
    # +20% → 100, -20% → 0, linear
    score = 50 + (pct * 250)  # 50 + 0.20*250 = 100, 50 + (-0.20)*250 = 0
    return max(0.0, min(100.0, score))


def rhr_score(*, rhr_today_bpm: float, rhr_30d_baseline_bpm: float) -> float:
    """0-100. Lower RHR vs baseline = higher score (better cardiovascular fitness)."""
    if rhr_30d_baseline_bpm <= 0:
        return 50.0
    diff = rhr_today_bpm - rhr_30d_baseline_bpm
    # +10 bpm above baseline = -50 score, -10 bpm = +50
    score = 50 - (diff * 5)
    return max(0.0, min(100.0, score))


def sleep_score_from_components(
    *,
    duration_min: int,
    deep_pct: float,
    rem_pct: float,
    efficiency_pct: float,
    continuity_min: int = 0,
) -> float:
    """Compute sleep score 0-100 from raw sleep stages.

    Targets per the published consensus:
      duration: 7.5h = 100, linear penalty below
      deep: 15-20% optimal
      REM: 20-25% optimal
      efficiency: >90% = 100
      continuity: longer unbroken stretch = higher
    """
    # Duration: 7.5h = 100, 0h = 0
    dur_target = 450  # minutes
    dur_score = min(100, (duration_min / dur_target) * 100)

    # Deep: 17.5% mid-point of 15-20
    if deep_pct < 0:
        deep_score = 50.0
    elif deep_pct < 10:
        deep_score = deep_pct * 5
    elif deep_pct <= 20:
        deep_score = 100 - abs(deep_pct - 17.5) * 2
    else:
        deep_score = max(0, 100 - (deep_pct - 20) * 5)

    # REM: 22.5% mid-point of 20-25
    if rem_pct < 0:
        rem_score = 50.0
    elif rem_pct < 10:
        rem_score = rem_pct * 5
    elif rem_pct <= 25:
        rem_score = 100 - abs(rem_pct - 22.5) * 2
    else:
        rem_score = max(0, 100 - (rem_pct - 25) * 5)

    # Efficiency: 90% = 100, linear below
    eff_score = min(100, max(0, (efficiency_pct - 60) * 3.33))

    # Continuity: longest wake < 5 min = 100, >30 min = 0
    if continuity_min == 0:
        cont_score = 75.0
    else:
        cont_score = max(0, 100 - (continuity_min - 5) * 4)

    return round(
        0.40 * dur_score
        + 0.25 * max(0, deep_score)
        + 0.20 * max(0, rem_score)
        + 0.10 * eff_score
        + 0.05 * cont_score,
        1,
    )


def wellness_score(
    *,
    energy_1to5: int,
    soreness_1to5: int,
    mood_1to5: int,
    stress_1to5: int,
) -> float:
    """Subjective wellness score 0-100.

    Each input 1-5, mapped 0-100 linearly:
      energy 1-5:  0=20, 5=100  (high = good)
      mood 1-5:    0=20, 5=100  (high = good)
      soreness 1-5: 1=100, 5=0  (1 = no soreness = best)
      stress 1-5:  1=100, 5=0   (1 = no stress = best)
    """
    if not all(1 <= x <= 5 for x in [energy_1to5, soreness_1to5, mood_1to5, stress_1to5]):
        return 50.0
    e = (energy_1to5 - 1) * 25   # 1=0, 5=100
    m = (mood_1to5 - 1) * 25     # 1=0, 5=100
    s_inv = (5 - soreness_1to5) * 25  # 1=100, 5=0
    st_inv = (5 - stress_1to5) * 25   # 1=100, 5=0

    return round((e + m + s_inv + st_inv) / 4, 1)


def load_score(*, acute_load: float, chronic_load: float) -> float:
    """Acute:chronic workload ratio -> 0-100 score.

    Ratio 1.0 = optimal, 1.5 = force deload.
    """
    if chronic_load <= 0:
        return 50.0
    ratio = acute_load / chronic_load
    if ratio <= 0.5:
        return 60.0  # detrained
    if ratio <= 1.0:
        return 100.0 - abs(ratio - 0.8) * 100  # peak around 0.8
    if ratio <= 1.3:
        return 80.0 - (ratio - 1.0) * 100
    if ratio <= 1.5:
        return 50.0 - (ratio - 1.3) * 100
    return 0.0  # force deload


def trend_score(*, readiness_last_7d: list[float]) -> float:
    """Trend over last 7 days -> 0-100. Rising trend = higher score."""
    if len(readiness_last_7d) < 2:
        return 50.0
    n = len(readiness_last_7d)
    half = n // 2
    recent = mean(readiness_last_7d[half:])
    prior = mean(readiness_last_7d[:half])
    if prior == 0:
        return 50.0
    diff = recent - prior
    # +20 points = 100, -20 = 0
    score = 50 + diff * 2.5
    return max(0.0, min(100.0, score))


def readiness_score(
    *,
    hrv_today_ms: float,
    hrv_7d_baseline_ms: float,
    rhr_today_bpm: float,
    rhr_30d_baseline_bpm: float,
    sleep_components: dict,
    energy_1to5: int,
    soreness_1to5: int,
    mood_1to5: int,
    stress_1to5: int,
    acute_load: float,
    chronic_load: float,
    readiness_last_7d: list[float] | None = None,
) -> ReadinessComponents:
    """The full readiness composite, 0-100."""
    h = hrv_score(hrv_today_ms=hrv_today_ms, hrv_7d_baseline_ms=hrv_7d_baseline_ms)
    r = rhr_score(rhr_today_bpm=rhr_today_bpm, rhr_30d_baseline_bpm=rhr_30d_baseline_bpm)
    s = sleep_score_from_components(**sleep_components)
    w = wellness_score(
        energy_1to5=energy_1to5,
        soreness_1to5=soreness_1to5,
        mood_1to5=mood_1to5,
        stress_1to5=stress_1to5,
    )
    l = load_score(acute_load=acute_load, chronic_load=chronic_load)
    t = trend_score(readiness_last_7d=readiness_last_7d or [])

    overall = round(
        0.30 * h
        + 0.20 * r
        + 0.20 * s
        + 0.15 * w
        + 0.10 * l
        + 0.05 * t,
        1,
    )
    return ReadinessComponents(hrv=h, rhr=r, sleep=s, wellness=w, load=l, trend=t, overall=overall)


def decision_color(overall: float) -> str:
    """Map readiness 0-100 to the day-of decision color."""
    if overall >= 75:
        return "GREEN"
    if overall >= 50:
        return "YELLOW"
    return "RED"
