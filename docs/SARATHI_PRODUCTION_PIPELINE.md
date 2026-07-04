# Sarathi — Production Pipeline (Figma × Tripo × Blender × After Effects → Web)

Adapted 1:1 from the "Stylized 3D Hero" workflow, but for the **photoreal Sarathi charioteer-
guardian** and the **7-beat body-descent story**. This is the pre-rendered path (render the 3D
offline, play it as video on the web) — confirmed as the right approach for this quality bar.

**Breakthrough:** the Tripo invite code = **500 free credits** → free image generation *and*
image-to-3D. That unblocks the master character (my own image credits were 0.18 = too low).

---

## Who does what (honest)
- **You / a 3D artist:** Tripo (web), Blender, After Effects — these are GUI craft tools I can't
  operate for you. Blender + AE need real skill; budget for a learning curve or a freelancer.
- **Me (Claude):** exact prompts, the layer/shot list, the beat-by-beat choreography + camera +
  lighting spec, render/export settings, and **all web integration** (drop clips in → our
  `SarathiStory` scroll engine scrubs them → ship). I also QA the final videos in the live site.

Because Blender/AE are the skill bottleneck, see **Two Lanes** at the bottom — there's a faster
route to the same on-screen result if you don't want to do Blender.

---

## Step 1 — UI (Figma optional)
He designed two hero states in Figma. **We already have the UI in code** (`SarathiCinematic` +
`SarathiStory`, 7 beats, nav, CTA, motion). So Figma is optional — skip it or use it only to
re-skin the hero to the new photoreal register. No dependency here.

## Step 2 — Generate the guardian (Tripo → Nano Banana)
In Tripo → **Image Generation** → **Nano Banana**, paste the photoreal prompt (full version in
`docs/SARATHI_PHOTOREAL_GUARDIAN_BRIEF.md`). Generate several, pick THE one. Studio background,
clean, centered, **full-body side-or-front** — same discipline he used for the car.

## Step 3 — Isolate + separate the layers (the key trick)
He removed the wheels/shadow and generated the **wheel separately** from the body. We do the same,
but for **armor layers** — so they can peel apart in the disassembly. Using **Edit Image**,
produce clean isolated pieces of the SAME guardian:
1. **Body/base** — the man + inner bodysuit, no outer armor (the "revealed" underneath).
2. **Helmet / faceplate** (Beat 1 — Mind).
3. **Gauntlets / arm plates** (Beat 2 — Hands).
4. **Chest plate + shoulder guards** (Beat 3 — Heart; this piece blooms open).
5. **The heart/vault-core** — a separate glowing organ/emblem (Beat 3/4 centerpiece).
6. **Greaves / leg armor** (Beat 5 — Foundation).
7. **Halo ring + cape** (persistent hero elements).
> Keep the same character/seed across every edit so the pieces belong to one figure.

## Step 4 — Generate 3D per piece (Tripo → Multi-View → 3D → GLB)
For each isolated piece: **Generate 3D → Generate Multi-View → 3D model → export GLB.** You end
up with a *kit* of parts (body + each armor layer + heart + halo + cape) — a real layered rig,
not a fused mesh. (This is exactly car-body + wheel, scaled to ~7 parts.)

## Step 5 — Blender: assemble, choreograph, render
Import the GLB kit; assemble the full guardian. Then animate the **7-beat descent** and render
each beat as its own clip (camera travels the body; armor peels; heart blooms). Choreography:

| Beat | Camera | Motion | Lighting/VFX |
|---|---|---|---|
| 0 Gate | slow push-in, full figure | assembled; halo ignites | gold key + rim, embers, god-rays |
| 1 Mind | rise to head | helmet/faceplate splits & floats outward | brow glow; gold glyph orbit |
| 2 Hands | arc to arms | gauntlets detach & float | cyan pose-lines over exposed arms |
| 3 Heart ★ | dolly to chest | chest plates bloom outward in rings | molten-gold heart + **teal vault-core**, heartbeat pulses |
| 4 Vault | tight on core | core streams light → script/data toward camera | teal stream, particles |
| 5 Twin | low-angle rise | leg armor strips; figure straightens & grows | gold filigree brightens; ascension |
| 6 CTA | settle, medium | re-assembles powered-up; extends hand | halo flares full |

Blender specifics: obsidian PBR + gold emissive filigree + **emissive teal** on the vault-core;
HDRI/area-light studio; empties/curves to drive the float-outs; Cycles render. Render **1080p,
16:9** and a **9:16** crop; consistent black/transparent background for compositing.

## Step 6 — After Effects: composite + VFX + export
Composite the renders; add the atmosphere he'd add in AE — **rising gold embers, drifting teal
motes, volumetric god-rays, heartbeat pulse rings, film grain, cinematic grade**. Export one clip
per beat: `scene-{n}-{slug}.mp4` (H.264/AV1, ≤ ~800 KB each), first/last frames matched to
neighbors for seamless hand-off.

## Step 7 — Web integration (I do this, same-day)
Drop the clips into `web/public/video/` (served via the `/video` mount already added). Our
`SarathiStory` engine already: scrubs/plays per beat, reveals copy, runs parallax + the vault-core
glow, crossfades between beats, and falls back to posters on reduced-motion. I wire each clip,
tune timing to your render, and ship to `varunos.onrender.com`. Scene 1's intro already proves the
loop end-to-end.

---

## Two lanes — pick based on your Blender/AE appetite
**Lane A — Full pipeline (this doc).** Max control + fidelity + true 3D disassembly. Cost: real
Blender + AE skill/time (or a freelance 3D artist). Best if you want the "$1M" bespoke result.

**Lane B — Fast lane (no Blender).** Tripo/Nano-Banana for the **photoreal master image** →
**image-to-video** (Dreamina, per `docs/SARATHI_STORYBOARD.md` prompts) for each beat's motion →
I integrate. Cost: far less skill/time; slightly less control over exact armor mechanics. This is
the loop that already produced the stunning Scene 1 intro.

**Recommendation:** **Lock the photoreal master in Tripo first (free credits) — that's step one
either way.** Then: if you (or an artist) can drive Blender/AE, go Lane A for the hero beats
(esp. Beat 3) and Lane B for the rest; if not, do the whole thing Lane B now and upgrade hero
beats to Lane A later. Either lane feeds the same web engine, already built.

## Immediate next step
1. Redeem the Tripo code (500 credits), generate the **photoreal guardian** (Step 2 prompt).
2. Send me 3–5 candidates → we lock "the one."
3. Tell me Lane A or B → I give you the exact next actions (piece list + Blender file plan, or the
   7 image-to-video prompts) and start integrating the moment assets land.
