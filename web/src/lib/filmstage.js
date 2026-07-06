// filmstage — the TRUE-3D layer of the Sarathi scroll film (three.js).
// The photoreal master rides as a billboard inside a real perspective scene:
//  · a perspective camera dollies along the body (driven by the story conductor)
//  · a 3D golden mandala — two counter-rotating rings + 24 spokes — spins behind the head
//  · ELEMENT POWER STREAMS — each element visibly pours its shakti INTO the body:
//    space-threads spiral into the crown (the mind that remembers), wind sweeps into
//    the lungs (Hanuman, son of Vayu), embers rise into the belly (Vaiśvānara's fire),
//    nectar falls into the heart (the churned ocean's amṛta), earth-dust accretes onto
//    the limbs (Hanuman carrying the mountain). Once an element has given its power,
//    that centre STAYS LIT for the rest of the film — the charioteer awakens centre by
//    centre, and the finale pours all five in at once.
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
  // Per-pixel elliptical falloff — fully transparent well before the plane's edge,
  // so the billboard's rectangle can never read against the void.
  const am = document.createElement('canvas'); am.width = 256; am.height = 384;
  const actx = am.getContext('2d');
  const img = actx.createImageData(256, 384);
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < 384; y++) {
    for (let x = 0; x < 256; x++) {
      const nx = (x - 128) / 118, ny = (y - 184) / 176;      // elliptical, biased slightly up
      const d = Math.sqrt(nx * nx + ny * ny);
      const a = 1 - smooth(0.52, 0.88, d);
      const i = (y * 256 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a);
      img.data[i + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);
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
  const dbg = (typeof window !== 'undefined') ? (window.__sarathiFilm = { vidPlanes }) : {};  // debug/verify hook

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

  // ── ELEMENT POWER TRANSFER — the story's soul, made visible ────────────────
  // Five centres on the body (crown/lungs/belly/heart/base). During each element's
  // chapter, ~240 particles ride coherent bezier rivulets from that element's realm
  // (the sky, the sides, the underworld, the heavens, the ground) INTO its centre.
  // `awakened[i]` persists once earned, so gathered centres stay lit ever after.
  const CHAKRA = [
    { pos: [0, 1.14, 0.05], s: 0.30 },   // आकाश → crown: the mind that remembers
    { pos: [0, 0.42, 0.05], s: 0.30 },   // वायु → lungs: the breath that moves
    { pos: [0, -0.05, 0.05], s: 0.32 },  // अग्नि → belly: Vaiśvānara, digester of food
    { pos: [0, 0.24, 0.04], s: 0.28 },   // आपस् → heart: amṛta from the churned ocean
    { pos: [0, -0.55, 0.05], s: 0.34 },  // पृथ्वी → base: the foundation that carries
  ];
  const chakras = CHAKRA.map((c, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(THREE, accents[i]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(...c.pos); sp.scale.set(c.s, c.s, 1); sp.userData.s0 = c.s;
    sp.renderOrder = 6;
    scene.add(sp); return sp;
  });
  const awakened = [0, 0, 0, 0, 0];

  const rnd = (a, b) => a + Math.random() * (b - a);
  // Per-element rivulet seeds: where the element's power comes FROM, and the bend
  // of its journey to the body. 8 coherent rivulets each → reads as flowing streams.
  function streamSeed(el, k) {
    const a = (k / 8) * Math.PI * 2;
    if (el === 0) return { src: [Math.cos(a) * 2.3, rnd(1.7, 2.9), -0.7 + Math.sin(a) * 0.7], ctrl: [Math.cos(a + 1.2) * 0.9, 2.0, 0.15] };            // space: dome above, spiral in
    if (el === 1) { const sg = k % 2 ? 1 : -1; return { src: [sg * rnd(2.2, 2.9), rnd(0.05, 1.0), rnd(0.1, 0.7)], ctrl: [-sg * 1.2, 0.6, 0.95] }; }   // wind: sweeps across the torso's front
    if (el === 2) return { src: [rnd(-1.4, 1.4), rnd(-2.5, -1.8), rnd(-0.4, 0.3)], ctrl: [rnd(-0.5, 0.5), -0.6, 0.4] };                                 // fire: rises from below
    if (el === 3) return { src: [rnd(-0.95, 0.95), rnd(2.0, 2.9), rnd(-0.3, 0.3)], ctrl: [rnd(-0.4, 0.4), 1.05, 0.5] };                                 // water: falls from the heavens
    return { src: [Math.cos(a) * rnd(1.2, 2.2), -1.55, Math.sin(a) * rnd(0.4, 1.0)], ctrl: [Math.cos(a) * 0.55, -1.0, 0.35] };                          // earth: rises off the ground
  }
  const LIMBS = [[0.5, 0.3, 0.06], [-0.5, 0.3, 0.06], [0.18, -0.85, 0.06], [-0.18, -0.85, 0.06]];
  const N_STREAM = 240;
  const softDot = glowTex(THREE, '#ffffff');   // round, soft-edged particle sprite
  const streams = accents.map((hex, el) => {
    const seeds = Array.from({ length: 8 }, (_, k) => streamSeed(el, k));
    const parts = Array.from({ length: N_STREAM }, (_, i) => {
      const s = seeds[i % 8];
      const j = (v, r) => [v[0] + rnd(-r, r), v[1] + rnd(-r, r), v[2] + rnd(-r, r)];
      const tgt = el === 4 ? j(LIMBS[i % 4], 0.06) : j(CHAKRA[el].pos, 0.05);
      return { u: Math.random(), sp: rnd(0.004, 0.009), src: j(s.src, 0.28), ctrl: j(s.ctrl, 0.22), tgt };
    });
    const posA = new Float32Array(N_STREAM * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posA, 3));
    const mat = new THREE.PointsMaterial({ size: 0.075, sizeAttenuation: true, map: softDot, alphaMap: softDot, transparent: true, opacity: 0, color: new THREE.Color(hex), blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false; pts.frustumCulled = false;
    pts.renderOrder = 5;   // above the figure billboard — never occluded by its plane
    scene.add(pts);
    return { pts, mat, geo, posA, parts };
  });
  function flowStreams(S, pw) {
    S.mat.opacity = 0.9 * pw;
    const on = pw > 0.02;
    S.pts.visible = on;
    if (!on) return;
    const a = S.posA;
    for (let i = 0; i < N_STREAM; i++) {
      const q = S.parts[i];
      q.u += q.sp; if (q.u > 1) q.u -= 1;
      const u = q.u, v = 1 - u;
      a[i * 3]     = v * v * q.src[0] + 2 * v * u * q.ctrl[0] + u * u * q.tgt[0];
      a[i * 3 + 1] = v * v * q.src[1] + 2 * v * u * q.ctrl[1] + u * u * q.tgt[1];
      a[i * 3 + 2] = v * v * q.src[2] + 2 * v * u * q.ctrl[2] + u * u * q.tgt[2];
    }
    S.geo.attributes.position.needsUpdate = true;
  }

  dbg.streams = streams; dbg.chakras = chakras;

  // आकाश extra: a constellation web above the crown — memory wiring itself together.
  const starPts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [Math.cos(a) * rnd(0.6, 1.5), rnd(1.25, 2.2), -0.7 + Math.sin(a) * rnd(0.3, 0.8)];
  });
  const linePos = [];
  for (let i = 0; i < 16; i++) { linePos.push(...starPts[i], ...starPts[(i + 3) % 16], ...starPts[i], ...starPts[(i + 1) % 16]); }
  const constGeo = new THREE.BufferGeometry();
  constGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
  const constel = new THREE.LineSegments(constGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(accents[0]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  constel.visible = false;
  constel.renderOrder = 5;
  scene.add(constel);

  // ── the heart: a teal bloom PINNED to the chest in world space, so it tracks
  //    every camera move exactly (driven per-frame by coreI from the conductor) ──
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(THREE, '#2ec4b6'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  heart.position.set(0, 0.24, 0.04);
  heart.scale.set(0.52, 0.52, 1);
  scene.add(heart);

  // ── volumetric dust with real z-depth ──────────────────────────────────────
  const DUST = 380;
  const pos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { pos[i * 3] = (Math.random() - 0.5) * 7; pos[i * 3 + 1] = (Math.random() - 0.5) * 5; pos[i * 3 + 2] = -3.5 + Math.random() * 5.5; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.02, sizeAttenuation: true, map: softDot, alphaMap: softDot, transparent: true, opacity: 0.5, color: new THREE.Color('#f5b572'), blending: THREE.AdditiveBlending, depthWrite: false });
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

  function setShot(cam, idx, p, t, mx, my, accentHex, coreI = 0) {
    if (dead) return;
    // heartbeat: double-thump pulse, only alive while the conductor says so (water)
    const beat = Math.pow(Math.max(0, Math.sin(t * 0.0026 * Math.PI * 2)), 6) + 0.55 * Math.pow(Math.max(0, Math.sin(t * 0.0026 * Math.PI * 2 + 0.9)), 8);
    heart.material.opacity = coreI * (0.35 + 0.5 * beat);
    const hs = 0.52 * (1 + 0.16 * beat * coreI);
    heart.scale.set(hs, hs, 1);
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
    // ── element power transfer: the element pours its shakti into the body ──
    const sm01 = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
    const elIdx = idx - 1;                                  // 0..4 during element chapters
    const inEl = elIdx >= 0 && elIdx < 5;
    const ramp = inEl ? sm01((p - 0.08) / 0.22) * (1 - sm01((p - 0.96) / 0.04)) : 0;
    const finaleP = idx >= 6 ? sm01((p - 0.05) / 0.3) : 0;
    if (inEl) awakened[elIdx] = Math.max(awakened[elIdx], sm01((p - 0.2) / 0.5));
    streams.forEach((S, i) => flowStreams(S, (inEl && i === elIdx) ? ramp : finaleP * 0.5));
    chakras.forEach((c, i) => {
      const cur = inEl && i === elIdx ? ramp : 0;
      // gathered centres stay lit; the active one burns; the finale floods all five
      const base = Math.min(1, awakened[i] * 0.32 + cur * 0.72 + finaleP * 0.5);
      const flick = i === 2
        ? 0.8 + 0.2 * Math.abs(Math.sin(t * 0.012) * Math.sin(t * 0.0067 + 1.7))   // the belly-fire flickers
        : 0.9 + 0.1 * Math.sin(t * 0.0028 + i * 1.3);
      c.material.opacity = base * flick;
      const cs = c.userData.s0 * (1 + 0.28 * cur + 0.35 * finaleP + 0.1 * Math.sin(t * 0.0021 + i));
      c.scale.set(cs, cs, 1);
    });
    const constOp = ((inEl && elIdx === 0) ? ramp : finaleP * 0.35) * 0.5;
    constel.material.opacity = constOp;
    constel.visible = constOp > 0.02;
    constel.rotation.y = t * 0.00006;
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
    // rays breathe — and blaze in the finale as the five align
    rays.forEach((r, i) => { r.material.opacity = 0.07 + 0.05 * Math.abs(Math.sin(t * 0.0009 + i)) + 0.1 * cc; });
    ring1.material.opacity = 0.8 * mp * (1 + 0.5 * cc);
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
