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


class TestReadinessSimple:
    def test_good_day_is_green(self, client):
        r = client.post("/v1/readiness/simple", headers=_auth(), json={
            "sleep_hours": 8, "sleep_quality_1to5": 4, "energy_1to5": 4,
            "soreness_1to5": 2, "mood_1to5": 4, "stress_1to5": 2})
        assert r.status_code == 200
        body = r.json()
        assert body["color"] == "GREEN"
        # No wearable → only sleep + wellness reported, never fake HRV
        assert set(body["components"]) == {"sleep", "wellness"}

    def test_rough_day_is_red(self, client):
        r = client.post("/v1/readiness/simple", headers=_auth(), json={
            "sleep_hours": 4, "sleep_quality_1to5": 1, "energy_1to5": 1,
            "soreness_1to5": 5, "mood_1to5": 2, "stress_1to5": 5})
        assert r.json()["color"] == "RED"


class TestWearableSync:
    def test_sync_returns_readiness(self, client):
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "source": "apple_health", "hrv_ms": 60, "rhr_bpm": 55,
            "sleep_hours": 7.5, "steps": 8000})
        assert r.status_code == 200
        body = r.json()
        assert body["synced"] is True
        assert body["readiness"]["overall"] > 0

    def test_status_reflects_sync(self, client):
        client.post("/v1/sync/wearable", headers=_auth(), json={
            "source": "apple_health", "hrv_ms": 60, "rhr_bpm": 55, "sleep_hours": 7})
        r = client.get("/v1/sync/status", headers=_auth())
        assert r.json()["connected"] is True
        assert r.json()["source"] == "apple_health"

    def test_readiness_today_after_sync(self, client):
        client.post("/v1/sync/wearable", headers=_auth(), json={
            "source": "apple_health", "hrv_ms": 60, "sleep_hours": 8})
        r = client.get("/v1/readiness/today", headers=_auth())
        assert r.json()["has_data"] is True
        assert r.json()["source"] == "apple_health"

    def test_readiness_today_empty_when_nothing(self, client):
        r = client.get("/v1/readiness/today", headers=_auth())
        assert r.json()["has_data"] is False

    def test_manual_checkin_does_not_wipe_wearable(self, client):
        # Watch syncs HRV, then a manual mood check-in should keep the HRV
        client.post("/v1/sync/wearable", headers=_auth(), json={
            "source": "apple_health", "hrv_ms": 60, "rhr_bpm": 55, "sleep_hours": 8})
        client.post("/v1/logs/checkins", headers=_auth(), json={
            "energy_1to5": 4, "soreness_1to5": 2, "mood_1to5": 4, "stress_1to5": 2})
        r = client.get("/v1/readiness/today", headers=_auth()).json()
        # Both objective (hrv) and subjective (wellness) survive the merge
        assert "hrv" in r["components"]
        assert "wellness" in r["components"]


class TestWearableSyncRobustness:
    """The Apple Health Shortcut sends messy real-world data. The ingest must
    tolerate strings, units, empties, lists and junk — never 400 — and drop bad
    readings instead of poisoning baselines."""

    def test_strings_with_units_are_parsed(self, client):
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "source": "apple_health", "hrv_ms": "65 ms", "rhr_bpm": "54 bpm",
            "sleep_hours": "7.5 hr", "steps": "8,041 steps"})
        assert r.status_code == 200
        b = r.json()
        assert b["ok"] is True
        assert set(["HRV", "RHR", "Sleep", "Steps"]).issubset(set(b["received"]))
        assert b["readiness"]["overall"] > 0

    def test_empty_and_nodata_become_none_not_error(self, client):
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "hrv_ms": "", "rhr_bpm": "No Data", "sleep_hours": None,
            "steps": "-", "spo2": "n/a"})
        assert r.status_code == 200
        b = r.json()
        assert b["synced"] is True
        assert b["received"] == []          # nothing usable, but no crash
        assert b["ok"] is False

    def test_list_payload_takes_a_sample(self, client):
        # "Get Health Sample" can return a list; we take the most recent numeric
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "hrv_ms": [58, 61, 64], "rhr_bpm": ["52 bpm"]})
        assert r.status_code == 200
        assert "HRV" in r.json()["received"]
        assert "RHR" in r.json()["received"]

    def test_out_of_range_values_are_dropped(self, client):
        # A glitchy 9999 ms HRV / 5 bpm RHR must not be stored as real data
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "hrv_ms": 9999, "rhr_bpm": 5, "sleep_hours": 99, "spo2": 250})
        assert r.status_code == 200
        assert r.json()["received"] == []

    def test_message_is_human_readable(self, client):
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "hrv_ms": 62, "rhr_bpm": 53, "sleep_hours": 7.8, "steps": 9000})
        msg = r.json()["message"]
        assert "Synced" in msg and "Readiness" in msg

    def test_dict_value_shape_is_parsed(self, client):
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "hrv_ms": {"value": 60, "unit": "ms"}, "steps": {"qty": 7200}})
        assert r.status_code == 200
        assert "HRV" in r.json()["received"] and "Steps" in r.json()["received"]

    def test_dry_run_validates_but_persists_nothing(self, client):
        r = client.post("/v1/sync/wearable", headers=_auth(), json={
            "dry_run": True, "hrv_ms": 62, "rhr_bpm": 53, "sleep_hours": 7.5,
            "steps": 8200})
        assert r.status_code == 200
        b = r.json()
        assert b["ok"] is True and b["dry_run"] is True and b["synced"] is False
        assert b["readiness"]["overall"] > 0
        # nothing was written — status stays disconnected
        assert client.get("/v1/sync/status", headers=_auth()).json()["connected"] is False


class TestHermes:
    """Hermes v1 — the companion that grows with you."""

    def test_fresh_hermes_is_newcomer(self, client):
        r = client.get("/v1/hermes", headers=_auth())
        assert r.status_code == 200
        b = r.json()
        assert b["level"] == 0
        assert b["stage"]["name"] == "newcomer"
        assert b["memories"] == 0

    def test_briefing_works_with_no_data(self, client):
        r = client.get("/v1/hermes/briefing?part=morning", headers=_auth())
        assert r.status_code == 200
        b = r.json()
        assert b["part_of_day"] == "morning"
        assert b["briefing"]["greeting"].startswith("Good morning")
        assert b["text"]  # always returns a friendly paragraph
        assert b["engine"] == "template"  # no LLM key in tests

    def test_evening_briefing_has_reflection(self, client):
        r = client.get("/v1/hermes/briefing?part=evening", headers=_auth())
        assert r.json()["briefing"]["reflection_prompt"] is not None

    def test_briefing_reflects_synced_readiness(self, client):
        client.post("/v1/sync/wearable", headers=_auth(), json={
            "hrv_ms": 70, "rhr_bpm": 50, "sleep_hours": 8})
        b = client.get("/v1/hermes/briefing?part=morning", headers=_auth()).json()
        assert "readiness" in b["text"].lower()

    def test_add_list_delete_memory(self, client):
        a = client.post("/v1/hermes/memory", headers=_auth(),
                        json={"kind": "goal", "text": "deadlift 200kg"})
        assert a.status_code == 200
        mid = a.json()["id"]
        lst = client.get("/v1/hermes/memory", headers=_auth()).json()["memories"]
        assert any(m["text"] == "deadlift 200kg" and m["kind"] == "goal" for m in lst)
        d = client.delete(f"/v1/hermes/memory/{mid}", headers=_auth())
        assert d.status_code == 200
        assert client.get("/v1/hermes/memory", headers=_auth()).json()["memories"] == []

    def test_memory_dedupes(self, client):
        client.post("/v1/hermes/memory", headers=_auth(), json={"kind": "goal", "text": "run 5k"})
        client.post("/v1/hermes/memory", headers=_auth(), json={"kind": "goal", "text": "Run 5k"})
        assert len(client.get("/v1/hermes/memory", headers=_auth()).json()["memories"]) == 1

    def test_conversation_grows_hermes(self, client):
        before = client.get("/v1/hermes", headers=_auth()).json()["interactions"]
        client.post("/v1/coach/act", headers=_auth(), json={"text": "how am I doing today?"})
        after = client.get("/v1/hermes", headers=_auth()).json()["interactions"]
        assert after == before + 1

    def test_goal_is_remembered_from_chat(self, client):
        client.post("/v1/coach/act", headers=_auth(),
                    json={"text": "my goal is to lose 5 kg by August"})
        mems = client.get("/v1/hermes/memory", headers=_auth()).json()["memories"]
        assert any(m["kind"] == "goal" for m in mems)

    def test_pr_is_remembered_as_win(self, client):
        client.post("/v1/coach/act", headers=_auth(), json={"text": "I benched 100 for 5"})
        mems = client.get("/v1/hermes/memory", headers=_auth()).json()["memories"]
        assert any(m["kind"] == "win" for m in mems)

    def test_set_name(self, client):
        r = client.post("/v1/hermes/name", headers=_auth(), json={"name": "Sage"})
        assert r.json()["name"] == "Sage"


class TestAccounts:
    """Multi-user accounts — the public-launch foundation. The non-negotiable
    property is isolation: one account can NEVER see another's health data."""

    def _signup(self, client, email, pw="password123", name=""):
        r = client.post("/v1/auth/signup", json={"email": email, "password": pw, "name": name})
        assert r.status_code == 200, r.text
        return r.json()["token"]

    def _bearer(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_signup_returns_token_and_user(self, client):
        r = client.post("/v1/auth/signup", json={"email": "a@x.com", "password": "password123", "name": "Ann"})
        assert r.status_code == 200
        b = r.json()
        assert b["token"] and b["user"]["email"] == "a@x.com" and b["user"]["name"] == "Ann"

    def test_signup_rejects_bad_email_and_short_password(self, client):
        assert client.post("/v1/auth/signup", json={"email": "nope", "password": "password123"}).status_code == 400
        assert client.post("/v1/auth/signup", json={"email": "b@x.com", "password": "short"}).status_code == 400

    def test_duplicate_email_409(self, client):
        client.post("/v1/auth/signup", json={"email": "dup@x.com", "password": "password123"})
        r = client.post("/v1/auth/signup", json={"email": "DUP@x.com", "password": "password123"})
        assert r.status_code == 409

    def test_login_and_wrong_password(self, client):
        client.post("/v1/auth/signup", json={"email": "c@x.com", "password": "password123"})
        ok = client.post("/v1/auth/login", json={"email": "c@x.com", "password": "password123"})
        assert ok.status_code == 200 and ok.json()["token"]
        bad = client.post("/v1/auth/login", json={"email": "c@x.com", "password": "WRONG"})
        assert bad.status_code == 401

    def test_session_token_authenticates_real_endpoints(self, client):
        tok = self._signup(client, "d@x.com")
        r = client.get("/v1/auth/me", headers=self._bearer(tok))
        assert r.status_code == 200 and r.json()["email"] == "d@x.com" and r.json()["account"] is True

    def test_cross_user_isolation(self, client):
        # The whole ballgame: A's workout must be invisible to B.
        a = self._signup(client, "alice@x.com")
        b = self._signup(client, "bob@x.com")
        client.post("/v1/coach/act", headers=self._bearer(a), json={"text": "I benched 100 for 5"})
        a_wk = client.get("/v1/logs/workouts", headers=self._bearer(a)).json()["workouts"]
        b_wk = client.get("/v1/logs/workouts", headers=self._bearer(b)).json()["workouts"]
        assert len(a_wk) == 1
        assert len(b_wk) == 0  # B cannot see A's data

    def test_memory_is_isolated(self, client):
        a = self._signup(client, "mem-a@x.com")
        b = self._signup(client, "mem-b@x.com")
        client.post("/v1/hermes/memory", headers=self._bearer(a), json={"kind": "goal", "text": "A secret goal"})
        assert len(client.get("/v1/hermes/memory", headers=self._bearer(a)).json()["memories"]) == 1
        assert len(client.get("/v1/hermes/memory", headers=self._bearer(b)).json()["memories"]) == 0

    def test_logout_invalidates_token(self, client):
        tok = self._signup(client, "e@x.com")
        assert client.get("/v1/auth/me", headers=self._bearer(tok)).status_code == 200
        client.post("/v1/auth/logout", headers=self._bearer(tok))
        assert client.get("/v1/auth/me", headers=self._bearer(tok)).status_code == 401

    def test_legacy_api_key_still_works(self, client):
        # The original single-user device + every existing test must keep working.
        r = client.get("/v1/auth/me", headers=_auth())
        assert r.status_code == 200 and r.json()["account"] is False  # owner, no account row

    def test_bad_session_token_rejected(self, client):
        assert client.get("/v1/auth/me", headers=self._bearer("not-a-real-token")).status_code == 401


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


class TestWeek1Endpoints:
    def test_wakeup_no_data(self, client):
        r = client.get("/v1/wakeup", headers=_auth())
        assert r.status_code == 200
        body = r.json()
        assert body["greeting"].startswith("Good ")
        assert body["readiness"]["has_data"] is False
        assert body["workout"] is not None  # plan shown even with no check-in
        assert body["workout"]["decision"] == "GREEN"

    def test_wakeup_respects_readiness(self, client):
        # The server stores/reads check-ins in UTC, so build "today" in UTC too —
        # otherwise this flakes across the local/UTC date boundary.
        import datetime as _dt
        today = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d")
        client.post("/v1/logs/checkins", headers=_auth(), json={
            "date": today, "sleep_min": 300, "energy_1to5": 2,
            "soreness_1to5": 4, "mood_1to5": 2, "stress_1to5": 5})
        r = client.get("/v1/wakeup", headers=_auth())
        body = r.json()
        assert body["readiness"]["has_data"] is True
        assert body["workout"]["decision"] in ("RED", "YELLOW")

    def test_custom_program_upload_and_active(self, client):
        prog = {
            "name": "varun_special", "goal": "strength", "days_per_week": 2,
            "days": [
                {"name": "Heavy", "exercises": [
                    {"id": "barbell_squat", "sets": 5, "reps": "5", "rest_s": 180}]},
                {"name": "Light", "exercises": [
                    {"id": "walk_zone2", "sets": 1, "reps": "30 min", "rest_s": 0}]},
            ],
        }
        r = client.post("/v1/programs/custom", headers=_auth(), json=prog)
        assert r.status_code == 200 and r.json()["saved"] is True
        r = client.get("/v1/programs/custom", headers=_auth())
        assert "varun_special" in r.json()["custom_programs"]
        # wake-up now serves the custom plan
        r = client.get("/v1/wakeup", headers=_auth())
        w = r.json()["workout"]
        assert w["program"] == "varun_special" and w["is_custom"] is True
        assert w["day_name"] == "Heavy"

    def test_custom_program_validation(self, client):
        r = client.post("/v1/programs/custom", headers=_auth(), json={
            "name": "bad", "days": [{"name": "X", "exercises": []}]})
        assert r.status_code == 422

    def test_momentum_empty_history(self, client):
        r = client.get("/v1/momentum/today", headers=_auth())
        assert r.status_code == 200
        body = r.json()
        assert body["best_event"] is None
        assert body["avatar"]["stage"] >= 1

    def test_momentum_pr_detected(self, client):
        # Two sessions: last week 100kg, today 110kg → PR + progress
        import datetime as dt
        from varunos import db as vdb
        uid = "test-user"
        wid1 = vdb.create_workout_log(uid, {"program": "p", "day_name": "Push",
                                            "week": 1, "day_index": 0, "decision": "GREEN"})
        last_week = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).isoformat()
        with vdb.transaction() as c:
            c.execute("UPDATE workout_log SET ts=? WHERE id=?", (last_week, wid1))
            c.execute("INSERT INTO workout_set (user_id, workout_id, exercise_id, set_index, "
                      "weight_kg, reps, ts) VALUES (?,?,?,?,?,?,?)",
                      (uid, wid1, "bench_press", 0, 100, 5, last_week))
        client.post("/v1/logs/workouts", headers=_auth(), json={
            "program": "p", "day_name": "Push", "week": 2, "day_index": 0,
            "decision": "GREEN",
            "sets": [{"exercise_id": "bench_press", "set_index": 0,
                      "weight_kg": 110, "reps": 5}]})
        r = client.get("/v1/momentum/today", headers=_auth())
        body = r.json()
        assert body["best_event"] is not None
        assert body["best_event"]["kind"] == "pr"
        kinds = {e["kind"] for e in body["events"]}
        assert "progress" in kinds

    def test_avatar_state(self, client):
        r = client.get("/v1/avatar/state", headers=_auth())
        assert r.status_code == 200
        a = r.json()["avatar"]
        assert 1 <= a["stage"] <= 5 and 0 <= a["level"] <= 100

    def test_profile_workout_pref(self, client):
        r = client.put("/v1/user/profile", headers=_auth(), json={
            "name": "Varun", "workout_time_pref": "evening", "planned_per_week": 4})
        assert r.status_code == 200
        r = client.get("/v1/wakeup", headers=_auth())
        body = r.json()
        assert body["workout_time_pref"] == "evening"
        assert body["greeting"].endswith("Varun")


class TestCoachAct:
    """The natural-language agent endpoint — plain English in, action out."""

    def test_log_weight(self, client):
        r = client.post("/v1/coach/act", json={"text": "I weigh 77 today"}, headers=_auth())
        assert r.status_code == 200
        body = r.json()
        assert body["action"] == "log_weight"
        assert "77" in body["reply"]
        # profile actually updated
        prof = client.get("/v1/user/profile", headers=_auth()).json()
        assert float(prof["profile"]["weight_kg"]) == 77

    def test_log_workout_and_pr(self, client):
        r1 = client.post("/v1/coach/act", json={"text": "benched 100 for 5"}, headers=_auth())
        assert r1.json()["action"] == "log_workout"
        assert r1.json()["pr"] is True  # first time = PR
        r2 = client.post("/v1/coach/act", json={"text": "bench 90 x 5"}, headers=_auth())
        assert r2.json()["pr"] is False  # lighter than prior best

    def test_question_routes_to_coach(self, client):
        r = client.post("/v1/coach/act", json={"text": "what should I eat tonight?"},
                        headers=_auth())
        assert r.status_code == 200
        assert r.json()["action"] == "answer"
        assert len(r.json()["reply"]) > 0

    def test_question_after_partial_profile(self, client):
        # logging weight creates a weight-only profile; a follow-up question
        # must not crash on null height/age (regression for bmr_mifflin None).
        client.post("/v1/coach/act", json={"text": "I weigh 80 today"}, headers=_auth())
        r = client.post("/v1/coach/act", json={"text": "how am I doing this week?"},
                        headers=_auth())
        assert r.status_code == 200
        assert r.json()["action"] == "answer"

    def test_no_llm_key_no_network(self, client, monkeypatch):
        # With no ANTHROPIC_API_KEY, an unparseable message must fall straight
        # to the deterministic coach narrator — never attempt a network call.
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        def _boom(*a, **k):
            raise AssertionError("network call attempted without an LLM key")
        import httpx
        monkeypatch.setattr(httpx, "post", _boom)
        r = client.post("/v1/coach/act",
                        json={"text": "ramble that is not a clear log"}, headers=_auth())
        assert r.status_code == 200
        assert r.json()["action"] == "answer"

    def test_requires_auth(self, client):
        r = client.post("/v1/coach/act", json={"text": "hi"})
        assert r.status_code in (401, 403)


class TestHealthVault:
    """The Health Vault export — your data as downloadable Markdown."""

    def test_preview_empty(self, client):
        r = client.get("/v1/vault/preview", headers=_auth())
        assert r.status_code == 200
        b = r.json()
        assert b["files"] >= 2  # README + profile always
        assert "Sarathi Health Vault" in b["sample"]

    def test_export_after_logging(self, client):
        # log a set via the agent, then the vault should contain it
        client.post("/v1/coach/act", json={"text": "I benched 100 for 5"}, headers=_auth())
        r = client.get("/v1/vault/export", headers=_auth())
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/zip"
        assert "attachment" in r.headers.get("content-disposition", "")
        import io, zipfile
        z = zipfile.ZipFile(io.BytesIO(r.content))
        names = z.namelist()
        assert any("exercises/bench_press.md" in n for n in names)
        assert any(n.endswith("README.md") for n in names)

    def test_export_requires_auth(self, client):
        assert client.get("/v1/vault/export").status_code in (401, 403)
