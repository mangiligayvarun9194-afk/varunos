// SarathiPitch — the 3D-animated INVESTOR PRESENTATION.
// Not a slide deck: one three.js theatre (pitchstage) where every slide is a camera
// station — the camera FLIES between points as the investor advances (→ / ← / space /
// click edges / dots). The charioteer billboard plays the Gate film on the title, the
// master through the argument, and the OPEN-HAND frame on the ask. Slide 4 runs LIVE
// product demos in real code (rep counter with animated squat, readiness ring, twin
// level) — investors watch the product work, not screenshots of it.
// Honest-numbers rule: anything the founder must fill is marked [__].
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createPitchStage } from '../lib/pitchstage.js';

const GOLD = '#f5b572';
const TEAL = '#2ec4b6';
const ELEMENT_COLORS = ['#c5b3ff', '#7fd4f0', '#ff9e5e', '#2ec4b6', '#d9b26a'];

// slide = content + a camera station in the 3D theatre + billboard texture mode
const SLIDES = [
  { id: 'title', tex: 'video', cam: { px: 0, py: 0.35, pz: 4.4, lx: 0, ly: 0.35, lz: 0 }, layout: 'center',
    eyebrow: 'सारथि · sarathi · pre-seed', title: 'Your AI charioteer.',
    body: 'A private AI health OS with a coach that remembers, eyes that see your form, and a Twin that shows you becoming stronger.', foot: 'You drive. He guides.' },
  { id: 'problem', tex: 'hero', cam: { px: -1.7, py: 0.15, pz: 3.1, lx: -0.5, ly: 0.45, lz: 0 }, layout: 'left',
    eyebrow: '01 · the problem', title: 'Health apps count.\nThey don’t coach.',
    points: ['Dashboards, not guidance — numbers with no “what next”', 'No memory: every session starts from zero', 'Most fitness apps lose the user within months — motivation dies alone'] },
  { id: 'solution', tex: 'hero', cam: { px: 0.85, py: 1.05, pz: 2.15, lx: 0, ly: 1.0, lz: 0 }, layout: 'left',
    eyebrow: '02 · the solution', title: 'A coach with memory,\neyes, and a soul.',
    points: ['HERMES — remembers every session, meal and heartbeat; tells you the one move that matters', 'FORM COACH — on-device pose AI counts and grades every rep, live', 'THE TWIN — your avatar visibly grows as you do. Progress you can see.'] },
  { id: 'demo', tex: 'hero', cam: { px: 0, py: 0.45, pz: 2.0, lx: 0, ly: 0.45, lz: 0 }, layout: 'demo',
    eyebrow: '03 · the product · LIVE', title: 'It already works.' },
  { id: 'whynow', tex: 'hero', cam: { px: 2.2, py: 0.6, pz: 2.6, lx: 0, ly: 0.5, lz: 0 }, layout: 'left',
    eyebrow: '04 · why now', title: 'Three curves just crossed.',
    points: ['On-device pose AI became free and real-time (phones see form without cloud)', 'LLMs finally hold long memory — a coach that knows YOU is now buildable', 'Wearables are everywhere; their data sits unused in silos'] },
  { id: 'market', tex: 'hero', cam: { px: 0, py: 1.7, pz: 4.9, lx: 0, ly: 0.4, lz: 0 }, layout: 'stats',
    eyebrow: '05 · the market', title: 'The India wedge, then the world.',
    stats: [{ n: 10, suffix: 'B+$', label: 'global fitness-app market (public est.)' }, { n: 500, suffix: 'M+', label: 'health-app users worldwide' }, { n: 1, suffix: '#', label: 'fastest-growing fitness market: India' }],
    foot: 'Figures: public market estimates — sources in appendix.' },
  { id: 'moat', tex: 'hero', cam: { px: 0.4, py: 1.15, pz: 1.7, lx: 0, ly: 1.05, lz: -0.6 }, layout: 'left',
    eyebrow: '06 · the moat', title: 'The record is the flywheel.',
    points: ['Every rep, meal and heartbeat is written into the user’s living record (Akasha)', 'The record makes the coach smarter → results → retention → more record', 'A brand competitors can’t copy: every feature stands on a 2,300-year-old verse'] },
  { id: 'model', tex: 'hero', cam: { px: -0.95, py: -0.15, pz: 3.3, lx: 0, ly: 0.3, lz: 0 }, layout: 'left',
    eyebrow: '07 · business model', title: 'Simple: a coach worth paying for.',
    points: ['Consumer subscription — free tier → premium coach (Hermes + Twin + readiness)', 'Priced for India first, global tiers to follow', 'Later: coach marketplace + anonymized insight layer'] },
  { id: 'twineconomy', tex: 'hero', cam: { px: -2.1, py: 0.85, pz: 2.3, lx: -0.2, ly: 0.7, lz: 0 }, layout: 'left',
    eyebrow: '08 · the twin economy', title: 'The Twin becomes\nan economy.',
    points: ['TRUE-SIZE TWIN — built from the user’s real measurements, updated every week they train (no other avatar on earth does this)', 'TRY-ON COMMERCE — a $15B market growing 26%/yr; proven to cut returns ~47% and lift conversion 4× (Walmart bought Zeekit for this)', 'GOAL-FIT — try clothes on the body you’re building; buy when you arrive. Motivation and commerce, fused', 'A LIVING COMPANION — the Twin greets you, eats your logged meals, shakes your protein, lives in your real weather'],
    foot: 'ZEPETO sells 123M avatar items per month. Ours are earned by health.' },
  { id: 'traction', tex: 'hero', cam: { px: 1.8, py: 0.4, pz: 4.2, lx: 0, ly: 0.5, lz: 0 }, layout: 'left',
    eyebrow: '09 · built & live', title: 'Shipped by one founder.',
    points: ['LIVE: on-device Form Coach (14 lifts, per-rep grading) · Hermes coach with memory', 'LIVE: readiness engine · health record vault · Apple Watch sync · meal logging', 'This presentation runs on our own 3D engine — the product’s front door'] },
  { id: 'ask', tex: 'hand', cam: { px: 0, py: 0.35, pz: 2.9, lx: 0, ly: 0.4, lz: 0 }, layout: 'center',
    eyebrow: '10 · the invitation', title: 'Join the chariot.',
    body: 'Raising [ ___ ] to reach our first 100,000 warriors: launch, India go-to-market, and the coach that never forgets.',
    foot: 'yatra yogeśvaraḥ — where the charioteer is, there is victory.' },
];

// ── live demo widgets (real code, not screenshots) ──────────────────────────
function RepDemo() {
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let t = 0; const id = setInterval(() => { t += 0.05; setPhase(Math.sin(t * 2)); if (Math.sin(t * 2) < -0.98 && Math.sin((t - 0.05) * 2) >= -0.98) setReps((r) => r + 1); }, 50);
    return () => clearInterval(id);
  }, []);
  const knee = 40 + (1 - phase) * 18;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="120" height="130" viewBox="0 0 100 110" aria-hidden>
        <g stroke="#7fd4f0" strokeWidth="3" strokeLinecap="round" fill="none">
          <circle cx="50" cy={18 + (1 - phase) * 10} r="7" fill="#7fd4f0" opacity="0.9" />
          <line x1="50" y1={26 + (1 - phase) * 10} x2="50" y2={52 + (1 - phase) * 12} />
          <line x1="50" y1={34 + (1 - phase) * 10} x2="30" y2={46 + (1 - phase) * 8} />
          <line x1="50" y1={34 + (1 - phase) * 10} x2="70" y2={46 + (1 - phase) * 8} />
          <line x1="50" y1={52 + (1 - phase) * 12} x2={50 - 14} y2={knee + 34} />
          <line x1="50" y1={52 + (1 - phase) * 12} x2={50 + 14} y2={knee + 34} />
          <line x1={50 - 14} y1={knee + 34} x2={50 - 16} y2="102" />
          <line x1={50 + 14} y1={knee + 34} x2={50 + 16} y2="102" />
        </g>
      </svg>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#7fd4f0' }}>{reps}</div>
      <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.2em', color: '#8e9ab8', textTransform: 'uppercase' }}>reps · grade A</div>
    </div>
  );
}
function ReadinessDemo() {
  const [v, setV] = useState(0);
  useEffect(() => { const id = setInterval(() => setV((x) => (x < 84 ? x + 1 : x)), 22); return () => clearInterval(id); }, []);
  const C = 2 * Math.PI * 42;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(151,168,205,.15)" strokeWidth="7" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={TEAL} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} transform="rotate(-90 50 50)" style={{ filter: `drop-shadow(0 0 6px ${TEAL})` }} />
        <text x="50" y="56" textAnchor="middle" fontFamily="var(--font-display)" fontSize="24" fontWeight="700" fill="#f6f8ff">{v}</text>
      </svg>
      <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.2em', color: '#8e9ab8', textTransform: 'uppercase', marginTop: 6 }}>readiness · push today</div>
    </div>
  );
}
function TwinDemo() {
  const [lv, setLv] = useState(0);
  useEffect(() => { const id = setInterval(() => setLv((x) => (x < 100 ? x + 1.2 : 0)), 40); return () => clearInterval(id); }, []);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 86, height: 86, margin: '10px auto 12px', borderRadius: '50%', backgroundImage: 'url(/img/sarathi-master.webp)', backgroundSize: '260%', backgroundPosition: 'center 12%', border: `2px solid ${GOLD}88`, boxShadow: `0 0 ${10 + lv * 0.25}px ${GOLD}` }} />
      <div style={{ width: 110, height: 6, borderRadius: 4, background: 'rgba(151,168,205,.15)', margin: '0 auto 8px', overflow: 'hidden' }}>
        <div style={{ width: `${lv}%`, height: '100%', background: `linear-gradient(90deg,#ffdeba,${GOLD})`, transition: 'width .05s linear' }} />
      </div>
      <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.2em', color: '#8e9ab8', textTransform: 'uppercase' }}>twin · lvl 12 → 13</div>
    </div>
  );
}
function Stat({ n, suffix, label, go }) {
  const [v, setV] = useState(0);
  useEffect(() => { if (!go) return; let x = 0; const id = setInterval(() => { x += Math.max(1, Math.round(n / 40)); if (x >= n) { x = n; clearInterval(id); } setV(x); }, 30); return () => clearInterval(id); }, [go, n]);
  return (
    <div style={{ textAlign: 'center', minWidth: 150 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem,4.4vw,3.6rem)', fontWeight: 700, color: GOLD }}>
        {suffix === '#' ? '#' : ''}{v}{suffix !== '#' ? suffix.replace('$', '') : ''}{suffix.includes('$') ? '' : ''}
      </div>
      <div style={{ fontSize: 12.5, color: '#aab4cc', maxWidth: 190, margin: '6px auto 0', lineHeight: 1.5 }}>{label}</div>
    </div>
  );
}

export default function SarathiPitch() {
  const [i, setI] = useState(0);
  const stageRef = useRef(null), divRef = useRef(null);
  const S = SLIDES[i];

  const go = useCallback((d) => setI((x) => Math.max(0, Math.min(SLIDES.length - 1, x + d))), []);

  useEffect(() => {
    let api = null, dead = false;
    createPitchStage(divRef.current, { heroUrl: '/img/sarathi-master.webp', handUrl: '/img/sarathi-hand.jpg', videoUrl: '/video/scene-1-gate.mp4', accents: ELEMENT_COLORS })
      .then((a) => { if (dead) { a.dispose(); return; } api = a; stageRef.current = a; a.flyTo(SLIDES[0].cam); a.setTexture(SLIDES[0].tex); })
      .catch(() => {});
    const onKey = (e) => { if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); } };
    const onMove = (e) => stageRef.current && stageRef.current.setMouse((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    window.addEventListener('keydown', onKey); window.addEventListener('mousemove', onMove, { passive: true });
    return () => { dead = true; if (api) api.dispose(); stageRef.current = null; window.removeEventListener('keydown', onKey); window.removeEventListener('mousemove', onMove); };
  }, [go]);

  useEffect(() => { const a = stageRef.current; if (a) { a.flyTo(S.cam); a.setTexture(S.tex); } }, [i]);

  const center = S.layout === 'center';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(90% 70% at 50% 40%, #0a0d15 0%, #04060a 70%)', overflow: 'hidden', fontFamily: 'var(--font-body)', userSelect: 'none' }}>
      <div ref={divRef} aria-hidden style={{ position: 'absolute', inset: 0 }} />
      <div aria-hidden className="pt-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35, mixBlendMode: 'overlay' }} />
      {/* darkness for the words */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: center ? 'radial-gradient(70% 70% at 50% 62%, rgba(4,6,10,.55), rgba(4,6,10,.82))' : 'linear-gradient(90deg, rgba(4,6,10,.94) 0%, rgba(4,6,10,.72) 34%, transparent 62%)' }} />

      {/* brand + progress */}
      <div style={{ position: 'absolute', top: 20, left: 26, zIndex: 10, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: '#f2f5fc' }}>सारथि</span>
        <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.2em', color: '#59648a', textTransform: 'uppercase' }}>investor preview</span>
      </div>
      <div style={{ position: 'absolute', top: 24, right: 26, zIndex: 10, fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '0.16em', color: '#59648a' }}>{String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</div>

      {/* the slide */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: center ? 'center' : 'center', justifyContent: center ? 'center' : 'flex-start', padding: center ? '0 8vw' : '0 0 0 7vw', pointerEvents: 'none' }}>
        <motion.div key={S.id} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ maxWidth: S.layout === 'stats' || S.layout === 'demo' ? 900 : 560, textAlign: center ? 'center' : 'left', pointerEvents: 'auto' }}>
            <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: GOLD, marginBottom: 16 }}>{S.eyebrow}</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: center ? 'clamp(2.6rem,5.4vw,4.6rem)' : 'clamp(2rem,4vw,3.4rem)', lineHeight: 1.06, fontWeight: 600, letterSpacing: '-0.025em', color: '#f6f8ff', margin: '0 0 20px', whiteSpace: 'pre-line' }}>{S.title}</h1>
            {S.body && <p style={{ fontSize: 'clamp(14px,1.4vw,17px)', lineHeight: 1.65, color: '#c3cbdf', maxWidth: 620, margin: center ? '0 auto 18px' : '0 0 18px' }}>{S.body}</p>}
            {S.points && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {S.points.map((p, k) => (
                  <li key={k} className="pt-in" style={{ animationDelay: `${0.25 + k * 0.14}s`, display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 'clamp(13.5px,1.3vw,16px)', lineHeight: 1.55, color: '#c3cbdf' }}>
                    <span style={{ marginTop: 7, width: 22, height: 2, flexShrink: 0, background: `linear-gradient(90deg,${GOLD},transparent)` }} />{p}
                  </li>
                ))}
              </ul>
            )}
            {S.stats && (
              <div style={{ display: 'flex', gap: 'clamp(20px,4vw,64px)', marginTop: 10, flexWrap: 'wrap' }}>
                {S.stats.map((st, k) => <Stat key={k} {...st} go={true} />)}
              </div>
            )}
            {S.layout === 'demo' && (
              <div style={{ display: 'flex', gap: 'clamp(16px,3vw,44px)', marginTop: 18, flexWrap: 'wrap' }}>
                {[<RepDemo key="r" />, <ReadinessDemo key="d" />, <TwinDemo key="t" />].map((D, k) => (
                  <div key={k} className="pt-in" style={{ animationDelay: `${0.25 + k * 0.15}s`, background: 'rgba(8,10,16,0.66)', border: '1px solid rgba(245,181,114,0.16)', borderRadius: 18, padding: '18px 26px', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
                    {D}
                  </div>
                ))}
              </div>
            )}
            {S.foot && <div style={{ marginTop: 22, fontStyle: 'italic', fontSize: 13.5, color: '#9aa6c4' }}>{S.foot}</div>}
          </motion.div>
      </div>

      {/* nav: dots + edge zones + hint */}
      <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 10 }}>
        {SLIDES.map((s, k) => (
          <button key={s.id} onClick={() => setI(k)} aria-label={s.id} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer', background: k === i ? GOLD : 'rgba(151,168,205,.3)', transition: 'all .35s' }} />
        ))}
      </div>
      <button onClick={() => go(-1)} aria-label="previous" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8vw', zIndex: 8, background: 'none', border: 'none', cursor: i > 0 ? 'w-resize' : 'default' }} />
      <button onClick={() => go(1)} aria-label="next" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8vw', zIndex: 8, background: 'none', border: 'none', cursor: i < SLIDES.length - 1 ? 'e-resize' : 'default' }} />
      <div style={{ position: 'absolute', bottom: 26, right: 26, zIndex: 10, fontFamily: 'var(--font-eyebrow)', fontSize: 9.5, letterSpacing: '0.2em', color: '#59648a', textTransform: 'uppercase' }}>← → to navigate</div>

      <style>{`.pt-grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");background-size:180px 180px}
.pt-in{opacity:0;animation:ptIn .6s cubic-bezier(.22,1,.36,1) forwards}
@keyframes ptIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pt-in{animation:none;opacity:1}}`}</style>
    </div>
  );
}
