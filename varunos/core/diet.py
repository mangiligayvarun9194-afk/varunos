"""
Diet core — TDEE, macro targets, food database, adaptive triggers.

The brain NEVER calculates calories. The brain NEVER invents macros.
All numbers come from this module. The food database is JSON, deterministic,
calibrated for Indian-context with US/EU fallbacks.
"""

from __future__ import annotations
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


FOODS_DIR = Path(__file__).parent.parent / "data" / "foods"
TEMPLATES_DIR = Path(__file__).parent.parent / "data" / "templates"


# ---- BMR + TDEE ------------------------------------------------------------

def bmr_mifflin(*, sex: Literal["M", "F"], weight_kg: float, height_cm: float, age: float) -> float:
    """Mifflin-St Jeor BMR. Most accurate for non-obese, non-athletes."""
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if sex == "M":
        return round(base + 5, 1)
    return round(base - 161, 1)


def tdee(*, bmr: float, activity: Literal["sedentary", "light", "moderate", "very_active", "athlete"]) -> float:
    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "very_active": 1.725,
        "athlete": 1.9,
    }
    return round(bmr * multipliers[activity], 1)


# ---- Goal kcal + macros ---------------------------------------------------

@dataclass(frozen=True)
class MacroTargets:
    kcal: int
    protein_g: int
    fat_g: int
    carbs_g: int
    p_per_kg: float
    f_per_kg: float
    c_per_kg: float


def goal_kcal(*, tdee_value: float, goal: Literal["cut", "recomp", "lean_bulk", "bulk"]) -> int:
    if goal == "cut":
        factor = 0.80
    elif goal == "recomp":
        factor = 0.95
    elif goal == "lean_bulk":
        factor = 1.10
    else:  # bulk
        factor = 1.20
    return round(tdee_value * factor)


def macros(
    *,
    kcal: int,
    weight_kg: float,
    goal: Literal["cut", "recomp", "lean_bulk", "bulk"],
    sex: Literal["M", "F"],
) -> MacroTargets:
    """g/kg targets: cut 2.2/0.8, recomp 2.0/0.9, bulk 1.8/1.0; carbs fill."""
    if goal == "cut":
        p_per_kg, f_per_kg = 2.2, 0.8
    elif goal == "recomp":
        p_per_kg, f_per_kg = 2.0, 0.9
    else:  # bulk / lean_bulk
        p_per_kg, f_per_kg = 1.8, 1.0

    protein_g = round(p_per_kg * weight_kg)
    fat_g = round(f_per_kg * weight_kg)
    protein_kcal = protein_g * 4
    fat_kcal = fat_g * 9
    carbs_kcal = max(0, kcal - protein_kcal - fat_kcal)
    carbs_g = round(carbs_kcal / 4)

    # Floor enforcement
    floor = 1500 if sex == "M" else 1200
    if kcal < floor:
        kcal = floor

    return MacroTargets(
        kcal=kcal,
        protein_g=protein_g,
        fat_g=fat_g,
        carbs_g=carbs_g,
        p_per_kg=p_per_kg,
        f_per_kg=f_per_kg,
        c_per_kg=round(carbs_g / weight_kg, 1),
    )


# ---- Food database lookup -------------------------------------------------

@dataclass(frozen=True)
class FoodItem:
    id: str
    name: str
    kcal: float
    p: float
    c: float
    f: float
    category: str
    tags: list[str] = field(default_factory=list)
    portion_g: float = 100.0
    portion_label: str = "100g"


def _load_food_db() -> dict[str, FoodItem]:
    db: dict[str, FoodItem] = {}
    for f in FOODS_DIR.glob("*.json"):
        with open(f) as fp:
            data = json.load(fp)
            for item in data.get("items", []):
                db[item["id"]] = FoodItem(
                    id=item["id"],
                    name=item["name"],
                    kcal=float(item["kcal"]),
                    p=float(item["p"]),
                    c=float(item["c"]),
                    f=float(item["f"]),
                    category=item.get("category", "misc"),
                    tags=item.get("tags", []),
                    portion_g=float(item.get("portion_g", 100)),
                    portion_label=item.get("portion_label", "100g"),
                )
    return db


_FOOD_DB: dict[str, FoodItem] | None = None


def food_db() -> dict[str, FoodItem]:
    global _FOOD_DB
    if _FOOD_DB is None:
        _FOOD_DB = _load_food_db()
    return _FOOD_DB


def food_macros(food_id: str, *, portions: float = 1.0) -> dict:
    """Look up macros for a food. `portions` is a multiplier of the standard portion."""
    item = food_db()[food_id]
    return {
        "name": item.name,
        "kcal": round(item.kcal * portions, 1),
        "p": round(item.p * portions, 1),
        "c": round(item.c * portions, 1),
        "f": round(item.f * portions, 1),
        "portion": item.portion_label,
    }


# ---- Daily totals ---------------------------------------------------------

@dataclass(frozen=True)
class DayTotals:
    kcal: float
    p: float
    c: float
    f: float
    n_items: int


def day_totals(meals: list[dict]) -> DayTotals:
    """`meals` is a list of food_macros() dicts."""
    k = sum(m["kcal"] for m in meals)
    p = sum(m["p"] for m in meals)
    c = sum(m["c"] for m in meals)
    f = sum(m["f"] for m in meals)
    return DayTotals(round(k, 1), round(p, 1), round(c, 1), round(f, 1), len(meals))


def adherence_pct(*, consumed: float, target: float) -> float:
    return round(min(consumed / target * 100 if target else 0, 100), 1)


# ---- Adaptive dieting -----------------------------------------------------

@dataclass(frozen=True)
class AdaptiveAdjustment:
    new_kcal: int
    delta_kcal: int
    reason: str
    action: Literal["hold", "add_carb", "add_general", "subtract", "subtract_general", "flag_floor"]


def adaptive_adjustment(
    *,
    target_kcal: int,
    actual_weight_change_4w_kg: float,
    target_weight_change_4w_kg: float,
    sex: Literal["M", "F"],
    strength_drop_pct: float = 0.0,
    sleep_drop_pts: float = 0.0,
    hunger_avg: float = 3.0,           # 1-5
    workouts_missed_last_2w: int = 0,
    adherence_pct_last_2w: float = 100.0,
) -> AdaptiveAdjustment:
    """Weekly recalibration. The brain narrates; the core decides.

    Decision matrix:
      |actual - target| < 10% of target        → hold
      losing too fast (>0.7% BW/wk)            → +100 kcal (carbs on training)
      losing too slow                           → -100 kcal OR +1 LISS
      gaining too fast                          → -150 kcal
      gaining too slow                          → +150 kcal
      strength drop > 5%                        → add carbs around training
      sleep drop                                → ease deficit
      hunger avg > 4                            → +100 kcal of veg/fiber
      adherence < 80% last 2w                   → simplify
      floor hit                                 → flag, do not reduce
    """
    floor = 1500 if sex == "M" else 1200
    new_kcal = target_kcal
    reason_parts = []

    diff = actual_weight_change_4w_kg - target_weight_change_4w_kg

    # Primary weight-trajectory rule
    if abs(diff) < 0.1 * abs(target_weight_change_4w_kg) if target_weight_change_4w_kg else True:
        action = "hold"
        reason_parts.append("on track")
    elif target_weight_change_4w_kg < 0:  # cutting
        if actual_weight_change_4w_kg < target_weight_change_4w_kg - 0.5:  # losing too fast
            if new_kcal + 100 >= floor:
                new_kcal += 100
                action = "add_carb"
                reason_parts.append("losing too fast — +100 kcal (carbs on training days)")
            else:
                action = "flag_floor"
                reason_parts.append("at floor; recommend diet break")
        else:  # losing too slow or stalled
            if new_kcal - 100 >= floor:
                new_kcal -= 100
                action = "subtract"
                reason_parts.append("losing too slow — -100 kcal")
            else:
                action = "flag_floor"
                reason_parts.append("at floor; add LISS session instead")
    else:  # bulking
        if actual_weight_change_4w_kg > target_weight_change_4w_kg + 0.3:
            new_kcal -= 150
            action = "subtract_general"
            reason_parts.append("gaining too fast — -150 kcal")
        else:
            new_kcal += 150
            action = "add_general"
            reason_parts.append("gaining too slow — +150 kcal")

    # Modifiers (don't double-count)
    if strength_drop_pct > 5 and action in ("subtract", "flag_floor"):
        new_kcal += 100
        reason_parts.append(f"strength dropped {strength_drop_pct:.1f}% — +100 kcal around training")
        action = "add_carb"

    if sleep_drop_pts > 10 and action in ("subtract", "subtract_general"):
        new_kcal += 200
        reason_parts.append("sleep dropped — easing deficit")
        action = "add_general"

    if hunger_avg > 4 and action in ("subtract", "subtract_general"):
        new_kcal += 100
        reason_parts.append("hunger high — +100 kcal of veg/fiber")
        action = "add_general"

    if workouts_missed_last_2w >= 3:
        new_kcal = round(target_kcal * 1.0)  # back to maintenance
        reason_parts.append("missed sessions — back to maintenance for 1 week")
        action = "add_general"

    if adherence_pct_last_2w < 80 and action != "hold":
        reason_parts.append("low adherence — simplify plan")
        # Keep kcal but flag for human review

    if new_kcal < floor:
        new_kcal = floor
        action = "flag_floor"

    return AdaptiveAdjustment(
        new_kcal=new_kcal,
        delta_kcal=new_kcal - target_kcal,
        reason="; ".join(reason_parts) if reason_parts else "on track",
        action=action,
    )


# ---- Goal ETA -------------------------------------------------------------

def goal_eta_days(
    *,
    current_kg: float,
    target_kg: float,
    weekly_rate_kg: float,
) -> int:
    """Days to reach goal weight at current weekly rate.

    `weekly_rate_kg` is the MAGNITUDE of weekly change (always positive).
    Returns 9999 if rate is zero. Otherwise computes |delta| / rate.
    """
    if weekly_rate_kg <= 0:
        return 9999
    delta = target_kg - current_kg
    if delta == 0:
        return 0
    weeks = abs(delta) / weekly_rate_kg
    return math.ceil(weeks * 7)


# ---- Grocery list ---------------------------------------------------------

def grocery_list_from_plan(plan_items: list[dict]) -> dict[str, float]:
    """Aggregate a list of {food_id, portions} into a grocery list.

    Returns {food_id: total_portions}, rounded up to whole units.
    """
    agg: dict[str, float] = {}
    for item in plan_items:
        agg[item["food_id"]] = agg.get(item["food_id"], 0) + item.get("portions", 1.0)
    return {k: math.ceil(v) for k, v in agg.items()}


# ---- Meal plan generation -------------------------------------------------

@dataclass(frozen=True)
class MealPlan:
    template_name: str
    days: list[list[dict]]    # each day is a list of {meal, items}
    weekly_grocery: dict[str, int]


def load_template(name: str) -> dict:
    path = TEMPLATES_DIR / f"{name}.json"
    with open(path) as f:
        return json.load(f)


def generate_meal_plan(
    template_name: str,
    n_days: int = 7,
) -> MealPlan:
    """Generate a meal plan from a template.

    The brain picks the template. This function is deterministic.
    """
    template = load_template(template_name)
    days = []
    grocery: dict[str, float] = {}
    for day_idx in range(n_days):
        day_meals = []
        for meal in template["meals"]:
            items = []
            for food_id in meal.get("items", []):
                items.append({"food_id": food_id, "portions": meal.get("portions", 1.0)})
                grocery[food_id] = grocery.get(food_id, 0) + meal.get("portions", 1.0)
            day_meals.append({"meal": meal["name"], "items": items})
        days.append(day_meals)
    weekly_grocery = {k: math.ceil(v) for k, v in grocery.items()}
    return MealPlan(template_name=template_name, days=days, weekly_grocery=weekly_grocery)
