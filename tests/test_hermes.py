"""Tests for the Hermes companion core (varunos/core/hermes.py).

Pure, deterministic: the coach's growth math and briefing composition. No I/O,
no LLM. Mirrors the philosophy of the avatar (Twin) growth tests.
"""
from varunos.core.hermes import (
    hermes_level, hermes_stage, hermes_skills, compose_briefing,
    briefing_text, part_of_day,
)


class TestHermesLevel:
    def test_brand_new_is_zero(self):
        assert hermes_level() == 0

    def test_grows_with_everything(self):
        low = hermes_level(days_known=2, interactions=3, memories=1, briefings_seen=1)
        high = hermes_level(days_known=60, interactions=150, memories=25, briefings_seen=70)
        assert 0 < low < high <= 100

    def test_capped_at_100(self):
        assert hermes_level(days_known=999, interactions=999, memories=999,
                            briefings_seen=999) == 100

    def test_memories_move_the_needle(self):
        without = hermes_level(days_known=10, interactions=10)
        with_mem = hermes_level(days_known=10, interactions=10, memories=15)
        assert with_mem > without

    def test_monotonic_in_interactions(self):
        a = hermes_level(interactions=10)
        b = hermes_level(interactions=40)
        assert b >= a


class TestHermesStage:
    def test_zero_is_newcomer(self):
        s = hermes_stage(0)
        assert s["name"] == "newcomer" and s["stage"] == 1 and s["next_at"] == 20

    def test_top_is_inner_circle(self):
        s = hermes_stage(95)
        assert s["name"] == "inner" and s["stage"] == 5 and s["next_at"] is None

    def test_boundaries(self):
        assert hermes_stage(20)["name"] == "acquainted"
        assert hermes_stage(44)["name"] == "acquainted"
        assert hermes_stage(45)["name"] == "attuned"

    def test_stage_carries_level(self):
        assert hermes_stage(63)["level"] == 63


class TestHermesSkills:
    def test_newcomer_has_only_base_skills(self):
        sk = {s["id"]: s["unlocked"] for s in hermes_skills(0)}
        assert sk["briefings"] is True and sk["logging"] is True
        assert sk["patterns"] is False and sk["foresight"] is False

    def test_skills_unlock_with_level(self):
        sk = {s["id"]: s["unlocked"] for s in hermes_skills(75)}
        assert sk["patterns"] and sk["nudges"] and sk["memory_recall"] and sk["deload"]
        assert sk["foresight"] is False  # needs 90

    def test_max_level_unlocks_all(self):
        assert all(s["unlocked"] for s in hermes_skills(100))


class TestCompose:
    def test_morning_green(self):
        b = compose_briefing(part_of_day="morning", name="Varun",
                             readiness={"overall": 82, "color": "GREEN"})
        assert b["greeting"] == "Good morning, Varun"
        assert "82" in b["headline"] and "GREEN" in b["headline"]
        assert "PR" in b["focus"]
        assert b["reflection_prompt"] is None

    def test_red_day_says_recover(self):
        b = compose_briefing(readiness={"overall": 35, "color": "RED"})
        assert "light" in b["focus"].lower() or "recovery" in b["focus"].lower()

    def test_evening_has_reflection(self):
        b = compose_briefing(part_of_day="evening",
                             readiness={"overall": 60, "color": "YELLOW"})
        assert b["reflection_prompt"] is not None
        assert "tomorrow" in b["reflection_prompt"].lower()

    def test_no_readiness_is_safe(self):
        b = compose_briefing()
        assert b["headline"]  # never crashes, gives a sane prompt
        assert "sync" in b["focus"].lower() or "check-in" in b["focus"].lower()

    def test_goal_memory_surfaces_when_attuned(self):
        mems = [{"kind": "goal", "text": "hit a 140kg deadlift"}]
        attuned = compose_briefing(readiness={"overall": 70, "color": "GREEN"},
                                   memories=mems, level=50)
        newcomer = compose_briefing(readiness={"overall": 70, "color": "GREEN"},
                                    memories=mems, level=5)
        assert attuned["nudge"] and "140kg deadlift" in attuned["nudge"]
        # a brand-new Hermes doesn't yet reference your goals
        assert newcomer["nudge"] is None or "140kg deadlift" not in (newcomer["nudge"] or "")

    def test_streak_nudge_without_goal(self):
        b = compose_briefing(readiness={"overall": 70, "color": "GREEN"},
                             streak_weeks=4, level=5)
        assert b["nudge"] and "4-week streak" in b["nudge"]

    def test_briefing_text_is_one_paragraph(self):
        b = compose_briefing(part_of_day="morning", name="V",
                             readiness={"overall": 80, "color": "GREEN"},
                             plan={"day_name": "Push", "decision": "GREEN"})
        txt = briefing_text(b)
        assert txt.startswith("Good morning, V.")
        assert "Push" in txt
        assert "\n" not in txt


class TestPartOfDay:
    def test_buckets(self):
        assert part_of_day(7) == "morning"
        assert part_of_day(14) == "midday"
        assert part_of_day(21) == "evening"
        assert part_of_day(2) == "evening"
