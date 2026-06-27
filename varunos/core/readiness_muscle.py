"""
Per-muscle readiness — recovery-aware "what should I train today".

Pure and deterministic. Given the user's logged sets (and, optionally, today's
global recovery score), it estimates a 0-100 recovery level for each muscle
group and recommends what's ready to hit. Fully unit-testable; no DB, no clock
except what's passed in.

HONEST MODEL (this is a coaching heuristic, not lab science — there is no
per-muscle HRV): a group's recovery rises with **time since it was last
trained**, takes **longer after a heavy session** (more volume → more recovery
debt), and is **slowed when global recovery is poor** (bad sleep / low HRV).
Reuses the same muscle-keyword grouping as Strength Intelligence so a set maps
to the same group everywhere.
"""

from __future__ import annotations

from datetime import datetime, timezone

from varunos.core.strength_intel import MUSCLE_KEYWORDS, _muscle_group

GROUPS = list(MUSCLE_KEYWORDS)

BASE_RECOVERY_H = 48.0      # baseline full-recovery window for a typical session
REF_VOLUME_KG = 3000.0      # a "solid" session's top-day volume (load reference)
FRESH_AT = 80               # recovery >= this → fresh / ready
MODERATE_AT = 50            # recovery >= this → moderate


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _parse(ts: str):
    try:
        return datetime.fromisoformat((ts or "").replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _status(score: int) -> str:
    if score >= FRESH_AT:
        return "fresh"
    if score >= MODERATE_AT:
        return "moderate"
    return "fatigued"


def muscle_readiness(sets: list[dict], now=None, global_readiness=None) -> dict:
    """Per-group recovery. Returns {group: {recovery 0-100, status, hours_since,
    last_trained (YYYY-MM-DD or None), load_kg}}. Untrained groups read 100/fresh."""
    now = now or datetime.now(timezone.utc)

    # pass 1 — latest training timestamp + day per group
    last: dict[str, dict] = {}
    for s in sets:
        if not (s.get("weight_kg") and s.get("reps")):
            continue
        g = _muscle_group(s.get("exercise_id"))
        if not g:
            continue
        ts = _parse(s.get("ts"))
        if not ts:
            continue
        cur = last.get(g)
        if cur is None or ts > cur["ts"]:
            last[g] = {"ts": ts, "day": ts.date().isoformat(), "vol": 0.0}

    # pass 2 — volume on that latest day (the session that created the debt)
    for s in sets:
        if not (s.get("weight_kg") and s.get("reps")):
            continue
        g = _muscle_group(s.get("exercise_id"))
        ts = _parse(s.get("ts"))
        if not g or not ts or g not in last:
            continue
        if ts.date().isoformat() == last[g]["day"]:
            last[g]["vol"] += s["weight_kg"] * s["reps"]

    out: dict[str, dict] = {}
    for g in GROUPS:
        info = last.get(g)
        if info is None:
            out[g] = {"recovery": 100, "status": "fresh", "hours_since": None,
                      "last_trained": None, "load_kg": 0}
            continue
        hours = (now - info["ts"]).total_seconds() / 3600.0
        load = _clamp(info["vol"] / REF_VOLUME_KG, 0.0, 1.0)
        recovery_h = BASE_RECOVERY_H * (0.7 + 0.6 * load)        # heavy day → longer
        if global_readiness is not None:
            gr = _clamp(float(global_readiness), 0.0, 100.0)
            recovery_h *= 1.0 + (1.0 - gr / 100.0) * 0.4          # poor recovery → slower
        score = int(round(_clamp(100.0 * hours / recovery_h, 0.0, 100.0)))
        out[g] = {"recovery": score, "status": _status(score),
                  "hours_since": round(hours, 1), "last_trained": info["day"],
                  "load_kg": round(info["vol"])}
    return out


def recommend(readiness: dict, undertrained: list[str] | None = None) -> dict:
    """What to train today. Prefers fresh groups, nudging up the ones you've been
    under-training (from Strength Intelligence) and ones not trained in a while."""
    undertrained = undertrained or []
    ready = [g for g, v in readiness.items() if v["recovery"] >= 70]
    avoid = [g for g, v in readiness.items() if v["recovery"] < MODERATE_AT]

    def rank(g: str) -> float:
        v = readiness[g]
        return (v["recovery"]
                + (15 if g in undertrained else 0)
                + (10 if v["last_trained"] is None else 0))

    train_today = sorted(ready, key=rank, reverse=True)[:3]
    return {"train_today": train_today, "avoid": avoid}


def analyze(sets: list[dict], now=None, global_readiness=None,
            undertrained: list[str] | None = None) -> dict:
    """Full report: per-muscle recovery + a train-today recommendation."""
    muscles = muscle_readiness(sets, now=now, global_readiness=global_readiness)
    rec = recommend(muscles, undertrained=undertrained)
    fresh = sum(1 for v in muscles.values() if v["status"] == "fresh")
    return {"muscles": muscles, **rec, "fresh_count": fresh, "groups": GROUPS}
