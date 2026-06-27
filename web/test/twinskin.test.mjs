// Tests for the Twin "Living Anatomy" muscle-group mapping. Pure classifier +
// the geometry grouping pass fed synthetic skin data.
// Run: node web/test/twinskin.test.mjs
import { classifyMuscle, assignGroups, GROUP_LABEL, GROUP_READINESS } from '../src/lib/twinSkin.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// --- classifier on real-world bone names (Mixamo / RPM style) ---
ok(classifyMuscle('LeftShoulder', true) === 0, 'shoulder → Shoulders');
ok(classifyMuscle('mixamorigRightArm', true) === 4, 'upper arm → Arms');
ok(classifyMuscle('LeftForeArm', true) === 4, 'forearm → Arms');
ok(classifyMuscle('RightUpLeg', true) === 5, 'thigh front → Quads');
ok(classifyMuscle('RightUpLeg', false) === 6, 'thigh back → Glutes & hams');
ok(classifyMuscle('LeftLeg', true) === 7, 'lower leg → Calves');
ok(classifyMuscle('Spine2', true) === 1, 'upper torso front → Chest');
ok(classifyMuscle('Spine2', false) === 3, 'upper torso back → Back');
ok(classifyMuscle('Spine', true) === 2, 'mid torso front → Core');
ok(classifyMuscle('Hips', false) === 6, 'pelvis back → Glutes');
ok(classifyMuscle('Hips', true) === 2, 'pelvis front → Core');
ok(classifyMuscle('Head', true) === 1, 'neck/head front maps to upper torso bucket');
ok(classifyMuscle('', true) === 7, 'unknown bone → none bucket (7)');

// shoulder must win over the generic "arm" rule (ordering)
ok(classifyMuscle('LeftShoulder', true) !== 4, 'shoulder is not misread as arm');

// --- every group maps to a valid backend readiness key ---
const KEYS = new Set(['arms', 'back', 'chest', 'core', 'legs', 'shoulders']);
ok(GROUP_READINESS.length === GROUP_LABEL.length, 'label/readiness arrays aligned');
ok(GROUP_READINESS.every((k) => KEYS.has(k)), 'all groups map to a real readiness group');

// --- assignGroups: dominant skin bone + anterior split, end to end ---
{
  // 2 vertices. v0: front, dominant bone idx 1 (RightUpLeg) → quads(5).
  //             v1: back,  dominant bone idx 0 (Spine2)     → back(3).
  const positions = new Float32Array([0.1, 0.5, 0.6,   -0.1, 1.2, -0.4]); // z: front, back
  const skinIndex = new Float32Array([1, 0, 0, 0,   0, 2, 0, 0]);
  const skinWeight = new Float32Array([0.9, 0.1, 0, 0,   0.2, 0.8, 0, 0]); // v1 dominant = idx2
  const names = ['Spine2', 'RightUpLeg', 'Spine'];
  const zMid = 0.0;
  const g = assignGroups(positions, skinIndex, skinWeight, (i) => names[i], zMid);
  ok(g[0] === 5, 'vertex on front thigh → Quads (got ' + g[0] + ')');
  ok(g[1] === 3, 'vertex on back, dominant Spine → Back (got ' + g[1] + ')');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
