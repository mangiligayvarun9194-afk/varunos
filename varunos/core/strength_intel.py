"""
Strength Intelligence — pure analytics over logged sets.

Turns raw logged sets into honest coaching signal: per-lift estimated-1RM
trends, stalled-lift detection, recent PRs, and muscle-group balance. Pure and
deterministic (no DB, no clock except what's passed in), so every judgement is
unit-testable with synthetic histories.

Design honesty:
  • Estimated 1RM is only computed for sets in a real strength range (reps 1-12);
    1RM formulas blow up for 30-rep machine sets, so those fall back to a
    top-set *volume* trend instead of a fake strength number.
  • A trend needs real time depth (>= ~3 weeks) before it will say "stalled",
    so a couple of close sessions never trigger a false alarm.
  • Nothing is fabricated: no data → empty lists, not filler.
"""

from __future__ import annotations

from datetime import date

from varunos.core.workouts import best_1rm_estimate

# Same grouping the avatar/readiness use (kept local to keep this module pure).
MUSCLE_KEYWORDS = {
    "legs": ("squat", "leg", "lunge", "deadlift", "rdl", "calf", "glute", "hip"),
    "chest": ("bench", "chest", "fly", "dip", "push_up", "pushup"),
    "back": ("row", "pull", "lat", "chin", "deadlift"),
    "shoulders": ("overhead", "ohp", "shoulder", "lateral", "raise", "press"),
    "arms": ("curl", "tricep", "extension", "pushdown", "skull"),
    "core": ("plank", "crunch", "ab", "situp", "leg_raise"),
}

_MIN_TREND_DAYS = 21       # need this much history before calling a stall
_FLAT_PCT = 2.0            # +/- this % counts as "no real change"


def _date_str(ts: str) -> str:
    return (ts or "")[:10]


def _days_between(d1: str, d2: str) -> int:
    try:
        a = date.fromisoformat(d1)
        b = date.fromisoformat(d2)
        return abs((b - a).days)
    except ValueError:
        return 0


def _e1rm(weight, reps):
    """Estimated 1RM, only for a sane strength range (else None)."""
    if not weight or not reps or reps < 1 or reps > 12:
        return None
    try:
        return round(best_1rm_estimate(weight, reps), 1)
    except (ValueError, ZeroDivisionError):
        return None


def _muscle_group(exercise_id: str):
    ex = (exercise_id or "").lower()
    for g, kws in MUSCLE_KEYWORDS.items():
        if any(k in ex for k in kws):
            return g
    return None


def _sessions_for(sets: list[dict]) -> list[dict]:
    """Collapse sets into per-day bests: {date, e1rm, top_volume, top_weight}."""
    by: dict[str, dict] = {}
    for s in sets:
        w, r = s.get("weight_kg"), s.get("reps")
        if not w or not r:
            continue
        d = _date_str(s.get("ts"))
        cur = by.setdefault(d, {"date": d, "e1rm": None, "top_volume": 0.0, "top_weight": 0.0})
        e = _e1rm(w, r)
        if e is not None:
            cur["e1rm"] = max(cur["e1rm"] or 0.0, e)
        cur["top_volume"] = max(cur["top_volume"], w * r)
        cur["top_weight"] = max(cur["top_weight"], w)
    return [by[d] for d in sorted(by)]


def _trend(sessions: list[dict], metric: str) -> dict:
    pts = [(s["date"], s[metric]) for s in sessions if s.get(metric)]
    if len(pts) < 2:
        return {"status": "new", "pct": None, "current": pts[-1][1] if pts else None,
                "peak": pts[-1][1] if pts else None, "span_days": 0}
    last_date, last = pts[-1]
    peak = max(v for _, v in pts)
    # baseline = the most recent point at least _MIN_TREND_DAYS before the last
    base = pts[0]
    for d, v in pts:
        if _days_between(d, last_date) >= _MIN_TREND_DAYS:
            base = (d, v)
    span = _days_between(base[0], last_date)
    pct = round((last - base[1]) / base[1] * 100, 1) if base[1] else 0.0
    if pct > _FLAT_PCT:
        status = "progressing"
    elif pct < -_FLAT_PCT:
        status = "declining"
    else:
        status = "stalled" if span >= _MIN_TREND_DAYS else "holding"
    return {"status": status, "pct": pct, "current": round(last, 1),
            "peak": round(peak, 1), "span_days": span,
            "at_peak": last >= peak}


def per_exercise(sets: list[dict], name_of=None) -> list[dict]:
    """One trend record per exercise, richest-history first."""
    by_ex: dict[str, list] = {}
    for s in sets:
        by_ex.setdefault(s.get("exercise_id") or "?", []).append(s)
    out = []
    for ex_id, ex_sets in by_ex.items():
        sessions = _sessions_for(ex_sets)
        if not sessions:
            continue
        metric = "e1rm" if any(s.get("e1rm") for s in sessions) else "top_volume"
        t = _trend(sessions, metric)
        out.append({
            "exercise_id": ex_id,
            "name": (name_of(ex_id) if name_of else None) or ex_id,
            "group": _muscle_group(ex_id),
            "metric": metric,            # 'e1rm' (kg) or 'top_volume' (kg)
            "sessions": len(sessions),
            "last_date": sessions[-1]["date"],
            **t,
        })
    out.sort(key=lambda r: r["sessions"], reverse=True)
    return out


def muscle_balance(sets: list[dict]) -> dict:
    vol = {g: 0.0 for g in MUSCLE_KEYWORDS}
    for s in sets:
        w, r = s.get("weight_kg"), s.get("reps")
        if not w or not r:
            continue
        g = _muscle_group(s.get("exercise_id"))
        if g:
            vol[g] += w * r
    total = sum(vol.values())
    shares = {g: (round(v / total * 100, 1) if total else 0.0) for g, v in vol.items()}
    trained = [g for g in vol if vol[g] > 0]
    mean = (sum(shares[g] for g in trained) / len(trained)) if trained else 0.0
    # undertrained = trained but well below the average emphasis
    undertrained = sorted([g for g in trained if shares[g] < 0.6 * mean],
                          key=lambda g: shares[g])
    neglected = [g for g in vol if vol[g] == 0]
    return {"shares": shares, "undertrained": undertrained, "neglected": neglected}


def analyze(sets: list[dict], name_of=None) -> dict:
    """Full strength report from a user's logged sets (oldest→newest agnostic)."""
    exercises = per_exercise(sets, name_of=name_of)
    balance = muscle_balance(sets)
    progressing = sorted([e for e in exercises if e["status"] == "progressing"],
                         key=lambda e: e["pct"] or 0, reverse=True)
    stalled = sorted([e for e in exercises if e["status"] in ("stalled", "declining")],
                     key=lambda e: e["span_days"], reverse=True)
    prs = [e for e in exercises if e.get("at_peak") and (e["pct"] or 0) > _FLAT_PCT
           and e["metric"] == "e1rm"]
    dates = sorted({_date_str(s.get("ts")) for s in sets if s.get("ts")})
    return {
        "exercises": exercises,
        "muscle_balance": balance,
        "highlights": {
            "progressing": progressing[:3],
            "stalled": stalled[:3],
            "prs": prs[:3],
            "undertrained": balance["undertrained"][:2],
            "neglected": balance["neglected"],
        },
        "totals": {
            "exercises": len(exercises),
            "sessions": len(dates),
            "first": dates[0] if dates else None,
            "last": dates[-1] if dates else None,
        },
    }
