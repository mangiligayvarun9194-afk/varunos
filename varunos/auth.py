"""
Authentication — single-key (legacy/owner) AND multi-user accounts.

Two ways to authenticate, both via `Authorization: Bearer <token>` (or X-API-Key):
  1. The legacy shared key in VARUNOS_API_KEY  → resolves to the owner user
     (VARUNOS_USER_ID). Keeps the original single-user device + every existing
     test working untouched.
  2. A per-user session token issued by /v1/auth/login or /v1/auth/signup →
     resolves to that account's user_id.

The resolved user_id is stashed in a request-scoped ContextVar so the 48 existing
endpoints can keep calling `_user_id_from_default()` with no signature changes —
they transparently become per-user. Public endpoints (healthz, docs, openapi, and
the auth signup/login routes) are exempt.

Passwords are stored only as salted PBKDF2-SHA256 hashes. Session tokens are
random and stored only as their SHA-256 hash, so a DB leak can't be replayed.
"""

from __future__ import annotations
import contextvars
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status

# Request-scoped current user. Set by require_auth, read by the endpoints' user
# resolver. Defaults to None (falls back to the env owner for CLI/tests).
_current_user: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_user", default=None)

# Paths that never require auth.
PUBLIC_PREFIXES = ("/v1/auth/login", "/v1/auth/signup")

SESSION_TTL_DAYS = 60
_PBKDF2_ITERS = 200_000


def _get_key() -> Optional[str]:
    return os.environ.get("VARUNOS_API_KEY")


def _owner_id() -> str:
    return os.environ.get("VARUNOS_USER_ID", "default")


def configured() -> bool:
    return bool(_get_key())


def constant_time_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def extract_token(request: Request) -> Optional[str]:
    """Look for the token in Authorization: Bearer, X-API-Key, or ?api_key=."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    x = request.headers.get("X-API-Key", "")
    if x:
        return x.strip()
    qp = request.query_params.get("api_key")
    return qp.strip() if qp else None


def current_user_id() -> str:
    """The user_id for the in-flight request, or the env owner as a fallback
    (CLI, tests, or any code path that runs outside an authed request)."""
    return _current_user.get() or _owner_id()


def set_current_user(user_id: Optional[str]) -> None:
    _current_user.set(user_id)


def _resolve_user(token: str) -> Optional[str]:
    """Map a presented token to a user_id, or None if it's not valid.

    Order: the legacy shared key wins (owner), else a live session token."""
    expected = _get_key()
    if expected and constant_time_eq(token, expected):
        return _owner_id()
    # Session token? Look up by its hash.
    from varunos import db
    return db.user_id_for_session(hash_token(token))


async def require_auth(request: Request) -> None:
    """FastAPI dependency. Resolves the caller to a user_id and stashes it for the
    request; raises 401/503 if auth is missing, wrong, or unconfigured.

    Async on purpose: a sync dependency runs in a worker thread whose ContextVar
    write wouldn't propagate to the (also threadpooled) endpoint. Running here in
    the request's async context means run_in_threadpool copies the value down."""
    if not configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API auth not configured. Set VARUNOS_API_KEY.",
        )
    token = extract_token(request)
    uid = _resolve_user(token) if token else None
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    set_current_user(uid)


# ---- Password hashing (PBKDF2-SHA256, stdlib) ----------------------------

def hash_password(password: str) -> str:
    """Return 'pbkdf2$iters$salt_hex$hash_hex'. Never stores plaintext."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
    return f"pbkdf2${_PBKDF2_ITERS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iters, salt_hex, hash_hex = stored.split("$")
        if scheme != "pbkdf2":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(),
                                 bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


# ---- Session tokens ------------------------------------------------------

def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 of a session token — what we actually store/look up."""
    return hashlib.sha256(token.encode()).hexdigest()


def session_expiry_iso(days: int = SESSION_TTL_DAYS) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


# ---- Legacy helpers (kept) -----------------------------------------------

def hash_key(key: str) -> str:
    """One-way hash of an API key for at-rest storage."""
    salt = os.environ.get("VARUNOS_KEY_SALT", "varunos-default-salt")
    return hashlib.sha256(f"{salt}:{key}".encode()).hexdigest()


def generate_key() -> str:
    """Generate a new API key. The server stores the hash; the user keeps the plaintext."""
    return secrets.token_urlsafe(32)


def new_user_id() -> str:
    """Opaque per-account user id."""
    return "u_" + secrets.token_hex(8)
