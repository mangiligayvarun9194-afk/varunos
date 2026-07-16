"""Five Centres engine — the T4 spine metric (core/centres.py)."""
from datetime import datetime, timedelta, timezone

from varunos.core import centres as C

NOW = datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc)


def iso(hours_ago: float) -> str:
    return (NOW - timedelta(hours=hours_ago)).isoformat()


class TestEmptyUser:
    def test_blank_user_is_fully_dark(self):
        vec = C.centres(now=NOW)
        assert vec == {"space": 0.0, "air": 0.0, "fire": 0.0, "water": 0.0, "earth": 0.0}
        assert C.lit(vec) == []
        assert not C.activated(vec)


class TestActiveUser:
    def test_fully_active_user_lights_everything(self):
        vec = C.centres(
            now=NOW,
            vault_records=120, history_days=90,
            last_workout_ts=iso(4), workouts_7d=4,
            last_meal_ts=iso(2), meals_7d=14,
            last_checkin_ts=iso(3),
            has_measurements=True,
        )
        assert C.lit(vec) == ["space", "air", "fire", "water", "earth"]
        assert C.activated(vec)
        for v in vec.values():
            assert v > 0.9


class TestDecay:
    def test_water_fades_without_checkins(self):
        fresh = C.centres(now=NOW, last_checkin_ts=iso(1))["water"]
        stale = C.centres(now=NOW, last_checkin_ts=iso(96))["water"]
        assert fresh > 0.9
        assert stale < 0.2
        assert fresh > stale

    def test_air_halves_at_half_life(self):
        at_half = C.centres(now=NOW, last_workout_ts=iso(C.AIR_HALF_LIFE_H))["air"]
        # cadence term is 0 (workouts_7d=0), so air = 0.6 * 0.5
        assert abs(at_half - 0.3) < 0.01

    def test_space_does_not_decay(self):
        # memory is depth, not recency: same records = same score, any day
        a = C.centres(now=NOW, vault_records=30, history_days=20)["space"]
        b = C.centres(now=NOW + timedelta(days=30), vault_records=30, history_days=20)["space"]
        assert a == b > 0


class TestEarth:
    def test_measurements_alone_carry_half(self):
        vec = C.centres(now=NOW, has_measurements=True)
        assert abs(vec["earth"] - C.EARTH_MEASURE_WEIGHT) < 0.01

    def test_training_without_measurements_caps_below_lit(self):
        vec = C.centres(now=NOW, last_workout_ts=iso(1))
        assert vec["earth"] < C.LIT_AT  # the mirror needs measurements to fully wake


class TestRobustness:
    def test_bad_timestamps_score_zero_not_crash(self):
        vec = C.centres(now=NOW, last_workout_ts="not-a-date", last_meal_ts="",
                        last_checkin_ts=None)
        assert vec["air"] == 0.0 and vec["fire"] == 0.0 and vec["water"] == 0.0

    def test_naive_and_aware_timestamps_both_work(self):
        naive = (NOW - timedelta(hours=2)).replace(tzinfo=None).isoformat()
        aware = iso(2)
        a = C.centres(now=NOW, last_checkin_ts=naive)["water"]
        b = C.centres(now=NOW, last_checkin_ts=aware)["water"]
        assert abs(a - b) < 0.001

    def test_naive_now_is_treated_as_utc(self):
        vec = C.centres(now=NOW.replace(tzinfo=None), last_checkin_ts=iso(2))
        assert vec["water"] > 0.9

    def test_future_timestamps_clamp_to_now(self):
        vec = C.centres(now=NOW, last_checkin_ts=iso(-5))  # 5h in the future
        assert vec["water"] == 1.0

    def test_overshoot_aggregates_clamp(self):
        vec = C.centres(now=NOW, vault_records=10_000, history_days=10_000,
                        last_meal_ts=iso(0), meals_7d=999)
        assert vec["space"] == 1.0 and vec["fire"] == 1.0


class TestActivation:
    def test_four_lit_centres_activate(self):
        vec = C.centres(
            now=NOW,
            vault_records=120, history_days=90,          # space lit
            last_workout_ts=iso(4), workouts_7d=4,        # air lit (earth partial)
            last_meal_ts=iso(2), meals_7d=14,             # fire lit
            last_checkin_ts=iso(3),                       # water lit
            has_measurements=False,                       # earth NOT lit
        )
        assert len(C.lit(vec)) == 4
        assert C.activated(vec)
