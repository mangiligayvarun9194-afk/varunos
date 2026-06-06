# VarunOS — Roadmap

*Where we are, where we're going.*

---

## ✅ Done (v2.1.1)

This release. The spine of the system. Demonstrates the full architecture end-to-end.

### Deterministic core
- [x] BMR (Mifflin-St Jeor), TDEE, macro targets (cut/recomp/lean-bulk/bulk)
- [x] 6 programs (PPL, U/L, FST-7, 5/3/1, deload, recomp)
- [x] 50+ exercises with equipment-aware substitution
- [x] 5 progression schemes (double, linear, wave, RPE, autoregulated)
- [x] Periodization (4 blocks: accumulation, intensification, realization, deload)
- [x] Auto-regulation (GREEN/YELLOW/RED decision rule)
- [x] PR detection (1RM, rep, volume, e1RM)
- [x] Composite readiness score (HRV + RHR + sleep + wellness + load + trend)
- [x] Adaptive diet triggers (BW flat → −100, strength drop → +carbs, etc.)
- [x] 80+ food items (Indian-first)
- [x] 5 meal templates

### Health surveillance (medical)
- [x] IDRS (Indian Diabetes Risk Score) — primary
- [x] FINDRISC — secondary
- [x] ASCVD 2018 (Pooled Cohort Equations) with 1.3× Indian adjustment
- [x] QRISK3 — UK alternative
- [x] BP staging (ACC/AHA 2017) + 5 pattern detectors
- [x] CHA2DS2-VASc — stroke risk in AFib
- [x] CGM metrics (TIR, TBR, TAR, GMI, CV%) per Battelino 2019
- [x] HOMA-IR — insulin resistance
- [x] Emergency escalation (multi-channel, 5-second routing)
- [x] The 7 medical safety rails (encoded, not prompted)
- [x] Diagnostic-language redactor
- [x] Disclaimer validator

### Surfaces
- [x] PWA (Today, Log, Insights, Coach, Settings) — installable, offline-first
- [x] Service worker, manifest, push-ready
- [x] CLI demo (5 commands: briefing, workout, diet, surveillance, doctor-share)

### n8n orchestration
- [x] Workflow 01: Morning Briefing (cron → channel router)
- [x] Workflow 02: Health Data Aggregator (webhook → normalize → recompute)
- [x] Workflow 11: Emergency Escalation (multi-channel blast)
- [x] n8n import format documented for the remaining 12

### API
- [x] FastAPI server with 15+ endpoints
- [x] OpenAPI auto-generated at `/docs`
- [x] All endpoints pure (no server-side state)

### Vault
- [x] Sample Obsidian-style vault (5 files: daily, workout, insight, decision, goal)
- [x] Convention documented (YAML frontmatter, sortable filenames)

### Deployment
- [x] systemd unit files (varunos, varunos-n8n)
- [x] docker-compose.yml
- [x] Dockerfile
- [x] Deploy guide

### Doctor share
- [x] PDF generator (single page, no external deps)
- [x] Doctor's View documentation
- [x] Time-limited link design

### Tests
- [x] **196 unit + integration tests, all passing in 0.4s**

---

## 🚧 Next (v2.2 — n8n completion)

Each item ships a working surface that 1+ user can use. No half-baked phase.

### Phase 8.0 — n8n + channel router (in progress)
- [ ] Workflow 03: Workout Logger
- [ ] Workflow 04: Meal Logger
- [ ] Workflow 05: Photo Analyzer
- [ ] Workflow 06: Weekly Report
- [ ] Workflow 07: Adaptive Diet
- [ ] Workflow 08: Grocery Generator (Instacart)
- [ ] Workflow 09: Lab Import (PDF OCR)
- [ ] Workflow 10: Doctor Share
- [ ] Workflow 12: Travel Mode
- [ ] Workflow 13: PR Celebration
- [ ] Workflow 14: Family Onboarding
- [ ] Workflow 15: Voice Briefing
- [ ] Workflow 99: Self-Test

### Phase 8.1 — PWA v1 → v2
- [ ] Camera capture for meals (currently mock)
- [ ] Camera capture for body photos
- [ ] GPS geofence (gym detection)
- [ ] Real Web Push notifications
- [ ] IndexedDB offline queue
- [ ] Install prompt banner

### Phase 8.2 — Telegram + SMS + Email
- [ ] Telegram bot (better bot API, no 24h window)
- [ ] SMS critical-alert path
- [ ] Weekly email digest (Resend)

### Phase 8.3 — Voice (Twilio + TTS)
- [ ] Morning briefing call (TTS)
- [ ] Voice log (Whisper / Deepgram ASR)
- [ ] Emergency call (TTS + IVR)

### Phase 8.4 — Apple Watch + Garmin + Whoop
- [ ] HealthKit Auto Export → webhook
- [ ] Garmin Connect API integration
- [ ] Whoop API integration
- [ ] Watch complication (rest timer, today's plan)

### Phase 8.5 — Encrypted medical vault
- [ ] SQLCipher integration
- [ ] Key derivation from user passphrase
- [ ] Audit log
- [ ] `surveillance wipe` hard delete
- [ ] Backup automation (encrypted → private git repo)

---

## 🔮 Future (v3+)

### Phase 9.0 — Smart watch + car + speaker
- [ ] Apple Watch native app (rest timer, glanceable)
- [ ] CarPlay / Android Auto voice log
- [ ] Alexa skill + Google Home action

### Phase 9.1 — Vision (form check)
- [ ] Form check via WhatsApp video → vision API → form notes
- [ ] Local save to Obsidian (no brain storage)
- [ ] Privacy: one-shot vision, no retention

### Phase 9.2 — Family / multi-user
- [ ] Per-user state in shared box
- [ ] Family WhatsApp group integration
- [ ] Doctor view-only PWA
- [ ] Parent-guardian permission for minor child
- [ ] Elderly parent BP/CGM monitoring (with consent)

### Phase 9.3 — USSD (feature phones)
- [ ] Africa Talking integration
- [ ] OnGo Smart integration
- [ ] *VARUN# command set
- [ ] SMS fallback for non-smart

### Phase 9.4 — Adaptive intelligence (Hermes)
- [ ] Auto skill crystallization (Hermes 2.0)
- [ ] Pattern detection (3+ day trends)
- [ ] User preference learning (e.g. "user prefers PPL")
- [ ] Coach tone adaptation

### Phase 9.5 — Polish + public dashboard
- [ ] Public progress dashboard at stable URL
- [ ] No-auth read-only public stats (optional, opt-in)
- [ ] Side-by-side photo comparison
- [ ] Shareable PR cards (Twitter/IG)

---

## 🛑 What we will NOT do

These are decisions, not priorities. We will say no to:

- ❌ Auto-dial 911/108/112 (always user-confirmed except FAST/chest pain)
- ❌ Share data with insurance, employers, third parties
- ❌ Train any model on user data
- ❌ Add a freemium tier (privacy = no analytics)
- ❌ Build a "social" feed (no leaderboards, no comparison)
- ❌ Diagnose, prescribe, or change medication doses
- ❌ Override user choice on alerts

---

## Open questions (decide before v3)

### Fitness OS
1. Diet template default: Indian veg / non-veg / pick on first onboarding?
2. OpenRouter model: MiMo M2.7 free or Gemini 2.0 Flash free?
3. Obsidian vault auto-push to a private GitHub repo for backup?
4. Voice: iOS Shortcuts + Twilio, or skip in v1?

### Health Surveillance
5. Default opt-in or opt-out? (Recommend opt-in, off by default)
6. CGM support: only for diabetics, or periodic 2-week screening wears for non-diabetics?
7. Indian ASCVD adjustment multiplier: confirm with a cardiologist?
8. Doctor-share default TTL: 24h or 7d?
9. Family history depth: how much detail to collect?

### Integration & Automation
10. PWA framework preference: React + Vite + TS, or SvelteKit, or vanilla?
11. USSD gateway preference: Africa's Talking, OnGo Smart, or telco-direct partnership?
12. Voice TTS provider: Cartesia Sonic, ElevenLabs, or Google TTS?
13. TTS voice: Indian-English neutral male, or accent preference?
14. n8n self-host: Docker on the same box, or separate VM?
15. Multi-user in v1, or single-user first, multi-user later?

---

## How to contribute

1. **Open an issue** describing the problem or feature.
2. **Send a PR** with tests. The deterministic core requires ≥80% coverage on new code.
3. **Safety rails are sacred.** If your change touches `varunos/core/safety.py` or `varunos/core/surveillance/`, you need a senior reviewer and a documented test for the new failure mode.
4. **No PII in tests.** Use synthetic data only.

The system works because the rules are tight. Don't loosen them.
