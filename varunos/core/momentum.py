"""
Momentum engine — the motivational layer of VarunOS.

Detects week-over-week progress, training streaks, comebacks and consistency,
and computes the avatar physique level. Like everything in core/, every
function is pure and deterministic: same inputs, same outputs, auditable.

The rule that keeps hype meaningful: callers surface AT MOST ONE momentum
event per day (pick_best_event). Scarcity is the feature.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from varunos.core.workouts import best_1rm_estimate


# ---- Events -----------------------------------------------------------------

# Priority order: lower number wins when picking the single daily message.
EVENT_PRIORITY = {"pr": 0, "progress": 1, "comeback": 2, "streak": 3, "consistency": 4}


@dataclass(frozen=True)
class MomentumEvent:
    kind: str          # pr | progress | comeback | streak | consistency
    title: str         # short headline, emoji included
    detail: str        # one supporting sentence
    exercise_id: Optional[str] = None
    magnitude: float = 0.0   # e.g. kg gained, weeks of streak — for sorting ties

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "title": self.title,
            "detail": self.detail,
            "exercise_id": self.exercise_id,
            "magnitude": round(self.magnitude, 2),
        }


def _pretty(ex_id: str) -> str:
    return (ex_id or "").replace("_", " ").title()


# ---- Week-over-week progress -------------------------------------------------

def best_e1rm(sets: list[dict]) -> Optional[float]:
    """Best estimated 1RM across a list of sets ({weight_kg, reps})."""
    vals = [
        best_1rm_estimate(s["weight_kg"], s["reps"])
        for s in sets
        if s.get("weight_kg") and s.get("reps")
    ]
    return round(max(vals), 2) if vals else None


def total_volume(sets: list[dict]) -> float:
    """Total tonnage: sum of weight × reps."""
    return round(sum((s.get("weight_kg") or 0) * (s.get("reps") or 0) for s in sets), 1)


def exercise_progress(
    ex_id: str,
    this_week_sets: list[dict],
    last_week_sets: list[dict],
) -> Optional[MomentumEvent]:
    """Compare an exercise's best e1RM and volume vs last week.

    Returns a progress event if the lifter is measurably stronger, else None.
    """
    now_e1, prev_e1 = best_e1rm(this_week_sets), best_e1rm(last_week_sets)
    if now_e1 and prev_e1 and now_e1 > prev_e1 + 0.5:
        gain = now_e1 - prev_e1
        return MomentumEvent(
            kind="progress",
            title=f"💪 {_pretty(ex_id)} up {gain:.1f} kg vs last week",
            detail=f"Estimated 1RM went {prev_e1:.0f} → {now_e1:.0f} kg. That's real strength.",
            exercise_id=ex_id,
            magnitude=gain,
        )
    now_vol, prev_vol = total_volume(this_week_sets), total_volume(last_week_sets)
    if prev_vol > 0 and now_vol > prev_vol * 1.10:
        pct = (now_vol / prev_vol - 1) * 100
        return MomentumEvent(
            kind="progress",
            title=f"💪 {_pretty(ex_id)} volume +{pct:.0f}% vs last week",
            detail=f"{prev_vol:.0f} kg → {now_vol:.0f} kg total moved. Work capacity is climbing.",
            exercise_id=ex_id,
            magnitude=pct,
        )
    return None


# ---- Streaks / comeback / consistency ----------------------------------------

def _to_date(d: str) -> date:
    return date.fromisoformat(d[:10])


def weekly_streak(session_dates: list[str], today: str) -> int:
    """Consecutive ISO weeks with ≥1 session, ending at (or the week before) today."""
    if not session_dates:
        return 0
    weeks = {_to_date(d).isocalendar()[:2] for d in session_dates}
    cur = _to_date(today)
    wk = cur.isocalendar()[:2]
    # streak may end this week or last week (this week might not be trained yet)
    if wk not in weeks:
        cur = cur - timedelta(days=7)
        wk = cur.isocalendar()[:2]
        if wk not in weeks:
            return 0
    streak = 0
    while wk in weeks:
        streak += 1
        cur = cur - timedelta(days=7)
        wk = cur.isocalendar()[:2]
    return streak


def is_comeback(session_dates: list[str], today: str, gap_days: int = 7) -> bool:
    """True if today's session is the first after a gap of `gap_days`+ days."""
    past = sorted({_to_date(d) for d in session_dates if _to_date(d) < _to_date(today)})
    if not past:
        return False
    return (_to_date(today) - past[-1]).days >= gap_days


def consistency_4w(session_dates: list[str], today: str, planned_per_week: int = 3) -> float:
    """Fraction of planned sessions completed over the trailing 28 days (0..1)."""
    if planned_per_week <= 0:
        return 0.0
    start = _to_date(today) - timedelta(days=28)
    done = len({d[:10] for d in session_dates if start <= _to_date(d) <= _to_date(today)})
    return round(min(1.0, done / (planned_per_week * 4)), 3)


# ---- Avatar level -------------------------------------------------------------

def avatar_level(
    *,
    volume_trend_pct: float = 0.0,   # 4-week volume slope, % per week (-20..+20 useful range)
    streak_weeks: int = 0,
    days_since_pr: Optional[int] = None,
    consistency: float = 0.0,        # 0..1
) -> int:
    """Physique score 0–100 for the avatar. Deterministic and explainable.

    30% volume trend · 20% streak · 25% PR recency · 25% consistency.
    """
    vol = max(0.0, min(1.0, (volume_trend_pct + 5) / 15))     # -5% → 0, +10% → 1
    stk = max(0.0, min(1.0, streak_weeks / 8))                # 8-week streak maxes it
    if days_since_pr is None:
        pr = 0.0
    else:
        pr = max(0.0, min(1.0, 1 - days_since_pr / 30))       # linear decay over 30 days
    cons = max(0.0, min(1.0, consistency))
    return round(100 * (0.30 * vol + 0.20 * stk + 0.25 * pr + 0.25 * cons))


def avatar_stage(level: int) -> dict:
    """Map level 0–100 to one of 5 physique stages for the mascot."""
    stages = [
        (0, "starting", "Just getting going"),
        (20, "warming_up", "Building the habit"),
        (40, "solid", "Visibly consistent"),
        (65, "strong", "Strength is showing"),
        (85, "peak", "Peak form"),
    ]
    name, label = stages[0][1], stages[0][2]
    idx = 0
    for i, (cut, n, l) in enumerate(stages):
        if level >= cut:
            name, label, idx = n, l, i
    return {"stage": idx + 1, "name": name, "label": label, "level": level}


# ---- Assembly ----------------------------------------------------------------

def build_events(
    *,
    pr_titles: list[str],
    progress_events: list[MomentumEvent],
    session_dates: list[str],
    today: str,
    planned_per_week: int = 3,
) -> list[MomentumEvent]:
    """Collect every momentum event that fired today."""
    events: list[MomentumEvent] = []
    for t in pr_titles:
        events.append(MomentumEvent(
            kind="pr",
            title=f"🏆 New PR: {t}",
            detail="All-time best. This is what progress looks like.",
            magnitude=100,
        ))
    events.extend(progress_events)
    if is_comeback(session_dates, today):
        events.append(MomentumEvent(
            kind="comeback",
            title="👊 Welcome back",
            detail="First session after a break — showing up again is the hard part. Plan eased for today.",
        ))
    stk = weekly_streak(session_dates, today)
    if stk >= 2:
        events.append(MomentumEvent(
            kind="streak",
            title=f"🔥 {stk}-week training streak",
            detail="Consistency beats intensity. Keep the chain unbroken.",
            magnitude=stk,
        ))
    cons = consistency_4w(session_dates, today, planned_per_week)
    if cons >= 0.8 and len(session_dates) >= 8:
        events.append(MomentumEvent(
            kind="consistency",
            title=f"📈 {round(cons * 100)}% plan adherence over 4 weeks",
            detail="You're outworking most gym memberships. The results are compounding.",
            magnitude=cons * 100,
        ))
    return events


def pick_best_event(events: list[MomentumEvent]) -> Optional[MomentumEvent]:
    """ONE event per day. Highest priority kind wins; magnitude breaks ties."""
    if not events:
        return None
    return sorted(events, key=lambda e: (EVENT_PRIORITY.get(e.kind, 9), -e.magnitude))[0]
