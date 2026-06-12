"""
VarunOS SQLite persistence layer.

Single-file SQLite database at VARUNOS_DB_PATH (default: ./varunos.db).
Schema migrations are applied on import. No Alembic — this is MVP.

Tables:
  - user_profile         (1 row per user, by user_id)
  - daily_checkin        (1 row per day, per user)
  - workout_log          (workout sessions)
  - workout_set          (individual sets)
  - meal_log             (logged meals)
  - health_reading       (BP, glucose — only written if surveillance is consented)
  - surveillance_consent (per-user opt-in)
  - observability_event  (log of events for the orchestration layer)
  - alert_ack            (acknowledgement state for critical alerts)

All writes are pure SQL. Reads return dicts.

NOTE: this is plain SQLite. The "encrypted medical vault" promise in
docs/SAFETY_RAILS.md is the next-step SQLCipher upgrade. For MVP, the
medical tables are *separated* (health_reading vs workout_log) so we
can later encrypt just that one without rewriting the rest of the app.
"""

from __future__ import annotations
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


_DB_PATH = os.environ.get("VARUNOS_DB_PATH", "varunos.db")
_lock = threading.Lock()


def _path() -> Path:
    p = Path(_DB_PATH)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_path(), check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


_CONN: sqlite3.Connection | None = None


def conn() -> sqlite3.Connection:
    global _CONN
    if _CONN is None:
        _CONN = _connect()
        _migrate(_CONN)
    return _CONN


def reset_for_tests(path: str = ":memory:") -> None:
    """Reset the DB to a fresh in-memory instance. For tests only."""
    global _CONN, _DB_PATH
    _DB_PATH = path
    if _CONN is not None:
        try:
            _CONN.close()
        except Exception:
            pass
    _CONN = None
    conn()


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """Atomic write context. Acquires the global lock."""
    with _lock:
        c = conn()
        c.execute("BEGIN")
        try:
            yield c
        except Exception:
            c.execute("ROLLBACK")
            raise
        else:
            c.execute("COMMIT")


def _migrate(c: sqlite3.Connection) -> None:
    """Apply schema migrations. Idempotent. Safe to call repeatedly."""
    c.executescript("""
    CREATE TABLE IF NOT EXISTS user_profile (
        user_id          TEXT PRIMARY KEY,
        name             TEXT,
        sex              TEXT,
        age              REAL,
        height_cm        REAL,
        weight_kg        REAL,
        activity         TEXT,
        goal             TEXT,
        surveillance_on  INTEGER DEFAULT 0,
        surveillance_consented_at TEXT,
        api_key_hash     TEXT,
        updated_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_checkin (
        user_id            TEXT,
        date               TEXT,
        hrv_today_ms       REAL,
        hrv_7d_baseline_ms REAL,
        rhr_today_bpm      REAL,
        rhr_30d_baseline_bpm REAL,
        sleep_min          INTEGER,
        sleep_deep_pct     REAL,
        sleep_rem_pct      REAL,
        sleep_eff_pct      REAL,
        sleep_continuity_min INTEGER DEFAULT 0,
        energy_1to5        INTEGER,
        soreness_1to5      INTEGER,
        mood_1to5          INTEGER,
        stress_1to5        INTEGER,
        hunger_1to5        INTEGER,
        acute_load         REAL,
        chronic_load       REAL,
        notes              TEXT,
        updated_at         TEXT,
        PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS workout_log (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       TEXT,
        ts            TEXT,
        program       TEXT,
        day_name      TEXT,
        week          INTEGER,
        day_index     INTEGER,
        decision      TEXT,
        duration_min  INTEGER,
        avg_rpe       REAL,
        total_volume_kg REAL,
        notes         TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_set (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        workout_id  INTEGER REFERENCES workout_log(id) ON DELETE CASCADE,
        exercise_id TEXT,
        set_index   INTEGER,
        weight_kg   REAL,
        reps        INTEGER,
        rpe         REAL,
        tempo       TEXT,
        rest_s      INTEGER,
        ts          TEXT
    );

    CREATE TABLE IF NOT EXISTS meal_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT,
        ts         TEXT,
        food_id    TEXT,
        portions   REAL,
        kcal       REAL,
        p_g        REAL,
        c_g        REAL,
        f_g        REAL,
        context    TEXT
    );

    CREATE TABLE IF NOT EXISTS health_reading (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        ts          TEXT,
        kind        TEXT,    -- 'bp' | 'glucose' | 'heart_rate' | 'spo2' | 'weight'
        value_json  TEXT,    -- raw value (e.g. {"sbp":120,"dbp":80} or {"mgdl":95})
        unit        TEXT,
        source      TEXT,
        tier        TEXT,    -- LOW | ELEVATED | HIGH | CRITICAL
        tier_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_health_user_ts ON health_reading(user_id, ts);

    CREATE TABLE IF NOT EXISTS observability_event (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        ts         TEXT,
        user_id    TEXT,
        kind       TEXT,    -- 'briefing_sent' | 'tier_change' | 'escalation' | 'workout_logged' | ...
        channel    TEXT,
        payload    TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_obs_user_ts ON observability_event(user_id, ts);

    CREATE TABLE IF NOT EXISTS alert_ack (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id      TEXT,
        user_id       TEXT,
        created_at    TEXT,
        acknowledged  INTEGER DEFAULT 0,
        acked_at      TEXT,
        acked_via     TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_ack_event ON alert_ack(event_id);

    -- The spine: append-only canonical health event log (all sources)
    CREATE TABLE IF NOT EXISTS health_event (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        ts          TEXT,
        ingested_at TEXT,
        source      TEXT,
        device      TEXT,
        kind        TEXT,
        value_json  TEXT,
        unit        TEXT,
        confidence  REAL,
        dedup_key   TEXT UNIQUE
    );
    CREATE INDEX IF NOT EXISTS ix_hevent_user_kind_ts ON health_event(user_id, kind, ts);

    -- OAuth tokens for cloud wearable connectors (Fitbit / Oura / Whoop)
    CREATE TABLE IF NOT EXISTS oauth_token (
        user_id       TEXT,
        provider      TEXT,
        access_token  TEXT,
        refresh_token TEXT,
        expires_at    TEXT,
        scope         TEXT,
        updated_at    TEXT,
        PRIMARY KEY (user_id, provider)
    );

    -- User-uploaded training programs (same JSON schema as data/programs/*.json)
    CREATE TABLE IF NOT EXISTS custom_program (
        user_id     TEXT,
        name        TEXT,
        program_json TEXT,
        created_at  TEXT,
        PRIMARY KEY (user_id, name)
    );
    """)
    # Additive migrations for wearable sync (idempotent; ALTER only if missing)
    _ensure_columns(c, "daily_checkin", {
        "steps": "INTEGER",
        "active_kcal": "REAL",
        "spo2": "REAL",
        "resting_hr": "REAL",
        "wearable_source": "TEXT",
        "synced_at": "TEXT",
    })
    _ensure_columns(c, "user_profile", {
        "lat": "REAL", "lon": "REAL", "city": "TEXT",
        "workout_time_pref": "TEXT",      # morning | evening | flexible
        "active_program": "TEXT",         # built-in name or custom program name
        "planned_per_week": "INTEGER",    # sessions/week target for consistency math
    })


def _ensure_columns(c: sqlite3.Connection, table: str, cols: dict[str, str]) -> None:
    """Add columns to an existing table if they don't already exist."""
    existing = {row["name"] for row in c.execute(f"PRAGMA table_info({table})").fetchall()}
    for name, decl in cols.items():
        if name not in existing:
            c.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")


# ========== PROFILE ==========

def get_profile(user_id: str) -> dict | None:
    row = conn().execute("SELECT * FROM user_profile WHERE user_id=?", (user_id,)).fetchone()
    if not row:
        return None
    return dict(row)


def upsert_profile(user_id: str, data: dict) -> dict:
    """Insert or update the user profile. Partial updates merge with existing data."""
    fields = ["name", "sex", "age", "height_cm", "weight_kg", "activity", "goal",
              "lat", "lon", "city", "workout_time_pref", "active_program",
              "planned_per_week"]
    with transaction() as c:
        existing = c.execute("SELECT * FROM user_profile WHERE user_id=?", (user_id,)).fetchone()
        if existing:
            provided = {f: data[f] for f in fields if f in data and data[f] is not None}
            if provided:
                sets = ", ".join(f"{f}=?" for f in provided)
                vals = list(provided.values())
                c.execute(
                    f"UPDATE user_profile SET {sets}, updated_at=? WHERE user_id=?",
                    (*vals, _now(), user_id),
                )
        else:
            cols = ", ".join(["user_id", *fields, "updated_at"])
            placeholders = ", ".join("?" for _ in range(len(fields) + 2))
            vals = [user_id, *(data.get(f) for f in fields), _now()]
            c.execute(
                f"INSERT INTO user_profile ({cols}) VALUES ({placeholders})",
                vals,
            )
    return get_profile(user_id) or {}


# ========== SURVEILLANCE CONSENT ==========

def get_surveillance_consent(user_id: str) -> bool:
    row = conn().execute(
        "SELECT surveillance_on FROM user_profile WHERE user_id=?", (user_id,)
    ).fetchone()
    return bool(row and row["surveillance_on"])


def set_surveillance_consent(user_id: str, on: bool) -> dict:
    """Set the surveillance_on flag. Creates a minimal profile row if needed."""
    with transaction() as c:
        existing = c.execute("SELECT 1 FROM user_profile WHERE user_id=?",
                             (user_id,)).fetchone()
        if existing:
            c.execute(
                "UPDATE user_profile SET surveillance_on=?, surveillance_consented_at=?, updated_at=? "
                "WHERE user_id=?",
                (1 if on else 0, _now() if on else None, _now(), user_id),
            )
        else:
            c.execute(
                "INSERT INTO user_profile (user_id, surveillance_on, surveillance_consented_at, updated_at) "
                "VALUES (?,?,?,?)",
                (user_id, 1 if on else 0, _now() if on else None, _now()),
            )
    row = conn().execute(
        "SELECT surveillance_consented_at FROM user_profile WHERE user_id=?",
        (user_id,),
    ).fetchone()
    return {
        "user_id": user_id,
        "surveillance_on": get_surveillance_consent(user_id),
        "consented_at": row["surveillance_consented_at"] if row else None,
    }


def require_surveillance_consent(user_id: str) -> None:
    """Raise PermissionError if the user has not opted in."""
    if not get_surveillance_consent(user_id):
        raise PermissionError(
            f"Surveillance is off for user {user_id}. Set surveillance_on=true first."
        )


# ========== DAILY CHECKIN ==========

def upsert_checkin(user_id: str, date: str, data: dict) -> dict:
    fields = [
        "hrv_today_ms", "hrv_7d_baseline_ms", "rhr_today_bpm", "rhr_30d_baseline_bpm",
        "sleep_min", "sleep_deep_pct", "sleep_rem_pct", "sleep_eff_pct", "sleep_continuity_min",
        "energy_1to5", "soreness_1to5", "mood_1to5", "stress_1to5", "hunger_1to5",
        "acute_load", "chronic_load", "notes",
    ]
    with transaction() as c:
        existing = c.execute(
            "SELECT 1 FROM daily_checkin WHERE user_id=? AND date=?", (user_id, date)
        ).fetchone()
        if existing:
            sets = ", ".join(f"{f}=?" for f in fields)
            vals = [data.get(f) for f in fields]
            c.execute(
                f"UPDATE daily_checkin SET {sets}, updated_at=? WHERE user_id=? AND date=?",
                (*vals, _now(), user_id, date),
            )
        else:
            cols = "user_id, date, " + ", ".join(fields) + ", updated_at"
            placeholders = ", ".join("?" for _ in range(len(fields) + 3))
            vals = [user_id, date, *(data.get(f) for f in fields), _now()]
            c.execute(
                f"INSERT INTO daily_checkin ({cols}) VALUES ({placeholders})", vals
            )
    return get_checkin(user_id, date) or {}


def get_checkin(user_id: str, date: str) -> dict | None:
    row = conn().execute(
        "SELECT * FROM daily_checkin WHERE user_id=? AND date=?", (user_id, date)
    ).fetchone()
    return dict(row) if row else None


def save_oauth_token(user_id: str, provider: str, *, access_token: str,
                     refresh_token: str | None, expires_at: str | None,
                     scope: str | None) -> None:
    with transaction() as c:
        c.execute(
            "INSERT INTO oauth_token (user_id, provider, access_token, refresh_token, "
            "expires_at, scope, updated_at) VALUES (?,?,?,?,?,?,?) "
            "ON CONFLICT(user_id, provider) DO UPDATE SET "
            "access_token=excluded.access_token, refresh_token=excluded.refresh_token, "
            "expires_at=excluded.expires_at, scope=excluded.scope, updated_at=excluded.updated_at",
            (user_id, provider, access_token, refresh_token, expires_at, scope, _now()),
        )


def get_oauth_token(user_id: str, provider: str) -> dict | None:
    row = conn().execute(
        "SELECT * FROM oauth_token WHERE user_id=? AND provider=?", (user_id, provider)
    ).fetchone()
    return dict(row) if row else None


def list_connected_providers(user_id: str) -> list[str]:
    rows = conn().execute(
        "SELECT provider FROM oauth_token WHERE user_id=?", (user_id,)).fetchall()
    return [r["provider"] for r in rows]


def add_health_event(user_id: str, kind: str, value: dict, *, source: str,
                     ts: str | None = None, device: str | None = None,
                     unit: str = "", confidence: float = 1.0) -> int | None:
    """Append a canonical health event. Idempotent via dedup_key.

    Returns the row id, or None if it was a duplicate (already ingested).
    """
    ts = ts or _now()
    dedup = f"{source}:{kind}:{ts}"
    try:
        with transaction() as c:
            cur = c.execute(
                "INSERT INTO health_event (user_id, ts, ingested_at, source, device, "
                "kind, value_json, unit, confidence, dedup_key) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (user_id, ts, _now(), source, device, kind,
                 json.dumps(value), unit, confidence, dedup),
            )
            return cur.lastrowid
    except sqlite3.IntegrityError:
        return None  # duplicate — already have this exact reading


def list_health_events(user_id: str, kind: str | None = None, limit: int = 200) -> list[dict]:
    if kind:
        rows = conn().execute(
            "SELECT * FROM health_event WHERE user_id=? AND kind=? ORDER BY ts DESC LIMIT ?",
            (user_id, kind, limit)).fetchall()
    else:
        rows = conn().execute(
            "SELECT * FROM health_event WHERE user_id=? ORDER BY ts DESC LIMIT ?",
            (user_id, limit)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["value"] = json.loads(d.pop("value_json"))
        except Exception:
            d["value"] = None
        out.append(d)
    return out


def list_checkins(user_id: str, days: int = 60) -> list[dict]:
    """Recent daily check-ins, oldest→newest, for the insight engine."""
    rows = conn().execute(
        "SELECT * FROM daily_checkin WHERE user_id=? ORDER BY date DESC LIMIT ?",
        (user_id, days),
    ).fetchall()
    return [dict(r) for r in reversed(rows)]


def hrv_baseline(user_id: str, before_date: str, days: int = 7) -> float | None:
    """Rolling average of HRV over the last `days` check-ins before `before_date`."""
    rows = conn().execute(
        "SELECT hrv_today_ms FROM daily_checkin "
        "WHERE user_id=? AND date < ? AND hrv_today_ms IS NOT NULL "
        "ORDER BY date DESC LIMIT ?",
        (user_id, before_date, days),
    ).fetchall()
    vals = [r["hrv_today_ms"] for r in rows if r["hrv_today_ms"]]
    return round(sum(vals) / len(vals), 1) if vals else None


def rhr_baseline(user_id: str, before_date: str, days: int = 30) -> float | None:
    """Rolling average of resting HR over the last `days` check-ins before `before_date`."""
    rows = conn().execute(
        "SELECT rhr_today_bpm FROM daily_checkin "
        "WHERE user_id=? AND date < ? AND rhr_today_bpm IS NOT NULL "
        "ORDER BY date DESC LIMIT ?",
        (user_id, before_date, days),
    ).fetchall()
    vals = [r["rhr_today_bpm"] for r in rows if r["rhr_today_bpm"]]
    return round(sum(vals) / len(vals), 1) if vals else None


def merge_checkin(user_id: str, date: str, data: dict) -> dict:
    """Upsert that MERGES — only overwrites the fields provided (non-None).

    Lets a wearable sync add HRV/sleep without wiping a manual mood check-in,
    and vice-versa. Returns the full merged row.
    """
    allowed = {
        "hrv_today_ms", "hrv_7d_baseline_ms", "rhr_today_bpm", "rhr_30d_baseline_bpm",
        "sleep_min", "sleep_deep_pct", "sleep_rem_pct", "sleep_eff_pct", "sleep_continuity_min",
        "energy_1to5", "soreness_1to5", "mood_1to5", "stress_1to5", "hunger_1to5",
        "acute_load", "chronic_load", "notes",
        "steps", "active_kcal", "spo2", "resting_hr", "wearable_source", "synced_at",
    }
    provided = {k: v for k, v in data.items() if k in allowed and v is not None}
    with transaction() as c:
        exists = c.execute("SELECT 1 FROM daily_checkin WHERE user_id=? AND date=?",
                           (user_id, date)).fetchone()
        if exists:
            if provided:
                sets = ", ".join(f"{k}=?" for k in provided)
                c.execute(f"UPDATE daily_checkin SET {sets}, updated_at=? WHERE user_id=? AND date=?",
                          (*provided.values(), _now(), user_id, date))
        else:
            cols = ", ".join(["user_id", "date", *provided.keys(), "updated_at"])
            ph = ", ".join("?" for _ in range(len(provided) + 3))
            c.execute(f"INSERT INTO daily_checkin ({cols}) VALUES ({ph})",
                      (user_id, date, *provided.values(), _now()))
    return get_checkin(user_id, date) or {}


# ========== WORKOUT LOG ==========

def create_workout_log(user_id: str, data: dict) -> int:
    with transaction() as c:
        cur = c.execute(
            "INSERT INTO workout_log (user_id, ts, program, day_name, week, day_index, decision, "
            "duration_min, avg_rpe, total_volume_kg, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (user_id, _now(), data.get("program"), data.get("day_name"),
             data.get("week"), data.get("day_index"), data.get("decision"),
             data.get("duration_min"), data.get("avg_rpe"),
             data.get("total_volume_kg"), data.get("notes")),
        )
        return cur.lastrowid


def add_set(user_id: str, workout_id: int, ex_id: str, set_idx: int,
            weight_kg: float, reps: int, rpe: float | None) -> int:
    with transaction() as c:
        cur = c.execute(
            "INSERT INTO workout_set (user_id, workout_id, exercise_id, set_index, weight_kg, "
            "reps, rpe, ts) VALUES (?,?,?,?,?,?,?,?)",
            (user_id, workout_id, ex_id, set_idx, weight_kg, reps, rpe, _now()),
        )
        return cur.lastrowid


def list_workout_logs(user_id: str, limit: int = 20) -> list[dict]:
    rows = conn().execute(
        "SELECT * FROM workout_log WHERE user_id=? ORDER BY ts DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def list_sets_since(user_id: str, since_iso: str) -> list[dict]:
    """All logged sets since a timestamp, oldest→newest. Fuel for the momentum engine."""
    rows = conn().execute(
        "SELECT exercise_id, weight_kg, reps, rpe, ts FROM workout_set "
        "WHERE user_id=? AND ts >= ? ORDER BY ts ASC",
        (user_id, since_iso),
    ).fetchall()
    return [dict(r) for r in rows]


def list_workout_dates(user_id: str, days: int = 120) -> list[str]:
    """Distinct YYYY-MM-DD dates with at least one workout session, oldest→newest."""
    rows = conn().execute(
        "SELECT DISTINCT substr(ts, 1, 10) AS d FROM workout_log "
        "WHERE user_id=? ORDER BY d DESC LIMIT ?",
        (user_id, days),
    ).fetchall()
    return [r["d"] for r in reversed(rows)]


# ========== CUSTOM PROGRAMS ==========

def save_custom_program(user_id: str, name: str, program_json: str) -> None:
    with transaction() as c:
        c.execute(
            "INSERT INTO custom_program (user_id, name, program_json, created_at) "
            "VALUES (?,?,?,?) ON CONFLICT(user_id, name) DO UPDATE SET "
            "program_json=excluded.program_json, created_at=excluded.created_at",
            (user_id, name, program_json, _now()),
        )


def get_custom_program(user_id: str, name: str) -> dict | None:
    row = conn().execute(
        "SELECT program_json FROM custom_program WHERE user_id=? AND name=?",
        (user_id, name),
    ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["program_json"])
    except Exception:
        return None


def list_custom_programs(user_id: str) -> list[str]:
    rows = conn().execute(
        "SELECT name FROM custom_program WHERE user_id=? ORDER BY name", (user_id,)
    ).fetchall()
    return [r["name"] for r in rows]


# ========== MEAL LOG ==========

def add_meal(user_id: str, food_id: str, portions: float,
             kcal: float, p: float, c: float, f: float, context: str = "") -> int:
    # NOTE: carbs and fat are named `c` and `f` to keep callers short,
    # so we name the connection variable `cn` to avoid a shadowing bug
    # where sqlite would try to bind the connection object as parameter #7.
    with transaction() as cn:
        cur = cn.execute(
            "INSERT INTO meal_log (user_id, ts, food_id, portions, kcal, p_g, c_g, f_g, context) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (user_id, _now(), food_id, portions, kcal, p, c, f, context),
        )
        return cur.lastrowid


def list_meals(user_id: str, since_iso: str | None = None) -> list[dict]:
    if since_iso:
        rows = conn().execute(
            "SELECT * FROM meal_log WHERE user_id=? AND ts >= ? ORDER BY ts DESC",
            (user_id, since_iso),
        ).fetchall()
    else:
        rows = conn().execute(
            "SELECT * FROM meal_log WHERE user_id=? ORDER BY ts DESC LIMIT 100",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def day_kcal(user_id: str, date_iso: str) -> float:
    """Sum kcal for a single day. Date format: YYYY-MM-DD."""
    rows = conn().execute(
        "SELECT kcal FROM meal_log WHERE user_id=? AND substr(ts, 1, 10)=?",
        (user_id, date_iso),
    ).fetchall()
    return sum(r["kcal"] for r in rows if r["kcal"] is not None)


# ========== HEALTH READINGS (require consent) ==========

def add_health_reading(user_id: str, kind: str, value: dict, unit: str,
                       source: str, tier: str, tier_reason: str = "") -> int:
    """Write a health reading. Caller must have checked surveillance consent."""
    with transaction() as c:
        cur = c.execute(
            "INSERT INTO health_reading (user_id, ts, kind, value_json, unit, source, tier, tier_reason) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (user_id, _now(), kind, json.dumps(value), unit, source, tier, tier_reason),
        )
        return cur.lastrowid


def list_health_readings(user_id: str, kind: str | None = None, limit: int = 50) -> list[dict]:
    if kind:
        rows = conn().execute(
            "SELECT * FROM health_reading WHERE user_id=? AND kind=? ORDER BY ts DESC LIMIT ?",
            (user_id, kind, limit),
        ).fetchall()
    else:
        rows = conn().execute(
            "SELECT * FROM health_reading WHERE user_id=? ORDER BY ts DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["value"] = json.loads(d.pop("value_json"))
        except Exception:
            d["value"] = None
        out.append(d)
    return out


# ========== OBSERVABILITY (n8n writes these) ==========

def log_event(user_id: str, kind: str, channel: str | None = None, payload: dict | None = None) -> int:
    with transaction() as c:
        cur = c.execute(
            "INSERT INTO observability_event (ts, user_id, kind, channel, payload) VALUES (?,?,?,?,?)",
            (_now(), user_id, kind, channel, json.dumps(payload or {})),
        )
        return cur.lastrowid


def list_events(user_id: str, kind: str | None = None, limit: int = 50) -> list[dict]:
    if kind:
        rows = conn().execute(
            "SELECT * FROM observability_event WHERE user_id=? AND kind=? ORDER BY ts DESC LIMIT ?",
            (user_id, kind, limit),
        ).fetchall()
    else:
        rows = conn().execute(
            "SELECT * FROM observability_event WHERE user_id=? ORDER BY ts DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["payload"] = json.loads(d.pop("payload") or "{}")
        except Exception:
            d["payload"] = {}
        out.append(d)
    return out


# ========== ALERT ACKS ==========

def create_alert(event_id: str, user_id: str) -> int:
    with transaction() as c:
        cur = c.execute(
            "INSERT INTO alert_ack (event_id, user_id, created_at, acknowledged) "
            "VALUES (?,?,?,0)",
            (event_id, user_id, _now()),
        )
        return cur.lastrowid


def check_alert(event_id: str) -> dict:
    row = conn().execute(
        "SELECT * FROM alert_ack WHERE event_id=? ORDER BY id DESC LIMIT 1", (event_id,)
    ).fetchone()
    if not row:
        return {"event_id": event_id, "acknowledged": False, "next_action": "call_emergency_contact"}
    if row["acknowledged"]:
        return {"event_id": event_id, "acknowledged": True, "next_action": "none",
                "acked_at": row["acked_at"], "acked_via": row["acked_via"]}
    created = row["created_at"]
    return {
        "event_id": event_id,
        "acknowledged": False,
        "next_action": "call_emergency_contact" if _age_seconds(created) > 60 else "wait_for_ack",
        "elapsed_s": round(_age_seconds(created), 1),
    }


def acknowledge_alert(event_id: str, acked_via: str = "user") -> dict:
    with transaction() as c:
        c.execute(
            "UPDATE alert_ack SET acknowledged=1, acked_at=?, acked_via=? WHERE event_id=? AND acknowledged=0",
            (_now(), acked_via, event_id),
        )
    return check_alert(event_id)


# ========== HELPERS ==========

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _age_seconds(iso_ts: str) -> float:
    try:
        dt = datetime.fromisoformat(iso_ts)
        return (datetime.now(timezone.utc) - dt).total_seconds()
    except Exception:
        return 9999.0
