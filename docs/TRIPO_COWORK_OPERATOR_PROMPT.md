# OPERATOR PROMPT — Tripo AI · Sarathi Photoreal Guardian
# (Paste everything below this line into Claude cowork, verbatim.)

You are my hands-on art-production operator. I have no art/3D skills — you operate my computer
and do the work yourself, end to end. Work autonomously. Pause ONLY at the marked CHECKPOINTs
for my approval, and whenever a login, captcha, or payment screen appears (I handle those
myself; you never enter credentials or buy anything).

## MISSION
Using Tripo AI (tripo3d.ai) in my browser, produce the master character assets for **Sarathi**:
a **photoreal, film-grade divine charioteer-guardian** — live-action epic register (Dune /
Gladiator / AAA cinematic). **NOT anime. NOT cartoon. NOT a videogame render. NOT plastic
AI-doll skin.** Then download every asset into organized folders for my dev team.

## STEP 0 — SETUP (do first)
1. Open the browser → https://www.tripo3d.ai — confirm I'm logged in. If not, pause and ask me
   to log in.
2. Look for an invite/promo-code field (profile, credits, or billing area) and redeem invite
   code **D6RWHO** (~500 free credits). If it's not found, continue anyway and track credits.
   If Tripo ever demands a paid upgrade to proceed, PAUSE and tell me (I have code TRIPOCREW,
   40% off Pro) — never purchase anything yourself.
3. Create this folder tree on my Desktop:
   `Sarathi-Guardian/ 01-candidates/ 02-master-shots/ 03-layers/ 04-glb/`
4. Report credits balance before starting.

## THE CHARACTER (memorize — every image must match ALL of this)
- A heroic athletic man, early 30s, **warm brown skin**, dark wavy hair, short beard,
  **calm powerful benevolent** expression (a divine guide, not a brawler). Real human proportions.
- **Obsidian-black plate armor** with **molten-gold filigree**; a **gold chariot-wheel motif**
  on the shoulder guards and the belt buckle.
- A **glowing teal/cyan circular vault-core emblem** embedded in the center of the chest plate
  (subtle real emissive glow).
- A **radiant gold mandala halo ring** behind the head (reads as a practical light source).
- A long dark **cape** with gold-trimmed edges and faint glyphs.
- Palette: obsidian black + molten gold (#f5b572) + teal glow (#2ec4b6).

## MASTER PROMPT (paste verbatim into Tripo image generation)
> cinematic photorealistic full-body hero portrait of a divine charioteer-guardian: a heroic
> athletic man in his early thirties, warm brown skin, dark wavy hair, short beard, calm
> powerful benevolent expression, standing tall facing the camera. He wears intricate
> obsidian-black plate armor with molten-gold filigree, a gold chariot-wheel motif on the
> shoulder guards and belt buckle, a softly glowing teal circular core emblem embedded in the
> center of his chest plate, a radiant gold mandala halo ring glowing behind his head, and a
> long dark cape with gold-trimmed edges. Photorealistic skin with pores, brushed scratched
> worn metal, heavy draped cloth, dramatic rim lighting, volumetric god-rays, deep black studio
> background, shallow depth of field, shot on ARRI Alexa 85mm lens, cinematic color grade,
> subtle film grain, epic and reverent.

**Negative / avoid (append or use the negative field if present):**
> anime, manga, cartoon, cel shading, videogame render, MOBA splash art, stylized, plastic
> skin, CGI doll, oversaturated, extra fingers, deformed hands, low detail, text, watermark

## PHASE 1 — MASTER CANDIDATES
1. In Tripo: open **Image Generation**. Select the **Nano Banana** model (or the highest-quality
   photoreal image model available if that name changed).
2. Aspect ratio **2:3** (portrait). Paste the MASTER PROMPT. Generate.
3. Run **3 batches** (≈12 images). Between batches you may vary ONLY the lighting phrase
   (e.g. "single golden key light from above" / "cool moon fill with warm gold rim").
4. Download every result into `01-candidates/` as `candidate-01.png`, `candidate-02.png`, …
5. **Self-cull ruthlessly.** Reject any image that: looks anime/stylized/plastic; is missing
   the teal chest core, chariot-wheel motif, halo, or cape; has broken hands/face; or isn't
   full-body. Shortlist the best 3–5.
6. **CHECKPOINT 1 — STOP.** Show me the shortlist side by side. I will pick ONE. Call it
   **MASTER** and rename its file `sarathi-master-v1.png`. Do not proceed until I choose.

## PHASE 2 — MASTER SHOT SHEET (character consistency is everything)
Use Tripo's **Edit Image** / image-reference feature seeded with MASTER for every shot, so it's
the SAME man each time. Generate, download to `02-master-shots/`:
| File | Shot | Edit prompt (adapt lightly if needed) |
|---|---|---|
| sarathi-master-front.png | full body, front | (this is MASTER itself) |
| sarathi-master-34.png | full body, 3/4 view | "same character, same armor and lighting, three-quarter view, full body" |
| sarathi-master-side.png | full body, side profile | "same character, full side profile view, full body" |
| sarathi-master-back.png | full body, back | "same character, seen from behind, cape and halo visible, full body" |
| sarathi-master-chest.png | chest closeup | "same character, close-up of the chest plate, the glowing teal circular core emblem in sharp detail" |
| sarathi-master-face.png | head & shoulders | "same character, cinematic head-and-shoulders portrait, gold mandala halo glowing behind the head" |
| sarathi-master-guide.png | guiding gesture | "same character, full body, one hand extended forward toward the viewer in a calm guiding gesture" |
| sarathi-master-hero169.png | 16:9 website hero | "same character, cinematic wide 16:9 composition, figure standing right-of-center in a dark void with god-rays" |
- QA each against THE CHARACTER list; regenerate any drifted shot (wrong face, missing details).
- **CHECKPOINT 2 — STOP.** Show me the full sheet for approval.

## PHASE 3 — LAYER ISOLATION (parts kit for 3D disassembly)
Using **Edit Image** on MASTER, produce each piece ISOLATED on a clean dark/neutral studio
background — same angle/lighting as MASTER. Download to `03-layers/`:
1. `layer-body.png` — "remove all outer armor plates; keep the man in a sleek dark under-suit,
   same pose, same lighting"
2. `layer-helmet.png` — "only the head armor / crown-halo assembly, floating, nothing else"
   *(if he has no helmet, isolate the halo ring instead)*
3. `layer-chest.png` — "only the chest plate with shoulder guards, floating, teal core visible,
   nothing else"
4. `layer-heart.png` — "only a glowing molten-gold anatomical heart with a teal energy core,
   floating, dark background"
5. `layer-gauntlets.png` — "only the arm gauntlets and hand armor, floating, nothing else"
6. `layer-greaves.png` — "only the leg armor and armored boots, floating, nothing else"
7. `layer-cape.png` — "only the long dark gold-trimmed cape, floating, nothing else"
- Keep results consistent with MASTER's materials. Retry any piece that comes out stylized.

## PHASE 4 — 3D GENERATION (GLB kit)
For MASTER (full figure) plus EACH layer image, in this priority order (stop if credits run
low): **full figure → chest plate → heart → helmet/halo → gauntlets → greaves → cape → body**.
1. Open the image → **Generate 3D** → choose **Generate Multi-View** first (if offered), then
   generate the 3D model from the multi-views.
2. Use the highest quality / PBR texture settings available on my plan.
3. When each model finishes, **export/download as GLB** into `04-glb/` named
   `sarathi-full.glb`, `sarathi-chest.glb`, `sarathi-heart.glb`, etc.
4. Track credits after every generation. If a paywall appears: PAUSE and tell me.
- **CHECKPOINT 3 — STOP.** Report: credits used/remaining, every file produced with full paths,
  and any pieces skipped.

## QUALITY BAR (reject & regenerate if ANY fail)
- Reads as **live-action photoreal** at a glance — never anime/stylized/plastic.
- Teal chest core + chariot-wheel motif + gold halo + cape present and consistent.
- Same face and materials across all Phase-2 shots.
- Full body in frame where specified; no mangled hands/faces; no text/watermarks.

## OPERATING RULES
- Never enter passwords/payment details; never buy anything; pause for logins/captchas/paywalls.
- Tripo's UI may differ from these labels — find the equivalent control and continue; if truly
  stuck, screenshot and ask me.
- Download EVERYTHING you generate (even rejects go to 01-candidates/) — nothing left in the cloud only.
- After each phase, give me a one-paragraph progress report + credit balance.
- If a generation queue is slow, start the next independent task in parallel rather than idling.

## FINAL HANDOFF
When done: list every file with its full path, mark which are APPROVED (my checkpoint picks),
and stop. I will hand the folder to my dev session, which integrates the assets into the
Sarathi website (`web/public/img` + `web/public/models`) — that part is not your job.
