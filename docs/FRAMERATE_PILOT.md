# Framerate.space — Sarathi Pilot (test before we commit)

Goal: in ~30 min on your logged-in account, find out if Framerate can build the Sarathi
scroll-story at our quality bar. Build a **3-beat pilot** (Gate → Heart → CTA), then decide.
Nothing we've built is at risk — our own engine remains the fallback and the integration target.

## What to verify while piloting (the deal-breakers)
- [ ] **Own-image upload:** can you upload `sarathi` master art (the `+` in the prompt box?) as
      the scene source? If yes → our exact character. If no → note whether its generated
      guardian is good enough to *become* the master.
- [ ] **Consistency:** is the SAME figure in all chained scenes, or does he drift?
- [ ] **Quality:** photoreal-cinematic (film still) or AI-slop? 60fps scroll actually smooth?
- [ ] **Export:** do a Full Site Export — what do you get (HTML/JS? React?)? Watermark? Which
      plan is it gated behind, and the price?
- [ ] **Credits:** what does the pilot consume on the free tier?

## Master site prompt (paste into "Describe your website")
> A cinematic, scroll-driven story website for "Sarathi" — a private AI health coach, inspired
> by the Bhagavad Gita: the user is the warrior, Sarathi is the divine charioteer who guides
> them. Dark, premium, film-grade look: obsidian black, molten gold (#f5b572), one glowing
> teal accent (#2ec4b6). The entire site follows ONE photorealistic divine guardian character —
> a heroic athletic man in his early thirties, warm brown skin, dark wavy hair, short beard,
> calm powerful expression, wearing obsidian-black plate armor with molten-gold filigree, a
> gold chariot-wheel motif on shoulders and belt, a glowing teal circular core in his chest
> plate, a radiant gold mandala halo behind his head, and a long dark gold-trimmed cape.
> Photorealistic, live-action epic register (Dune / Gladiator) — NOT anime, NOT cartoon, NOT a
> videogame render. Structure: (1) HERO — the guardian stands in a black void, halo igniting,
> gold embers rising, slow push-in; headline "Own your health. Talk to it. Watch yourself level
> up." with a gold "Meet your Twin" CTA button. (2) THE HEART — the camera moves to his chest;
> the armor plates ignite along gold seams and bloom open in concentric rings revealing a
> molten-gold heart with the teal core beating inside; text "It knows when to rest — sleep, HRV
> and strain become one readiness score." (3) THE INVITATION — he extends an open hand toward
> the viewer, halo flaring to full; text "Meet your Twin. Sixty seconds to begin. A lifetime
> that's yours." with the sign-up CTA. Seamless video flow between the three scenes, scroll-
> driven, volumetric god-rays, film grain, reverent and mythic tone.

## If it asks for per-scene prompts / edits (iterative chat)
- **Scene 1 fix-ups:** "same character, slower push-in, more negative space, headline bottom-left"
- **Scene 2 (Heart):** "same character; chest plates unlock outward in concentric mandala rings;
  molten-gold anatomical heart with teal core; heartbeat light pulses; settle on the heart"
- **Scene 3 (CTA):** "same character turns to camera and extends an open hand; gold mandala halo
  flares to full radiance; warm light fills frame; welcoming"
- Global: "keep the exact same man, same armor and materials, in every scene — no character drift"

## Decision gate (after the pilot)
- **PASS** (consistent character + film-grade + clean export): scale to the full 7 beats
  (prompts in `docs/SARATHI_STORYBOARD.md`), export, and Claude integrates the export into the
  repo as the pre-auth homepage (auth + app untouched) — or mines its scroll engine into ours.
- **PARTIAL** (great videos, weak site/export): use Framerate as a **video factory only** —
  download the scene videos and drop them into our existing `SarathiStory` engine (slots ready).
- **FAIL** (drifting character / AI-slop / export gated beyond budget): walk away; continue the
  Tripo master → Dreamina scenes → our engine path. Nothing lost.

## Who drives
- Option A: Claude drives it live via the Chrome extension (open framerate.space in Chrome with
  the Claude-in-Chrome extension connected, stay logged in).
- Option B: paste this file to Claude cowork (same operator rules as the Tripo runbook).
- Option C: you drive, 30 minutes, using the prompts above; report the checklist.
