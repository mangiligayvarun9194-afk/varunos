// Form-Coach — pure, framework-free motion logic for the camera coach.
//
// This file holds NO camera, DOM, or MediaPipe code on purpose: it is the
// deterministic "scientific trainer" brain (joint angles + rep state-machine +
// form judgement) so it can be unit-tested with synthetic angle sequences,
// exactly the way the strength science is reasoned about. The React screen
// (FormCoach.jsx) feeds it real BlazePose landmarks; tests feed it raw angles.
//
// Angle thresholds are grounded in standard strength biomechanics (ExRx / NSCA
// joint-ROM norms) and classic-physique full-ROM coaching:
//   • Squat   — knee angle: standing ~175°, parallel ~90°. Depth target ≤100°.
//   • Push-up — elbow angle: top ~165°, bottom ~90°. Depth target ≤95°.
//   • Curl    — elbow angle: stretched ~160°, peak squeeze ~45°. Target ≤55°.
// In ALL three the "extended" position is a LARGE angle and the "contracted"
// position is a SMALL angle, so one state-machine handles every lift.
//
// Three thresholds per lift, and the gap between them is what lets the coach
// actually coach:
//   • extended   — back to the top; a rep is tallied here.
//   • repStart   — loose; you've clearly begun the descent (counts as an
//                  attempt even if shallow). Must be > depthTarget.
//   • depthTarget — strict; the depth a clean, full-ROM rep must reach. A rep
//                  that starts but never reaches this is counted yet flagged.

// BlazePose (MediaPipe Pose) 33-landmark indices, by body side.
export const SIDE = {
  left:  { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};

export const EXERCISES = {
  squat: {
    id: 'squat', label: 'Squat', joints: ['hip', 'knee', 'ankle'],
    extended: 160, repStart: 140, depthTarget: 100,
    setup: 'Stand side-on to the camera, full body in frame.',
    cue: 'Sit the hips back, knees track over toes, chest tall.',
    shallow: 'Go deeper — break parallel.',
  },
  pushup: {
    id: 'pushup', label: 'Push-up', joints: ['shoulder', 'elbow', 'wrist'],
    extended: 158, repStart: 130, depthTarget: 95,
    setup: 'Side-on to the camera so your whole body shows.',
    cue: 'Body in one straight line, elbows ~45°, brace the core.',
    shallow: 'Lower more — chest toward the floor.',
  },
  curl: {
    id: 'curl', label: 'Biceps Curl', joints: ['shoulder', 'elbow', 'wrist'],
    extended: 150, repStart: 110, depthTarget: 60,
    setup: 'Face or angle to the camera, working arm clearly visible.',
    cue: 'Pin the elbow, full stretch at the bottom, squeeze at the top.',
    shallow: 'Curl higher — full peak squeeze.',
  },
};

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

// The rep / form state-machine. One instance per active set.
export class RepEngine {
  constructor(exId) { this.set(exId); }

  set(exId) {
    this.ex = EXERCISES[exId] || EXERCISES.squat;
    this.reps = 0;
    this.goodReps = 0;
    this.phase = 'up';        // 'up' = extended/ready, 'down' = in the rep
    this._smooth = null;      // EMA-smoothed angle (kills landmark jitter)
    this._minInRep = 999;     // deepest angle reached this rep
    this.side = null;
  }

  // Public entry: real BlazePose landmarks → step the machine.
  update(landmarks) {
    if (!landmarks || !this.ex) return null;
    const j = this.ex.joints;
    this.side = bestSide(landmarks, j);
    const idx = SIDE[this.side];
    const ang = angleDeg(landmarks[idx[j[0]]], landmarks[idx[j[1]]], landmarks[idx[j[2]]]);
    if (ang == null) return null;
    return this.step(ang, this.side);
  }

  // Core machine — fed a raw joint angle. Directly unit-testable.
  step(rawAngle, side = this.side) {
    // EMA smoothing: heavier weight on history to suppress jitter/double-counts.
    this._smooth = this._smooth == null ? rawAngle : this._smooth * 0.6 + rawAngle * 0.4;
    const a = this._smooth;
    let event = null;

    if (this.phase === 'up' && a <= this.ex.repStart) {
      // Crossed below the loose start threshold → a rep is underway.
      this.phase = 'down';
      this._minInRep = a;
    } else if (this.phase === 'down') {
      this._minInRep = Math.min(this._minInRep, a);
      if (a >= this.ex.extended) {
        // Returned to full extension → rep complete; judge depth.
        this.phase = 'up';
        this.reps += 1;
        const deep = this._minInRep <= this.ex.depthTarget;
        if (deep) {
          this.goodReps += 1;
          event = { type: 'good', msg: `Good rep — ${this.reps}` };
        } else {
          event = { type: 'shallow', msg: this.ex.shallow };
        }
        this._minInRep = 999;
      }
    }

    return {
      angle: Math.round(a),
      phase: this.phase,
      reps: this.reps,
      goodReps: this.goodReps,
      side,
      event,
    };
  }
}
