"""Retention math — the investor chart must be exactly right."""
from varunos.core.retention import retention


def _r(rows, today="2026-07-17"):
    return retention(rows, today=today)


def test_empty():
    rep = _r([])
    assert rep["users"] == 0 and rep["dau"] == 0
    assert rep["d1"]["rate"] is None and rep["stickiness"] is None


def test_d1_classic_exact_day():
    rows = [
        ("a", "2026-07-01"), ("a", "2026-07-02"),   # a: retained D1
        ("b", "2026-07-01"),                          # b: churned D1
        ("c", "2026-07-01"), ("c", "2026-07-03"),   # c: skipped day 1 → NOT D1-retained
    ]
    rep = _r(rows)
    assert rep["d1"] == {"rate": 1 / 3, "retained": 1, "eligible": 3}


def test_young_cohorts_not_eligible():
    # signed up yesterday → eligible for D1, not for D7/D30
    rows = [("a", "2026-07-16"), ("a", "2026-07-17")]
    rep = _r(rows)
    assert rep["d1"]["rate"] == 1.0
    assert rep["d7"]["eligible"] == 0 and rep["d7"]["rate"] is None
    assert rep["d30"]["rate"] is None


def test_actives_and_stickiness():
    rows = [
        ("a", "2026-07-17"),                    # active today → DAU
        ("b", "2026-07-12"),                    # in last 7 → WAU
        ("c", "2026-06-20"),                    # in last 30 → MAU only
        ("d", "2026-05-01"),                    # long gone
    ]
    rep = _r(rows)
    assert rep["dau"] == 1 and rep["wau"] == 2 and rep["mau"] == 3
    assert abs(rep["stickiness"] - 1 / 3) < 1e-9


def test_week6_graveyard_survivor():
    rows = [("a", "2026-06-01"), ("a", "2026-07-10"),   # day 39 → week-6 survivor
            ("b", "2026-06-01"), ("b", "2026-06-20")]   # day 19 → not yet
    rep = _r(rows)
    assert rep["week6_users"] == 1


def test_weekly_cohorts_and_future_rows_ignored():
    rows = [
        ("a", "2026-07-06"), ("a", "2026-07-07"),      # Mon cohort 07-06, D1 yes
        ("b", "2026-07-08"),                            # same cohort week, D1 no
        ("z", "2026-08-01"),                            # future row → dropped entirely
    ]
    rep = _r(rows)
    assert rep["users"] == 2
    assert len(rep["cohorts"]) == 1
    wk = rep["cohorts"][0]
    assert wk["week"] == "2026-07-06" and wk["size"] == 2 and wk["d1"] == 0.5


def test_multiple_events_one_day_dedup():
    # rows may repeat (one per event) — a set per user must dedup them
    rows = [("a", "2026-07-01")] * 5 + [("a", "2026-07-02")] * 3
    rep = _r(rows)
    assert rep["users"] == 1 and rep["d1"]["rate"] == 1.0
