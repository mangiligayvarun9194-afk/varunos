// Tests for the True-Size Twin morph math: measurements → morph factors,
// input validation, and the bone-name → scale mapping.
// Run: node web/test/twinmorph.test.mjs
import { measurementsToMorphs, validateMeasurements, boneScalesFromMorphs } from '../src/lib/twinmorph.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const near = (a, b, m) => ok(Math.abs(a - b) < 0.0005, `${m} (got ${a}, want ${b})`);
const r3 = (v) => Math.round(v * 1000) / 1000;

// --- shared test vector (must match the backend to 3 decimals) ---
{
  const mo = measurementsToMorphs({
    height_cm: 175, weight_kg: 70, chest_cm: 100, waist_cm: 80,
    hip_cm: 95, shoulder_cm: 45, inseam_cm: 79, sleeve_cm: 58,
  });
  near(r3(mo.chest), 1.039, 'shared vector: chest');
  near(r3(mo.hips), 1.024, 'shared vector: hips');
  near(r3(mo.shoulders), 0.993, 'shared vector: shoulders');
  near(r3(mo.legs), 1.003, 'shared vector: legs');
  near(r3(mo.arms), 1.004, 'shared vector: arms');
  near(r3(mo.height), 1.000, 'shared vector: height');
  near(r3(mo.waist), 0.971, 'shared vector: waist (BMI-adjusted)');
}

// --- missing fields → neutral 1.0 ---
{
  const mo = measurementsToMorphs({ height_cm: 175 });
  for (const k of ['chest', 'waist', 'hips', 'shoulders', 'arms', 'legs']) {
    ok(mo[k] === 1, `missing ${k} input → 1.0 (got ${mo[k]})`);
  }
  ok(mo.height === 1, 'height 175 → 1.0');
}
{
  // no height at all → everything neutral (nothing to normalise against)
  const mo = measurementsToMorphs({ chest_cm: 100, waist_cm: 80 });
  ok(Object.values(mo).every((v) => v === 1), 'no height → all morphs 1.0');
  const empty = measurementsToMorphs({});
  ok(Object.values(empty).every((v) => v === 1), 'empty input → all 1.0');
  ok(Object.values(measurementsToMorphs(null)).every((v) => v === 1), 'null input → all 1.0, no throw');
}

// --- clamping extremes ---
{
  const big = measurementsToMorphs({ height_cm: 175, chest_cm: 170, waist_cm: 160, inseam_cm: 110, sleeve_cm: 80 });
  ok(big.chest === 1.25, `huge chest clamped to 1.25 (got ${big.chest})`);
  ok(big.waist === 1.25, `huge waist clamped to 1.25 (got ${big.waist})`);
  ok(big.legs === 1.25, `long inseam clamped to 1.25 (got ${big.legs})`);
  ok(big.arms === 1.25, `long sleeve clamped to 1.25 (got ${big.arms})`);
  const small = measurementsToMorphs({ height_cm: 175, chest_cm: 60, waist_cm: 50, shoulder_cm: 30 });
  ok(small.chest === 0.8, `tiny chest clamped to 0.8 (got ${small.chest})`);
  ok(small.waist === 0.8, `tiny waist clamped to 0.8 (got ${small.waist})`);
  ok(small.shoulders === 0.8, `narrow shoulders clamped to 0.8 (got ${small.shoulders})`);
  ok(measurementsToMorphs({ height_cm: 230 }).height === 1.15, 'tall height clamped to 1.15');
  ok(measurementsToMorphs({ height_cm: 120 }).height === 0.85, 'short height clamped to 0.85');
  // BMI-adjusted waist stays inside the clamp band
  const heavy = measurementsToMorphs({ height_cm: 175, weight_kg: 250, waist_cm: 158 });
  ok(heavy.waist === 1.25, `heavy BMI waist re-clamped to 1.25 (got ${heavy.waist})`);
}

// --- validateMeasurements ranges ---
{
  ok(Object.keys(validateMeasurements({
    height_cm: 175, weight_kg: 70, chest_cm: 100, waist_cm: 80, hip_cm: 95,
    shoulder_cm: 45, inseam_cm: 79, sleeve_cm: 58, neck_cm: 38,
  })).length === 0, 'valid full set → no errors');
  ok(Object.keys(validateMeasurements({})).length === 0, 'empty set → no errors (all optional)');

  const bad = validateMeasurements({
    height_cm: 119, weight_kg: 251, chest_cm: 59, waist_cm: 161,
    hip_cm: 171, shoulder_cm: 29, inseam_cm: 111, sleeve_cm: 39, neck_cm: 24,
  });
  for (const f of ['height_cm', 'weight_kg', 'chest_cm', 'waist_cm', 'hip_cm', 'shoulder_cm', 'inseam_cm', 'sleeve_cm', 'neck_cm']) {
    ok(typeof bad[f] === 'string' && bad[f].length > 0, `out-of-range ${f} flagged`);
  }
  // boundary values are accepted (inclusive ranges)
  ok(!validateMeasurements({ height_cm: 120 }).height_cm, 'height 120 boundary ok');
  ok(!validateMeasurements({ height_cm: 230 }).height_cm, 'height 230 boundary ok');
  ok(!validateMeasurements({ neck_cm: 25 }).neck_cm, 'neck 25 boundary ok');
  ok(validateMeasurements({ height_cm: 'abc' }).height_cm, 'non-numeric flagged');
}

// --- boneScalesFromMorphs on a Mixamo-like rig ---
{
  const morphs = { chest: 1.1, waist: 0.9, hips: 1.0, shoulders: 1.05, arms: 1.02, legs: 0.95, height: 1.04 };
  const bones = ['Hips', 'Spine2', 'LeftShoulder', 'RightUpLeg', 'LeftForeArm'];
  const s = boneScalesFromMorphs(morphs, bones);
  ok(Object.keys(s).length === 5, `all 5 sample bones mapped (got ${Object.keys(s).length})`);

  near(s.Spine2.x, 1.1, 'Spine2.x = chest');
  near(s.Spine2.z, 1.1, 'Spine2.z = chest');
  ok(s.Spine2.y === 1, 'Spine2.y stays 1');

  near(s.Hips.x, 0.95, 'Hips.x = (waist+hips)/2');
  near(s.Hips.z, 0.95, 'Hips.z = (waist+hips)/2');
  near(s.Hips.y, 1.04, 'root Hips.y = height');

  near(s.LeftShoulder.x, 1.05, 'LeftShoulder.x = shoulders');
  ok(s.LeftShoulder.y === 1 && s.LeftShoulder.z === 1, 'LeftShoulder y/z stay 1');

  near(s.RightUpLeg.x, 0.95, 'RightUpLeg.x = legs');
  near(s.RightUpLeg.z, 0.95, 'RightUpLeg.z = legs');
  ok(s.RightUpLeg.y === 1, 'RightUpLeg.y stays 1');

  near(s.LeftForeArm.x, 1.02, 'LeftForeArm.x = arms');
  near(s.LeftForeArm.z, 1.02, 'LeftForeArm.z = arms');

  // neutral morphs → neutral scales
  const neutral = boneScalesFromMorphs(measurementsToMorphs({}), bones);
  ok(Object.values(neutral).every((v) => v.x === 1 && v.y === 1 && v.z === 1), 'neutral morphs → all scales 1');
}

// --- unknown rig → empty map, never throws ---
{
  let threw = false, s = null;
  try { s = boneScalesFromMorphs({ chest: 1.1 }, ['Bone_A', 'weird.node.001', '']); } catch (_) { threw = true; }
  ok(!threw, 'unknown rig does not throw');
  ok(s && Object.keys(s).length === 0, `unknown rig → {} (got ${s && JSON.stringify(s)})`);
  try { s = boneScalesFromMorphs(null, null); } catch (_) { threw = true; }
  ok(!threw && Object.keys(s).length === 0, 'null args → {} without throwing');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
