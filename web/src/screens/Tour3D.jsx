// Tour3D — the homepage centerpiece: a pinned, scroll-scrubbed 3D sequence starring
// the rigged "Sentinel" charioteer (the user's own Meshy character). One base mesh with
// four real motion clips (stance / walk / run / power-spin-jump) bound by bone name and
// crossfaded per scroll beat, a camera that orbits + frames the body, gold rim + embers,
// and the Sarathi narrative revealing in sync. ~4 MB total (Draco + WebP optimized).
// Reduced-motion / no-WebGL → a clean stacked story.
import { useEffect, useRef, useState } from 'react';

const BASE = '/models/sentinel-base.glb';
const ANIMS = { stance: '/models/sentinel-anim-stance.glb', walk: '/models/sentinel-anim-walk.glb', run: '/models/sentinel-anim-run.glb', jump: '/models/sentinel-anim-jump.glb' };
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (h1, h2, t) => { const a = hx(h1), b = hx(h2); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; };

// clip = which motion plays · cam = framing (distance, look-height, orbit angle)
const BEATS = [
  { clip: 'stance', eyebrow: 'सारथि · the charioteer', title: 'You are the chariot.', body: 'Your body carries you through every day. Sarathi is the charioteer that learns it, reads it, and steers it toward your own victory.', accent: '#f5b572', side: 'left', cam: { d: 3.7, y: 0.95, orbit: -0.2 } },
  { clip: 'stance', eyebrow: 'the mind · hermes', title: 'A coach that remembers.', body: 'Hermes reads every score, recalls every session, and speaks the one move that matters next.', accent: '#ffd9a8', side: 'right', cam: { d: 2.2, y: 1.42, orbit: 0.25 } },
  { clip: 'run', eyebrow: 'the hands · form coach', title: 'It moves with you.', body: 'On-device pose AI counts and grades every rep in real time. Nothing leaves your phone.', accent: '#7fd4f0', side: 'left', cam: { d: 3.5, y: 1.0, orbit: 0.5 } },
  { clip: 'stance', eyebrow: 'the heart · readiness', title: 'It knows when to rest.', body: 'Sleep, HRV and strain become one readiness score — so you push on the right days and recover on the rest.', accent: '#5fd0bd', side: 'right', cam: { d: 2.7, y: 1.15, orbit: -0.3 }, ring: 84 },
  { clip: 'walk', eyebrow: 'the path · the vault', title: 'Its memory is yours.', body: 'Every reading, meal and lift is written to a Health Vault in open Markdown you own forever. No lock-in.', accent: '#4cc9f0', side: 'left', cam: { d: 3.6, y: 1.0, orbit: 0.2 }, vault: true },
  { clip: 'jump', eyebrow: 'become · the twin', title: 'Watch yourself level up.', body: 'Train, and your living Twin grows. Strength made visible — beat by beat.', accent: '#f5b572', side: 'right', cam: { d: 4.0, y: 1.1, orbit: 0 } },
  { clip: 'stance', eyebrow: 'become', title: 'Meet your Twin.', body: 'Sixty seconds to begin. A lifetime that’s yours.', accent: '#ffdeba', side: 'center', cam: { d: 3.3, y: 1.0, orbit: 0 }, cta: true },
];
const N = BEATS.length;

export default function Tour3D({ onStart }) {
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 760);
  useEffect(() => { const f = () => setMobile(window.innerWidth < 760); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const outerRef = useRef(null), stageRef = useRef(null), wrapRef = useRef(null), spotRef = useRef(null), canvasRef = useRef(null);
  const panelRefs = useRef([]), dotRefs = useRef([]);
  const ctrlRef = useRef({ setProgress: () => {} });
  const auraRef = useRef('#f5b572');

  // ---- 3D scene ----
  useEffect(() => {
    if (reduced()) return;
    let dead = false, cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      if (dead) return;
      const wrap = wrapRef.current; if (!wrap) return;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(W, H); renderer.setPixelRatio(Math.min(mobile ? 1.6 : 2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      wrap.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 60);
      try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; } catch (e) {}
      scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x0a0d14, 0.75));
      const key = new THREE.DirectionalLight(0xffe9cf, 2.1); key.position.set(2.6, 3.6, 2.8); scene.add(key);
      const rim = new THREE.DirectionalLight(0xf5b572, 2.6); rim.position.set(-2.8, 2.2, -2.0); scene.add(rim);
      const fill = new THREE.DirectionalLight(0x6f8cff, 0.4); fill.position.set(-1.2, 0.6, 3.0); scene.add(fill);

      const draco = new DRACOLoader(); draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      const loader = new GLTFLoader(); loader.setDRACOLoader(draco);

      const pivot = new THREE.Group(); scene.add(pivot);
      let base; try { base = await loader.loadAsync(BASE); } catch (e) { return; }
      if (dead) { renderer.dispose(); return; }
      const root = base.scene; pivot.add(root);
      root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 1.1; } });
      // normalize → 1.85m, centered, feet at floor
      root.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(root); const sz = box.getSize(new THREE.Vector3());
      if (sz.y > 1e-4) { root.scale.multiplyScalar(1.85 / sz.y); root.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(root); }
      const c = box.getCenter(new THREE.Vector3()); root.position.x -= c.x; root.position.z -= c.z; root.position.y -= box.min.y; root.updateMatrixWorld(true);

      const mixer = new THREE.AnimationMixer(root);
      const actions = {};
      const idle = mixer.clipAction(base.animations[0]); idle.play(); actions.stance = idle; // fallback until clips load
      // load the four motion clips and bind by bone name
      for (const [name, url] of Object.entries(ANIMS)) {
        loader.loadAsync(url).then((g) => { if (dead || !g.animations[0]) return; const act = mixer.clipAction(g.animations[0]); act.enabled = true; act.setEffectiveWeight(0); act.play(); actions[name] = act; }).catch(() => {});
      }

      // ground glow + embers (gold)
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d');
      const gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(245,181,114,.5)'); gr.addColorStop(1, 'rgba(245,181,114,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.01; scene.add(glow);
      const NP = mobile ? 30 : 60, pos = new Float32Array(NP * 3), spd = new Float32Array(NP);
      for (let i = 0; i < NP; i++) { const a = Math.random() * 6.28, r = 0.4 + Math.random() * 0.7; pos[i*3]=Math.cos(a)*r; pos[i*3+1]=Math.random()*2.2; pos[i*3+2]=Math.sin(a)*r; spd[i]=0.002+Math.random()*0.006; }
      const ageo = new THREE.BufferGeometry(); ageo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const aura = new THREE.Points(ageo, new THREE.PointsMaterial({ size: 0.02, map: tex, color: 0xf5b572, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(aura);

      const st = { p: 0, target: 0, clock: new THREE.Clock(), curClip: 'stance' };
      ctrlRef.current.setProgress = (v) => { st.target = clamp(v, 0, 1); };
      const setClip = (name) => {
        if (name === st.curClip || !actions[name]) return;
        const from = actions[st.curClip], to = actions[name];
        if (to) { to.reset(); to.setEffectiveWeight(1); to.fadeIn(0.4); }
        if (from && from !== to) from.fadeOut(0.4);
        st.curClip = name;
      };

      let raf = 0;
      const loop = () => {
        if (dead) return; raf = requestAnimationFrame(loop);
        if (document.hidden) return;
        const dt = st.clock.getDelta();
        st.p += (st.target - st.p) * 0.08;
        const f = st.p * (N - 1), i = clamp(Math.floor(f), 0, N - 2), frac = f - i;
        const A = BEATS[i], Bm = BEATS[i + 1];
        const beat = Math.round(f);
        auraRef.current = mix(A.accent, Bm.accent, frac);
        setClip(BEATS[beat].clip);
        // camera
        const d = lerp(A.cam.d, Bm.cam.d, frac), camY = lerp(A.cam.y, Bm.cam.y, frac), orbit = lerp(A.cam.orbit, Bm.cam.orbit, frac);
        camera.position.set(Math.sin(orbit) * d, camY + 0.05, Math.cos(orbit) * d);
        camera.lookAt(0, camY, 0);
        mixer.update(dt);
        const arr = aura.geometry.attributes.position.array; for (let k = 0; k < NP; k++) { arr[k*3+1]+=spd[k]; if (arr[k*3+1]>2.3) arr[k*3+1]=0; } aura.geometry.attributes.position.needsUpdate = true; aura.rotation.y += dt * 0.15;
        renderer.render(scene, camera);
      };
      loop();
      const onResize = () => { const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      window.addEventListener('resize', onResize);
      cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); renderer.domElement.remove(); try { renderer.dispose(); draco.dispose(); } catch (e) {} };
    })();
    return () => { dead = true; cleanup(); };
  }, [mobile]);

  // ---- scroll → drive 3D + panels ----
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, introStart = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const outer = outerRef.current; if (!outer) return;
      const total = outer.offsetHeight - window.innerHeight;
      const top = outer.getBoundingClientRect().top;
      const cur = clamp(-top / (total || 1), 0, 1);
      ctrlRef.current.setProgress(cur);
      const intro = 1 - Math.pow(1 - clamp((now - introStart) / 1300, 0, 1), 3);
      if (stageRef.current) stageRef.current.style.opacity = intro.toFixed(3);
      const accent = auraRef.current;
      if (spotRef.current) spotRef.current.style.background = `radial-gradient(circle at 50% 44%, ${accent}1f 0%, transparent 36%), radial-gradient(circle at 50% 46%, transparent 42%, rgba(4,6,10,.4) 72%, rgba(4,6,10,.9) 100%)`;
      const f = cur * (N - 1);
      panelRefs.current.forEach((el, k) => { if (!el) return; const d = f - k; const op = clamp(1 - Math.abs(d) * 1.7, 0, 1); el.style.opacity = (op * intro).toFixed(3); el.style.transform = `translateY(${(d * (mobile ? 16 : 26)).toFixed(1)}px)`; el.style.pointerEvents = op > 0.6 ? 'auto' : 'none'; el.dataset.active = op > 0.75 ? '1' : '0'; });
      dotRefs.current.forEach((el, k) => { if (el) el.style.opacity = (Math.round(f) === k ? '1' : '0.3'); });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mobile]);

  if (reduced()) return <Stacked onStart={onStart} />;

  return (
    <section ref={outerRef} style={{ position: 'relative', height: `${N * 100}vh` }}>
      <div ref={stageRef} style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', opacity: 0 }}>
        <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }} />
        <div ref={spotRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {BEATS.map((bt, k) => {
          const pos = mobile ? { left: 0, right: 0, bottom: '6%', textAlign: 'center', alignItems: 'center', padding: '0 22px' }
            : bt.side === 'left' ? { left: 0, top: 0, bottom: 0, textAlign: 'left', alignItems: 'flex-start' }
            : bt.side === 'right' ? { right: 0, top: 0, bottom: 0, textAlign: 'right', alignItems: 'flex-end' }
            : { left: '50%', top: 0, bottom: 0, transform: 'translateX(-50%)', textAlign: 'center', alignItems: 'center' };
          return (
            <div key={k} ref={(el) => (panelRefs.current[k] = el)} className="gt-panel" data-active="0"
              style={{ position: 'absolute', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: mobile ? '0 22px' : '0 7vw', maxWidth: mobile ? 'none' : 520, opacity: 0, willChange: 'opacity,transform', ...pos }}>
              <p className="gt-eyebrow" style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 12, letterSpacing: '.3em', textTransform: 'uppercase', color: bt.accent, marginBottom: 14 }}>{bt.eyebrow}</p>
              <h2 className="display gt-title" style={{ fontWeight: 700, fontSize: mobile ? 'clamp(28px,8vw,40px)' : 'clamp(34px,5vw,64px)', lineHeight: 1.04, letterSpacing: '-.03em', marginBottom: 14, textShadow: '0 4px 40px rgba(0,0,0,.85)' }}>{bt.title}</h2>
              <p className="gt-body" style={{ color: '#dbe3f0', fontSize: mobile ? 15 : 'clamp(15px,1.4vw,18px)', lineHeight: 1.6, maxWidth: 430, textShadow: '0 2px 24px rgba(0,0,0,.95)' }}>{bt.body}</p>
              {bt.ring && <Ring value={bt.ring} accent={bt.accent} />}
              {bt.cta && (
                <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: mobile ? 'center' : 'flex-start', alignItems: 'center' }}>
                  <button className="btn primary lp-cta" onClick={onStart} style={{ padding: '15px 30px', fontSize: 15 }}>Build your Twin</button>
                  <button onClick={onStart} style={{ background: 'none', border: 'none', color: '#9aa6c2', cursor: 'pointer', fontSize: 14 }}>I already have an account →</button>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ position: 'absolute', right: mobile ? 12 : 20, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BEATS.map((_, k) => <div key={k} ref={(el) => (dotRefs.current[k] = el)} style={{ width: 7, height: 7, borderRadius: '50%', background: '#f5b572', opacity: k === 0 ? 1 : 0.3, transition: 'opacity .3s' }} />)}
        </div>
        <div className="gt-hint" aria-hidden style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7d88a6' }}>scroll ↓</div>
      </div>
      <style>{`
        .gt-hint{animation:gtHint 2s ease-in-out infinite}@keyframes gtHint{0%,100%{opacity:.4;transform:translateX(-50%) translateY(0)}50%{opacity:.9;transform:translateX(-50%) translateY(4px)}}
        .gt-panel .gt-title,.gt-panel .gt-eyebrow,.gt-panel .gt-body{transition:transform .7s cubic-bezier(.2,1,.3,1),filter .7s ease,opacity .6s ease}
        .gt-panel[data-active="0"] .gt-title{transform:translateY(26px);filter:blur(8px);opacity:0}
        .gt-panel[data-active="0"] .gt-eyebrow,.gt-panel[data-active="0"] .gt-body{opacity:0;transform:translateY(14px)}
        .gt-panel[data-active="1"] .gt-title,.gt-panel[data-active="1"] .gt-eyebrow,.gt-panel[data-active="1"] .gt-body{transform:none;filter:none;opacity:1}
      `}</style>
    </section>
  );
}

function Ring({ value = 84, accent }) {
  const R = 50, C = 2 * Math.PI * R;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" style={{ marginTop: 18, filter: `drop-shadow(0 0 16px ${accent}66)` }}>
      <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(151,168,205,.16)" strokeWidth="9" />
      <circle cx="64" cy="64" r={R} fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)} transform="rotate(-90 64 64)" />
      <text x="64" y="60" textAnchor="middle" fill="#f2f5fc" style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</text>
      <text x="64" y="82" textAnchor="middle" fill="#8e9ab8" style={{ fontSize: 9, letterSpacing: '.16em', fontFamily: 'var(--font-eyebrow)' }}>READY</text>
    </svg>
  );
}

function Stacked({ onStart }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '90px 24px 60px' }}>
      {BEATS.map((bt, k) => (
        <div key={k} style={{ textAlign: 'center', padding: '36px 0', borderTop: k ? '1px solid rgba(151,168,205,.1)' : 'none' }}>
          <p style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 12, letterSpacing: '.3em', textTransform: 'uppercase', color: bt.accent, marginBottom: 12 }}>{bt.eyebrow}</p>
          <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(26px,5vw,40px)', marginBottom: 10 }}>{bt.title}</h2>
          <p style={{ color: '#cfd8ea', maxWidth: 440, margin: '0 auto' }}>{bt.body}</p>
          {bt.cta && <button className="btn primary" onClick={onStart} style={{ marginTop: 20, padding: '14px 28px' }}>Build your Twin</button>}
        </div>
      ))}
    </div>
  );
}
