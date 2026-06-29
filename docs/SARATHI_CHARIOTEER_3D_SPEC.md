# Sarathi Charioteer — 3D Character Spec & Generation Recipe

Goal: produce a **rigged, animated 3D model** that exactly matches the Sarathi Charioteer
character sheet (the divine AI Health Guide — "Guides. Protects. Empowers. You drive, he
guides."). The homepage engine (`web/src/screens/Tour3D.jsx`) is already built — this model
drops straight in, replacing the placeholder Sentinel.

## Who builds what (the proven loop)
- **You (on Meshy):** generate the model + rig + animations from this spec, download the GLBs.
- **Me (Claude):** optimize them (Draco + WebP, ~31 MB → ~1 MB each), wire each animation to
  the scroll beats, light + frame + ship. *(This is exactly what we did with the Sentinel.)*
> Why you generate it: 3D generation needs Meshy credits / the image, which I can't run from
> here. Everything after the `.glb` is mine.

## Identity & silhouette
- Heroic, athletic, **calm-powerful** demeanor; dark wavy hair, light beard, warm brown eyes.
- Semi-realistic "neo-mythic" hero (not cartoon, not photoreal).

## Signature details — every one matters (from the sheet)
1. **Vault Core Emblem** — a glowing **teal/cyan** circular core at the center of the chest
   (this *is* the Health Vault; must emit light). Palette `#2ec4b6 → #4cc9f0`.
2. **Shoulder Guards** — layered obsidian pauldrons stamped with a **gold chariot-wheel** motif.
3. **Chariot Belt** — a large **gold chariot-wheel buckle** at the waist (the central icon).
4. **Halo / Mandala Ring** — a radiant **gold mandala halo** behind the head (the divine guide).
5. **Greaves of Guidance** — ornate gold-trimmed boots/greaves.
6. **Cape** — long, dark, with **gold-trim edges + faint glyphs**, flows behind.
7. **Guiding hand** — one hand extended forward (the "he guides" gesture).
- **Palette:** obsidian black + **molten gold** (`#f5b572`) + **teal vault-glow** (`#2ec4b6`).

## Generation recipe (Meshy)
1. **Use Multi-Image → 3D** (best accuracy): crop the sheet's four views — **FRONT, 3/4, SIDE,
   BACK** — and feed all four. (The closeups guide texturing; keep them handy.)
2. **Pose:** generate in **A-pose or T-pose** (clean rig). The guiding-hand gesture comes from
   animation, not the base pose.
3. **Texture:** enable **PBR**. Prompt emphasis: "obsidian black plate armor, molten-gold
   filigree and chariot-wheel motifs, glowing teal vault-core chest emblem, gold mandala halo,
   flowing dark cape with gold trim."
4. **Rig:** enable auto-rig (humanoid). Confirm standard bone names (Mixamo-style:
   Hips/Spine/Arm/ForeArm/Hand/Leg/Head…).
5. **Animations** — export these clips (each "with skin"), they map 1:1 to the homepage beats:
   - **Idle / guiding gesture** (hand extended) — hero / "you are the chariot"
   - **Hand to head** — the mind · Hermes
   - **Hand on heart** — the heart · Readiness
   - **Present hands** — the hands · Form Coach
   - **Hand to core** — the core · the Vault
   - **Power stance** — the foundation · the Twin
   - **Arms out / triumphant** — become / CTA
   *(If Meshy's preset library lacks some, send what you have — even idle + walk + a power pose
   is enough; more = richer.)*
6. **Export:** GLB for the base + one GLB per animation (the "Animation_*_withSkin.glb" format
   you used for the Sentinel is perfect).

## Hand-off → what I do (already built, ~same-day)
1. Optimize every GLB with `@gltf-transform` (Draco geometry + WebP textures): base keeps
   textures (~1 MB), clip files strip textures (~0.8 MB) — total a few MB.
2. Bind each clip to the base by bone name; crossfade per scroll beat in `Tour3D.jsx`.
3. Light it obsidian-and-gold, make the **vault-core emblem actually glow** (emissive teal),
   frame the camera per beat, and ship to the live homepage.

## Acceptance (the vision is "reached" when…)
- The figure on the homepage is unmistakably **this** charioteer: vault-core glowing teal,
  chariot-wheel shoulders + belt, gold mandala halo, greaves, cape.
- He **animates** through the beats (gestures/poses change on scroll), 60fps, < ~6 MB total.
- Original character (your generation) → clean to ship commercially.

## Files this touches
- New assets: `web/public/models/charioteer-base.glb` + `charioteer-anim-*.glb`.
- Modify: `web/src/screens/Tour3D.jsx` (`BASE` + `ANIMS` paths, beat→clip map, emissive on the
  vault-core material). One small, well-scoped edit.
