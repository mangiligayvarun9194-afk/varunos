"""
LLM cost guardrails — per-user + global daily budgets.

Public users run on the owner's Anthropic key, so without a cap one abusive
account can run up the bill. Every LLM call goes through `reserve(user_id)`
first: it checks the per-user and global daily quotas and, if there's budget,
records the call. Over budget → the caller degrades gracefully to its
deterministic template/None fallback (Sarathi never *needs* the LLM).

Budgets are env-configurable so the owner can lift them on their own instance:
  VARUNOS_LLM_DAILY_PER_USER  (default 50)   per-account calls/day
  VARUNOS_LLM_DAILY_GLOBAL    (default 4000)  total calls/day (kill-switch)
Set either to 0 to disable that limit.
"""

from __future__ import annotations

import os

from varunos import db

DEFAULT_PER_USER = 50
DEFAULT_GLOBAL = 4000


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def caps() -> tuple[int, int]:
    return (_int_env("VARUNOS_LLM_DAILY_PER_USER", DEFAULT_PER_USER),
            _int_env("VARUNOS_LLM_DAILY_GLOBAL", DEFAULT_GLOBAL))


def decide(per_user_today: int, global_today: int,
           per_user_cap: int, global_cap: int) -> tuple[bool, str]:
    """Pure budget decision. A cap of 0 means "no limit". Returns (allowed, reason)."""
    if global_cap and global_today >= global_cap:
        return False, "global_cap"
    if per_user_cap and per_user_today >= per_user_cap:
        return False, "per_user_cap"
    return True, "ok"


def reserve(user_id: str) -> tuple[bool, str]:
    """Gate one LLM call. Returns (allowed, reason); records the call when allowed.
    Returns (False, 'no_key') when no Anthropic key is configured — the caller
    falls back deterministically either way."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False, "no_key"
    per_cap, global_cap = caps()
    allowed, reason = decide(
        db.llm_usage_today(user_id), db.llm_usage_global_today(), per_cap, global_cap)
    if allowed:
        db.llm_usage_increment(user_id)
    return allowed, reason


def remaining(user_id: str) -> int:
    """Per-user calls left today (for surfacing in the UI)."""
    per_cap, _ = caps()
    if not per_cap:
        return 999999
    return max(0, per_cap - db.llm_usage_today(user_id))
