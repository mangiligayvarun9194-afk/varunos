# VarunOS — Medical Safety Rails

*This is the doctor-signed contract that the system will never, ever cross.*

---

## 0. Why this document exists

We are building a tool that:

1. Takes in real health data (BP, glucose, lipids, ECG).
2. Surfaces risk tiers to a non-medical user.
3. Coaches them based on those tiers.
4. Optionally escalates to emergency contacts.

**Every step has a medical-safety implication.** A wrong word in a coaching message ("you have pre-diabetes" instead of "your data suggests an elevated risk") can cause panic, unnecessary testing, or — worse — false reassurance that delays real medical care.

The seven hard rules below are encoded in code paths, not in AI prompts. **The brain is not trusted to be careful here.** If a brain output would violate a rule, the core rejects the output and falls back to a templated safe message.

---

## 1. The seven hard rules

| # | Rule | How enforced |
|---|---|---|
| 1 | **Never diagnose. Ever.** | `is_medical_claim()` regex detector. Every AI output passes through `redact_medical_claim()`. Diagnostic phrases are replaced with safe alternatives. |
| 2 | **Never replace a doctor.** | Every risk tier ≥ "ELEVATED" generates a "discuss with your doctor" call-to-action. `safe_action_label()` returns the only phrasing the brain may use. |
| 3 | **Medical disclaimer in every briefing.** | `validate_disclaimer_present()` checks every briefing. Built into the PWA, every email, every WhatsApp message. |
| 4 | **Critical thresholds trigger immediate escalation, not coaching.** | `escalate()` is called by the aggregator before the brain ever sees the data. Multi-channel blast within 5 seconds. |
| 5 | **Brain never sees raw biomarkers.** | The brain gets a tier string ("LOW", "ELEVATED", "HIGH", "CRITICAL") and an action label. Raw values stay in the encrypted vault. |
| 6 | **All biomarker data encrypted at rest.** | SQLCipher (AES-256), separate from the main DB. Decrypted only on explicit user action (e.g. doctor share). |
| 7 | **Opt-in. Off by default.** | Module ships disabled. User enables explicitly with `surveillance on`, confirms age, family history, consent. |

If any of these rules would be violated by an AI output, the core rejects the output and falls back to a templated safe message.

---

## 2. Rule 1: Never diagnose — the redactor

The brain is allowed to use only these phrases for narration:

```
"Your BP tier is ELEVATED."
"Continue your current habits; routine recheck as scheduled."
"Discuss with your doctor at your next visit."
"See your doctor within 1 week."
"Call your doctor today or go to the ER if you have symptoms."
```

The brain is **never** allowed to use:

```
"You have diabetes."
"You are pre-diabetic."
"You are hypertensive."
"You have high cholesterol."
"You need metformin / insulin / statins."
"You are suffering from..."
"You have been diagnosed with..."
```

The detector (`is_medical_claim()` in `varunos/core/safety.py`) catches 8+ regex patterns. The redactor (`redact_medical_claim()`) replaces each with a safe alternative. **The brain is not asked to be careful — the code enforces it.**

### 2.1 Test coverage

The safety rail is covered by 14+ dedicated tests. Examples:

```python
def test_detect_diagnosis_you_have(self):
    assert is_medical_claim("You have diabetes") is True
    assert is_medical_claim("Your readings suggest prediabetes") is False

def test_redact_replaces_you_have(self):
    text = "Based on the data, you have high cholesterol."
    out = redact_medical_claim(text)
    assert "you have" not in out.lower()
    assert "your data suggests" in out.lower()
```

---

## 3. Rule 4: Critical thresholds — the escalation flow

The system has hard thresholds that trigger immediate, multi-channel, no-softening escalation. The brain is not in this path.

### 3.1 Critical thresholds (deterministic)

| Reading | Threshold | Action |
|---|---|---|
| BP | SBP > 180 OR DBP > 120 | URGENT — multi-channel + "call doctor today" |
| BP | + symptoms (chest pain, SOB, vision change) | CRITICAL — multi-channel + "call 911 now" |
| Glucose | < 54 mg/dL | CRITICAL — "treat hypoglycemia NOW" |
| Glucose | > 300 mg/dL | CRITICAL — "go to ER if symptomatic" |
| ECG | AFib detected | HIGH — "see doctor this week" |
| ECG | AFib + symptoms | CRITICAL — "call 911 if severe" |
| HR | < 40 sustained 5+ min (non-athlete) | ELEVATED — "see doctor within 2 weeks" |
| HR | > 180 sustained 5+ min | HIGH — "ER if symptoms" |
| Symptoms | FAST positive (face, arm, speech, time) | CRITICAL — "call 911/108/112 NOW" |
| Symptoms | Chest pain at rest > 5 min | CRITICAL — "call emergency" |
| Symptoms | Sudden severe headache | CRITICAL — "call emergency" |

### 3.2 Multi-channel escalation flow

```
CRITICAL detected
  → push alert to user (WhatsApp, SMS, PWA push, email — ALL simultaneously)
  → place voice call with TTS
  → wait 60s for acknowledgement
  → if no ack → call emergency contact
  → generate one-page "share with doctor" PDF
  → log to vault with full timestamp and values
  → DO NOT include in daily/weekly briefing (avoid noise)
  → DO NOT summarize to LLM
```

### 3.3 The bot NEVER does

- **Never** auto-dial 911/108/112 (always user-confirmed, except FAST/chest pain where we tell the user to call)
- **Never** override user choice
- **Never** send PII to anyone other than the configured emergency contact

### 3.4 The bot ALWAYS does

- Reach all configured channels in < 5s
- Include the value, the time, the recommended action
- Offer the one-tap doctor-share PDF
- Log the full event for post-event review

---

## 4. Rule 5: Brain never sees raw biomarkers

The brain's input contract is **strict**:

**Allowed input:**
- Risk tier string: `"LOW" | "ELEVATED" | "HIGH" | "CRITICAL"`
- Action label string: `"Continue your current habits..."` etc.
- The body part or system: `"glucose" | "bp" | "cvd" | "ecg"`
- Trend direction: `"stable" | "rising" | "falling"`

**Forbidden input (the brain never sees):**
- Raw SBP/DBP numbers
- HbA1c values
- Glucose mg/dL values
- Lipid panel values
- CGM data
- Family history detail
- Medication list

The brain sees the tier; the core holds the values. Even when the user asks "what was my last BP?", the brain doesn't say "138/85" — it says "your last BP tier was ELEVATED; see your doctor". The raw number is available via the doctor-share PDF.

---

## 5. Rule 6: Encryption at rest

The medical vault is a separate SQLite database encrypted with SQLCipher (AES-256). The key is derived from the user's passphrase, never stored in plaintext.

| Control | Implementation |
|---|---|
| Encryption at rest | SQLCipher (AES-256), key derived from user passphrase |
| Encryption in transit | HTTPS (Twilio, Cloudflare Tunnel, ngrok) |
| AI brain access | **No raw values.** Only risk tier + label. |
| Hermes access | **No raw values.** Skill operates on tier only. |
| User download | Export entire encrypted vault as `.sqlite` + key separately |
| Doctor share | Explicit user action, time-limited link (24h default), PDF report only |
| Audit log | Every read/write to the medical DB logged with timestamp |
| Hard delete | `surveillance wipe` → all medical data shredded, key destroyed |
| Pause | `surveillance pause 30d` → no data collected, no reminders |
| LLM training opt-out | Surveillance data never reaches any training pipeline |
| Backup | Encrypted vault auto-backed-up to a private git repo (user's choice) |
| Local-only mode | Surveillance module can be 100% local — no adapter needs to leave the box |

---

## 6. Rule 7: Opt-in, off by default

The surveillance module ships **disabled**. The user must explicitly enable it with a series of confirmations:

```
surveillance on
  → confirms age, consent, emergency contact, family history
  → asks which adapters to enable (CGM, BP, ECG, lab import)
  → creates encrypted vault
  → first readings: enter manually if no adapter
  → runs first risk assessment
  → shows medical disclaimer
  → done

surveillance off
  → pauses everything (data preserved, no new reads)

surveillance wipe
  → hard delete of all medical data
  → destroys encryption key
  → irreversible
```

This means a default install of VarunOS has zero access to medical data. The user opts in deliberately.

---

## 7. The medical disclaimer

Every briefing, every email, every WhatsApp message contains the disclaimer:

> VarunOS Health Surveillance is an educational risk-stratification tool, not a medical device. It does not diagnose, treat, cure, or prevent any disease. All outputs are risk tiers computed from validated screening tools and the data you provide. If you have symptoms, an emergency, or any health concern, contact a licensed medical professional. In an emergency, call your local emergency number (911, 108, 112, etc.) immediately.

This is enforced by `validate_disclaimer_present()` in the safety module. No briefing leaves the system without it.

---

## 8. The validated risk tools

Every risk score is computed by a tool that has been published, peer-reviewed, and validated in clinical populations. None are invented.

| Tool | Reference | Used for |
|---|---|---|
| **IDRS** | Mohan et al. 2005 | Indian diabetes risk |
| **FINDRISC** | Finnish Diabetes Association | European diabetes risk |
| **ACC/AHA 2017** | Whelton et al. 2018 | BP staging |
| **ASCVD 2018** | Goff et al. 2014 | 10-year CVD risk |
| **QRISK3** | Hippisley-Cox et al. 2017 | UK alternative |
| **CHA2DS2-VASc** | Lip et al. 2010 | Stroke risk in AFib |
| **TIR Consensus 2019** | Battelino et al. 2019 | CGM metrics |
| **ADA 2024** | Standards of Care | Diabetes thresholds |
| **ICMR** | Indian Council of Medical Research | Indian BMI/waist cutoffs |

The Indian adjustment multiplier for ASCVD (1.3×) is explicitly flagged as a heuristic, not validated in a clinical trial. The user is told this in the disclaimer.

---

## 9. The doctor-share flow

When the user does need to see a doctor, the system builds a clean, time-limited packet:

```
/doctor-share [scope: cardio | endo | gp | full]
```

Generates a **single-page PDF** with:
- Last 6 months of relevant biomarkers (chart)
- Risk scores (IDRS / ASCVD / BP stage) with input table
- Trend arrows
- Family history summary
- Lifestyle summary (smoking, alcohol, sodium, sleep)
- Current medications
- Symptoms logged in last 90 days
- Recent ECG recordings (if any)

The PDF is shared via:
- Time-limited link (24h default, configurable)
- Direct WhatsApp to doctor's number
- Email
- Download as PDF

The doctor gets the picture in 30 seconds. The user gets a better visit. **No raw database is ever shared — only the curated, de-identified packet the doctor needs.**

---

## 10. What this module does NOT do

- It does **not** diagnose diabetes, hypertension, or heart disease.
- It does **not** prescribe medication or change doses.
- It does **not** replace blood tests, ECGs, or imaging.
- It does **not** advise on acute symptoms (always "see doctor" or "ER").
- It does **not** share data with insurance, employers, or third parties.
- It does **not** train any model on your data.

It **only**:
- Tracks data you provide or that comes from devices you connect.
- Computes validated risk scores deterministically.
- Surfaces risk tiers for the AI to narrate (without raw values).
- Reminds you to screen.
- Shares what you explicitly tell it to share.
- Escalates critical thresholds immediately.

---

## 11. What to do if you find a bug in the safety rails

Open a critical-priority issue. The safety rails are the highest-value code in the system. A bug here can cause real-world harm.

We commit to:
- Acknowledge within 24 hours.
- Fix within 7 days for HIGH/CRITICAL bugs.
- Add a regression test that fails on the original input and passes on the fix.
- Add a CHANGELOG entry.

**The safety rails are non-negotiable. They are the product.**
