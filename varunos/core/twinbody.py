"""
True-Size Twin body measurements — validation + avatar morph derivation.

Pure and deterministic like everything in core/: same inputs, same outputs,
no I/O. The API layer persists measurements; this module only answers two
questions: "are these numbers humanly plausible?" and "what blend-shape
morphs should the 3D Twin render?".

Each morph is the ratio of the user's actual girth/length to the
anthropometric baseline for their height (baseline = coef * height_cm),
clamped to what the avatar rig can display. Missing input → neutral 1.0.
Nothing is rounded internally — callers round for display.
"""

from __future__ import annotations


# The canonical measurement fields and their plausibility ranges (cm / kg).
# Anything outside these bounds is a typo or a unit mistake, not a human.
RANGES: dict[str, tuple[float, float]] = {
    "height_cm":   (120.0, 230.0),
    "weight_kg":   (30.0, 250.0),
    "chest_cm":    (60.0, 170.0),
    "waist_cm":    (50.0, 160.0),
    "hip_cm":      (60.0, 170.0),
    "shoulder_cm": (30.0, 60.0),
    "inseam_cm":   (50.0, 110.0),
    "sleeve_cm":   (40.0, 80.0),
    "neck_cm":     (25.0, 55.0),
}

FIELDS: tuple[str, ...] = tuple(RANGES)

# Baseline girth/length as a fraction of height (anthropometric averages),
# and the morph channel each measurement drives. neck_cm is stored but has
# no dedicated morph channel on the rig (yet).
_BASELINE_FRAC: dict[str, float] = {
    "chest_cm":    0.55,
    "waist_cm":    0.47,
    "hip_cm":      0.53,
    "shoulder_cm": 0.259,
    "inseam_cm":   0.45,
    "sleeve_cm":   0.33,
}
_MORPH_OF: dict[str, str] = {
    "chest_cm":    "chest",
    "waist_cm":    "waist",
    "hip_cm":      "hips",
    "shoulder_cm": "shoulders",
    "sleeve_cm":   "arms",
    "inseam_cm":   "legs",
}

MORPH_CHANNELS = ("chest", "waist", "hips", "shoulders", "arms", "legs", "height")

# Rig display limits: girth morphs 0.80–1.25, overall height 0.85–1.15.
MORPH_MIN, MORPH_MAX = 0.80, 1.25
HEIGHT_MORPH_MIN, HEIGHT_MORPH_MAX = 0.85, 1.15
_REFERENCE_HEIGHT_CM = 175.0

# BMI nudges the waist beyond the pure tape ratio: heavier-than-lean builds
# carry it at the midsection. Factor = 1 + (bmi - 23) * 0.01, clamped.
_BMI_NEUTRAL = 23.0
_BMI_FACTOR_PER_POINT = 0.01
_BMI_FACTOR_MIN, _BMI_FACTOR_MAX = 0.93, 1.12


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# ---- Goal projection --------------------------------------------------------
# "What will my Twin look like if I hit my goal?" Each goal applies fixed
# multipliers to the measurements it plausibly changes; everything else passes
# through untouched. Results are clamped back into the validation RANGES so a
# projected body is always one the validator (and the rig) would accept.

GOALS: tuple[str, ...] = ("cut", "recomp", "lean_bulk", "bulk")
DEFAULT_GOAL = "recomp"

_GOAL_MULTIPLIERS: dict[str, dict[str, float]] = {
    "cut":       {"waist_cm": 0.92, "hip_cm": 0.96, "weight_kg": 0.92},
    "recomp":    {"waist_cm": 0.94, "chest_cm": 1.04, "shoulder_cm": 1.03},
    "lean_bulk": {"chest_cm": 1.06, "shoulder_cm": 1.05, "sleeve_cm": 1.04,
                  "waist_cm": 0.98},
    "bulk":      {"chest_cm": 1.08, "shoulder_cm": 1.06, "waist_cm": 1.02,
                  "weight_kg": 1.08},
}


def derive_goal_measurements(m: dict, goal: str = DEFAULT_GOAL) -> dict:
    """Project measurements to where the user's goal would take them.

    Pure and deterministic: returns a NEW dict (the input is never mutated).
    Unknown goals fall back to 'recomp'. Multipliers apply only to fields
    actually present (and numeric); each adjusted field is clamped back into
    its plausibility range. Untouched fields pass through unchanged.
    """
    multipliers = _GOAL_MULTIPLIERS.get(goal, _GOAL_MULTIPLIERS[DEFAULT_GOAL])
    out = dict(m or {})
    for field, factor in multipliers.items():
        value = out.get(field)
        if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        lo, hi = RANGES[field]
        out[field] = _clamp(float(value) * factor, lo, hi)
    return out


def validate_measurements(m: dict) -> dict:
    """Check a measurement dict for plausibility.

    Returns {field: error_string} — an empty dict means valid. All canonical
    fields are optional floats; None counts as "not provided". Unknown fields
    are rejected so a client typo can't silently drop a measurement.
    """
    errors: dict[str, str] = {}
    for field, value in (m or {}).items():
        if field not in RANGES:
            errors[field] = "unknown field"
            continue
        if value is None:
            continue  # optional — treated as not provided
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            errors[field] = "must be a number"
            continue
        lo, hi = RANGES[field]
        if not (lo <= float(value) <= hi):
            errors[field] = f"must be between {lo:g} and {hi:g}"
    return errors


def derive_morphs(m: dict) -> dict:
    """Derive the Twin's blend-shape morphs from measurements.

    {chest, waist, hips, shoulders, arms, legs, height}, each 1.0 when its
    input (or height_cm, the denominator) is missing. Girth/length channels
    clamp to 0.80–1.25; height clamps to 0.85–1.15 around a 175 cm reference.
    When weight is also known, BMI adjusts the waist after the tape ratio.
    """
    morphs = {ch: 1.0 for ch in MORPH_CHANNELS}
    m = m or {}
    height = m.get("height_cm")
    if not height:
        return morphs  # no height → no baselines → neutral avatar

    morphs["height"] = _clamp(height / _REFERENCE_HEIGHT_CM,
                              HEIGHT_MORPH_MIN, HEIGHT_MORPH_MAX)
    for field, coef in _BASELINE_FRAC.items():
        actual = m.get(field)
        if actual is None:
            continue
        morphs[_MORPH_OF[field]] = _clamp(actual / (coef * height),
                                          MORPH_MIN, MORPH_MAX)

    # BMI waist adjustment — applied AFTER the tape ratio, then re-clamped.
    # Only when a waist ratio exists: BMI shapes the waist, it doesn't invent one.
    weight = m.get("weight_kg")
    if weight is not None and m.get("waist_cm") is not None:
        bmi = weight / (height / 100.0) ** 2
        factor = _clamp(1.0 + (bmi - _BMI_NEUTRAL) * _BMI_FACTOR_PER_POINT,
                        _BMI_FACTOR_MIN, _BMI_FACTOR_MAX)
        morphs["waist"] = _clamp(morphs["waist"] * factor, MORPH_MIN, MORPH_MAX)

    return morphs
