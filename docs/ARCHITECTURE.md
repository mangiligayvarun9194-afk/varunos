# VarunOS — Architecture

## 0. Why this architecture

Three forces, one design:

1. **The data is sensitive** (medical, biometric, family history) — needs strict separation.
2. **The reach must be wide** (every phone, every context) — needs surface-agnostic design.
3. **The numbers must be exact** (calories, load, BP stage, ASCVD risk) — needs deterministic computation, never LLM guesses.

The four-system architecture splits the work cleanly:

| System | Job | Never owns |
|---|---|---|
| **AI Brain** | Language, judgement, planning, free-form interpretation | Numbers, state mutation, scheduling, anything that must be 100% reliable |
| **n8n Orchestrator** | Channel I/O, cron, webhook ingress, event routing | Long-term memory, persistent state, business logic |
| **Deterministic Core** | All numeric computation, all state mutation | Natural-language output, channel I/O, AI judgement |
| **Hermes + Obsidian** | Long-term memory, second brain, pattern detection | Real-time channel, real-time cron, current-state facts |

The **medical safety rails** are encoded in the deterministic core, NOT in the AI prompt. If the brain is wrong, the rails still hold.

---

## 1. The deterministic core (the spine)

Pure functions, zero I/O, zero LLM, 100% testable. Every numeric computation in the system lives here.

### 1.1 What's in the core

```
varunos/core/
├── workouts.py        # 1RM, programs, periodization, auto-regulation, PRs
├── diet.py            # BMR, TDEE, macros, adaptive triggers, food DB
├── surveillance/      # IDRS, FINDRISC, ASCVD, BP, CHA2DS2-VASc, CGM
│   ├── idrs.py        # Indian Diabetes Risk Score
│   ├── findrisc.py    # Finnish Diabetes Risk Score
│   ├── ascvd.py       # Pooled Cohort Equations 2018 + QRISK3
│   ├── bp.py          # ACC/AHA 2017 staging + pattern detection
│   ├── cha2ds2vasc.py # Stroke risk in AFib
│   ├── cgm.py         # Time-in-Range consensus 2019
│   └── escalation.py  # CRITICAL threshold routing
├── readiness.py       # HRV/RHR/sleep/wellness/load/trend composite
└── safety.py          # "Never diagnose" rail, disclaimer validator
```

### 1.2 The split-brain rule

> If the AI brain is offline, n8n is offline, or the vault is unreachable — the **deterministic core** still answers every command with exact numbers. Fallback is mandatory, not optional.

This means: every command has a "fast path" that runs the core directly, with no LLM involved. The brain adds narration; it never owns the numbers.

### 1.3 Why pure functions matter

- **Testing** — 196 tests run in 0.4s, no mocks needed.
- **Reproducibility** — same input → same output, every time. Critical for medical safety.
- **Portability** — drop the core into any surface (CLI, PWA, WhatsApp, voice) without modification.
- **Auditability** — every number can be traced back to a deterministic function and a test case.

---

## 2. The n8n orchestrator (the body)

Self-hosted n8n sits between the user surfaces and the deterministic core. It does I/O, scheduling, routing, and nothing else.

### 2.1 Why n8n

| | Hard-coded Python | n8n |
|---|---|---|
| Add a new data source | Code change + redeploy | Drag a node, set API key |
| Add a new trigger | Code change | Drag a trigger node |
| User tweaks their flow | Can't | Edit in n8n UI |
| Failure | Crash whole app | One workflow fails, others continue |
| Visibility | Read code | Visual graph |

### 2.2 The 15 workflows

| # | Workflow | Trigger | Purpose |
|---|---|---|---|
| 1 | Morning Briefing | cron 5:30am | Pull snapshot, send to preferred channel |
| 2 | Health Aggregator | webhook | Normalize + recompute tiers |
| 3 | Workout Logger | webhook | Parse + store + detect PR |
| 4 | Meal Logger | webhook | Match DB + compute macros |
| 5 | Photo Analyzer | image upload | Classify + route |
| 6 | Weekly Report | cron Sun 7pm | Email + WA summary |
| 7 | Adaptive Diet | weekly | Recalibrate |
| 8 | Grocery Generator | weekly | Instacart link |
| 9 | Lab Import | email/photo | OCR → biomarkers |
| 10 | Doctor Share | user command | 6mo PDF + time-limited link |
| **11** | **Emergency Escalation** | **EVT_CRITICAL** | **Multi-channel blast** |
| 12 | Travel Mode | calendar/text | Template switch |
| 13 | PR Celebration | EVT_PR | Tier check + brain celebrate |
| 14 | Family Onboarding | admin | Clone + invite |
| 15 | Voice Briefing | cron/request | TTS call + ASR parse |
| 99 | Self-Test | cron daily 3am | Ping all adapters |

### 2.3 The event taxonomy

The system speaks a small set of internal events. The core emits; surfaces react.

| Event | Payload |
|---|---|
| EVT_BRIEFING_READY | {user_id, ts, readiness, tiers, summary} |
| EVT_WORKOUT_SET_LOGGED | {user_id, ts, exercise, set, weight, reps, rpe} |
| EVT_MEAL_LOGGED | {user_id, ts, kcal, p, c, f, items} |
| EVT_BP_READING | {user_id, ts, sbp, dbp, pulse, source} |
| EVT_GLUCOSE_READING | {user_id, ts, mgdl, source, context} |
| EVT_HRV_READING | {user_id, ts, ms, baseline_diff} |
| EVT_SLEEP_READY | {user_id, ts, duration_min, deep_pct, rem_pct, eff} |
| EVT_TIER_CHANGED | {user_id, scope, from_tier, to_tier, ts} |
| EVT_CRITICAL_THRESHOLD | {user_id, scope, value, ts, action_required} |
| EVT_PR | {user_id, exercise, kg, reps, pr_type} |
| EVT_GOAL_DELTA | {user_id, goal, projected_kg, days_remaining} |
| EVT_DOCTOR_SHARE_READY | {user_id, share_id, ttl_h, url} |

---

## 3. The Hermes + Obsidian second brain (the memory)

Two layers:

### 3.1 Hermes (machine-side)

SQLite + FTS5 long-term memory. Holds:
- Skills crystallized from patterns
- User preferences learned over time
- Long-term trend detections

### 3.2 Obsidian vault (human-side)

Plain Markdown files. You own them. Git-versioned. Can be opened in Obsidian on your laptop.

```
vault/
├── daily/         # YYYY-MM-DD.md — one per day
├── workouts/      # YYYY-MM-DD-<day>.md — per-session
├── insights/      # pattern detections
├── decisions/     # why-we-changed-X notes
├── research/      # articles, studies, video notes
├── recipes/       # tested meals with macros
├── form/          # form-cue video analysis
├── injuries/      # pain log + recovery
├── programs/      # program-level notes
├── goals/         # goal tracking with projection
└── prs/           # personal record log
```

The encrypted medical vault (`/medical/`) is separate, AES-256, never leaves the box.

---

## 4. The 12 surfaces (the reach)

One coach, many reach points. The core never knows what surface it's talking to.

| # | Surface | Use |
|---|---|---|
| 1 | **PWA** (`varunos.app`) | Primary. Camera, GPS, push, offline, install-to-home-screen |
| 2 | **WhatsApp** | Conversation-first, voice notes, photos, family group |
| 3 | **Telegram** | Power users, better bot API |
| 4 | **iMessage** | iOS users without WhatsApp (BlueBubbles bridge) |
| 5 | **SMS** | Universal fallback, critical alerts |
| 6 | **Voice calls** | Feature phones, in-the-moment, family |
| 7 | **Email** | Weekly digest, PDFs, charts |
| 8 | **USSD** | India feature phones (Africa's Talking / OnGo Smart) |
| 9 | **Smart watch** | Complications, rest timer, haptic |
| 10 | **Smart speaker** | Alexa skill, Google Home action, HomePod |
| 11 | **Car (CarPlay/AA)** | Voice log on commute |
| 12 | **Smart home** | Mirror, fridge, scale, gym equipment |

The channel router decides per event, per user, per context. The user picks the preferred channel; the system picks the right surface for the moment.

---

## 5. The medical safety architecture

This deserves its own deep dive — see [`docs/SAFETY_RAILS.md`](SAFETY_RAILS.md). But the high-level flow:

```
Reading (BP, glucose, ECG, etc.)
        │
        ▼
[ Aggregator — workflow 02 ]
        │
        ▼
[ Deterministic Core — surveillance module ]
        │
        ├─ Normalize, dedupe, validate ranges
        ├─ Compute risk tier (LOW / ELEVATED / HIGH / CRITICAL)
        ├─ Compare to previous tier
        │
        ▼
[ Tier changed? ]
        │
        ├─ No  → log only
        ├─ Yes → emit EVT_TIER_CHANGED
        │
        ▼
[ Severity-based routing ]
        │
        ├─ LOW / ELEVATED → mention in next briefing
        ├─ HIGH           → multi-channel ping, prompt "see doctor"
        └─ CRITICAL       → multi-channel blast, 60s ack, EC call
                            (workflow 11 — emergency escalation)
```

The brain NEVER sees the raw value. It only sees the tier. The redactor catches any diagnostic language before it leaves the system.

---

## 6. The data flow, end to end

Example: user logs a BP reading on WhatsApp.

1. **Inbound** — Twilio webhook → n8n (workflow 2)
2. **Normalize** — n8n Function node maps to internal schema
3. **Dedupe + validate** — n8n Function node
4. **Recompute tiers** — HTTP POST to `/v1/core/recompute_tiers`
5. **Tier change detected** — emit `EVT_TIER_CHANGED`
6. **Route by severity** — n8n Switch node
7. **If CRITICAL** — workflow 11 fires: WhatsApp + SMS + voice call + PWA push + email
8. **If HIGH** — multi-channel ping, prompt "see doctor"
9. **If ELEVATED** — next briefing mentions it
10. **Store** — encrypted SQLCipher vault (raw value) + Obsidian (narrative)

The AI brain only sees the tier string ("HIGH"), never the SBP/DBP numbers. If the brain tries to write "you have hypertension", the safety rail catches it and replaces with "your data suggests an elevated risk".

---

## 7. Why this wins (the moat)

- **No single competitor unifies all five layers**: macro tracking (MacroFactor), recovery (WHOOP), logging (Hevy), carts (Instacart), second brain (Obsidian), medical surveillance (mostly nonexistent in consumer).
- **The deterministic core is 100% testable** — competitors use AI to compute things, which is non-deterministic and unauditable.
- **The medical safety rails are encoded, not prompted** — competitors say "be careful" in the prompt; we have code paths that reject bad output.
- **Surface-agnostic reach** — competitors ship apps; we ship a coach that comes to wherever you already are.
- **n8n automation** — adding a new wearable is a 5-minute drag-drop, not a code change.

That's the moat.
