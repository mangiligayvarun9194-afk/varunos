"""
Tests for the Sarathi PWA source files.

These do not test the running browser app (that requires a headless
browser + service worker, which is out of scope for the MVP). They
verify that the source files exist, have the right shape, and contain
the strings we need for the production features to work.

If you change index.html, you must update these tests. The point is
to catch regressions like "someone removed the API key field" or
"someone hardcoded a localhost URL again".
"""

import json
import os
import re

import pytest

PWA_DIR = os.path.join(os.path.dirname(__file__), "..", "pwa")


def _read(name):
    with open(os.path.join(PWA_DIR, name)) as f:
        return f.read()


class TestPWAStructure:
    def test_index_html_exists(self):
        assert os.path.exists(os.path.join(PWA_DIR, "index.html"))

    def test_manifest_exists(self):
        assert os.path.exists(os.path.join(PWA_DIR, "manifest.json"))

    def test_sw_exists(self):
        assert os.path.exists(os.path.join(PWA_DIR, "sw.js"))

    def test_icons_exist(self):
        for icon in ("icon-192.svg", "icon-512.svg", "icon-maskable.svg"):
            assert os.path.exists(os.path.join(PWA_DIR, "icons", icon)), \
                f"Missing icon: {icon}"


class TestPWAServedFromAPI:
    """Verify the FastAPI app serves the PWA at the same origin as the API."""

    def test_root_serves_index(self, monkeypatch):
        monkeypatch.setenv("VARUNOS_API_KEY", "test")
        monkeypatch.setenv("VARUNOS_SERVE_PWA", "1")
        # Reset cached app
        import importlib
        import varunos.api.server as srv
        importlib.reload(srv)
        from fastapi.testclient import TestClient
        with TestClient(srv.app) as c:
            r = c.get("/")
            assert r.status_code == 200
            assert "text/html" in r.headers["content-type"]
            assert "Sarathi" in r.text

    def test_manifest_served(self, monkeypatch):
        monkeypatch.setenv("VARUNOS_API_KEY", "test")
        monkeypatch.setenv("VARUNOS_SERVE_PWA", "1")
        import importlib
        import varunos.api.server as srv
        importlib.reload(srv)
        from fastapi.testclient import TestClient
        with TestClient(srv.app) as c:
            r = c.get("/manifest.json")
            assert r.status_code == 200
            m = r.json()
            assert m["name"] == "Sarathi"

    def test_sw_served(self, monkeypatch):
        monkeypatch.setenv("VARUNOS_API_KEY", "test")
        monkeypatch.setenv("VARUNOS_SERVE_PWA", "1")
        import importlib
        import varunos.api.server as srv
        importlib.reload(srv)
        from fastapi.testclient import TestClient
        with TestClient(srv.app) as c:
            r = c.get("/sw.js")
            assert r.status_code == 200
            assert "CACHE_NAME" in r.text


class TestManifest:
    def test_manifest_parses(self):
        m = json.loads(_read("manifest.json"))
        assert m["name"] == "Sarathi"
        assert m["start_url"] == "/"
        assert m["display"] == "standalone"

    def test_manifest_has_real_icons(self):
        m = json.loads(_read("manifest.json"))
        # Must have at least 2 icons and they must be real files (not just emoji)
        assert len(m["icons"]) >= 2
        for icon in m["icons"]:
            assert not icon["src"].startswith("data:"), \
                "Manifest icons must be real files (not data URIs) for PWA install"
            assert os.path.exists(os.path.join(PWA_DIR, icon["src"])), \
                f"Icon {icon['src']} referenced in manifest but doesn't exist"

    def test_manifest_has_maskable(self):
        m = json.loads(_read("manifest.json"))
        assert any(i.get("purpose") == "maskable" for i in m["icons"])


class TestServiceWorker:
    def test_sw_version_present(self):
        sw = _read("sw.js")
        assert 'CACHE_NAME' in sw
        m = re.search(r'CACHE_NAME\s*=\s*"([^"]+)"', sw)
        assert m, "CACHE_NAME constant must exist"
        assert re.match(r'varunos-v\d+\.\d+\.\d+', m.group(1)), \
            f"Cache name should be versioned: {m.group(1)}"


class TestIndexHTML:
    def test_has_manifest_link(self):
        h = _read("index.html")
        assert 'rel="manifest"' in h

    def test_has_theme_color(self):
        h = _read("index.html")
        assert 'theme-color' in h

    def test_has_onboarding_overlay(self):
        h = _read("index.html")
        assert 'id="onboard-overlay"' in h
        # Must have 5 steps
        for i in range(1, 6):
            assert f'id="onboard-step-{i}"' in h, f"Missing onboard-step-{i}"

    def test_has_api_key_field(self):
        h = _read("index.html")
        # The Settings tab must have an API key field
        assert 'id="s-api-key"' in h

    def test_has_api_base_field(self):
        h = _read("index.html")
        assert 'id="s-api-base"' in h

    def test_has_consent_ack_checkbox(self):
        h = _read("index.html")
        assert 'id="s-consent-ack"' in h
        assert 'id="s-surveillance-on"' in h

    def test_api_function_sends_auth_header(self):
        """The api() helper must include the Authorization header when API_KEY is set."""
        h = _read("index.html")
        # Find the `api(` function definition and grab the next 800 chars
        m = re.search(r'async function api\([^)]*\)', h)
        assert m, "api() function not defined"
        snippet = h[m.start():m.start() + 800]
        assert "Authorization" in snippet, \
            "api() must send Authorization header"
        assert "Bearer" in snippet, \
            "api() must use Bearer scheme"
        assert "API_KEY" in snippet, \
            "api() must read the API_KEY global"

    def test_api_base_is_configurable(self):
        """API_BASE must come from localStorage, not be hardcoded to a specific URL."""
        h = _read("index.html")
        # The initial assignment must read from localStorage
        assert re.search(
            r'API_BASE\s*=\s*localStorage\.getItem\(["\']varunos_api["\']\)',
            h,
        ), "API_BASE must be configurable via localStorage"

    def test_no_hardcoded_localhost_8080_or_production_url(self):
        """The PWA must not have a hardcoded production URL or port-8080
        URL — those are the signs of the prototype leaking."""
        h = _read("index.html")
        # These are bad patterns:
        for bad in ("https://api.varunos.com", "http://localhost:8080",
                    "https://varunos.example.com"):
            assert bad not in h, f"Hardcoded production URL: {bad}"

    def test_safety_disclaimer_text_in_onboarding(self):
        h = _read("index.html")
        # Onboarding must mention the safety limits
        assert "not a medical device" in h.lower()
        assert "911" in h or "108" in h or "112" in h

    def test_surveillance_off_by_default_in_onboarding(self):
        h = _read("index.html")
        # Step 5 must say OFF by default
        assert "OFF" in h
        assert re.search(r'[Oo]ff by default', h), \
            "Onboarding must say surveillance is off by default"

    def test_clear_local_data_button(self):
        h = _read("index.html")
        assert "clearLocalCache" in h

    def test_version_bump(self):
        """The visible version chip in the UI must be >= 2.2.0."""
        h = _read("index.html")
        m = re.search(r'<span class="lbl">Version</span><span class="val">(v[\d.]+)</span>', h)
        assert m, "Version chip not found in Settings card"
        ver = m.group(1)
        # Parse vX.Y.Z
        parts = ver.lstrip('v').split('.')
        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
        assert (major, minor, patch) >= (2, 2, 0), \
            f"Visible version must be >= 2.2.0, got {ver}"
