// Sarathi — cinematic scroll-driven Twin stage (ESM, three 0.160).
// Adapted from the redesign concept's twin-engine.js: a fixed-canvas living
// Twin with warm amber key light, cool data rim, particle aura, ground rings,
// idle breathing, cursor parallax, scroll-keyframed camera/lighting, growth-
// stage hue, and a level-up pulse. Degrades to a poster if WebGL/model fail.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const STAGE_HEX = ['#8a93a8', '#f0b27a', '#f5b572', '#5fd0bd', '#7fd4f0'];

// p, dist, camY, lookY, orbit, keyInt, keyHex, rimHex, rimInt, aura, ring, expo
const KEYS = [
  [0.00, 4.4, 1.05, 0.95, -0.34, 0.18, '#ffce9a', '#5b6680', 0.3, 0.04, 0.00, 0.7],
  [0.11, 2.9, 1.12, 0.98, 0.00, 2.10, '#ffd9a8', '#f5b572', 1.5, 0.28, 0.32, 1.18],
  [0.22, 3.2, 1.10, 0.96, 0.44, 1.65, '#ffd9a8', '#4cc9f0', 1.2, 0.20, 0.22, 1.12],
  [0.34, 2.7, 1.05, 0.92, -0.22, 2.30, '#ffd9a8', '#5fd0bd', 1.6, 0.42, 0.55, 1.22],
  [0.45, 3.0, 1.12, 0.98, 0.26, 1.85, '#ffd9a8', '#f5b572', 1.9, 0.30, 0.30, 1.15],
  [0.56, 3.7, 1.18, 1.00, 0.10, 1.20, '#ffe0bd', '#4cc9f0', 1.0, 0.14, 0.12, 1.05],
  [0.67, 3.4, 1.12, 0.96, -0.18, 1.00, '#dfeaff', '#4cc9f0', 1.2, 0.10, 0.45, 1.00],
  [0.78, 2.6, 1.08, 0.95, 0.30, 1.95, '#ffd9a8', '#5fd0bd', 1.4, 0.30, 0.42, 1.16],
  [0.89, 2.4, 1.06, 0.96, 0.00, 2.70, '#ffe2c2', '#f5b572', 2.2, 0.80, 0.85, 1.30],
  [1.00, 3.0, 1.12, 0.98, -0.20, 1.65, '#ffd9a8', '#f5b572', 1.5, 0.26, 0.32, 1.14],
];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function sampleKeys(p) {
  p = clamp(p, 0, 1);
  let i = 0;
  for (; i < KEYS.length - 1; i++) if (p <= KEYS[i + 1][0]) break;
  const a = KEYS[i], b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  const span = (b[0] - a[0]) || 1;
  let t = clamp((p - a[0]) / span, 0, 1);
  t = t * t * (3 - 2 * t);
  return {
    dist: lerp(a[1], b[1], t), camY: lerp(a[2], b[2], t), lookY: lerp(a[3], b[3], t),
    orbit: lerp(a[4], b[4], t), keyInt: lerp(a[5], b[5], t),
    keyHex: a[6], keyHexB: b[6], keyT: t, rimHex: a[7], rimHexB: b[7],
    rimInt: lerp(a[8], b[8], t), aura: lerp(a[9], b[9], t),
    ring: lerp(a[10], b[10], t), expo: lerp(a[11], b[11], t),
  };
}

// initStage({ canvas, url, onReady, onError }) -> { setStage, pulse, dispose }
export function initStage(opts) {
  const canvas = opts.canvas;
  if (!canvas) throw new Error('no canvas');
  const W = canvas.clientWidth || window.innerWidth;
  const H = canvas.clientHeight || window.innerHeight;
  const isMobile = window.innerWidth < 760;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { throw new Error('no webgl'); }
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(isMobile ? 1.6 : 2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, W / H, 0.1, 60);
  camera.position.set(0, 1.2, 3.2);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  } catch (e) { /* lit by lights below */ }

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x0a0d14, 0.85); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd9a8, 1.6); key.position.set(2.0, 3.2, 2.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf5b572, 1.4); rim.position.set(-2.4, 1.9, -2.0); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x7da2ff, 0.45); fill.position.set(-1.2, 0.6, 3.0); scene.add(fill);

  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d');
  const grd = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = grd; cx.fillRect(0, 0, 64, 64);
  const softTex = new THREE.CanvasTexture(cv);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.0, 64),
    new THREE.MeshStandardMaterial({ color: 0x05070c, metalness: 0.92, roughness: 0.32, envMapIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40),
    new THREE.MeshBasicMaterial({ map: softTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006; scene.add(shadow);

  const auraColor = new THREE.Color('#f5b572');
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const rm = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.56, 90),
      new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    rm.rotation.x = -Math.PI / 2; rm.position.y = 0.012; scene.add(rm); rings.push({ m: rm, ph: k / 3 });
  }

  const N = isMobile ? 140 : 320;
  const pos = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.32 + Math.random() * 0.55;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 2.0; pos[i * 3 + 2] = Math.sin(a) * r;
    spd[i] = 0.0018 + Math.random() * 0.006;
  }
  const ageo = new THREE.BufferGeometry(); ageo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const amat = new THREE.PointsMaterial({ size: 0.02, map: softTex, color: auraColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const aura = new THREE.Points(ageo, amat); scene.add(aura);

  const st = {
    rig: {}, rest: {}, root: null, restFootY: 0, t: 0, raf: 0, dead: false,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    scrollP: 0, targetP: 0, px: 0, py: 0, tpx: 0, tpy: 0,
    kA: new THREE.Color(), kB: new THREE.Color(), rA: new THREE.Color(), rB: new THREE.Color(), tmp: new THREE.Color(),
    pulse: 0, stageIdx: 2, _l: new THREE.Vector3(), _r: new THREE.Vector3(), ready: false,
  };

  new GLTFLoader().load(opts.url, (gltf) => {
    if (st.dead) return;
    const root = gltf.scene; scene.add(root); st.root = root;
    root.traverse((o) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 1.0; o.material.needsUpdate = true; } });
    const bones = {}; root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const lc = {}; for (const bn in bones) lc[bn.toLowerCase()] = bones[bn];
    const B = (...names) => { for (const n of names) { const hit = bones[n] || bones['mixamorig' + n] || lc[n.toLowerCase()]; if (hit) return hit; } return null; };
    const rig = {
      hips: B('Hips'), spine2: B('Spine2', 'Spine02', 'Spine01'), head: B('Head'),
      lArm: B('LeftArm'), rArm: B('RightArm'), lFoot: B('LeftFoot'), rFoot: B('RightFoot'),
    };
    st.rig = rig;
    for (const rk in rig) if (rig[rk]) st.rest[rk] = { rot: rig[rk].rotation.clone(), pos: rig[rk].position.clone() };
    root.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 1e-4) { root.scale.multiplyScalar(1.8 / size.y); root.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(root); }
    const c = box.getCenter(new THREE.Vector3());
    root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y; root.updateMatrixWorld(true);
    const fa = new THREE.Vector3(); let minY = Infinity;
    if (rig.lFoot) { rig.lFoot.getWorldPosition(fa); minY = Math.min(minY, fa.y); }
    if (rig.rFoot) { rig.rFoot.getWorldPosition(fa); minY = Math.min(minY, fa.y); }
    st.restFootY = isFinite(minY) ? minY : 0;
    st.ready = true;
    opts.onReady && opts.onReady();
  }, undefined, (err) => { opts.onError && opts.onError(err); });

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const onMove = (e) => {
    st.tpx = (e.touches ? e.touches[0].clientX : e.clientX) / window.innerWidth - 0.5;
    st.tpy = (e.touches ? e.touches[0].clientY : e.clientY) / window.innerHeight - 0.5;
  };
  const onScroll = () => {
    const doc = document.documentElement;
    const max = (doc.scrollHeight - window.innerHeight) || 1;
    st.targetP = clamp(window.scrollY / max, 0, 1);
  };
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const loop = () => {
    if (st.dead) return;
    st.raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    st.t += 0.016;
    const t = st.t;
    st.scrollP += (st.targetP - st.scrollP) * 0.08;
    const par = st.reduced ? 0 : 1;
    st.px += (st.tpx * par - st.px) * 0.05;
    st.py += (st.tpy * par - st.py) * 0.05;
    if (st.pulse > 0) st.pulse = Math.max(0, st.pulse - 0.012);
    const s = sampleKeys(st.scrollP);

    const orb = s.orbit + (st.reduced ? 0 : Math.sin(t * 0.12) * 0.05) + st.px * 0.5;
    const dist = s.dist - st.pulse * 0.25;
    camera.position.x = Math.sin(orb) * dist;
    camera.position.z = Math.cos(orb) * dist;
    camera.position.y = s.camY - st.py * 0.35;
    camera.lookAt(0, s.lookY, 0);
    renderer.toneMappingExposure = s.expo + st.pulse * 0.25;

    key.color.copy(st.kA.set(s.keyHex).lerp(st.kB.set(s.keyHexB), s.keyT)); key.intensity = s.keyInt + st.pulse * 1.2;
    rim.color.copy(st.rA.set(s.rimHex).lerp(st.rB.set(s.rimHexB), s.keyT)); rim.intensity = s.rimInt + st.pulse * 1.0;

    const rig = st.rig, rest = st.rest;
    if (st.ready) {
      for (const rk in rig) if (rig[rk] && rest[rk]) { rig[rk].rotation.copy(rest[rk].rot); rig[rk].position.copy(rest[rk].pos); }
      if (!st.reduced) {
        const br = Math.sin(t * 1.6) * 0.5 + 0.5;
        if (rig.spine2) rig.spine2.rotation.x += br * 0.02;
        if (rig.head) rig.head.rotation.x += Math.sin(t * 1.6) * 0.012;
        if (rig.lArm) rig.lArm.rotation.z += -Math.sin(t * 1.6) * 0.015;
        if (rig.rArm) rig.rArm.rotation.z += Math.sin(t * 1.6) * 0.015;
        if (rig.hips) rig.hips.position.x += Math.sin(t * 0.8) * 0.008;
      }
      if (st.root) {
        st.root.updateMatrixWorld(true);
        let minY = Infinity;
        if (rig.lFoot) { rig.lFoot.getWorldPosition(st._l); minY = Math.min(minY, st._l.y); }
        if (rig.rFoot) { rig.rFoot.getWorldPosition(st._r); minY = Math.min(minY, st._r.y); }
        if (isFinite(minY)) { st.root.position.y += Math.max(st.restFootY - minY, -0.2); st.root.updateMatrixWorld(true); }
      }
    }

    const auraTarget = s.aura + st.pulse * 0.5;
    amat.opacity += (auraTarget - amat.opacity) * 0.06;
    amat.color.set(STAGE_HEX[st.stageIdx]).lerp(auraColor, 0.4);
    const arr = aura.geometry.attributes.position.array;
    for (let pi = 0; pi < N; pi++) { if (!st.reduced) arr[pi * 3 + 1] += spd[pi]; if (arr[pi * 3 + 1] > 2.1) arr[pi * 3 + 1] = 0; }
    aura.geometry.attributes.position.needsUpdate = true;
    if (!st.reduced) aura.rotation.y = t * 0.18;

    for (let ri = 0; ri < rings.length; ri++) {
      const R = rings[ri];
      const rp = st.reduced ? 0.4 : ((t * 0.3 + R.ph) % 1);
      const sc = 1 + rp * 1.9; R.m.scale.set(sc, sc, sc);
      R.m.material.opacity = (1 - rp) * (s.ring + st.pulse * 0.5);
      R.m.material.color.set(STAGE_HEX[st.stageIdx]);
    }
    renderer.render(scene, camera);
  };
  loop();

  return {
    setStage: (i) => { st.stageIdx = clamp(i | 0, 0, STAGE_HEX.length - 1); },
    pulse: () => { st.pulse = 1; },
    dispose: () => {
      st.dead = true; cancelAnimationFrame(st.raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      try { renderer.dispose(); } catch (e) { /* noop */ }
    },
  };
}
