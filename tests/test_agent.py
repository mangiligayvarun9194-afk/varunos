"""Tests for the natural-language intent parser (varunos/core/agent.py)."""
from varunos.core.agent import (
    parse_intent, split_food_terms,
    LOG_WORKOUT, LOG_WEIGHT, LOG_MEAL, QUESTION,
)


class TestWeight:
    def test_i_weigh(self):
        i = parse_intent("I weigh 77 today")
        assert i.action == LOG_WEIGHT
        assert i.fields["weight_kg"] == 77

    def test_weight_kg(self):
        i = parse_intent("weight 78.5 kg")
        assert i.action == LOG_WEIGHT
        assert i.fields["weight_kg"] == 78.5

    def test_bodyweight(self):
        assert parse_intent("bodyweight 80").action == LOG_WEIGHT

    def test_pounds_converted(self):
        i = parse_intent("I weigh 170 lbs")
        assert i.action == LOG_WEIGHT
        assert 76 < i.fields["weight_kg"] < 78  # ~77.1 kg

    def test_insane_weight_rejected(self):
        # a rep count or typo shouldn't become a bodyweight entry
        assert parse_intent("I weigh 5").action != LOG_WEIGHT

    def test_bare_number_is_not_weight(self):
        assert parse_intent("77").action == QUESTION


class TestWorkout:
    def test_benched_for(self):
        i = parse_intent("I benched 100 for 5")
        assert i.action == LOG_WORKOUT
        assert i.fields["exercise"] == "bench_press"
        assert i.fields["weight_kg"] == 100
        assert i.fields["reps"] == 5

    def test_squat_x(self):
        i = parse_intent("squat 80kg x5")
        assert i.action == LOG_WORKOUT
        assert i.fields["exercise"] == "squat"
        assert i.fields["weight_kg"] == 80
        assert i.fields["reps"] == 5

    def test_deadlift_reps_word(self):
        i = parse_intent("deadlifted 140 kg 3 reps")
        assert i.action == LOG_WORKOUT
        assert i.fields["exercise"] == "deadlift"
        assert i.fields["reps"] == 3

    def test_two_word_lift(self):
        i = parse_intent("leg press 200 for 10")
        assert i.action == LOG_WORKOUT
        assert i.fields["exercise"] == "leg_press"

    def test_lift_without_numbers_is_question(self):
        # "how's my bench?" should ask the coach, not log a set
        assert parse_intent("how is my bench looking").action == QUESTION


class TestMeal:
    def test_had_foods(self):
        i = parse_intent("had 3 eggs and dal")
        assert i.action == LOG_MEAL
        assert "eggs" in i.fields["foods_text"]

    def test_ate_rotis(self):
        i = parse_intent("ate 2 rotis for lunch")
        assert i.action == LOG_MEAL
        assert "lunch" not in i.fields["foods_text"]  # context stripped
        assert "roti" in i.fields["foods_text"]

    def test_log_meal_prefix(self):
        assert parse_intent("log meal: paneer and rice").action == LOG_MEAL


class TestQuestion:
    def test_plain_question(self):
        i = parse_intent("what should I eat tonight?")
        assert i.action == QUESTION
        assert i.fields["text"] == "what should I eat tonight?"

    def test_empty(self):
        assert parse_intent("").action == QUESTION


class TestFoodTerms:
    def test_split_quantities(self):
        terms = split_food_terms("two rotis, 3 eggs and a bowl of dal")
        d = {t: q for q, t in terms}
        assert d.get("rotis") == 2
        assert d.get("eggs") == 3
        assert "dal" in d and d["dal"] == 1

    def test_filler_stripped(self):
        terms = split_food_terms("a glass of milk")
        assert terms == [(1.0, "milk")]

    def test_empty(self):
        assert split_food_terms("") == []
