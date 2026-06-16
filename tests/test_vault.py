"""Tests for the Health Vault markdown builder (varunos/core/vault.py)."""
from varunos.core.vault import build_vault


PROFILE = {"name": "Varun", "age": 30, "sex": "M", "height_cm": 178,
           "weight_kg": 77, "activity": "moderate", "goal": "recomp"}
SETS = [
    {"exercise_id": "bench_press", "weight_kg": 100, "reps": 5, "rpe": 8, "ts": "2026-06-12T10:00:00+00:00"},
    {"exercise_id": "bench_press", "weight_kg": 105, "reps": 3, "rpe": 9, "ts": "2026-06-13T10:00:00+00:00"},
    {"exercise_id": "squat", "weight_kg": 120, "reps": 5, "rpe": 8, "ts": "2026-06-13T10:10:00+00:00"},
]
MEALS = [
    {"food_id": "egg_whole_1pc", "portions": 3, "kcal": 234, "p_g": 18, "c_g": 0, "f_g": 18, "ts": "2026-06-13T08:00:00+00:00"},
    {"food_id": "dal_toor_1cup", "portions": 1, "kcal": 110, "p_g": 7, "c_g": 18, "f_g": 1, "ts": "2026-06-13T13:00:00+00:00"},
]


class TestVault:
    def test_core_files_present(self):
        f = build_vault(PROFILE, SETS, MEALS)
        assert "README.md" in f
        assert "profile.md" in f
        assert "days/2026-06-13.md" in f
        assert "days/2026-06-12.md" in f
        assert "exercises/bench_press.md" in f
        assert "exercises/squat.md" in f

    def test_pr_computed(self):
        f = build_vault(PROFILE, SETS, MEALS)
        bench = f["exercises/bench_press.md"]
        assert "best_kg: 105" in bench
        assert "Personal best:** 105 kg" in bench

    def test_wikilinks_wire_the_graph(self):
        f = build_vault(PROFILE, SETS, MEALS)
        day = f["days/2026-06-13.md"]
        assert "[[bench_press]]" in day and "[[squat]]" in day
        assert "[[2026-06-13]]" in f["exercises/bench_press.md"]  # exercise links back to day

    def test_day_has_training_and_nutrition(self):
        day = build_vault(PROFILE, SETS, MEALS)["days/2026-06-13.md"]
        assert "## Training" in day and "## Nutrition" in day
        assert "Day total:** 344 kcal" in day  # 234 + 110

    def test_profile_rendered(self):
        prof = build_vault(PROFILE, SETS, MEALS)["profile.md"]
        assert "# Varun" in prof and "77 kg" in prof

    def test_empty_history_safe(self):
        f = build_vault({}, [], [])
        assert "README.md" in f and "profile.md" in f
        assert "0** days logged" in f["README.md"]

    def test_numbers_clean(self):
        # 100.0 -> "100", 102.5 -> "102.5"
        f = build_vault(PROFILE, [{"exercise_id": "ohp", "weight_kg": 60.0, "reps": 8, "rpe": None,
                                   "ts": "2026-06-13T10:00:00+00:00"}], [])
        assert "60 kg" in f["exercises/ohp.md"]
        assert "60.0" not in f["exercises/ohp.md"]
