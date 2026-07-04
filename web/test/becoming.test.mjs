// Tests for the Becoming interpolation — pure morph lerp + slider labels.
// Run: node web/test/becoming.test.mjs
import {
  lerpMorphs, becomingLabel, becomingWeeks, becomingWeeksText,
} from '../src/lib/becoming.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const eq = (a, b) => Math.abs(a - b) < 1e-9;

const today = { chest: 1.05, waist: 1.2, hips: 1.1, shoulders: 0.95, arms: 0.9, legs: 1.0, height: 1.02 };
const goal = { chest: 1.15, waist: 0.95, hips: 1.0, shoulders: 1.1, arms: 1.05, legs: 1.0, height: 1.02 };

// --- lerp exactness ---
{
  const at0 = lerpMorphs(today, goal, 0);
  const at1 = lerpMorphs(today, goal, 1);
  const mid = lerpMorphs(today, goal, 0.5);
  ok(Object.keys(at0).every((k) => eq(at0[k], today[k])), 't=0 → today exactly');
  ok(Object.keys(at1).every((k) => eq(at1[k], goal[k])), 't=1 → goal exactly');
  ok(Object.keys(mid).every((k) => eq(mid[k], (today[k] + goal[k]) / 2)), 't=0.5 → midpoint');
  ok(at0 !== today && at1 !== goal, 'returns fresh dicts, not the inputs');
}

// --- union of keys, missing → 1.0 baseline ---
{
  const m = lerpMorphs({ chest: 1.2 }, { waist: 0.9 }, 0.5);
  ok('chest' in m && 'waist' in m, 'union of keys covered');
  ok(eq(m.chest, (1.2 + 1.0) / 2), 'missing goal key lerps toward 1.0 (got ' + m.chest + ')');
  ok(eq(m.waist, (1.0 + 0.9) / 2), 'missing today key lerps from 1.0 (got ' + m.waist + ')');
  const full = lerpMorphs({}, goal, 1);
  ok(eq(full.waist, goal.waist), 'empty today at t=1 still lands on goal');
  const none = lerpMorphs(null, { arms: 1.1 }, 0);
  ok(eq(none.arms, 1.0), 'null today treated as all-neutral');
}

// --- t clamping ---
{
  const lo = lerpMorphs(today, goal, -3);
  const hi = lerpMorphs(today, goal, 42);
  ok(Object.keys(lo).every((k) => eq(lo[k], today[k])), 't<0 clamps to today');
  ok(Object.keys(hi).every((k) => eq(hi[k], goal[k])), 't>1 clamps to goal');
  const nan = lerpMorphs(today, goal, NaN);
  ok(Object.keys(nan).every((k) => eq(nan[k], today[k])), 'NaN t clamps to 0');
}

// --- determinism ---
{
  const a = lerpMorphs(today, goal, 0.37);
  const b = lerpMorphs(today, goal, 0.37);
  ok(JSON.stringify(a) === JSON.stringify(b), 'same inputs → identical output');
}

// --- label boundaries ---
ok(becomingLabel(0) === 'today', 'label at 0');
ok(becomingLabel(0.1499) === 'today', 'label just under 0.15');
ok(becomingLabel(0.15) === 'the road', 'label exactly 0.15 is the road');
ok(becomingLabel(0.5) === 'the road', 'label mid');
ok(becomingLabel(0.85) === 'the road', 'label exactly 0.85 is the road');
ok(becomingLabel(0.8501) === 'goal-you', 'label just over 0.85');
ok(becomingLabel(1) === 'goal-you', 'label at 1');
ok(becomingLabel(-5) === 'today', 'label clamps low');
ok(becomingLabel(9) === 'goal-you', 'label clamps high');

// --- weeks rounding ---
ok(becomingWeeks(0) === 0, 'weeks at 0 → 0');
ok(becomingWeeks(1) === 12, 'weeks at 1 → 12 (default)');
ok(becomingWeeks(0.5) === 6, 'weeks at 0.5 → 6');
ok(becomingWeeks(0.04) === 0, '0.48 weeks rounds down to 0');
ok(becomingWeeks(0.3) === 4, '3.6 weeks rounds up to 4');
ok(becomingWeeks(0.5, 8) === 4, 'custom totalWeeks respected');
ok(becomingWeeks(2) === 12, 'weeks clamps high');
ok(becomingWeeks(-1) === 0, 'weeks clamps low');
ok(becomingWeeksText(0) === 'now', '0 weeks reads as now');
ok(becomingWeeksText(1).includes('12 weeks'), 'text carries the week count');
ok(becomingWeeksText(1 / 12) === '≈ 1 week', 'singular week');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
