// Tests for the per-rep form grader (DTW + depth + tempo). Pure, synthetic reps.
// Run: node web/test/formgrade.test.mjs
import { dtw, resample, gradeRep } from '../src/lib/formgrade.js';
import { EXERCISES, deriveThresholds } from '../src/lib/formcoach.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const T = deriveThresholds(EXERCISES.squat); // extended~164, depthTarget~92

// Build a rep trajectory in effective space: top → bottom → top (cosine), 30fps.
// `jitter` adds a deterministic sawtooth (jerky rep). Phase durations in ms.
function makeRep(top, bottom, downMs = 1000, upMs = 1000, jitter = 0) {
  const s = []; let t = 0; const dt = 1000 / 30;
  const dN = Math.max(2, Math.round(downMs / dt)), uN = Math.max(2, Math.round(upMs / dt));
  for (let i = 0; i <= dN; i++) {
    const u = i / dN, v = top - (top - bottom) * (0.5 - 0.5 * Math.cos(Math.PI * u));
    s.push({ t, eff: v + (i % 2 ? jitter : -jitter) }); t += dt;
  }
  for (let i = 1; i <= uN; i++) {
    const u = i / uN, v = bottom + (top - bottom) * (0.5 - 0.5 * Math.cos(Math.PI * u));
    s.push({ t, eff: v + (i % 2 ? jitter : -jitter) }); t += dt;
  }
  return s;
}

// --- DTW ---
ok(dtw([1, 2, 3], [1, 2, 3]) === 0, 'DTW of identical sequences is 0');
ok(dtw([0, 1, 0], [0, 1, 0]) === 0, 'DTW symmetric same shape = 0');
const clean = makeRep(170, 85).map((x) => x.eff);
const jerky = makeRep(170, 85, 1000, 1000, 12).map((x) => x.eff);
const norm = (a) => { const lo = Math.min(...a), hi = Math.max(...a); return a.map((v) => (v - lo) / (hi - lo)); };
ok(dtw(resample(norm(clean), 24), resample(norm(jerky), 24)) > 0, 'jerky rep diverges from clean by DTW');

// --- gradeRep ---
const good = gradeRep(makeRep(170, 85, 1100, 1100), T);
ok(good.score >= 75, 'clean deep controlled rep scores high (got ' + good.score + ')');
ok(good.depth > 0.9 && good.tags.length === 0, 'good rep: full depth, no faults');

const shallow = gradeRep(makeRep(170, 135, 1000, 1000), T);  // never reaches depth
ok(shallow.depth < 0.72 && shallow.tags.some((t) => /shallow/.test(t)), 'shallow rep flagged + low depth');
ok(shallow.score < good.score, 'shallow rep scores lower than a clean one');

const fast = gradeRep(makeRep(170, 85, 250, 250), T);          // bounced
ok(fast.tags.some((t) => /tempo/.test(t)), 'too-fast rep flags tempo');

const jr = gradeRep(makeRep(170, 85, 1000, 1000, 14), T);     // jerky
ok(jr.shape < good.shape, 'jerky rep has a worse shape score than clean');

ok(gradeRep([], T).score === 0, 'empty rep grades to 0 safely');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
