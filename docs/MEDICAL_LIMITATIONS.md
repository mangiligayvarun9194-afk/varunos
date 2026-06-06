# VarunOS — Medical Limitations

*Honest list of what the system does and does not claim. Read this before deploying to any real user.*

---

## What this system is

VarunOS is a **personal health risk stratification tool**. It takes inputs you provide (BP readings, glucose values, weight, family history, lab values) and computes your risk tier using **validated, published screening tools** (IDRS, FINDRISC, ASCVD-2018, ACC/AHA 2017, CHA2DS2-VASc, the Battelino 2019 CGM consensus, ADA 2024, ICMR cutoffs for Indian populations).

The tools it uses are the same ones a doctor would use to get a quick risk estimate. They are **screening tools**, not diagnostic tests.

## What this system is NOT

- **Not a medical device.** It is not FDA-cleared, CE-marked, or approved by any regulatory body as a medical device. It is a personal-use educational tool.

- **Not a diagnostic tool.** It does not diagnose diabetes, hypertension, heart disease, stroke, or any other condition. Outputs are **risk tiers** — labels that say "your data suggests an elevated risk" or "see your doctor within 1 week." They are not diagnoses.

- **Not a substitute for a doctor.** Every health-related response includes a `disclaimer` field and an `action_label` field. The action labels are intentionally conservative: "discuss with your doctor", "see your doctor within 1 week", "call your doctor today or go to the ER if you have symptoms."

- **Not a replacement for blood tests, ECGs, imaging, or any clinical exam.** All of those require in-person evaluation.

- **Not real-time medical monitoring.** The system does not continuously monitor. The user logs readings; the system computes tiers. There is no continuous "watcher" mode.

- **Not approved for medication decisions.** The system never recommends a specific medication, dose, or change in treatment. It only surfaces the validated risk tier and a generic "discuss with your doctor" action.

## What the system explicitly does NOT do

- **Does not diagnose.** Diagnostic language is detected and replaced with safe alternatives (see `varunos/core/safety.py`). 14 unit tests verify this. If a brain output slips through with diagnostic phrasing, the system-level redactor catches it.

- **Does not auto-dial 911/108/112.** The escalation flow shows the user a recommendation and the relevant emergency number. The user must press the button. The exception: the FAST stroke detection and the "chest pain at rest > 5 min" rule tell the user to call now; they do not auto-dial.

- **Does not share data with insurers, employers, or any third party.** There is no such code path.

- **Does not train any model on user data.** There is no such code path.

- **Does not override the user's choices.** If the user dismisses a CRITICAL alert, the system logs the dismissal but does not re-escalate against the user's will.

- **Does not store data on the AI provider.** Brain-layer calls (when implemented) go to a configurable provider (Gemini/Claude/MiMo via OpenRouter). The brain is told to never see raw biomarkers — it sees only tier strings and action labels. **The MVP in this PR does not yet have a brain layer.** All numerics are computed deterministically in the core and never leave the box.

## What the system CAN do wrong

| Failure mode | Mitigation |
|---|---|
| User enters a wrong BP value | Input validation rejects out-of-range values (SBP 50-260, DBP 30-160). |
| User misreads the tier | Tier chips are color-coded (green/yellow/orange/red). The action label is always plain English. |
| AI brain makes a diagnostic statement | The redactor in `varunos/core/safety.py` catches 8+ patterns. 14 tests verify. |
| Network drops during emergency escalation | The alert is logged server-side; the next /v1/observability/events call returns it. |
| User data leaks via API | All endpoints require auth. CORS is allowlisted. The user can hard-delete everything. |
| User has a real emergency and only uses VarunOS | The system is explicit: "call 911/108/112 now" for FAST/chest pain. It is a coach, not an emergency service. |

## The validated tools used (all peer-reviewed)

| Tool | Reference | Used for |
|---|---|---|
| IDRS | Mohan et al. 2005 | Indian diabetes risk |
| FINDRISC | Finnish Diabetes Association | European diabetes risk |
| ACC/AHA 2017 BP | Whelton et al. 2018 | BP staging |
| ASCVD 2018 | Goff et al. 2014 | 10-year CVD risk |
| QRISK3 | Hippisley-Cox et al. 2017 | UK alternative |
| CHA2DS2-VASc | Lip et al. 2010 | Stroke risk in AFib |
| TIR Consensus 2019 | Battelino et al. 2019 | CGM metrics |
| ADA 2024 | Standards of Care | Diabetes thresholds |
| ICMR | Indian Council of Medical Research | Indian BMI/waist cutoffs |

The **Indian 1.3× ASCVD adjustment** is a **heuristic**, not a validated tool. It is applied only when the user opts in (`south_asian_adjustment: true`). The disclaimer is in the response. If you disagree with the heuristic for a specific user, treat the un-adjusted PCE number as the floor.

## What to tell your doctor when you share

When you generate a doctor-share PDF, the doctor receives:
- Last 6 months of relevant biomarkers
- Risk scores (IDRS / ASCVD / BP stage) with input table
- Family history summary
- Lifestyle summary
- Current medications
- Symptoms logged in last 90 days
- The disclaimer

The doctor-share is meant to **save the doctor 5 minutes of questions**, not replace the visit. The doctor will still want to:
- Take the patient's history themselves
- Do a physical exam
- Order any imaging/labs they think are needed
- Apply their own clinical judgment

## Liability

The system is provided as-is. The author(s) make no warranty as to the accuracy of the risk computations, the appropriateness of any action label, or the fitness of the system for any particular use case. **Use at your own risk.** If you are a clinician considering deployment in a clinical setting, consult your institution's regulatory affairs team.

## What to do if you find a bug in the medical safety rails

Open a critical-priority issue at the project repository. The safety rails are the highest-value code in the system. A bug here can cause real-world harm.

The team commits to:
- Acknowledge within 24 hours
- Fix HIGH/CRITICAL bugs within 7 days
- Add a regression test that fails on the original input and passes on the fix
- Add a CHANGELOG entry

**The safety rails are non-negotiable. They are the product.**
