// Offline grader for a recorded set (Coach-Replay). Unlike the live coach, this runs
// AFTER the set with the whole clip in hand, so it can do two things the causal live
// path can't: (1) gap-fill frames where a joint was occluded by interpolating the 3D
// angle from confident neighbours on BOTH sides, and (2) review every rep with a score.
//
// It deliberately REUSES the live rep engine: feeding the 3D-derived raw angles into
// RepEngine.step() gives us the exact same filtering, rep segmentation, and per-rep DTW
// grading (depth + tempo + shape) the live coach uses — no second grading code path.
// Pure + framework-free → unit-tested with synthetic recordings.

import { RepEngine } from './formcoach.js';

const CONF_MIN = 0.5;       // frames below this are treated as occluded → gap-filled
const LOW_CONF_FRAC = 0.35; // if more than this fraction was filled, flag the recording

// Fill low-confidence / missing raw angles by linear interpolation in time from the
// nearest confident frames either side (hold the endpoint if only one side exists).
// Returns { frames: [{ t, raw, conf, filled }], filledFrac }.
export function gapFill(frames, confMin = CONF_MIN) {
  const n = frames.length;
  const out = frames.map((f) => ({ t: f.t, raw: f.raw, conf: f.conf ?? 0, filled: false }));
  const good = (i) => out[i].raw != null && out[i].conf >= confMin;
  let filled = 0;
  for (let i = 0; i < n; i++) {
    if (good(i)) continue;
    let lo = i - 1; while (lo >= 0 && !good(lo)) lo--;
    let hi = i + 1; while (hi < n && !good(hi)) hi++;
    let val = null;
    if (lo >= 0 && hi < n) {
      const span = out[hi].t - out[lo].t || 1;
      const u = (out[i].t - out[lo].t) / span;
      val = out[lo].raw + (out[hi].raw - out[lo].raw) * u;
    } else if (lo >= 0) val = out[lo].raw;
    else if (hi < n) val = out[hi].raw;
    if (val != null) { out[i].raw = val; out[i].filled = true; filled++; }
  }
  return { frames: out, filledFrac: n ? filled / n : 0 };
}

// Grade a recorded set. `frames` = [{ t (ms), raw (3D joint angle), conf (0..1) }].
// Returns per-rep scores with time windows for the scrubber, plus summary stats.
export function gradeRecording(frames, exId) {
  const empty = { reps: [], avgScore: null, goodReps: 0, worstIdx: -1, lowConfidence: false, filledFrac: 0 };
  if (!frames || frames.length < 4) return empty;

  const { frames: filledFrames, filledFrac } = gapFill(frames);
  const eng = new RepEngine(exId);
  const reps = [];
  let downStart = filledFrames[0].t;

  for (const f of filledFrames) {
    if (f.raw == null) continue;
    const prevPhase = eng.phase;
    const r = eng.step(f.raw, f.t);
    if (prevPhase === 'up' && eng.phase === 'down') downStart = f.t;   // descent began
    if (r && r.event) {
      const grade = r.lastGrade || {};
      reps.push({
        index: reps.length,
        tStart: downStart,
        tEnd: f.t,
        type: r.event.type,
        score: r.event.score ?? 0,
        depth: grade.depth ?? null,
        tempo: grade.tempo ?? null,
        shape: grade.shape ?? null,
        tags: r.event.tags || [],
      });
    }
  }

  if (!reps.length) return { ...empty, filledFrac, lowConfidence: filledFrac > LOW_CONF_FRAC };
  const avgScore = Math.round(reps.reduce((s, r) => s + r.score, 0) / reps.length);
  const goodReps = reps.filter((r) => r.type === 'good').length;
  let worstIdx = 0;
  reps.forEach((r, i) => { if (r.score < reps[worstIdx].score) worstIdx = i; });
  return { reps, avgScore, goodReps, worstIdx, lowConfidence: filledFrac > LOW_CONF_FRAC, filledFrac };
}
