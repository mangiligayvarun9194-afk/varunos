// pitchstage — the 3D theatre behind the investor presentation.
// One three.js scene; each slide is a CAMERA STATION and the camera FLIES between them
// (eased, 1.2s) — slides don't flip, the room moves. The charioteer billboard plays the
// Gate video on the title, the master still through the middle, and the OPEN-HAND frame
// on the final ask. Gold mandala, element orbs, depth dust — the full Sarathi language.
export async function createPitchStage(container, opts) {
  const THREE = await import('three');
  const { heroUrl, handUrl, videoUrl, accents } = opts;
  const W = container.clientWidth, H = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(W, H); renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 60);

  // billboard with radial mask
  const loader = new THREE.TextureLoader();
  const [heroTex, handTex] = await Promise.all([loader.loadAsync(heroUrl), loader.loadAsync(handUrl)]);
  heroTex.colorSpace = THREE.SRGBColorSpace; handTex.colorSpace = THREE.SRGBColorSpace;
  const am = document.createElement('canvas'); am.width = 256; am.height = 384;
  const actx = am.getContext('2d');
  const grad = actx.createRadialGradient(128, 176, 40, 128, 176, 200);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.62, '#fff'); grad.addColorStop(1, '#000');
  actx.fillStyle = grad; actx.fillRect(0, 0, 256, 384);
  const alphaMap = new THREE.CanvasTexture(am);
  const figMat = new THREE.MeshBasicMaterial({ map: heroTex, alphaMap, transparent: true, depthWrite: false });
  const fig = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), figMat);
  scene.add(fig);
  // gate video (title slide)
  let vid = null, vidTex = null;
  if (videoUrl) {
    vid = document.createElement('video');
    vid.src = videoUrl; vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'auto';
    vidTex = new THREE.VideoTexture(vid); vidTex.colorSpace = THREE.SRGBColorSpace;
  }

  // mandala
  const gold = new THREE.Color('#f5b572');
  const mk = (o) => new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const mandala = new THREE.Group();
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.011, 8, 140), mk(0.8));
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.007, 8, 140), mk(0.45));
  const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), mk(0.7), 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; dummy.position.set(Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0); dummy.rotation.z = a; dummy.updateMatrix(); spokes.setMatrixAt(i, dummy.matrix); }
  mandala.add(r1, r2, spokes); mandala.position.set(0, 1.02, -0.85); scene.add(mandala);

  // element orbs
  const orbs = accents.map((hex, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.userData = { a0: (i / accents.length) * Math.PI * 2 };
    scene.add(m); return m;
  });

  // dust
  const DUST = 320, pos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { pos[i * 3] = (Math.random() - 0.5) * 8; pos[i * 3 + 1] = (Math.random() - 0.5) * 6; pos[i * 3 + 2] = -4 + Math.random() * 6; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dm = new THREE.PointsMaterial({ size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.5, color: gold, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(dg, dm));

  const ro = new ResizeObserver(() => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); });
  ro.observe(container);

  // camera flight state
  const cur = { px: 0, py: 0.35, pz: 4.4, lx: 0, ly: 0.35, lz: 0 };
  const tgt = { ...cur };
  let texMode = 'hero';
  const ease = 0.045;

  function flyTo(station) {
    Object.assign(tgt, station);
  }
  function setTexture(mode) {
    if (mode === texMode) return; texMode = mode;
    if (mode === 'video' && vidTex) { figMat.map = vidTex; vid.play().catch(() => {}); }
    else if (mode === 'hand') { figMat.map = handTex; if (vid) vid.pause(); }
    else { figMat.map = heroTex; if (vid) vid.pause(); }
    figMat.needsUpdate = true;
  }
  let dead = false, mx = 0, my = 0;
  function setMouse(x, y) { mx = x; my = y; }
  function frame(t) {
    if (dead) return;
    for (const k of Object.keys(tgt)) cur[k] += (tgt[k] - cur[k]) * ease;
    camera.position.set(cur.px + mx * 0.1, cur.py + my * 0.07, cur.pz);
    camera.lookAt(cur.lx, cur.ly, cur.lz);
    const b = 1 + 0.007 * Math.sin(t * 0.0011); fig.scale.set(b, b, 1);
    mandala.rotation.z = t * 0.00013; r2.rotation.z = -t * 0.0002;
    const mp = 0.75 + 0.25 * Math.sin(t * 0.0016); r1.material.opacity = 0.8 * mp;
    orbs.forEach((o, i) => { const a = o.userData.a0 + t * 0.0004; o.position.set(Math.cos(a) * 1.5, 0.4 + Math.sin(a) * 0.7, -0.7 + Math.sin(a * 1.7) * 0.5); });
    const arr = dg.attributes.position.array;
    for (let i = 0; i < DUST; i++) { arr[i * 3 + 2] += 0.003; if (arr[i * 3 + 2] > 2.4) arr[i * 3 + 2] = -4; }
    dg.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    flyTo, setTexture, setMouse,
    dispose() { dead = true; ro.disconnect(); renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); },
  };
}
