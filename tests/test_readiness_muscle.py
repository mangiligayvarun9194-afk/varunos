"""Tests for the per-muscle readiness engine (pure heuristics over sets)."""

from datetime import datetime, timezone, timedelta

from varunos.core import readiness_muscle as rm


NOW = datetime(2026, 6, 27, 12, 0, tzinfo=timezone.utc)


def _set(ex, w, r, hours_ago):
    return {"exercise_id": ex, "weight_kg": w, "reps": r,
            "ts": (NOW - timedelta(hours=hours_ago)).isoformat()}


class TestReadiness:
    def test_untrained_group_is_fresh(self):
        m = rm.muscle_readiness([], now=NOW)
        assert m["legs"]["recovery"] == 100 and m["legs"]["status"] == "fresh"
        assert m["legs"]["last_trained"] is None

    def test_just_trained_is_fatigued(self):
        # heavy squat session 2h ago → legs not recovered
        m = rm.muscle_readiness([_set("barbell_back_squat", 100, 30, 2)], now=NOW)
        assert m["legs"]["status"] == "fatigued"
        assert m["legs"]["recovery"] < rm.MODERATE_AT

    def test_recovers_over_time(self):
        s = [_set("barbell_back_squat", 100, 20, 2)]
        recent = rm.muscle_readiness(s, now=NOW)["legs"]["recovery"]
        s2 = [_set("barbell_back_squat", 100, 20, 60)]   # ~2.5 days later
        later = rm.muscle_readiness(s2, now=NOW)["legs"]["recovery"]
        assert later > recent and later >= rm.FRESH_AT

    def test_heavier_session_recovers_slower(self):
        light = rm.muscle_readiness([_set("barbell_curl", 20, 8, 30)], now=NOW)["arms"]["recovery"]
        heavy = rm.muscle_readiness([_set("barbell_curl", 60, 40, 30)], now=NOW)["arms"]["recovery"]
        assert heavy < light

    def test_poor_global_recovery_slows_it(self):
        s = [_set("bench_press", 80, 10, 30)]
        good = rm.muscle_readiness(s, now=NOW, global_readiness=90)["chest"]["recovery"]
        poor = rm.muscle_readiness(s, now=NOW, global_readiness=20)["chest"]["recovery"]
        assert poor < good

    def test_all_groups_present(self):
        m = rm.muscle_readiness([], now=NOW)
        assert set(m) == set(rm.GROUPS)


class TestRecommend:
    def test_recommends_fresh_avoids_fatigued(self):
        sets = [
            _set("barbell_back_squat", 120, 20, 2),   # legs: just trained → avoid
            _set("barbell_bench_press", 80, 6, 80),    # chest: recovered → ready
        ]
        m = rm.muscle_readiness(sets, now=NOW)
        rec = rm.recommend(m)
        assert "legs" in rec["avoid"]                 # just trained → don't
        assert m["chest"]["recovery"] >= 70 and "chest" not in rec["avoid"]  # recovered → ready
        assert rec["train_today"]                       # something is recommended

    def test_undertrained_gets_priority(self):
        # two fresh groups; the under-trained one should rank first
        m = {g: {"recovery": 90, "status": "fresh", "last_trained": "2026-06-20", "hours_since": 100, "load_kg": 0} for g in rm.GROUPS}
        rec = rm.recommend(m, undertrained=["core"])
        assert rec["train_today"][0] == "core"

    def test_analyze_shape(self):
        sets = [_set("barbell_back_squat", 100, 20, 90)]
        r = rm.analyze(sets, now=NOW)
        assert "muscles" in r and "train_today" in r and "avoid" in r
        assert r["fresh_count"] >= 1
