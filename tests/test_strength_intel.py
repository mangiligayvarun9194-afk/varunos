"""Tests for the Strength Intelligence core (pure analytics over sets)."""

from varunos.core import strength_intel as si


def _set(ex, w, r, ts):
    return {"exercise_id": ex, "weight_kg": w, "reps": r, "rpe": None, "ts": ts}


class TestTrends:
    def test_progressing_lift_detected(self):
        sets = [
            _set("barbell_back_squat", 100, 5, "2026-01-05T18:00:00"),
            _set("barbell_back_squat", 110, 5, "2026-02-05T18:00:00"),
            _set("barbell_back_squat", 120, 5, "2026-03-05T18:00:00"),
        ]
        e = si.per_exercise(sets)[0]
        assert e["metric"] == "e1rm"
        assert e["status"] == "progressing"
        assert e["pct"] > 0

    def test_stall_only_after_enough_time(self):
        # same weight across 6 weeks → stalled
        sets = [
            _set("barbell_bench_press", 80, 5, "2026-01-01T18:00:00"),
            _set("barbell_bench_press", 80, 5, "2026-02-01T18:00:00"),
            _set("barbell_bench_press", 80, 5, "2026-02-20T18:00:00"),
        ]
        e = si.per_exercise(sets)[0]
        assert e["status"] == "stalled"

    def test_two_close_sessions_do_not_falsely_stall(self):
        sets = [
            _set("barbell_bench_press", 80, 5, "2026-03-01T18:00:00"),
            _set("barbell_bench_press", 80, 5, "2026-03-03T18:00:00"),
        ]
        e = si.per_exercise(sets)[0]
        assert e["status"] == "holding"   # not enough time to call a stall

    def test_high_rep_machine_uses_volume_not_fake_1rm(self):
        # 40-rep calf raises → e1rm would be absurd; fall back to volume
        sets = [
            _set("calf_press", 100, 40, "2026-01-01T18:00:00"),
            _set("calf_press", 120, 40, "2026-02-01T18:00:00"),
        ]
        e = si.per_exercise(sets)[0]
        assert e["metric"] == "top_volume"
        assert e["status"] == "progressing"

    def test_declining_lift(self):
        sets = [
            _set("deadlift", 200, 3, "2026-01-01T18:00:00"),
            _set("deadlift", 170, 3, "2026-02-10T18:00:00"),
        ]
        e = si.per_exercise(sets)[0]
        assert e["status"] == "declining"


class TestMuscleBalance:
    def test_shares_and_neglected(self):
        sets = [
            _set("barbell_back_squat", 100, 5, "2026-01-01T18:00:00"),
            _set("leg_press", 200, 10, "2026-01-01T18:00:00"),
            _set("barbell_curl", 30, 10, "2026-01-02T18:00:00"),
        ]
        b = si.muscle_balance(sets)
        assert b["shares"]["legs"] > b["shares"]["arms"]   # legs trained far more
        # nothing logged for chest/back/shoulders/core → neglected
        assert "chest" in b["neglected"] and "core" in b["neglected"]

    def test_no_data_is_honest(self):
        b = si.muscle_balance([])
        assert b["undertrained"] == [] and all(v == 0 for v in b["shares"].values())


class TestAnalyze:
    def test_full_report_shape_and_highlights(self):
        sets = [
            _set("barbell_back_squat", 100, 5, "2026-01-05T18:00:00"),
            _set("barbell_back_squat", 120, 5, "2026-03-05T18:00:00"),  # progressing PR
            _set("barbell_bench_press", 80, 5, "2026-01-01T18:00:00"),
            _set("barbell_bench_press", 80, 5, "2026-02-20T18:00:00"),  # stalled
        ]
        r = si.analyze(sets)
        assert r["totals"]["exercises"] == 2
        assert any(e["exercise_id"] == "barbell_back_squat" for e in r["highlights"]["progressing"])
        assert any(e["exercise_id"] == "barbell_bench_press" for e in r["highlights"]["stalled"])
        assert r["highlights"]["prs"]   # squat is a fresh e1RM peak

    def test_name_resolver_used(self):
        sets = [_set("leg_press", 200, 10, "2026-01-01T18:00:00")]
        r = si.per_exercise(sets, name_of=lambda i: "Leg Press")
        assert r[0]["name"] == "Leg Press"
