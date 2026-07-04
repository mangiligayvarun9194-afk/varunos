// True-Size Twin — pure morph math. No three.js, no DOM: measurements in,
// morph factors out, plus per-bone scale mapping by name. Mirrors the
// backend contract exactly (varunos twin measurements endpoint) so the
// server-computed morphs and the client preview always agree.
// Tests: web/test/twinmorph.test.mjs

// Baseline circumferences/lengths as fractions of height, from standard
// anthropometric proportions. morph = actual / (fraction * height), clamped
// so a wild tape-measure entry can't turn the avatar into a balloon.
const BASE_FRACTIONS = {
  chest_cm: 0.55,
  waist_cm: 0.47,
  hip_cm: 0.53,
  shoulder_cm: 0.259,
  inseam_cm: 0.45,
  sleeve_cm: 0.33,
};

const MORPH_MIN = 0.8;
const MORPH_MAX = 1.25;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const num = (v) => {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// measurements → {chest, waist, hips, shoulders, arms, legs, height}
// Any missing/invalid input leaves that morph at neutral 1.0.
export function measurementsToMorphs(m) {
  m = m || {};
  const h = num(m.height_cm);
  const morphs = { chest: 1, waist: 1, hips: 1, shoulders: 1, arms: 1, legs: 1, height: 1 };
  if (!h) return morphs;

  morphs.height = clamp(h / 175, 0.85, 1.15);

  const ratio = (key) => {
    const v = num(m[key]);
    return v == null ? null : clamp(v / (BASE_FRACTIONS[key] * h), MORPH_MIN, MORPH_MAX);
  };

  const chest = ratio('chest_cm');   if (chest != null) morphs.chest = chest;
  const hips = ratio('hip_cm');      if (hips != null) morphs.hips = hips;
  const shoulders = ratio('shoulder_cm'); if (shoulders != null) morphs.shoulders = shoulders;
  const legs = ratio('inseam_cm');   if (legs != null) morphs.legs = legs;
  const arms = ratio('sleeve_cm');   if (arms != null) morphs.arms = arms;

  const waist = ratio('waist_cm');
  if (waist != null) {
    morphs.waist = waist;
    // BMI nudges the waist: heavier-than-lean builds carry it at the middle.
    const w = num(m.weight_kg);
    if (w) {
      const bmi = w / ((h / 100) ** 2);
      morphs.waist *= clamp(1 + (bmi - 23) * 0.01, 0.93, 1.12);
      morphs.waist = clamp(morphs.waist, MORPH_MIN, MORPH_MAX);
    }
  }
  return morphs;
}

// Plausible-human ranges (cm / kg). Returns {field: errorString} — empty
// object means everything present is fine. Missing fields are not errors.
const RANGES = {
  height_cm: [120, 230, 'Height'],
  weight_kg: [30, 250, 'Weight'],
  chest_cm: [60, 170, 'Chest'],
  waist_cm: [50, 160, 'Waist'],
  hip_cm: [60, 170, 'Hip'],
  shoulder_cm: [30, 60, 'Shoulder width'],
  inseam_cm: [50, 110, 'Inseam'],
  sleeve_cm: [40, 80, 'Sleeve'],
  neck_cm: [25, 55, 'Neck'],
};

export function validateMeasurements(m) {
  const errors = {};
  m = m || {};
  for (const [field, [lo, hi, label]] of Object.entries(RANGES)) {
    const raw = m[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) errors[field] = `${label} must be a number`;
    else if (n < lo || n > hi) {
      const unit = field === 'weight_kg' ? 'kg' : 'cm';
      errors[field] = `${label} should be ${lo}–${hi} ${unit}`;
    }
  }
  return errors;
}

// Map morph factors onto a rig's bones by name. Pure data — the caller
// (Twin stage) applies these to actual THREE bones. First matching rule
// wins; bones no rule matches are omitted, so an unfamiliar rig degrades
// to a smaller (possibly empty) map instead of a broken pose.
const BONE_RULES = [
  { re: /spine2|chest/i, pick: (mo) => mo.chest, axes: 'xz' },
  { re: /hips|pelvis/i, pick: (mo) => (mo.waist + mo.hips) / 2, axes: 'xz' },
  { re: /shoulder|clavicle/i, pick: (mo) => mo.shoulders, axes: 'x' },
  { re: /upperarm|forearm/i, pick: (mo) => mo.arms, axes: 'xz' },
  { re: /upleg|thigh|calf|leg/i, pick: (mo) => mo.legs, axes: 'xz' },
];
const ROOT_RE = /^hips$|root/i;

export function boneScalesFromMorphs(morphs, boneNames) {
  const out = {};
  if (!morphs || !Array.isArray(boneNames)) return out;
  const mo = { chest: 1, waist: 1, hips: 1, shoulders: 1, arms: 1, legs: 1, height: 1, ...morphs };
  for (const name of boneNames) {
    if (typeof name !== 'string' || !name) continue;
    const rule = BONE_RULES.find((r) => r.re.test(name));
    if (!rule) continue;
    const s = rule.pick(mo);
    if (!Number.isFinite(s)) continue;
    out[name] = {
      x: rule.axes.includes('x') ? s : 1,
      y: ROOT_RE.test(name) ? mo.height : 1,
      z: rule.axes.includes('z') ? s : 1,
    };
  }
  return out;
}
