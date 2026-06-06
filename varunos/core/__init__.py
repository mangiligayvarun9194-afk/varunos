"""
VarunOS Deterministic Core.

ALL numeric computation lives here. The AI brain NEVER owns a number.
This is the spine of the system — pure functions, 100% testable,
zero network I/O, zero LLM calls.

The five sub-modules:
  - workouts    program loading, periodization, progression, auto-regulation, PR detection
  - diet        TDEE, macro calc, adaptive triggers
  - surveillance  medical risk scores (imported from .surveillance)
  - readiness   composite readiness + sleep + wellness scores
  - safety      hard medical rules enforcement (the "never diagnose" rail)
"""

from .workouts import (
    load_program, substitute_exercise, progression_step, auto_regulate, detect_pr,
    epley_1rm, brzycki_1rm, block_for_week, decision_for_readiness, ProgressionScheme,
    WorkoutDecision, ProgressionResult, PeriodizationBlock, SetLog, best_1rm_estimate,
)
from .diet import (
    bmr_mifflin, tdee, goal_kcal, macros, adaptive_adjustment, food_macros, day_totals,
    grocery_list_from_plan, generate_meal_plan, MacroTargets, MealPlan,
)
from .readiness import (
    readiness_score, sleep_score_from_components as sleep_score, wellness_score,
    load_score, trend_score, decision_color, ReadinessComponents,
)
from .safety import (
    is_medical_claim, redact_medical_claim, check_escalation_needed,
    validate_disclaimer_present, safe_action_label, DISCLAIMER,
)
from . import surveillance

__all__ = [
    # workouts
    "load_program", "substitute_exercise", "progression_step", "auto_regulate", "detect_pr",
    "epley_1rm", "brzycki_1rm", "block_for_week", "decision_for_readiness",
    "ProgressionScheme", "WorkoutDecision", "ProgressionResult", "PeriodizationBlock",
    "SetLog", "best_1rm_estimate",
    # diet
    "bmr_mifflin", "tdee", "goal_kcal", "macros", "adaptive_adjustment",
    "food_macros", "day_totals", "grocery_list_from_plan", "generate_meal_plan",
    "MacroTargets", "MealPlan",
    # readiness
    "readiness_score", "sleep_score", "wellness_score", "load_score", "trend_score",
    "decision_color", "ReadinessComponents",
    # safety
    "is_medical_claim", "redact_medical_claim", "check_escalation_needed",
    "validate_disclaimer_present", "safe_action_label", "DISCLAIMER",
    # surveillance
    "surveillance",
]
