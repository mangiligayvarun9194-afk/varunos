"""The Awakening — derived five-act onboarding state (core/awakening.py)."""
from varunos.core import awakening as A


class TestBlankUser:
    def test_starts_at_the_foundation(self):
        st = A.awakening_state()
        assert st["next"] == "earth"
        assert not st["complete"]
        assert st["pct"] == 0.0
        assert [a["status"] for a in st["acts"]] == ["open"] * 5

    def test_acts_ascend_the_body(self):
        st = A.awakening_state()
        assert [a["element"] for a in st["acts"]] == ["earth", "water", "fire", "air", "space"]


class TestProgression:
    def test_each_record_advances_the_next_pointer(self):
        st = A.awakening_state(has_measurements=True)
        assert st["next"] == "water" and st["pct"] == 0.2
        st = A.awakening_state(has_measurements=True, checkins=1)
        assert st["next"] == "fire"
        st = A.awakening_state(has_measurements=True, checkins=1, meals=1)
        assert st["next"] == "air"

    def test_out_of_order_records_still_count(self):
        # derived-from-data design: a meal logged before measurements is not lost
        st = A.awakening_state(meals=3)
        assert st["acts"][2]["status"] == "done"
        assert st["next"] == "earth"

    def test_air_completes_by_skip_without_shame(self):
        st = A.awakening_state(has_measurements=True, checkins=1, meals=1,
                               air_skipped=True, vault_records=3)
        assert st["complete"]
        assert st["next"] is None

    def test_air_completes_by_coached_set(self):
        st = A.awakening_state(has_measurements=True, checkins=1, meals=1,
                               coached_sets=1, vault_records=3)
        assert st["complete"]


class TestTheSeal:
    def test_seal_waits_for_all_other_acts(self):
        st = A.awakening_state(has_measurements=True, checkins=1, meals=1,
                               vault_records=10)  # air unresolved
        assert st["acts"][4]["status"] == "open"
        assert st["next"] == "air"

    def test_seal_needs_the_vault_to_hold_something(self):
        st = A.awakening_state(has_measurements=True, checkins=1, meals=1,
                               air_skipped=True, vault_records=0)
        assert not st["complete"]
        assert st["next"] == "space"


class TestExistingUsers:
    def test_power_user_auto_completes_instantly(self):
        # a user with real history never sees onboarding — the data IS the progress
        st = A.awakening_state(has_measurements=True, checkins=40, meals=120,
                               coached_sets=12, vault_records=300)
        assert st["complete"] and st["pct"] == 1.0


class TestSpecs:
    def test_camera_act_is_marked_skippable(self):
        st = A.awakening_state()
        air = next(a for a in st["acts"] if a["element"] == "air")
        assert air.get("skippable") is True

    def test_every_act_has_a_gift_line(self):
        for a in A.ACTS:
            assert a["gift"]

    def test_act_lookup(self):
        assert A.act_for("fire")["word"] == "अग्नि"
        assert A.act_for("nope") is None
