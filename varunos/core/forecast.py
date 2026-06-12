"""
VarunOS readiness forecasting — deterministic, no ML black box.

Projects tomorrow's readiness from the recent trend, sleep debt and today's
training load, so the user can PLAN instead of react. Pure functions.
"""

from __future__ import annotations
from statistics import mean
from typing import Optional


def _color(score: float) -> str:
    if score >= 75:
        return "GREEN"
    if score >= 50:
        return "YELLOW"
    return "RED"


def forecast_readiness(
    recent: list[float],
    *,
    last_sleep_hours: Optional[float] = None,
    trained_today: bool = False,
    acute_chronic_ratio: Optional[float] = None,
) -> Optional[dict]:
    """Project tomorrow's readiness.

    `recent` = readiness scores oldest→newest (need >= 3).
    Model (transparent):
      base   = EWMA of recent readiness (reacts to latest days)
      trend  = second-half mean − first-half mean  (momentum)
      proj   = base + 0.5*trend
               − sleep-debt penalty (4 pts / hour under 7h)
               − 5 if you trained hard today (next-day cost)
               − overreach penalty if acute:chronic > 1.3
    """
    if len(recent) < 3:
        return None

    alpha = 0.5
    ew = recent[0]
    for v in recent[1:]:
        ew = alpha * v + (1 - alpha) * ew

    half = len(recent) // 2
    trend = mean(recent[half:]) - mean(recent[:half])
    proj = ew + 0.5 * trend

    reasons: list[str] = []
    if trend > 3:
        reasons.append("your readiness has been climbing")
    elif trend < -3:
        reasons.append("your readiness has been sliding")

    if last_sleep_hours is not None and last_sleep_hours < 7:
        pen = (7 - last_sleep_hours) * 4
        proj -= pen
        reasons.append(f"last night was short ({last_sleep_hours:.1f}h)")

    if trained_today:
        proj -= 5
        reasons.append("you trained today")

    if acute_chronic_ratio is not None and acute_chronic_ratio > 1.3:
        proj -= 8
        reasons.append("your recent load is spiking")

    proj = round(max(0.0, min(100.0, proj)), 1)
    color = _color(proj)
    advice = {
        "GREEN": "Tomorrow looks strong — plan your hardest session.",
        "YELLOW": "Tomorrow looks moderate — keep volume sensible.",
        "RED": "Tomorrow projects low — schedule recovery or a deload now.",
    }[color]

    return {
        "projected": proj,
        "color": color,
        "advice": advice,
        "basis": ", ".join(reasons) if reasons else "steady recent trend",
        "n_days": len(recent),
    }
