# Copy-paste prompt for Codex (remaining roadmap: Week 2 + Week 3)

Copy everything below the line into Codex after connecting this GitHub repo.
Run ONE phase per task for best results — Phase 1 first, review the PR, then
Phase 2, then Phase 3.

---

You are the senior engineer on VarunOS. Read `AGENTS.md` at the repo root first
and follow every rule in it — especially: pure deterministic `varunos/core/`,
the Brain privacy gate, no automated purchases, all 318+ tests passing, and the
single-file no-framework PWA.

Context: `docs/MASTER_PLAN_V3.md` is the roadmap. Weeks 1 and 4 are already
built (wake-up experience, momentum engine, trainer logging, lock-screen login,
3D Twin). Your job is the remaining two phases. Work incrementally, run
`PYTHONPATH=. python3 -m pytest tests/ -q` after every change, and validate the
PWA JS with `node --check` as described in AGENTS.md.

## PHASE 1 — Telegram notifier + n8n Wearable Autopilot (Week 2 of the plan)

1. New module `varunos/notify.py`: a `send_telegram(text: str) -> bool` helper
   using only stdlib `urllib`, reading `TELEGRAM_BOT_TOKEN` and
   `TELEGRAM_CHAT_ID` from env. Returns False (never raises) when unconfigured.
   This is an integration helper, NOT core — it does not go in `varunos/core/`.
2. New endpoint `POST /v1/notify/test` that sends "VarunOS is connected" via
   Telegram and reports `{configured, sent}`.
3. Wire the daily momentum message: extend the existing
   `GET /v1/momentum/today` flow with a new endpoint
   `POST /v1/momentum/push` that picks `best_event` (max ONE per day — record
   pushes in the `observability_event` table, kind `momentum_pushed`, and
   refuse a second push the same day) and sends it via Telegram.
4. New n8n workflows in `n8n/workflows/` following the JSON style of the
   existing ones:
   - `20_wearable_poller.json` — 07:30 cron: GET `/v1/sync/status`; if today
     has no sync, send a Telegram reminder to run the Apple Health shortcut.
   - `21_post_sync_briefing.json` — webhook-triggered after sync: GET
     `/v1/wakeup`, format readiness + workout + (if location set)
     `/v1/context/today` AQI advice into one Telegram morning briefing.
   - `22_momentum_notifier.json` — 20:00 cron: POST `/v1/momentum/push`.
5. Document setup in `n8n/README.md`: creating the bot via @BotFather, getting
   the chat id, the two env vars on Render.
6. Tests: notify module (mock urllib), the once-per-day push guard, endpoint
   auth. All existing tests must still pass.

## PHASE 2 — Grocery Autopilot (Week 3 of the plan)

1. New core module `varunos/core/grocery.py` (pure functions + dataclasses):
   - `ingredients_for_week(meal_plan: list[dict]) -> list[LineItem]` —
     aggregate a 7-day meal plan (the existing diet templates in
     `varunos/data/templates/`) into deduplicated grocery line items with
     quantities and units.
   - `apply_pantry(items, pantry: dict[str, float]) -> list[LineItem]` —
     subtract what's still at home; drop items fully covered.
   - Unit tests for both.
2. DB: `pantry_item` table (user_id, item_name, qty, unit, updated_at) and
   `price_history` table (item_name, store, price, currency, ts). Plus CRUD
   helpers in `varunos/db/__init__.py` following the existing style.
3. Endpoints:
   - `GET /v1/grocery/list` — this week's list from active meal plan + pantry.
   - `POST /v1/grocery/pantry` — update pantry quantities.
   - `POST /v1/grocery/cart` — call the Instacart Developer Platform
     "Create shopping list page" API
     (`https://connect.instacart.com/idp/v1/products/products_link`, dev server
     `https://connect.dev.instacart.tools`, bearer key from env
     `INSTACART_API_KEY`) with the line items; return the cart URL. If the key
     is unset, return `{configured: false}` with the list — never fail.
   - `GET /v1/grocery/prices` — price history trends per staple item.
4. n8n workflow `30_grocery_cart_builder.json` — Sunday 17:00: POST
   `/v1/grocery/cart`, then Telegram: "🛒 Week's groceries ready — [Open cart]"
   with the link. A HUMAN taps the link and pays on Instacart. Do not attempt
   any checkout automation.
5. PWA: a "Groceries" card on the Insights tab (or a small section on Today)
   showing this week's list with check-off chips and an "Open cart" button when
   a cart URL exists. Match existing CSS tokens and motion.

## PHASE 3 — polish pass

1. `GET /v1/wakeup` should include `context` (AQI training advice) when the
   user has a location set, so the briefing needs one call.
2. Evening users (`workout_time_pref=evening`): the n8n briefing workflow
   sends at 16:30 instead of morning — implement via a second cron node gated
   on the profile value fetched from `/v1/user/profile`.
3. Update `README.md` feature list and `docs/MASTER_PLAN_V3.md` checkboxes for
   what you shipped.

Acceptance for every phase: full test suite green, JS check clean, no new
heavy dependencies, no raw biomarkers anywhere near the Brain or Telegram
messages (tiers/scores/labels only — a Telegram briefing may say "Readiness 78
GREEN", never a glucose or BP number), and a PR description listing what you
built and how you verified it.
