// SarathiStory — THE SCROLL FILM (Cula-grade architecture, studied from their live pixels).
// One continuous film, not stacked sections: a single pinned 100vh stage over a long scroll
// runway. A virtual CAMERA travels the charioteer's body (head → arms → belly → heart → legs
// → full figure) as the five elements pass; the ambient world-tint and a per-element particle
// system transform around him. ALL narrative text lives in ONE pinned obsidian glass card —
// titles swap in place, and each element you pass is COLLECTED as a glowing chip inside the
// card (the UI is the story: you gather the five). Persistent pill nav · scroll-to-begin hint
// · progress rail. Scene videos drop in later as film layers. Reduced-motion → static story.
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { createFilmStage } from '../lib/filmstage.js';

const GOLD = '#f5b572';
const HERO = '/img/sarathi-master.webp';
const reducedQ = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease3 = (t) => t * t * (3 - 2 * t); // smoothstep
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (h1, h2, t) => { const a = hx(h1), b = hx(h2); const c = (i) => Math.round(a[i] + (b[i] - a[i]) * t); return `rgb(${c(0)},${c(1)},${c(2)})`; };

// The film's segments. cam = virtual camera on the master (scale + focus point on the body).
const SEGS = [
  { id: 'gate',    w: 1.0,  mode: 'gold',  accent: GOLD,      cam: { s: 0.98, fx: 50, fy: 31 },
    eyebrow: 'सारथि · the charioteer within', title: 'You are the chariot.\nSarathi holds the reins.',
    body: 'In the old chariot teaching, the body is the vehicle, the senses are the horses, and the guiding intelligence keeps the journey true. Sarathi becomes that guide for your training, recovery, food and memory.', shloka: null },
  { id: 'akasha',  w: 1.1,  mode: 'space', accent: '#c5b3ff', cam: { s: 2.35, fx: 50, fy: 9 }, word: 'आकाश', el: 'space', phase: 1,
    eyebrow: '01 · akasha · space · the mind', title: 'Space remembers.',
    body: 'From space begins the field of memory. Every session, meal, heartbeat and note becomes a living record, so Sarathi speaks with your whole history behind it.',
    shloka: { sa: 'mattaḥ smṛtir jñānam', en: 'from me: memory, and knowing', src: 'Gita 15.15' },
    pins: [{ x: '58%', y: '24%', t: 'Health Vault · every record yours' }, { x: '66%', y: '40%', t: 'Lifelong memory' }, { x: '56%', y: '56%', t: 'Syncs Apple Health' }] },
  { id: 'vayu',    w: 1.1,  mode: 'air',   accent: '#7fd4f0', cam: { s: 1.9,  fx: 50, fy: 22 }, word: 'वायु', el: 'air', phase: 2,
    eyebrow: '02 · vayu · air · the breath', title: 'Air moves you.',
    body: 'Vayu is breath becoming motion. Sarathi reads your movement like wind over a battlefield: every rep counted, graded and corrected while you move.',
    shloka: { sa: 'prāṇāpāna-samāyuktaḥ', en: 'joined with the winds of breath', src: 'Gita 15.14' },
    pins: [{ x: '58%', y: '24%', t: 'Form Coach · live rep grading' }, { x: '67%', y: '42%', t: 'On-device camera AI' }, { x: '56%', y: '58%', t: '3D replay · every rep scored' }] },
  { id: 'agni',    w: 1.1,  mode: 'fire',  accent: '#ff9e5e', cam: { s: 2.5,  fx: 50, fy: 48 }, word: 'अग्नि', el: 'fire', phase: 3,
    eyebrow: '03 · agni · fire · the furnace', title: 'Fire transforms you.',
    body: 'The Gita names the fire in the body: Vaiśvānara. Log a meal in one line and Sarathi turns fuel into guidance: macros, protein, timing and the flame you train with.',
    shloka: { sa: 'ahaṁ vaiśvānaro bhūtvā', en: 'I am the fire that digests all food', src: 'Gita 15.14' },
    pins: [{ x: '58%', y: '26%', t: 'One-line meal logging' }, { x: '66%', y: '43%', t: 'Macros read instantly' }, { x: '56%', y: '60%', t: 'Protein ritual · Twin drinks with you' }] },
  { id: 'apas',    w: 1.3,  mode: 'water', accent: '#2ec4b6', cam: { s: 2.3,  fx: 50, fy: 26 }, word: 'आपस्', el: 'water', core: true, phase: 4,
    eyebrow: '04 · apas · water · the tides', title: 'Water restores you.',
    body: 'When the ocean was churned, amrita rose from the depths. Your nights are that churn: sleep, HRV and strain flow together, then return as a readiness score you can trust.',
    shloka: { sa: 'āpo hi ṣṭhā mayobhuvaḥ', en: 'O Waters, source of all wellbeing', src: 'Rig Veda 10.9' },
    pins: [{ x: '59%', y: '25%', t: 'Readiness score each dawn' }, { x: '67%', y: '41%', t: 'Sleep · HRV · strain' }, { x: '56%', y: '57%', t: 'Per-muscle recovery map' }] },
  { id: 'prithvi', w: 1.1,  mode: 'earth', accent: '#d9b26a', cam: { s: 2.1,  fx: 50, fy: 80 }, word: 'पृथ्वी', el: 'earth', phase: 5,
    eyebrow: '05 · prithvi · earth · the foundation', title: 'Earth is what you build.',
    body: 'When the herb could not be found, Hanuman lifted the mountain. Training is that kind of devotion: bone, muscle and habit built grain by grain, visible in your Twin.',
    shloka: { sa: 'mātā bhūmiḥ putro ’haṁ pṛthivyāḥ', en: 'Earth is my mother; I am her son', src: 'Atharva Veda 12.1' },
    pins: [{ x: '58%', y: '26%', t: 'True-size Twin · your measurements' }, { x: '66%', y: '43%', t: 'Becoming slider · today → goal' }, { x: '56%', y: '59%', t: 'Try-on · fits goal-you' }] },
  { id: 'balance', w: 1.4,  mode: 'align', accent: '#ffdeba', cam: { s: 0.94, fx: 50, fy: 32 }, cta: true,
    eyebrow: 'the five in balance', title: 'When the five align, you rise.',
    body: 'The five powers return to one body: memory, motion, fuel, recovery and strength. Begin with sixty seconds, and let the guide grow with you.',
    shloka: { sa: 'ātmaiva hy ātmano bandhuḥ', en: 'the self alone is the friend of the self', src: 'Gita 6.5' } },
];
const TOTAL_W = SEGS.reduce((a, s) => a + s.w, 0);
const ELEMENTS = SEGS.filter((s) => s.el);
const ELEMENT_COLORS = ELEMENTS.map((s) => s.accent);
const PROOFS = [
  { k: 'Vayu', t: 'Form Coach', d: 'Camera form checks, rep count and replay grading.', c: '#7fd4f0' },
  { k: 'Apas', t: 'Readiness', d: 'Sleep, HRV and strain folded into one morning signal.', c: '#2ec4b6' },
  { k: 'Prithvi', t: 'The Twin', d: 'A visible body model that changes with your training.', c: '#d9b26a' },
];

function Arrow({ size = 15 }) {
  return <svg className="sf-arrow" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

// ── particle systems (per element mode) ─────────────────────────────────────
function seedParticles(mode, W, H) {
  const R = (a, b) => a + Math.random() * (b - a);
  if (mode === 'gold')  return Array.from({ length: 34 }, () => ({ x: R(0, W), y: R(0, H), r: R(0.5, 1.7), s: R(0.2, 0.7), tw: R(0, 7) }));
  if (mode === 'space') return Array.from({ length: 36 }, () => ({ x: R(0, W), y: R(0, H), r: R(0.5, 1.6), tw: R(0, 7), s: R(0.02, 0.09) }));
  if (mode === 'air')   return Array.from({ length: 22 }, () => ({ x: R(0, W), y: R(0, H), len: R(30, 90), s: R(0.8, 2.2), ph: R(0, 7) }));
  if (mode === 'fire')  return Array.from({ length: 30 }, () => ({ x: R(0, W), y: R(0, H), r: R(0.6, 2), s: R(0.4, 1.3), tw: R(0, 7) }));
  if (mode === 'water') return Array.from({ length: 5 },  (_, i) => ({ t: i / 5 }));
  if (mode === 'earth') return Array.from({ length: 26 }, () => ({ x: R(0, W), y: R(0, H), r: R(0.5, 1.4), s: R(0.15, 0.5), dr: R(-0.3, 0.3) }));
  if (mode === 'align') return ELEMENT_COLORS.map((c, i) => ({ c, a0: (i / 5) * Math.PI * 2 }));
  return [];
}
function drawParticles(ctx, st, mode, alpha, accent, W, H, t, p) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha;
  const [r, g, b] = hx(accent);
  if (mode === 'gold' || mode === 'fire') for (const q of st) { q.y -= q.s; q.tw += 0.04; if (q.y < -4) { q.y = H + 4; q.x = Math.random() * W; } const a = 0.22 + 0.34 * Math.abs(Math.sin(q.tw)); ctx.beginPath(); ctx.arc(q.x + Math.sin(q.tw) * 5, q.y, q.r, 0, 7); ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.shadowBlur = 6; ctx.shadowColor = accent; ctx.fill(); ctx.shadowBlur = 0; }
  if (mode === 'space') for (const q of st) { q.tw += 0.02; const a = 0.22 + 0.34 * Math.abs(Math.sin(q.tw)); q.y -= q.s; if (q.y < 0) q.y = H; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.fill(); }
  if (mode === 'air') for (const q of st) { q.x += q.s; q.ph += 0.02; const y = q.y + Math.sin(q.ph) * 14; if (q.x > W + q.len) q.x = -q.len; const gr = ctx.createLinearGradient(q.x, y, q.x + q.len, y); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, `rgba(${r},${g},${b},0.26)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.strokeStyle = gr; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x, y); ctx.lineTo(q.x + q.len, y); ctx.stroke(); }
  if (mode === 'water') { const cx = W * 0.5, cy = H * 0.44; for (const q of st) { q.t += 0.0022; if (q.t > 1) q.t -= 1; const rad = q.t * Math.min(W, H) * 0.44; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.strokeStyle = `rgba(${r},${g},${b},${0.2 * (1 - q.t)})`; ctx.lineWidth = 1.2; ctx.stroke(); } }
  if (mode === 'earth') for (const q of st) { q.y += q.s; q.x += q.dr * 0.4; if (q.y > H) { q.y = -3; q.x = Math.random() * W; } ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fillStyle = `rgba(${r},${g},${b},0.28)`; ctx.fill(); }
  if (mode === 'align') { const cx = W * 0.5, cy = H * 0.42; const conv = ease3(clamp01((p - 0.25) / 0.55)); const R0 = Math.min(W, H) * (0.36 - 0.32 * conv); st.forEach((q, i) => { const ang = q.a0 + t * 0.00045; const colY = (i - 2) * 36; const x = cx + Math.cos(ang) * R0 * (1 - conv * 0.94); const y = cy + Math.sin(ang) * R0 * (1 - conv) + colY * conv; const [er, eg, eb] = hx(q.c); ctx.beginPath(); ctx.arc(x, y, 4 + conv * 2.5, 0, 7); ctx.fillStyle = `rgba(${er},${eg},${eb},0.9)`; ctx.shadowBlur = 16; ctx.shadowColor = q.c; ctx.fill(); ctx.shadowBlur = 0; }); }
  ctx.restore();
}

// ── persistent pill nav + phase tracker ─────────────────────────────────────
// NRG "Build Your Data Center" mechanic: once the journey begins, the header's
// right side becomes a live phase tracker (① · name). At the finale the tracker
// itself morphs into the CTA — the progress instrument becomes the ask.
const elName = (el) => el ? el[0].toUpperCase() + el.slice(1) : '';
function Nav({ onStart, S }) {
  const inPhase = !!S?.el, isCta = !!S?.cta;
  return (
    <nav style={{ position: 'fixed', top: 18, left: 0, right: 0, zIndex: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 22px', pointerEvents: 'none' }}>
      <div className="sf-pill" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#f2f5fc' }}>सारथि</span>
        <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#59648a' }}>Sarathi</span>
      </div>
      {isCta ? (
        <motion.button key="nav-cta" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onClick={onStart} className="sf-ctamini" style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: '#1a0f06', background: GOLD, border: 'none', borderRadius: '999px', padding: '11px 20px', cursor: 'pointer', boxShadow: '0 10px 30px -8px rgba(245,181,114,.55)' }}>
          Begin your Becoming <Arrow size={14} />
        </motion.button>
      ) : inPhase ? (
        <motion.div key={S.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="sf-pill" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 6px 6px' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: S.accent, color: '#0a0c12', fontWeight: 700, fontSize: 13, display: 'grid', placeItems: 'center', boxShadow: `0 0 14px ${S.accent}66` }}>{S.phase}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f2f5fc', whiteSpace: 'nowrap' }}>{S.word} · {elName(S.el)}</span>
          <span style={{ display: 'flex', gap: 4, marginLeft: 2 }} aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ width: 5, height: 5, borderRadius: '50%', background: n < S.phase ? GOLD : n === S.phase ? S.accent : 'rgba(151,168,205,.3)', boxShadow: n === S.phase ? `0 0 8px ${S.accent}` : 'none', transition: 'all .4s' }} />
            ))}
          </span>
        </motion.div>
      ) : (
        <div className="sf-pill sf-navlinks" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 26, padding: '10px 12px 10px 24px' }}>
          {['Story', 'Coach', 'Twin', 'Vault'].map((l) => (
            <a key={l} href="#" className="sf-navlink" style={{ fontSize: 13, fontWeight: 500, color: '#c7cfe2', textDecoration: 'none' }}>{l}</a>
          ))}
          <button onClick={onStart} className="sf-ctamini" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: '#1a0f06', background: GOLD, border: 'none', borderRadius: '999px', padding: '9px 16px', cursor: 'pointer' }}>
            Meet your Twin <Arrow size={13} />
          </button>
        </div>
      )}
    </nav>
  );
}

// ── the film ────────────────────────────────────────────────────────────────
export default function SarathiStory({ onStart }) {
  const rm = useReducedMotion() || reducedQ();
  const [seg, setSeg] = useState(0);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null), figRef = useRef(null), ambRef = useRef(null), cvRef = useRef(null), coreRef = useRef(null), hintRef = useRef(null), railFill = useRef(null), cardRef = useRef(null), pinsRef = useRef(null), nextRef = useRef(null);
  const stageDivRef = useRef(null), stageApi = useRef(null);
  const P = useRef({ mode: null, parts: null, W: 0, H: 0 });
  const P2 = useRef({ mode: null, parts: null });
  const mouse = useRef({ x: 0, y: 0 });

  // the true-3D layer (three.js): figure billboard + mandala + orbs + depth dust.
  // If WebGL fails for any reason, the 2D DOM figure below stays as the fallback.
  useEffect(() => {
    if (rm) return;
    let disposed = false, api = null;
    const el = stageDivRef.current; if (!el) return;
    createFilmStage(el, HERO, ELEMENT_COLORS, { 0: '/video/scene-1-gate.mp4' })
      .then((a) => {
        if (disposed) { a.dispose(); return; }
        api = a; stageApi.current = a;
        if (figRef.current) figRef.current.style.display = 'none';
      })
      .catch(() => {});
    return () => { disposed = true; stageApi.current = null; if (api) api.dispose(); };
  }, [rm]);

  useEffect(() => {
    if (rm) return;
    const onMove = (e) => { mouse.current = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 }; };
    window.addEventListener('mousemove', onMove, { passive: true });
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let raf, lastSeg = -1;
    const loop = (t) => {
      const vh = window.innerHeight;
      const wrap = wrapRef.current; if (!wrap) { raf = requestAnimationFrame(loop); return; }
      const r = wrap.getBoundingClientRect();
      const runway = r.height - vh;
      const G = clamp01(-r.top / Math.max(1, runway)) * TOTAL_W;   // global position in weights
      // locate segment + local progress
      let acc = 0, idx = 0, p = 0;
      for (let i = 0; i < SEGS.length; i++) { if (G <= acc + SEGS[i].w || i === SEGS.length - 1) { idx = i; p = clamp01((G - acc) / SEGS[i].w); break; } acc += SEGS[i].w; }
      const S = SEGS[idx];
      if (idx !== lastSeg) { lastSeg = idx; setSeg(idx); setActive(idx); }
      // continuous camera: lerp from previous segment cam during the first 35%
      const prev = SEGS[Math.max(0, idx - 1)].cam, cur = S.cam;
      const ct = idx === 0 ? 1 : ease3(clamp01(p / 0.45));
      const s = lerp(prev.s, cur.s, ct), fx = lerp(prev.fx, cur.fx, ct), fy = lerp(prev.fy, cur.fy, ct);
      const mx = mouse.current.x, my = mouse.current.y;
      const coreI = S.core ? clamp01((p - 0.2) / 0.15) * (1 - clamp01((p - 0.9) / 0.1)) : 0;
      if (stageApi.current) {
        stageApi.current.setShot({ s, fx, fy }, idx, p, t, mx, my, S.accent, coreI);
      } else if (figRef.current) {
        figRef.current.style.transformOrigin = `${fx}% ${fy}%`;
        figRef.current.style.transform = `translate3d(${mx * 10}px, ${my * 6}px, 0) scale(${s.toFixed(4)})`;
      }
      // ambient world tint
      const tinT = Math.sin(Math.PI * p);
      if (ambRef.current) ambRef.current.style.background = `radial-gradient(90% 70% at 50% 42%, ${mixc('#05070c', S.accent, 0.16 * tinT + 0.05)} 0%, #030406 72%)`;
      // heart core (apas only)
      if (coreRef.current) coreRef.current.style.opacity = stageApi.current ? '0' : coreI.toFixed(2);
      // scroll hint + progress rail
      if (hintRef.current) hintRef.current.style.opacity = (idx === 0 && p < 0.08) ? '1' : '0';
      if (railFill.current) railFill.current.style.width = `${((G / TOTAL_W) * 100).toFixed(2)}%`;
      // feature pins: pop in mid-phase, retire before the handoff (NRG's labeled pins)
      if (pinsRef.current) pinsRef.current.classList.toggle('sf-pins-on', !!S.pins && p > 0.24 && p < 0.93);
      // "Scroll to Phase N" pull: the named reward at each phase's end
      if (nextRef.current) nextRef.current.style.opacity = (idx < SEGS.length - 1 && p > 0.84) ? '1' : '0';
      // story panel presence: breathe between segments without making the copy unreadable.
      if (cardRef.current) { const edge = Math.min(clamp01(p / 0.09), clamp01((1 - p) / 0.09)); cardRef.current.style.opacity = (0.88 + 0.12 * ease3(edge)).toFixed(3); }
      // particles: crossfade current mode in, previous mode out
      const cv = cvRef.current;
      if (cv) {
        const W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
        if (P.current.W !== W || P.current.H !== H) { cv.width = W; cv.height = H; P.current = { mode: null, parts: null, W, H }; P2.current = { mode: null, parts: null }; }
        if (P.current.mode !== S.mode) { P2.current = { ...P.current }; P.current = { mode: S.mode, parts: seedParticles(S.mode, W, H), W, H }; }
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        const fadeIn = ease3(clamp01(p / 0.25));
        if (P2.current.parts && fadeIn < 1) drawParticles(ctx, P2.current.parts, P2.current.mode, (1 - fadeIn) * 0.9, SEGS[Math.max(0, idx - 1)].accent, W, H, t, 1);
        if (P.current.parts) drawParticles(ctx, P.current.parts, S.mode, fadeIn * Math.min(1, 0.35 + tinT), S.accent, W, H, t, p);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove); };
  }, [rm]);

  const jump = (i) => {
    const wrap = wrapRef.current; if (!wrap) return;
    const vh = window.innerHeight; const runway = wrap.offsetHeight - vh;
    let acc = 0; for (let k = 0; k < i; k++) acc += SEGS[k].w;
    window.scrollTo({ top: wrap.offsetTop + (acc + 0.55 * SEGS[i].w) / TOTAL_W * runway, behavior: 'smooth' });
  };

  const S = SEGS[seg];
  const collected = SEGS.slice(1, seg + (SEGS[seg].el ? 0 : 1)).filter((x) => x.el); // elements fully passed

  // ── reduced-motion / no-JS-motion fallback: the story as a clean static read ──
  if (rm) {
    return (
      <div style={{ background: '#04060a', minHeight: '100vh' }}>
        <Nav onStart={onStart} S={SEGS[0]} />
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px 80px' }}>
          <img src={HERO} alt="Sarathi" style={{ width: '100%', borderRadius: 18 }} />
          {SEGS.map((x) => (
            <section key={x.id} style={{ margin: '56px 0' }}>
              <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: x.accent, marginBottom: 12 }}>{x.eyebrow}</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#f6f8ff', margin: '0 0 12px', whiteSpace: 'pre-line' }}>{x.title}</h2>
              {x.shloka && <p style={{ fontStyle: 'italic', color: '#9aa6c4', fontSize: 13 }}>“{x.shloka.sa}” — {x.shloka.en}. {x.shloka.src}</p>}
              <p style={{ color: '#aab4cc', lineHeight: 1.65 }}>{x.body}</p>
              {x.cta && <button onClick={onStart} className="st-cta" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: '#1a0f06', background: GOLD, border: 'none', borderRadius: 999, padding: '14px 28px', cursor: 'pointer' }}>Meet your Twin</button>}
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', background: '#030406' }}>
      <Nav onStart={onStart} S={S} />
      {/* progress */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 95, pointerEvents: 'none' }}>
        <div ref={railFill} style={{ height: '100%', width: '0%', background: `linear-gradient(90deg,#ffdeba,${GOLD} 60%,#d97a45)`, boxShadow: '0 0 12px rgba(245,181,114,.6)' }} />
      </div>
      {/* element rail */}
      <nav aria-label="chapters" className="sf-rail" style={{ position: 'fixed', left: 22, top: '50%', transform: 'translateY(-50%)', zIndex: 90, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {SEGS.map((x, i) => {
          const on = active === i;
          return (
            <button key={x.id} onClick={() => jump(i)} className="sf-tick" aria-label={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ width: on ? 12 : 9, height: on ? 12 : 9, borderRadius: '50%', border: `1.5px solid ${on ? x.accent : 'rgba(151,168,205,.4)'}`, background: on ? x.accent : 'transparent', boxShadow: on ? `0 0 14px ${x.accent}` : 'none', transition: 'all .35s' }} />
              <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f2f5fc', opacity: 0, transform: 'translateX(-6px)', transition: 'all .35s', whiteSpace: 'nowrap' }}>{x.word || x.id}</span>
            </button>
          );
        })}
      </nav>

      {/* THE FILM: one long runway, one pinned stage */}
      <div ref={wrapRef} style={{ position: 'relative', height: `${Math.round(TOTAL_W * 100)}vh` }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
          {/* world tint */}
          <div ref={ambRef} aria-hidden style={{ position: 'absolute', inset: 0, background: '#04060a' }} />
          {/* the TRUE-3D stage: figure billboard + rotating mandala + element orbs + depth dust */}
          <div ref={stageDivRef} aria-hidden style={{ position: 'absolute', inset: 0 }} />
          <div
            aria-hidden
            className="sf-element-field"
            data-mode={S.mode}
            style={{ '--accent': S.accent, '--focus-x': `${S.cam.fx}%`, '--focus-y': `${S.cam.fy}%` }}
          >
            <span className="sf-element-glyph">{S.word || 'सारथि'}</span>
            <span className="sf-power-line sf-power-a" />
            <span className="sf-power-line sf-power-b" />
            <span className="sf-power-line sf-power-c" />
          </div>
          {/* the charioteer — 2D fallback (hidden when the 3D stage is live) */}
          <div ref={figRef} aria-hidden style={{ position: 'absolute', inset: 0, willChange: 'transform',
            backgroundImage: `url(${HERO})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center 32%',
            WebkitMaskImage: 'radial-gradient(56% 88% at 50% 46%, #000 60%, transparent 94%)', maskImage: 'radial-gradient(56% 88% at 50% 46%, #000 60%, transparent 94%)',
            filter: 'drop-shadow(0 30px 90px rgba(245,181,114,.18))' }} />
          {/* heart core (water) */}
          <div ref={coreRef} aria-hidden className="sf-core" style={{ position: 'absolute', top: '40%', left: '50%', width: 240, height: 240, transform: 'translate(-50%,-50%)', pointerEvents: 'none', opacity: 0,
            background: 'radial-gradient(50% 50% at 50% 50%, #2ec4b6cc 0%, #2ec4b655 26%, #2ec4b614 50%, transparent 72%)', mixBlendMode: 'screen', filter: 'blur(2px)' }} />
          {/* element particles */}
          <canvas ref={cvRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          {/* feature pins — NRG's labeled diorama pins: each phase names the real product
              on the stage itself. Visibility gated by the conductor (sf-pins-on). */}
          <div ref={pinsRef} aria-hidden className="sf-pins" style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
            {(S.pins || []).map((pin, i) => (
              <div key={S.id + i} className="sf-pin" style={{ position: 'absolute', left: pin.x, top: pin.y, '--d': `${0.1 + i * 0.22}s` }}>
                <span className="sf-pindot" style={{ background: S.accent, boxShadow: `0 0 12px ${S.accent}` }} />
                <span className="sf-pinlabel">{pin.t}</span>
              </div>
            ))}
          </div>
          {/* legibility scrim: reserves a darkness lane for story while the figure owns light */}
          <div aria-hidden className="sf-story-scrim" />
          <div aria-hidden className="sf-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35, mixBlendMode: 'overlay' }} />

          {/* THE CARD — the single home of all words (Cula's pinned card, in obsidian) */}
          <div ref={cardRef} className="sf-story-panel" style={{ '--accent': S.accent }}>
            {/* enter-only keyed swap — AnimatePresence mode="wait" wedges under rapid
                scroll (interrupted exits never resolve; found by live QA) */}
              <motion.div key={S.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px 10px', marginBottom: 10, flexWrap: 'wrap' }}>
                  {(S.phase || S.cta) && (
                    <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: S.accent, border: `1px solid ${S.accent}55`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                      {S.cta ? 'all five gathered' : `phase ${S.phase} of 5`}
                    </span>
                  )}
                  <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: S.accent }}>{S.eyebrow}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '8px 28px', justifyContent: 'space-between' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: seg === 0 ? 'clamp(1.65rem, 3vw, 2.65rem)' : 'clamp(1.85rem, 3.35vw, 3rem)', lineHeight: 1.08, fontWeight: 600, letterSpacing: 0, color: '#f6f8ff', margin: 0, whiteSpace: 'pre-line', flex: '1 1 340px' }}>{S.title}</h2>
                  {S.shloka && (
                    <div style={{ flex: '1 1 260px', maxWidth: 380, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: '#9aa6c4', textAlign: 'right' }}>
                      “{S.shloka.sa}”<br />{S.shloka.en} · <span style={{ fontStyle: 'normal', fontFamily: 'var(--font-eyebrow)', fontSize: 9.5, letterSpacing: '0.12em', color: S.accent, textTransform: 'uppercase' }}>{S.shloka.src}</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 'clamp(14px, 1.25vw, 16px)', lineHeight: 1.65, color: '#d0d7e8', margin: '14px 0 0', maxWidth: '62ch' }}>{S.body}</p>
                {S.cta && (
                  <motion.button initial={false} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={onStart} className="st-cta" style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: '#1a0f06', background: GOLD, border: `1px solid ${GOLD}`, borderRadius: '999px', padding: '13px 26px', cursor: 'pointer' }}>
                    Meet your Twin <Arrow size={16} />
                  </motion.button>
                )}
              </motion.div>
            {/* the collection — elements gathered so far live IN the card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(151,168,205,0.1)', minHeight: 26, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#59648a' }}>{seg === 0 ? 'the five elements await' : 'gathered'}</span>
              {ELEMENTS.map((e) => {
                const got = collected.includes(e) || (SEGS[seg].cta);
                const now = SEGS[seg].id === e.id;
                return (
                  <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, border: `1px solid ${got || now ? e.accent + '66' : 'rgba(151,168,205,0.18)'}`,
                    background: got ? e.accent + '14' : 'transparent', opacity: got ? 1 : now ? 0.9 : 0.35, transition: 'all .5s' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: got || now ? e.accent : 'rgba(151,168,205,0.4)', boxShadow: got ? `0 0 8px ${e.accent}` : 'none', transition: 'all .5s' }} />
                    <span style={{ fontSize: 11, color: got || now ? '#e8ecf7' : '#59648a', transition: 'color .5s' }}>{e.word}</span>
                  </span>
                );
              })}
              {/* the named forward pull — "Scroll to Phase N" (opacity driven by conductor) */}
              {seg < SEGS.length - 1 && (
                <span ref={nextRef} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: 0, transition: 'opacity .45s', whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: SEGS[seg + 1].accent }}>
                    {SEGS[seg + 1].el ? `scroll · phase ${SEGS[seg + 1].phase} — ${SEGS[seg + 1].word}` : 'scroll · the five align'}
                  </span>
                  <span className="sf-bounce" style={{ color: SEGS[seg + 1].accent, fontSize: 13, lineHeight: 1 }}>↓</span>
                </span>
              )}
            </div>
          </div>

          {/* scroll to begin */}
          <div ref={hintRef} aria-hidden style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', zIndex: 4, textAlign: 'center', transition: 'opacity .6s', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9.5, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#8e9ab8' }}>scroll to begin</div>
            <div className="sf-bounce" style={{ color: '#8e9ab8', fontSize: 14, marginTop: 2 }}>↓</div>
          </div>
        </div>
      </div>

      <section className="sf-proof" aria-label="Sarathi product proof">
        <div className="sf-proof-inner">
          <div>
            <div className="sf-proof-eyebrow">the engine beneath the myth</div>
            <h2>Every element resolves into a real Sarathi power.</h2>
          </div>
          <div className="sf-proof-grid">
            {PROOFS.map((p) => (
              <article key={p.t} className="sf-proof-card" style={{ '--accent': p.c }}>
                <div className="sf-proof-orb" />
                <div className="sf-proof-k">{p.k}</div>
                <h3>{p.t}</h3>
                <p>{p.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ position: 'relative', padding: '28px 24px 40px', textAlign: 'center', color: '#59648a', fontSize: 12, background: '#04060a' }}>
        © {new Date().getFullYear()} Sarathi · Private AI Health OS · सारथि — <em>yatra yogeśvaraḥ, tatra vijayaḥ</em>
      </footer>

      <style>{`
        .sf-grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");background-size:180px 180px}
        .sf-pill{background:rgba(12,15,23,0.6);border:1px solid rgba(151,168,205,0.14);border-radius:999px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
        .sf-story-scrim{position:absolute;inset:0;z-index:4;pointer-events:none;background:linear-gradient(90deg,rgba(3,4,6,.96) 0%,rgba(3,4,6,.88) 20%,rgba(3,4,6,.48) 40%,transparent 68%),linear-gradient(180deg,rgba(3,4,6,.55),transparent 20%,transparent 62%,rgba(3,4,6,.72))}
        .sf-story-panel{position:absolute;left:clamp(68px,7vw,128px);top:50%;transform:translateY(-43%);width:min(520px,38vw);z-index:6;background:linear-gradient(135deg,rgba(8,10,16,.9),rgba(8,10,16,.68));border:1px solid rgba(151,168,205,.18);border-left:2px solid var(--accent);border-radius:8px;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 30px 90px -38px rgba(0,0,0,.9),0 0 40px -32px var(--accent);padding:clamp(20px,2.6vh,30px) clamp(20px,2.5vw,34px)}
        .sf-element-field{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none;mix-blend-mode:screen}
        .sf-element-field::before,.sf-element-field::after{content:"";position:absolute;inset:-18%;opacity:.26;filter:blur(.2px);background:radial-gradient(circle at var(--focus-x) var(--focus-y),var(--accent) 0%,transparent 24%),radial-gradient(circle at 50% 50%,rgba(245,181,114,.12),transparent 56%);animation:sfFieldPulse 5.6s ease-in-out infinite}
        .sf-element-field::after{opacity:.16;filter:blur(18px);animation-duration:7.5s}
        .sf-element-field[data-mode="space"]::before{background:radial-gradient(circle at 50% 12%,var(--accent),transparent 22%),repeating-radial-gradient(circle at 50% 16%,rgba(197,179,255,.18) 0 1px,transparent 1px 64px)}
        .sf-element-field[data-mode="air"]::before{background:repeating-linear-gradient(154deg,transparent 0 32px,rgba(127,212,240,.2) 33px,transparent 36px),radial-gradient(circle at 50% 28%,rgba(127,212,240,.22),transparent 34%)}
        .sf-element-field[data-mode="fire"]::before{background:radial-gradient(42% 52% at 50% 56%,rgba(255,158,94,.42),transparent 58%),repeating-linear-gradient(84deg,transparent 0 44px,rgba(255,158,94,.18) 45px,transparent 48px)}
        .sf-element-field[data-mode="water"]::before{background:repeating-radial-gradient(circle at 50% 40%,rgba(46,196,182,.26) 0 1px,transparent 2px 74px),radial-gradient(circle at 50% 40%,rgba(46,196,182,.3),transparent 36%)}
        .sf-element-field[data-mode="earth"]::before{background:linear-gradient(0deg,rgba(217,178,106,.34),transparent 38%),repeating-radial-gradient(circle at 50% 92%,rgba(217,178,106,.2) 0 2px,transparent 3px 54px)}
        .sf-element-field[data-mode="align"]::before{background:linear-gradient(90deg,transparent 46%,rgba(255,222,186,.42) 50%,transparent 54%),radial-gradient(circle at 50% 38%,rgba(255,222,186,.28),transparent 44%)}
        .sf-element-glyph{position:absolute;right:clamp(28px,7vw,120px);top:clamp(92px,14vh,150px);font-family:var(--font-display);font-size:clamp(4rem,10vw,11rem);font-weight:700;color:var(--accent);opacity:.075;line-height:.9;text-shadow:0 0 44px var(--accent);transform:translateZ(0)}
        .sf-power-line{position:absolute;left:var(--focus-x);top:var(--focus-y);width:min(46vw,760px);height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.36;filter:drop-shadow(0 0 9px var(--accent));transform-origin:0 50%;animation:sfStream 2.9s linear infinite}
        .sf-power-a{transform:rotate(205deg)}
        .sf-power-b{transform:rotate(158deg);animation-delay:.45s}
        .sf-power-c{transform:rotate(242deg);animation-delay:.9s}
        .sf-proof{position:relative;background:linear-gradient(180deg,#04060a,#080b12);border-top:1px solid rgba(151,168,205,.12);padding:clamp(64px,9vw,112px) 24px}
        .sf-proof-inner{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:minmax(260px,360px) 1fr;gap:clamp(28px,5vw,74px);align-items:start}
        .sf-proof-eyebrow{font-family:var(--font-eyebrow);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#f5b572;margin-bottom:14px}
        .sf-proof h2{font-family:var(--font-display);font-size:clamp(2rem,4vw,3.6rem);font-weight:650;line-height:1.04;letter-spacing:0;color:#f6f8ff;margin:0}
        .sf-proof-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .sf-proof-card{min-height:230px;border:1px solid rgba(151,168,205,.15);border-radius:8px;background:linear-gradient(160deg,rgba(14,17,25,.9),rgba(8,10,16,.76));padding:22px;position:relative;overflow:hidden}
        .sf-proof-card::before{content:"";position:absolute;inset:auto -20% -40% -20%;height:70%;background:radial-gradient(circle at 50% 0,var(--accent),transparent 60%);opacity:.12;pointer-events:none}
        .sf-proof-orb{width:34px;height:34px;border-radius:50%;background:var(--accent);box-shadow:0 0 26px var(--accent);margin-bottom:42px}
        .sf-proof-k{font-family:var(--font-eyebrow);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
        .sf-proof-card h3{font-family:var(--font-display);font-size:1.35rem;line-height:1.1;letter-spacing:0;margin:0 0 10px;color:#f6f8ff}
        .sf-proof-card p{font-size:14px;line-height:1.6;color:#aab4cc;margin:0}
        .sf-navlink{transition:color .2s}
        .sf-navlink:hover{color:#fff}
        .sf-ctamini{transition:transform .2s, box-shadow .2s}
        .sf-ctamini:hover{transform:translateY(-1px);box-shadow:0 10px 26px -8px rgba(245,181,114,.55)}
        @keyframes sfFieldPulse{0%,100%{transform:scale(1);opacity:.2}50%{transform:scale(1.04);opacity:.32}}
        @keyframes sfStream{0%{clip-path:inset(0 100% 0 0);opacity:0}14%{opacity:.45}62%{clip-path:inset(0 0 0 0);opacity:.36}100%{clip-path:inset(0 0 0 100%);opacity:0}}
        .sf-core{animation:sfHeart 2.4s ease-in-out infinite}
        @keyframes sfHeart{0%,100%{transform:translate(-50%,-50%) scale(.92)}18%{transform:translate(-50%,-50%) scale(1.12)}32%{transform:translate(-50%,-50%) scale(1)}48%{transform:translate(-50%,-50%) scale(1.08)}}
        .sf-bounce{animation:sfB 1.6s ease-in-out infinite}
        @keyframes sfB{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}
        .st-cta .sf-arrow{transition:transform .2s}
        .st-cta:hover{box-shadow:0 16px 40px -10px rgba(245,181,114,.6)}
        .sf-tick:hover span:last-child{opacity:.85 !important;transform:translateX(0) !important}
        .sf-pins .sf-pin{display:flex;align-items:center;gap:8px;opacity:0}
        .sf-pins.sf-pins-on .sf-pin{animation:sfPin .55s cubic-bezier(.22,1,.36,1) forwards;animation-delay:var(--d)}
        @keyframes sfPin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .sf-pindot{width:9px;height:9px;border-radius:50%;flex:none}
        .sf-pinlabel{font-family:var(--font-body);font-size:11.5px;font-weight:600;color:#eef1fa;background:rgba(10,12,18,.55);border:1px solid rgba(151,168,205,.22);padding:5px 12px;border-radius:999px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);white-space:nowrap}
        @media (max-width:980px){.sf-proof-inner{grid-template-columns:1fr}.sf-proof-grid{grid-template-columns:1fr}.sf-story-panel{left:50%;right:auto;top:auto;bottom:max(42px,5vh);transform:translateX(-50%);width:min(680px,92vw);padding:18px 20px}.sf-story-scrim{background:linear-gradient(180deg,rgba(3,4,6,.22) 0%,transparent 30%,rgba(3,4,6,.92) 67%,rgba(3,4,6,.98) 100%)}}
        @media (max-width:880px){.sf-rail{display:none}.sf-navlinks a{display:none}.sf-element-glyph{right:20px;top:96px;font-size:clamp(3.6rem,18vw,7rem)}}
        @media (max-width:680px){.sf-pinlabel{font-size:10px;padding:4px 9px}.sf-pindot{width:7px;height:7px}.sf-story-panel h2{font-size:clamp(1.45rem,8vw,2.1rem)!important}.sf-proof-card{min-height:190px}.sf-power-line{width:86vw}}
      `}</style>
    </div>
  );
}
