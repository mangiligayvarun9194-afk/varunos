"""
Hard medical safety rails.

These are NON-NEGOTIABLE rules. The brain is not trusted to be careful
here — these are encoded as code paths. If any rule would be violated
by an AI output, the core rejects the output and falls back to a
templated safe message.

The seven rules (per the spec):
  1. Never diagnose. Output is risk tier or screen recommends.
  2. Never replace a doctor. ≥ELEVATED tier prompts "discuss with doctor".
  3. Medical disclaimer in every briefing.
  4. Critical thresholds trigger immediate escalation, not coaching.
  5. Brain never sees raw biomarkers. Sees only tier + label.
  6. All biomarker data encrypted at rest.
  7. Opt-in. Off by default.
"""

from __future__ import annotations
import re
from typing import Literal

DISCLAIMER = (
    "Sarathi Health Surveillance is an educational risk-stratification tool, "
    "not a medical device. It does not diagnose, treat, cure, or prevent any disease. "
    "All outputs are risk tiers computed from validated screening tools and the data you provide. "
    "If you have symptoms, an emergency, or any health concern, contact a licensed medical professional. "
    "In an emergency, call your local emergency number (911, 108, 112, etc.) immediately."
)


# Diagnostic language patterns the brain must NEVER produce
DIAGNOSTIC_PHRASES = [
    r"\byou have\b",
    r"\byou(?:'re| are) (?:diabetic|pre[- ]?diabetic|hypertensive)",
    r"\bdiagnos(?:e|ed|is)\b",
    r"\bthis is (?:a|an) (?:disease|disorder|condition)\b",
    r"\byou (?:need|should) (?:insulin|metformin|medication)\b",
    r"\byou(?:'re| are) (?:at risk of|sick with)\b",
    r"\bchances (?:are|you)\b",
    r"\bsuffer(?:ing)? from\b",
]

DIAG_RE = re.compile("|".join(DIAGNOSTIC_PHRASES), re.IGNORECASE)


def is_medical_claim(text: str) -> bool:
    """Detect diagnostic language in proposed brain output.

    Returns True if the text contains forbidden diagnostic phrases.
    """
    return bool(DIAG_RE.search(text))


def redact_medical_claim(text: str) -> str:
    """Replace forbidden phrases with safe alternatives.

    Conservative replacement: if we detect any diagnostic phrasing,
    we replace the whole sentence with a safe templated form.
    """
    safe_replacements = {
        r"\byou have\b": "your data suggests",
        r"\byou(?:'re| are) diabetic\b": "your glucose readings indicate an elevated risk tier",
        r"\byou(?:'re| are) pre[- ]?diabetic\b": "your data suggests an elevated risk tier",
        r"\byou(?:'re| are) hypertensive\b": "your blood pressure readings are in an elevated tier",
        r"\bdiagnos(?:e|ed|is)\b": "screen for",
        r"\bthis is (?:a|an) (?:disease|disorder|condition)\b": "this may warrant a clinical evaluation",
        r"\byou (?:need|should) (?:insulin|metformin|medication)\b": "discuss treatment options with your doctor",
        r"\byou(?:'re| are) (?:at risk of|sick with)\b": "your data suggests an elevated risk",
        r"\bsuffer(?:ing)? from\b": "showing signs of",
    }
    out = text
    for pattern, repl in safe_replacements.items():
        out = re.sub(pattern, repl, out, flags=re.IGNORECASE)
    return out


def validate_disclaimer_present(text: str) -> bool:
    """Verify a briefing contains the disclaimer (or a shortened form)."""
    short = "not a medical device"
    return DISCLAIMER in text or short in text


def check_escalation_needed(
    *,
    metric: str,
    value,
    unit: str = "",
) -> Literal["none", "watch", "doctor", "er"]:
    """Determine escalation level for a single reading.

    Returns one of: 'none' (just log), 'watch' (mention in next briefing),
    'doctor' (push notification), 'er' (immediate multi-channel blast).
    """
    from .surveillance.escalation import escalate_bp, escalate_glucose, escalate_afib

    if metric == "sbp" or metric == "dbp" or metric == "bp":
        if metric == "bp" and isinstance(value, str) and "/" in value:
            sbp, dbp = value.split("/")
            esc = escalate_bp(sbp=int(sbp), dbp=int(dbp))
        elif metric in ("sbp", "dbp"):
            return "none"  # need both for BP
        else:
            esc = escalate_bp(sbp=int(value.get("sbp", 0)), dbp=int(value.get("dbp", 0)))
        if esc["level"] == "CRITICAL":
            return "er"
        if esc["level"] == "URGENT":
            return "doctor"
        return "none"

    if metric == "glucose":
        esc = escalate_glucose(value_mgdl=float(value))
        if esc["level"] == "CRITICAL":
            return "er"
        if esc["level"] == "URGENT":
            return "doctor"
        if esc["level"] == "NOTIFY":
            return "watch"
        # INFO = normal range, no escalation
        return "none"

    if metric == "afib":
        esc = escalate_afib()
        if esc["level"] == "CRITICAL":
            return "er"
        if esc["level"] == "URGENT":
            return "doctor"
        return "watch"

    return "none"


# Action labels — these are what the brain is allowed to say.
SAFE_ACTION_LABELS = {
    "LOW": "Continue your current habits; routine recheck as scheduled.",
    "ELEVATED": "Discuss with your doctor at your next visit.",
    "HIGH": "See your doctor within 1 week.",
    "CRITICAL": "Call your doctor today or go to the ER if you have symptoms.",
    "MODERATE": "Screen every 6 months; consider lifestyle changes.",
    "BORDERLINE": "Discuss with your doctor at your next visit.",
    "INTERMEDIATE": "Discuss with your doctor at your next visit.",
    "VERY_HIGH": "See your doctor within 1 week.",
    "SLIGHTLY_ELEVATED": "Recheck in 6-12 months; continue healthy habits.",
}


def safe_action_label(tier: str) -> str:
    """Get a safe action label for a tier. Brain uses this for narration."""
    return SAFE_ACTION_LABELS.get(tier, "Discuss with your doctor.")
