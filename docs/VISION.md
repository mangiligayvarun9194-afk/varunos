# Sarathi — Product Vision

> **Sarathi** (सारथि) — *"the charioteer."* In the Bhagavad Gita, Krishna was Arjuna's
> sārathi: he did not fight the war, he *steered* it — guiding the hero to his own victory.
> In the chariot metaphor the body is the chariot, the senses the horses, the mind the
> reins, and the charioteer the guiding intelligence. That is exactly what this product is.

> **North Star:** Two things grow with you.
> Your **Twin** (your body, made visible) and your **Hermes** (your coach, made personal) —
> both backed by a **Health Vault** of memory you own forever.
> Sarathi is the private AI health operating system that turns the data you already
> generate into a living character you level up, a companion that knows you better every
> day, and an open, lifelong record of you that never leaves your hands.

*Owner: Varun. Status: working MVP, pre-launch. This is the source-of-truth vision;
the build roadmap in `MASTER_PLAN_V3.md` executes against it.*

---

## 1. The one-liner

**Sarathi — own your health. Talk to it, and watch yourself level up.**

A personal health OS that pulls from the wearables you already own, plans and logs your
training, tracks your nutrition, remembers your entire journey as open files you own, and
is driven by an AI companion that grows alongside a 3D avatar of you — all while your raw
health data never leaves your hands.

---

## 2. Who it's for

- **Now:** serious lifters and quantified-self people who already own a watch/ring and are
  tired of tedious, generic, data-harvesting apps. (Founder is the first user.)
- **Next:** everyday people who want fitness to feel like a game they don't quit.
- **Later (B2B):** coaches, gyms, and clinics who want a white-label, privacy-safe coaching
  layer for their clients.
- **Geography:** built India-first (Indian food database, Indian risk thresholds,
  Telegram-native) — globally applicable.

---

## 3. The core insight / why now

Most fitness apps fail for the same reasons — and we kill all of them:

| Why apps die | What Sarathi does |
|---|---|
| **Logging is a chore** → people quit | You just *talk*; it logs for you. No forms. |
| **Advice is generic** → no results | It reads your recovery from your wearable and adapts daily. |
| **Your data is the product** → no trust | Raw health data never leaves your device; the AI only sees scores. |
| **A dashboard is forgettable** → churn | A Twin *and* a companion that *grow with you* → emotional retention. |
| **Your history is locked in** → no ownership | Your whole journey is open Markdown files you keep forever. |

**Why now:** wearables are everywhere (the sensor is already on the wrist, free to us),
open local-agent frameworks (OpenClaw) make a private always-on companion finally
buildable, open knowledge tools (Obsidian) make a portable lifelong memory trivial, and
people are newly suspicious of apps that sell their health data.

---

## 4. The product pillars

### Pillar 1 — Universal wearable sync ("your data, already paid for")
Pull HRV, resting HR, sleep, steps, recovery, SpO₂, etc. from **Apple Watch, Samsung,
Whoop, Garmin, Oura, Fitbit** — devices users already own, so onboarding costs them
nothing.
- **Reality / how:** Apple & Samsung come through on-device bridges (Apple Health Shortcut
  — already built; Samsung Health Connect). Garmin/Whoop/Oura/Fitbit are OAuth cloud APIs.
  We ship a **unified ingest layer** (build direct, or use an aggregator like Open
  Wearables / Terra / Rook to cover all-at-once, then bring high-volume integrations
  in-house to cut per-user cost).
- **Moat detail:** we normalise everything into one honest health timeline. Missing data
  stays missing — we never fake a number.

### Pillar 2 — Adaptive training + frictionless logging
From the synced data we compute a daily **readiness** score (green/yellow/red) and
**auto-adjust today's workout** to how recovered you actually are. Logging is plain
language: *"I benched 100 for 5"* → logged, PR detected. (Built.)
- **Next:** richer programs, a progression engine, plate math, rest timers (partly built),
  and form/video later.

### Pillar 3 — The Twin & the Legends (the emotional engine)
A 3D avatar that **trains when you train and physically grows as you do** — arms, chest,
legs scale with your logged volume, streaks, PRs, and consistency (the `avatar_level`
formula already drives this). It levels up over time.
- **Custom you:** users create a look-alike avatar (selfie → rigged model).
- **The Legends (the creative + monetisation play):** a library of **original archetype
  heroes** — a caped guardian, a shadow-ninja, a Saiyan-style warrior, a mech-suit, etc. —
  that *evoke* the icons people love **without infringing trademarks** (no actual
  Batman/Superman/anime IP — that's a licensing wall we route around). Your character
  levels and "gains muscle" with you.
- **Marketplace:** artists sell skins/Legends; we take a cut. Creator economy = moat +
  revenue + endless fresh content. (Optional licensed packs later if a studio deal makes
  sense.)
- **Reality flag:** our prior avatar pipeline (Ready Player Me) shut down; replacement is
  Avaturn / an in-house photo→avatar pipeline / commissioned rigged GLBs for Legends.

### Pillar 4 — Advanced nutrition tracking
Beyond a calorie counter: photo-of-plate → macros (built via vision), voice logging, an
Indian-first food DB, pantry + grocery autopilot (price-watch built), and meal plans that
flex with your training load and goal.

### Pillar 5 — The lifelong AI brain (truth, not guesswork)
Every workout, meal, check-in, and biomarker from day one feeds a reasoning engine that
sees your *entire history*, not just today — spotting patterns ("your sleep tanks your
next-day energy"), tracking trajectory, and narrating progress.
- **Privacy gate is sacred:** the LLM only ever sees tiers/scores/labels, never raw
  biomarkers.
- **Deterministic and auditable:** the health math is pure code — the AI *explains* it, it
  doesn't *guess* it. (This is what makes us safe to trust with health.)

### Pillar 6 — Memory & the Health Vault (Obsidian) — *you own your story forever*
Your entire health journey is mirrored into a local **Obsidian vault** — plain
**Markdown files** linked with `[[wikilinks]]`, with a **graph view** that literally
pictures your progress.
- **What it is:** one note per day / workout / PR / meal / insight, all cross-linked —
  `[[2026-06-13]]` → `[[Bench Press]]` → `[[Push Day]]` → `[[Sleep]]`. Your health becomes
  a navigable wiki of *you*.
- **Why it's powerful:** this is the human-readable substrate for the lifelong memory in
  Pillar 5 and for Hermes (Pillar 7). The agent reads/writes notes through Obsidian's
  built-in **Local REST API + MCP server**, so "remembers everything about you" is backed
  by files you can open, read, and edit — not a black box.
- **Two-way:** you journal feelings/notes/photos in Obsidian → Hermes reads them for richer
  coaching; Sarathi writes structured progress back. The vault is your shared brain with
  your coach.
- **The graph view is a signature visual** — seeing sleep nodes wire into PR nodes into
  Twin-level nodes is unique and demo-gold (use it in the film/deck).
- **Privacy, maximised:** it's no longer just "we don't sell your data" — it's *"your
  health is your own open files, on your machine, portable anywhere, forever."* The
  strongest possible form of "own your health."
- **Reality flag:** Obsidian is a local app, not a server. Fits the **self-hosted / local**
  mode; for cloud users we ship a **"Download your Health Vault"** export (a `.zip` of
  `.md` files) so everyone owns a portable copy even without installing Obsidian. The
  canonical store stays Sarathi's database (the truth); the vault is an open, human-readable
  mirror + memory layer — never a hard runtime dependency.

### Pillar 7 — Hermes, the companion that grows with you (the signature feature)
**Hermes is the relationship layer** — named for the Greek messenger who *travels with
you*. A persistent, personal agent that lives across every surface (app, Telegram, watch)
and gets to know you better every day:
- **Travels with you daily:** morning briefing, in-the-moment nudges, evening reflection —
  proactive, not waiting to be opened.
- **Long memory:** its memory *is* the Health Vault (Pillar 6) — it remembers your goals,
  your language, your excuses, your wins.
- **It levels up too:** as it learns you, it unlocks deeper skills and more tailored
  coaching — so just like your Twin's *body* grows, your Hermes's *mind* grows. **Two
  growth bars: your body and your coach.** That symmetry is the heart of the brand.
- **Architecture:** Hermes = personality + memory + proactivity, **powered by OpenClaw** as
  its hands (Pillar 8), the **deterministic core** as its source of truth, the **Vault** as
  its memory, and an LLM for language. It never fabricates health facts — it routes to the
  core for those.

### Pillar 8 — OpenClaw autopilot (Hermes's hands)
[OpenClaw](https://openclaw.ai/) is an open-source, **local, privacy-first** agent runtime
(model-agnostic, bring-your-own-key, 100+ AgentSkills, automates Telegram/WhatsApp/web).
It's the perfect execution engine for Hermes because it runs **on the user's own box** —
matching our "data never leaves you" promise.
- We build **Sarathi AgentSkills**: fetch-and-sync wearables, log a set/meal, build the
  grocery cart, send the briefing, write to the Vault, pull a lab result, schedule a
  deload, etc.
- Hermes *decides*; OpenClaw *does*. It also speaks MCP — the same protocol Obsidian's vault
  exposes — so the agent, the memory, and the automations all interconnect natively.
- **Research note:** keep Sarathi's deterministic core as the truth layer; OpenClaw is
  orchestration only, wrapped behind our own interface so we're insulated from its churn.

### Pillar 9 — Private by design (the trust moat)
Self-hostable, single-user-owned data, on-device/own-server storage, open Markdown memory,
AI sees only scores. This isn't a feature bullet — it's the **reason people trust us with
the most personal data they have**, and a regulatory tailwind as health-data rules tighten.

---

## 5. The AI/agent architecture (how the brains fit together)

```
                 ┌──────────────────────────────────────────────┐
   You  ────────▶│  Surfaces: App · Telegram · Watch · Voice     │
 (plain words)   └───────────────┬──────────────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │  HERMES         │  personality · proactivity
                         │  (companion)    │  — grows as it learns you
                         └──┬─────┬─────┬──┘
              needs words   │     │     │  remembers via
                 ┌──────────▼─┐   │   ┌─▼───────────────────────┐
                 │   LLM       │   │   │  HEALTH VAULT (Obsidian) │  open .md + [[links]]
                 │ (Claude/    │   │   │  ──MCP / REST──          │  graph view = your story
                 │  local)     │   │   └──────────────────────────┘  (you can read & edit)
                 │ sees scores │   │
                 │ only (gate) │   │  acts via
                 └─────────────┘   ▼
                            ┌───────────────┐
                            │  OPENCLAW      │  the hands: AgentSkills,
                            │  (runtime)     │  automations — on YOUR box
                            └───────┬────────┘
                                    │ calls for truth
                            ┌───────▼─────────────────────────┐
                            │  DETERMINISTIC CORE (varunos/core)│  readiness, momentum,
                            │  pure, auditable, no hallucination│  insights, avatar_level
                            └───────┬─────────────────────────┘
                                    │   (SQLite = canonical truth; Vault mirrors it)
                            ┌───────▼────────┐   ┌──────────────────┐
                            │ Health graph   │   │ Wearable ingest  │◀── Apple/Samsung/
                            │ + memory store │   │ (unified layer)  │    Whoop/Garmin/Oura
                            └─────────────────┘   └──────────────────┘
```

**The rule that keeps it safe and unique:** the LLM and agents are the *voice and hands*;
the deterministic core is the *truth*; the Vault is the *memory*. Health math is never
guessed.

---

## 6. Why we're different (the moat, in one table)

| Every other fitness app | Sarathi |
|---|---|
| You serve the app (manual logging) | You just talk — it logs for you |
| Generic, static plans | Adapts to your recovery, daily |
| Monetises your data | **Never sees your raw data** |
| Your history is locked in their cloud | **Your story is open files you own forever** |
| A dashboard you abandon | A Twin *and* a companion that grow with you |
| One chatbot | A companion (Hermes) with lifelong memory that levels up |
| Closed, vendor-locked | Open, self-hostable, model-agnostic, wearable-agnostic |

---

## 7. Business model (privacy-respecting — we never sell data)

- **Freemium subscription** — Pro unlocks the AI coach depth, advanced nutrition, premium
  Twin skins, Hermes autopilot, and live Obsidian sync.
- **Legends / skin marketplace** — creators sell avatar characters; we take a revenue cut.
- **B2B / white-label** — coaches, gyms, clinics license the engine for their clients.
- **Data ownership is free, always** — "Download your Health Vault" ships to everyone; it's
  the trust anchor, not a paywall.
- **Never:** selling user health data. That's the whole point.

---

## 8. Roadmap (phases)

- **Phase 1 — MVP (mostly built):** Apple Health sync, deterministic readiness, plain-
  language logging + agent, basic Twin, Telegram concierge, nutrition basics, privacy gate.
- **Phase 2 — Platform foundations:** multi-user accounts (the real SaaS re-architecture),
  unified wearable layer (Garmin/Whoop/Oura/Samsung), advanced nutrition, Twin leveling +
  first original **Legends**, the **Health Vault export**, Hermes v1 (persistent memory +
  proactive briefings).
- **Phase 3 — The companion + creator era:** OpenClaw-powered Hermes autopilot (skills &
  automations on the user's box), live **Obsidian MCP** memory sync, the Legends
  **marketplace**, B2B coach mode — "a platform millions own."

---

## 9. Honest risks & decisions to make

1. **Avatar IP:** no real Batman/Superman/anime. Ship original archetypes + a creator
   marketplace; pursue licensed packs only via real studio deals.
2. **Wearable integration cost:** aggregators charge per-user; plan to migrate high-volume
   devices in-house. Apple/Samsung need on-device bridges (no server pull).
3. **Avatar pipeline:** Ready Player Me shut down — pick the replacement (Avaturn /
   in-house / commissioned rigs) early; it blocks the Twin's "make it you."
4. **Obsidian coupling:** it's a local app, not a backend — treat it as an open *format* +
   optional view, never a hard dependency. Ship the Markdown export for everyone; reserve
   live MCP sync for the self-hosted / power tier.
5. **Medical safety:** stays an educational, non-diagnostic tool; elevated tiers say "see
   your doctor." Never drift into medical claims.
6. **Multi-user is a real re-architecture:** today it's single-user by design (one DB, one
   key). Phase 2 is genuine engineering, not a flag flip — sequence it deliberately after
   the experience is undeniable.
7. **OpenClaw maturity:** young, fast-moving project — wrap it behind our own interface and
   keep the deterministic core independent of it.

---

## 10. Taglines (pick one for the film/deck)

- **"Own your health. Level yourself up."**
- **"Two things grow with you: your body, and your coach."**
- **"The fitness app that finally knows *you* — and never sells you."**
- **"Your health. Your files. Forever."**
- **"Built it. Became it."**

---

## References (grounding research)

- OpenClaw — open-source local AI agent: <https://openclaw.ai/> ·
  overview: <https://www.digitalocean.com/resources/articles/what-is-openclaw>
- Wearable data APIs (Apple/Samsung/Whoop/Garmin/Oura) & unified layer:
  <https://openwearables.io/>
- Obsidian (local Markdown vault, graph) & the Local REST API + MCP plugin:
  <https://github.com/coddingtonbear/obsidian-local-rest-api>
