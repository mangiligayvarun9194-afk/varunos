"""Tests for the momentum engine (PR/progress/streak/comeback/avatar)."""

from varunos.core.momentum import (
    avatar_level,
    avatar_stage,
    best_e1rm,
    build_events,
    consistency_4w,
    exercise_progress,
    is_comeback,
    pick_best_event,
    total_volume,
    weekly_streak,
)


def sets(*pairs):
    return [{"weight_kg": w, "reps": r} for w, r in pairs]


class TestProgress:
    def test_e1rm_and_volume(self):
        s = sets((100, 5), (110, 2))
        assert best_e1rm(s) > 110
        assert total_volume(s) == 100 * 5 + 110 * 2

    def test_stronger_this_week_fires(self):
        ev = exercise_progress("barbell_squat", sets((105, 5)), sets((100, 5)))
        assert ev is not None and ev.kind == "progress"
        assert "Barbell Squat" in ev.title

    def test_same_strength_silent(self):
        assert exercise_progress("bench", sets((100, 5)), sets((100, 5))) is None

    def test_volume_jump_fires_without_e1rm_gain(self):
        this = sets((80, 10), (80, 10), (80, 10), (80, 10))
        last = sets((80, 10), (80, 10))
        ev = exercise_progress("row", this, last)
        assert ev is not None and "volume" in ev.title

    def test_no_history_silent(self):
        assert exercise_progress("bench", sets((100, 5)), []) is None


class TestStreaks:
    def test_three_week_streak(self):
        dates = ["2026-05-25", "2026-06-01", "2026-06-08"]
        assert weekly_streak(dates, "2026-06-10") == 3

    def test_broken_streak(self):
        dates = ["2026-05-04", "2026-06-08"]  # month gap
        assert weekly_streak(dates, "2026-06-10") == 1

    def test_streak_survives_untrained_current_week(self):
        dates = ["2026-05-25", "2026-06-01"]  # nothing yet this week
        assert weekly_streak(dates, "2026-06-09") == 2

    def test_comeback_after_gap(self):
        assert is_comeback(["2026-05-20"], "2026-06-10") is True
        assert is_comeback(["2026-06-08"], "2026-06-10") is False
        assert is_comeback([], "2026-06-10") is False

    def test_consistency(self):
        # 12 sessions in 4 weeks at 3/week plan = 100%
        dates = [f"2026-05-{d:02d}" for d in range(16, 31, 4)] + \
                [f"2026-06-{d:02d}" for d in range(1, 11, 2)] + ["2026-06-10", "2026-06-09", "2026-06-07"]
        assert consistency_4w(dates, "2026-06-10", planned_per_week=3) >= 0.8


class TestAvatar:
    def test_level_bounds(self):
        assert avatar_level() == 13  # baseline: small volume-trend credit only
        hi = avatar_level(volume_trend_pct=10, streak_weeks=8, days_since_pr=0, consistency=1.0)
        assert hi == 100

    def test_pr_recency_decays(self):
        fresh = avatar_level(days_since_pr=0)
        stale = avatar_level(days_since_pr=30)
        assert fresh > stale

    def test_stages(self):
        assert avatar_stage(5)["stage"] == 1
        assert avatar_stage(50)["stage"] == 3
        assert avatar_stage(90)["stage"] == 5
        assert avatar_stage(90)["name"] == "peak"


class TestEventPicking:
    def test_pr_beats_everything(self):
        evs = build_events(
            pr_titles=["bench 105kg"],
            progress_events=[],
            session_dates=["2026-05-25", "2026-06-01", "2026-06-08"],
            today="2026-06-10",
        )
        best = pick_best_event(evs)
        assert best.kind == "pr" and "105kg" in best.title

    def test_streak_fires_when_quiet(self):
        evs = build_events(
            pr_titles=[], progress_events=[],
            session_dates=["2026-05-25", "2026-06-01", "2026-06-08"],
            today="2026-06-10",
        )
        best = pick_best_event(evs)
        assert best.kind == "streak" and "3-week" in best.title

    def test_no_events_no_message(self):
        assert pick_best_event([]) is None

    def test_comeback_detected(self):
        evs = build_events(
            pr_titles=[], progress_events=[],
            session_dates=["2026-05-01", "2026-06-10"],
            today="2026-06-10",
        )
        kinds = {e.kind for e in evs}
        assert "comeback" in kinds
