// Form grading — turns a single rep's joint-angle trajectory into an explainable
// 0-100 form score. Pure and framework-free so it unit-tests with synthetic reps.
//
// Three signals, each defensible to a lifter:
//   • DEPTH   — did the rep reach the target range of motion?
//   • TEMPO   — was each phase controlled (not a bounce / not grinding to a stall)?
//   • SHAPE   — Dynamic Time Warping (DTW) of the rep's normalized curve against a
//               textbook "smooth, symmetric" rep. Catches jerky/asymmetric reps
//               independent of depth. DTW because two reps are the same *shape* at
//               different speeds — exactly what warping aligns.
// All work in the engine's EFFECTIVE angle space (large = rest/top, small = peak),
// so one grader covers flexion and extension lifts alike.

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Dynamic Time Warping distance between two numeric sequences (normalized by path
// length so it's comparable across rep durations).
export function dtw(a, b) {
  const n = a.length, m = b.length;
  if (!n || !m) return 1;
  const INF = 1e9;
  const prev = new Array(m + 1).fill(INF);
  const cur = new Array(m + 1).fill(INF);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(INF); cur[0] = INF;
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      cur[j] = cost + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    for (let j = 0; j <= m; j++) prev[j] = cur[j];
  }
  return prev[m] / (n + m);
}

// Linearly resample a sequence to a fixed length.
export function resample(seq, n) {
  if (seq.length === 0) return new Array(n).fill(0);
  if (seq.length === 1) return new Array(n).fill(seq[0]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (seq.length - 1);
    const lo = Math.floor(x), hi = Math.ceil(x), f = x - lo;
    out.push(seq[lo] * (1 - f) + seq[hi] * f);
  }
  return out;
}

const IDEAL_N = 24;
// Textbook rep: top → depth → top, smooth and symmetric (cosine).
const IDEAL = Array.from({ length: IDEAL_N }, (_, i) => {
  const u = i / (IDEAL_N - 1);
  return 1 - (0.5 - 0.5 * Math.cos(2 * Math.PI * u)); // 1 → 0 → 1
});

function phaseScore(seconds) {
  if (seconds < 0.35) return 0.45;   // bounced / uncontrolled
  if (seconds < 0.6) return 0.75;
  if (seconds <= 2.6) return 1.0;    // controlled
  return 0.85;                        // very slow / grind
}

// Grade one rep. `samples` = [{ t (ms), eff (effective angle) }] across the rep.
// `T` = the lift's derived thresholds (extended, depthTarget). Returns
// { score 0-100, depth, tempo, shape (0-1 each), tags[] }.
export function gradeRep(samples, T) {
  if (!samples || samples.length < 4) return { score: 0, depth: 0, tempo: 0, shape: 0, tags: [] };
  const eff = samples.map((s) => s.eff);
  const t = samples.map((s) => s.t);
  const top = Math.max(...eff);
  let bottom = top, minIdx = 0;
  eff.forEach((e, i) => { if (e < bottom) { bottom = e; minIdx = i; } });

  // DEPTH — how close the bottom got to the target, vs the expected travel.
  const expected = Math.max(1, top - T.depthTarget);
  const depth = clamp01((top - bottom) / expected);

  // TEMPO — both phases controlled.
  const downDur = (t[minIdx] - t[0]) / 1000;
  const upDur = (t[t.length - 1] - t[minIdx]) / 1000;
  const tempo = (phaseScore(downDur) + phaseScore(upDur)) / 2;

  // SHAPE — DTW of the depth-normalized curve vs the ideal (catches jerk/asymmetry).
  const range = Math.max(1, top - bottom);
  const norm = eff.map((e) => (e - bottom) / range);     // 0 at bottom, 1 at top
  const shape = clamp01(1 - dtw(resample(norm, IDEAL_N), IDEAL) / 0.22);

  const score = Math.round(100 * (0.45 * depth + 0.25 * tempo + 0.30 * shape));
  const tags = [];
  if (depth < 0.72) tags.push('shallow — go deeper');
  if (tempo < 0.7) tags.push('control the tempo');
  if (shape < 0.6) tags.push('smooth it out');
  return { score, depth, tempo, shape, tags };
}
