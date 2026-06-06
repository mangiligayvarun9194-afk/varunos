"""Tests for the deterministic insight engine."""

from varunos.core.insights import (
    spearman, pearson, find_correlations, find_anomalies, build_insights,
    CorrelationSpec,
)


class TestStats:
    def test_perfect_positive(self):
        assert round(spearman([1, 2, 3, 4], [2, 4, 6, 8]), 2) == 1.0

    def test_perfect_negative(self):
        assert round(spearman([1, 2, 3, 4], [8, 6, 4, 2]), 2) == -1.0

    def test_too_few_points(self):
        assert spearman([1, 2], [2, 4]) is None

    def test_handles_ties(self):
        r = spearman([1, 1, 2, 3], [2, 2, 4, 6])
        assert r is not None and r > 0.8

    def test_flat_series_is_none(self):
        assert pearson([5, 5, 5], [1, 2, 3]) is None


class TestCorrelations:
    def _series(self, driver_key, outcome_key, lag, n=14):
        # Build a clean monotonic relationship
        days = []
        for i in range(n):
            days.append({"date": f"2026-05-{i+1:02d}", driver_key: i})
        for i in range(n):
            j = i - lag
            if 0 <= j < n:
                days[i][outcome_key] = j * 2  # outcome tracks driver from `lag` days ago
        return days

    def test_finds_same_day_link(self):
        daily = self._series("sleep_hours", "hrv", 0)
        out = find_correlations(daily, min_pairs=5)
        assert any(i.title == "More sleep lifts your HRV" for i in out)

    def test_finds_lagged_link(self):
        daily = self._series("late_meal", "hrv", 1)
        # positive late_meal→next-day hrv triggers the neg_title (unusual) branch text
        out = find_correlations(daily, min_pairs=5)
        assert any("Late dinners" in i.title for i in out)

    def test_ignores_insufficient_data(self):
        daily = [{"date": "2026-05-01", "sleep_hours": 7, "hrv": 50}]
        assert find_correlations(daily, min_pairs=7) == []


class TestAnomalies:
    def test_rising_rhr_warns(self):
        daily = [{"date": f"2026-05-{i+1:02d}", "rhr": 55} for i in range(5)]
        daily += [
            {"date": "2026-05-06", "rhr": 60},
            {"date": "2026-05-07", "rhr": 61},
            {"date": "2026-05-08", "rhr": 62},
        ]
        out = find_anomalies(daily)
        assert any("Resting heart rate" in i.title for i in out)

    def test_sleep_debt_warns(self):
        daily = [{"date": f"2026-05-{i+1:02d}", "sleep_hours": 5} for i in range(6)]
        out = find_anomalies(daily)
        assert any("Sleep debt" in i.title for i in out)

    def test_calm_data_no_anomaly(self):
        daily = [{"date": f"2026-05-{i+1:02d}", "rhr": 55, "hrv": 50, "sleep_hours": 8}
                 for i in range(10)]
        assert find_anomalies(daily) == []


class TestBuildInsights:
    def test_shape(self):
        daily = [{"date": f"2026-05-{i+1:02d}", "sleep_hours": i % 9, "hrv": (i % 9) * 5}
                 for i in range(14)]
        res = build_insights(daily)
        assert "correlations" in res and "anomalies" in res
        assert res["days_analyzed"] == 14
        assert res["enough_data"] is True
