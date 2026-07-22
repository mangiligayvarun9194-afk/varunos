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
from typing import Any, Iterator, Optional


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

    CREATE TABLE IF NOT EXISTS llm_usage (
        user_id  TEXT,
        day      TEXT,
        count    INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, day)
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

    -- Hermes companion: the things it remembers about you. SAFE content only —
    -- short user-stated strings (goals, preferences, wins), never raw biomarkers.
    CREATE TABLE IF NOT EXISTS hermes_memory (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT,
        kind       TEXT,    -- goal | preference | fact | win | struggle
        text       TEXT,
        source     TEXT,    -- user | agent | system
        created_at TEXT,
        last_seen  TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_hermes_mem_user ON hermes_memory(user_id, created_at);

    -- Hermes relationship state: how long you've known each other, how much
    -- you've talked. Drives the "coach's mind grows" level (second growth bar).
    CREATE TABLE IF NOT EXISTS hermes_state (
        user_id          TEXT PRIMARY KEY,
        first_seen       TEXT,
        interaction_count INTEGER DEFAULT 0,
        briefings_seen   INTEGER DEFAULT 0,
        last_briefing_at TEXT,
        custom_name      TEXT
    );

    -- Multi-user accounts (the public-launch foundation). All health data is
    -- already keyed by user_id everywhere; these tables add real identities so
    -- each account's data is isolated. Passwords are stored only as a salted
    -- PBKDF2 hash — never plaintext.
    CREATE TABLE IF NOT EXISTS account (
        user_id     TEXT PRIMARY KEY,
        email       TEXT UNIQUE,
        password    TEXT,            -- pbkdf2$iters$salt$hash, never plaintext
        name        TEXT,
        created_at  TEXT,
        last_login  TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_account_email ON account(lower(email));

    -- Opaque session tokens. We store only the SHA-256 of the token, so a DB
    -- leak can't be replayed as a live session.
    CREATE TABLE IF NOT EXISTS session (
        token_hash  TEXT PRIMARY KEY,
        user_id     TEXT,
        created_at  TEXT,
        expires_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_session_user ON session(user_id);

    -- True-Size Twin: latest body measurements (1 row per user) plus an
    -- append-only history so the Twin's shape over time is replayable.
    CREATE TABLE IF NOT EXISTS twin_measurements (
        user_id     TEXT PRIMARY KEY,
        height_cm   REAL,
        weight_kg   REAL,
        chest_cm    REAL,
        waist_cm    REAL,
        hip_cm      REAL,
        shoulder_cm REAL,
        inseam_cm   REAL,
        sleeve_cm   REAL,
        neck_cm     REAL,
        updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS twin_measurements_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        snapshot    TEXT,   -- JSON of the full measurement set at save time
        created_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_twin_hist_user ON twin_measurements_history(user_id, created_at);

    -- Twin Try-On: "I'd wear this" signals. Append-only intent log — the
    -- honest demand metric behind the investor dashboard.
    CREATE TABLE IF NOT EXISTS tryon_intents (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT,
        item_id     TEXT,
        size        TEXT,
        mode        TEXT,    -- 'today' | 'goal'
        created_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_tryon_user ON tryon_intents(user_id, created_at);
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
        "avatar_url": "TEXT",             # Ready Player Me .glb URL for the 3D Twin
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
              "planned_per_week", "avatar_url"]
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


def import_workout_session(user_id: str, session: dict) -> Optional[int]:
    """Persist a *historical* session (from an import), preserving its real
    timestamp on both the log and every set. Idempotent: if a session already
    exists for this user at the same ts, it is skipped and None is returned, so
    re-importing the same file never duplicates data.
    """
    ts = session.get("ts") or _now()
    exists = conn().execute(
        "SELECT 1 FROM workout_log WHERE user_id=? AND ts=? LIMIT 1",
        (user_id, ts),
    ).fetchone()
    if exists:
        return None
    with transaction() as c:
        cur = c.execute(
            "INSERT INTO workout_log (user_id, ts, program, day_name, week, day_index, "
            "decision, duration_min, avg_rpe, total_volume_kg, notes) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (user_id, ts, session.get("program"), session.get("day_name"),
             session.get("week"), session.get("day_index"), session.get("decision"),
             session.get("duration_min"), session.get("avg_rpe"),
             session.get("total_volume_kg"), session.get("notes")),
        )
        wid = cur.lastrowid
        for s in session.get("sets", []):
            c.execute(
                "INSERT INTO workout_set (user_id, workout_id, exercise_id, set_index, "
                "weight_kg, reps, rpe, ts) VALUES (?,?,?,?,?,?,?,?)",
                (user_id, wid, s.get("exercise_id"), s.get("set_index", 0),
                 s.get("weight_kg"), s.get("reps"), s.get("rpe"), ts),
            )
        return wid


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


# ========== TWIN MEASUREMENTS (True-Size Twin) ==========

_TWIN_FIELDS = ["height_cm", "weight_kg", "chest_cm", "waist_cm", "hip_cm",
                "shoulder_cm", "inseam_cm", "sleeve_cm", "neck_cm"]


def get_twin_measurements(user_id: str) -> dict | None:
    row = conn().execute(
        "SELECT * FROM twin_measurements WHERE user_id=?", (user_id,)
    ).fetchone()
    return dict(row) if row else None


def upsert_twin_measurements(user_id: str, data: dict) -> dict:
    """Merge-upsert the latest measurements and append a history snapshot.

    Partial updates merge with existing data (only provided, non-None canonical
    fields are overwritten). Every save appends the full post-save measurement
    set to twin_measurements_history — append-only, never rewritten."""
    provided = {f: data[f] for f in _TWIN_FIELDS if f in data and data[f] is not None}
    with transaction() as c:
        existing = c.execute("SELECT 1 FROM twin_measurements WHERE user_id=?",
                             (user_id,)).fetchone()
        if existing:
            sets = "".join(f"{f}=?, " for f in provided)
            c.execute(
                f"UPDATE twin_measurements SET {sets}updated_at=? WHERE user_id=?",
                (*provided.values(), _now(), user_id),
            )
        else:
            cols = ", ".join(["user_id", *_TWIN_FIELDS, "updated_at"])
            placeholders = ", ".join("?" for _ in range(len(_TWIN_FIELDS) + 2))
            c.execute(
                f"INSERT INTO twin_measurements ({cols}) VALUES ({placeholders})",
                (user_id, *(provided.get(f) for f in _TWIN_FIELDS), _now()),
            )
        row = c.execute("SELECT * FROM twin_measurements WHERE user_id=?",
                        (user_id,)).fetchone()
        snapshot = {f: row[f] for f in _TWIN_FIELDS}
        c.execute(
            "INSERT INTO twin_measurements_history (user_id, snapshot, created_at) "
            "VALUES (?,?,?)",
            (user_id, json.dumps(snapshot), _now()),
        )
    return get_twin_measurements(user_id) or {}


def list_twin_history(user_id: str, limit: int = 50) -> list[dict]:
    """Measurement snapshots, newest first."""
    rows = conn().execute(
        "SELECT * FROM twin_measurements_history WHERE user_id=? "
        "ORDER BY id DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["snapshot"] = json.loads(d.pop("snapshot") or "{}")
        except Exception:
            d["snapshot"] = {}
        out.append(d)
    return out


# ========== TRY-ON INTENTS (Twin Try-On demand signals) ==========

def add_tryon_intent(user_id: str, item_id: str, size: str, mode: str) -> int:
    """Record one 'I'd wear this' signal. Append-only."""
    with transaction() as c:
        cur = c.execute(
            "INSERT INTO tryon_intents (user_id, item_id, size, mode, created_at) "
            "VALUES (?,?,?,?,?)",
            (user_id, item_id, size, mode, _now()),
        )
        return cur.lastrowid


def list_tryon_intents(user_id: str, limit: int = 50) -> list[dict]:
    """One user's intents, newest first."""
    rows = conn().execute(
        "SELECT * FROM tryon_intents WHERE user_id=? ORDER BY id DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def count_tryon_intents(since_iso: str | None = None) -> int:
    """Global intent count, optionally only since a timestamp."""
    if since_iso:
        row = conn().execute(
            "SELECT COUNT(*) AS n FROM tryon_intents WHERE created_at >= ?",
            (since_iso,)).fetchone()
    else:
        row = conn().execute("SELECT COUNT(*) AS n FROM tryon_intents").fetchone()
    return int(row["n"]) if row else 0


# ========== METRICS (global aggregates — investor dashboard) ==========

def count_accounts() -> int:
    """Registered accounts (the signup table)."""
    row = conn().execute("SELECT COUNT(*) AS n FROM account").fetchone()
    return int(row["n"]) if row else 0


def count_twin_measurements() -> int:
    """Users with at least one saved measurement set (1 row per user)."""
    row = conn().execute("SELECT COUNT(*) AS n FROM twin_measurements").fetchone()
    return int(row["n"]) if row else 0


def count_twin_history() -> int:
    """Total measurement snapshots ever saved (append-only history)."""
    row = conn().execute("SELECT COUNT(*) AS n FROM twin_measurements_history").fetchone()
    return int(row["n"]) if row else 0


def count_workouts(since_iso: str | None = None, before_iso: str | None = None) -> int:
    """Global workout-session count, optionally windowed [since, before)."""
    q = "SELECT COUNT(*) AS n FROM workout_log WHERE 1=1"
    args: list[str] = []
    if since_iso:
        q += " AND ts >= ?"
        args.append(since_iso)
    if before_iso:
        q += " AND ts < ?"
        args.append(before_iso)
    row = conn().execute(q, args).fetchone()
    return int(row["n"]) if row else 0


def workout_user_ids() -> list[str]:
    """Distinct users who have logged at least one workout."""
    rows = conn().execute("SELECT DISTINCT user_id FROM workout_log").fetchall()
    return [r["user_id"] for r in rows if r["user_id"]]


# ========== HERMES (companion memory + relationship state) ==========

_HERMES_KINDS = {"goal", "preference", "fact", "win", "struggle"}


def add_memory(user_id: str, kind: str, text: str, source: str = "user") -> int:
    """Remember one short, safe fact about the user. De-dupes on (kind, text)
    so re-stating a goal refreshes it instead of piling up duplicates."""
    kind = kind if kind in _HERMES_KINDS else "fact"
    text = (text or "").strip()[:280]
    if not text:
        return 0
    with transaction() as c:
        existing = c.execute(
            "SELECT id FROM hermes_memory WHERE user_id=? AND kind=? AND lower(text)=lower(?)",
            (user_id, kind, text),
        ).fetchone()
        if existing:
            c.execute("UPDATE hermes_memory SET last_seen=? WHERE id=?", (_now(), existing["id"]))
            return existing["id"]
        cur = c.execute(
            "INSERT INTO hermes_memory (user_id, kind, text, source, created_at, last_seen) "
            "VALUES (?,?,?,?,?,?)",
            (user_id, kind, text, source, _now(), _now()),
        )
        return cur.lastrowid


def list_memories(user_id: str, kind: str | None = None, limit: int = 50) -> list[dict]:
    if kind:
        rows = conn().execute(
            "SELECT * FROM hermes_memory WHERE user_id=? AND kind=? ORDER BY created_at DESC LIMIT ?",
            (user_id, kind, limit),
        ).fetchall()
    else:
        rows = conn().execute(
            "SELECT * FROM hermes_memory WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_memory(user_id: str, memory_id: int) -> bool:
    """Forget one memory. Hermes forgets what you ask it to — your data, your call."""
    with transaction() as c:
        cur = c.execute("DELETE FROM hermes_memory WHERE user_id=? AND id=?",
                        (user_id, memory_id))
        return cur.rowcount > 0


def count_memories(user_id: str) -> int:
    row = conn().execute("SELECT COUNT(*) AS n FROM hermes_memory WHERE user_id=?",
                         (user_id,)).fetchone()
    return int(row["n"]) if row else 0


def get_hermes_state(user_id: str) -> dict:
    """The relationship state, seeding a fresh row on first contact."""
    row = conn().execute("SELECT * FROM hermes_state WHERE user_id=?", (user_id,)).fetchone()
    if not row:
        with transaction() as c:
            c.execute("INSERT INTO hermes_state (user_id, first_seen, interaction_count, "
                      "briefings_seen) VALUES (?,?,0,0)", (user_id, _now()))
        row = conn().execute("SELECT * FROM hermes_state WHERE user_id=?", (user_id,)).fetchone()
    return dict(row)


def bump_hermes_interaction(user_id: str, n: int = 1) -> dict:
    """Count a conversation turn — this is how Hermes's mind grows."""
    get_hermes_state(user_id)  # ensure the row exists
    with transaction() as c:
        c.execute("UPDATE hermes_state SET interaction_count = interaction_count + ? "
                  "WHERE user_id=?", (n, user_id))
    return get_hermes_state(user_id)


def mark_briefing_seen(user_id: str) -> dict:
    get_hermes_state(user_id)
    with transaction() as c:
        c.execute("UPDATE hermes_state SET briefings_seen = briefings_seen + 1, "
                  "last_briefing_at=? WHERE user_id=?", (_now(), user_id))
    return get_hermes_state(user_id)


def set_hermes_name(user_id: str, name: str) -> dict:
    get_hermes_state(user_id)
    with transaction() as c:
        c.execute("UPDATE hermes_state SET custom_name=? WHERE user_id=?",
                  ((name or "").strip()[:40] or None, user_id))
    return get_hermes_state(user_id)


# ========== ACCOUNTS & SESSIONS (multi-user) ==========

def create_account(user_id: str, email: str, password_hash: str, name: str = "") -> dict:
    """Create a new account. Raises ValueError if the email is already taken."""
    email = (email or "").strip().lower()
    with transaction() as c:
        exists = c.execute("SELECT 1 FROM account WHERE lower(email)=?", (email,)).fetchone()
        if exists:
            raise ValueError("email already registered")
        c.execute(
            "INSERT INTO account (user_id, email, password, name, created_at) "
            "VALUES (?,?,?,?,?)",
            (user_id, email, password_hash, (name or "").strip(), _now()),
        )
    return {"user_id": user_id, "email": email, "name": name}


def get_account_by_email(email: str) -> dict | None:
    row = conn().execute("SELECT * FROM account WHERE lower(email)=?",
                         ((email or "").strip().lower(),)).fetchone()
    return dict(row) if row else None


def get_account(user_id: str) -> dict | None:
    row = conn().execute("SELECT * FROM account WHERE user_id=?", (user_id,)).fetchone()
    return dict(row) if row else None


def touch_last_login(user_id: str) -> None:
    with transaction() as c:
        c.execute("UPDATE account SET last_login=? WHERE user_id=?", (_now(), user_id))


def create_session(token_hash: str, user_id: str, expires_at: str) -> None:
    with transaction() as c:
        c.execute(
            "INSERT INTO session (token_hash, user_id, created_at, expires_at) "
            "VALUES (?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET "
            "user_id=excluded.user_id, expires_at=excluded.expires_at",
            (token_hash, user_id, _now(), expires_at),
        )


def user_id_for_session(token_hash: str) -> str | None:
    """Resolve a (hashed) session token to a user_id, honoring expiry."""
    row = conn().execute(
        "SELECT user_id, expires_at FROM session WHERE token_hash=?", (token_hash,)
    ).fetchone()
    if not row:
        return None
    if row["expires_at"] and row["expires_at"] < _now():
        return None
    return row["user_id"]


def delete_session(token_hash: str) -> bool:
    with transaction() as c:
        cur = c.execute("DELETE FROM session WHERE token_hash=?", (token_hash,))
        return cur.rowcount > 0


def purge_expired_sessions() -> int:
    with transaction() as c:
        cur = c.execute("DELETE FROM session WHERE expires_at IS NOT NULL AND expires_at < ?",
                        (_now(),))
        return cur.rowcount


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


def activity_days() -> list[tuple[str, str]]:
    """Distinct (user_id, YYYY-MM-DD) active pairs across ALL users — any
    observability event counts as activity. Feeds core.retention (pure)."""
    rows = conn().execute(
        "SELECT DISTINCT user_id, substr(ts, 1, 10) AS day FROM observability_event"
        " WHERE user_id IS NOT NULL"
    ).fetchall()
    return [(r["user_id"], r["day"]) for r in rows]


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


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ---- LLM usage metering (cost guardrails) ---------------------------------

def llm_usage_today(user_id: str, day: Optional[str] = None) -> int:
    """How many LLM calls this user has made today (UTC)."""
    row = conn().execute(
        "SELECT count FROM llm_usage WHERE user_id=? AND day=?",
        (user_id, day or _today()),
    ).fetchone()
    return int(row["count"]) if row else 0


def llm_usage_global_today(day: Optional[str] = None) -> int:
    """Total LLM calls across all users today (UTC) — the kill-switch signal."""
    row = conn().execute(
        "SELECT COALESCE(SUM(count), 0) AS c FROM llm_usage WHERE day=?",
        (day or _today(),),
    ).fetchone()
    return int(row["c"]) if row else 0


def llm_usage_increment(user_id: str, day: Optional[str] = None) -> None:
    """Record one LLM call for this user/day (atomic upsert)."""
    with transaction() as c:
        c.execute(
            "INSERT INTO llm_usage (user_id, day, count) VALUES (?,?,1) "
            "ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1",
            (user_id, day or _today()),
        )


def _age_seconds(iso_ts: str) -> float:
    try:
        dt = datetime.fromisoformat(iso_ts)
        return (datetime.now(timezone.utc) - dt).total_seconds()
    except Exception:
        return 9999.0
