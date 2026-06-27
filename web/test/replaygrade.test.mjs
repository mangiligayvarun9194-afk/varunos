// Tests for the offline Coach-Replay grader. Pure, synthetic 3D recordings.
// Run: node web/test/replaygrade.test.mjs
import { gapFill, gradeRecording } from '../src/lib/replaygrade.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// Build a recording: a sequence of cosine reps in raw-angle space (top → bottom → top)
// at 30fps. `confFn(globalIndex)` sets per-frame confidence (default 0.9).
const DT = 1000 / 30;
function buildRec(reps, confFn = () => 0.9) {
  const frames = []; let t = 0; let gi = 0;
  // settle at the top first so the engine has a stable extension reference
  for (let i = 0; i < 6; i++) { frames.push({ t, raw: reps[0].top, conf: confFn(gi++) }); t += DT; }
  for (const { top, bottom, dN = 30, uN = 30 } of reps) {
    for (let i = 1; i <= dN; i++) { const u = i / dN; frames.push({ t, raw: top - (top - bottom) * (0.5 - 0.5 * Math.cos(Math.PI * u)), conf: confFn(gi++) }); t += DT; }
    for (let i = 1; i <= uN; i++) { const u = i / uN; frames.push({ t, raw: bottom + (top - bottom) * (0.5 - 0.5 * Math.cos(Math.PI * u)), conf: confFn(gi++) }); t += DT; }
    for (let i = 0; i < 4; i++) { frames.push({ t, raw: top, conf: confFn(gi++) }); t += DT; }
  }
  return frames;
}

// --- gapFill: interpolates occluded frames from both neighbours ---
{
  const frames = [
    { t: 0, raw: 100, conf: 0.9 },
    { t: 33, raw: 999, conf: 0.1 },   // occluded — true value ~90
    { t: 66, raw: 80, conf: 0.9 },
  ];
  const g = gapFill(frames);
  ok(Math.abs(g.frames[1].raw - 90) < 1 && g.frames[1].filled, 'occluded frame interpolated from neighbours');
  ok(Math.abs(g.filledFrac - 1 / 3) < 1e-9, 'filledFrac reports the occluded fraction');
}
ok(gapFill([{ t: 0, raw: null, conf: 0 }, { t: 33, raw: 50, conf: 0.9 }]).frames[0].raw === 50, 'leading gap holds the next confident value');

// --- a clean deep set: 3 reps, all good, high avg, time windows ordered ---
{
  const rec = buildRec([{ top: 175, bottom: 82 }, { top: 175, bottom: 82 }, { top: 175, bottom: 82 }]);
  const g = gradeRecording(rec, 'squat');
  ok(g.reps.length === 3, '3 reps segmented from the recording (got ' + g.reps.length + ')');
  ok(g.goodReps === 3, 'all 3 graded as good depth');
  ok(g.avgScore >= 75, 'clean deep set scores high (got ' + g.avgScore + ')');
  ok(!g.lowConfidence, 'clean set is not flagged low-confidence');
  ok(g.reps.every((r) => r.tEnd > r.tStart), 'every rep has an ordered [tStart,tEnd] window');
  ok(g.reps[1].tStart >= g.reps[0].tEnd, 'rep windows are in chronological order');
  ok(typeof g.reps[0].depth === 'number' && typeof g.reps[0].shape === 'number', 'reps carry depth/tempo/shape');
}

// --- a shallow set is counted but flagged + scores lower ---
{
  const deep = gradeRecording(buildRec([{ top: 175, bottom: 82 }]), 'squat');
  const shallow = gradeRecording(buildRec([{ top: 175, bottom: 128 }]), 'squat');
  ok(shallow.reps.length === 1 && shallow.goodReps === 0, 'shallow rep counted, not good');
  ok(shallow.reps[0].tags.some((t) => /shallow/.test(t)), 'shallow rep raises a depth cue');
  ok(shallow.avgScore < deep.avgScore, 'shallow set scores below a deep one');
  ok(shallow.worstIdx === 0, 'worstIdx points at the only (shallow) rep');
}

// --- occlusion: half the frames low-confidence → gap-filled, still grades, flagged ---
{
  // mark the entire descent/ascent of the middle region as occluded (>35% of frames)
  const rec = buildRec([{ top: 175, bottom: 82 }, { top: 175, bottom: 82 }], (i) => (i > 40 && i < 110 ? 0.2 : 0.9));
  const g = gradeRecording(rec, 'squat');
  ok(g.lowConfidence, 'heavily-occluded recording is flagged lowConfidence (filled ' + Math.round(g.filledFrac * 100) + '%)');
  ok(g.reps.length >= 1, 'gap-fill still recovers reps from an occluded recording (got ' + g.reps.length + ')');
}

// --- robustness: too-short / empty recordings grade safely ---
ok(gradeRecording([], 'squat').reps.length === 0 && gradeRecording([], 'squat').avgScore === null, 'empty recording grades to nothing safely');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
