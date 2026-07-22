"""Retention analytics — the one chart a pre-seed investor asks for.

Pure functions over (user_id, day) activity pairs; the API layer feeds it
distinct active days from observability_event and nothing here touches the
DB or the clock.

Definitions (classic, the ones diligence expects):
  first day   = a user's earliest active day (their cohort day zero)
  Dn retained = the user was active exactly n days after their first day
  Dn rate     = retained / eligible, where a user is ELIGIBLE for Dn only if
                their first day is at least n days before `today` (young
                cohorts can't fail a test they haven't taken yet)
  DAU / WAU / MAU = distinct users active on `today` / last 7 / last 30 days
  stickiness  = DAU / MAU
  week-6 user = any activity on day 35 or later after first day — the
                graveyard test: gamified-fitness apps die in weeks 2-8.
"""
from __future__ import annotations

from datetime import date, timedelta
from collections import defaultdict

RETENTION_DAYS = (1, 7, 30)
WEEK6_OFFSET_DAYS = 35


def _parse(day: str) -> date:
    return date.fromisoformat(str(day)[:10])


def retention(rows, *, today):
    """rows: iterable of (user_id, 'YYYY-MM-DD') distinct active pairs.

    Returns the full report dict (see keys below); rates are 0..1 floats or
    None when no user is eligible for that horizon yet.
    """
    tday = _parse(today) if not isinstance(today, date) else today
    days_by_user: dict[str, set[date]] = defaultdict(set)
    for uid, day in rows:
        d = _parse(day)
        if d <= tday:
            days_by_user[str(uid)].add(d)
    users = len(days_by_user)

    first = {u: min(ds) for u, ds in days_by_user.items()}

    # classic Dn --------------------------------------------------------------
    dn = {}
    for n in RETENTION_DAYS:
        eligible = [u for u, f in first.items() if f + timedelta(days=n) <= tday]
        if not eligible:
            dn[n] = {"rate": None, "retained": 0, "eligible": 0}
            continue
        retained = sum(1 for u in eligible if first[u] + timedelta(days=n) in days_by_user[u])
        dn[n] = {"rate": retained / len(eligible), "retained": retained, "eligible": len(eligible)}

    # actives -----------------------------------------------------------------
    def active_within(days: int) -> int:
        lo = tday - timedelta(days=days - 1)
        return sum(1 for ds in days_by_user.values() if any(lo <= d <= tday for d in ds))

    dau = sum(1 for ds in days_by_user.values() if tday in ds)
    wau = active_within(7)
    mau = active_within(30)

    # the graveyard test ------------------------------------------------------
    week6 = sum(
        1 for u, ds in days_by_user.items()
        if any(d >= first[u] + timedelta(days=WEEK6_OFFSET_DAYS) for d in ds)
    )

    # weekly signup cohorts ---------------------------------------------------
    cohorts_map: dict[date, list[str]] = defaultdict(list)
    for u, f in first.items():
        cohorts_map[f - timedelta(days=f.weekday())].append(u)   # Monday of first week
    cohorts = []
    for wk in sorted(cohorts_map):
        members = cohorts_map[wk]
        row = {"week": wk.isoformat(), "size": len(members)}
        for n in RETENTION_DAYS:
            elig = [u for u in members if first[u] + timedelta(days=n) <= tday]
            row[f"d{n}"] = (
                sum(1 for u in elig if first[u] + timedelta(days=n) in days_by_user[u]) / len(elig)
                if elig else None
            )
        cohorts.append(row)

    return {
        "today": tday.isoformat(),
        "users": users,
        "d1": dn[1], "d7": dn[7], "d30": dn[30],
        "dau": dau, "wau": wau, "mau": mau,
        "stickiness": (dau / mau) if mau else None,
        "week6_users": week6,
        "cohorts": cohorts,
    }
