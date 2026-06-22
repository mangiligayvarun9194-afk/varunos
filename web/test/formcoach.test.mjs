// Pure unit tests for the Form-Coach rep/angle engine.
// Run: node web/test/formcoach.test.mjs   (or: npm test, from web/)
// No camera or browser needed — the engine is fed synthetic angle sequences
// (and synthetic landmarks for the presence gate), which is exactly how the
// strength science (depth) and the CV robustness (gating) are verified.
import { angleDeg, poseQuality, OneEuro, RepEngine, EXERCISES, SIDE } from '../src/lib/formcoach.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
// feed N frames of a constant angle (enough for the 1€ filter to settle and
// for dwell + duration gates to be satisfied).
const feed = (eng, t, n = 14) => { let r; for (let i = 0; i < n; i++) r = eng.step(t); return r; };
// like feed, but returns the rep-completion event if one fired during the block
const feedEv = (eng, t, n = 14) => { let ev = null; for (let i = 0; i < n; i++) { const r = eng.step(t); if (r && r.event) ev = r.event; } return ev; };

// --- geometry ---
ok(Math.round(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })) === 180, 'straight line = 180°');
ok(Math.round(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })) === 90, 'right angle = 90°');
ok(angleDeg(null, { x: 0, y: 0 }, { x: 1, y: 0 }) === null, 'missing point → null');

// --- 1€ filter: converges to a held value, and smooths a spike ---
const f = new OneEuro();
let v; for (let i = 0; i < 30; i++) v = f.filter(100, i * 33);
ok(Math.abs(v - 100) < 0.5, '1€ filter converges to steady value');
const f2 = new OneEuro();
for (let i = 0; i < 10; i++) f2.filter(100, i * 33);
const spiked = f2.filter(40, 10 * 33);   // one bad frame
// the filter attenuates a lone spike; the dwell gate (below) is what fully
// rejects single bad frames from ever producing a rep.
ok(spiked > 55, '1€ filter attenuates a single-frame spike (got ' + Math.round(spiked) + ')');

// --- squat: 3 clean deep reps ---
const sq = new RepEngine('squat');
for (let n = 0; n < 3; n++) { feed(sq, 175); feed(sq, 80); } feed(sq, 175);
ok(sq.reps === 3, '3 deep squats counted (got ' + sq.reps + ')');
ok(sq.goodReps === 3, 'all 3 flagged good depth (got ' + sq.goodReps + ')');

// --- squat: a shallow rep still counts but is flagged ---
const sh = new RepEngine('squat');
feed(sh, 175); feed(sh, 120);                 // below repStart(140), above depthTarget(100)
const ev = feedEv(sh, 175);
ok(sh.reps === 1, 'shallow rep is counted (got ' + sh.reps + ')');
ok(sh.goodReps === 0, 'shallow rep not counted as good');
ok(ev && ev.type === 'shallow', 'shallow rep raises a coaching cue');

// --- ROBUSTNESS: a tiny bob above repStart is ignored ---
const tb = new RepEngine('squat'); feed(tb, 175);
for (let i = 0; i < 14; i++) tb.step(150);
ok(tb.reps === 0, 'sub-threshold movement does not count');

// --- ROBUSTNESS: jitter alternating across the start line never counts ---
const jit = new RepEngine('squat'); feed(jit, 175);
for (let i = 0; i < 40; i++) jit.step(i % 2 ? 138 : 143); // straddles repStart 140
ok(jit.reps === 0, 'alternating jitter across threshold is rejected (got ' + jit.reps + ')');

// --- ROBUSTNESS: an instantaneous flip (too fast to be a rep) is rejected ---
const fast = new RepEngine('squat');
fast.step(175); fast.step(175);
fast.step(80); fast.step(80); fast.step(80);   // dive
fast.step(175); fast.step(175); fast.step(175); // pop straight back (~200ms total)
ok(fast.reps === 0, 'too-fast flip rejected by duration gate (got ' + fast.reps + ')');

// --- ROBUSTNESS: presence gate via update() ---
function bodySide(angleAtKnee, visibility) {
  // build a minimal landmark array with a left hip/knee/ankle at a known knee angle
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const rad = (180 - angleAtKnee) * Math.PI / 180;
  lm[SIDE.left.hip] = { x: 0.5, y: 0.4, visibility };
  lm[SIDE.left.knee] = { x: 0.5, y: 0.6, visibility };
  lm[SIDE.left.ankle] = { x: 0.5 + Math.sin(rad) * 0.2, y: 0.6 + Math.cos(rad) * 0.2, visibility };
  return lm;
}
const gate = new RepEngine('squat');
let res = gate.update(bodySide(80, 0.2), 0);     // joints barely visible
ok(res.valid === false && res.reason === 'low-visibility', 'low-visibility pose is gated out');
res = gate.update(Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 })), 33);
// all at same point → degenerate but visible; angle computes, but no motion → no reps
ok(gate.reps === 0, 'no phantom reps from a static visible pose');

// out-of-frame gate
const offFrame = bodySide(80, 0.9); offFrame[SIDE.left.ankle].y = 0.995;
ok(poseQuality([offFrame[SIDE.left.hip], offFrame[SIDE.left.knee], offFrame[SIDE.left.ankle]]).reason === 'out-of-frame',
  'joint at the frame edge is flagged out-of-frame');

// --- curl + pushup count their deep reps ---
const cu = new RepEngine('curl'); feed(cu, 165); feed(cu, 45); feed(cu, 165);
ok(cu.reps === 1 && cu.goodReps === 1, 'curl deep rep (reps=' + cu.reps + ' good=' + cu.goodReps + ')');

const pu = new RepEngine('pushup'); feed(pu, 170); feed(pu, 80);
const pe = feedEv(pu, 170);
ok(pe && pe.type === 'good' && /Good rep/.test(pe.msg), 'pushup emits a good-rep event');

// pull-up (calibrated from the angle dataset): hang ~175° → full pull ~55°
const pl = new RepEngine('pullup'); feed(pl, 175); feed(pl, 55); feed(pl, 175);
ok(pl.reps === 1 && pl.goodReps === 1, 'pull-up deep rep (reps=' + pl.reps + ' good=' + pl.goodReps + ')');
// a chin-not-over-bar partial (only to 95°) is counted but flagged shallow
const pls = new RepEngine('pullup'); feed(pls, 175); feed(pls, 95);
const pls_ev = feedEv(pls, 175);
ok(pls.reps === 1 && pls.goodReps === 0 && pls_ev && pls_ev.type === 'shallow', 'shallow pull-up flagged');

// --- config integrity: thresholds ordered so coaching can fire ---
for (const e of Object.values(EXERCISES)) {
  ok(e.repStart > e.depthTarget && e.extended > e.repStart && e.minRange > 0,
    `${e.id} thresholds ordered (extended>repStart>depthTarget, minRange set)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
