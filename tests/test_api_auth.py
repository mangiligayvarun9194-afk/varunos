"""
Tests for the FastAPI auth, persistence, and new endpoints.

These tests use FastAPI's TestClient. They are independent of the
deterministic-core tests; they verify the HTTP-level behavior the
core tests don't cover.
"""

import os
import pytest
from fastapi.testclient import TestClient


# ---- Setup: configure env BEFORE importing the app -----------------------

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


# ---- Public endpoints -----------------------------------------------------

class TestPublicEndpoints:
    def test_healthz_is_public(self, client):
        r = client.get("/healthz")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "version" in body
        assert "auth_configured" in body

    def test_healthz_no_auth_needed(self, client):
        # No Authorization header
        r = client.get("/healthz")
        assert r.status_code == 200

    def test_openapi_is_public(self, client):
        r = client.get("/openapi.json")
        assert r.status_code == 200


# ---- Auth enforcement -----------------------------------------------------

class TestAuthRequired:
    def test_no_key_returns_401_or_503(self, client):
        # Without auth header, protected endpoints must reject
        r = client.get("/v1/programs")
        assert r.status_code in (401, 503)

    def test_wrong_key_returns_401(self, client):
        r = client.get("/v1/programs", headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 401

    def test_correct_key_returns_200(self, client):
        r = client.get("/v1/programs", headers=_auth())
        assert r.status_code == 200

    def test_x_api_key_works(self, client):
        r = client.get("/v1/programs", headers={"X-API-Key": "test-secret-key-12345"})
        assert r.status_code == 200

    def test_auth_check_works(self, client):
        r = client.get("/v1/auth/check", headers=_auth())
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ---- DB layer -------------------------------------------------------------

class TestDatabase:
    def test_upsert_profile(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        db.upsert_profile("alice", {"name": "Alice", "sex": "F", "age": 30,
                                    "height_cm": 165, "weight_kg": 60,
                                    "activity": "moderate", "goal": "cut"})
        p = db.get_profile("alice")
        assert p is not None
        assert p["name"] == "Alice"
        assert p["weight_kg"] == 60

    def test_upsert_profile_updates_existing(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        db.upsert_profile("bob", {"name": "Bob", "weight_kg": 70, "sex": "M",
                                  "age": 30, "height_cm": 175,
                                  "activity": "moderate", "goal": "recomp"})
        db.upsert_profile("bob", {"weight_kg": 72, "sex": "M", "age": 30,
                                  "height_cm": 175, "activity": "moderate",
                                  "goal": "recomp", "name": "Bob"})
        p = db.get_profile("bob")
        assert p["weight_kg"] == 72

    def test_surveillance_consent_default_off(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        assert db.get_surveillance_consent("anyone") is False

    def test_surveillance_consent_can_be_set(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        db.upsert_profile("u", {"name": "U", "weight_kg": 70, "sex": "M",
                                "age": 30, "height_cm": 175,
                                "activity": "moderate", "goal": "recomp"})
        db.set_surveillance_consent("u", True)
        assert db.get_surveillance_consent("u") is True
        db.set_surveillance_consent("u", False)
        assert db.get_surveillance_consent("u") is False

    def test_health_reading_persistence(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        db.add_health_reading("u", "bp", {"sbp": 120, "dbp": 80}, "mmHg",
                              "manual", "LOW", "stage NORMAL")
        readings = db.list_health_readings("u", kind="bp")
        assert len(readings) == 1
        assert readings[0]["value"]["sbp"] == 120

    def test_observability_event_log(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        db.log_event("u", "test_event", channel="test", payload={"k": "v"})
        events = db.list_events("u")
        assert len(events) == 1
        assert events[0]["kind"] == "test_event"
        assert events[0]["payload"]["k"] == "v"

    def test_alert_ack_flow(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        db.create_alert("evt1", "u")
        # Initially not acknowledged
        state = db.check_alert("evt1")
        assert state["acknowledged"] is False
        # Acknowledge
        acked = db.acknowledge_alert("evt1", "user")
        assert acked["acknowledged"] is True
        assert acked["acked_via"] == "user"

    def test_workout_log_persistence(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        wid = db.create_workout_log("u", {"program": "PPL", "day_name": "Push",
                                          "week": 1, "day_index": 0,
                                          "decision": "GREEN"})
        sid = db.add_set("u", wid, "bench_press", 1, 100.0, 5, 8.0)
        logs = db.list_workout_logs("u")
        assert len(logs) == 1
        assert logs[0]["program"] == "PPL"

    def test_meal_log_day_kcal(self):
        from varunos import db
        db.reset_for_tests(":memory:")
        db.add_meal("u", "chicken_breast_100g", 2.0, 330, 62, 0, 7, "lunch")
        today = __import__("datetime").datetime.utcnow().strftime("%Y-%m-%d")
        assert db.day_kcal("u", today) == 330


# ---- Profile endpoints ----------------------------------------------------

class TestProfileEndpoints:
    def test_get_profile_404_when_missing(self, client):
        r = client.get("/v1/user/profile", headers=_auth())
        assert r.status_code == 200
        assert r.json()["exists"] is False

    def test_put_then_get(self, client):
        r = client.put("/v1/user/profile",
                       headers=_auth(),
                       json={"name": "Test", "sex": "M", "age": 30,
                             "height_cm": 178, "weight_kg": 80,
                             "activity": "moderate", "goal": "recomp"})
        assert r.status_code == 200
        assert r.json()["profile"]["name"] == "Test"
        r2 = client.get("/v1/user/profile", headers=_auth())
        assert r2.json()["profile"]["weight_kg"] == 80


# ---- Surveillance consent endpoints ---------------------------------------

class TestSurveillanceConsent:
    def test_default_off(self, client):
        r = client.get("/v1/user/surveillance", headers=_auth())
        assert r.status_code == 200
        assert r.json()["surveillance_on"] is False

    def test_cannot_enable_without_ack(self, client):
        r = client.post("/v1/user/surveillance", headers=_auth(),
                        json={"on": True, "acknowledged_medical_disclaimer": False})
        assert r.status_code == 400
        assert "acknowledge" in r.json()["detail"].lower()

    def test_can_enable_with_ack(self, client):
        r = client.post("/v1/user/surveillance", headers=_auth(),
                        json={"on": True, "acknowledged_medical_disclaimer": True})
        assert r.status_code == 200
        assert r.json()["surveillance_on"] is True
        r2 = client.get("/v1/user/surveillance", headers=_auth())
        assert r2.json()["surveillance_on"] is True

    def test_disable(self, client):
        client.post("/v1/user/surveillance", headers=_auth(),
                    json={"on": True, "acknowledged_medical_disclaimer": True})
        client.post("/v1/user/surveillance", headers=_auth(),
                    json={"on": False})
        r = client.get("/v1/user/surveillance", headers=_auth())
        assert r.json()["surveillance_on"] is False


# ---- Health endpoints (consent-gated) -------------------------------------

class TestHealthEndpoints:
    def _enable_surveillance(self, client):
        client.post("/v1/user/surveillance", headers=_auth(),
                    json={"on": True, "acknowledged_medical_disclaimer": True})

    def test_bp_endpoint_works(self, client):
        r = client.post("/v1/health/bp", headers=_auth(),
                        json={"sbp": 125, "dbp": 80})
        assert r.status_code == 200
        body = r.json()
        assert "stage" in body
        assert "tier" in body
        assert "action_label" in body
        assert "disclaimer" in body

    def test_bp_crisis_returns_escalation(self, client):
        r = client.post("/v1/health/bp", headers=_auth(),
                        json={"sbp": 200, "dbp": 130})
        body = r.json()
        assert body["escalation"]["level"] == "CRITICAL"

    def test_bp_persisted_only_when_consented(self, client):
        # Without consent: persisted=false
        r = client.post("/v1/health/bp", headers=_auth(),
                        json={"sbp": 130, "dbp": 85})
        assert r.json()["persisted"] is False
        # With consent: persisted=true
        self._enable_surveillance(client)
        r2 = client.post("/v1/health/bp", headers=_auth(),
                         json={"sbp": 130, "dbp": 85})
        assert r2.json()["persisted"] is True
        # And it shows up in /v1/health/recent
        r3 = client.get("/v1/health/recent", headers=_auth())
        assert len(r3.json()["readings"]) >= 1

    def test_health_recent_blocked_without_consent(self, client):
        r = client.get("/v1/health/recent", headers=_auth())
        assert r.status_code == 403

    def test_glucose_endpoint_works(self, client):
        r = client.post("/v1/health/glucose", headers=_auth(),
                        json={"value_mgdl": 100})
        assert r.status_code == 200
        assert "tier" in r.json()

    def test_glucose_low_triggers_critical(self, client):
        r = client.post("/v1/health/glucose", headers=_auth(),
                        json={"value_mgdl": 40})
        body = r.json()
        assert body["escalation"]["level"] == "CRITICAL"


# ---- Logs endpoints -------------------------------------------------------

class TestLogsEndpoints:
    def test_workout_log_round_trip(self, client):
        r = client.post("/v1/logs/workouts", headers=_auth(),
                        json={"program": "PPL", "day_name": "Push",
                              "week": 1, "day_index": 0, "decision": "GREEN",
                              "sets": [
                                {"exercise_id": "bench_press", "set_index": 1,
                                 "weight_kg": 100, "reps": 5, "rpe": 8},
                                {"exercise_id": "bench_press", "set_index": 2,
                                 "weight_kg": 100, "reps": 5, "rpe": 8},
                              ]})
        assert r.status_code == 200
        assert "workout_id" in r.json()
        wid = r.json()["workout_id"]
        assert len(r.json()["set_ids"]) == 2
        r2 = client.get("/v1/logs/workouts", headers=_auth())
        assert any(w["id"] == wid for w in r2.json()["workouts"])

    def test_meal_log_looks_up_macros(self, client):
        r = client.post("/v1/logs/meals", headers=_auth(),
                        json={"food_id": "chicken_breast_100g", "portions": 2.0})
        assert r.status_code == 200
        body = r.json()
        assert body["kcal"] == 330   # 2 portions of 165
        assert body["p"] == 62

    def test_meal_log_with_explicit_macros(self, client):
        r = client.post("/v1/logs/meals", headers=_auth(),
                        json={"food_id": "custom", "portions": 1.0,
                              "kcal": 100, "p_g": 10, "c_g": 5, "f_g": 3})
        assert r.status_code == 200
        assert r.json()["kcal"] == 100

    def test_checkin_log(self, client):
        r = client.post("/v1/logs/checkins", headers=_auth(),
                        json={"hrv_today_ms": 50, "rhr_today_bpm": 60,
                              "sleep_min": 420, "energy_1to5": 4,
                              "soreness_1to5": 2})
        assert r.status_code == 200
        assert "checkin" in r.json()


# ---- Observability endpoints ---------------------------------------------

class TestObservabilityEndpoints:
    def test_log_endpoint(self, client):
        r = client.post("/v1/observability/log", headers=_auth(),
                        json={"kind": "test_event", "channel": "test",
                              "payload": {"x": 1}})
        assert r.status_code == 200
        assert r.json()["logged"] is True

    def test_events_endpoint(self, client):
        client.post("/v1/observability/log", headers=_auth(),
                    json={"kind": "alpha"})
        client.post("/v1/observability/log", headers=_auth(),
                    json={"kind": "beta"})
        r = client.get("/v1/observability/events", headers=_auth())
        kinds = [e["kind"] for e in r.json()["events"]]
        assert "alpha" in kinds
        assert "beta" in kinds

    def test_alert_create_and_ack(self, client):
        r1 = client.post("/v1/observability/alert", headers=_auth(),
                         json={"event_id": "test_evt_1"})
        assert r1.status_code == 200
        eid = r1.json()["event_id"]
        r2 = client.post("/v1/observability/ack_check", headers=_auth(),
                         json={"event_id": eid})
        assert r2.json()["acknowledged"] is False
        r3 = client.post("/v1/observability/ack", headers=_auth(),
                         json={"event_id": eid, "acked_via": "test"})
        assert r3.json()["acknowledged"] is True


# ---- Recompute tiers ------------------------------------------------------

class TestRecomputeTiers:
    def test_recompute_bp_only(self, client):
        r = client.post("/v1/core/recompute_tiers", headers=_auth(),
                        json={"bp": {"sbp": 200, "dbp": 130}})
        assert r.status_code == 200
        body = r.json()
        assert "bp" in body["tiers"]
        assert body["tiers"]["bp"]["stage"] == "HYPERTENSIVE_CRISIS"

    def test_recompute_glucose_only(self, client):
        r = client.post("/v1/core/recompute_tiers", headers=_auth(),
                        json={"glucose": {"mgdl": 40}})
        assert r.status_code == 200
        body = r.json()
        assert body["tiers"]["glucose"]["tier"] == "CRITICAL"

    def test_recompute_readiness(self, client):
        r = client.post("/v1/core/recompute_tiers", headers=_auth(),
                        json={"readiness_inputs": {
                            "hrv_today_ms": 50, "hrv_7d_baseline_ms": 50,
                            "rhr_today_bpm": 60, "rhr_30d_baseline_bpm": 60,
                            "sleep_components": {"duration_min": 450,
                                                 "deep_pct": 17, "rem_pct": 22,
                                                 "efficiency_pct": 92,
                                                 "continuity_min": 3},
                            "energy_1to5": 5, "soreness_1to5": 1,
                            "mood_1to5": 5, "stress_1to5": 1,
                            "acute_load": 80, "chronic_load": 100,
                        }})
        assert r.status_code == 200
        body = r.json()
        assert "readiness" in body
        assert "overall" in body["readiness"]

    def test_recompute_returns_tier_only_no_raw(self, client):
        """The brain-layer view: only tier strings, never raw values."""
        r = client.post("/v1/core/recompute_tiers", headers=_auth(),
                        json={"bp": {"sbp": 145, "dbp": 92},
                              "glucose": {"mgdl": 165}})
        body = r.json()
        # The body must NOT contain the raw SBP/DBP or mgdl values
        # (it's just the tier summary)
        assert "sbp" not in str(body)
        assert "dbp" not in str(body)
        assert "mgdl" not in str(body)


# ---- BP escalation endpoint (n8n calls this) -----------------------------

class TestBPescalateEndpoint:
    def test_normal_bp_no_escalation(self, client):
        r = client.post("/v1/surveillance/escalate/bp", headers=_auth(),
                        json={"sbp": 120, "dbp": 80})
        assert r.status_code == 200
        body = r.json()
        assert body["level"] == "NOTIFY"

    def test_crisis_bp_escalates(self, client):
        r = client.post("/v1/surveillance/escalate/bp", headers=_auth(),
                        json={"sbp": 200, "dbp": 130})
        body = r.json()
        assert body["level"] == "CRITICAL"
        assert "channels" in body
        assert len(body["channels"]) >= 3


# ---- Failure mode: server without API key --------------------------------

class TestNoKeyConfigured:
    def test_no_key_returns_503(self, monkeypatch):
        monkeypatch.delenv("VARUNOS_API_KEY", raising=False)
        from varunos import db
        db.reset_for_tests(":memory:")
        from varunos.api.server import app
        with TestClient(app) as c:
            r = c.get("/v1/programs")
            assert r.status_code == 503
            assert "VARUNOS_API_KEY" in r.json()["detail"]
