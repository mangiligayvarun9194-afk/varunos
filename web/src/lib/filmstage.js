// filmstage — the TRUE-3D layer of the Sarathi scroll film (three.js).
// The photoreal master rides as a billboard inside a real perspective scene:
//  · a perspective camera dollies along the body (driven by the story conductor)
//  · a 3D golden mandala — two counter-rotating rings + 24 spokes — spins behind the head
//  · five element orbs orbit in depth, brighten as each element is gathered, and in the
//    finale converge into a vertical column through the figure
//  · a volumetric dust-field drifts toward the camera (real z-parallax)
//  · two additive god-ray planes breathe above
// Exports createFilmStage(container, heroUrl, accents) -> { setShot, dispose } or throws
// (caller falls back to the 2D DOM figure).
export async function createFilmStage(container, heroUrl, accents, videos = {}) {
  const THREE = await import('three');
  const W = container.clientWidth, H = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 60);

  // ── the figure: master texture on a 2:3 plane with a radial-falloff alpha mask ──
  const tex = await new THREE.TextureLoader().loadAsync(heroUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  const am = document.createElement('canvas'); am.width = 256; am.height = 384;
  const actx = am.getContext('2d');
  const grad = actx.createRadialGradient(128, 176, 40, 128, 176, 200);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.62, '#fff'); grad.addColorStop(1, '#000');
  actx.fillStyle = grad; actx.fillRect(0, 0, 256, 384);
  const alphaMap = new THREE.CanvasTexture(am);
  const fig = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 3),
    new THREE.MeshBasicMaterial({ map: tex, alphaMap, transparent: true, depthWrite: false })
  );
  scene.add(fig);

  // ── scene-video billboards: same plane, same mask — living footage per segment ──
  const vidPlanes = {};
  for (const [segIdx, url] of Object.entries(videos)) {
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    const vt = new THREE.VideoTexture(v);
    vt.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 3),
      new THREE.MeshBasicMaterial({ map: vt, alphaMap, transparent: true, depthWrite: false })
    );
    plane.visible = false;
    plane.userData.video = v;
    scene.add(plane);
    vidPlanes[segIdx] = plane;
  }
  if (typeof window !== 'undefined') window.__sarathiFilm = { vidPlanes };  // debug/verify hook

  // ── 3D mandala behind the head ─────────────────────────────────────────────
  const gold = new THREE.Color('#f5b572');
  const mkRingMat = (o) => new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const mandala = new THREE.Group();
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.011, 8, 140), mkRingMat(0.8));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.007, 8, 140), mkRingMat(0.45));
  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.004, 8, 140), mkRingMat(0.3));
  const spokeGeo = new THREE.BoxGeometry(0.012, 0.09, 0.012);
  const spokes = new THREE.InstancedMesh(spokeGeo, mkRingMat(0.7), 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0);
    dummy.rotation.z = a; dummy.updateMatrix();
    spokes.setMatrixAt(i, dummy.matrix);
  }
  mandala.add(ring1, ring2, ring3, spokes);
  mandala.position.set(0, 1.02, -0.85);
  scene.add(mandala);

  // ── five element orbs (orbit in depth → converge in the finale) ────────────
  const orbGroup = new THREE.Group();
  const orbs = accents.map((hex, i) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 18, 18),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(THREE, hex), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(0.34, 0.34, 1);
    m.add(halo);
    m.userData = { a0: (i / accents.length) * Math.PI * 2 };
    orbGroup.add(m);
    return m;
  });
  scene.add(orbGroup);

  // ── volumetric dust with real z-depth ──────────────────────────────────────
  const DUST = 380;
  const pos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { pos[i * 3] = (Math.random() - 0.5) * 7; pos[i * 3 + 1] = (Math.random() - 0.5) * 5; pos[i * 3 + 2] = -3.5 + Math.random() * 5.5; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.5, color: new THREE.Color('#f5b572'), blending: THREE.AdditiveBlending, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ── god-ray planes ─────────────────────────────────────────────────────────
  const rayTex = rayTexture(THREE);
  const rays = [-0.5, 0.4].map((x, i) => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.position.set(x * 2, 1.4, -1.6); r.rotation.z = (i === 0 ? 1 : -1) * 0.22;
    scene.add(r); return r;
  });

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  });
  ro.observe(container);

  const accentColor = new THREE.Color('#f5b572');
  let dead = false;

  function setShot(cam, idx, p, t, mx, my, accentHex) {
    if (dead) return;
    // camera: dolly along the body in true perspective
    const ty = 1.5 - (cam.fy / 100) * 3;
    camera.position.set(mx * 0.14, ty + my * 0.1, 4.35 / cam.s);
    camera.lookAt(0, ty, 0);
    // pick the billboard: living footage for this segment if ready, else the still
    const vp = vidPlanes[idx];
    const vReady = vp && vp.userData.video.readyState >= 2;
    for (const [k, pl] of Object.entries(vidPlanes)) {
      const on = vReady && Number(k) === idx;
      pl.visible = on;
      if (on) { if (pl.userData.video.paused) pl.userData.video.play().catch(() => {}); }
      else if (!pl.userData.video.paused) pl.userData.video.pause();
    }
    fig.visible = !vReady;
    // figure breath (footage carries its own life; the still breathes)
    const b = 1 + 0.007 * Math.sin(t * 0.0011);
    fig.scale.set(b, b, 1);
    if (vReady) vp.scale.set(1, 1, 1);
    // mandala life
    mandala.rotation.z = t * 0.00013;
    ring2.rotation.z = -t * 0.00022;
    ring3.rotation.z = t * 0.00008;
    const mp = 0.75 + 0.25 * Math.sin(t * 0.0016);
    ring1.material.opacity = 0.8 * mp; spokes.material.opacity = 0.7 * mp;
    // dust: drift toward camera, tint toward the active element
    accentColor.set(accentHex);
    dustMat.color.lerp(accentColor, 0.02);
    const a = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST; i++) { a[i * 3 + 2] += 0.0035; if (a[i * 3 + 2] > 2.2) a[i * 3 + 2] = -3.5; }
    dustGeo.attributes.position.needsUpdate = true;
    // orbs: orbit → gather → converge
    const conv = idx >= 6 ? Math.min(1, Math.max(0, (p - 0.2) / 0.55)) : 0;
    const cc = conv * conv * (3 - 2 * conv);
    orbs.forEach((o, i) => {
      const reached = idx - 1 > i || idx >= 6;          // element already gathered
      const current = idx - 1 === i;
      const ang = o.userData.a0 + t * 0.00035;
      const R = 1.35 * (1 - cc * 0.96);
      const ox = Math.cos(ang) * R * (1 - cc) + 0 * cc;
      const oy = 0.35 + Math.sin(ang) * R * 0.5 * (1 - cc) + ((i - 2) * 0.34 - 0.35) * cc + 0.35 * cc;
      const oz = -0.6 + Math.sin(ang * 1.7) * 0.5 * (1 - cc) + 0.45 * cc;
      o.position.set(ox, oy, oz);
      const target = idx >= 6 ? 1.35 : current ? 1.5 : reached ? 1 : 0.45;
      const s = o.scale.x + (target - o.scale.x) * 0.06;
      o.scale.set(s, s, s);
      o.material.opacity = idx >= 6 ? 0.95 : current ? 0.95 : reached ? 0.8 : 0.3;
    });
    // rays breathe
    rays.forEach((r, i) => { r.material.opacity = 0.07 + 0.05 * Math.abs(Math.sin(t * 0.0009 + i)); });
    renderer.render(scene, camera);
  }

  function dispose() {
    dead = true; ro.disconnect();
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  return { setShot, dispose };
}

function glowTex(THREE, hex) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, hex); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function rayTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(245,181,114,0.55)'); g.addColorStop(1, 'rgba(245,181,114,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  return new THREE.CanvasTexture(c);
}
