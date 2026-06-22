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
// joint-ROM norms) and classic-physique full-ROM coaching. In ALL lifts the
// "extended" position is a LARGE angle and the "contracted" a SMALL angle, so
// one state-machine handles every exercise. Three thresholds per lift:
//   • extended    — back to the top; a rep is tallied here.
//   • repStart    — loose; you've clearly begun the descent (counts as an
//                   attempt even if shallow). Must be > depthTarget.
//   • depthTarget — strict; the depth a clean, full-ROM rep must reach. A rep
//                   that starts but never reaches this is counted yet flagged.

// BlazePose (MediaPipe Pose) 33-landmark indices, by body side.
export const SIDE = {
  left:  { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

export const EXERCISES = {
  squat: {
    id: 'squat', label: 'Squat', joints: ['hip', 'knee', 'ankle'],
    extended: 160, repStart: 140, depthTarget: 100, minRange: 50,
    setup: 'Stand side-on to the camera, full body in frame.',
    cue: 'Sit the hips back, knees track over toes, chest tall.',
    shallow: 'Go deeper — break parallel.',
  },
  pushup: {
    id: 'pushup', label: 'Push-up', joints: ['shoulder', 'elbow', 'wrist'],
    extended: 158, repStart: 130, depthTarget: 95, minRange: 45,
    setup: 'Side-on to the camera so your whole body shows.',
    cue: 'Body in one straight line, elbows ~45°, brace the core.',
    shallow: 'Lower more — chest toward the floor.',
  },
  curl: {
    id: 'curl', label: 'Biceps Curl', joints: ['shoulder', 'elbow', 'wrist'],
    extended: 150, repStart: 110, depthTarget: 60, minRange: 55,
    setup: 'Face or angle to the camera, working arm clearly visible.',
    cue: 'Pin the elbow, full stretch at the bottom, squeeze at the top.',
    shallow: 'Curl higher — full peak squeeze.',
  },
};

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
  step(rawAngle, t, side = this.side, quality = 1) {
    if (t == null) { this._t += 1000 / 30; t = this._t; } // assume ~30fps
    const a = this._filter.filter(rawAngle, t);
    let event = null;

    if (this.phase === 'up') {
      // Track the highest extension seen — the top reference for the next rep.
      this._topRef = this._topRef == null ? a : Math.max(this._topRef, a);
      if (a <= this.ex.repStart) this._downC += 1; else this._downC = 0;
      if (this._downC >= CONFIRM_FRAMES) {
        this.phase = 'down';
        this._downC = 0; this._upC = 0;
        this._minInRep = a;
        this._downT = t;
      }
    } else { // 'down'
      this._minInRep = Math.min(this._minInRep, a);
      if (a >= this.ex.extended) this._upC += 1; else this._upC = 0;
      if (this._upC >= CONFIRM_FRAMES) {
        const top = this._topRef == null ? a : this._topRef;
        const range = top - this._minInRep;
        const dur = t - this._downT;
        // Only a movement of real amplitude AND duration is a rep.
        if (range >= (this.ex.minRange || 45) && dur >= MIN_REP_MS) {
          this.reps += 1;
          const deep = this._minInRep <= this.ex.depthTarget;
          if (deep) {
            this.goodReps += 1;
            event = { type: 'good', msg: `Good rep — ${this.reps}` };
          } else {
            event = { type: 'shallow', msg: this.ex.shallow };
          }
        }
        // Reset for the next rep regardless (the partial is discarded).
        this.phase = 'up';
        this._downC = 0; this._upC = 0;
        this._minInRep = 999;
        this._topRef = a;
      }
    }

    return this._frame({
      valid: true, angle: Math.round(a), phase: this.phase, side, quality, event,
    });
  }

  _frame(extra) {
    return {
      valid: false, angle: null, phase: this.phase,
      reps: this.reps, goodReps: this.goodReps,
      side: this.side, quality: 0, event: null,
      ...extra,
    };
  }
}
