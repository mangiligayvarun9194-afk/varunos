"""
Tests for readiness, sleep, and wellness composite scores.

Verifies the math behind the score that drives auto-regulation decisions.
"""

import pytest
from varunos.core.readiness import (
    hrv_score, rhr_score, sleep_score_from_components,
    wellness_score, load_score, trend_score,
    readiness_score, decision_color,
)


class TestHRVScore:
    def test_baseline_is_50(self):
        assert hrv_score(hrv_today_ms=50, hrv_7d_baseline_ms=50) == 50.0

    def test_higher_hrv_higher_score(self):
        score = hrv_score(hrv_today_ms=60, hrv_7d_baseline_ms=50)  # +20%
        assert score > 70

    def test_lower_hrv_lower_score(self):
        score = hrv_score(hrv_today_ms=40, hrv_7d_baseline_ms=50)  # -20%
        assert score < 30

    def test_zero_baseline_returns_neutral(self):
        assert hrv_score(hrv_today_ms=50, hrv_7d_baseline_ms=0) == 50.0

    def test_extreme_high_clamped(self):
        # +200% should clamp to 100
        assert hrv_score(hrv_today_ms=150, hrv_7d_baseline_ms=50) == 100.0

    def test_extreme_low_clamped(self):
        # -200% should clamp to 0
        assert hrv_score(hrv_today_ms=-50, hrv_7d_baseline_ms=50) == 0.0


class TestRHRScore:
    def test_baseline_is_50(self):
        assert rhr_score(rhr_today_bpm=60, rhr_30d_baseline_bpm=60) == 50.0

    def test_lower_rhr_higher_score(self):
        score = rhr_score(rhr_today_bpm=55, rhr_30d_baseline_bpm=60)  # -5
        assert score == 75.0  # 50 - (-5)*5

    def test_higher_rhr_lower_score(self):
        score = rhr_score(rhr_today_bpm=70, rhr_30d_baseline_bpm=60)  # +10
        assert score == 0.0  # clamped


class TestSleepScore:
    def test_optimal_sleep(self):
        # 7.5h duration, 17.5% deep, 22.5% REM, 95% efficiency
        score = sleep_score_from_components(
            duration_min=450, deep_pct=17.5, rem_pct=22.5,
            efficiency_pct=95, continuity_min=3,
        )
        # Should be near 100
        assert score >= 90

    def test_short_sleep(self):
        # 4h duration
        score = sleep_score_from_components(
            duration_min=240, deep_pct=8, rem_pct=12,
            efficiency_pct=70, continuity_min=20,
        )
        assert score < 70

    def test_zero_duration(self):
        score = sleep_score_from_components(
            duration_min=0, deep_pct=0, rem_pct=0,
            efficiency_pct=0, continuity_min=0,
        )
        # 0 h, 0% everything → 0 or near
        assert score < 20

    def test_deterministic(self):
        args = dict(
            duration_min=420, deep_pct=18, rem_pct=22,
            efficiency_pct=88, continuity_min=5,
        )
        s1 = sleep_score_from_components(**args)
        s2 = sleep_score_from_components(**args)
        assert s1 == s2


class TestWellnessScore:
    def test_perfect_wellness(self):
        # Energy 5, soreness 1 (none), mood 5, stress 1 (none)
        score = wellness_score(
            energy_1to5=5, soreness_1to5=1, mood_1to5=5, stress_1to5=1,
        )
        assert score >= 90

    def test_terrible_wellness(self):
        # Energy 1, soreness 5, mood 1, stress 5
        score = wellness_score(
            energy_1to5=1, soreness_1to5=5, mood_1to5=1, stress_1to5=5,
        )
        assert score <= 10

    def test_neutral_wellness(self):
        # All 3s
        score = wellness_score(
            energy_1to5=3, soreness_1to5=3, mood_1to5=3, stress_1to5=3,
        )
        # 3*20 = 60; (3-1)*25 = 50 for soreness; (3-1)*25 = 50 stress → 100-50=50
        # Average: (60+60+50+50)/4 = 55
        assert 50 <= score <= 60


class TestLoadScore:
    def test_optimal_ratio(self):
        # ratio 1.0 = optimal but score peaks at 0.8
        score = load_score(acute_load=80, chronic_load=100)
        assert score >= 70

    def test_undertraining(self):
        score = load_score(acute_load=30, chronic_load=100)  # ratio 0.3
        assert score == 60.0

    def test_overreaching_force_deload(self):
        # ratio 1.6 → 0.0 (force deload)
        score = load_score(acute_load=160, chronic_load=100)
        assert score == 0.0

    def test_zero_chronic(self):
        score = load_score(acute_load=100, chronic_load=0)
        assert score == 50.0


class TestTrendScore:
    def test_rising_trend(self):
        # First half avg 50, last half avg 80 → diff = +30 → clamp to 100
        scores = [50, 50, 50, 50, 80, 80, 80]
        score = trend_score(readiness_last_7d=scores)
        # 50 + 30*2.5 = 125 → clamp to 100
        assert score == 100.0

    def test_falling_trend(self):
        scores = [80, 80, 80, 80, 50, 50, 50]
        score = trend_score(readiness_last_7d=scores)
        # 50 - 30*2.5 = -25 → clamp to 0
        assert score == 0.0

    def test_single_value_returns_neutral(self):
        assert trend_score(readiness_last_7d=[50.0]) == 50.0


class TestFullReadiness:
    def test_full_composite(self):
        # All good numbers
        result = readiness_score(
            hrv_today_ms=60, hrv_7d_baseline_ms=50,
            rhr_today_bpm=55, rhr_30d_baseline_bpm=60,
            sleep_components=dict(
                duration_min=450, deep_pct=17.5, rem_pct=22.5,
                efficiency_pct=95, continuity_min=3,
            ),
            energy_1to5=5, soreness_1to5=1, mood_1to5=5, stress_1to5=1,
            acute_load=80, chronic_load=100,
            readiness_last_7d=[75, 76, 78, 80, 82, 84, 85],
        )
        assert result.overall >= 75  # should be GREEN

    def test_poor_readiness(self):
        # All bad numbers
        result = readiness_score(
            hrv_today_ms=30, hrv_7d_baseline_ms=50,
            rhr_today_bpm=75, rhr_30d_baseline_bpm=60,
            sleep_components=dict(
                duration_min=300, deep_pct=8, rem_pct=10,
                efficiency_pct=70, continuity_min=30,
            ),
            energy_1to5=1, soreness_1to5=5, mood_1to5=1, stress_1to5=5,
            acute_load=160, chronic_load=100,
            readiness_last_7d=[60, 55, 50, 45, 40, 35, 30],
        )
        assert result.overall < 50  # should be RED

    def test_deterministic(self):
        args = dict(
            hrv_today_ms=50, hrv_7d_baseline_ms=50,
            rhr_today_bpm=60, rhr_30d_baseline_bpm=60,
            sleep_components=dict(
                duration_min=420, deep_pct=15, rem_pct=20,
                efficiency_pct=88, continuity_min=5,
            ),
            energy_1to5=3, soreness_1to5=3, mood_1to5=3, stress_1to5=3,
            acute_load=80, chronic_load=100,
        )
        r1 = readiness_score(**args)
        r2 = readiness_score(**args)
        assert r1.overall == r2.overall


class TestDecisionColor:
    def test_green(self):
        assert decision_color(75) == "GREEN"
        assert decision_color(100) == "GREEN"

    def test_yellow(self):
        assert decision_color(50) == "YELLOW"
        assert decision_color(74.9) == "YELLOW"

    def test_red(self):
        assert decision_color(49.9) == "RED"
        assert decision_color(0) == "RED"
