# The Sarathi Animation Craft Book

Training manual for build agents animating the Meshy-rigged GLB humanoid in three.js on mobile web. Precision over prose. Every number is load-bearing. `[VERSION]` / `[CONTESTED]` flags carried from source studies.

---

## 1. RIGGING — Manipulating the Skeleton Safely

### 1.1 What the GLB actually is
- glTF has **no bone type**. Joints are ordinary nodes listed in `skin.joints`; all joints share a common root (glTF 2.0 spec §skins, registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins). In three.js, `Bone` is a bare `Object3D`; `Skeleton` is a flat `bones[]` array whose order indexes `skinIndex` (threejs.org/docs/api/en/objects/Skeleton.html).
- **Only baked joint TRS keyframes survive export.** IK, constraints, foot-roll rigs, jointOrients — all flattened. Expect non-identity local rotations on every joint at rest; that is correct (glTF Tutorials §020).
- Everything runtime rests on one identity:
  ```
  jointMatrix(j) = bone.matrixWorld × boneInverses[j]        // Skeleton.update()
  skinnedPos = bindMatrixInverse × Σ wᵢ·jointMatrixᵢ × (bindMatrix × position)
  ```
  If a joint sits at rest, jointMatrix = I → zero deformation. Deformation is the *delta from bind* (github.khronos.org/glTF-Tutorials/gltfTutorial/gltfTutorial_020_Skins.html).
- Skinned mesh node transform is **ignored** by glTF skinning; three.js reintroduces it via `bindMatrix`/`bindMatrixInverse` with `bindMode: 'attached'` (default) vs `'detached'` (skeleton independent of mesh node) (threejs.org/docs/pages/SkinnedMesh.html).

### 1.2 Hard constraints (violate = broken character)
1. **≤4 influences per vertex.** three.js `skinIndex`/`skinWeight` are vec4; extra glTF sets (`JOINTS_1`) are dropped by GLTFLoader (`[CONTESTED]` >4 tracked in three.js #26137, not shipped). Weights non-negative, sum to 1.0 — run `mesh.normalizeSkinWeights()` if the export is suspect. Prune weights < 0.01–0.05 then renormalize; keep one dominant joint > ~0.5 near rigid areas (glTF spec §skins; SkinnedMesh docs).
2. **LBS only.** three.js has no dual-quaternion skinning (issue #20324). Candy-wrapper twist (180° forearm twist collapsing volume) and collapsing elbows are LBS artifacts — **fix in the rig, not the runtime**: 1–3 twist bones between elbow/wrist distributing roll (mid-twist ≈ 50% of wrist roll), upper-arm/thigh twist with 3-bone falloff across sockets, corrective morph targets for deep bends (polycount.com/discussion/210412; 3dfiggins.com/writeups/forearmTwist; Kavan 2008 for DQS theory). If Meshy's auto-rig lacks twist bones, keep forearm roll amplitudes small in authored clips (< ~90° between adjacent joints) to stay out of the collapse zone.
3. **`frustumCulled = false`** on every skinned mesh — bounds are computed once and never follow bones; the classic "character disappears at screen edge" bug (threejs.org/docs/#api/en/objects/SkinnedMesh).
4. **Keep the rig near world origin.** Bone matrices are float32 world-space; large offsets cause visible skinning jitter (three.js #13288). Use `DetachedBindMode` or recenter if the scene demands offsets.
5. **Bone names are the API.** `PropertyBinding` resolves tracks via `skeleton.getBoneByName()` first, then traversal; names are case-sensitive and must be unique. Reserved characters `[ ] . : /` must be sanitized with `PropertyBinding.sanitizeNodeName()`. A mismatched track **warns and silently no-ops** — partial animation is the symptom (PropertyBinding.js source). Dump the contract once: `scene.traverse(o => o.isBone && console.log(o.name))` and treat that list as frozen across all clips.

### 1.3 Runtime IK / aim (procedural layers over baked clips)
- **Order per frame is load-bearing:** `mixer.update(dt)` → IK/lookAt/spring pass → render. Reversed = one-frame lag.
- Head/eye aim: `bone.lookAt(worldTarget)` in a post-mixer callback (uses world coords, writes local rotation — parent world matrix must be current).
- `CCDIKSolver` (three/addons): config `{ target, effector, links[], iteration, minAngle, maxAngle }` — all **bone indices, not names**; `iteration` 5–10 for a two-bone limb, per-step clamps ~±0.1 rad, axis `limitation` on elbow/knee; `solver.update()` after mixer (threejs.org/docs/pages/CCDIKSolver.html). No analytic two-bone solver in core — implement law-of-cosines yourself if CCD pops.
- Foot lock: bake foot roll into clips in the DCC (preferred), or raycast floor + freeze IK foot target during stance frames (palospublishing.com/correcting-foot-sliding-with-ik).
- Pole ambiguity: keep any pole/hint direction well off the root–effector line or the elbow snaps 180° (toadstorm.com/blog/?p=129).

---

## 2. ANIMATION — Rules for Sarathi's Loops

Principles from Thomas & Johnston via Lasseter (SIGGRAPH 1987), game translation per Jonathan Cooper (gameanim.com/2019/05/15/the-12-principles-of-animation-in-video-games) and mocaponline.com/blogs/mocap-news/idle-animation-game-dev-guide. Authoring grid: **30 fps** (subclip/makeClipAdditive default); playback is delta-timed and framerate-independent.

### 2.1 IDLE (base loop, always on, `LoopRepeat`)
| Parameter | Value | Source |
|---|---|---|
| Breathing rate | 15–20 breaths/min relaxed; 20–25 alert | mocaponline idle guide |
| Chest vertical travel | **1–2 cm only** | mocaponline |
| Simple breathing loop length | 2–4 s | mocaponline |
| Full weight-shift loop length | 8–12 s | mocaponline |
| Weight-transfer cycle | 4–8 s | mocaponline |
| Head bob | a few millimeters | mocaponline |
| Root bone | **zero translation/rotation** in standing idle | mocaponline |
| Fidget/break gesture timer | every 30–60 s | mocaponline |

Rules: never symmetric ("perfectly symmetrical idle poses look artificial" — break twinning per Appeal, principle 9). First frame must be reachable from other states' end poses. `zeroSlopeAtStart/End = true` (three.js default) is correct for breathing idles — automatic ease at the seam. The idle is "the single biggest opportunity to inject personality — never ship a lazy bouncing cycle" (Cooper, gameanim.com/book).

### 2.2 GREETING (one-shot gesture over idle)
- Not input-gated → give it **full anticipation**: small settle/drop of the hand before the arm lifts into the wave (principle 3).
- Hand traces a clean **arc**, clearing the torso silhouette in profile and 3/4 views (principles 2, 7).
- Follow-through: the return/settle after the wave; never let all parts arrive on the same frame — hips lead → spine → shoulder → forearm → hand → fingers, each lagging a few frames (principle 5).
- Mechanics: `LoopOnce`, either `clampWhenFinished = true` + fade back on mixer `'finished'`, or crossfade back to idle. Fade base idle down, fire gesture, fade base up — the character is never "dead" between actions (§3 of Study 2).
- Blend in/out: **0.2–0.4 s** (idle-adjacent transitions; mocaponline), 0.35 s the canonical three.js example value.

### 2.3 EXERCISE (rep loop — squat/jack/etc.)
- **Asymmetric timing sells effort**: explosive up-phase, controlled down-phase (principle 10). A move over 2 frames reads more powerful than the same over 5.
- Squash/stretch is **pose-based, never bone scale**: bottom of squat = compression (deep knee/hip flexion), top = full extension (principle 1). Realistic-human deformation budget: **≤3–5% length change on impacts**, in over 1–2 frames, out over 2–4, volume preserved (scale one axis n → perpendicular axes 1/√n) — "feel it, don't see it" (rebusfarm.net; adammadej.com/posts/202403-squashstretch) `[CONTESTED — taste-tuned]`.
- Anticipation: tiny hip dip before any upward burst.
- Center of mass stays over the feet or the rep reads as falling (principle 12).
- **Set `zeroSlopeAtStart/End = false`** on continuous rep cadences — velocity must survive the loop seam; leave true only if each rep genuinely rests.
- Rep counts as loop repetitions: `setLoop(LoopRepeat, n)`, listen for `'loop'` events to count reps and `'finished'` to exit.

### 2.4 RITUAL loops (namaste, stretch ceremonies, celebratory beats)
- Treat as **hero/emphasis motion**: slower holds, exaggerated key poses "accentuated and held a little longer than reality" (principle 11), consistent exaggeration dialect across the whole set.
- A hold before the next move reads as thought/intent (principle 10) — build in deliberate 6–12 frame holds (200–400 ms at 30 fps) at golden poses.
- Timing anchor from film craft: walk "on 12s" = 24–32 frames/cycle at 24 fps (~1.0–1.33 s); run 8–12 frames `[CONTESTED]` (animschool walk-cycle tips). Use these as tempo intuition for ritual pacing.

### 2.5 State architecture
Small state machine **Idle ⇄ Greeting ⇄ Exercise ⇄ Ritual** with crossfades, plus **additive layers** (breathing, sway, blinks, look-at) that ride over any base — no 2D blend space needed (mocaponline state-machine/blend-tree guides). Authoring workflow: block golden poses pose-to-pose in stepped keys, then layered straight-ahead refinement passes ("blocking-plus", blog.animschool.edu/2025/08/22).

---

## 3. THE THREE.JS TOOLBOX — Exact API Patterns

Ground truth: `src/animation/*.js` on the three.js dev branch (source beats docs when they disagree).

### 3.1 The five layers
KeyframeTrack (channel data) → AnimationClip (bag of tracks, shareable/immutable) → AnimationMixer (clock + bindings, one per character root) → AnimationAction (playback control: weight/timeScale/loop/fades) → PropertyBinding (name→property glue). Never clone clips per instance; never `new AnimationAction()` — always `mixer.clipAction(clip)` (cached by clip.uuid + root.uuid + blendMode).

### 3.2 Clip authoring from code
```js
// Bone rotation: ALWAYS QuaternionKeyframeTrack, name '<boneName>.quaternion', stride 4, slerped
const rot = new THREE.QuaternionKeyframeTrack('Spine.quaternion',
  [0, 1, 2],                                   // times: strictly ascending, seconds
  [...q0.toArray(), ...q1.toArray(), ...q2.toArray()]); // 4 floats × keys
// Root translation only: VectorKeyframeTrack '<bone>.position', stride 3
const pos = new THREE.VectorKeyframeTrack('Hips.position', [0,1,2], [0,0,0, 0,1,0, 0,0,0]);
// Morph: NumberKeyframeTrack '<meshName>.morphTargetInfluences[i]', stride 1
const clip = new THREE.AnimationClip('greet', -1, [rot, pos]); // -1 → auto duration = max last key
clip.optimize(); clip.validate();              // before shipping; optimize() mutates in place
```
Rules that bite: stride is **inferred** (`values.length / times.length`) — assert divisibility or get silent corruption. Never author Euler tracks for bones. Quaternions must be normalized (slerp drifts otherwise). Out-of-order times = broken interpolant (sort via `AnimationUtils.getKeyframeOrder` + `sortedArray`).

### 3.3 Mixer loop discipline
```js
const mixer = new THREE.AnimationMixer(gltf.scene);
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);  // clamp: tab-switch spike guard
  mixer.update(dt);                              // exactly once per frame, seconds DELTA not elapsed
  // → procedural pass here (lookAt, spring bones, IK) — AFTER mixer, BEFORE render
  renderer.render(scene, camera);
}
```
`mixer.setTime(t)` re-simulates from 0 — never use as a cheap seek. On character disposal call `mixer.uncacheRoot(root)` or bindings leak. Events: `'finished'` (LoopOnce ends → chain gestures), `'loop'` (each wrap → rep counting, loop-synced crossfades).

### 3.4 Crossfade pattern (from webgl_animation_skinning_additive_blending)
```js
function setWeight(a, w){ a.enabled = true; a.setEffectiveTimeScale(1); a.setEffectiveWeight(w); }
setWeight(endAction, 1); endAction.time = 0;
startAction.crossFadeTo(endAction, 0.35, true);   // 0.35 s canonical; warp=true phase-syncs cadence
```
- Both actions must already be `.play()`-ed — the #1 "crossFadeTo not working" cause (discourse.threejs.org/t/63467).
- Fading *from* a looping cycle: wait for the mixer `'loop'` event before crossfading so feet don't teleport (`synchronizeCrossFade`); idle→X fires immediately.
- Normal blend is a weighted **accumulate**, not normalized — keep weightA + weightB ≈ 1 or you get overshoot.
- `setEffectiveWeight()` cancels in-flight fades; `setEffectiveTimeScale()` cancels warps — know that when mixing manual weights with fades.

### 3.5 Additive layers (breathing/sway/emotion over any base)
```js
// One-frame pose overlay: subclip is half-open [start, end)
const poseClip = THREE.AnimationUtils.subclip(srcClip, 'lean', 2, 3, 30); // frame 2 only
THREE.AnimationUtils.makeClipAdditive(poseClip);   // mutates in place, sets AdditiveAnimationBlendMode
const layer = mixer.clipAction(poseClip);
layer.enabled = true; layer.setEffectiveTimeScale(1);
layer.setEffectiveWeight(0.6);                     // dial 0..1
layer.play();                                      // ALL additive actions play concurrently
```
- `makeClipAdditive(target, referenceFrame=0, referenceClip=target, fps=30)`: quaternion tracks become `q_ref⁻¹ · q_key` deltas; vectors subtract; bool/string skipped. **Reference frame must be the neutral pose** or the layer injects a permanent lean.
- Track names/types must match the base skeleton exactly — mismatches are silently skipped ("additive does nothing" symptom).
- Set blendMode via the clip or `clipAction(clip, root, THREE.AdditiveAnimationBlendMode)`; **never mutate `action.blendMode` on a live action** (discourse.threejs.org/t/46994). `makeClipAdditive` exists since r116.

### 3.6 One-shots, time control
- Hold final pose: `action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.reset().play();` — without clamp, finish flips `enabled=false` and the pose snaps back.
- `setDuration(sec)` makes a loop last exactly `sec`; `warp(startTS, endTS, dur)` ramps speed; `halt(dur)` decelerates to stop; negative `timeScale` reverses; `mixer.timeScale` = global slow-mo knob.
- `AnimationObjectGroup(mesh1, mesh2, …)` as mixer root drives identical rigs with one interpolation pass (cuts CPU, not draw calls).

### 3.7 Mobile budget
- Track count = interpolant evals/frame. `clip.optimize()`, strip tracks for static bones, share clip objects.
- Draw calls **< ~100/frame** on mobile (threejsroadmap.com/blog/draw-calls-the-silent-killer).
- No per-frame `Vector3`/`Quaternion` allocation in update callbacks — reuse scratch objects.
- Bone-count uniform caps are gone on modern builds (bone DataTexture); `[VERSION]` pre-r151-era builds cap around ~64 bones on low-end mobile.
- Prefer additive skeletal overlays over dense morph stacks (morph texture bandwidth).

---

## 4. MOTION FEEL — Easing & Timing Standards

### 4.1 Frames ↔ milliseconds (spec-handoff math: `ms = 1000/fps × frames`)
| fps | 1 f | 3 f | 6 f | 12 f | 24 f |
|---|---|---|---|---|---|
| 24 | 41.67 ms | 125 | 250 | 500 | 1000 |
| 30 | 33.33 ms | 100 | 200 | 400 | 800 |
| 60 | 16.67 ms | 50 | 100 | 200 | 400 |

Frame counts are authoring-relative; three.js consumes wall-clock seconds. Keep clips at native fps; never re-quantize to render rate (fpstoms.com).

### 4.2 Duration standards
| Context | Duration | Source |
|---|---|---|
| Simple UI feedback (toggle/hover) | ~100 ms (cause→effect must begin ≤100 ms) | nngroup.com/articles/animation-duration |
| Standard UI transition | 200–300 ms | nngroup / Material |
| Routine-UI ceiling (Doherty threshold) | **400 ms** | lawsofux.com/doherty-threshold |
| Hero/emphasis transitions | 400–600 ms | Material |
| Character crossfade (idle↔gesture) | 0.35 s canonical; 0.2–0.4 s band | three.js example; mocaponline |
| Idle↔locomotion transition clip | 0.5–1 s | mocaponline |
| Rim/emissive beat attack / decay | 100–200 ms / 400–800 ms | Study 5 §2 |
| Color-grade preset lerp (emotion change) | 1–3 s, eased | Study 5 §5 |
| Stagger between elements | 50–200 ms, or 30–70% of item duration | motion.dev/docs/stagger; aninix.com |

### 4.3 Easing table
| Purpose | Curve | Notes |
|---|---|---|
| Default on-screen move (M2 Standard) | `cubic-bezier(0.4, 0, 0.2, 1)` | fast-out/slow-in |
| Enter (M2 Decelerate) | `cubic-bezier(0.0, 0, 0.2, 1)` | pair with exit below |
| Exit (M2 Accelerate) | `cubic-bezier(0.4, 0, 1, 1)` | |
| M3 Standard | `cubic-bezier(0.2, 0, 0, 1)` | `[VERSION]` M2 vs M3 constants differ — pick one vocabulary |
| M3 Emphasized-decelerate (hero enter) | `cubic-bezier(0.05, 0.7, 0.1, 1)` | true M3 Emphasized is piecewise; bezier is approximation |
| M3 Emphasized-accelerate (hero exit) | `cubic-bezier(0.3, 0, 0.8, 0.15)` | |
| Shader remaps/masks | smoothstep `3t²−2t³` (C1) | GLSL builtin |
| Camera moves | smootherstep `6t⁵−15t⁴+10t³` (C2) | iquilezles.org/articles/smoothsteps |
| NEVER for UI enters | symmetric `ease-in-out` (0.42,0,0.58,1) | reads mechanical |

Rule: decelerate-in / accelerate-out — mass decelerates *into* rest (m3.material.io/styles/motion/easing-and-duration/tokens-specs; mui.com transitions).

### 4.4 Springs (interruptible, gesture-driven motion)
Damping ratio `ζ = c / (2·√(k·m))`: ζ<1 bouncy, ζ=1 fastest no-overshoot, ζ>1 sluggish (calculator.academy). Framer Motion default `stiffness 100, damping 10, mass 1` → ζ=0.5, deliberately bouncy (motion.dev/docs/spring). react-spring presets (tension/friction): gentle 120/14 · default 170/26 · wobbly 180/12 · stiff 210/20 · slow 280/60 · molasses 280/120 (react-spring.dev/common/configs). Pendulum-feel secondary swing: ζ≈0.2–0.4. Springs for user-driven/interruptible motion; tweens for choreographed sequences.

### 4.5 Frame-rate-independent smoothing (mandatory)
```js
obj.position.x = THREE.MathUtils.damp(obj.position.x, target, lambda, dt);
// identity: value = lerp(target, value, exp(-rate*dt))  — Rory Driscoll
```
Raw `lerp(a, b, 0.1)` per frame is framerate-dependent — banned (rorydriscoll.com/2016/03/07).

### 4.6 Spring-bone secondary motion (hair/cloth/pendant)
VRM `VRMC_springBone` Verlet parameter set (steal even for non-VRM): **stiffnessForce** (return to rest), **dragForce 0–1** (settle speed: high = wet cloth, low = light hair), **gravityPower/gravityDir**, **hitRadius** colliders, **center** frame (prevents whip on fast translation) (vrm.dev/en/univrm/springbone). Run **after** `mixer.update()`. Clamp simulated elements to ~10s, not 100s.

---

## 5. SHADING & VFX — Recipes with Settings

### 5.1 Pipeline lock (do first, never change mid-project)
- `[VERSION r152+]` `renderer.outputColorSpace = THREE.SRGBColorSpace` is default; GLTFLoader tags textures correctly — do not re-tag. Any tutorial using `.encoding` is legacy (threejs.org Color-management manual).
- `renderer.toneMapping = THREE.ACESFilmicToneMapping; toneMappingExposure = 1.0`. `[CONTESTED]` ACES hue-skews saturated emissives (blue→cyan); **AgX** (~r160) holds them better; `NeutralToneMapping` preserves brand color. Pick early — all emissive/bloom numbers calibrate against the tone mapper. Bloom must run on HDR **before** tone mapping (pmndrs postprocessing does; naive EffectComposer chains often don't).

### 5.2 Skin recipe (mobile)
| Setting | Value | Source |
|---|---|---|
| F0 | **0.028** (IOR 1.4) — three.js default 0.04 is too shiny | GPU Gems 3 ch.14; physicallybased.info |
| Fix | `MeshPhysicalMaterial.ior = 1.4` OR `specularIntensity ≈ 0.7` on Standard | Study 5 §1 |
| Roughness base | 0.4–0.6; T-zone 0.35–0.45; lips 0.45–0.5; cheeks/jaw 0.55–0.65 — **ship a roughness map**, uniform scalar = plastic tell | Study 5 §1 |
| Metalness | 0 everywhere, no exceptions | |
| Wrap lighting | `(dot(N,L)+w)/(1+w)`, w ≈ 0.2–0.5; tint terminator `mix(vec3(1), vec3(1.0,0.3,0.25), mask)` | GPU Gems ch.16; selfshadow.com wrap articles |
| Upgrade path | Penner pre-integrated LUT (NdotL × curvature, one 128×128 sample) | Penner SIGGRAPH 2011 |
| Translucency (ears/nostrils) | `pow(saturate(dot(V, -(L + N*distortion))), power) * scale * thickness`; distortion 0.1–0.6, power 1–8 | Barré-Brisebois GDC 2011; three.js SubsurfaceScatteringShader |
| NOT mobile | screen-space SSS blur | discourse.threejs.org/t/83939 |

Integration: keep the GLB's `MeshStandardMaterial` (preserves skinning/shadows) and inject via `onBeforeCompile` at `#include <lights_fragment_begin>`; set `customProgramCacheKey`. `[VERSION]` chunk names drift — pin three version (pailhead onBeforeCompile guide).

### 5.3 Rim/fresnel
`fresnel = pow(1 - saturate(dot(N,V)), rimPower)`, rimPower 2–5. **Motivate it**: multiply by `saturate(dot(N, rimLightDir))` — uniform view-space fresnel reads "shader tutorial." Add into `totalEmissiveRadiance`. Resting intensity 0.15–0.4 of key light; beat peaks 1.5–3× with 100–200 ms attack / 400–800 ms eased decay. Resting rim stays **below** bloom threshold; crossing it is a story beat (Study 5 §2).

### 5.4 Bloom discipline
- Author glow in the material: emissive HDR intensity **2–10**; bloom `threshold ≈ 1.0` so only >1.0 pixels bloom. Global threshold 0.1–0.4 = the fastest way to look cheap.
- Premium band: threshold 0.9–1.0, strength 0.2–0.6, radius 0.2–0.5 (UnrealBloomPass canonical example is 1.5/0.4/0.85 — too hot for premium; docs: threejs.org/docs/pages/UnrealBloomPass.html).
- Mobile: prefer pmndrs `Bloom` `{ mipmapBlur: true, luminanceThreshold: 1, intensity: 0.4–1 }`; or composer at 0.5× DPR; lowest tier = fake bloom (camera-facing additive gradient sprite parented to the glowing bone). Selective bloom (black-material swap pattern) costs ~2× scene render — budget it.

### 5.5 Aura particles (premium, not gamey — Riot LoL VFX Style Guide rules)
- Never 0%/100% value or saturation in sprites; near-white only at the 2–4 frame climax.
- One dominant hue + one accent (60/30, complementary ≤10%).
- Anticipation → climax → dissipation; smoothstep/cubic on scale/alpha/velocity — linear alpha ramps are the #1 amateur tell.
- Fewer/larger/slower: **≤100–300 sprites** per hero, stacked layers ≤4–5 deep over the body, curl-noise drift, slight upward bias, scale-in from 0.8× not 0×, rotation ≤0.2 rad/s.
- `THREE.Points`/instanced quads, `AdditiveBlending, depthWrite:false, transparent:true` — additive needs no sorting, cheaper on tile-based GPUs. Overdraw is the budget, not count; shrink sprites before cutting count.
- Soft particles: `fade = saturate((sceneDepth - fragDepth) * contrast)` via DepthTexture; skip on lowest tier and keep sprites off the body surface.
- **One "power" uniform** drives aura emission rate + rim intensity + bloom-crossing emissive together (idle breathe at 0.1 Hz sine, spikes on action frames) — that coordination reads cinematic.

### 5.6 Color scripting (emotional states)
Per state: key/fill/rim colors+intensities (warm key/cool fill = vitality; inverted = dread), fog/background, aura hue, emissive intensity, optional LUT. Lerp between presets over 1–3 s eased. **Never re-tint albedo** — identity lives in base color, emotion lives in light. Keep a 6–10 thumbnail strip as the team contract (studiobinder.com color script; Khan Academy Pixar lighting).

### 5.7 Texture/delivery discipline
- ORM channel packing (AO=R, roughness=G, metalness=B, linear).
- Atlas padding ≥4 px @512² (8 @1024, 16 @2048), gutters 2× padding, dilated edge fill never black (polycount edge-padding wiki).
- Face ≥25% of body UV space; texel density top-heavy (Valve Dota 2 Character Art Guide).
- KTX2/Basis: ETC1S for baseColor/AO/emissive; **UASTC + `--normal-map` for normals and ORM** — ETC1S crunches normals and destroys the fresnel/skin work. `KTX2Loader` + `GLTFLoader.setKTX2Loader()` (KHR_texture_basisu spec).

---

## 6. GRAPHIC COMPOSITION — Pose Cards & Widget Frames

### 6.1 Pose cards
1. **Silhouette-first test**: fill the pose black; must read in <1 s at thumbnail size or re-pose before touching light (80.lv silhouette study). Favor 3/4 poses with negative space inside the silhouette (arm–torso gap); detail at silhouette landmarks only.
2. **Rule of thirds**: eye-line on the top horizontal third; body mass on a vertical third; gaze/action gets the larger negative space (lead room) — copy/CTA lives there. Centered symmetry only as a deliberate "boss/idol" power-pose (linearity.io rule-of-thirds).
3. **Value gradient on the character**: darkest at feet → brightest at head/face; highest contrast in the upper body (Dota values principle, callumhonoursproject 2016).
4. Rim light is the silhouette-separator against dark backgrounds — cheaper and classier than drop shadow.

### 6.2 Widget/dark-theme frame
- Surface **#121212** (band #0a0a0a–#121212), never pure #000 (`[MINOR/CONTESTED]` OLED smear + kills elevation). Elevation = white overlay 0%→16% from 0dp→24dp (Material dark theme).
- Text: `rgba(255,255,255,.87)` body, 60% secondary, 38% disabled — not pure #FFF for long copy.
- Contrast: body text ≥ **4.5:1** (WCAG 1.4.3); large text/UI components ≥ **3:1** (1.4.11). Desaturate accents on dark; full-saturation brand color on 1–2 small elements max.
- **The render owns the hierarchy**: all UI chrome luminance stays below the character's peak; echo the aura hue in one desaturated UI accent to bind render and chrome.

---

## 7. THE TEN COMMANDMENTS

1. **Thou shalt keep bone names, hierarchy, and ≤4 normalized weights sacred.** The name list is the retarget contract; mismatched tracks silently no-op; >4 influences are dropped (glTF spec; PropertyBinding.js; three.js #26137).
2. **Thou shalt bake everything to joint TRS before export** — IK, constraints, foot roll, twist distribution. glTF stores no solver; validate with the Khronos glTF-Validator.
3. **Thou shalt respect frame order: `mixer.update(clampedDelta)` once → procedural pass (lookAt/IK/springs) → render.** Reversed order = one-frame lag; delta is seconds, clamped to 0.05, never elapsed time.
4. **Thou shalt set `frustumCulled = false` on skinned meshes and keep the rig near origin** (SkinnedMesh docs; three.js #13288).
5. **Thou shalt blend, never snap: crossfade 0.2–0.4 s (0.35 s canonical), warp=true across cycles, fades synced to the `'loop'` event, weights summing to ~1** (webgl_animation_skinning_additive_blending).
6. **Thou shalt layer, not re-author: base loop + additive deltas (`subclip` → `makeClipAdditive` with a neutral reference frame) for breathing, sway, emotion** — and never mutate blendMode on a live action (discourse t/46994).
7. **Thou shalt never ship a dead or symmetric idle**: 1–2 cm breath at 15–20/min, 4–8 s weight shifts, zero root motion, fidget every 30–60 s, arcs not lines, parts never arriving on the same frame (mocaponline; Cooper).
8. **Thou shalt use quaternion tracks for bones, slerp for rotation blends, and `MathUtils.damp` for all smoothing** — no Euler bone tracks, no framerate-dependent `lerp(a,b,0.1)` (KeyframeTrack.js; Driscoll).
9. **Thou shalt keep bloom threshold ≈1.0 and glow authored in emissive** (intensity 2–10 HDR); rim motivated and resting at 0.15–0.4 of key; one "power" uniform driving rim + emissive + aura together. If the whole silhouette blooms, thou hast failed.
10. **Thou shalt honor the mobile budget**: <~100 draw calls, ≤100–300 aura sprites at ≤4–5 overdraw layers, ~10 spring-bone elements, zero per-frame allocations, KTX2 textures (UASTC for normals), `clip.optimize()` on every shipped clip.

---
*Sources are cited inline per section; the five underlying studies (Rigging Fundamentals, Character Animation Principles, three.js Animation System Mastery, Motion Design Math & Feel, Real-Time Shading & VFX) carry the full URL bibliography. When docs and source disagree, `src/animation/*.js` on the three.js dev branch is the spec.*