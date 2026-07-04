// Becoming — pure interpolation between the today-body and the goal-body.
// No three.js, no DOM: two morph dicts in ({chest, waist, hips, shoulders,
// arms, legs, height}, ~0.8–1.25, see twinmorph.js), a blended dict out,
// plus the honest labels for the slider. Deterministic by construction.
// Tests: web/test/becoming.test.mjs

export const clamp01 = (t) => {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
};

// Per-key linear interpolation over the UNION of keys of both dicts.
// A key missing (or non-finite) on either side is treated as neutral 1.0,
// so a sparse goal dict still blends every morph the today dict carries.
// t is clamped to [0,1]; always returns a fresh dict.
export function lerpMorphs(today, goal, t) {
  const a = today || {};
  const b = goal || {};
  const k01 = clamp01(t);
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = Number.isFinite(a[key]) ? a[key] : 1;
    const bv = Number.isFinite(b[key]) ? b[key] : 1;
    out[key] = av + (bv - av) * k01;
  }
  return out;
}

// Where on the road is the slider? Honest, not aspirational.
export function becomingLabel(t) {
  const k = clamp01(t);
  if (k < 0.15) return 'today';
  if (k > 0.85) return 'goal-you';
  return 'the road';
}

// "≈ N weeks at current pace" — the readout under the slider.
export function becomingWeeks(t, totalWeeks = 12) {
  return Math.round(clamp01(t) * totalWeeks);
}

// Display string for the weeks readout: 0 weeks reads as 'now'.
export function becomingWeeksText(t, totalWeeks = 12) {
  const w = becomingWeeks(t, totalWeeks);
  return w === 0 ? 'now' : `≈ ${w} week${w === 1 ? '' : 's'}`;
}
