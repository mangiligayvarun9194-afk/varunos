"""
Tests for the True-Size Twin measurements core (varunos/core/twinbody.py)
and its API endpoints (/v1/twin/measurements).

The core is pure and deterministic — validation ranges, the shared morph
vector (3-decimal contract with the frontend), neutral defaults, and clamps.
The API tests verify persistence, the 422 error contract, history, and the
non-negotiable per-user isolation.
"""

import pytest
from fastapi.testclient import TestClient

from varunos.core.twinbody import validate_measurements, derive_morphs


# The shared test vector — the cross-team contract for the morph math.
SHARED_VECTOR = {
    "height_cm": 175.0, "weight_kg": 70.0, "chest_cm": 100.0, "waist_cm": 80.0,
    "hip_cm": 95.0, "shoulder_cm": 45.0, "inseam_cm": 79.0, "sleeve_cm": 58.0,
}
SHARED_MORPHS_3DP = {
    "chest": 1.039, "waist": 0.971, "hips": 1.024, "shoulders": 0.993,
    "arms": 1.004, "legs": 1.003, "height": 1.0,
}

ALL_CHANNELS = {"chest", "waist", "hips", "shoulders", "arms", "legs", "height"}


# ---- Validation -------------------------------------------------------------

class TestValidate:
    def test_empty_is_valid(self):
        assert validate_measurements({}) == {}

    def test_shared_vector_is_valid(self):
        assert validate_measurements(SHARED_VECTOR) == {}

    def test_bounds_are_inclusive(self):
        mins = {"height_cm": 120, "weight_kg": 30, "chest_cm": 60, "waist_cm": 50,
                "hip_cm": 60, "shoulder_cm": 30, "inseam_cm": 50, "sleeve_cm": 40,
                "neck_cm": 25}
        maxs = {"height_cm": 230, "weight_kg": 250, "chest_cm": 170, "waist_cm": 160,
                "hip_cm": 170, "shoulder_cm": 60, "inseam_cm": 110, "sleeve_cm": 80,
                "neck_cm": 55}
        assert validate_measurements(mins) == {}
        assert validate_measurements(maxs) == {}

    @pytest.mark.parametrize("field,low,high", [
        ("height_cm", 119, 231), ("weight_kg", 29, 251),
        ("chest_cm", 59, 171), ("waist_cm", 49, 161),
        ("hip_cm", 59, 171), ("shoulder_cm", 29, 61),
        ("inseam_cm", 49, 111), ("sleeve_cm", 39, 81),
        ("neck_cm", 24, 56),
    ])
    def test_out_of_range_rejected(self, field, low, high):
        assert field in validate_measurements({field: low})
        assert field in validate_measurements({field: high})

    def test_unknown_field_rejected(self):
        errs = validate_measurements({"bicep_cm": 35})
        assert errs == {"bicep_cm": "unknown field"}

    def test_non_numeric_rejected(self):
        assert "height_cm" in validate_measurements({"height_cm": "tall"})
        assert "weight_kg" in validate_measurements({"weight_kg": True})

    def test_none_counts_as_not_provided(self):
        assert validate_measurements({"chest_cm": None}) == {}

    def test_only_offending_fields_reported(self):
        errs = validate_measurements({"height_cm": 175, "waist_cm": 999})
        assert set(errs) == {"waist_cm"}


# ---- Morph derivation ---------------------------------------------------------

def _morphs_3dp(m):
    return {k: round(v, 3) for k, v in derive_morphs(m).items()}


class TestMorphs:
    def test_shared_vector_to_3_decimals(self):
        assert _morphs_3dp(SHARED_VECTOR) == SHARED_MORPHS_3DP

    def test_empty_input_is_all_neutral(self):
        assert derive_morphs({}) == {ch: 1.0 for ch in ALL_CHANNELS}

    def test_missing_height_is_all_neutral(self):
        # No height → no baselines → the avatar stays neutral, never guesses.
        m = dict(SHARED_VECTOR)
        del m["height_cm"]
        assert derive_morphs(m) == {ch: 1.0 for ch in ALL_CHANNELS}

    def test_missing_fields_stay_neutral(self):
        morphs = _morphs_3dp({"height_cm": 190.0})
        assert morphs["height"] == round(190 / 175, 3)  # 1.086
        for ch in ALL_CHANNELS - {"height"}:
            assert morphs[ch] == 1.0

    def test_girth_clamps_high_at_1_25(self):
        # 170 cm chest on a 120 cm frame → ratio 2.57 → clamped
        assert derive_morphs({"height_cm": 120, "chest_cm": 170})["chest"] == 1.25

    def test_girth_clamps_low_at_0_80(self):
        # 60 cm chest on a 230 cm frame → ratio 0.47 → clamped
        assert derive_morphs({"height_cm": 230, "chest_cm": 60})["chest"] == 0.80

    def test_height_clamps(self):
        assert derive_morphs({"height_cm": 230})["height"] == 1.15
        assert derive_morphs({"height_cm": 120})["height"] == 0.85

    def test_bmi_factor_clamps_high(self):
        # waist exactly at baseline (0.47 * 175 = 82.25) → ratio 1.0; huge BMI
        # pushes the factor to its 1.12 ceiling.
        m = {"height_cm": 175.0, "weight_kg": 250.0, "waist_cm": 82.25}
        assert derive_morphs(m)["waist"] == pytest.approx(1.12)

    def test_bmi_factor_clamps_low(self):
        m = {"height_cm": 175.0, "weight_kg": 30.0, "waist_cm": 82.25}
        assert derive_morphs(m)["waist"] == pytest.approx(0.93)

    def test_waist_reclamped_after_bmi(self):
        # Ratio already at the 1.25 ceiling; the BMI boost must not exceed it.
        m = {"height_cm": 120.0, "weight_kg": 250.0, "waist_cm": 160.0}
        assert derive_morphs(m)["waist"] == 1.25

    def test_no_bmi_adjustment_without_weight(self):
        with_w = derive_morphs(SHARED_VECTOR)["waist"]
        m = dict(SHARED_VECTOR)
        del m["weight_kg"]
        without_w = derive_morphs(m)["waist"]
        assert without_w == pytest.approx(80 / (0.47 * 175))
        assert with_w != without_w

    def test_deterministic(self):
        assert derive_morphs(SHARED_VECTOR) == derive_morphs(dict(SHARED_VECTOR))


# ---- API: /v1/twin/measurements ---------------------------------------------

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("VARUNOS_API_KEY", "test-secret-key-12345")
    monkeypatch.setenv("VARUNOS_USER_ID", "test-user")
    # Reset DB to in-memory so tests are isolated
    from varunos import db
    db.reset_for_tests(":memory:")
    from varunos.api.server import app
    with TestClient(app) as c:
        yield c


def _auth(token: str = "test-secret-key-12345"):
    return {"Authorization": f"Bearer {token}"}


class TestTwinAPI:
    def test_requires_auth(self, client):
        assert client.get("/v1/twin/measurements").status_code == 401

    def test_get_empty_is_neutral(self, client):
        r = client.get("/v1/twin/measurements", headers=_auth())
        assert r.status_code == 200
        body = r.json()
        assert body["measurements"] is None
        assert body["updated_at"] is None
        assert body["morphs"] == {ch: 1.0 for ch in ALL_CHANNELS}

    def test_put_then_get_roundtrip(self, client):
        r = client.put("/v1/twin/measurements", headers=_auth(), json=SHARED_VECTOR)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["measurements"]["chest_cm"] == 100.0
        assert body["updated_at"] is not None
        assert {k: round(v, 3) for k, v in body["morphs"].items()} == SHARED_MORPHS_3DP
        # GET returns the same shape and data
        g = client.get("/v1/twin/measurements", headers=_auth()).json()
        assert g["measurements"] == body["measurements"]
        assert g["morphs"] == body["morphs"]

    def test_invalid_put_is_422_and_writes_nothing(self, client):
        r = client.put("/v1/twin/measurements", headers=_auth(),
                       json={"height_cm": 999, "chest_cm": 100})
        assert r.status_code == 422
        assert "height_cm" in r.json()["errors"]
        # Nothing was persisted — the validator gates every write
        g = client.get("/v1/twin/measurements", headers=_auth()).json()
        assert g["measurements"] is None

    def test_unknown_field_is_422(self, client):
        r = client.put("/v1/twin/measurements", headers=_auth(), json={"bicep_cm": 40})
        assert r.status_code == 422
        assert r.json()["errors"] == {"bicep_cm": "unknown field"}

    def test_partial_put_merges(self, client):
        client.put("/v1/twin/measurements", headers=_auth(),
                   json={"height_cm": 175, "chest_cm": 100})
        client.put("/v1/twin/measurements", headers=_auth(), json={"waist_cm": 80})
        g = client.get("/v1/twin/measurements", headers=_auth()).json()
        assert g["measurements"]["height_cm"] == 175
        assert g["measurements"]["chest_cm"] == 100
        assert g["measurements"]["waist_cm"] == 80

    def test_every_save_appends_history(self, client):
        from varunos import db
        client.put("/v1/twin/measurements", headers=_auth(), json={"height_cm": 175})
        client.put("/v1/twin/measurements", headers=_auth(), json={"chest_cm": 100})
        hist = db.list_twin_history("test-user")
        assert len(hist) == 2
        assert hist[0]["snapshot"]["chest_cm"] == 100  # newest first, merged
        assert hist[0]["snapshot"]["height_cm"] == 175
        assert hist[1]["snapshot"]["chest_cm"] is None

    def _signup(self, client, email, pw="password123"):
        r = client.post("/v1/auth/signup", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text
        return r.json()["token"]

    def test_cross_user_isolation(self, client):
        # The whole ballgame: A's body must be invisible to B.
        a = self._signup(client, "twin-a@x.com")
        b = self._signup(client, "twin-b@x.com")
        r = client.put("/v1/twin/measurements", headers=_auth(a), json=SHARED_VECTOR)
        assert r.status_code == 200
        a_body = client.get("/v1/twin/measurements", headers=_auth(a)).json()
        b_body = client.get("/v1/twin/measurements", headers=_auth(b)).json()
        assert a_body["measurements"]["chest_cm"] == 100.0
        assert b_body["measurements"] is None  # B cannot see A's data
        assert b_body["morphs"] == {ch: 1.0 for ch in ALL_CHANNELS}
