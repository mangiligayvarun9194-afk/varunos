"""
Workout core — program library, periodization, auto-regulation, PR detection.

Every function here is pure. Given the same inputs, returns the same output.
The brain narrates; the core computes.

Sub-modules:
  - 1RM estimation (Epley, Brzycki)
  - Program loading (from JSON)
  - Exercise substitution (equipment-aware)
  - Progression schemes (5 types)
  - Periodization (macro/meso/micro cycles)
  - Auto-regulation (the day-of decision)
  - PR detection
"""

from __future__ import annotations
import json
import math
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Literal


# ---- 1RM estimation --------------------------------------------------------

def epley_1rm(weight_kg: float, reps: int) -> float:
    """Epley formula: 1RM = weight * (1 + reps/30)."""
    if reps < 1:
        raise ValueError("reps must be >= 1")
    if reps == 1:
        return float(weight_kg)
    return weight_kg * (1 + reps / 30)


def brzycki_1rm(weight_kg: float, reps: int) -> float:
    """Brzycki formula: 1RM = weight * 36 / (37 - reps). Accurate for reps 1-10."""
    if reps < 1 or reps >= 37:
        raise ValueError("reps must be 1..36 for Brzycki")
    return weight_kg * 36 / (37 - reps)


def best_1rm_estimate(weight_kg: float, reps: int) -> float:
    """Best of Epley/Brzycki; both are valid up to 10 reps."""
    if reps == 1:
        return float(weight_kg)
    e = epley_1rm(weight_kg, reps)
    if reps > 10:
        return e
    b = brzycki_1rm(weight_kg, reps)
    return round((e + b) / 2, 2)


# ---- Programs (JSON loaders) ----------------------------------------------

PROGRAMS_DIR = Path(__file__).parent.parent / "data" / "programs"
EXERCISES_DIR = Path(__file__).parent.parent / "data" / "exercises"


@dataclass(frozen=True)
class Exercise:
    id: str
    name: str
    primary_muscles: list[str]
    equipment: list[str]
    difficulty: Literal["beginner", "intermediate", "advanced"]
    substitutions: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ProgramDay:
    name: str
    exercises: list[dict]   # {id, sets, reps, intensity, rest_s}


@dataclass(frozen=True)
class Program:
    name: str
    goal: str
    split: list[str]
    days_per_week: int
    weeks: int
    deload_week: int
    days: list[ProgramDay]
    progression_rule: str
    substitutions: dict[str, list[str]]


def load_program(name: str) -> Program:
    """Load a program from JSON by name (filename without .json)."""
    path = PROGRAMS_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Program not found: {name}")
    with open(path) as f:
        data = json.load(f)
    days = [ProgramDay(d["name"], d["exercises"]) for d in data["days"]]
    return Program(
        name=data["name"],
        goal=data["goal"],
        split=data["split"],
        days_per_week=data["days_per_week"],
        weeks=data["weeks"],
        deload_week=data.get("deload_week", weeks_default_deload(data["weeks"])),
        days=days,
        progression_rule=data.get("progression_rule", "double_progression"),
        substitutions=data.get("substitutions", {}),
    )


def weeks_default_deload(weeks: int) -> int:
    """Auto-compute deload week: every 4-6 weeks."""
    return min(weeks - 1, max(3, ((weeks - 1) // 4) * 4))


def load_exercise(ex_id: str) -> Exercise:
    """Load exercise from JSON library (searches all files)."""
    for f in EXERCISES_DIR.glob("*.json"):
        with open(f) as fp:
            data = json.load(fp)
            for ex in data.get("exercises", []):
                if ex["id"] == ex_id:
                    return Exercise(
                        id=ex["id"],
                        name=ex["name"],
                        primary_muscles=ex.get("primary_muscles", []),
                        equipment=ex.get("equipment", []),
                        difficulty=ex.get("difficulty", "intermediate"),
                        substitutions=ex.get("substitutions", []),
                    )
    raise KeyError(f"Exercise not found: {ex_id}")


def substitute_exercise(program: Program, ex_id: str, available_equipment: list[str]) -> str:
    """Pick the first substitute that uses only available equipment.

    The brain never invents a substitution. This table is deterministic.
    """
    candidates = program.substitutions.get(ex_id, [])
    for sub in candidates:
        try:
            sub_ex = load_exercise(sub)
        except KeyError:
            continue
        if all(e in available_equipment for e in sub_ex.equipment) or not sub_ex.equipment:
            return sub
    # Fall back to bodyweight
    return candidates[0] if candidates else ex_id


# ---- Progression ----------------------------------------------------------

class ProgressionScheme(str, Enum):
    DOUBLE = "double_progression"      # add reps until top, then weight
    LINEAR = "linear"                   # +2.5kg/week
    WAVE = "wave"                       # 5x3 -> 3x3 -> 1x3
    RPE = "rpe"                         # hit target RPE
    AUTOREGULATED = "autoregulated"     # readiness-driven


@dataclass(frozen=True)
class ProgressionResult:
    next_weight_kg: float
    next_reps: int | str
    next_sets: int
    note: str


def progression_step(
    *,
    scheme: ProgressionScheme,
    current_weight_kg: float,
    current_reps: int,
    current_reps_target_top: int,
    current_sets: int,
    missed_sessions: int = 0,
    increment_kg: float = 2.5,
) -> ProgressionResult:
    """Compute next-session target per the scheme.

    DOUBLE:
      - if reps at top of range AND all sets done → +weight, drop reps to bottom
      - else → +1 rep
      - if 2 sessions missed in a row → reset to 90% of last working weight
    LINEAR:
      - +increment_kg (or -1 set if missed)
    WAVE:
      - cycle through (5, 3, 1) reps
    RPE:
      - caller passes back the RPE; we just bump weight
    AUTOREGULATED:
      - no fixed progression; brain decides
    """
    if missed_sessions >= 2:
        reset = round(current_weight_kg * 0.9, 2)
        return ProgressionResult(
            next_weight_kg=reset,
            next_reps=current_reps,
            next_sets=current_sets,
            note=f"2+ missed — reset to 90% of last working weight ({reset}kg)",
        )

    if scheme == ProgressionScheme.DOUBLE:
        if current_reps >= current_reps_target_top:
            new_weight = round(current_weight_kg + increment_kg, 2)
            return ProgressionResult(
                next_weight_kg=new_weight,
                next_reps=current_reps_target_top - 2,  # drop to bottom
                next_sets=current_sets,
                note=f"Hit top of range — weight up to {new_weight}kg",
            )
        return ProgressionResult(
            next_weight_kg=current_weight_kg,
            next_reps=current_reps + 1,
            next_sets=current_sets,
            note="Add a rep",
        )

    if scheme == ProgressionScheme.LINEAR:
        new_weight = round(current_weight_kg + increment_kg, 2)
        return ProgressionResult(
            next_weight_kg=new_weight,
            next_reps=current_reps,
            next_sets=current_sets,
            note=f"Linear +{increment_kg}kg → {new_weight}kg",
        )

    if scheme == ProgressionScheme.WAVE:
        cycle = [5, 3, 1]
        idx = cycle.index(current_reps) if current_reps in cycle else -1
        next_reps = cycle[(idx + 1) % len(cycle)] if idx >= 0 else cycle[0]
        return ProgressionResult(
            next_weight_kg=current_weight_kg,
            next_reps=next_reps,
            next_sets=current_sets,
            note=f"Wave: {current_reps}→{next_reps}",
        )

    if scheme == ProgressionScheme.RPE:
        return ProgressionResult(
            next_weight_kg=round(current_weight_kg + increment_kg, 2),
            next_reps=current_reps,
            next_sets=current_sets,
            note=f"RPE hit target — bump +{increment_kg}kg next session",
        )

    if scheme == ProgressionScheme.AUTOREGULATED:
        return ProgressionResult(
            next_weight_kg=current_weight_kg,
            next_reps=current_reps,
            next_sets=current_sets,
            note="Autoregulated — coach decides based on readiness",
        )

    raise ValueError(f"Unknown scheme: {scheme}")


# ---- Periodization (block selection) --------------------------------------

class PeriodizationBlock(str, Enum):
    ACCUMULATION = "accumulation"
    INTENSIFICATION = "intensification"
    REALIZATION = "realization"
    DELOAD = "deload"


_BLOCK_VOLUME = {
    PeriodizationBlock.ACCUMULATION: ("high", "moderate", 6, 8),
    PeriodizationBlock.INTENSIFICATION: ("moderate", "high", 8, 9),
    PeriodizationBlock.REALIZATION: ("low", "peak", 9, 10),
    PeriodizationBlock.DELOAD: ("half", "low", 5, 6),
}


def block_for_week(week: int, total_weeks: int, *, deload_week: int | None = None) -> PeriodizationBlock:
    """Pick the mesocycle block for a given week number (1-indexed)."""
    if deload_week is None:
        deload_week = weeks_default_deload(total_weeks)
    if week == deload_week or week == total_weeks:
        return PeriodizationBlock.DELOAD
    # Rough split: first 50% accumulation, next 35% intensification, last 15% realization
    pct = (week - 1) / max(total_weeks - 1, 1)
    if pct < 0.5:
        return PeriodizationBlock.ACCUMULATION
    if pct < 0.85:
        return PeriodizationBlock.INTENSIFICATION
    return PeriodizationBlock.REALIZATION


def block_params(block: PeriodizationBlock) -> dict:
    volume, intensity, rpe_low, rpe_high = _BLOCK_VOLUME[block]
    return {
        "volume": volume,
        "intensity": intensity,
        "rpe_low": rpe_low,
        "rpe_high": rpe_high,
        "name": block.value,
    }


# ---- Auto-regulation (the day-of decision) --------------------------------

class WorkoutDecision(str, Enum):
    GREEN = "GREEN"        # full program + optional finisher
    YELLOW = "YELLOW"      # same program, -1 set per exercise, RPE cap 7
    RED = "RED"            # active recovery only
    DELOAD = "DELOAD"      # forced deload week
    SKIP = "SKIP"          # complete rest


def decision_for_readiness(
    *,
    readiness: float,
    subjective_energy: int,    # 1-5
    soreness: int = 3,          # 1-5, default moderate
    acute_chronic_ratio: float = 1.0,
    forced_deload: bool = False,
) -> WorkoutDecision:
    """The day-of decision rule. Encoded as code, never left to the brain."""
    if forced_deload or acute_chronic_ratio > 1.5:
        return WorkoutDecision.DELOAD
    if readiness < 50 or subjective_energy <= 2:
        return WorkoutDecision.RED
    if 50 <= readiness < 75 or subjective_energy == 3 or soreness >= 4:
        return WorkoutDecision.YELLOW
    return WorkoutDecision.GREEN


def auto_regulate(
    *,
    program_day: ProgramDay,
    decision: WorkoutDecision,
) -> list[dict]:
    """Apply the decision to today's session. Returns modified exercise list."""
    if decision == WorkoutDecision.GREEN:
        return program_day.exercises
    if decision == WorkoutDecision.YELLOW:
        return [
            {**ex, "sets": max(2, ex.get("sets", 3) - 1), "intensity": "RPE 7 cap"}
            for ex in program_day.exercises
        ]
    if decision == WorkoutDecision.RED:
        # Active recovery: just mobility, very light cardio
        return [
            {"id": "mobility_flow", "sets": 1, "reps": "10 min", "intensity": "easy", "rest_s": 0},
            {"id": "walk_zone2", "sets": 1, "reps": "20 min", "intensity": "Zone 2", "rest_s": 0},
        ]
    if decision == WorkoutDecision.DELOAD:
        return [
            {**ex, "sets": max(2, ex.get("sets", 3) // 2), "intensity": "RPE 5-6"}
            for ex in program_day.exercises
        ]
    if decision == WorkoutDecision.SKIP:
        return []
    raise ValueError(f"Unknown decision: {decision}")


# ---- PR detection ---------------------------------------------------------

@dataclass(frozen=True)
class SetLog:
    exercise_id: str
    weight_kg: float
    reps: int
    rpe: float | None = None


@dataclass(frozen=True)
class PRDetection:
    is_pr: bool
    pr_type: Literal["1rm", "rep_pr", "volume_pr", "e1rm"] | None
    previous: float | None
    current: float


def detect_pr(
    *,
    new_set: SetLog,
    history: list[SetLog],   # all prior sets for the same exercise
) -> PRDetection:
    """Detect any kind of PR for the given set vs history.

    - 1RM PR: best estimated 1RM is higher than any prior
    - Rep PR: same weight, more reps than ever before
    - Volume PR: estimated total volume (sets × reps × weight) higher
    - e1RM PR: estimated 1RM at this rep count is higher
    """
    if not history:
        return PRDetection(is_pr=True, pr_type="1rm", previous=None, current=new_set.weight_kg)

    current_e1rm = best_1rm_estimate(new_set.weight_kg, new_set.reps)
    prior_e1rm = max(best_1rm_estimate(s.weight_kg, s.reps) for s in history)

    # 1RM PR check (exact 1 rep)
    one_rm_history = [s.weight_kg for s in history if s.reps == 1]
    if new_set.reps == 1 and (not one_rm_history or new_set.weight_kg > max(one_rm_history)):
        return PRDetection(True, "1rm", max(one_rm_history) if one_rm_history else None, new_set.weight_kg)

    # Rep PR — same weight, more reps
    same_weight_history = [s.reps for s in history if s.weight_kg == new_set.weight_kg]
    if same_weight_history and new_set.reps > max(same_weight_history):
        return PRDetection(True, "rep_pr", max(same_weight_history), new_set.reps)

    # e1RM PR
    if current_e1rm > prior_e1rm:
        return PRDetection(True, "e1rm", prior_e1rm, current_e1rm)

    return PRDetection(is_pr=False, pr_type=None, previous=prior_e1rm, current=current_e1rm)
