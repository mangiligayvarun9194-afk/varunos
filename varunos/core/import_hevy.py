"""
Hevy workout-history importer — pure parsing.

Turns a Hevy CSV export (the common strength-training tracker format) into
Sarathi workout sessions, ready for the DB layer to persist. Pure and
deterministic: given the same CSV text it returns the same sessions, so it is
fully unit-testable without a database.

Hevy columns:
  title, start_time, end_time, exercise_title, superset_id, set_index,
  set_type, weight_kg, reps, rpe

Rows are grouped into sessions by (title, start_time). Each Hevy exercise name
is normalised to a Sarathi exercise id so the imported volume flows into the
same per-muscle / readiness / Twin-growth machinery as natively logged sets.
Unrecognised names are slugged and kept (with their original label) rather than
dropped — honest data beats lossy data.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from typing import Optional

# Hevy display name → Sarathi exercise id (must exist in core/exercises.py so the
# muscle group always resolves). Machine variants map to their closest staple;
# this normalises *identity* a touch but keeps muscle group + volume exact, which
# is what drives readiness, insights and the Twin.
NAME_MAP = {
    "Leg Extension (Machine)": "leg_extension",
    "Calf Press (Machine)": "standing_calf_raise",
    "Leg Press (Machine)": "leg_press",
    "Lying Leg Curl (Machine)": "lying_leg_curl",
    "Rear Delt Reverse Fly (Machine)": "face_pull",
    "Triceps Pushdown": "triceps_pushdown",
    "Chest Fly (Machine)": "cable_fly",
    "Reverse Grip Lat Pulldown (Cable)": "lat_pulldown",
    "Iso-Lateral Low Row": "barbell_row",
    "Lateral Raise (Dumbbell)": "dumbbell_lateral_raise",
    "Bicep Curl (Barbell)": "barbell_curl",
    "Triceps Dip (Weighted)": "triceps_pushdown",
    "Triceps Dip": "triceps_pushdown",
    "Incline Bench Press (Smith Machine)": "incline_barbell_press",
    "Incline Bench Press (Dumbbell)": "incline_barbell_press",
    "Squat (Machine)": "barbell_back_squat",
    "Squat (Barbell)": "barbell_back_squat",
    "Deadlift (Barbell)": "barbell_deadlift",
    "Preacher Curl (Barbell)": "barbell_curl",
    "Shoulder Press (Machine Plates)": "overhead_press",
    "Standing Calf Raise (Smith)": "standing_calf_raise",
    "Bench Press (Smith Machine)": "barbell_bench_press",
}

_DATE_FORMATS = ("%d %b %Y, %H:%M", "%Y-%m-%d %H:%M:%S", "%d %B %Y, %H:%M")


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_") or "unknown"


def map_exercise(name: str) -> str:
    """Hevy name → Sarathi exercise id (mapped staple, else a stable slug)."""
    return NAME_MAP.get((name or "").strip(), _slug(name))


def _parse_dt(s: str) -> Optional[datetime]:
    s = (s or "").strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _num(s: str) -> Optional[float]:
    s = (s or "").strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_hevy_csv(text: str) -> dict:
    """Parse a Hevy CSV export into Sarathi sessions.

    Returns {"sessions": [...], "summary": {...}}. Each session:
      ts (ISO), day_name, duration_min, avg_rpe, total_volume_kg, notes, sets[]
    where each set is {exercise_id, name, set_index, weight_kg, reps, rpe}.
    Sessions are ordered oldest → newest.
    """
    reader = csv.DictReader(io.StringIO(text))
    # group rows by (title, start_time), preserving first-seen order
    groups: dict[tuple, dict] = {}
    skipped = 0
    for row in reader:
        start = (row.get("start_time") or "").strip()
        dt = _parse_dt(start)
        reps = _num(row.get("reps"))
        if dt is None or reps is None:
            skipped += 1
            continue
        key = (row.get("title") or "", start)
        g = groups.get(key)
        if g is None:
            end_dt = _parse_dt(row.get("end_time") or "")
            dur = int(round((end_dt - dt).total_seconds() / 60)) if end_dt else None
            g = groups[key] = {
                "ts": dt.replace(second=0).isoformat(),
                "_dt": dt,
                "day_name": (row.get("title") or "").strip() or "Workout",
                "duration_min": dur if (dur and dur > 0) else None,
                "notes": "Imported from Hevy",
                "sets": [],
            }
        weight = _num(row.get("weight_kg")) or 0.0
        rpe = _num(row.get("rpe"))
        name = (row.get("exercise_title") or "").strip()
        g["sets"].append({
            "exercise_id": map_exercise(name),
            "name": name,
            "set_index": int(_num(row.get("set_index")) or 0),
            "weight_kg": weight,
            "reps": int(reps),
            "rpe": rpe,
        })

    sessions = sorted(groups.values(), key=lambda s: s["_dt"])
    total_sets = 0
    for s in sessions:
        s.pop("_dt", None)
        vol = sum(x["weight_kg"] * x["reps"] for x in s["sets"])
        rpes = [x["rpe"] for x in s["sets"] if x["rpe"] is not None]
        s["total_volume_kg"] = round(vol, 1)
        s["avg_rpe"] = round(sum(rpes) / len(rpes), 1) if rpes else None
        total_sets += len(s["sets"])

    return {
        "sessions": sessions,
        "summary": {
            "sessions": len(sessions),
            "sets": total_sets,
            "rows_skipped": skipped,
            "first": sessions[0]["ts"] if sessions else None,
            "last": sessions[-1]["ts"] if sessions else None,
        },
    }
