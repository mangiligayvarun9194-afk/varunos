// Recording buffer for Coach-Replay. While the user records a set, each frame's 3D
// world skeleton (for playback) plus the working-joint angle + confidence (for offline
// grading) are captured here. Downsampled to ~22fps and hard-capped so a long set
// can't blow up memory: ~1200 frames × 33 × 3 floats ≈ 0.5 MB.
//
// Storing the SKELETON (not video) keeps the replay light and means the clip is just
// numbers — which also makes a future cloud-reprocess step a clean, small upload.

import { EXERCISES } from './formcoach.js';
import { jointRaw3d, frameConfidence } from './pose3d.js';

export class ReplayRecorder {
  constructor(exId, { minDtMs = 45, cap = 1200 } = {}) {
    this.minDt = minDtMs;
    this.cap = cap;
    this.setExercise(exId);
    this.reset();
  }

  setExercise(exId) { this.ex = EXERCISES[exId] || EXERCISES.squat; }

  reset() {
    this._frames = [];  // { t, raw, conf } for the grader
    this._skel = [];    // [{x,y,z} × 33] for the playback
    this._lastT = -1e9;
    this.truncated = false;
  }

  // Feed live landmarks. `img` = 2D image landmarks (carry visibility), `world` = 3D
  // metric world landmarks. No-ops on missing data, on too-soon frames (downsample),
  // and once the cap is hit (sets `truncated`).
  push(t, img, world) {
    if (!world || !img) return;
    if (this._frames.length && t - this._lastT < this.minDt) return;
    if (this._frames.length >= this.cap) { this.truncated = true; return; }
    this._lastT = t;
    this._frames.push({ t, raw: jointRaw3d(img, world, this.ex), conf: frameConfidence(img, this.ex) });
    this._skel.push(world.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })));
  }

  frames() { return this._frames; }
  skeletons() { return this._skel; }
  count() { return this._frames.length; }
  durationMs() { return this._frames.length ? this._frames[this._frames.length - 1].t - this._frames[0].t : 0; }
}
