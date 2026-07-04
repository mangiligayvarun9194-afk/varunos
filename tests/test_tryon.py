"""
Tests for the Twin Try-On engine (varunos/core/tryon.py) and its API:

  GET  /v1/tryon/catalog    - the catalog fitted to today's + goal body
  POST /v1/tryon/intent     - "I'd wear this" demand signals
  GET  /v1/metrics/investor - honest global aggregates

The core is pure: a fixed 8-item catalog, chest-governed tops, waist-governed
bottoms, and a deterministic fit verdict for every garment/body pair. The API
tests cover the intent roundtrip + validation, per-user attribution, catalog
null-safety, and metrics shape / zero-safety on an empty DB.
"""

import pytest
from fastapi.testclient import TestClient

from varunos.core.tryon import (
    CATALOG, CATALOG_BY_ID, NEAR_MISS_CM, TOP_KINDS, BOTTOM_KINDS,
    governing_field, fit_item, fit_catalog,
)
from varunos.core.twinbody import derive_goal_measurements


EXPECTED_IDS = {
    "tee-core", "tee-oversize", "tank-train", "hoodie-flow",
    "joggers-earth", "shorts-agni", "tee-vayu", "joggers-akasha",
}
SIZE_ORDER = ["S", "M", "L", "XL", "XXL"]

TEE_CORE = CATALOG_BY_ID["tee-core"]
JOGGERS_EARTH = CATALOG_BY_ID["joggers-earth"]


# ---- Catalog data -------------------------------------------------------------

class TestCatalog:
    def test_exactly_eight_items_with_pinned_ids(self):
        assert len(CATALOG) == 8
        assert {i["id"] for i in CATALOG} == EXPECTED_IDS

    def test_kinds_are_tops_and_bottoms(self):
        kinds = {i["kind"] for i in CATALOG}
        assert kinds <= (TOP_KINDS | BOTTOM_KINDS)
        assert kinds & TOP_KINDS and kinds & BOTTOM_KINDS

    def test_prices_in_range(self):
        for item in CATALOG:
            assert 799 <= item["price_inr"] <= 2499, item["id"]

    def test_size_charts_ordered_and_contiguous(self):
        for item in CATALOG:
            assert list(item["sizes"]) == SIZE_ORDER, item["id"]
            prev_hi = None
            for name in SIZE_ORDER:
                lo, hi = item["sizes"][name]
                assert lo < hi, (item["id"], name)
                if prev_hi is not None:
                    # contiguous: each size starts 1 cm above the previous cap
                    assert lo == prev_hi + 1, (item["id"], name)
                prev_hi = hi

    def test_governing_fields(self):
        assert governing_field(TEE_CORE) == "chest_cm"
        assert governing_field(CATALOG_BY_ID["tank-train"]) == "chest_cm"
        assert governing_field(CATALOG_BY_ID["hoodie-flow"]) == "chest_cm"
        assert governing_field(JOGGERS_EARTH) == "waist_cm"
        assert governing_field(CATALOG_BY_ID["shorts-agni"]) == "waist_cm"

    def test_tee_core_uses_the_standard_chart(self):
        assert TEE_CORE["sizes"] == {
            "S": (86.0, 91.0), "M": (92.0, 97.0), "L": (98.0, 104.0),
            "XL": (105.0, 112.0), "XXL": (113.0, 120.0)}

    def test_joggers_earth_uses_the_standard_chart(self):
        assert JOGGERS_EARTH["sizes"] == {
            "S": (71.0, 76.0), "M": (77.0, 82.0), "L": (83.0, 89.0),
            "XL": (90.0, 97.0), "XXL": (98.0, 106.0)}


# ---- fit_item: every verdict branch --------------------------------------------

class TestFitItem:
    def test_true_fit_mid_range(self):
        assert fit_item(TEE_CORE, {"chest_cm": 95.0}) == {"size": "M", "verdict": "true"}

    def test_edges_are_inclusive(self):
        assert fit_item(TEE_CORE, {"chest_cm": 86.0}) == {"size": "S", "verdict": "true"}
        assert fit_item(TEE_CORE, {"chest_cm": 91.0}) == {"size": "S", "verdict": "true"}
        assert fit_item(TEE_CORE, {"chest_cm": 92.0}) == {"size": "M", "verdict": "true"}
        assert fit_item(TEE_CORE, {"chest_cm": 120.0}) == {"size": "XXL", "verdict": "true"}

    def test_below_smallest_within_4cm_is_size_down(self):
        assert fit_item(TEE_CORE, {"chest_cm": 84.0}) == {"size": "S", "verdict": "size_down"}
        # exactly 4 cm below still qualifies
        assert fit_item(TEE_CORE, {"chest_cm": 86.0 - NEAR_MISS_CM}) == \
            {"size": "S", "verdict": "size_down"}

    def test_below_smallest_beyond_4cm_is_no_fit(self):
        assert fit_item(TEE_CORE, {"chest_cm": 81.5}) == {"size": None, "verdict": "no_fit"}
        assert fit_item(TEE_CORE, {"chest_cm": 60.0}) == {"size": None, "verdict": "no_fit"}

    def test_above_largest_within_4cm_is_size_up(self):
        assert fit_item(TEE_CORE, {"chest_cm": 122.0}) == {"size": "XXL", "verdict": "size_up"}
        assert fit_item(TEE_CORE, {"chest_cm": 120.0 + NEAR_MISS_CM}) == \
            {"size": "XXL", "verdict": "size_up"}

    def test_above_largest_beyond_4cm_is_no_fit(self):
        assert fit_item(TEE_CORE, {"chest_cm": 124.5}) == {"size": None, "verdict": "no_fit"}

    def test_missing_governing_measurement(self):
        assert fit_item(TEE_CORE, {}) == {"size": None, "verdict": "need_measurements"}
        assert fit_item(TEE_CORE, None) == {"size": None, "verdict": "need_measurements"}
        assert fit_item(TEE_CORE, {"chest_cm": None}) == \
            {"size": None, "verdict": "need_measurements"}
        # a top only cares about chest — a waist alone is not enough
        assert fit_item(TEE_CORE, {"waist_cm": 80.0}) == \
            {"size": None, "verdict": "need_measurements"}
        # ...and vice versa for bottoms
        assert fit_item(JOGGERS_EARTH, {"chest_cm": 100.0}) == \
            {"size": None, "verdict": "need_measurements"}

    def test_bottoms_governed_by_waist(self):
        assert fit_item(JOGGERS_EARTH, {"waist_cm": 80.0}) == {"size": "M", "verdict": "true"}
        assert fit_item(JOGGERS_EARTH, {"waist_cm": 106.0}) == {"size": "XXL", "verdict": "true"}
        assert fit_item(JOGGERS_EARTH, {"waist_cm": 110.0}) == {"size": "XXL", "verdict": "size_up"}
        assert fit_item(JOGGERS_EARTH, {"waist_cm": 111.0}) == {"size": None, "verdict": "no_fit"}

    def test_gap_between_ranges_snaps_to_nearest_size(self):
        # A synthetic (non-contiguous) chart to exercise the gap branch.
        gappy = {"id": "x", "kind": "tee", "sizes": {"S": (80.0, 85.0), "M": (90.0, 95.0)}}
        assert fit_item(gappy, {"chest_cm": 86.0}) == {"size": "S", "verdict": "true"}
        assert fit_item(gappy, {"chest_cm": 89.0}) == {"size": "M", "verdict": "true"}

    def test_recomp_goal_moves_97_chest_from_M_to_L(self):
        # The demo moment: today M, goal-body L on the standard tee chart.
        m = {"chest_cm": 97.0}
        assert fit_item(TEE_CORE, m) == {"size": "M", "verdict": "true"}
        goal_m = derive_goal_measurements(m, "recomp")
        assert goal_m["chest_cm"] == pytest.approx(100.88)
        assert fit_item(TEE_CORE, goal_m) == {"size": "L", "verdict": "true"}

    def test_deterministic(self):
        m = {"chest_cm": 97.0, "waist_cm": 80.0}
        assert fit_item(TEE_CORE, m) == fit_item(TEE_CORE, dict(m))


# ---- fit_catalog ---------------------------------------------------------------

class TestFitCatalog:
    def test_shape_and_public_fields(self):
        m = {"chest_cm": 97.0, "waist_cm": 80.0}
        out = fit_catalog(m, derive_goal_measurements(m, "recomp"))
        assert len(out) == 8
        for entry in out:
            assert set(entry) == {"id", "name", "kind", "price_inr", "sizes",
                                  "today", "goal"}
            assert list(entry["sizes"]) == SIZE_ORDER
            assert set(entry["today"]) == {"size", "verdict"}
            assert set(entry["goal"]) == {"size", "verdict"}

    def test_empty_measurements_everything_needs_measurements(self):
        for entry in fit_catalog({}, {}):
            assert entry["today"]["verdict"] == "need_measurements"
            assert entry["goal"]["verdict"] == "need_measurements"

    def test_goal_vs_today_divergence(self):
        m = {"chest_cm": 97.0, "waist_cm": 80.0}
        out = {e["id"]: e for e in fit_catalog(m, derive_goal_measurements(m, "recomp"))}
        assert out["tee-core"]["today"] == {"size": "M", "verdict": "true"}
        assert out["tee-core"]["goal"] == {"size": "L", "verdict": "true"}
        # recomp waist 80 → 75.2: joggers-earth M today, S at goal
        assert out["joggers-earth"]["today"] == {"size": "M", "verdict": "true"}
        assert out["joggers-earth"]["goal"] == {"size": "S", "verdict": "true"}

    def test_deterministic(self):
        m = {"chest_cm": 97.0, "waist_cm": 80.0}
        g = derive_goal_measurements(m, "recomp")
        assert fit_catalog(m, g) == fit_catalog(dict(m), dict(g))


# ---- API ------------------------------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("VARUNOS_API_KEY", "test-secret-key-12345")
    monkeypatch.setenv("VARUNOS_USER_ID", "test-user")
    from varunos import db
    db.reset_for_tests(":memory:")
    from varunos.api.server import app
    with TestClient(app) as c:
        yield c


def _auth(token: str = "test-secret-key-12345"):
    return {"Authorization": f"Bearer {token}"}


def _signup(client, email, pw="password123"):
    r = client.post("/v1/auth/signup", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"]


METRIC_KEYS = {
    "users_total", "measurements_set", "workouts_total", "workouts_7d",
    "avg_twin_level", "tryon_intents_total", "tryon_intents_7d",
    "measurement_history_points", "series", "notes", "generated_at",
}


class TestTryonAPI:
    def test_requires_auth(self, client):
        assert client.get("/v1/tryon/catalog").status_code == 401
        assert client.post("/v1/tryon/intent", json={}).status_code == 401
        assert client.get("/v1/metrics/investor").status_code == 401

    def test_catalog_without_measurements_is_null_safe(self, client):
        r = client.get("/v1/tryon/catalog", headers=_auth())
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 8
        for it in items:
            assert it["today"] == {"size": None, "verdict": "need_measurements"}
            assert it["goal"] == {"size": None, "verdict": "need_measurements"}

    def test_catalog_with_measurements_fits_today_and_goal(self, client):
        r = client.put("/v1/twin/measurements", headers=_auth(),
                       json={"height_cm": 175, "chest_cm": 97, "waist_cm": 80})
        assert r.status_code == 200, r.text
        items = {i["id"]: i for i in
                 client.get("/v1/tryon/catalog", headers=_auth()).json()["items"]}
        # default goal is recomp (no profile goal stored)
        assert items["tee-core"]["today"] == {"size": "M", "verdict": "true"}
        assert items["tee-core"]["goal"] == {"size": "L", "verdict": "true"}
        assert items["joggers-earth"]["today"] == {"size": "M", "verdict": "true"}
        assert items["joggers-earth"]["goal"] == {"size": "S", "verdict": "true"}

    def test_catalog_respects_profile_goal(self, client):
        client.put("/v1/user/profile", headers=_auth(), json={"goal": "bulk"})
        client.put("/v1/twin/measurements", headers=_auth(),
                   json={"height_cm": 175, "chest_cm": 97, "waist_cm": 80})
        items = {i["id"]: i for i in
                 client.get("/v1/tryon/catalog", headers=_auth()).json()["items"]}
        # bulk: chest 97 → 104.76 (the 104–105 chart gap → nearest = XL);
        # waist 80 → 81.6 → still M
        assert items["tee-core"]["goal"] == {"size": "XL", "verdict": "true"}
        assert items["joggers-earth"]["goal"] == {"size": "M", "verdict": "true"}

    def test_intent_roundtrip_and_attribution(self, client):
        from varunos import db
        r = client.post("/v1/tryon/intent", headers=_auth(),
                        json={"item_id": "tee-core", "size": "M", "mode": "today"})
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}
        rows = db.list_tryon_intents("test-user")
        assert len(rows) == 1
        assert rows[0]["item_id"] == "tee-core"
        assert rows[0]["size"] == "M"
        assert rows[0]["mode"] == "today"
        assert rows[0]["user_id"] == "test-user"
        assert rows[0]["created_at"]

    def test_intent_validation_422(self, client):
        r = client.post("/v1/tryon/intent", headers=_auth(),
                        json={"item_id": "tee-nope", "size": "M", "mode": "today"})
        assert r.status_code == 422
        assert "item_id" in r.json()["errors"]

        r = client.post("/v1/tryon/intent", headers=_auth(),
                        json={"item_id": "tee-core", "size": "M", "mode": "someday"})
        assert r.status_code == 422
        assert "mode" in r.json()["errors"]

        r = client.post("/v1/tryon/intent", headers=_auth(),
                        json={"item_id": "tee-core", "size": "XS", "mode": "goal"})
        assert r.status_code == 422
        assert "size" in r.json()["errors"]

        r = client.post("/v1/tryon/intent", headers=_auth(), json={})
        assert r.status_code == 422
        errs = r.json()["errors"]
        assert "item_id" in errs and "mode" in errs

        # nothing invalid was ever stored
        from varunos import db
        assert db.count_tryon_intents() == 0

    def test_intent_goal_mode_accepted(self, client):
        r = client.post("/v1/tryon/intent", headers=_auth(),
                        json={"item_id": "joggers-akasha", "size": "L", "mode": "goal"})
        assert r.status_code == 200 and r.json() == {"ok": True}

    def test_intents_attributed_per_user(self, client):
        from varunos import db
        a = _signup(client, "tryon-a@x.com")
        b = _signup(client, "tryon-b@x.com")
        r = client.post("/v1/tryon/intent", headers=_auth(a),
                        json={"item_id": "hoodie-flow", "size": "L", "mode": "goal"})
        assert r.status_code == 200
        a_uid = db.get_account_by_email("tryon-a@x.com")["user_id"]
        b_uid = db.get_account_by_email("tryon-b@x.com")["user_id"]
        a_rows = db.list_tryon_intents(a_uid)
        assert len(a_rows) == 1 and a_rows[0]["user_id"] == a_uid
        assert db.list_tryon_intents(b_uid) == []
        # metrics are global aggregates — both users' intents count once total
        m = client.get("/v1/metrics/investor", headers=_auth(b)).json()
        assert m["tryon_intents_total"] == 1


class TestInvestorMetrics:
    def test_shape_and_zero_safety_on_empty_db(self, client):
        r = client.get("/v1/metrics/investor", headers=_auth())
        assert r.status_code == 200
        m = r.json()
        assert set(m) == METRIC_KEYS
        for k in ("users_total", "measurements_set", "workouts_total",
                  "workouts_7d", "avg_twin_level", "tryon_intents_total",
                  "tryon_intents_7d", "measurement_history_points"):
            assert m[k] == 0, k
        assert m["series"]["weekly_workouts"] == [0] * 8
        assert isinstance(m["notes"], list) and m["notes"]
        assert all(isinstance(n, str) for n in m["notes"])
        assert isinstance(m["generated_at"], str) and m["generated_at"]

    def test_counts_reflect_real_activity(self, client):
        from varunos import db
        _signup(client, "metrics@x.com")
        client.put("/v1/twin/measurements", headers=_auth(),
                   json={"height_cm": 175, "chest_cm": 97})
        client.put("/v1/twin/measurements", headers=_auth(), json={"waist_cm": 80})
        db.create_workout_log("test-user", {"program": "ppl", "day_name": "push",
                                            "week": 1, "day_index": 0,
                                            "decision": "GREEN"})
        client.post("/v1/tryon/intent", headers=_auth(),
                    json={"item_id": "tee-core", "size": "M", "mode": "today"})
        client.post("/v1/tryon/intent", headers=_auth(),
                    json={"item_id": "shorts-agni", "size": "M", "mode": "goal"})

        m = client.get("/v1/metrics/investor", headers=_auth()).json()
        assert m["users_total"] == 1               # one registered account
        assert m["measurements_set"] == 1          # one user has a twin body
        assert m["measurement_history_points"] == 2  # two saves → two snapshots
        assert m["workouts_total"] == 1
        assert m["workouts_7d"] == 1
        assert m["tryon_intents_total"] == 2
        assert m["tryon_intents_7d"] == 2
        # the workout just logged lands in the newest weekly bucket
        assert m["series"]["weekly_workouts"][-1] == 1
        assert sum(m["series"]["weekly_workouts"]) == 1
        # avatar level is computed, not fabricated: a real 0-100 number
        assert isinstance(m["avg_twin_level"], (int, float))
        assert 0 <= m["avg_twin_level"] <= 100

    def test_avg_twin_level_note_is_honest(self, client):
        m = client.get("/v1/metrics/investor", headers=_auth()).json()
        assert any("avg_twin_level" in n for n in m["notes"])
