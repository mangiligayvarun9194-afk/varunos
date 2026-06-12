"""
Environmental context → training guidance. Deterministic, pure functions.

VarunOS factors in air quality (huge in India), heat and humidity when it
recommends training. No Western fitness app does AQI-aware coaching.
The HTTP fetch lives in the API layer; this module is just the rules.
"""

from __future__ import annotations
from typing import Optional


def aqi_category(us_aqi: float) -> tuple[str, str]:
    """US AQI → (label, color) per EPA bands."""
    if us_aqi <= 50:
        return "Good", "green"
    if us_aqi <= 100:
        return "Moderate", "yellow"
    if us_aqi <= 150:
        return "Unhealthy for sensitive groups", "orange"
    if us_aqi <= 200:
        return "Unhealthy", "red"
    if us_aqi <= 300:
        return "Very unhealthy", "purple"
    return "Hazardous", "maroon"


def training_advice(
    *,
    us_aqi: Optional[float] = None,
    temp_c: Optional[float] = None,
    humidity_pct: Optional[float] = None,
) -> dict:
    """Combine air quality + heat into a single training recommendation."""
    notes: list[str] = []
    severity = "good"   # good | caution | avoid

    if us_aqi is not None:
        label, _ = aqi_category(us_aqi)
        if us_aqi > 150:
            severity = "avoid"
            notes.append(f"Air quality is {label.lower()} (AQI {round(us_aqi)}). "
                         f"Skip outdoor cardio — train indoors today.")
        elif us_aqi > 100:
            severity = "caution"
            notes.append(f"Air is {label.lower()} (AQI {round(us_aqi)}). "
                         f"Outdoor is OK but keep intensity moderate; "
                         f"consider a mask or indoors if you're sensitive.")
        else:
            notes.append(f"Air quality is {label.lower()} (AQI {round(us_aqi)}) — "
                         f"great for outdoor training.")

    if temp_c is not None:
        if temp_c >= 38:
            severity = "avoid" if severity != "avoid" else severity
            notes.append(f"It's {round(temp_c)}°C — dangerous heat. Train indoors or "
                         f"very early/late, hydrate aggressively.")
        elif temp_c >= 32:
            if severity == "good":
                severity = "caution"
            notes.append(f"It's hot ({round(temp_c)}°C) — hydrate, add salt, "
                         f"shorten outdoor sessions.")
        elif temp_c <= 5:
            notes.append(f"It's cold ({round(temp_c)}°C) — warm up longer to protect joints.")

    if humidity_pct is not None and humidity_pct >= 80 and (temp_c or 0) >= 28:
        if severity == "good":
            severity = "caution"
        notes.append("High humidity — your heart rate will run higher than usual; "
                     "judge effort by feel, not pace.")

    headline = {
        "good": "Good conditions for outdoor training",
        "caution": "Train with care today",
        "avoid": "Better to train indoors today",
    }[severity]

    return {
        "severity": severity,
        "headline": headline,
        "notes": notes or ["No environmental concerns."],
    }
