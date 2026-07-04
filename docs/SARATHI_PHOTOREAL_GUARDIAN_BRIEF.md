# Sarathi — Photoreal Cinematic Guardian · Art-Direction & Generation Brief

**Goal:** generate ONE master character we both agree is "the one" — a **photoreal, film-grade
cinematic guardian** (not anime, not game-render). Everything downstream (stills, the 7 scene
videos, the web demo) is rebuilt from this master. Lock the character before building anything.

## The look (the fix)
Photoreal and cinematic — think **live-action epic**, not stylized:
- Touchstones: *Dune* (Villeneuve) restraint & scale · *Gladiator* / mythic realism · AAA
  in-engine cinematics (real skin, real metal, real cloth). **Not** anime, cel-shading, MOBA/gacha
  splash art, or shiny "AI doll" plastic.
- Real skin with pores and subsurface warmth; brushed, scratched, worn metal; heavy draped cloth;
  physically-based light. One dramatic key + rim; deep near-black environment; volumetric haze.

## Character (Sarathi — the charioteer-guardian)
- Heroic athletic man, early-30s; warm brown skin; dark wavy hair; short beard; **calm, powerful,
  benevolent** expression (a guide, not a brawler). Real human proportions.
- **Signature details, in a realistic register:**
  - Obsidian-black plate armor with **molten-gold filigree**; a **chariot-wheel** motif on
    shoulders + belt buckle.
  - A **glowing teal/cyan circular vault-core** emblem set into the chest plate (real emissive
    glow, subtle — the Health Vault).
  - A **radiant gold mandala halo** ring behind the head (practical light, not a sticker).
  - Long dark **cape** with gold-trimmed edges and faint glyphs.
- Palette: obsidian black + molten gold `#f5b572` + teal vault-glow `#2ec4b6`/`#4cc9f0`.

## Ready-to-paste prompts
Pick your tool; generate several, we cull to one.

**Midjourney v7** (recommended for photoreal):
> cinematic full-body hero portrait of a divine warrior-guardian, a modern mythic charioteer —
> heroic athletic man early 30s, warm brown skin, dark wavy hair, short beard, calm powerful
> benevolent expression — wearing intricate obsidian-black plate armor with molten-gold filigree
> and a chariot-wheel motif on shoulder guards and belt, a softly glowing teal circular core
> emblem embedded in the chest plate, a radiant gold mandala halo ring behind his head, long dark
> cape with gold-trimmed edges — photorealistic, hyperdetailed PBR materials, real skin texture
> with pores, brushed scratched worn metal, draped cloth, volumetric god-rays, dramatic rim
> lighting, deep black background, shallow depth of field, shot on ARRI Alexa 85mm, cinematic
> color grade, subtle film grain --style raw --ar 2:3 --v 7
>
> negative intent: `--no anime, cel-shading, cartoon, videogame render, plastic skin, cgi doll, oversaturated, low detail`

**Flux 1.1 Pro / Seedream / Dreamina** (same intent, prose):
> A photorealistic cinematic full-body portrait of a divine charioteer-guardian: an athletic man
> in his early thirties, warm brown skin, dark wavy hair and short beard, calm and powerful. He
> wears obsidian-black plate armor etched with molten-gold filigree and a gold chariot-wheel on
> the shoulders and belt; a glowing teal core emblem is set in his chest; a radiant gold mandala
> halo glows behind his head; a long dark gold-trimmed cape falls behind him. Real skin texture,
> worn metal, dramatic rim light, volumetric haze, deep black background, shallow depth of field,
> shot on cinema camera, 85mm, film grain, epic and reverent. Not anime, not cartoon, not a game render.

## Shot list (generate all — this is the master sheet)
1. **Hero full-body, front** — the master (teal core lit, halo glowing). `--ar 2:3` / 9:16.
2. **3/4 view** · 3. **Side** · 4. **Back** (cape + halo). *(for future 3D/consistency)*
3. **Chest closeup** — the teal vault-core detail.
4. **Face/head closeup** — halo + eyes.
5. **Guiding gesture** — full body, one hand extended toward viewer (the CTA pose).
- Also render **one 16:9 hero** framing for the website background.

## Consistency (so all shots are the SAME man)
- Midjourney: generate the hero first, then use `--cref <hero-image-url> --cw 100` on the other
  shots; keep the same prompt + `--seed`.
- Dreamina/Seedream: use its **character reference** feature with the chosen hero as reference.

## "The one" — acceptance
We lock a master when: it's unmistakably **photoreal** (reads as live-action, not illustration),
it carries the signature details (teal core, chariot-wheel, gold halo, cape), the face is
consistent across views, and *you* would put it in front of investors. Send me 3–5 candidates and
I'll help you pick + note tweaks.

## Handoff → what I do once the master is locked
1. Optimize + place the stills (`web/public/img/`), rebuild the Gate + story photoreal around them.
2. You generate the **7 scene videos** from the master (image-to-video, same character) using the
   prompts in `docs/SARATHI_STORYBOARD.md` — I integrate each with its motion.
3. Rebuild the demo's visual language to match the new film-grade register (darker, restrained,
   cinematic typography + grade). The current stylized demo is retired once the master lands.
