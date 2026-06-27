"""Tests for the LLM cost guardrails (per-user + global daily budgets)."""

import pytest

from varunos.core import llm_guard
from varunos import db


@pytest.fixture
def freshdb(monkeypatch):
    db.reset_for_tests(":memory:")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    yield


class TestDecide:
    def test_under_caps_allowed(self):
        assert llm_guard.decide(0, 0, 50, 4000) == (True, "ok")

    def test_per_user_cap_blocks(self):
        ok, reason = llm_guard.decide(50, 100, 50, 4000)
        assert ok is False and reason == "per_user_cap"

    def test_global_cap_blocks_first(self):
        # global takes precedence even if the user is under their own cap
        ok, reason = llm_guard.decide(0, 4000, 50, 4000)
        assert ok is False and reason == "global_cap"

    def test_zero_cap_means_unlimited(self):
        assert llm_guard.decide(99999, 99999, 0, 0)[0] is True


class TestReserve:
    def test_no_key_returns_no_key(self, monkeypatch):
        db.reset_for_tests(":memory:")
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        assert llm_guard.reserve("u") == (False, "no_key")

    def test_caps_per_user_and_records(self, freshdb, monkeypatch):
        monkeypatch.setenv("VARUNOS_LLM_DAILY_PER_USER", "3")
        for _ in range(3):
            assert llm_guard.reserve("u1")[0] is True
        allowed, reason = llm_guard.reserve("u1")
        assert allowed is False and reason == "per_user_cap"
        assert db.llm_usage_today("u1") == 3          # blocked call not counted

    def test_users_are_isolated(self, freshdb, monkeypatch):
        monkeypatch.setenv("VARUNOS_LLM_DAILY_PER_USER", "2")
        llm_guard.reserve("a"); llm_guard.reserve("a")
        assert llm_guard.reserve("a")[0] is False      # a exhausted
        assert llm_guard.reserve("b")[0] is True        # b unaffected

    def test_global_kill_switch(self, freshdb, monkeypatch):
        monkeypatch.setenv("VARUNOS_LLM_DAILY_PER_USER", "100")
        monkeypatch.setenv("VARUNOS_LLM_DAILY_GLOBAL", "2")
        assert llm_guard.reserve("x")[0] is True
        assert llm_guard.reserve("y")[0] is True
        allowed, reason = llm_guard.reserve("z")
        assert allowed is False and reason == "global_cap"

    def test_remaining(self, freshdb, monkeypatch):
        monkeypatch.setenv("VARUNOS_LLM_DAILY_PER_USER", "5")
        llm_guard.reserve("u")
        assert llm_guard.remaining("u") == 4
