"""Tests for forecast, context, and brain core modules."""

from varunos.core.forecast import forecast_readiness
from varunos.core.context import aqi_category, training_advice
from varunos.core.brain import build_brain_context, narrate_template


class TestForecast:
    def test_needs_min_history(self):
        assert forecast_readiness([70, 72]) is None

    def test_steady_trend(self):
        fc = forecast_readiness([75, 76, 74, 75, 76])
        assert fc is not None and 60 <= fc["projected"] <= 90
        assert fc["color"] in ("GREEN", "YELLOW", "RED")

    def test_sleep_debt_lowers_projection(self):
        rested = forecast_readiness([75, 75, 75], last_sleep_hours=8)
        tired = forecast_readiness([75, 75, 75], last_sleep_hours=4)
        assert tired["projected"] < rested["projected"]

    def test_training_costs_next_day(self):
        rest = forecast_readiness([70, 70, 70], trained_today=False)
        trained = forecast_readiness([70, 70, 70], trained_today=True)
        assert trained["projected"] < rest["projected"]


class TestContext:
    def test_aqi_bands(self):
        assert aqi_category(30)[0] == "Good"
        assert aqi_category(120)[1] == "orange"
        assert aqi_category(350)[0] == "Hazardous"

    def test_clean_air_is_good(self):
        a = training_advice(us_aqi=35, temp_c=22)
        assert a["severity"] == "good"

    def test_bad_air_says_indoors(self):
        a = training_advice(us_aqi=190, temp_c=25)
        assert a["severity"] == "avoid"
        assert any("indoor" in n.lower() for n in a["notes"])

    def test_extreme_heat_flagged(self):
        a = training_advice(us_aqi=40, temp_c=40)
        assert a["severity"] == "avoid"


class TestBrain:
    def test_context_excludes_raw_biomarkers(self):
        # Even if we (wrongly) pass raw-looking data, the gate only keeps tiers
        ctx = build_brain_context(
            readiness={"overall": 80, "color": "GREEN", "components": {"sleep": 85}},
            diet={"target_kcal": 2500, "protein_g": 160, "fat_g": 70, "carbs_g": 300},
        )
        flat = str(ctx)
        assert "GREEN" in flat and "2500" in flat
        # no bp/glucose keys ever present
        assert "sbp" not in flat and "glucose" not in flat and "mgdl" not in flat

    def test_template_briefing(self):
        ctx = build_brain_context(readiness={"overall": 82, "color": "GREEN",
                                             "components": {"sleep": 85, "wellness": 80}})
        ans = narrate_template("how am i today?", ctx)
        assert "GREEN" in ans

    def test_template_macros(self):
        ctx = build_brain_context(diet={"target_kcal": 2500, "protein_g": 160,
                                        "fat_g": 70, "carbs_g": 300}, consumed_kcal=800)
        ans = narrate_template("what are my macros", ctx)
        assert "2500" in ans
