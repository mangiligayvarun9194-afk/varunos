// AnimLab — the craft certification bench. Everything here is authored by hand
// to prove the four disciplines on the REAL Twin rig before the Living Twin build:
//   1. RIGGING   — tolerant bone lookup, rest-pose capture, A-pose correction,
//                  normalization to 1.8m/floor (same conventions as Twin.jsx)
//   2. ANIMATION — a wave clip keyframed programmatically (QuaternionKeyframeTracks)
//                  applying the classic principles: anticipation → overshoot →
//                  overlapping forearm/hand lag → follow-through settle
//   3. LAYERING  — procedural additive breath on the spine, running UNDER the wave
//   4. VFX       — sweat/wetness injected into the skin material (albedo darken +
//                  roughness drop, noise-masked), coupled to breath rate: one
//                  `exertion` value drives material AND motion, coherently.
import * as THREE from 'three';

const canvasRoot = document.body;
const status = (m) => { document.getElementById('status').textContent = m; };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(1.25, devicePixelRatio || 1));   // perf discipline
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.cssText = 'position:fixed;inset:0';
canvasRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05070c');
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);
function frame() {   // aspect-aware hero framing: portrait panes pull the camera back
  const a = innerWidth / innerHeight;
  const dist = 2.6 / Math.min(1, a * 1.15);
  camera.position.set(0.4, 1.35, dist);
  camera.lookAt(0, 1.02, 0);
}
frame();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  frame();
});

// Hero lighting: warm key, cool fill, hard gold rim (the premium-character recipe)
scene.add(new THREE.AmbientLight('#2a3040', 0.9));
const key = new THREE.DirectionalLight('#ffe2c0', 2.1); key.position.set(1.6, 2.4, 1.8); scene.add(key);
const fill = new THREE.DirectionalLight('#7f9ac0', 0.5); fill.position.set(-2, 1.2, 1); scene.add(fill);
const rim = new THREE.DirectionalLight('#f5b572', 2.6); rim.position.set(-1.2, 2.2, -2.2); scene.add(rim);
const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48),
  new THREE.MeshStandardMaterial({ color: '#0b0e16', roughness: 0.9 }));
disc.rotation.x = -Math.PI / 2; scene.add(disc);

// ── 1 · RIGGING ──────────────────────────────────────────────────────────────
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const gltf = await new GLTFLoader().loadAsync('/models/twin-custom.glb');
const root = gltf.scene;
scene.add(root);

const bones = {};
root.traverse((o) => {
  if (o.isBone) bones[o.name] = o;
  if (o.isSkinnedMesh) o.frustumCulled = false;   // craft rule: skinned bounds never follow bones
});
const lc = {}; for (const k in bones) lc[k.toLowerCase()] = bones[k];
const B = (...cands) => {
  for (const n of cands) {
    const hit = bones[n] || bones['mixamorig' + n] || bones['mixamorig:' + n]
      || lc[n.toLowerCase()] || lc[('mixamorig' + n).toLowerCase()];
    if (hit) return hit;
  }
  return null;
};
const rig = {
  hips: B('Hips'), spine: B('Spine', 'Spine01'), spine2: B('Spine2', 'Spine1', 'Spine02', 'Spine01'),
  neck: B('Neck'), head: B('Head'),
  lArm: B('LeftArm'), rArm: B('RightArm'), lFore: B('LeftForeArm'), rFore: B('RightForeArm'),
  rHand: B('RightHand'),
};
// A-pose correction for non-mixamo rigs (same convention as Twin.jsx)
if (!bones['Hips'] && B('Hips')) {
  rig.lArm && (rig.lArm.rotation.z -= 1.05);
  rig.rArm && (rig.rArm.rotation.z += 1.05);
}
// Rest pose AFTER correction = our animation's ground truth
const rest = {};
for (const [k, b] of Object.entries(rig)) if (b) rest[k] = b.quaternion.clone();

// Normalize to ~1.8m, feet on floor, centered (Twin.jsx convention)
root.updateMatrixWorld(true);
let box = new THREE.Box3().setFromObject(root);
const h = box.max.y - box.min.y;
const s = 1.8 / h; root.scale.setScalar(s);
root.updateMatrixWorld(true);
box = new THREE.Box3().setFromObject(root);
root.position.y -= box.min.y;
root.position.x -= (box.min.x + box.max.x) / 2;
root.position.z -= (box.min.z + box.max.z) / 2;

// ── 4 · VFX: sweat/wetness into the skin material ───────────────────────────
// One uniform, physically honest: wet skin darkens AND sharpens (roughness ↓),
// masked by slow scrolling noise so it blooms in patches, never like paint.
const wetUniform = { value: 0 };
const timeUniform = { value: 0 };
root.traverse((o) => {
  if (!o.isMesh || !o.material) return;
  const m = o.material;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWet = wetUniform;
    shader.uniforms.uT = timeUniform;
    // r160: the generic vUv varying only exists under USE_UV — force it on
    // both stages so the wetness mask can read the mesh UVs.
    shader.vertexShader = '#define USE_UV\n' + shader.vertexShader;
    shader.fragmentShader = '#define USE_UV\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uWet; uniform float uT;
        float wnoise(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wmask(vec2 p){
          float n = wnoise(floor(p * 9.0 + vec2(0.0, uT * 0.15)));
          float n2 = wnoise(floor(p * 23.0 - vec2(uT * 0.08, 0.0)));
          return smoothstep(0.35, 0.9, n * 0.65 + n2 * 0.35);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wetHere = uWet * wmask(vUv);
        diffuseColor.rgb *= (1.0 - 0.38 * wetHere);      // wet skin darkens`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.16, wetHere);  // and sharpens`);
  };
  m.needsUpdate = true;
});

// ── 2 · ANIMATION: the hand-keyed wave ──────────────────────────────────────
// Authored as quaternion keyframes relative to rest. Principles on display:
//  anticipation (weight dips, chest turns before the arm moves), overshoot
//  (arm passes its mark and settles back), overlapping action (forearm leads,
//  hand lags a beat behind), arcs (shoulder+elbow curves, never linear),
//  follow-through (chest counter-sway after the arm drops).
const E = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const q = (bone, off) => rest[bone].clone().multiply(off);
const flat = (qs) => qs.flatMap((v) => [v.x, v.y, v.z, v.w]);

function waveClip() {
  const tracks = [];
  // Right shoulder: down → anticipate → up w/ overshoot → hold w/ sway → down
  tracks.push(new THREE.QuaternionKeyframeTrack(`${rig.rArm.name}.quaternion`,
    [0, 0.22, 0.5, 0.62, 1.0, 1.4, 1.8, 2.1, 2.55],
    flat([
      q('rArm', E(0, 0, 0)),
      q('rArm', E(0.05, 0, 0.12)),          // anticipation: tiny inward coil
      q('rArm', E(-0.1, 0.15, -2.28)),      // raise — overshoot past mark
      q('rArm', E(-0.06, 0.12, -2.05)),     // settle to held pose
      q('rArm', E(-0.06, 0.10, -2.12)),     // micro-sway while waving
      q('rArm', E(-0.06, 0.14, -2.02)),
      q('rArm', E(-0.06, 0.11, -2.08)),
      q('rArm', E(-0.02, 0.05, -0.9)),      // begin descent (arc, not drop)
      q('rArm', E(0, 0, 0)),
    ])));
  // Forearm: the wave itself — leads the motion, three beats
  tracks.push(new THREE.QuaternionKeyframeTrack(`${rig.rFore.name}.quaternion`,
    [0, 0.5, 0.72, 0.95, 1.18, 1.41, 1.64, 1.9, 2.3, 2.55],
    flat([
      q('rFore', E(0, 0, 0)),
      q('rFore', E(0, 0, -0.55)),
      q('rFore', E(0, 0, -0.15)), q('rFore', E(0, 0, -0.8)),
      q('rFore', E(0, 0, -0.15)), q('rFore', E(0, 0, -0.8)),
      q('rFore', E(0, 0, -0.15)), q('rFore', E(0, 0, -0.55)),
      q('rFore', E(0, 0, -0.1)),
      q('rFore', E(0, 0, 0)),
    ])));
  // Hand: lags one beat behind the forearm (overlapping action)
  if (rig.rHand) tracks.push(new THREE.QuaternionKeyframeTrack(`${rig.rHand.name}.quaternion`,
    [0, 0.6, 0.84, 1.07, 1.3, 1.53, 1.76, 2.0, 2.55],
    flat([
      q('rHand', E(0, 0, 0)),
      q('rHand', E(0, 0, -0.18)),
      q('rHand', E(0, 0, 0.14)), q('rHand', E(0, 0, -0.3)),
      q('rHand', E(0, 0, 0.14)), q('rHand', E(0, 0, -0.3)),
      q('rHand', E(0, 0, 0.1)),
      q('rHand', E(0, 0, -0.06)),
      q('rHand', E(0, 0, 0)),
    ])));
  // Chest + head: anticipate, present, follow through (appeal — he means it)
  tracks.push(new THREE.QuaternionKeyframeTrack(`${rig.spine2.name}.quaternion`,
    [0, 0.22, 0.6, 1.9, 2.3, 2.55],
    flat([
      q('spine2', E(0, 0, 0)),
      q('spine2', E(0.02, 0, 0.05)),        // weight shifts INTO the gesture
      q('spine2', E(-0.02, -0.12, -0.06)),  // chest opens toward viewer
      q('spine2', E(-0.02, -0.1, -0.05)),
      q('spine2', E(0.01, 0.03, 0.02)),     // follow-through counter-sway
      q('spine2', E(0, 0, 0)),
    ])));
  if (rig.head) tracks.push(new THREE.QuaternionKeyframeTrack(`${rig.head.name}.quaternion`,
    [0, 0.55, 1.0, 1.5, 2.2, 2.55],
    flat([
      q('head', E(0, 0, 0)),
      q('head', E(-0.06, -0.15, 0.08)),     // tilt + eye-line to camera
      q('head', E(-0.03, -0.18, 0.06)),
      q('head', E(-0.05, -0.14, 0.08)),
      q('head', E(-0.01, -0.03, 0.01)),
      q('head', E(0, 0, 0)),
    ])));
  return new THREE.AnimationClip('wave', 2.55, tracks);
}

const mixer = new THREE.AnimationMixer(root);
const waveAction = mixer.clipAction(waveClip());
waveAction.setLoop(THREE.LoopOnce);
waveAction.clampWhenFinished = false;

// ── 3 · LAYERING: procedural additive breath (runs under everything) ────────
let breatheOn = true;
let exertion = 0;    // 0..1 — ONE value drives sweat, breath rate, breath depth
const clock = new THREE.Clock();
let frames = 0, fpsT = 0;

function loop() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;
  mixer.update(dt);
  // breath: base 0.25Hz calm → 1.1Hz panting; amplitude grows with exertion.
  // Applied AFTER mixer as a small additive rotation so it layers on any clip.
  if (breatheOn && rig.spine2) {
    const rate = 0.25 + exertion * 0.85;
    const amp = 0.014 + exertion * 0.035;
    const b = Math.sin(t * Math.PI * 2 * rate) * amp;
    rig.spine2.rotation.x += b;                     // chest rise
    if (rig.neck) rig.neck.rotation.x -= b * 0.4;   // head counter (stays level)
  }
  // weight shift: slow non-harmonic sway kills the "loop tell"
  if (rig.hips) rig.hips.rotation.z = Math.sin(t * 0.31) * 0.012 + Math.sin(t * 0.13) * 0.008;
  wetUniform.value += ((exertion * 0.9) - wetUniform.value) * 0.02;  // sweat blooms slowly
  timeUniform.value = t;
  renderer.render(scene, camera);
  frames++; if (t - fpsT > 1) { document.getElementById('fps').textContent = `${frames} fps`; frames = 0; fpsT = t; }
  requestAnimationFrame(loop);
}

document.getElementById('wave').onclick = () => { waveAction.reset().fadeIn(0.15).play(); };
document.getElementById('breathe').onclick = (e) => { breatheOn = !breatheOn; e.target.textContent = `Breath: ${breatheOn ? 'on' : 'off'}`; };
document.getElementById('exert').oninput = (e) => { exertion = e.target.value / 100; };

status(`rig ok · ${Object.values(rig).filter(Boolean).length}/10 bones bound · wave clip: ${waveClip().tracks.length} tracks, hand-keyed`);
loop();
