# VarunOS — Doctor's View

*A guide for clinicians receiving a VarunOS doctor-share packet.*

---

## What is this?

A patient has been using **VarunOS**, a personal AI coach that tracks training, diet, and cardiometabolic health. They've generated a doctor-share packet and shared it with you. This page explains what's in it, what the numbers mean, and what the system does and doesn't claim.

---

## What you'll receive

A single-page PDF (or a structured JSON if you prefer the API) containing:

| Section | What it has |
|---|---|
| **Biomarkers (recent)** | Last 6 months of: BP, fasting glucose, HbA1c, lipid panel, plus any other tracked markers. Values + dates + reference ranges. |
| **Risk assessments** | Validated scores: IDRS (diabetes), ASCVD 10-yr (CVD), BP stage, FINDRISC, CHA2DS2-VASc (if AFib). The **tier** is shown (LOW / ELEVATED / HIGH / CRITICAL), not just the raw score. |
| **Family history** | First-degree relatives: T2DM, CAD, stroke, hypertension, age at diagnosis. |
| **Lifestyle** | Smoking, alcohol (drinks/wk), exercise pattern, sleep summary, sodium estimate. |
| **Symptoms (last 90d)** | Free-form symptoms the patient logged, if any. |
| **Disclaimer** | Required legal copy. |

You can also receive a time-limited link (default 24h) for the structured JSON.

---

## What the tiers mean

Every risk score is bucketed into one of four tiers:

| Tier | Meaning | What it implies |
|---|---|---|
| **LOW** | Below the threshold for action | Routine screening as per guidelines |
| **ELEVATED** | Borderline / intermediate | Discuss at next routine visit |
| **HIGH** | Above threshold | See you (or relevant specialist) within 1 week |
| **CRITICAL** | Acute concern | Same-day evaluation / ER if symptomatic |

The tier is the **only** thing the AI coach ever shows the patient. The patient should be able to tell you "my BP tier is ELEVATED" without quoting a number. This is intentional — the goal is to drive behavior (schedule a visit, refill meds, do a screen) without medicalizing everyday life.

---

## What the system does NOT do

This is important. **The system does not diagnose.** It does not replace you.

- It does not claim a patient "has diabetes" — it says their IDRS tier is HIGH.
- It does not recommend a medication change — it says "discuss with your doctor".
- It does not interpret an acute symptom — it says "see doctor today or ER if symptoms".
- It does not generate clinical decisions — it surfaces validated risk scores that *you* interpret.

The validated risk tools it uses are:

- **IDRS** (Mohan et al. 2005) — Indian Diabetes Risk Score, validated in Indian populations
- **ASCVD 2018** (Goff et al. 2014) — Pooled Cohort Equations for 10-year CVD risk, ages 40-79
- **ACC/AHA 2017** (Whelton et al. 2018) — BP staging
- **FINDRISC** — Finnish Diabetes Risk Score
- **QRISK3** (Hippisley-Cox et al. 2017) — alternative for non-US
- **CHA2DS2-VASc** (Lip et al. 2010) — stroke risk in AFib
- **TIR Consensus 2019** (Battelino et al. 2019) — CGM metrics

You can verify any of these in a few minutes. The system does not invent.

---

## The Indian adjustment caveat

For ASCVD, the system applies a **1.3× multiplier** to the Pooled Cohort Equations estimate when the patient is South Asian AND under 50 AND has a family history of premature CAD. This is based on observational data showing that ASCVD risk is under-estimated in young Indian adults by the PCE (which was derived in US cohorts).

**This is a heuristic, not a validated tool.** The disclaimer flags this. If you disagree with the multiplier for a specific patient, treat the un-adjusted PCE number as the floor.

For more accurate risk in Indian populations, consider:
- **MDRF-ICMR INDIAB risk score** (if available)
- **Globorisk** calibrated to Indian cohorts
- **UKPDS risk engine** for known T2DM

---

## What to do with a doctor-share packet

1. **Open the PDF.** It's one page. Designed for the 30-second scan.
2. **Check the tier first.** Anything HIGH or CRITICAL is the headline.
3. **Check the trend.** A single reading is a data point; a 6-month trend is a signal.
4. **Read the symptoms log.** Free-form, may include stuff the patient wouldn't mention in person.
5. **Cross-reference with your own assessment.** The system doesn't have access to physical exam, imaging, or your clinical judgement.

If the packet shows HIGH BP tier but your in-clinic BP is normal, consider:
- Home BP log (the system has 30 days of this)
- White coat / masked hypertension check
- 24h ABPM if indicated

If the packet shows HIGH glucose tier but HbA1c is 5.5%, consider:
- Was the CGM a 2-week trial or continuous?
- Is the patient on any medication that affects glucose?
- Repeat OGTT in your clinic

---

## What the patient sees, and why

The patient sees **only the tier**, never the raw value (unless they explicitly ask for the doctor-share PDF). This is intentional design.

Why?

1. **Decoupling numbers from anxiety.** A patient who sees "138/85" may panic. A patient who sees "your BP tier is ELEVATED; see your doctor" makes an appointment.

2. **You don't have to debate a number in the visit.** "My fitness app said my BP was 138, that's not bad" is a real conversation the patient is trying to have. The tier system removes the number from the conversation.

3. **The brain doesn't medicalize.** The AI coach can talk about training, recovery, and diet without being a back-seat doctor. It refers to the tier, never to the disease.

If you want the patient to be more involved, you can tell them to enable "show numbers" in their preferences. The system respects patient autonomy here.

---

## What to do if you want to share back

If you have updates (medication changes, new lab orders, follow-up plan), the patient can paste them into VarunOS. The system will:

1. **Re-score** the relevant risk tier with the new inputs.
2. **Update the trajectory** (e.g. "BP tier now LOW after starting amlodipine").
3. **Log your visit** to the encrypted medical vault (with the patient's consent).
4. **Add your notes** to the Obsidian-style second brain for future reference.

This means the next doctor-share packet includes your visit notes and the patient's progress since.

---

## Privacy and consent

- The patient owns their data. You receive **only the packet they explicitly shared**.
- The packet is delivered via a time-limited link (24h default, configurable up to 7 days).
- After the TTL, the link expires; the data is not retained on the share server.
- The patient can **wipe** all their data with `surveillance wipe` — irreversible.
- The system does not contact you unsolicited. The patient must trigger the share.

---

## Questions?

If you're a clinician and have questions about how a specific value or tier was computed, the patient can show you the deterministic core's source code (it's open source). The exact function is in `varunos/core/surveillance/`. All functions are pure, fully tested, and match the published tool documentation.

If you find a discrepancy, please ask the patient to file a bug — the safety rails are the highest-value code in the system.

---

**The goal of this system is to get patients to you earlier, with better data, and to make your visit more efficient.** It is not a replacement for clinical judgement, a substitute for in-person examination, or an autonomous diagnostic tool.

If you have feedback, please open an issue at the project's repository. Clinician input directly shapes how this evolves.
