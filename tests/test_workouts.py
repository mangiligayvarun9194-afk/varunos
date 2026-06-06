"""
Tests for the workout core.

Coverage:
  - 1RM estimation (Epley, Brzycki)
  - Program loading from JSON
  - Exercise substitution
  - Progression schemes (all 5)
  - Periodization block selection
  - Auto-regulation decision rule
  - PR detection (1RM, rep PR, e1RM PR)
"""

import pytest
from varunos.core.workouts import (
    epley_1rm, brzycki_1rm, best_1rm_estimate,
    load_program, load_exercise, substitute_exercise,
    progression_step, ProgressionScheme, ProgressionResult,
    block_for_week, block_params, PeriodizationBlock,
    decision_for_readiness, auto_regulate, WorkoutDecision,
    detect_pr, SetLog, PRDetection,
)


# ---- 1RM estimation -------------------------------------------------------

class TestOneRM:
    def test_epley_1rep_is_exact(self):
        assert epley_1rm(100, 1) == 100.0

    def test_epley_5_reps(self):
        # 100 * (1 + 5/30) = 100 * 1.1667 = 116.67
        assert epley_1rm(100, 5) == pytest.approx(116.67, 0.01)

    def test_epley_10_reps(self):
        # 100 * (1 + 10/30) = 133.33
        assert epley_1rm(100, 10) == pytest.approx(133.33, 0.01)

    def test_epley_zero_reps_raises(self):
        with pytest.raises(ValueError):
            epley_1rm(100, 0)

    def test_brzycki_5_reps(self):
        # 100 * 36 / 32 = 112.5
        assert brzycki_1rm(100, 5) == 112.5

    def test_brzycki_10_reps(self):
        # 100 * 36 / 27 = 133.33
        assert brzycki_1rm(100, 10) == pytest.approx(133.33, 0.01)

    def test_brzycki_too_high_raises(self):
        with pytest.raises(ValueError):
            brzycki_1rm(100, 50)

    def test_best_estimate_1rep(self):
        assert best_1rm_estimate(100, 1) == 100.0

    def test_best_estimate_5_reps_in_range(self):
        result = best_1rm_estimate(100, 5)
        assert 110 < result < 120

    def test_best_estimate_high_reps_uses_epley(self):
        # > 10 reps: epley only
        result = best_1rm_estimate(100, 15)
        expected = epley_1rm(100, 15)
        assert result == pytest.approx(expected, 0.01)


# ---- Program loading ------------------------------------------------------

class TestProgramLoading:
    def test_load_ppl_power(self):
        prog = load_program("ppl_power")
        assert prog.name == "PPL Power"
        assert prog.days_per_week == 6
        assert prog.weeks == 8
        assert prog.deload_week == 7
        assert len(prog.days) == 3
        assert prog.days[0].name == "Push"

    def test_load_upper_lower(self):
        prog = load_program("upper_lower_strength")
        assert prog.days_per_week == 4
        assert len(prog.days) == 4

    def test_load_531(self):
        prog = load_program("531_bbb")
        assert prog.progression_rule == "wave"

    def test_load_deload(self):
        prog = load_program("deload")
        assert prog.days_per_week == 3
        assert prog.weeks == 1

    def test_load_nonexistent_raises(self):
        with pytest.raises(FileNotFoundError):
            load_program("nonexistent_program")

    def test_program_substitutions_exist(self):
        prog = load_program("ppl_power")
        assert "bench_press" in prog.substitutions
        assert "squat" in prog.substitutions

    def test_exercise_loading(self):
        ex = load_exercise("squat")
        assert ex.name == "Back Squat"
        assert "quads" in ex.primary_muscles
        assert "barbell" in ex.equipment

    def test_exercise_substitution_equipment_aware(self):
        prog = load_program("ppl_power")
        # User has dumbbells + bench, no barbell
        sub = substitute_exercise(prog, "bench_press", ["dumbbell", "bench"])
        assert sub == "db_bench_press"

    def test_exercise_substitution_no_equipment(self):
        prog = load_program("ppl_power")
        sub = substitute_exercise(prog, "squat", [])
        # Falls back to first listed (front_squat requires barbell, so next)
        # The actual fallback picks the first candidate; we test the contract
        assert sub in prog.substitutions["squat"] or sub == "squat"


# ---- Progression schemes --------------------------------------------------

class TestProgression:
    def test_double_progression_at_top(self):
        result = progression_step(
            scheme=ProgressionScheme.DOUBLE,
            current_weight_kg=100.0,
            current_reps=8,
            current_reps_target_top=8,
            current_sets=3,
        )
        # Hit top → weight up, reps drop
        assert result.next_weight_kg == 102.5
        assert result.next_reps == 6  # top - 2

    def test_double_progression_below_top(self):
        result = progression_step(
            scheme=ProgressionScheme.DOUBLE,
            current_weight_kg=100.0,
            current_reps=6,
            current_reps_target_top=8,
            current_sets=3,
        )
        # Below top → +1 rep
        assert result.next_weight_kg == 100.0
        assert result.next_reps == 7

    def test_linear_progression(self):
        result = progression_step(
            scheme=ProgressionScheme.LINEAR,
            current_weight_kg=100.0,
            current_reps=5,
            current_reps_target_top=5,
            current_sets=3,
        )
        assert result.next_weight_kg == 102.5

    def test_wave_progression(self):
        r1 = progression_step(
            scheme=ProgressionScheme.WAVE,
            current_weight_kg=100.0,
            current_reps=5,
            current_reps_target_top=5,
            current_sets=3,
        )
        assert r1.next_reps == 3
        r2 = progression_step(
            scheme=ProgressionScheme.WAVE,
            current_weight_kg=100.0,
            current_reps=3,
            current_reps_target_top=5,
            current_sets=3,
        )
        assert r2.next_reps == 1
        r3 = progression_step(
            scheme=ProgressionScheme.WAVE,
            current_weight_kg=100.0,
            current_reps=1,
            current_reps_target_top=5,
            current_sets=3,
        )
        assert r3.next_reps == 5  # cycles

    def test_rpe_progression(self):
        result = progression_step(
            scheme=ProgressionScheme.RPE,
            current_weight_kg=100.0,
            current_reps=5,
            current_reps_target_top=5,
            current_sets=3,
        )
        assert result.next_weight_kg == 102.5

    def test_autoregulated_no_change(self):
        result = progression_step(
            scheme=ProgressionScheme.AUTOREGULATED,
            current_weight_kg=100.0,
            current_reps=5,
            current_reps_target_top=5,
            current_sets=3,
        )
        assert result.next_weight_kg == 100.0

    def test_missed_sessions_resets(self):
        result = progression_step(
            scheme=ProgressionScheme.DOUBLE,
            current_weight_kg=100.0,
            current_reps=8,
            current_reps_target_top=8,
            current_sets=3,
            missed_sessions=3,
        )
        assert result.next_weight_kg == pytest.approx(90.0, 0.01)


# ---- Periodization --------------------------------------------------------

class TestPeriodization:
    def test_deload_last_week(self):
        block = block_for_week(8, 8, deload_week=7)
        assert block == PeriodizationBlock.DELOAD

    def test_explicit_deload_week(self):
        block = block_for_week(7, 8, deload_week=7)
        assert block == PeriodizationBlock.DELOAD

    def test_accumulation_first_half(self):
        block = block_for_week(2, 8)
        assert block == PeriodizationBlock.ACCUMULATION

    def test_intensification_mid(self):
        block = block_for_week(5, 8)
        assert block in (PeriodizationBlock.INTENSIFICATION, PeriodizationBlock.REALIZATION)

    def test_realization_late(self):
        block = block_for_week(7, 8, deload_week=8)  # avoid the deload case
        # With deload at 8, week 7 is realization
        # (We test 7/8 = 0.875, > 0.85 = REALIZATION)
        assert block == PeriodizationBlock.REALIZATION

    def test_block_params_present(self):
        for block in PeriodizationBlock:
            params = block_params(block)
            assert "volume" in params
            assert "intensity" in params
            assert "rpe_low" in params


# ---- Auto-regulation ------------------------------------------------------

class TestAutoRegulation:
    def test_green_day(self):
        decision = decision_for_readiness(readiness=80, subjective_energy=4)
        assert decision == WorkoutDecision.GREEN

    def test_yellow_mid_readiness(self):
        decision = decision_for_readiness(readiness=60, subjective_energy=4)
        assert decision == WorkoutDecision.YELLOW

    def test_yellow_mid_energy(self):
        decision = decision_for_readiness(readiness=80, subjective_energy=3)
        assert decision == WorkoutDecision.YELLOW

    def test_red_low_readiness(self):
        decision = decision_for_readiness(readiness=40, subjective_energy=4)
        assert decision == WorkoutDecision.RED

    def test_red_low_energy(self):
        decision = decision_for_readiness(readiness=80, subjective_energy=2)
        assert decision == WorkoutDecision.RED

    def test_high_soreness_yellow(self):
        decision = decision_for_readiness(readiness=80, subjective_energy=5, soreness=4)
        assert decision == WorkoutDecision.YELLOW

    def test_acute_chronic_force_deload(self):
        decision = decision_for_readiness(
            readiness=85, subjective_energy=5, acute_chronic_ratio=1.6
        )
        assert decision == WorkoutDecision.DELOAD

    def test_forced_deload_flag(self):
        decision = decision_for_readiness(
            readiness=85, subjective_energy=5, forced_deload=True
        )
        assert decision == WorkoutDecision.DELOAD


class TestAutoRegulateSession:
    def test_green_returns_full_program(self):
        prog = load_program("ppl_power")
        day = prog.days[0]
        result = auto_regulate(program_day=day, decision=WorkoutDecision.GREEN)
        assert result == day.exercises  # unchanged

    def test_yellow_reduces_sets(self):
        prog = load_program("ppl_power")
        day = prog.days[0]
        original_sets = day.exercises[0].get("sets", 3)
        result = auto_regulate(program_day=day, decision=WorkoutDecision.YELLOW)
        assert result[0]["sets"] < original_sets

    def test_red_replaces_with_active_recovery(self):
        prog = load_program("ppl_power")
        day = prog.days[0]
        result = auto_regulate(program_day=day, decision=WorkoutDecision.RED)
        # Active recovery = light exercises
        assert all("RPE" not in ex.get("intensity", "") or "Zone 2" in ex.get("intensity", "") for ex in result)
        assert len(result) <= 2  # only mobility + Zone 2

    def test_deload_halves_sets(self):
        prog = load_program("ppl_power")
        day = prog.days[0]
        result = auto_regulate(program_day=day, decision=WorkoutDecision.DELOAD)
        for orig, mod in zip(day.exercises, result):
            assert mod["sets"] <= max(2, orig.get("sets", 3) // 2)


# ---- PR detection ---------------------------------------------------------

class TestPRDetection:
    def test_first_set_ever_is_pr(self):
        new_set = SetLog(exercise_id="squat", weight_kg=100, reps=5, rpe=7)
        pr = detect_pr(new_set=new_set, history=[])
        assert pr.is_pr is True
        assert pr.pr_type == "1rm"

    def test_repeat_set_not_pr(self):
        history = [SetLog(exercise_id="squat", weight_kg=100, reps=5, rpe=8)]
        new_set = SetLog(exercise_id="squat", weight_kg=100, reps=5, rpe=7)
        pr = detect_pr(new_set=new_set, history=history)
        assert pr.is_pr is False

    def test_1rm_pr_detected(self):
        history = [SetLog(exercise_id="squat", weight_kg=120, reps=1, rpe=9)]
        new_set = SetLog(exercise_id="squat", weight_kg=125, reps=1, rpe=9)
        pr = detect_pr(new_set=new_set, history=history)
        assert pr.is_pr is True
        assert pr.pr_type == "1rm"
        assert pr.previous == 120

    def test_rep_pr_same_weight_more_reps(self):
        history = [SetLog(exercise_id="bench", weight_kg=100, reps=5, rpe=8)]
        new_set = SetLog(exercise_id="bench", weight_kg=100, reps=6, rpe=9)
        pr = detect_pr(new_set=new_set, history=history)
        assert pr.is_pr is True
        assert pr.pr_type == "rep_pr"
        assert pr.previous == 5

    def test_e1rm_pr(self):
        history = [
            SetLog(exercise_id="squat", weight_kg=120, reps=5, rpe=8),
        ]
        # 130x3 should be a clear e1RM PR
        new_set = SetLog(exercise_id="squat", weight_kg=130, reps=3, rpe=8)
        pr = detect_pr(new_set=new_set, history=history)
        assert pr.is_pr is True
        assert pr.pr_type in ("e1rm", "rep_pr")
