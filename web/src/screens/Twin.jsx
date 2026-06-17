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
import { IconBody, IconTrend, IconFlame, IconBolt, IconSparkle } from '../components/Icons.jsx';

const TWIN_DEMO_GLB = '/models/twin-demo.glb';
const ACTIONS = [
  { id: 'idle', label: 'Idle' },
  { id: 'squat', label: 'Squat' },
  { id: 'deadlift', label: 'Deadlift' },
  { id: 'press', label: 'Press' },
  { id: 'curl', label: 'Curl' },
  { id: 'row', label: 'Row' },
  { id: 'celebrate', label: 'PR!' },
];
// Each stage gets its own aura hue — the body literally changes colour as it ascends.
const STAGE_HEX = ['#7c8aa5', '#2ee6a8', '#2ee6a8', '#4cc9f0', '#a78bfa'];
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

const EXdata = {
  squat: { bar: true, glow: 'legs', tempo: { up: 1.3, hold: 0.25, down: 1.6, rest: 0.5 },
    grip: { lArm: { x: -1.4 }, rArm: { x: -1.4 }, lFore: { x: -1.7 }, rFore: { x: -1.7 } },
    pose: (p) => ({ hipsY: -0.46 * p, spine: { x: 0.30 * p }, spine2: { x: 0.10 * p },
      lUpLeg: { x: -1.55 * p }, rUpLeg: { x: -1.55 * p }, lLeg: { x: 1.95 * p }, rLeg: { x: 1.95 * p },
      lFoot: { x: -0.55 * p }, rFoot: { x: -0.55 * p } }) },
  deadlift: { bar: true, glow: 'back', tempo: { up: 1.2, hold: 0.2, down: 1.5, rest: 0.45 },
    grip: { lArm: { x: 0.05 }, rArm: { x: 0.05 } },
    pose: (p) => ({ hipsY: -0.16 * p, spine: { x: 0.95 * p }, spine2: { x: 0.22 * p }, neck: { x: -0.4 * p },
      lUpLeg: { x: -0.55 * p }, rUpLeg: { x: -0.55 * p }, lLeg: { x: 0.7 * p }, rLeg: { x: 0.7 * p } }) },
  press: { bar: true, glow: 'shoulders', tempo: { up: 1.0, hold: 0.3, down: 1.3, rest: 0.35 },
    pose: (p) => ({ lArm: { x: -1.25 - 1.75 * p }, rArm: { x: -1.25 - 1.75 * p },
      lFore: { x: -1.5 + 1.42 * p }, rFore: { x: -1.5 + 1.42 * p }, spine: { x: -0.05 * p } }) },
  curl: { bar: true, glow: 'arms', tempo: { up: 0.9, hold: 0.35, down: 1.1, rest: 0.3 },
    grip: { lArm: { x: -0.22 }, rArm: { x: -0.22 } },
    pose: (p) => ({ lFore: { x: -0.15 - 2.05 * p }, rFore: { x: -0.15 - 2.05 * p } }) },
  row: { bar: true, glow: 'back', tempo: { up: 0.85, hold: 0.35, down: 1.1, rest: 0.3 },
    grip: { spine: { x: 0.85 }, spine2: { x: 0.22 }, neck: { x: -0.5 },
      lUpLeg: { x: -0.32 }, rUpLeg: { x: -0.32 }, lLeg: { x: 0.42 }, rLeg: { x: 0.42 } },
    pose: (p) => ({ lFore: { x: -0.25 - 1.25 * p }, rFore: { x: -0.25 - 1.25 * p },
      lArm: { x: 0.1 - 0.55 * p }, rArm: { x: 0.1 - 0.55 * p } }) },
};

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
        stage.appendChild(renderer.domElement);

        // Level (0..1) drives every VFX intensity.
        let g = 0;
        try { g = (levelRef.current || 0) / 100; } catch (_) {}
        const stageIdx = Math.min(4, Math.max(0, (stats?.avatar?.stage ?? 1) - 1));
        const auraColor = new THREE.Color(STAGE_HEX[stageIdx] || '#2ee6a8');

        scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x182030, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(1.5, 3, 2.5); scene.add(key);
        const rim = new THREE.DirectionalLight(auraColor.getHex(), 0.7 + g * 1.6);
        rim.position.set(-2, 1.5, -2); scene.add(rim);

        // Glowing floor disc + concentric pulse rings.
        const floor = new THREE.Mesh(
          new THREE.CircleGeometry(1.1, 48),
          new THREE.MeshBasicMaterial({ color: 0x0c1424, transparent: true, opacity: 0.9 }));
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

        const bones = {};
        root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
        const B = (n) => bones[n] || bones['mixamorig' + n] || bones['mixamorig:' + n] || null;
        const rig = {
          hips: B('Hips'), spine: B('Spine'), spine2: B('Spine2') || B('Spine1'),
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

        root.updateMatrixWorld(true);
        const headPos = new THREE.Vector3();
        (rig.head || root).getWorldPosition(headPos);
        const h = Math.max(0.9, headPos.y * 1.12);
        camera.position.set(0, h * 0.6, h * 1.9);
        camera.lookAt(0, h * 0.5, 0);

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
          composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.5 + g * 0.5, 0.85, 0.82));
        } catch (_) { composer = null; }

        const twin = { renderer, composer, scene, camera, rig, rest, root, aura, amat,
          spd, rings, auraColor, baseAura: auraTarget, bar, trail, tp, tc, TN,
          camRad: h * 1.9, camY: h * 0.62, camLookY: h * 0.5,
          _X: new THREE.Vector3(1, 0, 0), _l: new THREE.Vector3(), _r: new THREE.Vector3(),
          lastMode: null, t: 0, raf: 0 };
        twinRef.current = twin;

        // Apply a set of {joint:{x,y,z}} (or hipsY) offsets onto the rest pose.
        const applyOffsets = (offs) => {
          for (const k in offs) {
            if (k === 'hipsY') { if (rig.hips) rig.hips.position.y += offs[k]; continue; }
            const b = rig[k]; if (!b) continue;
            const v = offs[k];
            if (v.x) b.rotation.x += v.x;
            if (v.y) b.rotation.y += v.y;
            if (v.z) b.rotation.z += v.z;
          }
        };

        const loop = () => {
          twin.raf = requestAnimationFrame(loop);
          twin.t += 0.016;
          const t = twin.t;
          for (const [k, b] of Object.entries(rig)) {
            if (!b || !rest[k]) continue;
            b.rotation.copy(rest[k].rot); b.position.copy(rest[k].pos);
          }
          const breathe = Math.sin(t * 1.8) * 0.5 + 0.5;
          if (rig.spine2) rig.spine2.rotation.x += breathe * 0.025;
          const m = modeRef.current;
          const ex = EXdata[m];
          let p = 0;
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

          // Barbell tracks the hands via forward kinematics + a fading motion trail.
          root.updateMatrixWorld(true);
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
        {phase === 'ready' && !usingOwn && (
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'var(--mute)' }}>
            Demo avatar — make it you below
          </div>
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
              fontFamily: 'var(--font-display)', color: active ? '#04150e' : 'var(--dim)', transition: 'color 0.18s',
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
        {!stats && <div className="skel" style={{ height: 60 }} />}
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
