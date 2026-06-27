// Twin "Living Anatomy" — turn the rigged avatar into a per-muscle map WITHOUT a
// segmented model. A skinned mesh already knows which bone drives each vertex (skin
// indices + weights); we read the dominant bone, refine front/back from the vertex's
// anterior/posterior position, and tag every vertex with a muscle GROUP. The Twin
// shader then lights each group from within, driven by your real per-muscle readiness.
//
// The classifier is pure (bone name + anterior flag → group id) so it unit-tests in
// plain Node; the geometry pass that consumes a THREE BufferGeometry is a thin wrapper.

// Muscle groups (vertex tag = index). Posterior chain is split from quads, and torso
// front/back are split, so the body reads anatomically even though the rig doesn't.
export const GROUP_LABEL = ['Shoulders', 'Chest', 'Core', 'Back', 'Arms', 'Quads', 'Glutes & hams', 'Calves'];
// Each group maps to one of the backend's 6 readiness groups for its glow value.
export const GROUP_READINESS = ['shoulders', 'chest', 'core', 'back', 'arms', 'legs', 'legs', 'legs'];
export const NONE = 7;  // calves double as the "no strong muscle" bucket

const has = (s, ...keys) => keys.some((k) => s.includes(k));

// bone name (any case) + whether the vertex is on the body's front → group id 0..7.
export function classifyMuscle(boneName, anterior) {
  const b = (boneName || '').toLowerCase();
  if (has(b, 'shoulder', 'clavicle', 'trap', 'scapula')) return 0;         // delts/traps
  if (has(b, 'upleg', 'thigh', 'upperleg')) return anterior ? 5 : 6;        // quads / hams
  if (has(b, 'forearm', 'hand', 'wrist', 'elbow') || (has(b, 'arm') )) return 4; // arms (upper+fore)
  if (has(b, 'glut', 'butt')) return 6;                                     // glutes
  if (has(b, 'calf', 'shin', 'foot', 'toe', 'ankle')) return 7;            // calves
  if (has(b, 'leg')) return 7;                                             // lower leg (upleg caught above)
  if (has(b, 'spine2', 'spine3', 'chest', 'neck', 'head', 'breast')) return anterior ? 1 : 3; // chest / upper back
  if (has(b, 'spine', 'abdomen', 'waist', 'stomach', 'belly')) return anterior ? 2 : 3;       // abs / mid back
  if (has(b, 'hip', 'pelvis', 'root')) return anterior ? 2 : 6;            // lower abs / glutes
  return NONE;
}

// Dominant bone index for a vertex given its 4 skin weights.
function dominant(skinIndex, skinWeight, v) {
  let best = 0, bw = -1;
  for (let k = 0; k < 4; k++) {
    const w = skinWeight[v * 4 + k];
    if (w > bw) { bw = w; best = skinIndex[v * 4 + k]; }
  }
  return best;
}

// Build the per-vertex Float32 group attribute from raw geometry arrays. Pure: callers
// pass a `boneNameOf(index)` resolver (mesh.skeleton.bones[i].name) and the z mid-plane
// that separates anterior (front) from posterior (back).
export function assignGroups(positions, skinIndex, skinWeight, boneNameOf, zMid) {
  const n = positions.length / 3;
  const out = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const anterior = positions[v * 3 + 2] > zMid;
    out[v] = classifyMuscle(boneNameOf(dominant(skinIndex, skinWeight, v)), anterior);
  }
  return out;
}

// THREE wrapper: tag a skinned mesh's geometry with an `aMuscle` attribute.
export function buildMuscleAttribute(THREE, mesh) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position.array;
  const si = geo.attributes.skinIndex && geo.attributes.skinIndex.array;
  const sw = geo.attributes.skinWeight && geo.attributes.skinWeight.array;
  if (!si || !sw || !mesh.skeleton) {
    // Unskinned mesh (eyes/hair/etc.) → tag as NONE so it stays obsidian.
    const flat = new Float32Array(pos.length / 3).fill(NONE);
    geo.setAttribute('aMuscle', new THREE.BufferAttribute(flat, 1));
    return;
  }
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const zMid = (bb.min.z + bb.max.z) / 2;
  const bones = mesh.skeleton.bones;
  const nameOf = (i) => (bones[i] ? bones[i].name : '');
  const attr = assignGroups(pos, si, sw, nameOf, zMid);
  geo.setAttribute('aMuscle', new THREE.BufferAttribute(attr, 1));
}
