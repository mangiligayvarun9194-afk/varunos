// 3D pose math for Coach-Replay. MediaPipe hands us TWO skeletons per frame: the
// flat image landmarks (res.landmarks) the live coach uses, and metric 3D WORLD
// landmarks (res.worldLandmarks) — meters, origin at the hip-center, produced from
// a learned 3D body prior. The live path throws the 3D away; the replay path uses
// it because a joint ANGLE measured in 3D is view-invariant (grade from any camera
// angle) and the prior fills in self-occluded joints far better than 2D guesses.
//
// Pure + framework-free so it unit-tests with synthetic landmarks in plain Node.

import { SIDE, bestSide } from './formcoach.js';

// Interior angle (degrees) at vertex B for 3D points A-B-C. Orientation-independent:
// it only depends on the two limb directions, which is exactly why it's invariant to
// where the camera sits.
export function angle3d(a, b, c) {
  if (!a || !b || !c) return null;
  const bax = a.x - b.x, bay = a.y - b.y, baz = (a.z || 0) - (b.z || 0);
  const bcx = c.x - b.x, bcy = c.y - b.y, bcz = (c.z || 0) - (b.z || 0);
  const dot = bax * bcx + bay * bcy + baz * bcz;
  const mag = Math.hypot(bax, bay, baz) * Math.hypot(bcx, bcy, bcz);
  if (mag === 0) return null;
  let cos = dot / mag;
  cos = Math.max(-1, Math.min(1, cos));
  return Math.acos(cos) * 180 / Math.PI;
}

// The lift's working joint angle, in 3D. The working SIDE is chosen from the 2D
// landmarks' visibility (the world landmarks carry no visibility), then the angle is
// computed from the world landmarks — same SIDE map + spec joints as the live engine,
// so the value drops straight into RepEngine.step() as a raw angle.
export function jointRaw3d(imgLandmarks, worldLandmarks, ex) {
  if (!imgLandmarks || !worldLandmarks || !ex) return null;
  const j = ex.joints;
  const side = bestSide(imgLandmarks, j);
  const idx = SIDE[side];
  const a = worldLandmarks[idx[j[0]]], b = worldLandmarks[idx[j[1]]], c = worldLandmarks[idx[j[2]]];
  return angle3d(a, b, c);
}

// Mean visibility of the three tracked joints (from the 2D landmarks) — the per-frame
// confidence the replay grader uses to decide whether to trust a frame or gap-fill it.
export function frameConfidence(imgLandmarks, ex) {
  if (!imgLandmarks || !ex) return 0;
  const j = ex.joints;
  const side = bestSide(imgLandmarks, j);
  const idx = SIDE[side];
  let sum = 0, n = 0;
  for (const name of j) {
    const lm = imgLandmarks[idx[name]];
    sum += lm && typeof lm.visibility === 'number' ? lm.visibility : (lm ? 1 : 0);
    n += 1;
  }
  return n ? sum / n : 0;
}
