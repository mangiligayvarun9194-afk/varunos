// Coach-Replay review panel — shown after a recorded set. Plays back the captured 3D
// skeleton (rotatable, so you can see depth the single live camera angle couldn't),
// scrubs frame-by-frame, and lists a score for every rep (worst one flagged). This is
// the payoff of grading in 3D off-line: review + an honest per-rep verdict for lifts
// the live side-on coach can't judge.
//
// "Enhance in 3D (cloud)" (Phase D v2) sends the clip to the server for heavier,
// zero-lag biomechanical refinement (occlusion in-painting + peak-preserving smoothing
// + bone-length clamping), then RE-GRADES the refined clip locally — so the same
// gradeRecording path scores both the on-device and the cloud-refined versions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { gradeRecording } from '../lib/replaygrade.js';
import { api } from '../api.js';
import { IconBody, IconBolt } from '../components/Icons.jsx';

// BlazePose skeleton edges (same set the live coach draws).
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [27, 29], [28, 30],
];

const ACCENT = '#f5b572';
const repColor = (r) => (r.type === 'good' ? 'var(--green)' : 'var(--amber)');

export default function CoachReplay({ result, skeletons, frames, exId, exLabel, logging, onLog, onDone }) {
  // The displayed clip — starts on-device, swapped for the cloud-refined one on enhance.
  const [view, setView] = useState({ result, skeletons, frames });
  const [idx, setIdx] = useState(0);
  const [yawDeg, setYawDeg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [enhanceErr, setEnhanceErr] = useState('');
  const baseAvg = useRef(result.avgScore);
  const canvasRef = useRef(null);

  const R = view.result;
  const SK = view.skeletons;
  const N = SK.length;

  // Stable framing: bounding box over the whole clip so the skeleton doesn't jump.
  const bbox = useMemo(() => {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const sk of SK) for (const p of sk) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    if (!isFinite(minX)) { minX = -0.5; maxX = 0.5; minY = -0.5; maxY = 0.5; }
    return { minX, maxX, minY, maxY, h: Math.max(0.5, maxY - minY) };
  }, [SK]);

  // Which rep contains the current frame (for highlighting + the readout).
  const curRep = useMemo(() => {
    const t = view.frames[idx] ? view.frames[idx].t : 0;
    return R.reps.findIndex((r) => t >= r.tStart && t <= r.tEnd);
  }, [idx, view.frames, R.reps]);

  const timeToIdx = (t) => {
    for (let i = 0; i < view.frames.length; i++) if (view.frames[i].t >= t) return i;
    return Math.max(0, view.frames.length - 1);
  };

  // Playback at ~20fps (the capture rate); loops.
  useEffect(() => {
    if (!playing || N === 0) return;
    const h = setInterval(() => setIdx((i) => (i + 1) % N), 50);
    return () => clearInterval(h);
  }, [playing, N]);

  // Render the current frame.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || N === 0) return;
    const w = cv.width, h = cv.height;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    const sk = SK[Math.min(idx, N - 1)];
    if (!sk) return;
    const yaw = (yawDeg * Math.PI) / 180;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const scale = (h * 0.74) / bbox.h;
    const midX = (bbox.minX + bbox.maxX) / 2, midY = (bbox.minY + bbox.maxY) / 2;
    const proj = (p) => {
      const x = (p.x - midX) * cosY - (p.z) * sinY;   // rotate about the vertical axis
      return { X: w / 2 + x * scale, Y: h / 2 + (p.y - midY) * scale };
    };
    g.lineWidth = Math.max(3, w / 130);
    g.strokeStyle = ACCENT; g.shadowColor = ACCENT; g.shadowBlur = 12;
    for (const [a, b] of BONES) {
      const pa = sk[a], pb = sk[b];
      if (!pa || !pb) continue;
      const A = proj(pa), B = proj(pb);
      g.beginPath(); g.moveTo(A.X, A.Y); g.lineTo(B.X, B.Y); g.stroke();
    }
    g.shadowBlur = 0; g.fillStyle = '#eaf2ff';
    for (const p of sk) { const P = proj(p); g.beginPath(); g.arc(P.X, P.Y, Math.max(3, w / 170), 0, Math.PI * 2); g.fill(); }
  }, [idx, yawDeg, bbox, SK, N]);

  const jumpToRep = (i) => { setPlaying(false); setIdx(timeToIdx(R.reps[i].tStart)); };

  async function enhance() {
    setEnhancing(true); setEnhanceErr('');
    try {
      const skel = view.skeletons.map((fr) => fr.map((p) => [p.x, p.y, p.z]));
      const resp = await api('/v1/coach/refine', { method: 'POST', body: {
        exId, frames: view.frames.map((f) => ({ t: f.t, raw: f.raw, conf: f.conf })), skel,
      } });
      const frames2 = view.frames.map((f, i) => ({ t: f.t, raw: resp.raw[i], conf: resp.conf[i] }));
      const skeletons2 = resp.skel ? resp.skel.map((fr) => fr.map((a) => ({ x: a[0], y: a[1], z: a[2] }))) : view.skeletons;
      const result2 = gradeRecording(frames2, exId);
      setView({ result: result2, skeletons: skeletons2, frames: frames2 });
      setIdx(0); setEnhanced(true);
    } catch (_) {
      setEnhanceErr('Couldn’t reach the cloud refiner — showing the on-device grade.');
    }
    setEnhancing(false);
  }

  const empty = R.reps.length === 0;
  const delta = enhanced && baseAvg.current != null ? R.avgScore - baseAvg.current : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* header summary */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h3 className="display" style={{ fontSize: 20, fontWeight: 700 }}>3D Replay · {exLabel}</h3>
        {!empty && <span className="meta" style={{ fontSize: 13 }}>{R.reps.length} reps · {R.goodReps} clean</span>}
        {enhanced && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)' }}>✨ Cloud-enhanced</span>}
      </div>

      {empty ? (
        <div className="card" style={{ padding: 18, textAlign: 'center' }}>
          <p style={{ fontSize: 14 }}>No full reps were captured in that recording. Make sure your whole body is in frame and try again.</p>
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={onDone}>Done</button>
        </div>
      ) : (
        <>
          {/* 3D stage */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', maxHeight: '52vh', background: '#04060b', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <canvas ref={canvasRef} width={480} height={640} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '8px 14px', textAlign: 'center' }}>
              <div className="display" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: R.avgScore >= 80 ? 'var(--mint)' : 'var(--amber)' }}>{R.avgScore}</div>
              <div className="meta" style={{ fontSize: 10 }}>avg form{delta != null && delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}</div>
            </div>
            {curRep >= 0 && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '6px 10px', fontSize: 12, color: 'var(--dim)' }}>
                rep {curRep + 1} · form {R.reps[curRep].score}
              </div>
            )}
          </div>

          {/* transport */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button className="btn ghost" style={{ padding: '6px 12px', flex: '0 0 auto' }} onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
            <input type="range" className="vslider" min={0} max={Math.max(0, N - 1)} value={idx}
              onChange={(e) => { setPlaying(false); setIdx(+e.target.value); }} style={{ flex: 1 }} aria-label="Scrub replay" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span className="meta" style={{ fontSize: 11, flex: '0 0 auto' }}>Rotate</span>
            <input type="range" className="vslider" min={-180} max={180} value={yawDeg}
              onChange={(e) => setYawDeg(+e.target.value)} style={{ flex: 1 }} aria-label="Rotate skeleton" />
          </div>

          {/* cloud enhance */}
          {!enhanced && (
            <button className="btn ghost" style={{ width: '100%', marginTop: 10, fontSize: 13 }} disabled={enhancing} onClick={enhance}>
              {enhancing ? 'Refining in 3D…' : '✨ Enhance in 3D (cloud) — cleaner angles for occluded reps'}
            </button>
          )}
          {enhanceErr && <p className="meta" style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>{enhanceErr}</p>}

          {/* low-confidence (occlusion) honesty banner */}
          {R.lowConfidence && (
            <div className="card" style={{ marginTop: 10, padding: '10px 13px', border: '1px solid var(--amber)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--amber)', flexShrink: 0 }}><IconBolt width={15} height={15} /></span>
              <p style={{ fontSize: 12, lineHeight: 1.5 }}>Parts of this set were occluded — those angles were reconstructed in 3D, so treat the score as approximate.{!enhanced ? ' Try “Enhance in 3D” for a cleaner pass.' : ''}</p>
            </div>
          )}

          {/* per-rep chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {R.reps.map((r, i) => (
              <button key={i} onClick={() => jumpToRep(i)} className="btn ghost"
                style={{ padding: '7px 11px', fontSize: 12, flex: '0 0 auto', borderRadius: 12,
                  border: `1px solid ${i === R.worstIdx ? 'var(--amber)' : i === curRep ? 'var(--mint)' : 'var(--line)'}`,
                  color: repColor(r) }}>
                #{i + 1} · {r.score}{r.tags && r.tags.length ? ' ⚠' : ''}
              </button>
            ))}
          </div>
          {R.worstIdx >= 0 && R.reps[R.worstIdx].tags.length > 0 && (
            <p className="meta" style={{ fontSize: 12, marginTop: 8 }}>
              Weakest rep (#{R.worstIdx + 1}): {R.reps[R.worstIdx].tags.join(' · ')}
            </p>
          )}

          {/* actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn primary" style={{ flex: 1 }} disabled={logging} onClick={() => onLog(R.reps.length)}>
              <IconBody width={16} height={16} /> {logging ? 'Logging…' : `Log ${R.reps.length} reps → grow Twin`}
            </button>
            <button className="btn ghost" style={{ flex: '0 0 auto' }} onClick={onDone}>Done</button>
          </div>
        </>
      )}
    </motion.div>
  );
}
