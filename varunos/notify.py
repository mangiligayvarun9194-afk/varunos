"""
Notification integrations for VarunOS.

This module intentionally lives outside varunos/core: sending messages is I/O,
not deterministic coaching logic.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request


def telegram_configured() -> bool:
    """True when both Telegram env vars are present."""
    return bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID"))


def send_telegram(text: str) -> bool:
    """Send a Telegram message.

    Returns False when unconfigured or when Telegram/network calls fail. The
    notification layer should never take down the API path that asked for it.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": "true",
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8") or "{}")
            return bool(payload.get("ok"))
    except Exception:
        return False
