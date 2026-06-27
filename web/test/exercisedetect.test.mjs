// Tests for the on-device exercise auto-detector. Pure geometry, fed synthetic
// pose sequences (rest → peak → rest) — no camera, exactly how the rep engine is
// tested. Each lift is built as a stick figure whose salient joints move the way
// that lift moves; we assert the detector names the right one.
// Run: node web/test/exercisedetect.test.mjs
import { frameFeatures, aggregate, classify, ExerciseDetector } from '../src/lib/exercisedetect.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// --- synthetic body ---------------------------------------------------------
// A pose = the 12 landmarks the detector reads. [x, y] in image coords (y down).
const SHL = [0.45, 0.30], SHR = [0.55, 0.30], HPL = [0.46, 0.52], HPR = [0.54, 0.52];
const KNL = [0.46, 0.72], KNR = [0.54, 0.72], ANL = [0.46, 0.92], ANR = [0.54, 0.92];
const ELL = [0.42, 0.45], ELR = [0.58, 0.45], WRL = [0.42, 0.58], WRR = [0.58, 0.58];

function P(o) {
  const a = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
  const set = (i, p) => { a[i] = { x: p[0], y: p[1], z: 0, visibility: 0.95 }; };
  set(11, o.shl || SHL); set(12, o.shr || SHR); set(13, o.ell || ELL); set(14, o.elr || ELR);
  set(15, o.wrl || WRL); set(16, o.wrr || WRR); set(23, o.hpl || HPL); set(24, o.hpr || HPR);
  set(25, o.knl || KNL); set(26, o.knr || KNR); set(27, o.anl || ANL); set(28, o.anr || ANR);
  return a;
}
const lerp = (A, B, u) => A.map((p, i) => ({ x: p.x + (B[i].x - p.x) * u, y: p.y + (B[i].y - p.y) * u, z: 0, visibility: 0.95 }));
// rest → peak → rest cycle, with timestamps ~40ms apart.
function cycle(rest, peak, n = 12) {
  const fr = [];
  for (let i = 0; i <= n; i++) fr.push(lerp(rest, peak, i / n));
  for (let i = 1; i <= n; i++) fr.push(lerp(peak, rest, i / n));
  return fr.map((L, i) => { const f = frameFeatures(L); if (f) f.t = i * 40; return f; }).filter(Boolean);
}
const detect = (rest, peak) => classify(aggregate(cycle(rest, peak)));

// --- squat: upright, knees flex deep -----------------------------------------
{
  const rest = P({});
  const peak = P({ hpl: [0.46, 0.66], hpr: [0.54, 0.66], knl: [0.40, 0.70], knr: [0.60, 0.70] });
  const d = detect(rest, peak);
  ok(d.exId === 'squat', 'squat detected (got ' + d.exId + ')');
  ok(d.confidence >= 0.7, 'squat is confident (got ' + d.confidence + ')');
}

// --- push-up: horizontal body, elbows flex -----------------------------------
{
  const base = { shl: [0.30, 0.55], shr: [0.30, 0.57], hpl: [0.55, 0.60], hpr: [0.55, 0.62],
    knl: [0.75, 0.62], knr: [0.75, 0.64], anl: [0.90, 0.65], anr: [0.90, 0.67] };
  const rest = P({ ...base, ell: [0.30, 0.68], elr: [0.30, 0.68], wrl: [0.30, 0.80], wrr: [0.30, 0.80] });
  const peak = P({ ...base, shl: [0.30, 0.64], shr: [0.30, 0.66], ell: [0.24, 0.62], elr: [0.24, 0.64], wrl: [0.30, 0.78], wrr: [0.30, 0.80] });
  const d = detect(rest, peak);
  ok(d.exId === 'pushup', 'push-up detected (got ' + d.exId + ')');
}

// --- curl: standing, upper arm pinned, forearm flexes up ---------------------
{
  const rest = P({ ell: [0.43, 0.46], elr: [0.57, 0.46], wrl: [0.43, 0.60], wrr: [0.57, 0.60] });
  const peak = P({ ell: [0.43, 0.46], elr: [0.57, 0.46], wrl: [0.44, 0.34], wrr: [0.56, 0.34] });
  const d = detect(rest, peak);
  ok(d.exId === 'curl', 'curl detected (got ' + d.exId + ')');
}

// --- overhead press: arms travel from shoulders to locked-out overhead -------
{
  const rest = P({ ell: [0.38, 0.32], elr: [0.62, 0.32], wrl: [0.42, 0.26], wrr: [0.58, 0.26] });
  const peak = P({ ell: [0.44, 0.16], elr: [0.56, 0.16], wrl: [0.45, 0.05], wrr: [0.55, 0.05] });
  const d = detect(rest, peak);
  ok(d.exId === 'ohp', 'overhead press detected (got ' + d.exId + ')');
}

// --- lateral raise: facing camera, arms abduct out to the sides --------------
{
  const rest = P({ ell: [0.40, 0.45], elr: [0.60, 0.45], wrl: [0.38, 0.58], wrr: [0.62, 0.58] });
  const peak = P({ ell: [0.32, 0.30], elr: [0.68, 0.30], wrl: [0.22, 0.30], wrr: [0.78, 0.30] });
  const d = detect(rest, peak);
  ok(d.exId === 'lateralraise', 'lateral raise detected (got ' + d.exId + ')');
}

// --- sit-up: lying, torso curls up from the floor ----------------------------
{
  const base = { knl: [0.70, 0.60], knr: [0.70, 0.62], anl: [0.78, 0.70], anr: [0.78, 0.72] };
  const rest = P({ ...base, shl: [0.28, 0.70], shr: [0.30, 0.70], hpl: [0.55, 0.70], hpr: [0.55, 0.72], ell: [0.20, 0.70], elr: [0.22, 0.70], wrl: [0.14, 0.70], wrr: [0.16, 0.70] });
  const peak = P({ ...base, shl: [0.54, 0.55], shr: [0.56, 0.55], hpl: [0.55, 0.70], hpr: [0.55, 0.72], ell: [0.50, 0.58], elr: [0.52, 0.58], wrl: [0.48, 0.60], wrr: [0.50, 0.60] });
  const d = detect(rest, peak);
  ok(d.exId === 'situp', 'sit-up detected (got ' + d.exId + ')');
}

// --- RDL: standing forward hinge, knees stay fairly straight ------------------
{
  const rest = P({});
  const peak = P({ shl: [0.38, 0.46], shr: [0.42, 0.46], ell: [0.36, 0.58], elr: [0.40, 0.58], wrl: [0.36, 0.70], wrr: [0.40, 0.70] });
  const d = detect(rest, peak);
  ok(d.exId === 'rdl', 'RDL detected (got ' + d.exId + ')');
}

// --- row: hinged torso, elbow drives back/up, wrist stays low ----------------
{
  const base = { shl: [0.38, 0.45], shr: [0.42, 0.45], hpl: [0.54, 0.50], hpr: [0.58, 0.50],
    knl: [0.55, 0.72], knr: [0.59, 0.72], anl: [0.55, 0.92], anr: [0.59, 0.92] };
  const rest = P({ ...base, ell: [0.38, 0.60], elr: [0.42, 0.60], wrl: [0.38, 0.74], wrr: [0.42, 0.74] });
  const peak = P({ ...base, ell: [0.46, 0.50], elr: [0.50, 0.50], wrl: [0.54, 0.46], wrr: [0.58, 0.46] });
  const d = detect(rest, peak);
  ok(d.exId === 'row', 'row detected (got ' + d.exId + ')');
}

// --- robustness: a still pose names nothing ----------------------------------
{
  const still = [];
  for (let i = 0; i < 16; i++) { const f = frameFeatures(P({})); f.t = i * 40; still.push(f); }
  const d = classify(aggregate(still));
  ok(d.exId === null && d.confidence === 0, 'a static pose detects no exercise');
}

// --- the stateful detector reaches a stable read after a couple reps ---------
{
  const det = new ExerciseDetector({ minConf: 0.6, dwell: 2 });
  const rest = P({});
  const peak = P({ hpl: [0.46, 0.66], hpr: [0.54, 0.66], knl: [0.40, 0.70], knr: [0.60, 0.70] });
  let last = null;
  for (let rep = 0; rep < 3; rep++) {
    const frames = [];
    const base = rep * 2000;
    for (let i = 0; i <= 12; i++) frames.push({ L: lerp(rest, peak, i / 12), t: base + i * 40 });
    for (let i = 1; i <= 12; i++) frames.push({ L: lerp(peak, rest, i / 12), t: base + (12 + i) * 40 });
    for (const fr of frames) last = det.push(fr.L, fr.t);
  }
  ok(last && last.exId === 'squat' && last.stable, 'stateful detector locks onto squat (got ' + (last && last.exId) + ' stable=' + (last && last.stable) + ')');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
