// Form Coach — the camera "form mirror". Points your phone/webcam at you, runs
// MediaPipe Pose 100% ON-DEVICE (video never leaves the browser), counts reps
// and judges depth/form in real time using the deterministic RepEngine.
//
// MediaPipe is lazy-loaded from a CDN only when the coach starts, so it never
// bloats the main bundle or the rest of the app. Everything degrades to a clear
// message if the camera or model can't load.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EXERCISES, RepEngine, LOG_MAP, estimateLoad } from '../lib/formcoach.js';
import { detect as detectMuscle, MUSCLE_LABEL } from '../lib/musclenet.js';
import MUSCLE_MODEL from '../lib/muscle_model.json';
import { api, getProfile } from '../api.js';
import { useToast } from '../components/ui.jsx';
import { Skeleton } from '../components/kit.jsx';
import { IconBack, IconBolt, IconShield, IconBody } from '../components/Icons.jsx';

const TASKS_VERSION = '0.10.18';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// BlazePose skeleton edges to draw (index pairs).
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30],
];

const EX_LIST = Object.values(EXERCISES);

export default function FormCoach({ onTab }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(new RepEngine('squat'));
  const markerRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);

  const [exId, setExId] = useState('squat');
  const [status, setStatus] = useState('idle'); // idle | loading | running | error
  const [err, setErr] = useState('');
  const [hud, setHud] = useState({ reps: 0, goodReps: 0, phase: 'up', angle: null, valid: false });
  const [flash, setFlash] = useState(null);
  const [guide, setGuide] = useState(null);   // "step into frame" coaching
  const [logged, setLogged] = useState(null); // confirmation after logging a set
  const [logging, setLogging] = useState(false);
  const [muscle, setMuscle] = useState(null);   // live AI muscle detection
  const lastRef = useRef({ hud: '', guide: '', frame: 0, muscle: '' });
  const toast = useToast();

  const ex = EXERCISES[exId];

  // Switching exercise resets the set.
  useEffect(() => {
    engineRef.current.set(exId);
    setHud({ reps: 0, goodReps: 0, phase: 'up', angle: null, valid: false });
    setFlash(null); setGuide(null); setLogged(null); setMuscle(null);
    lastRef.current = { hud: '', guide: '', frame: 0, muscle: '' };
  }, [exId]);

  // The unique loop: camera-coached reps → a real logged set → the Twin grows
  // and Hermes notices. Bodyweight load is estimated from the user's bodyweight.
  async function logSession() {
    const m = LOG_MAP[exId];
    if (!m || hud.reps < 1 || logging) return;
    setLogging(true);
    const load = estimateLoad(exId, getProfile().weight_kg);
    try {
      await api('/v1/logs/workouts', { method: 'POST', body: {
        program: 'form-coach', day_name: `${ex.label} (Form Coach)`,
        week: 0, day_index: 0, decision: 'GREEN',
        notes: 'Logged from the camera Form Coach',
        total_volume_kg: load * hud.reps,
        sets: [{ exercise_id: m.logId, set_index: 0, weight_kg: load, reps: hud.reps }],
      }});
      teardown(); setStatus('idle');
      setLogged({ reps: hud.reps, group: m.group, load });
      toast('Logged — your Twin just grew 💪');
    } catch (_) {
      toast('Couldn’t log that set — try again.');
    }
    setLogging(false);
  }

  function coachAnother() {
    engineRef.current.set(exId);
    setHud({ reps: 0, goodReps: 0, phase: 'up', angle: null, valid: false });
    setLogged(null); lastRef.current = { hud: '', guide: '' };
    start();
  }

  // Auto-clear the feedback banner.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  // Clean up camera + RAF on unmount.
  useEffect(() => () => teardown(), []);

  function teardown() {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function start() {
    setStatus('loading');
    setErr('');
    try {
      const vision = await import(/* @vite-ignore */ CDN);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      markerRef.current = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play();
      setStatus('running');
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      teardown();
      setStatus('error');
      const name = String((e && e.name) || '') + String(e || '');
      setErr(/NotAllowed|Permission|denied/i.test(name)
        ? 'Camera permission was blocked. Allow camera access for this site, then retry.'
        : 'Couldn’t start the coach — the pose model or camera failed to load. Check your connection and retry.');
    }
  }

  function stop() {
    teardown();
    setStatus('idle');
    setMuscle(null); setGuide(null);
  }

  function loop() {
    const v = videoRef.current;
    const marker = markerRef.current;
    if (!v || !marker) return;
    if (v.readyState >= 2) {
      const now = performance.now();
      let res = null;
      try { res = marker.detectForVideo(v, now); } catch (_) {}
      const pts = res && res.landmarks && res.landmarks[0];
      const r = engineRef.current.update(pts, now);
      draw(pts, r);
      if (r) {
        // Throttle React state to only fire when something actually changes.
        const key = `${r.reps}|${r.goodReps}|${r.phase}|${r.angle}|${r.valid}`;
        if (key !== lastRef.current.hud) {
          lastRef.current.hud = key;
          setHud({ reps: r.reps, goodReps: r.goodReps, phase: r.phase, angle: r.angle, valid: r.valid });
        }
        const g = r.valid ? null : guideFor(r.reason);
        if (g !== lastRef.current.guide) { lastRef.current.guide = g; setGuide(g); }
        if (r.event) setFlash(r.event);

        // Live AI muscle detection (throttled ~6fps) — independent of the rep engine.
        lastRef.current.frame = (lastRef.current.frame + 1) % 5;
        if (pts && lastRef.current.frame === 0) {
          const d = detectMuscle(MUSCLE_MODEL, pts);
          const key = d && d.confidence > 0.6 ? `${d.label}` : '';
          if (key !== lastRef.current.muscle) {
            lastRef.current.muscle = key;
            setMuscle(key ? { label: d.label, confidence: d.confidence } : null);
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function guideFor(reason) {
    if (reason === 'out-of-frame') return 'Move back — keep your whole body in frame';
    return 'Step into frame so your full body is visible';
  }

  function draw(pts, r) {
    const cv = canvasRef.current;
    const v = videoRef.current;
    if (!cv || !v) return;
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (!pts) return;
    // Red when the pose isn't trackable (not counting), else phase-tinted.
    const valid = r ? r.valid : true;
    const phase = engineRef.current.phase;
    const col = !valid ? '#f87171' : phase === 'down' ? '#4cc9f0' : '#f5b572';
    // bones
    g.lineWidth = Math.max(3, w / 160);
    g.strokeStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 12;
    for (const [a, b] of BONES) {
      const pa = pts[a], pb = pts[b];
      if (!pa || !pb) continue;
      if ((pa.visibility ?? 1) < 0.3 || (pb.visibility ?? 1) < 0.3) continue;
      g.beginPath();
      g.moveTo(pa.x * w, pa.y * h);
      g.lineTo(pb.x * w, pb.y * h);
      g.stroke();
    }
    // joints
    g.shadowBlur = 0;
    g.fillStyle = '#eaf2ff';
    for (const p of pts) {
      if ((p.visibility ?? 1) < 0.3) continue;
      g.beginPath();
      g.arc(p.x * w, p.y * h, Math.max(3, w / 200), 0, Math.PI * 2);
      g.fill();
    }
  }

  const accuracy = hud.reps ? Math.round((hud.goodReps / hud.reps) * 100) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '26px 0 14px' }}>
        <button className="btn ghost" style={{ padding: '6px 10px' }} onClick={() => onTab && onTab('library')} aria-label="Back">
          <IconBack width={18} height={18} />
        </button>
        <div>
          <h2 className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>Form Coach</h2>
          <p className="meta">Live rep counting & form feedback — on your device</p>
        </div>
      </div>

      {/* exercise picker */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {EX_LIST.map((e) => (
          <button key={e.id} className={`btn ${exId === e.id ? 'primary' : 'ghost'}`}
            style={{ flex: '0 0 auto', padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }} onClick={() => setExId(e.id)}>{e.label}</button>
        ))}
      </div>

      {/* camera stage */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '3/4', maxHeight: '58vh',
        background: '#04060b', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--line)',
      }}>
        <video ref={videoRef} playsInline muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />

        {/* HUD overlay */}
        {status === 'running' && (
          <>
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '8px 14px', textAlign: 'center' }}>
                <div className="display" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: 'var(--mint)' }}>{hud.reps}</div>
                <div className="meta" style={{ fontSize: 10 }}>reps</div>
              </div>
              {accuracy != null && (
                <div style={{ background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '8px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: accuracy >= 80 ? 'var(--green)' : 'var(--amber)' }}>{accuracy}%</div>
                  <div className="meta" style={{ fontSize: 10 }}>good form</div>
                </div>
              )}
            </div>
            {hud.valid && hud.angle != null && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '6px 10px', fontSize: 12, color: 'var(--dim)' }}>
                {hud.angle}° · {hud.phase === 'down' ? 'lowering' : 'ready'}
              </div>
            )}
            {/* live on-device AI muscle detection */}
            {muscle && (
              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>🦾</span>
                <span style={{ color: muscle.label === 'rest' ? 'var(--mute)' : 'var(--cyan)', fontWeight: 600 }}>
                  {MUSCLE_LABEL[muscle.label] || muscle.label}
                </span>
                <span style={{ color: 'var(--mute)', fontSize: 10 }}>{Math.round(muscle.confidence * 100)}%</span>
              </div>
            )}
            {/* live "get in frame" guidance — shown while the pose can't be tracked */}
            <AnimatePresence>
              {guide && (
                <motion.div key={guide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center',
                    background: 'rgba(4,6,11,0.7)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '12px 18px',
                    color: '#fca5a5', fontSize: 14, fontWeight: 600, maxWidth: '80%' }}>
                  {guide}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {flash && (
                <motion.div key={flash.msg + hud.reps} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                  style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                    background: flash.type === 'good' ? 'rgba(245,181,114,0.95)' : 'rgba(245,176,66,0.95)',
                    color: '#1a0f06', fontWeight: 800, fontSize: 15, padding: '10px 20px', borderRadius: 999 }}>
                  {flash.type === 'good' ? '✓ ' : '↓ '}{flash.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* idle / loading / error states */}
        {status !== 'running' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
            {status === 'loading' && (
              <>
                <Skeleton width={54} height={54} radius="50%" />
                <p className="meta">Loading the pose model…</p>
              </>
            )}
            {status === 'error' && (
              <>
                <span style={{ color: 'var(--amber)' }}><IconShield width={30} height={30} /></span>
                <p style={{ fontSize: 14, maxWidth: 320 }}>{err}</p>
                <button className="btn primary" onClick={start}>Retry</button>
              </>
            )}
            {status === 'idle' && (
              <>
                <span style={{ color: 'var(--mint)' }}><IconBolt width={34} height={34} /></span>
                <p style={{ fontSize: 14, maxWidth: 300, lineHeight: 1.5 }}>{ex.setup}</p>
                <button className="btn primary" style={{ padding: '12px 28px', fontSize: 15 }} onClick={start}>Start coaching</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* live cue + controls */}
      <div className="card" style={{ marginTop: 12, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--mint)', flexShrink: 0 }}><IconBolt width={16} height={16} /></span>
        <p style={{ fontSize: 13, lineHeight: 1.5, flex: 1 }}>{ex.cue}</p>
      </div>

      {/* the camera → log → Twin-growth loop */}
      {logged ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="card" style={{ marginTop: 10, padding: 16, textAlign: 'center', border: '1px solid var(--mint)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            ✓ Logged {logged.reps} {ex.label.toLowerCase()} reps
          </div>
          <p className="meta" style={{ margin: '4px 0 12px' }}>
            Your Twin’s <b style={{ color: 'var(--mint)' }}>{logged.group}</b> grew · Hermes will notice next briefing.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => onTab && onTab('twin')}>
              <IconBody width={16} height={16} /> See your Twin
            </button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={coachAnother}>Coach another set</button>
          </div>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {hud.reps > 0 && (
            <button className="btn primary" style={{ flex: 1 }} disabled={logging} onClick={logSession}>
              <IconBody width={16} height={16} /> {logging ? 'Logging…' : `Log ${hud.reps} reps → grow Twin`}
            </button>
          )}
          {status === 'running' && (
            <button className="btn ghost" style={{ flex: hud.reps > 0 ? '0 0 auto' : 1 }} onClick={stop}>End</button>
          )}
        </div>
      )}

      <p className="meta" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 14, fontSize: 11 }}>
        <IconShield width={13} height={13} /> Pose + AI muscle detection run entirely on your device. Your camera feed never leaves this phone.
      </p>
    </motion.div>
  );
}
