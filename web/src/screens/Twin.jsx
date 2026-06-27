// THE TWIN — the emotional center of Sarathi, now cinematic.
// three.js GLB + procedural skeleton animation, wrapped in a VFX layer: an
// UnrealBloom glow, a level-scaled energy aura (particles), pulsing ground rings,
// and a full LEVEL-UP / STAGE-UP sequence. Muscle growth = bone scaling driven by
// the deterministic avatar_level from the server. All 3D is progressive
// enhancement — the HUD, level-up moment and per-muscle panel work even if WebGL
// fails. three.js is bundled but loaded lazily with this screen.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, classifyExercise } from '../api.js';
import { CountUp, useToast, stagger, rise, confettiBurst } from '../components/ui.jsx';
import { Skeleton } from '../components/kit.jsx';
import { IconBody, IconTrend, IconFlame, IconBolt, IconSparkle } from '../components/Icons.jsx';
import { buildMuscleAttribute, GROUP_LABEL, GROUP_READINESS } from '../lib/twinSkin.js';

const TWIN_DEMO_GLB = '/models/twin-custom.glb';
// Lifts marked 🎞 play real motion-capture (baked GLB); the rest use the
// grounded procedural rep engine.
const ACTIONS = [
  { id: 'idle', label: 'Idle' },
  { id: 'squat', label: 'Squat' },          // mocap
  { id: 'curl', label: 'Curl' },            // mocap
  { id: 'jumpingjacks', label: 'Jacks' },   // mocap
  { id: 'deadlift', label: 'Deadlift' },    // procedural (grounded)
  { id: 'row', label: 'Row' },              // procedural
  { id: 'celebrate', label: 'PR!' },
];
// Each stage gets its own aura hue — the body literally changes colour as it ascends.
const STAGE_HEX = ['#7c8aa5', '#f5b572', '#f5b572', '#4cc9f0', '#a78bfa'];
const MUSCLES = [
  ['arms', 'Arms'], ['chest', 'Chest'], ['back', 'Back'],
  ['shoulders', 'Shoulders'], ['legs', 'Legs'], ['core', 'Core'],
];

// ---- Exercise biomechanics -------------------------------------------------
// A pose-based rep engine. For each lift: `grip` = constant joint offsets that
// hold the setup (radians, added to the model's rest pose); `pose(p)` = the
// moving joints, where p is contraction 0..1 (0 = start/extended, 1 = bottom or
// peak squeeze). `tempo` is real lifting cadence in seconds — `up` = time to the
// contracted position, `down` = time back. `bar:true` shows the barbell, which
// the hands physically carry (placed between the hand bones each frame). The
// joint angles below are tuned to anatomically plausible range of motion.
const smoothstep = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

function repPhase(t, tempo) {
  // segment order: rest (at p=0) → up (0→1, concentric) → hold (at 1) → down (1→0)
  const total = tempo.rest + tempo.up + tempo.hold + tempo.down;
  let x = t % total;
  if (x < tempo.rest) return 0;
  x -= tempo.rest;
  if (x < tempo.up) return smoothstep(x / tempo.up);
  x -= tempo.up;
  if (x < tempo.hold) return 1;
  x -= tempo.hold;
  if (x < tempo.down) return 1 - smoothstep(x / tempo.down);
  return 0;
}

// Joint axes were measured empirically against THIS rig (left & right are NOT
// cleanly mirrored, so signs differ per side). Verified clean axes:
//   knee flexion  : lLeg.x+ / rLeg.x+   (heel travels up & back)
//   hip flexion   : lUpLeg.x- / rUpLeg.x- (thigh forward, knee drops/forward)
//   elbow flexion : lFore.z+ / rFore.z-  (forearm curls up & in)
//   torso hinge   : spine.x+             (lean forward)
// Feet are kept planted every frame by the foot-lock, so the body sinks into a
// rep instead of flying. The bar is shown only on lifts where the hands hold it.
const EXdata = {
  // Bodyweight squat — legs are cleanly mirrored, so this is anatomically right:
  // knees bend, hips sink & hinge back, arms reach forward to counterbalance.
  squat: { bar: false, glow: 'legs', tempo: { up: 1.2, hold: 0.25, down: 1.5, rest: 0.5 },
    pose: (p) => ({ hipsY: -0.2 * p, spine: { x: 0.18 * p },
      lUpLeg: { x: -0.45 * p }, rUpLeg: { x: -0.45 * p }, lLeg: { x: 1.0 * p }, rLeg: { x: 1.0 * p },
      lFore: { z: 0.9 * p }, rFore: { z: -0.9 * p }, lArm: { x: -0.35 * p }, rArm: { x: 0.35 * p } }) },
  // Deadlift — hip hinge: torso folds forward, soft knees, arms hang so the bar
  // (held in the hands) lowers toward the floor and locks out at the top.
  deadlift: { bar: true, glow: 'back', tempo: { up: 1.2, hold: 0.2, down: 1.5, rest: 0.45 },
    pose: (p) => ({ hipsY: -0.06 * p, spine: { x: 0.85 * p }, spine2: { x: 0.12 * p }, neck: { x: -0.45 * p },
      lUpLeg: { x: -0.25 * p }, rUpLeg: { x: -0.25 * p }, lLeg: { x: 0.35 * p }, rLeg: { x: 0.35 * p } }) },
  // Biceps curl — bar in hands, forearms flex up (elbow flexion axis, mirrored).
  curl: { bar: true, glow: 'arms', tempo: { up: 0.9, hold: 0.35, down: 1.1, rest: 0.3 },
    pose: (p) => ({ lFore: { z: 1.9 * p }, rFore: { z: -1.9 * p } }) },
  // Bent-over row — hinge and hold (bar in hands), forearms pull the bar to the torso.
  row: { bar: true, glow: 'back', tempo: { up: 0.85, hold: 0.35, down: 1.1, rest: 0.3 },
    grip: { spine: { x: 0.8 }, spine2: { x: 0.18 }, neck: { x: -0.5 },
      lUpLeg: { x: -0.28 }, rUpLeg: { x: -0.28 }, lLeg: { x: 0.38 }, rLeg: { x: 0.38 } },
    pose: (p) => ({ lFore: { z: 1.1 * p }, rFore: { z: -1.1 * p } }) },
  // Press — bar in hands driven up to the shoulders/chest (a clean upward path;
  // a true overhead lockout needs shoulder axes this rig doesn't cleanly expose).
  press: { bar: true, glow: 'shoulders', tempo: { up: 1.0, hold: 0.3, down: 1.3, rest: 0.35 },
    pose: (p) => ({ lFore: { z: 1.7 * p }, rFore: { z: -1.7 * p }, spine: { x: -0.04 * p } }) },
};

// Real motion-capture clips baked onto THIS avatar's rig (Meshy 3d_rigging from
// the WorkingOut library). Each is a self-contained animated GLB — we play its
// embedded clip via AnimationMixer, so the motion is captured human movement,
// not hand-authored joint angles. Modes listed here use mocap; the rest fall
// back to the procedural rep engine above.
const MOCAP = {
  squat: '/models/mocap-air_squat.glb',
  curl: '/models/mocap-bicep_curl.glb',
  jumpingjacks: '/models/mocap-jumping_jacks.glb',
};

// Muscle activation per lift (ExRx target + key synergists). Each node is
// [bone, [worldOffsetXYZ]] — a glowing blob is placed there and brightens as the
// figure contracts, so the anatomically correct muscles light up.
const MUSCLE_NODES = {
  squat:    [['lUpLeg', [0, -0.18, 0.07]], ['rUpLeg', [0, -0.18, 0.07]], ['hips', [0, -0.02, -0.06]]],   // quads + glutes
  deadlift: [['spine', [0, 0.05, -0.08]], ['hips', [0, -0.02, -0.06]], ['lUpLeg', [0, -0.2, -0.06]], ['rUpLeg', [0, -0.2, -0.06]]], // erectors + glutes + hamstrings
  press:    [['lArm', [0.04, 0.02, 0.05]], ['rArm', [-0.04, 0.02, 0.05]], ['lFore', [0, -0.05, -0.04]], ['rFore', [0, -0.05, -0.04]]], // delts + triceps
  curl:     [['lArm', [0.03, -0.04, 0.06]], ['rArm', [-0.03, -0.04, 0.06]]],                              // biceps
  row:      [['spine2', [0, 0.04, -0.09]], ['lArm', [0.05, 0, -0.05]], ['rArm', [-0.05, 0, -0.05]]],      // lats + rear delts
};

// Which muscle a lift "lights up" — the just-trained group pulses on the Twin.
const MODE_GROUP = { squat: 'legs', deadlift: 'legs', press: 'shoulders', curl: 'arms', row: 'back' };

// GLSL injected into the avatar's PBR shader: each vertex carries a muscle-group id
// (aMuscle); we light that group from within in molten gold (fresh) → ember (fatigued),
// add a living energy "flow", a per-group "just-trained" pulse, and a warm fresnel rim.
const EMISSIVE_INJECT = `#include <emissivemap_fragment>
  int mg = int(vMuscle + 0.5);
  float act = 0.0; float pul = 0.0;
  for (int i = 0; i < 8; i++) { if (i == mg) { act = uAct[i]; pul = uPulse[i]; } }
  float a = clamp(act, 0.0, 1.0);
  float a2 = a * a;                          // contrast: only truly-fresh muscles blaze
  vec3 goldC = vec3(1.0, 0.66, 0.26);
  vec3 emberC = vec3(0.85, 0.20, 0.08);
  vec3 mcol = mix(emberC, goldC, a);
  float flow = 0.62 + 0.38 * sin(uTime * 1.7 + vViewPosition.y * 3.2 + vMuscle * 2.1);
  float glow = a2 * flow + pul;
  // fresnel rim picks out the silhouette so the obsidian body keeps its form
  float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += mcol * glow * 0.55 + vec3(1.0, 0.78, 0.42) * fres * 0.4;`;

export default function Twin() {
  const toast = useToast();
  const stageRef = useRef(null);
  const twinRef = useRef(null);
  const modeRef = useRef('idle');
  const levelRef = useRef(0);
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [errMsg, setErrMsg] = useState('');
  const [mode, setMode] = useState('idle');
  const [stats, setStats] = useState(null);
  const [url, setUrl] = useState('');
  const [bootId, setBootId] = useState(0);
  const [levelUp, setLevelUp] = useState(null); // { from, to, stageUp, label }
  const [readiness, setReadiness] = useState(null); // per-muscle recovery for the panel
  const [selMuscle, setSelMuscle] = useState(null); // { id } of a tapped muscle group
  const readyRef = useRef(null);                    // 8-group activation target for the shader

  useEffect(() => {
    const lastEx = localStorage.getItem('twin_last_ex');
    if (lastEx) { const m = classifyExercise(lastEx); setMode(m); modeRef.current = m; }
  }, []);

  // Stats render even if the 3D engine can't load — and drive the level-up moment.
  useEffect(() => {
    (async () => {
      try {
        const s = await api('/v1/avatar/state');
        setStats(s);
        const lvl = s?.avatar?.level ?? 0;
        levelRef.current = lvl;
        const prev = parseInt(localStorage.getItem('twin_last_level') ?? 'NaN', 10);
        const prevStage = parseInt(localStorage.getItem('twin_last_stage') ?? 'NaN', 10);
        if (!Number.isNaN(prev) && lvl > prev) {
          const stageUp = !Number.isNaN(prevStage) && s.avatar.stage > prevStage;
          setLevelUp({ from: prev, to: lvl, stageUp, label: s.avatar.label });
          confettiBurst();
          setTimeout(() => setLevelUp(null), 4200);
        }
        localStorage.setItem('twin_last_level', String(lvl));
        localStorage.setItem('twin_last_stage', String(s.avatar.stage));
      } catch (_) { setStats({ unavailable: true }); }
    })();
  }, [bootId]);

  // Per-muscle readiness → the molten-gold activation that lights each muscle group
  // from within (fresh = bright gold, fatigued = dim ember). Drives the live shader.
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/v1/readiness/muscles');
        setReadiness(r);
        const arr = new Array(8).fill(0.8);
        for (let i = 0; i < 8; i++) {
          const rec = r?.muscles?.[GROUP_READINESS[i]]?.recovery;
          if (typeof rec === 'number') arr[i] = Math.max(0.12, rec / 100);
        }
        readyRef.current = arr;
      } catch (_) { readyRef.current = null; }
    })();
  }, [bootId]);

  // Boot the 3D scene with VFX.
  useEffect(() => {
    let dead = false;
    setPhase('loading');
    (async () => {
      const stage = stageRef.current;
      if (!stage) return;
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (dead) return;

        const W = stage.clientWidth, H = stage.clientHeight;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 50);
        camera.position.set(0, 1.3, 2.9);
        camera.lookAt(0, 0.95, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Cinematic grading — ACES filmic curve gives the premium, filmic look.
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        stage.appendChild(renderer.domElement);

        // Level (0..1) drives every VFX intensity.
        let g = 0;
        try { g = (levelRef.current || 0) / 100; } catch (_) {}
        const stageIdx = Math.min(4, Math.max(0, (stats?.avatar?.stage ?? 1) - 1));
        const auraColor = new THREE.Color(STAGE_HEX[stageIdx] || '#f5b572');

        // Image-based lighting — a real environment so the iridescent/chrome
        // material has true reflections (the single biggest realism upgrade).
        try {
          const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
          const pmrem = new THREE.PMREMGenerator(renderer);
          const roomEnv = new RoomEnvironment(renderer);
          scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
        } catch (_) { /* no IBL — material still lit by the lights below */ }

        scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x10161f, 1.0));
        const key = new THREE.DirectionalLight(0xfff3e2, 1.9);
        key.position.set(1.8, 3.2, 2.5); scene.add(key);
        const rim = new THREE.DirectionalLight(auraColor.getHex(), 1.1 + g * 1.8);
        rim.position.set(-2.2, 1.8, -1.8); scene.add(rim);
        const fill = new THREE.DirectionalLight(0x7da2ff, 0.5);
        fill.position.set(-1, 0.5, 3); scene.add(fill);

        // Glowing floor disc + concentric pulse rings.
        const floor = new THREE.Mesh(
          new THREE.CircleGeometry(1.3, 64),
          new THREE.MeshStandardMaterial({ color: 0x070b12, metalness: 0.95, roughness: 0.18,
            envMapIntensity: 0.7 }));
        floor.rotation.x = -Math.PI / 2; scene.add(floor);
        const rings = [];
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(
            new THREE.RingGeometry(0.52, 0.56, 80),
            new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0,
              side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
          m.rotation.x = -Math.PI / 2; m.position.y = 0.012;
          scene.add(m); rings.push({ m, phase: k / 3 });
        }

        // Energy aura: rising embers around the figure, denser the stronger you are.
        const N = 180 + Math.round(g * 320);
        const pos = new Float32Array(N * 3);
        const spd = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 0.32 + Math.random() * 0.5;
          pos[i * 3] = Math.cos(a) * r;
          pos[i * 3 + 1] = Math.random() * 1.9;
          pos[i * 3 + 2] = Math.sin(a) * r;
          spd[i] = 0.002 + Math.random() * 0.006;
        }
        const ageo = new THREE.BufferGeometry();
        ageo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const amat = new THREE.PointsMaterial({
          size: 0.022, color: auraColor, transparent: true,
          opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const aura = new THREE.Points(ageo, amat);
        scene.add(aura);
        const auraTarget = 0.18 + g * 0.55;

        // Avatar (saved custom .glb may be a dead RPM link → fall back to demo).
        const savedUrl = localStorage.getItem('varunos_avatar_url');
        let glbUrl = savedUrl || TWIN_DEMO_GLB, gltf;
        try { gltf = await new GLTFLoader().loadAsync(glbUrl); }
        catch (err) {
          if (!savedUrl) throw err;
          localStorage.removeItem('varunos_avatar_url');
          gltf = await new GLTFLoader().loadAsync(TWIN_DEMO_GLB);
        }
        if (dead) { renderer.dispose(); return; }
        const root = gltf.scene; scene.add(root);

        // LIVING ANATOMY — reskin the avatar as obsidian with muscles that glow from
        // within, driven by per-muscle readiness. Shared uniforms updated each frame.
        const muscleU = {
          uTime: { value: 0 },
          uAct: { value: new Array(8).fill(0.8) },   // glow target per group (lerped)
          uPulse: { value: new Array(8).fill(0) },   // transient just-trained pulse
        };
        const bodyMeshes = [];
        const installMuscle = (mat) => {
          mat.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = muscleU.uTime;
            sh.uniforms.uAct = muscleU.uAct;
            sh.uniforms.uPulse = muscleU.uPulse;
            sh.vertexShader = 'attribute float aMuscle;\nvarying float vMuscle;\n'
              + sh.vertexShader.replace('void main() {', 'void main() {\n  vMuscle = aMuscle;');
            sh.fragmentShader = 'varying float vMuscle;\nuniform float uTime;\nuniform float uAct[8];\nuniform float uPulse[8];\n'
              + sh.fragmentShader.replace('#include <emissivemap_fragment>', EMISSIVE_INJECT);
          };
          mat.customProgramCacheKey = () => 'twin-muscle';
        };
        root.traverse((o) => {
          if (!o.isMesh) return;
          buildMuscleAttribute(THREE, o);   // tag every vertex with its muscle group
          const mat = new THREE.MeshStandardMaterial({
            color: 0x05070d, metalness: 0.6, roughness: 0.48, envMapIntensity: 0.5,
          });
          installMuscle(mat);
          o.material = mat;
          o.frustumCulled = false;
          bodyMeshes.push(o);
        });

        const bones = {};
        root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
        // Tolerant bone lookup: tries exact, mixamo-prefixed, and case-insensitive,
        // across several candidate names (rigs vary: Spine2 vs Spine02, Neck vs neck).
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
          hips: B('Hips'), spine: B('Spine', 'Spine01'),
          spine2: B('Spine2', 'Spine1', 'Spine02', 'Spine01'),
          neck: B('Neck'), head: B('Head'),
          lArm: B('LeftArm'), rArm: B('RightArm'),
          lFore: B('LeftForeArm'), rFore: B('RightForeArm'),
          lHand: B('LeftHand'), rHand: B('RightHand'),
          lUpLeg: B('LeftUpLeg'), rUpLeg: B('RightUpLeg'),
          lLeg: B('LeftLeg'), rLeg: B('RightLeg'),
          lFoot: B('LeftFoot'), rFoot: B('RightFoot'),
        };
        if (!bones['Hips'] && B('Hips')) {
          rig.lArm && (rig.lArm.rotation.z -= 1.05);
          rig.rArm && (rig.rArm.rotation.z += 1.05);
        }
        const rest = {};
        for (const [k, b] of Object.entries(rig))
          if (b) rest[k] = { rot: b.rotation.clone(), pos: b.position.clone() };

        // Normalize ANY model to ~1.8 m tall, feet on the floor, centered on X/Z —
        // so the camera and all VFX line up regardless of the source model's
        // native scale, origin, or units (Meshy/Avaturn/Mixamo all differ).
        root.updateMatrixWorld(true);
        let box = new THREE.Box3().setFromObject(root);
        let size = box.getSize(new THREE.Vector3());
        if (size.y > 0.0001) {
          root.scale.multiplyScalar(1.8 / size.y);
          root.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(root);
        }
        const center = box.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= box.min.y;     // feet to floor (y=0)
        root.updateMatrixWorld(true);
        // Record the rest-pose floor level of the feet so we can keep them planted
        // every frame (foot-lock) — the figure can never drift off the ground.
        const _fa = new THREE.Vector3(), _fb = new THREE.Vector3();
        let restFootY = Infinity;
        if (rig.lFoot) { rig.lFoot.getWorldPosition(_fa); restFootY = Math.min(restFootY, _fa.y); }
        if (rig.rFoot) { rig.rFoot.getWorldPosition(_fb); restFootY = Math.min(restFootY, _fb.y); }
        if (!isFinite(restFootY)) restFootY = 0;
        const h = 1.8;
        camera.position.set(0, h * 0.62, h * 1.85);
        camera.lookAt(0, h * 0.52, 0);

        // Growth: scale bones by avatar_level.
        const arm = 1 + g * 0.45, chest = 1 + g * 0.22, leg = 1 + g * 0.25;
        for (const k of ['lArm', 'rArm']) rig[k] && rig[k].scale.setScalar(arm);
        rig.spine2 && rig.spine2.scale.set(chest, 1 + g * 0.06, chest);
        for (const k of ['lUpLeg', 'rUpLeg']) rig[k] && rig[k].scale.setScalar(leg);

        // Barbell — a real loaded bar the hands carry (placed between the hand
        // bones each frame via forward kinematics), so it racks/hangs/presses
        // correctly per lift. Plates scale up a touch with level.
        const plateR = 0.15 + g * 0.05;
        const bar = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0xcdd6e4, metalness: 0.9, roughness: 0.28 });
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x0d1320, metalness: 0.5, roughness: 0.55 });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.5, 18), metal);
        shaft.rotation.z = Math.PI / 2; bar.add(shaft);
        for (const sx of [-0.6, -0.52, 0.52, 0.6]) {
          const pl = new THREE.Mesh(new THREE.CylinderGeometry(plateR, plateR, 0.045, 28), plateMat);
          pl.rotation.z = Math.PI / 2; pl.position.x = sx; bar.add(pl);
        }
        bar.visible = false; scene.add(bar);

        // Motion trail — traces the bar path, fading from the stage colour.
        const TN = 46;
        const tp = new Float32Array(TN * 3), tc = new Float32Array(TN * 3);
        const tgeo = new THREE.BufferGeometry();
        tgeo.setAttribute('position', new THREE.BufferAttribute(tp, 3));
        tgeo.setAttribute('color', new THREE.BufferAttribute(tc, 3));
        const trail = new THREE.Line(tgeo, new THREE.LineBasicMaterial({
          vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        trail.frustumCulled = false; trail.visible = false; scene.add(trail);

        // Soft radial texture, reused for the muscle-activation glows and the
        // grounding contact shadow.
        const _cv = document.createElement('canvas'); _cv.width = _cv.height = 64;
        const _cx = _cv.getContext('2d');
        const _grd = _cx.createRadialGradient(32, 32, 0, 32, 32, 32);
        _grd.addColorStop(0, 'rgba(255,255,255,1)');
        _grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
        _grd.addColorStop(1, 'rgba(255,255,255,0)');
        _cx.fillStyle = _grd; _cx.fillRect(0, 0, 64, 64);
        const softTex = new THREE.CanvasTexture(_cv);
        const glows = [];
        for (let i = 0; i < 4; i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: auraColor,
            blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
          s.scale.setScalar(0.4); s.visible = false; scene.add(s); glows.push(s);
        }
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40),
          new THREE.MeshBasicMaterial({ map: softTex, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006; scene.add(shadow);

        // Optional UnrealBloom for a premium glow — degrade gracefully if missing.
        let composer = null;
        try {
          const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
            import('three/examples/jsm/postprocessing/EffectComposer.js'),
            import('three/examples/jsm/postprocessing/RenderPass.js'),
            import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
          ]);
          composer = new EffectComposer(renderer);
          composer.addPass(new RenderPass(scene, camera));
          composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.34 + g * 0.3, 0.7, 0.88));
        } catch (_) { composer = null; }

        const twin = { renderer, composer, scene, camera, rig, rest, root, aura, amat,
          spd, rings, auraColor, baseAura: auraTarget, bar, trail, tp, tc, TN, glows,
          restFootY,
          camRad: h * 1.9, camY: h * 0.62, camLookY: h * 0.5,
          _X: new THREE.Vector3(1, 0, 0), _l: new THREE.Vector3(), _r: new THREE.Vector3(),
          _g: new THREE.Vector3(), lastMode: null, t: 0, raf: 0,
          muscleU, bodyMeshes, lastPulseMode: null,
          mocap: { cache: {}, active: null, loading: null, mixer: null } };
        twinRef.current = twin;

        // Tap a muscle → inspect its readiness. Raycast the body, read the hit
        // vertex's muscle-group tag, surface it in the panel.
        const _ray = new THREE.Raycaster(); const _ndc = new THREE.Vector2();
        const onPick = (ev) => {
          const rect = renderer.domElement.getBoundingClientRect();
          _ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
          _ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
          _ray.setFromCamera(_ndc, camera);
          const hit = _ray.intersectObjects(bodyMeshes, false)[0];
          if (hit && hit.face) {
            const am = hit.object.geometry.getAttribute('aMuscle');
            if (am) setSelMuscle({ id: Math.round(am.getX(hit.face.a)) });
          }
        };
        renderer.domElement.addEventListener('pointerdown', onPick);
        renderer.domElement.style.cursor = 'pointer';

        // Apply a set of {joint:{x,y,z}} (or hipsY) offsets onto the rest pose.
        const applyOffsets = (offs) => {
          for (const k in offs) {
            if (k === 'hipsY') { if (rig.hips) rig.hips.position.y += offs[k]; continue; }
            if (k === 'hipsZ') { if (rig.hips) rig.hips.position.z += offs[k]; continue; }
            const b = rig[k]; if (!b) continue;
            const v = offs[k];
            if (v.x) b.rotation.x += v.x;
            if (v.y) b.rotation.y += v.y;
            if (v.z) b.rotation.z += v.z;
          }
        };

        // ---- Real mocap playback -------------------------------------------
        // The baked GLBs are decimated to ~300 tris, so we DISCARD their mesh and
        // borrow only the AnimationClip — playing it on the original high-poly
        // textured avatar. Both share the same Meshy rig (identical bone names),
        // so the clip's tracks bind by name: full-detail avatar + real captured
        // motion. One mixer bound to the base avatar; clips swap per exercise.
        const mocapMixer = new THREE.AnimationMixer(root);
        const showMocap = (mode) => {
          const url = MOCAP[mode];
          if (!url) return;
          const cache = twin.mocap.cache;
          if (cache[mode]) {
            mocapMixer.stopAllAction();
            cache[mode].action.reset().play();
            twin.mocap.mixer = mocapMixer; twin.mocap.active = mode;
            return;
          }
          if (twin.mocap.loading === mode) return;     // already in flight
          twin.mocap.loading = mode;
          new GLTFLoader().loadAsync(url).then((gm) => {
            if (dead) return;
            twin.mocap.loading = null;
            const clip = gm.animations && gm.animations[0];
            if (!clip) return;
            const action = mocapMixer.clipAction(clip);
            cache[mode] = { action };
            if (modeRef.current === mode) {
              mocapMixer.stopAllAction();
              action.reset().play();
              twin.mocap.mixer = mocapMixer; twin.mocap.active = mode;
            }
          }).catch(() => { twin.mocap.loading = null; });
        };
        const hideMocap = () => {
          mocapMixer.stopAllAction();
          twin.mocap.mixer = null; twin.mocap.active = null;
        };

        const loop = () => {
          twin.raf = requestAnimationFrame(loop);
          twin.t += 0.016;
          const t = twin.t;
          const m = modeRef.current;
          let p = 0;

          // Living-Anatomy glow: animate flow, ease activation toward readiness, decay
          // the pulse, and flash the muscle of the lift the moment it changes.
          muscleU.uTime.value = t;
          const tgt = readyRef.current, A = muscleU.uAct.value, P = muscleU.uPulse.value;
          for (let i = 0; i < 8; i++) {
            const want = tgt ? tgt[i] : 0.8;
            A[i] += (want - A[i]) * 0.05;
            P[i] *= 0.93;
          }
          if (m !== twin.lastPulseMode) {
            twin.lastPulseMode = m;
            const key = MODE_GROUP[m];
            if (key) for (let i = 0; i < 8; i++) if (GROUP_READINESS[i] === key) P[i] = 1.3;
          }

          if (MOCAP[m]) {
            // Real motion-capture on the high-poly avatar: advance the mixer, or
            // stand in the rest pose while the clip is still loading.
            if (twin.mocap.active !== m) showMocap(m);
            if (twin.mocap.mixer) {
              twin.mocap.mixer.update(0.016);
            } else {
              for (const [k, b] of Object.entries(rig)) {
                if (b && rest[k]) { b.rotation.copy(rest[k].rot); b.position.copy(rest[k].pos); }
              }
            }
            // Keep feet planted (mocap is grounded; re-ground guards against drift).
            root.updateMatrixWorld(true);
            {
              let minY = Infinity;
              if (rig.lFoot) { rig.lFoot.getWorldPosition(twin._l); minY = Math.min(minY, twin._l.y); }
              if (rig.rFoot) { rig.rFoot.getWorldPosition(twin._r); minY = Math.min(minY, twin._r.y); }
              if (isFinite(minY)) { root.position.y += Math.max(twin.restFootY - minY, -0.5); root.updateMatrixWorld(true); }
            }
            twin.bar.visible = false; twin.trail.visible = false;
            twin.glows.forEach((s) => { s.visible = false; });
          } else {
            if (twin.mocap.active) hideMocap();
            for (const [k, b] of Object.entries(rig)) {
              if (!b || !rest[k]) continue;
              b.rotation.copy(rest[k].rot); b.position.copy(rest[k].pos);
            }
            const breathe = Math.sin(t * 1.8) * 0.5 + 0.5;
            if (rig.spine2) rig.spine2.rotation.x += breathe * 0.025;
            const ex = EXdata[m];
            if (m === 'celebrate') {
              const hop = Math.abs(Math.sin(t * 5));
              if (rig.hips) rig.hips.position.y += hop * 0.07;
              for (const k of ['lArm', 'rArm']) {
                if (!rig[k]) continue;
                rig[k].rotation.x += -2.6;
                rig[k].rotation.z += (k === 'lArm' ? -0.4 : 0.4) * (0.7 + 0.3 * Math.sin(t * 5));
              }
              if (rig.head) rig.head.rotation.z += Math.sin(t * 5) * 0.08;
            } else if (ex) {
              // a controlled rep: grip holds the setup, pose(p) drives the motion
              p = repPhase(t, ex.tempo);
              if (ex.grip) applyOffsets(ex.grip);
              applyOffsets(ex.pose(p));
            } else {
              // idle: relaxed breathing sway + subtle weight shift
              for (const k of ['lArm', 'rArm']) rig[k] && (rig[k].rotation.z += (k === 'lArm' ? -1 : 1) * Math.sin(t * 1.8) * 0.02);
              if (rig.hips) rig.hips.position.x += Math.sin(t * 0.9) * 0.012;
            }

            // Foot-lock: re-ground every frame so the lowest foot stays on the floor.
            root.updateMatrixWorld(true);
            {
              let minY = Infinity;
              if (rig.lFoot) { rig.lFoot.getWorldPosition(twin._l); minY = Math.min(minY, twin._l.y); }
              if (rig.rFoot) { rig.rFoot.getWorldPosition(twin._r); minY = Math.min(minY, twin._r.y); }
              if (isFinite(minY)) { root.position.y += Math.max(twin.restFootY - minY, -0.22); root.updateMatrixWorld(true); }
            }

            // Barbell tracks the hands via forward kinematics + a fading motion trail.
            const showBar = !!(ex && ex.bar && rig.lHand && rig.rHand);
            twin.bar.visible = showBar; twin.trail.visible = showBar;
            if (showBar) {
              rig.lHand.getWorldPosition(twin._l);
              rig.rHand.getWorldPosition(twin._r);
              const mx = (twin._l.x + twin._r.x) / 2, my = (twin._l.y + twin._r.y) / 2, mz = (twin._l.z + twin._r.z) / 2;
              twin.bar.position.set(mx, my, mz);
              const ax = twin._r.clone().sub(twin._l);
              if (ax.lengthSq() > 1e-5) twin.bar.quaternion.setFromUnitVectors(twin._X, ax.normalize());
              const { tp, tc, TN } = twin;
              if (twin.lastMode !== m) for (let i = 0; i < TN; i++) { tp[i*3]=mx; tp[i*3+1]=my; tp[i*3+2]=mz; }
              for (let i = TN - 1; i > 0; i--) { tp[i*3]=tp[(i-1)*3]; tp[i*3+1]=tp[(i-1)*3+1]; tp[i*3+2]=tp[(i-1)*3+2]; }
              tp[0]=mx; tp[1]=my; tp[2]=mz;
              const c = twin.auraColor;
              for (let i = 0; i < TN; i++) { const a = (1 - i / TN) ** 1.5; tc[i*3]=c.r*a; tc[i*3+1]=c.g*a; tc[i*3+2]=c.b*a; }
              twin.trail.geometry.attributes.position.needsUpdate = true;
              twin.trail.geometry.attributes.color.needsUpdate = true;
            }

            // Muscle activation — target muscles glow, brightening at peak contraction.
            const nodes = MUSCLE_NODES[m];
            twin.glows.forEach((s, i) => {
              const node = nodes && nodes[i];
              const bone = node && rig[node[0]];
              if (!bone) { s.visible = false; return; }
              bone.getWorldPosition(twin._g);
              s.position.set(twin._g.x + node[1][0], twin._g.y + node[1][1], twin._g.z + node[1][2]);
              s.visible = true;
              s.material.opacity = 0.18 + p * 0.82;
              s.scale.setScalar(0.32 + p * 0.16);
            });
          }
          twin.lastMode = m;

          // --- VFX ---
          // aura swells at peak contraction — the effort glow.
          twin.auraTarget = twin.baseAura + p * 0.3;
          twin.amat.opacity += (twin.auraTarget - twin.amat.opacity) * 0.06;
          const arr = twin.aura.geometry.attributes.position.array;
          for (let i = 0; i < arr.length / 3; i++) {
            arr[i * 3 + 1] += twin.spd[i];
            if (arr[i * 3 + 1] > 2.0) arr[i * 3 + 1] = 0;
          }
          twin.aura.geometry.attributes.position.needsUpdate = true;
          twin.aura.rotation.y = t * 0.3;
          twin.rings.forEach((r) => {
            const rp = (t * 0.35 + r.phase) % 1;
            const s = 1 + rp * 1.8;
            r.m.scale.set(s, s, s);
            r.m.material.opacity = (1 - rp) * (0.35 + g * 0.4);
          });

          // cinematic camera orbit — keeps the figure forward, reveals depth.
          const orb = Math.sin(t * 0.16) * 0.42;
          twin.camera.position.set(Math.sin(orb) * twin.camRad, twin.camY, Math.cos(orb) * twin.camRad);
          twin.camera.lookAt(0, twin.camLookY, 0);

          (twin.composer || twin.renderer).render(scene, camera);
        };
        loop();
        setPhase('ready');
      } catch (e) {
        if (!dead) { setErrMsg(e.message || 'unknown error'); setPhase('error'); }
      }
    })();
    return () => {
      dead = true;
      const twin = twinRef.current;
      if (twin) {
        cancelAnimationFrame(twin.raf);
        twin.composer?.dispose?.();
        twin.renderer.dispose();
        twin.renderer.domElement?.remove();
        twinRef.current = null;
      }
    };
  }, [bootId]);

  function setAction(m) { setMode(m); modeRef.current = m; }

  function saveUrl() {
    const u = url.trim();
    if (!u.endsWith('.glb')) { toast('That should be a .glb link (e.g. from avaturn.me)'); return; }
    localStorage.setItem('varunos_avatar_url', u);
    api('/v1/user/profile', { method: 'PUT', body: { avatar_url: u } }).catch(() => {});
    toast('✓ Avatar saved — reloading your Twin');
    setBootId((b) => b + 1);
  }

  const usingOwn = !!localStorage.getItem('varunos_avatar_url');
  const av = stats?.avatar;
  const lvl = av?.level ?? 0;
  const stageIdx = Math.min(4, Math.max(0, (av?.stage ?? 1) - 1));
  const accent = STAGE_HEX[stageIdx] || 'var(--mint)';

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} style={{ margin: '26px 0 16px' }}>
        <h2 className="display" style={{ fontSize: 30, fontWeight: 700 }}>Your Twin</h2>
        <p className="meta">Trains when you train. Grows when you grow.</p>
      </motion.div>

      {/* 3D stage with aurora backdrop + HUD */}
      <motion.div variants={rise} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        {/* animated aurora behind the figure */}
        <motion.div aria-hidden
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 24%, ${accent}26 0%, transparent 60%)`,
          }} />
        <div ref={stageRef} key={bootId} style={{
          width: '100%', height: 460, position: 'relative',
          background: 'radial-gradient(ellipse at 50% 26%, #0e1730 0%, #06080d 80%)',
        }} />

        {/* HUD: stage chip + XP-to-next ring */}
        {phase === 'ready' && av && (
          <>
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{
                position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(8,11,18,0.7)', border: `1px solid ${accent}55`, borderRadius: 999,
                padding: '6px 13px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              }}>
              <span style={{ color: accent }}><IconBody width={14} height={14} /></span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)' }}>LV {lvl}</span>
              <span style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'capitalize' }}>{av.name?.replace(/_/g, ' ')}</span>
            </motion.div>
            <div style={{ position: 'absolute', top: 12, right: 12 }}>
              <XPRing progress={av.stage_progress ?? (lvl / 100)} accent={accent}
                caption={av.next_at != null ? `${Math.max(0, av.next_at - lvl)}` : 'MAX'} />
            </div>
          </>
        )}
        {phase === 'ready' && !usingOwn && !selMuscle && (
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'var(--mute)' }}>
            Demo avatar — make it you below
          </div>
        )}

        {/* tap-to-inspect muscle panel */}
        {phase === 'ready' && (
          <AnimatePresence>
            {selMuscle ? (() => {
              const key = GROUP_READINESS[selMuscle.id];
              const mm = readiness?.muscles?.[key];
              const col = !mm ? 'var(--mute)' : mm.status === 'fresh' ? 'var(--green)' : mm.status === 'fatigued' ? 'var(--red)' : 'var(--amber)';
              return (
                <motion.div key="mpanel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(8,11,18,0.82)', border: `1px solid ${col}55`, borderRadius: 14, padding: '10px 13px',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: col, boxShadow: `0 0 10px ${col}`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{GROUP_LABEL[selMuscle.id]}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                      {mm ? <>{mm.recovery}% recovered · <span style={{ color: col, textTransform: 'capitalize' }}>{mm.status}</span>{mm.hours_since != null ? ` · trained ${Math.round(mm.hours_since)}h ago` : ''}</> : 'No training logged yet — fully fresh.'}
                    </div>
                  </div>
                  <button onClick={() => setSelMuscle(null)} aria-label="Close"
                    style={{ background: 'none', border: 'none', color: 'var(--mute)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
                </motion.div>
              );
            })() : (
              <motion.div key="mhint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 10.5, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent, #f5b572)' }} /> tap a muscle
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* loading */}
        <AnimatePresence>
          {phase === 'loading' && (
            <motion.div exit={{ opacity: 0 }} style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <motion.div animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} style={{ color: 'var(--mint)' }}>
                <IconBody width={52} height={52} strokeWidth={1.2} />
              </motion.div>
              <div style={{ width: 120, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <motion.div animate={{ x: [-120, 120] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: 60, height: '100%', background: 'var(--mint)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>Summoning your Twin…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* error */}
        {phase === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 28px', textAlign: 'center',
          }}>
            <span style={{ color: 'var(--mute)' }}><IconBody width={40} height={40} strokeWidth={1.2} /></span>
            <p style={{ fontSize: 13, color: 'var(--dim)' }}>
              Couldn't load the 3D engine <span style={{ color: 'var(--mute)' }}>({errMsg})</span>.
              Your Twin needs a network connection the first time.
            </p>
            <button className="btn ghost" onClick={() => setBootId((b) => b + 1)}>Try again</button>
          </div>
        )}

        {/* LEVEL-UP cinematic */}
        <AnimatePresence>
          {levelUp && <LevelUpOverlay data={levelUp} accent={accent} />}
        </AnimatePresence>
      </motion.div>

      {/* living-anatomy legend */}
      <motion.div variants={rise} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '10px 0 2px', fontSize: 11, color: 'var(--mute)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'linear-gradient(90deg,#f5b572,#ffd9a3)' }} /> fresh</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'linear-gradient(90deg,#d97a45,#f24322)' }} /> fatigued</span>
        <span style={{ color: 'var(--dim)' }}>· your muscles glow by recovery — tap any to read it</span>
      </motion.div>

      {/* action pills (scroll horizontally — the Twin performs each lift) */}
      <motion.div variants={rise} style={{
        display: 'flex', gap: 6, margin: '12px 0', background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 16, padding: 5,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {ACTIONS.map((a) => {
          const active = mode === a.id;
          return (
            <button key={a.id} onClick={() => setAction(a.id)} style={{
              position: 'relative', flex: '0 0 auto', background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap',
              fontFamily: 'var(--font-display)', color: active ? '#1a0f06' : 'var(--dim)', transition: 'color 0.18s',
            }}>
              {active && (
                <motion.span layoutId="twin-action" transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'var(--mint)' }} />
              )}
              <span style={{ position: 'relative' }}>{a.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* stage progression track */}
      {av && (
        <motion.div variants={rise} className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h3 className="display" style={{ fontSize: 17, fontWeight: 700 }}>Level {lvl}</h3>
            <span className="meta">{av.label}</span>
          </div>
          <StageTrack stage={av.stage} of={av.of ?? 5} progress={av.stage_progress ?? 0} accent={accent} />
        </motion.div>
      )}

      {/* per-muscle growth */}
      {stats?.muscles && (
        <motion.div variants={rise} className="card" style={{ padding: 18 }}>
          <h3 className="display" style={{ fontSize: 15, fontWeight: 650, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: accent }}><IconBody width={16} height={16} /></span> Muscle growth
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MUSCLES.map(([k, label], i) => (
              <MuscleBar key={k} label={label} value={stats.muscles[k] ?? 0} accent={accent} delay={0.1 + i * 0.07} />
            ))}
          </div>
          <p className="meta" style={{ marginTop: 12, fontSize: 11 }}>
            The group you train most grows most — your volume sculpts the mirror.
          </p>
        </motion.div>
      )}

      {/* drivers */}
      <motion.div variants={rise} className="card" style={{ padding: 18 }}>
        {!stats && <Skeleton height={60} />}
        {stats?.unavailable && <p className="meta">Stats unavailable — log workouts to grow your Twin.</p>}
        {av && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <GrowthStat Icon={IconTrend}
                value={<><CountUp value={Math.abs(stats.volume_trend_pct_per_week)} decimals={1} />%</>}
                sign={stats.volume_trend_pct_per_week >= 0 ? '+' : '−'}
                tone={stats.volume_trend_pct_per_week >= 0 ? 'var(--green)' : 'var(--red)'} label="Volume / wk" />
              <GrowthStat Icon={IconFlame} value={<CountUp value={stats.streak_weeks} />} label="Week streak" tone="var(--mint)" />
              <GrowthStat Icon={IconBolt}
                value={stats.days_since_pr == null ? '—' : <><CountUp value={stats.days_since_pr} />d</>}
                label="Since last PR" tone="var(--cyan)" />
            </div>
            <p className="meta" style={{ marginTop: 14, fontSize: 12 }}>
              30% volume · 20% streaks · 25% PRs · 25% consistency — train and watch the mirror change.
            </p>
          </>
        )}
      </motion.div>

      {/* make it you */}
      <motion.div variants={rise} className="card" style={{ padding: 18 }}>
        <h3 className="display" style={{ fontSize: 15, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--mint)' }}><IconSparkle width={16} height={16} /></span>
          Make it actually you
        </h3>
        <p className="meta" style={{ marginBottom: 12 }}>
          Paste a link to any <b>Mixamo-rigged .glb</b> and the Twin becomes it. Make a selfie
          look-alike at <a href="https://avaturn.me" target="_blank" rel="noreferrer" style={{ color: 'var(--mint)' }}>avaturn.me</a> (free).
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/avatar.glb" style={{ flex: 1, fontSize: 13 }} />
          <button className="btn primary" onClick={saveUrl}>Use it</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- VFX / HUD components --------------------------------------------------

function XPRing({ progress, accent, caption }) {
  const R = 22, C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div style={{ position: 'relative', width: 56, height: 56 }}>
      <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <motion.circle cx="28" cy="28" r={R} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - p) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{caption}</span>
        <span style={{ fontSize: 7, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 1 }}>
          {caption === 'MAX' ? '' : 'to next'}
        </span>
      </div>
    </div>
  );
}

function StageTrack({ stage, of, progress, accent }) {
  const names = ['Starting', 'Warming up', 'Solid', 'Strong', 'Peak'];
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 9, left: 10, right: 10, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }} />
      <motion.div initial={{ width: 0 }}
        animate={{ width: `${((stage - 1 + progress) / (of - 1)) * 100}%` }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        style={{ position: 'absolute', top: 9, left: 10, height: 3, borderRadius: 3,
          background: `linear-gradient(90deg, var(--mint), ${accent})`, maxWidth: 'calc(100% - 20px)' }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
        {names.slice(0, of).map((n, i) => {
          const done = i + 1 <= stage;
          const cur = i + 1 === stage;
          return (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 52 }}>
              <motion.div animate={cur ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 1.8, repeat: Infinity }}
                style={{
                  width: cur ? 18 : 14, height: cur ? 18 : 14, borderRadius: '50%',
                  background: done ? accent : 'var(--surface-2)',
                  border: `2px solid ${done ? accent : 'var(--line)'}`,
                  boxShadow: cur ? `0 0 12px ${accent}` : 'none', zIndex: 1,
                }} />
              <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: cur ? accent : done ? 'var(--dim)' : 'var(--mute)', textAlign: 'center' }}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MuscleBar({ label, value, accent, delay }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 68, fontSize: 12, color: 'var(--dim)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(3, value)}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay }}
          style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, var(--mint), ${accent})`,
            boxShadow: `0 0 8px ${accent}66` }} />
      </div>
      <span className="mono" style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700, color: accent }}>
        <CountUp value={value} />
      </span>
    </div>
  );
}

function LevelUpOverlay({ data, accent }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        background: `radial-gradient(ellipse at 50% 50%, ${accent}22, transparent 70%)` }}>
      {/* shockwave rings */}
      {[0, 0.25, 0.5].map((d) => (
        <motion.div key={d} initial={{ scale: 0, opacity: 0.7 }} animate={{ scale: 3.2, opacity: 0 }}
          transition={{ duration: 1.6, delay: d, ease: 'easeOut', repeat: 1 }}
          style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%',
            border: `2px solid ${accent}` }} />
      ))}
      <motion.div initial={{ scale: 0.6, y: 10 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: accent, marginBottom: 4 }}>
          {data.stageUp ? 'Stage Up' : 'Level Up'}
        </div>
        <div className="display" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1,
          color: '#fff', textShadow: `0 0 24px ${accent}` }}>
          <CountUp value={data.to} duration={1.2} />
        </div>
        {data.stageUp && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: accent }}>
            {data.label}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function GrowthStat({ Icon, value, label, tone, sign }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 13, padding: '12px 8px', textAlign: 'center' }}>
      <span style={{ color: tone }}><Icon width={16} height={16} /></span>
      <div className="display mono" style={{ fontSize: 18, fontWeight: 700, color: tone, marginTop: 4 }}>{sign}{value}</div>
      <div style={{ fontSize: 9, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  );
}
