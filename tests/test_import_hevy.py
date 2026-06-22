"""Tests for the Hevy workout-history importer (pure parser + DB persistence)."""

import pytest
from fastapi.testclient import TestClient

from varunos.core.import_hevy import parse_hevy_csv, map_exercise


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("VARUNOS_API_KEY", "test-secret-key-12345")
    monkeypatch.setenv("VARUNOS_USER_ID", "test-user")
    from varunos import db
    db.reset_for_tests(":memory:")
    from varunos.api.server import app
    with TestClient(app) as c:
        yield c


def _auth():
    return {"Authorization": "Bearer test-secret-key-12345"}

SAMPLE = (
    "title,start_time,end_time,exercise_title,superset_id,set_index,set_type,weight_kg,reps,rpe\n"
    'Legs,"29 May 2026, 18:48","29 May 2026, 19:07",Leg Extension (Machine),0.0,0,failure,80.0,37.0,10.0\n'
    'Legs,"29 May 2026, 18:48","29 May 2026, 19:07",Leg Press (Machine),0.0,0,failure,175.0,16.0,10.0\n'
    'Arms,"26 May 2026, 18:29","26 May 2026, 18:56",Bicep Curl (Barbell),,0,failure,30.0,14.0,10.0\n'
    'Arms,"26 May 2026, 18:29","26 May 2026, 18:56",Triceps Dip,0.0,0,failure,,5.0,10.0\n'  # blank weight
    'Bad,"not a date",,Squat (Barbell),,0,failure,100,5,8\n'                                  # unparseable → skipped
)


class TestParser:
    def test_groups_into_sessions_oldest_first(self):
        r = parse_hevy_csv(SAMPLE)
        s = r["sessions"]
        assert len(s) == 2
        assert s[0]["day_name"] == "Arms"      # 26 May before 29 May
        assert s[1]["day_name"] == "Legs"
        assert s[0]["ts"] < s[1]["ts"]

    def test_summary_counts_and_skips_bad_rows(self):
        r = parse_hevy_csv(SAMPLE)["summary"]
        assert r["sessions"] == 2
        assert r["sets"] == 4
        assert r["rows_skipped"] == 1          # the unparseable-date row

    def test_volume_and_rpe_and_duration(self):
        legs = parse_hevy_csv(SAMPLE)["sessions"][1]
        assert legs["total_volume_kg"] == 80.0 * 37 + 175.0 * 16
        assert legs["avg_rpe"] == 10.0
        assert legs["duration_min"] == 19      # 18:48 -> 19:07

    def test_blank_weight_becomes_zero(self):
        arms = parse_hevy_csv(SAMPLE)["sessions"][0]
        dip = [x for x in arms["sets"] if x["name"] == "Triceps Dip"][0]
        assert dip["weight_kg"] == 0.0 and dip["reps"] == 5

    def test_name_mapping_to_real_ids(self):
        assert map_exercise("Leg Press (Machine)") == "leg_press"
        assert map_exercise("Squat (Barbell)") == "barbell_back_squat"
        # unknown names slug rather than crash
        assert map_exercise("Some Weird Lift") == "some_weird_lift"

    def test_every_mapped_id_resolves_to_a_muscle_group(self):
        from varunos.core import exercises as ex
        r = parse_hevy_csv(SAMPLE)
        for ses in r["sessions"]:
            for st in ses["sets"]:
                e = ex.get_exercise(st["exercise_id"])
                assert e is not None, st["exercise_id"]
                assert e["group"] in ex.groups()


class TestImportPersistence:
    def test_import_is_idempotent(self, client):
        r1 = client.post("/v1/import/hevy", headers=_auth(), json={"csv": SAMPLE})
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1["imported"] == 2 and b1["skipped_existing"] == 0

        # re-import the same file → nothing new
        b2 = client.post("/v1/import/hevy", headers=_auth(), json={"csv": SAMPLE}).json()
        assert b2["imported"] == 0 and b2["skipped_existing"] == 2

    def test_imported_sets_carry_historical_dates(self, client):
        client.post("/v1/import/hevy", headers=_auth(), json={"csv": SAMPLE})
        workouts = client.get("/v1/logs/workouts", headers=_auth()).json()["workouts"]
        ts_list = [w["ts"] for w in workouts]
        # the real export dates (2026-05), not today's import date
        assert any(t.startswith("2026-05") for t in ts_list)
