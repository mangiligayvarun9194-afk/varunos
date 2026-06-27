// Tests for the 3D pose math behind Coach-Replay. Pure, synthetic landmarks.
// Run: node web/test/pose3d.test.mjs
import { angle3d, jointRaw3d, frameConfidence } from '../src/lib/pose3d.js';
import { EXERCISES, SIDE } from '../src/lib/formcoach.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const close = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// --- angle3d on known triangles ---
ok(close(angle3d({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }), 180), 'collinear = 180°');
ok(close(angle3d({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 90), 'right angle in xy = 90°');
ok(close(angle3d({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 90), 'right angle out of plane (uses z) = 90°');
ok(angle3d(null, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }) === null, 'missing point → null');
ok(angle3d({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }) === null, 'degenerate (zero limb) → null');

// --- VIEW-INVARIANCE: rotating the whole pose must not change the joint angle ---
// Rotate a point set by an arbitrary 3D rotation (yaw * pitch) and confirm the angle
// is unchanged — this is the core property that lets us grade from any camera angle.
function rot(p, yaw, pitch) {
  // yaw about y, then pitch about x
  let { x, y, z } = p;
  let x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  let z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  let y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  let z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return { x: x1, y: y2, z: z2 };
}
{
  const A = { x: 0.2, y: 0.9, z: 0.1 }, B = { x: 0.0, y: 0.0, z: 0.0 }, C = { x: 0.8, y: 0.1, z: -0.3 };
  const base = angle3d(A, B, C);
  const yaw = 0.7, pitch = -0.4;
  const r = angle3d(rot(A, yaw, pitch), rot(B, yaw, pitch), rot(C, yaw, pitch));
  ok(close(base, r, 1e-4), 'joint angle is invariant under 3D rotation (got ' + base.toFixed(2) + ' vs ' + r.toFixed(2) + ')');
}

// --- jointRaw3d: side picked from 2D visibility, angle computed from world coords ---
{
  // 33 world landmarks; set the left-knee chain (hip 23, knee 25, ankle 27) to a
  // ~90° bend, the right side straight. Make the LEFT side more visible in 2D.
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  world[SIDE.left.hip] = { x: 0, y: 1, z: 0 };
  world[SIDE.left.knee] = { x: 0, y: 0, z: 0 };
  world[SIDE.left.ankle] = { x: 1, y: 0, z: 0 };   // 90° at the knee
  const img = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  for (const n of ['hip', 'knee', 'ankle']) img[SIDE.left[n]] = { x: 0.5, y: 0.5, visibility: 0.95 };
  const raw = jointRaw3d(img, world, EXERCISES.squat);
  ok(close(raw, 90, 1e-4), 'jointRaw3d reads the visible side in 3D (got ' + raw.toFixed(2) + ')');
  ok(close(frameConfidence(img, EXERCISES.squat), 0.95, 1e-6), 'frameConfidence = mean joint visibility');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
