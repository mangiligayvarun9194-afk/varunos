"""Tests for Telegram notification integration and push endpoints."""

from __future__ import annotations

import datetime as dt
import urllib.error

from fastapi.testclient import TestClient


def _auth(token: str = "test-secret-key-12345") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class _FakeResponse:
    def __init__(self, body: bytes):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return self.body


def test_send_telegram_false_when_unconfigured(monkeypatch):
    from varunos import notify

    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)

    assert notify.telegram_configured() is False
    assert notify.send_telegram("hello") is False


def test_send_telegram_posts_form_payload(monkeypatch):
    from varunos import notify

    captured = {}

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["body"] = req.data.decode("utf-8")
        captured["timeout"] = timeout
        return _FakeResponse(b'{"ok": true}')

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token-123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "chat-456")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    assert notify.send_telegram("VarunOS is connected") is True
    assert captured["url"] == "https://api.telegram.org/bottoken-123/sendMessage"
    assert "chat_id=chat-456" in captured["body"]
    assert "text=VarunOS+is+connected" in captured["body"]
    assert captured["timeout"] == 10


def test_send_telegram_never_raises_on_network_error(monkeypatch):
    from varunos import notify

    def fake_urlopen(_req, _timeout):
        raise urllib.error.URLError("down")

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token-123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "chat-456")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    assert notify.send_telegram("hello") is False


def test_notify_endpoints_require_auth(monkeypatch):
    monkeypatch.setenv("VARUNOS_API_KEY", "test-secret-key-12345")
    monkeypatch.setenv("VARUNOS_USER_ID", "test-user")
    from varunos import db
    from varunos.api.server import app

    db.reset_for_tests(":memory:")
    with TestClient(app) as client:
        assert client.post("/v1/notify/test").status_code == 401
        assert client.post("/v1/momentum/push").status_code == 401


def test_notify_test_reports_configured_and_sent(monkeypatch):
    monkeypatch.setenv("VARUNOS_API_KEY", "test-secret-key-12345")
    monkeypatch.setenv("VARUNOS_USER_ID", "test-user")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token-123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "chat-456")
    monkeypatch.setattr("varunos.notify.send_telegram", lambda text: text == "VarunOS is connected")

    from varunos import db
    from varunos.api.server import app

    db.reset_for_tests(":memory:")
    with TestClient(app) as client:
        r = client.post("/v1/notify/test", headers=_auth())

    assert r.status_code == 200
    assert r.json() == {"configured": True, "sent": True}


def test_momentum_push_once_per_day(monkeypatch):
    monkeypatch.setenv("VARUNOS_API_KEY", "test-secret-key-12345")
    monkeypatch.setenv("VARUNOS_USER_ID", "test-user")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "token-123")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "chat-456")

    sent_messages = []
    monkeypatch.setattr("varunos.notify.send_telegram", lambda text: sent_messages.append(text) or True)

    from varunos import db
    from varunos.api.server import app

    db.reset_for_tests(":memory:")
    uid = "test-user"
    wid1 = db.create_workout_log(uid, {"program": "p", "day_name": "Push",
                                       "week": 1, "day_index": 0, "decision": "GREEN"})
    last_week = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).isoformat()
    with db.transaction() as c:
        c.execute("UPDATE workout_log SET ts=? WHERE id=?", (last_week, wid1))
        c.execute(
            "INSERT INTO workout_set (user_id, workout_id, exercise_id, set_index, "
            "weight_kg, reps, ts) VALUES (?,?,?,?,?,?,?)",
            (uid, wid1, "bench_press", 0, 100, 5, last_week),
        )

    with TestClient(app) as client:
        client.post("/v1/logs/workouts", headers=_auth(), json={
            "program": "p", "day_name": "Push", "week": 2, "day_index": 0,
            "decision": "GREEN",
            "sets": [{"exercise_id": "bench_press", "set_index": 0,
                      "weight_kg": 110, "reps": 5}],
        })
        first = client.post("/v1/momentum/push", headers=_auth())
        second = client.post("/v1/momentum/push", headers=_auth())

    assert first.status_code == 200
    assert first.json()["pushed"] is True
    assert first.json()["already_pushed"] is False
    assert first.json()["event"]["kind"] == "pr"
    assert second.status_code == 200
    assert second.json()["pushed"] is False
    assert second.json()["already_pushed"] is True
    assert len(sent_messages) == 1
    assert len(db.list_events(uid, kind="momentum_pushed")) == 1
