# VarunOS — Health Data Architecture

*The design that turns VarunOS from a fitness app into a personal health data bus.*

## North star

Whoop locks you to Whoop. Oura locks you to Oura. Apple Health is a vault you
can't reason over. **VarunOS ingests from every source, owns nothing
proprietary, and the math is auditable.** That is the moat.

## The spine: one canonical event log

Everything funnels into an append-only `health_event` table:

```
HealthEvent {
  id, user_id, ts, ingested_at,
  source,       # apple_health | fitbit | oura | dexcom | withings | manual | lab
  device,       # "Apple Watch S9"
  kind,         # hrv | rhr | sleep | glucose | bp | weight | spo2 | steps | hba1c ...
  value_json,   # normalized
  unit, confidence,   # 0–1, for multi-source resolution
  dedup_key     # source+kind+ts → idempotent ingest
}
```

Everything else is derived and recomputable:

```
HealthEvent (raw, append-only)
   ↓ rollup        → DailySnapshot  (one row/day)
   ↓ baseline      → rolling 7/30/90d windows
   ↓ tiering       → deterministic core (existing)
   ↓ analysis      → Insights: correlations, anomalies, forecasts
   ↓ narration     → Brain (LLM, tier-only input)
```

Benefits: time-travel (replay any day), multi-source dedup, full auditability.

## Ingestion connectors (adapter pattern)

| Source | Method | Status |
|---|---|---|
| Apple Health | Shortcut POST | ✅ shipped |
| Fitbit / Oura / Whoop | server OAuth + webhook | roadmap |
| Dexcom / Libre CGM | OAuth polling | roadmap |
| Withings (scale/BP) | OAuth | roadmap |
| Lab results | PDF parse → events | roadmap |
| Context: weather, AQI, calendar | free APIs | roadmap |

Every connector normalizes into `HealthEvent`. New source = one adapter file.

## Intelligence layers (deterministic-first)

1. **Rollup** — events → daily snapshot
2. **Baseline** — rolling windows (shipped: 7d HRV, 30d RHR)
3. **Tiering** — validated screening tools (shipped)
4. **Anomaly / early-warning** — z-score / CUSUM on baselines
5. **Correlation engine** — lagged Spearman between behaviours ↔ outcomes
6. **Forecast** — EWMA + load model
7. **Narration** — LLM sees tiers + insights only, never raw biomarkers

## Flagship feature: the Correlation Engine

Personal causal insight from the user's own data:

> "Your HRV drops 18% the morning after you eat dinner past 9pm."
> "Readiness is +12 on days you walk 8k+ steps the evening before."
> "Your resting HR rises 2 days before every cold you've logged."

Pure deterministic statistics (rank correlation + lag), auditable, no
hallucination. This is the single feature no competitor offers in this form.

## Privacy-preserving Brain

The LLM coach sees tiers, action labels and insight summaries — never raw
glucose/BP. A coach that *cannot* leak your raw medical data.

## Build order

1. HealthEvent model + rollup (the spine)
2. Correlation + anomaly engine  ← flagship
3. One real OAuth connector (Oura/Fitbit)
4. Context fusion (AQI/weather)
5. The Brain (tier-only LLM)
