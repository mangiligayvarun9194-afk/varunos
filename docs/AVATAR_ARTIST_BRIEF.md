# 3D Character Artist Brief — "Sarathi" Fitness Avatar

**Project:** A premium 3D human avatar for a fitness app (real-time, web/three.js).
**Type:** Rigged, textured, morph-target character. Original work, full commercial rights.
**Reference:** see attached image(s) — match this look and quality.

---

## 1. What I need (deliverables)

1. A **rigged, textured 3D character** exported as **glTF 2.0 binary (`.glb`)**, textures embedded.
2. The **editable source file** (`.blend` preferred, or `.fbx` + textures).
3. **Morph targets / blend shapes** for muscle growth (see §4) — this is essential.
4. 2–3 **preview renders** (front, 3/4, back).
5. Confirmation of **full commercial license** (original work, buyout).

## 2. The look (creative direction)

- A **realistic, athletic adult** — strong and fit, balanced and believable proportions
  (elite athlete, not cartoon bodybuilder). Match the attached reference.
- Confident, calm expression. Short modern hair, light stubble ok (match reference).
- Wardrobe: plain dark athletic shorts + training shoes (simple, brandable). No logos
  required, but a small plain waistband is fine.
- Premium, clean, modern. It will be lit with a dark, futuristic theme in-app.

## 3. Technical requirements (MUST follow — it runs in three.js / WebGL on mobile)

- **Format:** glTF 2.0 binary (`.glb`), textures **embedded**.
- **Poly budget:** ~30,000–60,000 triangles (real-time web). Clean quad topology,
  good edge flow for deformation (shoulders, elbows, hips, knees).
- **Textures:** PBR metallic-roughness set at **2048×2048**: base color (albedo),
  normal, roughness, metalness, ambient occlusion. Non-overlapping UVs.
- **Single skinned body mesh** (hair/shoes can be separate meshes, same skeleton).
- **Bind pose:** **A-pose** (arms slightly down/out — best for auto-animation).
- **Orientation/scale:** real-world scale **~1.8 m tall**, **Y-up**, facing **+Z**,
  origin **(0,0,0) at the feet**, centered on X/Z.
- **Rig:** standard **humanoid skeleton using Mixamo bone names** (so Mixamo animations
  and our code work directly):
  `Hips, Spine, Spine1, Spine2, Neck, Head, LeftShoulder, LeftArm, LeftForeArm,
  LeftHand, RightShoulder, RightArm, RightForeArm, RightHand, LeftUpLeg, LeftLeg,
  LeftFoot, LeftToeBase, RightUpLeg, RightLeg, RightFoot, RightToeBase`.
  Skin weights clean (no spikes at joints when posed).

## 4. Morph targets / blend shapes (the special feature — required)

The body must be able to **grow muscle** on demand. Sculpt these named blend shapes,
each blending **0.0 (lean/beginner) → 1.0 (fully developed)**, and they must combine:

`muscle_overall, chest_size, arms_size, shoulders_size, back_size, core_size,
legs_size, calves_size, bodyfat`

- At 0.0 the physique is lean/untrained; at 1.0 it's well-developed for that area.
- `bodyfat` 0→1 = leaner → softer. Keep them independent so any mix looks natural.
- Deliver a plain-text list of the exact morph-target names you used.

## 5. Optional (nice to have, quote separately)
- A few retargetable test animations (idle, squat, deadlift, overhead press, curl) —
  or confirm it's Mixamo-compatible so we can apply those ourselves.
- A female variant with the same rig + morph names.

## 6. Acceptance criteria (how I'll check before final payment)
- Loads in a standard glTF viewer (e.g., gltf-viewer / three.js editor) with no errors.
- Skeleton present with the exact bone names above; poses cleanly (no broken joints).
- All listed morph targets present and working (I'll slide each 0→1).
- Textures embedded and correct; file is a reasonable size (ideally < 15 MB).
- Visual quality matches the reference.

## 7. Licensing
Original work, made for this project. I need a **full commercial license / buyout** to
use, modify, and distribute the model in a commercial app (web, mobile, desktop).
Please confirm in writing.

## 8. Reference
Attach: the avatar reference image(s) (front / 3-4 / back). Match this character and quality.
