# Sarathi — Strategy & Positioning (competitive-informed)

*Source: a 2026 competitive-landscape review of AI-fitness / privacy-health apps
(WHOOP, Garmin, Future, Fitbod, Hevy, Strong, HealthifyMe, Forjum, Cronometer,
Exist, et al.). This doc turns that research into decisions. It supersedes the
positioning notes in `VISION.md` where they conflict; the 9-pillar vision still
stands as the product's soul.*

> **One-line positioning:** *"Two things grow with you — a body you can see, and a
> coach that actually remembers you."* Lead with the emotional layer (Twin) and the
> memory layer (Hermes). Prove it rationally with per-muscle readiness. Close with
> privacy. Never lead with the recovery+strength combo or NL logging.

---

## 1. The honest white-space map

| Claim | Verdict | What we do about it |
|---|---|---|
| **Hermes — coach with real, lifelong memory** | **Our wedge (differentiated by execution)** | Every incumbent AI coach is hated as generic/recycled/memoryless. Make Hermes *visibly* remember. Lead with it. |
| **Twin that builds muscle with your lifting** | **Closest to true white space** | Near-unique (only Forjum). Lead as emotional signature — but *validate retention before betting the company*. |
| **Per-muscle, lifting-first readiness** | **Real white space inside lifting** | Exploits Garmin's documented gap (no per-muscle neuromuscular recovery) + lifters' #1 wishlist. Our rational proof point. |
| **Privacy / own-your-data (Markdown Vault)** | **Trust close, not headline** | "99% care about features." Use the Vault export as the close that makes people trust us with health data. |
| Natural-language logging | **Table stakes** | Required to compete, not a differentiator. Win on parse accuracy + frictionlessness only. |
| Recovery + strength in one app | **NOT white space — WHOOP/Garmin own it** | Do NOT frame as novel. Reframe to "lifting-first readiness, on any watch, no $300 band required." |

## 2. The wedge, stated plainly

The loudest, most validated pain in the whole category: **AI coaches are generic and
forgetful** — users literally call WHOOP's $199/yr coach "total slop, just ChatGPT
with extra data." Two structural advantages we already have answer this directly:

1. **Hermes + the Health Vault = real memory.** It remembers goals, wins, language,
   excuses — and brings them up. No incumbent does this.
2. **The deterministic core = it can't hallucinate.** Lifters' #4 complaint is unsafe
   AI load recommendations. Our health math is pure code the LLM *explains*, never
   guesses. We are safe to trust precisely where others aren't.

**Everything in the product should ladder up to: "the coach that knows you, and a body
you watch grow."**

## 3. Product decisions that follow

**Build / deepen (in priority order):**
1. **Hermes memory depth & proactivity** — the wedge. Make it visibly recall your
   history, spot patterns over time, and never feel generic. This is where to out-
   execute a crowded field.
2. **Per-muscle readiness** — "which muscles are recovered enough to train hard
   today." Exploits Garmin's exact gap; answers lifters' top request; rational proof.
3. **Twin leveling visuals** — the emotional hook. Make muscle growth visible and
   tied to logged volume/PRs. Lead with it in demos; instrument retention.
4. **Google Fit / Health Connect ingest** — see §5. Unlocks India + universal sync
   cheaply via the normalized `/v1/sync/wearable` endpoint we already have.

**Keep but stop over-selling:** NL logging (table stakes — just make it accurate),
the recovery+strength combo (reframe, don't headline).

**Hold / validate before investing heavily:** Twin retention impact (it's our best
white space but unproven — gimmick risk if there's no "why progression matters" loop).

## 4. Messaging hierarchy

- **Hook (get them in):** "A body you can see grow, and a coach that actually
  remembers you." (Twin + Hermes.)
- **Proof (make it rational):** "Readiness, per muscle, on the watch you already own —
  no $300 band required." (Per-muscle readiness, wearable-agnostic.)
- **Close (earn trust):** "Your health, your files, forever." (Markdown Vault export.)
- **Do not headline:** NL logging; "recovery + strength combined."

## 5. India is the wedge — and it reshapes the wearable plan

- **The seam:** Indians use *two apps* — "HealthifyMe for diet, Strong for lifting."
  Sarathi's integrated readiness+strength+nutrition product attacks that seam directly.
  Position explicitly against the two-app status quo.
- **HealthifyMe owns localized diet** (best Indian-food DB, "Ria" coach, ~₹2,400/yr).
  Don't fight it head-on on food breadth; win on the coach-with-memory + Twin + the
  integrated whole.
- **Wearable reframe (important):** budget watches — boAt, Noise, Fire-Boltt = the
  mass market — have **no direct SDKs; they all sync to Google Fit / Apple Health /
  Health Connect.** So integrating the **hubs** inherits the entire installed base
  with zero per-device deals. **The highest-leverage sync work is Google Fit /
  Health Connect ingest, not a native iOS app.** Our normalized ingest endpoint
  already fits; this is mostly a connector + onboarding flow.
- **Caveat to test:** HRV quality from sub-₹3,000 watches is unverified — readiness
  may need to degrade gracefully to steps/HR/sleep when HRV is unreliable.

## 6. Pricing

| Tier | Anchor | Plan |
|---|---|---|
| **Free** | beats Hevy on logging | NL logging, basic readiness, the Twin, limited Hermes |
| **Pro (global)** | Fitbod/Freeletics $80–160/yr | Full Hermes depth, per-muscle readiness, advanced nutrition, premium Twin, Vault live-sync |
| **Pro (India)** | HealthifyMe ~₹2,400/yr | Same, rupee-anchored |

Tension to manage: lifters expect $3–5/mo "tracker" pricing; the Hermes/AI depth
justifies more. Resolve with a genuinely useful free tier + a Pro tier whose value is
the *coach and the Twin*, not the logging.

## 7. Two validation experiments (cheap, high-information)

1. **Twin retention:** does a muscle-morphing avatar actually retain, or churn as
   novelty? (Forjum/HeroFit-style apps are the comparison.) Instrument it before
   betting the company on the Twin.
2. **Budget-wearable HRV quality:** is HRV from boAt/Noise/Fire-Boltt (via the hubs)
   reliable enough to drive a daily readiness score? A small hands-on trial answers it.

## 8. What this does NOT change

The 9-pillar vision, the privacy gate, the deterministic core, "two growth bars," and
the India-first thesis all stand. This doc sharpens *what we lead with* and *what we
build next* — it doesn't change what Sarathi is.
