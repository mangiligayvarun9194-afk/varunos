// Form-Coach — pure, framework-free motion logic for the camera coach.
//
// This file holds NO camera, DOM, or MediaPipe code on purpose: it is the
// deterministic "scientific trainer" brain (joint angles + rep state-machine +
// form judgement) so it can be unit-tested with synthetic angle sequences,
// exactly the way the strength science is reasoned about. The React screen
// (FormCoach.jsx) feeds it real BlazePose landmarks; tests feed it raw angles.
//
// ROBUSTNESS (why this is more than a threshold-crossing counter): pose models
// emit jittery, sometimes extrapolated landmarks when the body is partly out of
// frame, which naively produces phantom reps while you're standing still. Four
// gates defeat that:
//   1. Presence gate  — only track when the relevant joints are visible AND
//      inside the frame (no inventing reps from off-screen guesses).
//   2. One-Euro filter — adaptive low-pass tuned for human motion: heavy
//      smoothing when still (kills jitter), low lag when moving fast.
//   3. Dwell confirm  — a phase change must hold for several frames; a single
//      noisy frame crossing a threshold can never start/finish a rep.
//   4. Range + time   — a rep must travel a real angular distance over real
//      time; micro-oscillations and instant flips are rejected.
//
// Angle thresholds are grounded in standard strength biomechanics (ExRx / NSCA
// joint-ROM norms) AND calibrated against a real labeled pose-angle dataset
// (~31k frames of Squats / Push-ups / Pull-ups; per-frame joint angles). The
// data's p5–p95 ranges set extended/depth: e.g. squat knee tops out ~178° and a
// full rep drives well below parallel; push-up elbow tops ~178° and bottoms ~40°;
// pull-up elbow hangs ~175° and a full pull flexes past ~60°. (The dataset is
// also why robustness matters — it's riddled with 0° garbage frames from failed
// detections, exactly what the presence gate + 1€ filter reject.) In ALL lifts the
// "extended" position is a LARGE angle and the "contracted" a SMALL angle, so
// one state-machine handles every exercise. Three thresholds per lift:
//   • extended    — back to the top; a rep is tallied here.
//   • repStart    — loose; you've clearly begun the descent (counts as an
//                   attempt even if shallow). Must be > depthTarget.
//   • depthTarget — strict; the depth a clean, full-ROM rep must reach. A rep
//                   that starts but never reaches this is counted yet flagged.

import { gradeRep } from './formgrade.js';

// BlazePose (MediaPipe Pose) 33-landmark indices, by body side.
export const SIDE = {
  left:  { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

// DECLARATIVE EXERCISE SPECS — each lift is data, not code, so the library scales
// to the whole camera-friendly strength catalogue without touching the engine.
// A spec names the dominant joint (3 landmarks), the movement DIRECTION, and the
// two angles that bound a rep:
//   • direction 'flex'   — the working end is a SMALLER joint angle (squat, curl,
//                          push-up, row, sit-up, hinge).
//   • direction 'extend' — the working end is a LARGER angle (overhead press,
//                          triceps pushdown, lateral/front raise, hip thrust).
//   • restAngle  — the relaxed / locked-out position (start of a rep).
//   • peakAngle  — the working contraction (the depth a clean rep must reach).
// deriveThresholds() turns these two intuitive numbers into the engine's
// effective-space thresholds, and the engine flips 'extend' lifts internally so
// ONE state-machine drives every exercise. Adding a lift = adding a row here.
export const EXERCISES = {
  // ---- legs / posterior chain ----
  squat:      { id: 'squat', label: 'Squat', group: 'legs', joints: ['hip', 'knee', 'ankle'], direction: 'flex', restAngle: 172, peakAngle: 80,
                setup: 'Stand side-on, full body in frame.', cue: 'Sit the hips back, knees over toes, chest tall.', shallow: 'Go deeper — break parallel.' },
  lunge:      { id: 'lunge', label: 'Lunge', group: 'legs', joints: ['hip', 'knee', 'ankle'], direction: 'flex', restAngle: 170, peakAngle: 95,
                setup: 'Side-on, front leg clearly visible.', cue: 'Drop straight down, front shin vertical.', shallow: 'Sink lower — back knee toward the floor.' },
  rdl:        { id: 'rdl', label: 'RDL', group: 'legs', joints: ['shoulder', 'hip', 'knee'], direction: 'flex', restAngle: 175, peakAngle: 95,
                setup: 'Side-on, whole torso and hips in frame.', cue: 'Hinge at the hips, soft knees, flat back.', shallow: 'Hinge further — feel the hamstrings.' },
  deadlift:   { id: 'deadlift', label: 'Deadlift', group: 'back', joints: ['shoulder', 'hip', 'knee'], direction: 'flex', restAngle: 175, peakAngle: 88,
                setup: 'Side-on, full body and the bar in frame.', cue: 'Flat back, push the floor away, lock the hips.', shallow: 'Reach the bar — full hip hinge.' },
  hipthrust:  { id: 'hipthrust', label: 'Hip Thrust', group: 'legs', joints: ['shoulder', 'hip', 'knee'], direction: 'extend', restAngle: 110, peakAngle: 175,
                setup: 'Side-on, hips and torso in frame.', cue: 'Drive through the heels, squeeze the glutes at the top.', shallow: 'Higher — full lockout at the top.' },
  // ---- push ----
  pushup:     { id: 'pushup', label: 'Push-up', group: 'chest', joints: ['shoulder', 'elbow', 'wrist'], direction: 'flex', restAngle: 165, peakAngle: 80,
                setup: 'Side-on so your whole body shows.', cue: 'Body in one line, elbows ~45°, brace.', shallow: 'Lower more — chest toward the floor.' },
  ohp:        { id: 'ohp', label: 'Press', group: 'shoulders', joints: ['shoulder', 'elbow', 'wrist'], direction: 'extend', restAngle: 65, peakAngle: 172,
                setup: 'Face or side-on, arms in frame.', cue: 'Press straight overhead, lock out tall.', shallow: 'Press all the way to lockout.' },
  // ---- pull ----
  pullup:     { id: 'pullup', label: 'Pull-up', group: 'back', joints: ['shoulder', 'elbow', 'wrist'], direction: 'flex', restAngle: 172, peakAngle: 55,
                setup: 'Face or side-on, full body and bar in frame.', cue: 'Full dead hang, pull the chest to the bar.', shallow: 'Pull higher — chin over the bar.' },
  row:        { id: 'row', label: 'Row', group: 'back', joints: ['shoulder', 'elbow', 'wrist'], direction: 'flex', restAngle: 165, peakAngle: 60,
                setup: 'Side-on, hinged over, arms visible.', cue: 'Lead with the elbow, pull to the hip.', shallow: 'Pull higher — squeeze the back.' },
  // ---- arms ----
  curl:       { id: 'curl', label: 'Curl', group: 'arms', joints: ['shoulder', 'elbow', 'wrist'], direction: 'flex', restAngle: 155, peakAngle: 45,
                setup: 'Face or angle in, working arm visible.', cue: 'Pin the elbow, full stretch then squeeze.', shallow: 'Curl higher — full peak squeeze.' },
  pushdown:   { id: 'pushdown', label: 'Pushdown', group: 'arms', joints: ['shoulder', 'elbow', 'wrist'], direction: 'extend', restAngle: 65, peakAngle: 172,
                setup: 'Side-on, upper arm pinned, forearm visible.', cue: 'Elbows tucked, extend fully, squeeze the triceps.', shallow: 'Extend all the way — lock it out.' },
  // ---- shoulders (raises) ----
  lateralraise: { id: 'lateralraise', label: 'Lateral Raise', group: 'shoulders', joints: ['hip', 'shoulder', 'elbow'], direction: 'extend', restAngle: 18, peakAngle: 92,
                setup: 'Face the camera, both arms in frame.', cue: 'Lead with the elbows, raise to shoulder height.', shallow: 'Raise to shoulder height.' },
  frontraise: { id: 'frontraise', label: 'Front Raise', group: 'shoulders', joints: ['hip', 'shoulder', 'elbow'], direction: 'extend', restAngle: 18, peakAngle: 88,
                setup: 'Side-on, working arm in frame.', cue: 'Raise straight in front to shoulder height.', shallow: 'Raise to shoulder height.' },
  // ---- core ----
  situp:      { id: 'situp', label: 'Sit-up', group: 'core', joints: ['shoulder', 'hip', 'knee'], direction: 'flex', restAngle: 155, peakAngle: 80,
                setup: 'Side-on, whole torso in frame.', cue: 'Curl up under control, don’t yank the neck.', shallow: 'Come up higher.' },
};

// Turn a spec's two real-world angles into the engine's effective-space
// thresholds. 'extend' lifts are flipped (eff = 180 - raw) so the same
// large-rest → small-peak state-machine handles both movement directions.
export function deriveThresholds(ex) {
  const flex = ex.direction !== 'extend';
  const effRest = flex ? ex.restAngle : 180 - ex.restAngle;   // large = relaxed
  const effPeak = flex ? ex.peakAngle : 180 - ex.peakAngle;   // small = contracted
  const span = Math.max(20, effRest - effPeak);
  return {
    flex,
    extended: effRest - Math.min(8, span * 0.12),   // back to rest → tally a rep
    repStart: effRest - span * 0.4,                  // clearly into the rep
    depthTarget: effPeak + Math.min(12, span * 0.18),// a clean rep must reach here
    minRange: span * 0.5,                            // real amplitude, not a twitch
  };
}

// Logging map: a coached set → a real workout set. The exercise id is chosen so
// the backend's muscle-keyword matcher routes the volume to the right group
// (squat→legs, pushup→chest, pullup→back, curl→arms). Bodyweight movements
// genuinely load muscle, so we estimate the load as a fraction of bodyweight
// (sports-science rough: squat ≈ 0.9·BW on the legs, push-up ≈ 0.65·BW through
// the hands, pull-up ≈ full BW, curl ≈ a light arm load). Clearly an estimate —
// the point is that camera reps feed progress + the Twin's growth, honestly.
export const LOG_MAP = {
  squat:        { logId: 'squat',            group: 'legs',      loadFactor: 0.90 },
  lunge:        { logId: 'lunge',            group: 'legs',      loadFactor: 0.60 },
  rdl:          { logId: 'rdl',              group: 'legs',      loadFactor: 0.70 },
  deadlift:     { logId: 'deadlift',         group: 'back',      loadFactor: 1.00 },
  hipthrust:    { logId: 'hip_thrust',       group: 'legs',      loadFactor: 0.85 },
  pushup:       { logId: 'pushup',           group: 'chest',     loadFactor: 0.65 },
  ohp:          { logId: 'overhead_press',   group: 'shoulders', loadFactor: 0.25 },
  pullup:       { logId: 'pullup',           group: 'back',      loadFactor: 1.00 },
  row:          { logId: 'row',              group: 'back',      loadFactor: 0.30 },
  curl:         { logId: 'curl',             group: 'arms',      loadFactor: 0.12 },
  pushdown:     { logId: 'triceps_pushdown', group: 'arms',      loadFactor: 0.10 },
  lateralraise: { logId: 'lateral_raise',    group: 'shoulders', loadFactor: 0.08 },
  frontraise:   { logId: 'front_raise',      group: 'shoulders', loadFactor: 0.08 },
  situp:        { logId: 'situp',            group: 'core',      loadFactor: 0.30 },
};

// Estimated working load (kg) for a coached bodyweight set.
export function estimateLoad(exId, bodyweightKg) {
  const m = LOG_MAP[exId];
  const bw = bodyweightKg && bodyweightKg > 0 ? bodyweightKg : 75;
  if (!m) return 0;
  return Math.round(bw * m.loadFactor);
}

// Tuning constants.
const CONFIRM_FRAMES = 3;   // a phase change must persist this many frames
const MIN_REP_MS = 320;     // a real rep is not instantaneous
const VIS_MIN_EACH = 0.5;   // each tracked joint must clear this confidence
const VIS_MIN_MEAN = 0.65;  // mean confidence of the three joints
const FRAME_MARGIN = 0.02;  // joints this close to the edge count as out-of-frame

// Interior angle (degrees) at vertex B for points A-B-C. Uses x/y only
// (normalized image coords); robust to which way the joint folds.
export function angleDeg(a, b, c) {
  if (!a || !b || !c) return null;
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const cross = abx * cby - aby * cbx;
  let ang = Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI;
  if (ang > 180) ang = 360 - ang;
  return ang;
}

// Choose the more-visible body side for the exercise's three joints.
export function bestSide(landmarks, joints) {
  const vis = (s) => joints.reduce((t, j) => {
    const lm = landmarks[SIDE[s][j]];
    return t + (lm && typeof lm.visibility === 'number' ? lm.visibility : 0);
  }, 0);
  return vis('left') >= vis('right') ? 'left' : 'right';
}

// Presence gate: are all three tracked joints confidently visible and in-frame?
// Returns { ok, reason, score } so the UI can give specific guidance.
export function poseQuality(points) {
  let sum = 0;
  for (const p of points) {
    if (!p) return { ok: false, reason: 'incomplete', score: 0 };
    const v = typeof p.visibility === 'number' ? p.visibility : 1;
    if (v < VIS_MIN_EACH) return { ok: false, reason: 'low-visibility', score: v };
    if (p.x < FRAME_MARGIN || p.x > 1 - FRAME_MARGIN ||
        p.y < FRAME_MARGIN || p.y > 1 - FRAME_MARGIN) {
      return { ok: false, reason: 'out-of-frame', score: v };
    }
    sum += v;
  }
  const score = sum / points.length;
  if (score < VIS_MIN_MEAN) return { ok: false, reason: 'low-visibility', score };
  return { ok: true, reason: 'ok', score };
}

// Adaptive low-pass filter (Casiez et al. "1€ Filter"). Smooths hard when the
// signal is slow (kills jitter) and tracks closely when it moves fast (low lag).
export class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.xPrev = null; this.dxPrev = 0; this.tPrev = null;
  }
  _alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x, t) {
    if (this.xPrev == null) { this.xPrev = x; this.tPrev = t; return x; }
    let dt = (t - this.tPrev) / 1000;
    if (!(dt > 0)) dt = 1 / 30;
    this.tPrev = t;
    const dx = (x - this.xPrev) / dt;
    const aD = this._alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this._alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }
  reset() { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; }
}

// The rep / form state-machine. One instance per active set.
export class RepEngine {
  constructor(exId) { this.set(exId); }

  set(exId) {
    this.ex = EXERCISES[exId] || EXERCISES.squat;
    this.t = deriveThresholds(this.ex);   // effective-space thresholds for this lift
    this.reps = 0;
    this.goodReps = 0;
    this.phase = 'up';
    this.valid = false;
    this.side = null;
    this._filter = new OneEuro();
    this._t = 0;          // synthetic clock for callers that omit timestamps
    this._downC = 0;      // consecutive frames confirming the descent
    this._upC = 0;        // consecutive frames confirming the return
    this._minInRep = 999; // deepest angle reached this rep
    this._topRef = null;  // extension reference captured before the descent
    this._downT = 0;      // timestamp the descent was confirmed
    this._samples = [];   // {t, eff} trajectory of the current rep (for grading)
    this._formSum = 0;    // running form-score total
    this._gradedReps = 0; // reps that produced a grade
    this._lastGrade = null;
  }

  _resetProgress() {
    this.phase = 'up';
    this._downC = 0; this._upC = 0;
    this._minInRep = 999; this._topRef = null;
  }

  // Public entry: real BlazePose landmarks (+ optional timestamp ms) → step.
  update(landmarks, t) {
    if (!landmarks || !this.ex) {
      this.valid = false; this._resetProgress();
      return this._frame({ valid: false, reason: 'no-pose' });
    }
    const j = this.ex.joints;
    const side = bestSide(landmarks, j);
    this.side = side;
    const idx = SIDE[side];
    const pts = [landmarks[idx[j[0]]], landmarks[idx[j[1]]], landmarks[idx[j[2]]]];
    const q = poseQuality(pts);
    if (!q.ok) {
      // Lost a clear view → abandon any in-progress rep so we never resume mid-rep.
      this.valid = false; this._resetProgress(); this._filter.reset();
      return this._frame({ valid: false, reason: q.reason, quality: q.score, side });
    }
    const ang = angleDeg(pts[0], pts[1], pts[2]);
    if (ang == null) {
      this.valid = false;
      return this._frame({ valid: false, reason: 'no-angle', side });
    }
    this.valid = true;
    return this.step(ang, t, side, q.score);
  }

  // Core machine — fed a raw joint angle. Directly unit-testable.
  // 'extend' lifts are flipped to effective space (eff = 180 - raw) so the same
  // large-rest → small-peak machine drives flexion and extension movements alike.
  step(rawAngle, t, side = this.side, quality = 1) {
    if (t == null) { this._t += 1000 / 30; t = this._t; } // assume ~30fps
    const T = this.t || (this.t = deriveThresholds(this.ex));
    const eff = T.flex ? rawAngle : 180 - rawAngle;
    const a = this._filter.filter(eff, t);
    let event = null;

    if (this.phase === 'up') {
      // Track the highest extension seen — the top reference for the next rep.
      this._topRef = this._topRef == null ? a : Math.max(this._topRef, a);
      if (a <= T.repStart) this._downC += 1; else this._downC = 0;
      if (this._downC >= CONFIRM_FRAMES) {
        this.phase = 'down';
        this._downC = 0; this._upC = 0;
        this._minInRep = a;
        this._downT = t;
        this._samples = [{ t, eff: this._topRef == null ? a : this._topRef }]; // seed at the true top
      }
    } else { // 'down'
      this._minInRep = Math.min(this._minInRep, a);
      if (a >= T.extended) this._upC += 1; else this._upC = 0;
      if (this._upC >= CONFIRM_FRAMES) {
        this._samples.push({ t, eff: a });
        const top = this._topRef == null ? a : this._topRef;
        const range = top - this._minInRep;
        const dur = t - this._downT;
        // Only a movement of real amplitude AND duration is a rep.
        if (range >= T.minRange && dur >= MIN_REP_MS) {
          this.reps += 1;
          const grade = gradeRep(this._samples, T);
          this._lastGrade = grade;
          this._formSum += grade.score; this._gradedReps += 1;
          const deep = this._minInRep <= T.depthTarget;
          if (deep) {
            this.goodReps += 1;
            event = { type: 'good', msg: `Good rep — ${this.reps}`, score: grade.score, tags: grade.tags };
          } else {
            event = { type: 'shallow', msg: this.ex.shallow, score: grade.score, tags: grade.tags };
          }
        }
        // Reset for the next rep regardless (the partial is discarded).
        this.phase = 'up';
        this._downC = 0; this._upC = 0;
        this._minInRep = 999;
        this._topRef = a;
        this._samples = [];
      }
    }
    // Record the rep trajectory while descending/returning (for grading).
    if (this.phase === 'down') this._samples.push({ t, eff: a });

    // Report the angle back in real-world terms for the HUD.
    const disp = T.flex ? a : 180 - a;
    return this._frame({
      valid: true, angle: Math.round(disp), phase: this.phase, side, quality, event,
    });
  }

  _frame(extra) {
    return {
      valid: false, angle: null, phase: this.phase,
      reps: this.reps, goodReps: this.goodReps,
      avgForm: this._gradedReps ? Math.round(this._formSum / this._gradedReps) : null,
      lastGrade: this._lastGrade,
      side: this.side, quality: 0, event: null,
      ...extra,
    };
  }
}
