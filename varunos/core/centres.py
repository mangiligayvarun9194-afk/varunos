"""The Five Centres — the spine metric of Sarathi (T4 architecture §0).

For any user, compute how *awake* each element-pillar is, purely from real
recorded data. One deterministic vector feeds every surface:

    centres(...) -> { space, air, fire, water, earth : 0.0..1.0 }

  space (आकाश · memory)   — depth of the record: vault entries + days of history
  air   (वायु · motion)   — training recency and weekly cadence
  fire  (अग्नि · fuel)    — meal-logging recency and consistency
  water (आपस् · recovery) — check-in / watch-data recency
  earth (पृथ्वी · body)   — measurements present + training volume recency

Consumers: the Awakening (onboarding lights centres), Today's five-centre
strip, Hermes proactive nudges (a centre dimming), the Weekly Saga (weekly
deltas), the Twin's chakra glows, and the activation metric ("activated"
when >= 4 centres lit). Pure: no I/O, no clock reads — `now` is an argument.

Tuning: every weight/half-life is a named constant below; they are the knobs
we re-tune from real beta data without touching logic.
"""
from __future__ import annotations

from datetime import datetime, timezone

# ── tuning constants (re-tunable from beta data) ────────────────────────────
SPACE_RECORDS_FULL = 60        # vault records at which the record-depth term maxes
SPACE_DAYS_FULL = 45           # days of history at which the tenure term maxes
AIR_HALF_LIFE_H = 96.0         # training glow halves every 4 days without a session
AIR_SESSIONS_7D_FULL = 3       # sessions in the last 7 days for full cadence
FIRE_HALF_LIFE_H = 48.0        # fuel glow halves every 2 days without a meal log
FIRE_MEALS_7D_FULL = 10        # logged meals in 7 days for full consistency
WATER_HALF_LIFE_H = 36.0       # recovery glow halves every 1.5 days without a check-in
EARTH_MEASURE_WEIGHT = 0.5     # having measurements at all carries half the pillar
EARTH_HALF_LIFE_H = 168.0      # body-work glow halves every 7 days without training
LIT_AT = 0.5                   # a centre counts as "lit" at or above this
ACTIVATED_AT = 4               # lit centres needed to call the user activated


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _hours_since(ts: str | None, now: datetime) -> float | None:
    """ISO string -> hours from ts to now, tz-tolerant (naive = UTC). None on bad input."""
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0.0, (now - dt).total_seconds() / 3600.0)


def _decay(hours: float | None, half_life_h: float) -> float:
    """Exponential recency glow: 1.0 right now, halving every half_life_h."""
    if hours is None:
        return 0.0
    return _clamp01(0.5 ** (hours / half_life_h))


def centres(
    *,
    now: datetime,
    vault_records: int = 0,
    history_days: int = 0,
    last_workout_ts: str | None = None,
    workouts_7d: int = 0,
    last_meal_ts: str | None = None,
    meals_7d: int = 0,
    last_checkin_ts: str | None = None,
    has_measurements: bool = False,
) -> dict:
    """The five-centre vector from simple, honest aggregates.

    The API layer computes the aggregates from the DB; this function only
    scores them. All terms blend a *recency glow* (does the pillar live in
    the user's present?) with a *depth/cadence term* (is it a habit?).
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    # आकाश — memory: pure depth; the record does not decay (space remembers).
    space = _clamp01(
        0.6 * _clamp01(vault_records / SPACE_RECORDS_FULL)
        + 0.4 * _clamp01(history_days / SPACE_DAYS_FULL)
    )

    # वायु — motion: recent training glow + weekly cadence.
    air = _clamp01(
        0.6 * _decay(_hours_since(last_workout_ts, now), AIR_HALF_LIFE_H)
        + 0.4 * _clamp01(workouts_7d / AIR_SESSIONS_7D_FULL)
    )

    # अग्नि — fuel: recent meal glow + weekly consistency.
    fire = _clamp01(
        0.6 * _decay(_hours_since(last_meal_ts, now), FIRE_HALF_LIFE_H)
        + 0.4 * _clamp01(meals_7d / FIRE_MEALS_7D_FULL)
    )

    # आपस् — recovery: purely about the present (yesterday's rest is spent).
    water = _decay(_hours_since(last_checkin_ts, now), WATER_HALF_LIFE_H)

    # पृथ्वी — the body: the mirror exists (measurements) + it is being built.
    earth = _clamp01(
        (EARTH_MEASURE_WEIGHT if has_measurements else 0.0)
        + (1.0 - EARTH_MEASURE_WEIGHT)
        * _decay(_hours_since(last_workout_ts, now), EARTH_HALF_LIFE_H)
    )

    return {
        "space": round(space, 3),
        "air": round(air, 3),
        "fire": round(fire, 3),
        "water": round(water, 3),
        "earth": round(earth, 3),
    }


def lit(vec: dict) -> list[str]:
    """The centres currently lit (>= LIT_AT), in canonical order."""
    return [k for k in ("space", "air", "fire", "water", "earth") if vec.get(k, 0) >= LIT_AT]


def activated(vec: dict) -> bool:
    """The activation metric: 4+ centres lit."""
    return len(lit(vec)) >= ACTIVATED_AT
