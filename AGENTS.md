# VarunOS — Agent Instructions

Personal health-coaching OS: FastAPI + SQLite backend, single-file PWA frontend,
deterministic intelligence core. Single-user by design. Deployed on Render
(auto-deploys from `main`).

## Architecture (read before coding)

- `varunos/core/` — ALL math/logic lives here as **pure functions**. No I/O, no
  network, no DB calls. Same inputs → same outputs. This is non-negotiable:
  readiness, insights (Spearman correlations), forecast (EWMA), momentum
  (PRs/streaks), context (AQI), brain (LLM context gate).
- `varunos/api/server.py` + `varunos/api/endpoints_extra.py` — FastAPI routes.
  Thin: parse → call core/db → return. Bearer-token auth on everything except
  `/healthz`.
- `varunos/db/__init__.py` — plain SQLite, no ORM. `health_event` is the
  append-only spine with `dedup_key UNIQUE` (idempotent ingest). Migrations are
  idempotent `CREATE TABLE IF NOT EXISTS` + `_ensure_columns()` ALTERs.
- `web/` — the frontend: Vite + React 18 + Framer Motion ("Obsidian" design
  system, tokens in `web/src/theme.css`). Build with `cd web && npm run build`;
  the output `web/dist/` is COMMITTED so Render serves it without a Node
  toolchain. After any frontend change, rebuild and commit the new dist.
- `pwa/index.html` — the legacy single-file PWA, kept at `/legacy` as a
  transition fallback. Do not add features here.
- `n8n/workflows/*.json` — automation workflows that call back into the API.
- `vos` — stdlib-only CLI client.

## Hard rules (violating these = rejected work)

1. **Privacy gate**: the LLM/Brain may only ever see tiers, scores, and labels —
   never raw biomarkers (no BP numbers, no glucose values, no HRV ms).
   `varunos/core/brain.py:build_brain_context()` is the single gate. Do not
   bypass it or widen what it passes.
2. **Deterministic core**: never put an LLM call or network I/O inside
   `varunos/core/`. Narration is a presentation layer.
3. **Never fake data**: if a metric wasn't measured, it is absent — not
   defaulted. The UI shows honest empty states.
4. **Merge, don't overwrite**: daily check-in writes go through
   `db.merge_checkin()` so wearable syncs and manual check-ins coexist.
5. **No automated checkout/purchases**: grocery automation builds carts and
   deep links; a human always taps "buy". Never store payment credentials.
6. **Medical safety**: never diagnose. Elevated tiers say "discuss with your
   doctor". Keep existing disclaimers intact.

## Workflow

- Run tests: `PYTHONPATH=. python3 -m pytest tests/ -q` — currently 318 pass.
  All must pass before you finish. New logic in `core/` requires new tests.
- Frontend: `cd web && npm run build` must succeed after any `web/src` change,
  and the refreshed `web/dist/` must be part of the same commit.
- Run the server locally:
  `set -a; source .env; set +a; PYTHONPATH=. python3 -m uvicorn varunos.api.server:app --port 8000`
- Python 3.11 (pinned in `.python-version` for Render). Dependencies in
  `requirements.txt` — stdlib-first; do not add heavy deps (no numpy/pandas;
  the correlation engine is deliberately pure Python).
- Never commit `.env`, `*.db`, `*.db-shm`, `*.db-wal`.

## Style

- Python: type hints, dataclasses for core models, docstrings explaining WHY.
- JS: vanilla, functions + template literals, CSS variables for theming
  (`--accent`, `--bg-card`, etc.), motion uses the existing
  `--ease-spring` / `--ease-out` tokens.
- Match the existing voice in UI copy: short, warm, honest ("No check-in yet
  today", "beat it").

## Key docs

- `docs/MASTER_PLAN_V3.md` — the roadmap (source of truth for what to build).
- `docs/HEALTH_DATA_ARCHITECTURE.md` — data-bus design.
- `shortcuts/README.md` — Apple Health bridge.
