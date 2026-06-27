// Coach-Replay review panel — shown after a recorded set. Plays back the captured 3D
// skeleton (rotatable, so you can see depth the single live camera angle couldn't),
// scrubs frame-by-frame, and lists a score for every rep (worst one flagged). This is
// the payoff of grading in 3D off-line: review + an honest per-rep verdict for lifts
// the live side-on coach can't judge.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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

export default function CoachReplay({ result, skeletons, frames, exLabel, onLog, logging, onDone }) {
  const N = skeletons.length;
  const [idx, setIdx] = useState(0);
  const [yawDeg, setYawDeg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef(null);

  // Stable framing: bounding box over the whole clip so the skeleton doesn't jump.
  const bbox = useMemo(() => {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const sk of skeletons) for (const p of sk) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    if (!isFinite(minX)) { minX = -0.5; maxX = 0.5; minY = -0.5; maxY = 0.5; }
    return { minX, maxX, minY, maxY, h: Math.max(0.5, maxY - minY) };
  }, [skeletons]);

  // Which rep contains the current frame (for highlighting + the readout).
  const curRep = useMemo(() => {
    const t = frames[idx] ? frames[idx].t : 0;
    return result.reps.findIndex((r) => t >= r.tStart && t <= r.tEnd);
  }, [idx, frames, result.reps]);

  const timeToIdx = (t) => {
    for (let i = 0; i < frames.length; i++) if (frames[i].t >= t) return i;
    return Math.max(0, frames.length - 1);
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
    const sk = skeletons[Math.min(idx, N - 1)];
    if (!sk) return;
    const yaw = (yawDeg * Math.PI) / 180;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const scale = (h * 0.74) / bbox.h;
    const midX = (bbox.minX + bbox.maxX) / 2, midY = (bbox.minY + bbox.maxY) / 2;
    const proj = (p) => {
      const x = (p.x - midX) * cosY - (p.z) * sinY;   // rotate about vertical axis
      return { X: w / 2 + x * scale, Y: h / 2 + (p.y - midY) * scale };
    };
    // bones
    g.lineWidth = Math.max(3, w / 130);
    g.strokeStyle = ACCENT; g.shadowColor = ACCENT; g.shadowBlur = 12;
    for (const [a, b] of BONES) {
      const pa = sk[a], pb = sk[b];
      if (!pa || !pb) continue;
      const A = proj(pa), B = proj(pb);
      g.beginPath(); g.moveTo(A.X, A.Y); g.lineTo(B.X, B.Y); g.stroke();
    }
    // joints
    g.shadowBlur = 0; g.fillStyle = '#eaf2ff';
    for (const p of sk) { const P = proj(p); g.beginPath(); g.arc(P.X, P.Y, Math.max(3, w / 170), 0, Math.PI * 2); g.fill(); }
  }, [idx, yawDeg, bbox, skeletons, N]);

  const jumpToRep = (i) => { setPlaying(false); setIdx(timeToIdx(result.reps[i].tStart)); };
  const empty = result.reps.length === 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* header summary */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h3 className="display" style={{ fontSize: 20, fontWeight: 700 }}>3D Replay · {exLabel}</h3>
        {!empty && <span className="meta" style={{ fontSize: 13 }}>{result.reps.length} reps · {result.goodReps} clean</span>}
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
            {/* avg form badge */}
            <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '8px 14px', textAlign: 'center' }}>
              <div className="display" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: result.avgScore >= 80 ? 'var(--mint)' : 'var(--amber)' }}>{result.avgScore}</div>
              <div className="meta" style={{ fontSize: 10 }}>avg form</div>
            </div>
            {curRep >= 0 && (
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(4,6,11,0.6)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '6px 10px', fontSize: 12, color: 'var(--dim)' }}>
                rep {curRep + 1} · form {result.reps[curRep].score}
              </div>
            )}
          </div>

          {/* transport: play/pause + frame scrubber */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button className="btn ghost" style={{ padding: '6px 12px', flex: '0 0 auto' }} onClick={() => setPlaying((p) => !p)}>
              {playing ? '⏸' : '▶'}
            </button>
            <input type="range" className="vslider" min={0} max={Math.max(0, N - 1)} value={idx}
              onChange={(e) => { setPlaying(false); setIdx(+e.target.value); }} style={{ flex: 1 }} aria-label="Scrub replay" />
          </div>

          {/* rotate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span className="meta" style={{ fontSize: 11, flex: '0 0 auto' }}>Rotate</span>
            <input type="range" className="vslider" min={-180} max={180} value={yawDeg}
              onChange={(e) => setYawDeg(+e.target.value)} style={{ flex: 1 }} aria-label="Rotate skeleton" />
          </div>

          {/* low-confidence (occlusion) honesty banner */}
          {result.lowConfidence && (
            <div className="card" style={{ marginTop: 10, padding: '10px 13px', border: '1px solid var(--amber)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--amber)', flexShrink: 0 }}><IconBolt width={15} height={15} /></span>
              <p style={{ fontSize: 12, lineHeight: 1.5 }}>Parts of this set were occluded — those angles were reconstructed in 3D, so treat the score as approximate.</p>
            </div>
          )}

          {/* per-rep chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {result.reps.map((r, i) => (
              <button key={i} onClick={() => jumpToRep(i)}
                className="btn ghost"
                style={{ padding: '7px 11px', fontSize: 12, flex: '0 0 auto', borderRadius: 12,
                  border: `1px solid ${i === result.worstIdx ? 'var(--amber)' : i === curRep ? 'var(--mint)' : 'var(--line)'}`,
                  color: repColor(r) }}>
                #{i + 1} · {r.score}{r.tags && r.tags.length ? ' ⚠' : ''}
              </button>
            ))}
          </div>
          {result.worstIdx >= 0 && result.reps[result.worstIdx].tags.length > 0 && (
            <p className="meta" style={{ fontSize: 12, marginTop: 8 }}>
              Weakest rep (#{result.worstIdx + 1}): {result.reps[result.worstIdx].tags.join(' · ')}
            </p>
          )}

          {/* actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn primary" style={{ flex: 1 }} disabled={logging} onClick={onLog}>
              <IconBody width={16} height={16} /> {logging ? 'Logging…' : `Log ${result.reps.length} reps → grow Twin`}
            </button>
            <button className="btn ghost" style={{ flex: '0 0 auto' }} onClick={onDone}>Done</button>
          </div>
        </>
      )}
    </motion.div>
  );
}
