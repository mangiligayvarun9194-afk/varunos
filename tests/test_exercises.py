"""Tests for the strength-training exercise library (varunos/core/exercises.py)."""
from varunos.core.exercises import (
    EXERCISES, list_exercises, get_exercise, groups, search, _VALID_GROUPS,
)


class TestLibraryIntegrity:
    def test_has_a_real_library(self):
        assert len(EXERCISES) >= 20

    def test_every_exercise_is_well_formed(self):
        required = ["name", "group", "mechanic", "force", "equipment", "level",
                    "primary", "secondary", "rom", "execution", "cues", "mistakes", "tempo"]
        for eid, e in EXERCISES.items():
            for f in required:
                assert f in e, f"{eid} missing {f}"
            assert e["group"] in _VALID_GROUPS, f"{eid} bad group {e['group']}"
            assert e["mechanic"] in ("compound", "isolation")
            assert e["force"] in ("push", "pull", "hinge", "static")
            assert e["primary"], f"{eid} has no primary muscle"
            assert len(e["execution"]) >= 2, f"{eid} too few execution steps"
            assert len(e["cues"]) >= 2, f"{eid} too few cues"
            assert len(e["mistakes"]) >= 1, f"{eid} no common mistakes"

    def test_covers_all_major_groups(self):
        present = {e["group"] for e in EXERCISES.values()}
        for g in ("chest", "back", "shoulders", "arms", "legs", "core"):
            assert g in present, f"missing group {g}"

    def test_has_the_big_compounds(self):
        for key in ("barbell_back_squat", "barbell_deadlift", "barbell_bench_press",
                    "overhead_press", "barbell_row"):
            assert key in EXERCISES


class TestAccessors:
    def test_list_all(self):
        all_ex = list_exercises()
        assert len(all_ex) == len(EXERCISES)
        assert all("id" in x and "name" in x for x in all_ex)

    def test_list_by_group(self):
        legs = list_exercises("legs")
        assert legs and all(x["group"] == "legs" for x in legs)

    def test_get_detail(self):
        e = get_exercise("barbell_back_squat")
        assert e["id"] == "barbell_back_squat"
        assert "quadriceps" in e["primary"]
        assert any("parallel" in s.lower() for s in [e["rom"]])

    def test_get_missing(self):
        assert get_exercise("nope") is None

    def test_groups_order(self):
        gs = groups()
        assert gs[0] == "chest" and "legs" in gs

    def test_search(self):
        assert any(h["id"] == "barbell_bench_press" for h in search("bench"))
        assert any(h["group"] == "chest" for h in search("pec"))
        assert search("") == []
