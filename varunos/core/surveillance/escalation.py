"""
Emergency escalation logic.

CRITICAL thresholds trigger immediate action — no narration, no coaching.
The deterministic core detects, the orchestration layer (n8n) routes,
the user gets a multi-channel blast within 5 seconds.

NEVER auto-dial 911/108/112 (user-confirmed except FAST/chest pain).
NEVER override user choice.
NEVER send PII to anyone other than the configured emergency contact.

The function `escalate()` returns a structured payload describing:
  - severity
  - channels to use
  - the message text
  - whether to call the emergency contact
  - time-to-action target
"""

from __future__ import annotations
from enum import Enum
from typing import Literal


class EscalationLevel(str, Enum):
    INFO = "INFO"                       # informational, log only
    NOTIFY = "NOTIFY"                   # one-channel ping
    ALERT = "ALERT"                     # multi-channel, no auto-call
    URGENT = "URGENT"                   # multi-channel + prompt to call doctor
    CRITICAL = "CRITICAL"               # multi-channel + auto-call EC after 60s


# ---- Channel sets --------------------------------------------------------

CHANNELS_BY_LEVEL = {
    EscalationLevel.INFO: [],
    EscalationLevel.NOTIFY: ["whatsapp"],
    EscalationLevel.ALERT: ["whatsapp", "sms", "pwa_push"],
    EscalationLevel.URGENT: ["whatsapp", "sms", "voice_call", "pwa_push", "email"],
    EscalationLevel.CRITICAL: ["whatsapp", "sms", "voice_call", "pwa_push", "email", "watch_haptic"],
}


def escalate(
    *,
    scope: Literal["glucose", "bp", "ecg", "stroke", "cardiac", "general"],
    metric: str,
    value: float | str,
    unit: str = "",
    symptoms: list[str] | None = None,
) -> dict:
    """Generic escalate() for any CRITICAL finding.

    Returns a structured escalation payload (no I/O, no side effects).
    """
    symptoms = symptoms or []

    # Map symptoms to immediate 911-recommendation
    emergency_symptoms = {
        "chest_pain", "severe_headache", "vision_loss",
        "slurred_speech", "numbness", "weakness_one_side",
        "shortness_of_breath", "confusion", "fainting",
        "stroke_face_droop", "stroke_arm_weakness", "stroke_speech",
    }

    has_emergency_symptom = bool(set(symptoms) & emergency_symptoms)

    # Severe glucose values (hypo < 54, hyper > 300) are critical even without symptoms
    severe_glucose = (
        scope == "glucose"
        and isinstance(value, (int, float))
        and (value < 54 or value > 300)
    )

    if has_emergency_symptom or scope in ("stroke", "cardiac") or severe_glucose:
        level = EscalationLevel.CRITICAL
        if scope == "glucose" and isinstance(value, (int, float)) and value < 54:
            recommendation = "Treat hypoglycemia NOW. Take 15g fast carbs, retest in 15 min. Call emergency (911/108/112) if symptoms."
        elif scope == "glucose":
            recommendation = "Glucose severely elevated. Call your doctor today or go to the ER."
        else:
            recommendation = "Call your local emergency number NOW (911 / 108 / 112). Do not wait."
    else:
        level = EscalationLevel.URGENT
        recommendation = "Contact your doctor today or go to the ER if you have symptoms."

    return {
        "level": level.value,
        "scope": scope,
        "metric": metric,
        "value": value,
        "unit": unit,
        "symptoms": symptoms,
        "channels": CHANNELS_BY_LEVEL[level],
        "message": _compose_message(scope, metric, value, unit, recommendation, symptoms),
        "recommendation": recommendation,
        "call_emergency_contact_after_s": 60 if level == EscalationLevel.CRITICAL else None,
        "tta_seconds": 5,
    }


def escalate_glucose(
    *,
    value_mgdl: float,
    context: str = "random",
    symptomatic: bool = False,
) -> dict:
    """Glucose-specific escalation. Different rules for hypo vs hyper.

    Normal range (70-180 for non-diabetic random): returns INFO.
    Borderline (54-70 or 180-300 without symptoms): NOTIFY.
    Critical (<54 or >300, or symptomatic hypo/hyper): CRITICAL.
    """
    # Normal range: just log, no alert
    if 70 <= value_mgdl <= 180 and not symptomatic:
        return {
            "level": EscalationLevel.INFO.value,
            "scope": "glucose",
            "value": value_mgdl,
            "unit": "mg/dL",
            "channels": [],
            "message": f"Glucose {value_mgdl} mg/dL — log only, no action.",
        }
    if value_mgdl < 54:
        return escalate(
            scope="glucose",
            metric="glucose",
            value=value_mgdl,
            unit="mg/dL",
            symptoms=(["confusion", "fainting"] if symptomatic else []),
        )
    if value_mgdl < 70 and symptomatic:
        return escalate(
            scope="glucose",
            metric="glucose",
            value=value_mgdl,
            unit="mg/dL",
            symptoms=["confusion", "sweating"],
        )
    if value_mgdl > 300:
        return escalate(
            scope="glucose",
            metric="glucose",
            value=value_mgdl,
            unit="mg/dL",
            symptoms=(["shortness_of_breath", "confusion"] if symptomatic else []),
        )
    if value_mgdl > 250 and symptomatic:
        return escalate(
            scope="glucose",
            metric="glucose",
            value=value_mgdl,
            unit="mg/dL",
            symptoms=["nausea", "fatigue"],
        )
    # Borderline (not in normal range, but not critical)
    return {
        "level": EscalationLevel.NOTIFY.value,
        "scope": "glucose",
        "value": value_mgdl,
        "unit": "mg/dL",
        "channels": ["whatsapp"],
        "message": f"Glucose {value_mgdl} mg/dL — log + monitor.",
    }


def escalate_bp(
    *,
    sbp: int,
    dbp: int,
    symptomatic: bool = False,
    symptoms: list[str] | None = None,
) -> dict:
    """BP-specific escalation.

    Hypertensive crisis (SBP > 180 OR DBP > 120) is CRITICAL — always
    call doctor/ER today, even without symptoms.
    """
    symptoms = symptoms or []
    if sbp > 180 or dbp > 120:
        return escalate(
            scope="cardiac",  # Use 'cardiac' to trigger CRITICAL in escalate()
            metric="blood_pressure",
            value=f"{sbp}/{dbp}",
            unit="mmHg",
            symptoms=symptoms or [],
        )
    return {
        "level": EscalationLevel.NOTIFY.value,
        "scope": "bp",
        "value": f"{sbp}/{dbp}",
        "unit": "mmHg",
        "channels": ["whatsapp"],
        "message": f"BP {sbp}/{dbp} — log only, no action.",
    }


def escalate_afib(
    *,
    source: str = "apple_watch",
    duration_s: int | None = None,
    symptomatic: bool = False,
) -> dict:
    """AFib detection on ECG."""
    if symptomatic:
        return escalate(
            scope="cardiac",
            metric="ecg",
            value="AFib",
            symptoms=["palpitations", "shortness_of_breath", "chest_pain"],
        )
    return {
        "level": EscalationLevel.URGENT.value,
        "scope": "ecg",
        "metric": "ecg_classification",
        "value": "AFib",
        "channels": CHANNELS_BY_LEVEL[EscalationLevel.URGENT],
        "message": (
            f"AFib detected on {source} ECG. "
            f"See your doctor this week. "
            f"Reply SHARE to generate a doctor-share PDF."
        ),
        "recommendation": "See doctor within 1 week.",
        "tta_seconds": 5,
    }


def escalate_stroke_symptoms(*, symptoms: list[str]) -> dict:
    """FAST stroke detection — immediate CRITICAL."""
    return escalate(
        scope="stroke",
        metric="stroke_assessment",
        value="FAST positive",
        symptoms=symptoms,
    )


def _compose_message(
    scope: str,
    metric: str,
    value,
    unit: str,
    recommendation: str,
    symptoms: list[str],
) -> str:
    sym_str = f" Symptoms: {', '.join(symptoms)}." if symptoms else ""
    return (
        f"VarunOS alert: {scope} reading {value} {unit}.{sym_str} "
        f"{recommendation}"
    )
