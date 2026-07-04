# Sarathi — Cinematic Scroll Experience · Master Plan v1

**Owner:** Varun (founder) · **Build:** Claude (eng/design) · **Status:** Phase 1–2 shipped;
this plan governs Phase 3+ (the disassembly cinematic).
**One line:** A scroll-driven descent through the Sarathi charioteer's body — armor peeling
away layer by layer to reveal each product pillar — that converts a visitor into "Build your Twin."

---

## 1. Objectives & success criteria
| Goal | Measure of done |
|---|---|
| A front door that feels worth the product | Passes a "would an investor screenshot this?" bar; consistent 55–60 fps on a 2020 laptop + mid iPhone |
| Story lands without narration | A first-time viewer can restate "it's a coach/guardian for my body" after one scroll |
| Converts | Visible lift in sign-up start rate vs. the current landing (instrument the CTA) |
| Never breaks | Graceful, readable fallback on no-WebGL / reduced-motion / slow-network / mobile |
| Fast | LCP < 2.5s, hero interactive < 3.5s on 4G; total initial payload < 4 MB |

If a creative choice can't defend one of these, it's cut.

---

## 2. Creative north star
Bhagavad-Gita charioteer. **You are the warrior; Sarathi is the charioteer — you drive, he
guides.** The scroll *travels the body*: each part is a feature. Palette: obsidian black +
molten gold (`#f5b572`) + teal vault-glow (`#2ec4b6`/`#4cc9f0`). Director lens: Villeneuve
stillness · Nolan scale/time · Rajamouli divinity · Fincher precision. Emotional arc:
**Awe → Trust → Ownership → Transformation.**

---

## 3. Narrative architecture — the seven beats
| # | Beat (body part) | Pillar | On-screen action | Line | Accent |
|---|---|---|---|---|---|
| 0 | **Cinematic Gate** — full figure | Sarathi | Charioteer assembled; halo ignites; slow push-in; embers | *You are the chariot.* | gold |
| 1 | **The Mind** (head) | Hermes | Helm/faceplate opens outward → glowing brow; glyph constellation orbits | *A coach that remembers.* | warm gold |
| 2 | **The Hands** (arms) | Form Coach | Gauntlets detach → cyan pose-lines trace the exposed arms/hands | *It moves with you.* | cyan |
| 3 | **The Heart** (chest) ★ | Readiness | Chest plates ignite along seams, bloom outward in rings → molten-gold heart w/ teal vault-core, heartbeat pulses | *It knows when to rest.* | teal |
| 4 | **The Core** (torso) | The Vault | Inner layer opens → teal core streams light that resolves into script/data toward the viewer | *Its memory is yours.* | vault blue |
| 5 | **The Foundation** (legs) | The Twin | Leg armor strips away; figure straightens and grows; gold filigree brightens; ascension | *Watch yourself level up.* | gold |
| 6 | **The Invitation** — re-assembled | CTA | Ascended charioteer turns, extends hand; halo flares | *Meet your Twin.* → sign up | gold-hi |

★ Beat 3 is the centerpiece and the emotional climax — budget the most polish here.

---

## 4. Rendering strategy (the key decision)
The "peel the armor layer by layer" effect can be delivered three ways. Ranked by
quality-per-risk for a scroll experience:

### 4A — Scroll-scrubbed pre-rendered sequence  ▸ RECOMMENDED (primary path)
Each beat's disassembly is **rendered once** (in the video/3D tool, or as a frame sequence)
and **scrubbed by scroll position** on the web — the Apple-product-page technique. Scroll ties
directly to playback time / frame index, so scrolling *is* the disassembly, forward and reverse.
- **Pros:** cinematic fidelity (full offline render — GI, DOF, particles baked in); deterministic;
  cheap on the client; mobile-safe; reuses the proven Dreamina/video pipeline (Scene 1 already live).
- **Cons:** not interactively re-lightable; asset weight per beat (mitigated: short clips, compressed).
- **Assets:** one `scene-N` clip (or WebP/AVIF frame sequence) per beat, first/last frames matched
  to the neighbor beats for seamless hand-off.

### 4B — Live WebGL (Three.js) for ONE hero beat  ▸ targeted upgrade
Reserve real-time 3D for **Beat 3 (the Heart)** only, where interactivity (cursor-orbit, the core
reacting to a live readiness value) adds real value. Requires a **hand-authored, layer-separated,
rigged GLB** (Blender), *not* an AI image-to-3D export.
- **Pros:** true interactivity; one "wow" moment carries the whole page.
- **Cons:** asset production is a real modeling task (cost/time); perf/QA surface.

### 4C — Full live-WebGL disassembly of all beats  ▸ NOT recommended now
The original plan's assumption. Blocked by the asset reality below; highest risk, lowest ROI.

> **Asset reality (why 4C is deferred):** AI image-to-3D (Tripo/Meshy) yields a **single fused,
> watertight mesh** — it cannot output separable helm/gauntlet/chest/greave layers with clean
> pivots for disassembly. Layer separation + rig is manual 3D work. We already have a fused
> `charioteer-base.glb`; it's great for a standing hero, wrong for per-layer peeling.

**Recommendation:** ship the whole story on **4A**, and if we want one interactive showpiece,
commission the Heart as **4B** later. This keeps the vision 1:1 while de-risking delivery.

---

## 5. Technical architecture
- **Stack (unchanged, matches repo):** React 18 + Vite, JSX + inline styles, one shared
  `requestAnimationFrame` scroll/parallax engine (already built in `SarathiStory.jsx`). No TS/
  Tailwind/lucide churn.
- **Scroll engine:** each beat owns a scroll range; a normalized `progress ∈ [0,1]` per beat
  drives (a) the scrubbed clip's `currentTime`/frame, (b) copy reveal, (c) particle intensity,
  (d) accent + vault-core. Reverse-safe. `IntersectionObserver` gates activation; rAF does the
  per-frame writes (DOM only, no per-frame React re-renders).
- **Media:** `<video>` scrub for clips (with `preload`, `playsInline`, muted) OR a decoded
  frame-sequence player for ultra-crisp scrubbing on the hero beat. Lazy-load per beat; only the
  Gate + Beat 1 are eager.
- **State → visual hooks:** the Heart/Vault beats can bind to a real readiness/vault value from
  the API so the cinematic reflects live data (nice-to-have, phase-gated).

---

## 6. Asset pipeline & specs
| Item | Spec |
|---|---|
| Source of truth | `sarathi-master-character-v1.png` (master), consistent seed/character across all renders |
| Per-beat clip | H.264/AV1 MP4, 1080p (16:9) **and** 9:16 mobile crop; 4–8s; loopable where it sits under a static beat |
| Hero frame-seq (opt.) | AVIF/WebP sequence, ~48–72 frames, for pixel-crisp scrub on Beat 3 |
| Naming | `scene-{n}-{slug}.mp4`, matching first/last frames to neighbors |
| Weight budget | ≤ ~800 KB per clip after compression; total site ≤ 4 MB initial, rest lazy |
| Location | `web/public/video/` → served via the `/video` FastAPI mount (already added) |
| Poster stills | existing charioteer WebPs as instant posters + reduced-motion fallback |

Production ownership: **Varun renders** the beats (Dreamina/tool, prompts in
`docs/SARATHI_STORYBOARD.md`); **Claude integrates** (compress, scrub-wire, motion, ship) same-day.

---

## 7. Motion & VFX system (largely built)
- **Parallax:** scroll + cursor on figures/halos (shipped).
- **Vault-core:** teal heartbeat bloom on Beat 3, cyan on Beat 4 (shipped).
- **Particles:** rising gold embers, drifting teal motes, volumetric god-rays, heartbeat pulse
  rings — capped counts, paused offscreen, disabled on reduced-motion/mobile.
- **Transitions:** cross-beat background crossfade so the descent reads as one continuous shot.
- **Beat rail:** "the chariot descending the body" left indicator (shipped).

---

## 8. Accessibility, fallback & performance
- **Reduced-motion:** static layered stills with a simple crossfade; no scrub, no particles.
- **No-WebGL / decode failure:** poster stills + copy (fully readable story).
- **Slow network:** posters first; clips stream/lazy-load; never block first paint.
- **Mobile:** 9:16 crops, reduced particle budget, rail hidden, tap-friendly CTA.
- **Budgets:** LCP < 2.5s · 55–60 fps · initial < 4 MB · no layout shift on the pinned stage.

---

## 9. Risks & mitigations
| Risk | Likelihood | Mitigation |
|---|---|---|
| AI-3D can't produce layered armor | High | Primary path is 4A (pre-rendered scrub); no dependency on layered GLB |
| Character drift across 7 renders | Med | Lock seed/reference; QA each against the master image |
| Per-beat weight bloats load | Med | Compression budget, lazy-load, AVIF/AV1, posters-first |
| Scroll scrub janky on low-end | Med | Frame-seq for hero only; `requestVideoFrameCallback`; test on real devices |
| Scope creep (all beats interactive) | Med | 4B limited to Beat 3; rest are 4A |

---

## 10. Phased delivery & acceptance
- **P3.1 — Engine hardening (this week):** cross-beat crossfade + scroll-scrub wiring for the
  Gate. *Accept:* Scene 1 scrubs both ways at 60fps; clean fallback.
- **P3.2 — Beats 1–2 (Mind, Hands):** integrate their scene clips; glyph/pose-line overlays.
  *Accept:* both beats reveal on scroll, reverse-safe, < budget.
- **P3.3 — Beat 3 (Heart) centerpiece:** the bloom-to-heart clip + heartbeat pulse rings; optional
  4B interactive core. *Accept:* the "wow" screenshot exists.
- **P3.4 — Beats 4–6 (Vault, Twin, CTA):** integrate; wire CTA to sign-up; instrument.
- **P3.5 — Polish + perf + a11y pass; ship to `varunos.onrender.com`.** *Accept:* all budgets met,
  fallbacks verified, live commit == HEAD.

Each phase is independently shippable and reversible (demo-gated until promoted).

---

## 11. Open decisions (need your call)
1. **Rendering path:** confirm 4A primary (recommended), with 4B for the Heart later? (Y/N)
2. **Hero interactivity:** do we want the live cursor-orbit Heart, or is a rendered Heart enough for v1?
3. **Homepage cutover:** replace the current landing now, or keep this demo-gated until all 6 beats are in?
