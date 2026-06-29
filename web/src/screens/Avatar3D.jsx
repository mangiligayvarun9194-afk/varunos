// Avatar3D — a real 3D, procedurally-animated character for the homepage tour.
// Loads a rigged humanoid GLB and poses its bones per scroll beat to perform the 7
// gestures (idle → hand-to-head/Hermes → hand-on-heart/Readiness → present-hands/
// Form-Coach → hand-on-core/Vault → power-stance/Twin → arms-out/ascended). Obsidian
// + gold styling, idle breathing, and a camera that pushes to each region. Driven by
// `setProgress(0..1)` from the parent's scroll loop (smoothed here). The model is the
// project's own rigged Twin (legal); a charioteer GLB with the same Mixamo bones drops
// straight in. Reduced-motion → holds the calm idle pose.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Per-beat bone-rotation offsets (radians, added to the rest pose) + camera framing.
// Tuned against the project's Mixamo-rigged model; signs/values iterate visually.
const POSES = [
  { // 0 — idle / "you are the chariot" (full figure)
    cam: { y: 0.95, d: 3.7 }, bones: {} },
  { // 1 — the mind · Hermes: right hand rises toward the temple
    cam: { y: 1.5, d: 1.7 },
    bones: { RightArm: { z: -1.9, x: 0.3 }, RightForeArm: { y: 1.9, x: 0.4 } } },
  { // 2 — the heart · Readiness: right hand over the heart
    cam: { y: 1.22, d: 2.0 },
    bones: { RightArm: { z: -0.9, y: 0.9 }, RightForeArm: { y: 1.7 } } },
  { // 3 — the hands · Form Coach: both arms present forward, open
    cam: { y: 1.02, d: 2.6 },
    bones: { RightArm: { z: -1.0, x: 0.7 }, RightForeArm: { y: 0.5, x: 0.3 },
             LeftArm: { z: 1.0, x: 0.7 }, LeftForeArm: { y: -0.5, x: 0.3 } } },
  { // 4 — the core · The Vault: right hand to the abdomen
    cam: { y: 0.95, d: 1.9 },
    bones: { RightArm: { z: -0.55, y: 0.8 }, RightForeArm: { y: 1.9 } } },
  { // 5 — the foundation · The Twin: power stance, chest out
    cam: { y: 0.62, d: 2.9 },
    bones: { Spine02: { x: -0.16 }, RightArm: { z: 0.18, x: -0.25 }, LeftArm: { z: -0.18, x: -0.25 } } },
  { // 6 — become / ascended: arms spread, head lifted
    cam: { y: 0.98, d: 3.5 },
    bones: { RightArm: { z: -0.7, x: -0.15 }, LeftArm: { z: 0.7, x: -0.15 }, Spine02: { x: -0.12 }, Head: { x: -0.28 } } },
];
const N = POSES.length;

const Avatar3D = forwardRef(function Avatar3D({ url = '/models/twin-custom.glb', accent = '#f5b572' }, ref) {
  const wrapRef = useRef(null);
  const apiRef = useRef({ setProgress: () => {} });
  useImperativeHandle(ref, () => ({ setProgress: (p) => apiRef.current.setProgress(p) }), []);

  useEffect(() => {
    let dead = false, cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      if (dead) return;
      const wrap = wrapRef.current; if (!wrap) return;
      const W = wrap.clientWidth || window.innerWidth, H = wrap.clientHeight || window.innerHeight;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      wrap.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 60);
      camera.position.set(0, 1.1, 3.1);
      try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; } catch (e) {}

      const acc = new THREE.Color(accent);
      scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x0a0d14, 0.7));
      const key = new THREE.DirectionalLight(0xffe9cf, 2.0); key.position.set(2.4, 3.4, 2.6); scene.add(key);
      const rim = new THREE.DirectionalLight(acc.getHex(), 2.6); rim.position.set(-2.6, 2.2, -1.8); scene.add(rim);
      const fill = new THREE.DirectionalLight(0x6f8cff, 0.5); fill.position.set(-1.2, 0.6, 3.0); scene.add(fill);

      let gltf;
      try { gltf = await new GLTFLoader().loadAsync(url); } catch (e) { return; }
      if (dead) { renderer.dispose(); return; }
      const root = gltf.scene; scene.add(root);

      // obsidian + gold styling
      root.traverse((o) => {
        if (o.isMesh) {
          o.material = new THREE.MeshStandardMaterial({ color: 0x0a0d16, metalness: 0.55, roughness: 0.42, envMapIntensity: 0.7, emissive: new THREE.Color(accent).multiplyScalar(0.05) });
          o.frustumCulled = false;
        }
      });

      // rig
      const bones = {}; root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
      const lc = {}; for (const k in bones) lc[k.toLowerCase()] = bones[k];
      const B = (...names) => { for (const n of names) { const h = bones[n] || bones['mixamorig' + n] || lc[n.toLowerCase()]; if (h) return h; } return null; };
      const RIG = ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head',
        'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
        'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
      const rig = {}; RIG.forEach((n) => { const b = B(n); if (b) rig[n] = b; });
      const rest = {}; for (const k in rig) rest[k] = rig[k].rotation.clone();

      // normalize → 1.8m, centered, feet on floor
      root.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(root); let size = box.getSize(new THREE.Vector3());
      if (size.y > 1e-4) { root.scale.multiplyScalar(1.8 / size.y); root.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(root); }
      const c = box.getCenter(new THREE.Vector3());
      root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y; root.updateMatrixWorld(true);

      // contact shadow
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d');
      const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; scene.add(shadow);

      const st = { p: 0, target: 0, t: 0, raf: 0, reduced: reduced() };
      apiRef.current.setProgress = (v) => { st.target = clamp(v, 0, 1); };

      const apply = () => {
        const f = st.p * (N - 1);
        const i = clamp(Math.floor(f), 0, N - 2);
        const frac = f - i;
        const A = POSES[i], Bp = POSES[i + 1];
        // reset to rest, then add interpolated offsets + breathing
        for (const k in rig) rig[k].rotation.copy(rest[k]);
        const addOff = (pose, w) => {
          for (const bn in pose.bones) {
            const b = rig[bn]; if (!b) continue; const o = pose.bones[bn];
            if (o.x) b.rotation.x += o.x * w; if (o.y) b.rotation.y += o.y * w; if (o.z) b.rotation.z += o.z * w;
          }
        };
        addOff(A, 1 - frac); addOff(Bp, frac);
        if (!st.reduced) {
          const br = Math.sin(st.t * 1.4);
          if (rig.Spine02) rig.Spine02.rotation.x += br * 0.02;
          if (rig.Head) rig.Head.rotation.x += br * 0.012;
          if (rig.Hips) rig.Hips.position.y = Math.sin(st.t * 0.8) * 0.004;
        }
        // camera — look straight at the framed body part
        const camY = lerp(A.cam.y, Bp.cam.y, frac), camD = lerp(A.cam.d, Bp.cam.d, frac);
        camera.position.set(0, camY, camD);
        camera.lookAt(0, camY, 0);
      };

      const loop = () => {
        if (dead) return; st.raf = requestAnimationFrame(loop);
        if (document.hidden) return;
        st.t += 0.016;
        st.p += (st.target - st.p) * 0.08;
        apply();
        renderer.render(scene, camera);
      };
      loop();

      const onResize = () => { const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      window.addEventListener('resize', onResize);
      cleanup = () => { cancelAnimationFrame(st.raf); window.removeEventListener('resize', onResize); renderer.domElement.remove(); try { renderer.dispose(); } catch (e) {} };
    })();
    return () => { dead = true; cleanup(); };
  }, [url, accent]);

  return <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }} />;
});

export default Avatar3D;
