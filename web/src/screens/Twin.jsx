// THE TWIN — the emotional center of VarunOS.
// three.js + Ready Player Me GLB, PROCEDURAL skeleton animation (no asset
// pipeline). Muscle growth = bone scaling driven by the deterministic
// avatar_level from the server (30% volume · 20% streaks · 25% PRs · 25%
// consistency). three.js is bundled but loaded lazily with this screen.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, classifyExercise } from '../api.js';
import { CountUp, useToast, stagger, rise } from '../components/ui.jsx';
import { IconBody, IconTrend, IconFlame, IconBolt, IconSparkle } from '../components/Icons.jsx';

const TWIN_DEMO_GLB = 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb';
const ACTIONS = [
  { id: 'idle', label: 'Idle' },
  { id: 'squat', label: 'Squat' },
  { id: 'press', label: 'Press' },
  { id: 'curl', label: 'Curl' },
  { id: 'celebrate', label: 'PR!' },
];

export default function Twin() {
  const toast = useToast();
  const stageRef = useRef(null);
  const twinRef = useRef(null);     // { renderer, scene, camera, rig, rest, root, raf }
  const modeRef = useRef('idle');
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [errMsg, setErrMsg] = useState('');
  const [mode, setMode] = useState('idle');
  const [stats, setStats] = useState(null);
  const [url, setUrl] = useState('');
  const [bootId, setBootId] = useState(0); // bump to retry

  // Mirror the most recent exercise you logged today
  useEffect(() => {
    const lastEx = localStorage.getItem('twin_last_ex');
    if (lastEx) { const m = classifyExercise(lastEx); setMode(m); modeRef.current = m; }
  }, []);

  // Stats render even if the 3D engine can't load.
  useEffect(() => {
    (async () => {
      try { setStats(await api('/v1/avatar/state')); }
      catch (_) { setStats({ unavailable: true }); }
    })();
  }, [bootId]);

  // Boot the 3D scene
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

        scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x182030, 1.2));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(1.5, 3, 2.5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x2ee6a8, 0.85);
        rim.position.set(-2, 1.5, -2);
        scene.add(rim);

        // Spotlight floor disc
        const floor = new THREE.Mesh(
          new THREE.CircleGeometry(1.1, 48),
          new THREE.MeshBasicMaterial({ color: 0x121a2e, transparent: true, opacity: 0.85 }));
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const glbUrl = localStorage.getItem('varunos_avatar_url') || TWIN_DEMO_GLB;
        const gltf = await new GLTFLoader().loadAsync(glbUrl);
        if (dead) { renderer.dispose(); return; }
        const root = gltf.scene;
        scene.add(root);

        const bones = {};
        root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
        const B = (n) => bones[n] || null;
        const rig = {
          hips: B('Hips'), spine: B('Spine'), spine2: B('Spine2') || B('Spine1'),
          neck: B('Neck'), head: B('Head'),
          lArm: B('LeftArm'), rArm: B('RightArm'),
          lFore: B('LeftForeArm'), rFore: B('RightForeArm'),
          lUpLeg: B('LeftUpLeg'), rUpLeg: B('RightUpLeg'),
          lLeg: B('LeftLeg'), rLeg: B('RightLeg'),
          lFoot: B('LeftFoot'), rFoot: B('RightFoot'),
        };
        const rest = {};
        for (const [k, b] of Object.entries(rig))
          if (b) rest[k] = { rot: b.rotation.clone(), pos: b.position.clone() };

        const twin = { renderer, scene, camera, rig, rest, root, t: 0, raf: 0 };
        twinRef.current = twin;

        // Growth: scale bones by avatar_level
        try {
          const st = await api('/v1/avatar/state');
          const g = (st.avatar.level || 0) / 100;
          const arm = 1 + g * 0.45, chest = 1 + g * 0.22, leg = 1 + g * 0.25;
          for (const k of ['lArm', 'rArm']) rig[k] && rig[k].scale.setScalar(arm);
          rig.spine2 && rig.spine2.scale.set(chest, 1 + g * 0.06, chest);
          for (const k of ['lUpLeg', 'rUpLeg']) rig[k] && rig[k].scale.setScalar(leg);
        } catch (_) {}

        const loop = () => {
          twin.raf = requestAnimationFrame(loop);
          twin.t += 0.016;
          const t = twin.t;
          for (const [k, b] of Object.entries(rig)) {
            if (!b || !rest[k]) continue;
            b.rotation.copy(rest[k].rot);
            b.position.copy(rest[k].pos);
          }
          const breathe = Math.sin(t * 1.8) * 0.5 + 0.5;
          if (rig.spine2) rig.spine2.rotation.x += breathe * 0.025;
          const m = modeRef.current;
          if (m === 'squat') {
            const d = (1 - Math.cos(t * 2.4)) / 2;
            if (rig.hips) rig.hips.position.y -= d * 0.34;
            for (const k of ['lUpLeg', 'rUpLeg']) rig[k] && (rig[k].rotation.x += -d * 1.25);
            for (const k of ['lLeg', 'rLeg']) rig[k] && (rig[k].rotation.x += d * 1.85);
            for (const k of ['lFoot', 'rFoot']) rig[k] && (rig[k].rotation.x += -d * 0.6);
            for (const k of ['lArm', 'rArm']) rig[k] && (rig[k].rotation.x += -d * 1.15);
            if (rig.spine) rig.spine.rotation.x += d * 0.3;
          } else if (m === 'press') {
            const d = (1 - Math.cos(t * 2.6)) / 2;
            for (const k of ['lArm', 'rArm']) rig[k] && (rig[k].rotation.x += -1.1 - d * 1.4);
            for (const k of ['lFore', 'rFore']) rig[k] && (rig[k].rotation.x += -(1 - d) * 1.5);
            if (rig.spine2) rig.spine2.rotation.x += -d * 0.06;
          } else if (m === 'curl') {
            const d = (1 - Math.cos(t * 3.0)) / 2;
            for (const k of ['lFore', 'rFore']) rig[k] && (rig[k].rotation.x += -d * 2.0);
            for (const k of ['lArm', 'rArm']) rig[k] && (rig[k].rotation.x += -0.15);
          } else if (m === 'celebrate') {
            const hop = Math.abs(Math.sin(t * 5));
            if (rig.hips) rig.hips.position.y += hop * 0.07;
            for (const k of ['lArm', 'rArm']) {
              if (!rig[k]) continue;
              rig[k].rotation.x += -2.6;
              rig[k].rotation.z += (k === 'lArm' ? -0.4 : 0.4) * (0.7 + 0.3 * Math.sin(t * 5));
            }
            if (rig.head) rig.head.rotation.z += Math.sin(t * 5) * 0.08;
          } else {
            for (const k of ['lArm', 'rArm']) rig[k] && (rig[k].rotation.z += (k === 'lArm' ? -1 : 1) * Math.sin(t * 1.8) * 0.02);
          }
          root.rotation.y = Math.sin(t * 0.25) * 0.22;
          renderer.render(scene, camera);
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
        twin.renderer.dispose();
        twin.renderer.domElement?.remove();
        twinRef.current = null;
      }
    };
  }, [bootId]);

  function setAction(m) {
    setMode(m);
    modeRef.current = m;
  }

  function saveUrl() {
    const u = url.trim();
    if (!u.endsWith('.glb')) { toast('That should be a .glb link from readyplayer.me'); return; }
    localStorage.setItem('varunos_avatar_url', u);
    api('/v1/user/profile', { method: 'PUT', body: { avatar_url: u } }).catch(() => {});
    toast('✓ Avatar saved — reloading your Twin');
    setBootId((b) => b + 1);
  }

  const usingOwn = !!localStorage.getItem('varunos_avatar_url');
  const lvl = stats?.avatar?.level ?? 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} style={{ margin: '26px 0 18px' }}>
        <h2 className="display" style={{ fontSize: 30, fontWeight: 700 }}>Your Twin</h2>
        <p className="meta">Trains when you train. Grows when you grow.</p>
      </motion.div>

      {/* 3D stage */}
      <motion.div variants={rise} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        <div ref={stageRef} key={bootId} style={{
          width: '100%', height: 420,
          background: 'radial-gradient(ellipse at 50% 28%, #111a30 0%, #06080d 78%)',
        }} />
        {/* HUD badge */}
        {phase === 'ready' && stats?.avatar && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{
              position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(8,11,18,0.7)', border: '1px solid var(--line)', borderRadius: 999,
              padding: '6px 13px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            }}>
            <span style={{ color: 'var(--mint)' }}><IconBody width={14} height={14} /></span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)' }}>LV {lvl}</span>
            <span style={{ fontSize: 11, color: 'var(--dim)' }}>{stats.avatar.label}</span>
          </motion.div>
        )}
        {phase === 'ready' && !usingOwn && (
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'var(--mute)' }}>
            Demo avatar — make it you below
          </div>
        )}
        {/* loading state */}
        <AnimatePresence>
          {phase === 'loading' && (
            <motion.div exit={{ opacity: 0 }} style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <motion.div
                animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ color: 'var(--mint)' }}>
                <IconBody width={52} height={52} strokeWidth={1.2} />
              </motion.div>
              <div style={{ width: 120, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <motion.div
                  animate={{ x: [-120, 120] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: 60, height: '100%', background: 'var(--mint)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>Waking your Twin…</span>
            </motion.div>
          )}
        </AnimatePresence>
        {/* error state */}
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
      </motion.div>

      {/* action pills */}
      <motion.div variants={rise} style={{
        display: 'flex', gap: 6, margin: '12px 0', background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 16, padding: 5,
      }}>
        {ACTIONS.map((a) => {
          const active = mode === a.id;
          return (
            <button key={a.id} onClick={() => setAction(a.id)} style={{
              position: 'relative', flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 4px', borderRadius: 12, fontSize: 13, fontWeight: 650,
              fontFamily: 'var(--font-display)',
              color: active ? '#04150e' : 'var(--dim)', transition: 'color 0.18s',
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

      {/* growth panel */}
      <motion.div variants={rise} className="card" style={{ padding: 20 }}>
        {!stats && <div className="skel" style={{ height: 60 }} />}
        {stats?.unavailable && <p className="meta">Stats unavailable — log workouts to grow your Twin.</p>}
        {stats?.avatar && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <h3 className="display" style={{ fontSize: 17, fontWeight: 700 }}>Level {lvl}</h3>
              <span className="meta">{stats.avatar.label}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 7, overflow: 'hidden', marginBottom: 16 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${lvl}%` }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                style={{ height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, var(--mint), var(--cyan))' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <GrowthStat Icon={IconTrend}
                value={<><CountUp value={Math.abs(stats.volume_trend_pct_per_week)} decimals={1} />%</>}
                sign={stats.volume_trend_pct_per_week >= 0 ? '+' : '−'}
                tone={stats.volume_trend_pct_per_week >= 0 ? 'var(--green)' : 'var(--red)'}
                label="Volume / wk" />
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
      <motion.div variants={rise} className="card" style={{ padding: 20 }}>
        <h3 className="display" style={{ fontSize: 15, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--mint)' }}><IconSparkle width={16} height={16} /></span>
          Make it actually you
        </h3>
        <p className="meta" style={{ marginBottom: 12 }}>
          Create a look-alike from a selfie at{' '}
          <a href="https://readyplayer.me/avatar" target="_blank" rel="noreferrer" style={{ color: 'var(--mint)' }}>readyplayer.me</a>{' '}
          (free, 2 min), copy the <b>.glb link</b>, paste it here.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://models.readyplayer.me/….glb" style={{ flex: 1, fontSize: 13 }} />
          <button className="btn primary" onClick={saveUrl}>Use it</button>
        </div>
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
