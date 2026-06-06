"""
API-key authentication (MVP-grade).

Production-shaped but simple. For MVP we use a single shared API key read
from the environment. Future work: per-user keys + JWT.

Endpoints exempt from auth (kept public):
  - GET /healthz
  - GET /docs  (auto-mounted by FastAPI)
  - GET /redoc (auto-mounted by FastAPI)
  - GET /openapi.json

Everything else requires:
  Authorization: Bearer <VARUNOS_API_KEY>
or
  X-API-Key: <VARUNOS_API_KEY>
"""

from __future__ import annotations
import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import HTTPException, Request, status


def _get_key() -> Optional[str]:
    return os.environ.get("VARUNOS_API_KEY")


def configured() -> bool:
    return bool(_get_key())


def constant_time_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def extract_token(request: Request) -> Optional[str]:
    """Look for the API key in Authorization: Bearer, X-API-Key, or ?api_key=."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    x = request.headers.get("X-API-Key", "")
    if x:
        return x.strip()
    qp = request.query_params.get("api_key")
    return qp.strip() if qp else None


def require_auth(request: Request) -> None:
    """FastAPI dependency. Raises 401 if auth missing or wrong."""
    expected = _get_key()
    if not expected:
        # Server is misconfigured. Fail closed.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API auth not configured. Set VARUNOS_API_KEY.",
        )
    token = extract_token(request)
    if not token or not constant_time_eq(token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def hash_key(key: str) -> str:
    """One-way hash of an API key for at-rest storage."""
    salt = os.environ.get("VARUNOS_KEY_SALT", "varunos-default-salt")
    return hashlib.sha256(f"{salt}:{key}".encode()).hexdigest()


def generate_key() -> str:
    """Generate a new API key. The server stores the hash; the user keeps the plaintext."""
    return secrets.token_urlsafe(32)
