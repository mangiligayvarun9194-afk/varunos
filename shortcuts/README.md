# Sarathi — Smartwatch Auto-Sync & Siri Shortcuts

## ⌚ Auto-sync your watch every morning (the important one)

Sarathi reads HRV, resting heart rate, sleep and steps from **Apple Health**
and computes your readiness automatically — no taps. Apple Health already
aggregates data from Apple Watch, **and** from Fitbit / Oura / Whoop / Garmin
if you have their apps installed (they write into Apple Health). So this one
Shortcut covers almost every wearable.

### Build the morning auto-sync (one time, ~3 min)

1. Open the **Shortcuts** app → **Automation** tab → **+** → **Create Personal Automation**
2. Choose **Time of Day** → **7:00 AM** → Daily → Next
3. Tap **Add Action** and build this sequence:

   a. **Find Health Samples** → Sample Type: *Heart Rate Variability* → Sort by Start Date (Latest) → Limit 1
   b. **Get Numbers from Input** (from the sample) → save as variable `HRV`
   c. Repeat a–b for *Resting Heart Rate* → `RHR`
   d. Repeat for *Sleep Analysis* (sum hours asleep) → `SLEEP`
   e. Repeat for *Steps* (sum today) → `STEPS`

4. Add **Get Contents of URL**:
   - **URL**: `https://varunos.onrender.com/v1/sync/wearable`
   - **Method**: `POST`
   - **Headers**:
     - `Authorization` → `Bearer YOUR_API_KEY`
     - `Content-Type` → `application/json`
   - **Request Body**: JSON
     ```json
     {
       "source": "apple_health",
       "hrv_ms": HRV,
       "rhr_bpm": RHR,
       "sleep_hours": SLEEP,
       "steps": STEPS
     }
     ```
     (insert the variables where the capitalised names are)

5. Tap **Next** → turn **OFF** "Ask Before Running" → **Done**

That's it. Every morning at 7am your readiness is computed before you wake up.
Open the app (or the widget) to see today's GREEN / YELLOW / RED.

> **Tip — copy the exact values, don't type them.** Open the app →
> **Settings → Smartwatch sync → Set up auto-sync**. It shows three **Copy**
> buttons pre-filled with *your* server URL, your `Authorization` header, and the
> JSON body — so there's nothing to mistype.

### ✅ Verify it works (before you trust it)

In the app: **Settings → Smartwatch sync → Test connection**. This does a real
round-trip to the server with `dry_run` (it validates auth + reachability +
parsing and returns your readiness) **without writing anything** to your history.
A green `✓ Connection OK — would sync 4 metrics…` means the pipe is solid.

### Why this never breaks (built to be forgiving)

The `/v1/sync/wearable` endpoint is deliberately tolerant of real-world Health
data, so the automation runs smooth instead of silently failing:

- **Units & strings are fine** — `"65 ms"`, `"7.5 hr"`, `"8,041 steps"` all parse.
  You don't need "Get Numbers from Input" if it's awkward; send the sample as-is.
- **Missing metrics never fail the sync** — if a sensor has no reading that day
  (`""` / `"No Data"`), that field is skipped and the rest still syncs.
- **Lists & dictionaries are handled** — if a Health action returns a list of
  samples, the most recent numeric one is used.
- **Bad readings can't poison your trends** — physiologically impossible values
  (e.g. HRV 9999 ms) are dropped instead of corrupting your rolling baselines.
- **Re-running is safe** — syncing the same day twice merges, it never duplicates.

The server always replies with a clear receipt, e.g.
`{"ok": true, "received": ["HRV","RHR","Sleep","Steps"], "message": "Synced 4 metrics…"}`,
so you (or a Shortcut "Show Notification" step) can confirm exactly what landed.

### Don't have a wearable?
Use **Settings → Connect your smartwatch → Enter manually**, or just do the
6-tap morning check-in. Both produce a real readiness score.

### Android (Health Connect)
Use the **HTTP Shortcuts** app (free, Play Store) with the same URL, headers
and JSON body, reading from Health Connect. Same `/v1/sync/wearable` endpoint.

### Cloud wearables (Fitbit / Oura / Whoop) without Apple Health
These have official REST APIs. Server-side OAuth connectors are on the roadmap
(`docs/ROADMAP.md`); for now the Apple Health bridge above is the fastest path.

---

# Sarathi Siri Shortcuts Setup

## Quick setup (2 minutes)

### 1. "Hey Siri, Sarathi status"
1. Open **Shortcuts** app on iPhone
2. Tap **+** → **Add Action** → search "Get Contents of URL"
3. URL: `http://<your-server>:8000/v1/state/snapshot`
4. Method: POST
5. Headers: `Authorization: Bearer <your-key>`
6. Body (JSON):
   ```json
   {
     "profile": {"user_id":"varun","sex":"M","age":30,"height_cm":178,"weight_kg":78,"activity":"moderate","goal":"recomp"},
     "checkin": {"hrv_today_ms":58,"hrv_7d_baseline_ms":50,"rhr_today_bpm":58,"rhr_30d_baseline_bpm":60,"sleep_min":445,"sleep_deep_pct":17,"sleep_rem_pct":22,"sleep_eff_pct":92,"energy_1to5":4,"soreness_1to5":2,"mood_1to5":4,"stress_1to5":2,"acute_load":85,"chronic_load":100}
   }
   ```
7. Add **Speak Text** action with: "Readiness [Get Dictionary Value for overall from readiness]. [Get Dictionary Value for color from readiness] day."
8. Name it "Sarathi Status" and add to Siri

### 2. "Hey Siri, log meal" (voice input)
1. New Shortcut → **Ask for Input** (text, prompt: "What did you eat?")
2. **Get Contents of URL**: `http://<server>:8000/v1/foods/search?q=[Input]&limit=1`
3. **Get Dictionary Value** for `results` → first item → `id`
4. **Get Contents of URL**: POST to `http://<server>:8000/v1/logs/meals`
   Body: `{"food_id": "[id]", "portions": 1}`
5. **Speak Text**: "Logged [kcal] calories. Day total [day_kcal_total]."

### 3. "Hey Siri, log BP"
1. **Ask for Input**: "Systolic?" (number)
2. **Ask for Input**: "Diastolic?" (number)
3. POST to `/v1/surveillance/bp` with `{"sbp": [input1], "dbp": [input2]}`
4. **Speak Text**: "Blood pressure [stage]. Tier [tier]."

### 4. NFC Tags
1. Buy NFC215 stickers (₹50 for 10 on Amazon)
2. Open Shortcuts → **Automation** → **NFC**
3. Scan your tag → assign a shortcut:
   - **Kitchen tag**: "Log meal" shortcut
   - **Gym tag**: "Show workout" shortcut  
   - **Bathroom tag**: "Log BP" shortcut
   - **Bedside tag**: "Sarathi status" shortcut

### 5. iOS Widget
1. Long-press home screen → **+** → search "Shortcuts"
2. Add the "Sarathi Status" shortcut as a widget
3. Or: open `http://<server>:8000` in Safari → Share → **Add to Home Screen**
   This installs the PWA as a standalone app icon with the Sarathi icon.
