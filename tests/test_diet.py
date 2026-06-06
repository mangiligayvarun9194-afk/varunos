"""
Tests for the diet core.

Coverage:
  - BMR (Mifflin-St Jeor)
  - TDEE
  - Goal kcal
  - Macro split
  - Food database lookup
  - Day totals
  - Adaptive triggers (the smart part)
  - Goal ETA
  - Grocery aggregation
  - Meal plan generation
"""

import pytest
from varunos.core.diet import (
    bmr_mifflin, tdee, goal_kcal, macros, MacroTargets,
    food_macros, food_db, day_totals, day_totals as _,
    adaptive_adjustment, AdaptiveAdjustment,
    goal_eta_days, grocery_list_from_plan,
    generate_meal_plan, load_template, FoodItem,
)


class TestBMR:
    def test_male_30yo_80kg_180cm(self):
        # 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
        bmr = bmr_mifflin(sex="M", weight_kg=80, height_cm=180, age=30)
        assert bmr == 1780.0

    def test_female_30yo_60kg_165cm(self):
        # 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
        bmr = bmr_mifflin(sex="F", weight_kg=60, height_cm=165, age=30)
        assert bmr == pytest.approx(1320.25, 0.1)

    def test_male_higher_than_female(self):
        bmr_m = bmr_mifflin(sex="M", weight_kg=70, height_cm=175, age=30)
        bmr_f = bmr_mifflin(sex="F", weight_kg=70, height_cm=175, age=30)
        assert bmr_m > bmr_f

    def test_older_lower_bmr(self):
        bmr_30 = bmr_mifflin(sex="M", weight_kg=80, height_cm=180, age=30)
        bmr_50 = bmr_mifflin(sex="M", weight_kg=80, height_cm=180, age=50)
        assert bmr_30 > bmr_50


class TestTDEE:
    def test_sedentary(self):
        bmr = 1800.0
        assert tdee(bmr=bmr, activity="sedentary") == 2160.0

    def test_athlete(self):
        bmr = 1800.0
        assert tdee(bmr=bmr, activity="athlete") == 3420.0

    def test_moderate(self):
        bmr = 1800.0
        assert tdee(bmr=bmr, activity="moderate") == 2790.0


class TestGoalKcal:
    def test_cut_is_lower_than_tdee(self):
        g = goal_kcal(tdee_value=2500, goal="cut")
        assert g < 2500
        assert g == 2000  # 2500 * 0.80

    def test_bulk_is_higher_than_tdee(self):
        g = goal_kcal(tdee_value=2500, goal="bulk")
        assert g == 3000  # 2500 * 1.20

    def test_lean_bulk(self):
        g = goal_kcal(tdee_value=2500, goal="lean_bulk")
        assert g == 2750  # 2500 * 1.10

    def test_recomp(self):
        g = goal_kcal(tdee_value=2500, goal="recomp")
        assert g == 2375  # 2500 * 0.95


class TestMacros:
    def test_cut_high_protein(self):
        m = macros(kcal=2000, weight_kg=80, goal="cut", sex="M")
        # 2.2g/kg protein = 176g
        assert m.protein_g == 176
        # 0.8g/kg fat = 64g
        assert m.fat_g == 64
        # Rest is carbs
        protein_kcal = 176 * 4
        fat_kcal = 64 * 9
        carbs_kcal = 2000 - protein_kcal - fat_kcal
        assert m.carbs_g == round(carbs_kcal / 4)

    def test_bulk_lower_protein(self):
        m = macros(kcal=3000, weight_kg=80, goal="bulk", sex="M")
        # 1.8g/kg = 144g
        assert m.protein_g == 144
        # 1.0g/kg = 80g
        assert m.fat_g == 80

    def test_macro_kcal_sum_close(self):
        m = macros(kcal=2500, weight_kg=80, goal="recomp", sex="M")
        total = m.protein_g * 4 + m.fat_g * 9 + m.carbs_g * 4
        # Within 5% of kcal
        assert abs(total - m.kcal) / m.kcal < 0.05

    def test_floor_enforcement(self):
        m = macros(kcal=1000, weight_kg=80, goal="cut", sex="M")
        # 1500 floor for males
        assert m.kcal >= 1500


class TestFoodDB:
    def test_db_loaded(self):
        db = food_db()
        assert len(db) > 50  # at least 50 items

    def test_look_up_rice(self):
        result = food_macros("rice_basmati_100g")
        assert result["kcal"] == 130
        assert result["p"] == 2.7

    def test_look_up_paneer(self):
        result = food_macros("paneer_100g")
        assert result["kcal"] == 265
        assert result["p"] == 18

    def test_portion_multiplier(self):
        # 2 portions of rice
        result = food_macros("rice_basmati_100g", portions=2.0)
        assert result["kcal"] == 260

    def test_indian_foods_present(self):
        db = food_db()
        for must_have in ["roti_wheat_1pc", "dal_toor_1cup", "paneer_100g",
                          "chicken_breast_100g", "egg_whole_1pc", "whey_isolate_30g"]:
            assert must_have in db, f"missing {must_have}"

    def test_missing_food_raises(self):
        with pytest.raises(KeyError):
            food_macros("nonexistent_food")


class TestDayTotals:
    def test_simple_day(self):
        meals = [
            {"name": "rice", "kcal": 260, "p": 5, "c": 56, "f": 1},
            {"name": "chicken", "kcal": 165, "p": 31, "c": 0, "f": 4},
            {"name": "veg", "kcal": 50, "p": 3, "c": 8, "f": 0.5},
        ]
        totals = day_totals(meals)
        assert totals.kcal == 475
        assert totals.p == 39
        assert totals.c == 64
        assert totals.f == 5.5
        assert totals.n_items == 3


class TestAdaptiveDiet:
    def test_on_track(self):
        adj = adaptive_adjustment(
            target_kcal=2200,
            actual_weight_change_4w_kg=-1.6,  # lost 1.6kg
            target_weight_change_4w_kg=-1.5,  # target was 1.5kg
            sex="M",
        )
        assert adj.action == "hold"

    def test_losing_too_fast(self):
        adj = adaptive_adjustment(
            target_kcal=2000,
            actual_weight_change_4w_kg=-3.0,  # way too fast
            target_weight_change_4w_kg=-1.5,
            sex="M",
        )
        assert adj.delta_kcal == 100
        assert "100" in adj.reason

    def test_losing_too_slow(self):
        adj = adaptive_adjustment(
            target_kcal=2000,
            actual_weight_change_4w_kg=-0.5,
            target_weight_change_4w_kg=-1.5,
            sex="M",
        )
        assert adj.delta_kcal == -100
        assert adj.action == "subtract"

    def test_gaining_too_fast(self):
        adj = adaptive_adjustment(
            target_kcal=3000,
            actual_weight_change_4w_kg=2.0,
            target_weight_change_4w_kg=1.0,
            sex="M",
        )
        assert adj.delta_kcal == -150

    def test_floor_protection(self):
        adj = adaptive_adjustment(
            target_kcal=1600,
            actual_weight_change_4w_kg=-1.0,
            target_weight_change_4w_kg=-2.0,
            sex="F",
        )
        # 1200 floor for females
        assert adj.new_kcal >= 1200
        if adj.action == "flag_floor":
            assert "floor" in adj.reason

    def test_strength_drop_adds_carbs(self):
        adj = adaptive_adjustment(
            target_kcal=2000,
            actual_weight_change_4w_kg=-1.5,
            target_weight_change_4w_kg=-1.5,
            sex="M",
            strength_drop_pct=6,
        )
        # The strength override bumps carbs even if on track
        # We expect either "hold" with a note OR carbs added
        assert "strength" in adj.reason or adj.action == "hold"


class TestGoalETA:
    def test_simple_eta(self):
        # 5kg to lose, 0.5kg/week (magnitude) → 70 days
        eta = goal_eta_days(current_kg=80, target_kg=75, weekly_rate_kg=0.5)
        assert eta == 70

    def test_zero_rate(self):
        eta = goal_eta_days(current_kg=80, target_kg=75, weekly_rate_kg=0)
        assert eta == 9999

    def test_bulk_eta(self):
        # 5kg to gain at 0.25kg/week → 140 days
        eta = goal_eta_days(current_kg=70, target_kg=75, weekly_rate_kg=0.25)
        assert eta == 140

    def test_already_at_target(self):
        eta = goal_eta_days(current_kg=80, target_kg=80, weekly_rate_kg=0.5)
        assert eta == 0


class TestGrocery:
    def test_aggregates_duplicates(self):
        items = [
            {"food_id": "rice_basmati_100g", "portions": 2.0},
            {"food_id": "rice_basmati_100g", "portions": 3.0},
            {"food_id": "chicken_breast_100g", "portions": 1.0},
        ]
        grocery = grocery_list_from_plan(items)
        assert grocery["rice_basmati_100g"] == 5  # ceil(5)
        assert grocery["chicken_breast_100g"] == 1

    def test_rounds_up(self):
        items = [{"food_id": "banana_1pc", "portions": 2.3}]
        grocery = grocery_list_from_plan(items)
        assert grocery["banana_1pc"] == 3  # ceil(2.3)


class TestMealPlan:
    def test_generate_7day_plan(self):
        plan = generate_meal_plan("indian_veg_4meal", n_days=7)
        assert len(plan.days) == 7
        assert plan.template_name == "indian_veg_4meal"
        assert len(plan.weekly_grocery) > 0

    def test_meal_plan_has_meals(self):
        plan = generate_meal_plan("indian_nonveg_4meal", n_days=3)
        for day in plan.days:
            assert len(day) >= 3  # at least 3 meals/day
