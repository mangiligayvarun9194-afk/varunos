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
    eyebrow: 'सारथि · private ai health os', title: 'Own your health.\nTalk to it.\nWatch yourself level up.',
    body: 'Your body is the field where every battle is fought — and won. Sarathi, the charioteer, knows the field: he reads the five elements in you and brings them into balance.', shloka: null },
  { id: 'akasha',  w: 1.1,  mode: 'space', accent: '#c5b3ff', cam: { s: 2.35, fx: 50, fy: 9 }, word: 'आकाश', el: 'space',
    eyebrow: '01 · akasha · space · the mind', title: 'Space remembers.',
    body: 'Hermes is your Akasha: every session, every meal, every heartbeat written into living memory — guidance that speaks with your whole history behind it.',
    shloka: { sa: 'mattaḥ smṛtir jñānam', en: 'from me: memory, and knowing', src: 'Gita 15.15' } },
  { id: 'vayu',    w: 1.1,  mode: 'air',   accent: '#7fd4f0', cam: { s: 1.9,  fx: 50, fy: 22 }, word: 'वायु', el: 'air',
    eyebrow: '02 · vayu · air · the breath', title: 'Air moves you.',
    body: 'The five winds move everything within you — breath and body alike. Sarathi reads motion the way a charioteer reads the wind: every rep counted, graded, corrected live.',
    shloka: { sa: 'prāṇāpāna-samāyuktaḥ', en: 'joined with the winds of breath', src: 'Gita 15.14' } },
  { id: 'agni',    w: 1.1,  mode: 'fire',  accent: '#ff9e5e', cam: { s: 2.5,  fx: 50, fy: 48 }, word: 'अग्नि', el: 'fire',
    eyebrow: '03 · agni · fire · the furnace', title: 'Fire transforms you.',
    body: 'The Gita names the fire in your belly: Vaiśvānara, digester of all food. Log any meal in one line — Sarathi reads the fuel and keeps the flame clean.',
    shloka: { sa: 'ahaṁ vaiśvānaro bhūtvā', en: 'I am the fire that digests all food', src: 'Gita 15.14' } },
  { id: 'apas',    w: 1.3,  mode: 'water', accent: '#2ec4b6', cam: { s: 2.3,  fx: 50, fy: 26 }, word: 'आपस्', el: 'water', core: true,
    eyebrow: '04 · apas · water · the tides', title: 'Water restores you.',
    body: 'The gods churned the ocean and it yielded amṛta — the nectar of immortality. Your nights are that churning: sleep, HRV and strain flow into one readiness score.',
    shloka: { sa: 'āpo hi ṣṭhā mayobhuvaḥ', en: 'O Waters, source of all wellbeing', src: 'Rig Veda 10.9' } },
  { id: 'prithvi', w: 1.1,  mode: 'earth', accent: '#d9b26a', cam: { s: 2.1,  fx: 50, fy: 80 }, word: 'पृथ्वी', el: 'earth',
    eyebrow: '05 · prithvi · earth · the foundation', title: 'Earth is what you build.',
    body: 'When the herb could not be found, Hanuman lifted the mountain. That is training: bone and muscle built grain by grain — your Twin grows visibly stronger as you do.',
    shloka: { sa: 'mātā bhūmiḥ putro ’haṁ pṛthivyāḥ', en: 'Earth is my mother; I am her son', src: 'Atharva Veda 12.1' } },
  { id: 'balance', w: 1.4,  mode: 'align', accent: '#ffdeba', cam: { s: 0.94, fx: 50, fy: 32 }, cta: true,
    eyebrow: 'the five in balance', title: 'When the five align, you rise.',
    body: 'Lift yourself by your own self, says the Gita — the self alone is the friend of the self. That friend is your Twin. Sixty seconds to begin.',
    shloka: { sa: 'ātmaiva hy ātmano bandhuḥ', en: 'the self alone is the friend of the self', src: 'Gita 6.5' } },
];
const TOTAL_W = SEGS.reduce((a, s) => a + s.w, 0);
const ELEMENTS = SEGS.filter((s) => s.el);
const ELEMENT_COLORS = ELEMENTS.map((s) => s.accent);

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

// ── persistent pill nav ─────────────────────────────────────────────────────
function Nav({ onStart }) {
  return (
    <nav style={{ position: 'fixed', top: 18, left: 0, right: 0, zIndex: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 22px', pointerEvents: 'none' }}>
      <div className="sf-pill" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#f2f5fc' }}>सारथि</span>
        <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#59648a' }}>Sarathi</span>
      </div>
      <div className="sf-pill sf-navlinks" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 26, padding: '10px 12px 10px 24px' }}>
        {['Story', 'Coach', 'Twin', 'Vault'].map((l) => (
          <a key={l} href="#" className="sf-navlink" style={{ fontSize: 13, fontWeight: 500, color: '#c7cfe2', textDecoration: 'none' }}>{l}</a>
        ))}
        <button onClick={onStart} className="sf-ctamini" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: '#1a0f06', background: GOLD, border: 'none', borderRadius: '999px', padding: '9px 16px', cursor: 'pointer' }}>
          Meet your Twin <Arrow size={13} />
        </button>
      </div>
    </nav>
  );
}

// ── the film ────────────────────────────────────────────────────────────────
export default function SarathiStory({ onStart }) {
  const rm = useReducedMotion() || reducedQ();
  const [seg, setSeg] = useState(0);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null), figRef = useRef(null), ambRef = useRef(null), cvRef = useRef(null), coreRef = useRef(null), hintRef = useRef(null), railFill = useRef(null), cardRef = useRef(null);
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
      // card presence: dip between segments (the breath, inside the film)
      if (cardRef.current) { const edge = Math.min(clamp01(p / 0.09), clamp01((1 - p) / 0.09)); cardRef.current.style.opacity = (0.25 + 0.75 * ease3(edge)).toFixed(3); }
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
        <Nav onStart={onStart} />
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
      <Nav onStart={onStart} />
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
          {/* legibility scrim behind the card zone */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(3,4,6,.42) 0%, transparent 18%, transparent 55%, rgba(3,4,6,.6) 100%)' }} />
          <div aria-hidden className="sf-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35, mixBlendMode: 'overlay' }} />

          {/* THE CARD — the single home of all words (Cula's pinned card, in obsidian) */}
          <div ref={cardRef} style={{ position: 'absolute', left: '50%', bottom: 'max(28px, 4.5vh)', transform: 'translateX(-50%)', width: 'min(880px, 92vw)', zIndex: 5,
            background: 'rgba(8,10,16,0.66)', border: '1px solid rgba(245,181,114,0.16)', borderRadius: 20, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            boxShadow: '0 30px 80px -30px rgba(0,0,0,.8)', padding: 'clamp(18px, 2.6vh, 28px) clamp(20px, 2.6vw, 34px)' }}>
            {/* enter-only keyed swap — AnimatePresence mode="wait" wedges under rapid
                scroll (interrupted exits never resolve; found by live QA) */}
              <motion.div key={S.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: S.accent, marginBottom: 10 }}>{S.eyebrow}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '8px 28px', justifyContent: 'space-between' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: seg === 0 ? 'clamp(1.5rem, 2.6vw, 2.2rem)' : 'clamp(1.7rem, 3vw, 2.6rem)', lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.02em', color: '#f6f8ff', margin: 0, whiteSpace: 'pre-line', flex: '1 1 340px' }}>{S.title}</h2>
                  {S.shloka && (
                    <div style={{ flex: '1 1 260px', maxWidth: 380, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: '#9aa6c4', textAlign: 'right' }}>
                      “{S.shloka.sa}”<br />{S.shloka.en} · <span style={{ fontStyle: 'normal', fontFamily: 'var(--font-eyebrow)', fontSize: 9.5, letterSpacing: '0.12em', color: S.accent, textTransform: 'uppercase' }}>{S.shloka.src}</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 'clamp(13px, 1.2vw, 15px)', lineHeight: 1.6, color: '#aab4cc', margin: '12px 0 0', maxWidth: '68ch' }}>{S.body}</p>
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
            </div>
          </div>

          {/* scroll to begin */}
          <div ref={hintRef} aria-hidden style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', zIndex: 4, textAlign: 'center', transition: 'opacity .6s', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9.5, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#8e9ab8' }}>scroll to begin</div>
            <div className="sf-bounce" style={{ color: '#8e9ab8', fontSize: 14, marginTop: 2 }}>↓</div>
          </div>
        </div>
      </div>

      <footer style={{ position: 'relative', padding: '28px 24px 40px', textAlign: 'center', color: '#59648a', fontSize: 12, background: '#04060a' }}>
        © {new Date().getFullYear()} Sarathi · Private AI Health OS · सारथि — <em>yatra yogeśvaraḥ, tatra vijayaḥ</em>
      </footer>

      <style>{`
        .sf-grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");background-size:180px 180px}
        .sf-pill{background:rgba(12,15,23,0.6);border:1px solid rgba(151,168,205,0.14);border-radius:999px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
        .sf-navlink{transition:color .2s}
        .sf-navlink:hover{color:#fff}
        .sf-ctamini{transition:transform .2s, box-shadow .2s}
        .sf-ctamini:hover{transform:translateY(-1px);box-shadow:0 10px 26px -8px rgba(245,181,114,.55)}
        .sf-core{animation:sfHeart 2.4s ease-in-out infinite}
        @keyframes sfHeart{0%,100%{transform:translate(-50%,-50%) scale(.92)}18%{transform:translate(-50%,-50%) scale(1.12)}32%{transform:translate(-50%,-50%) scale(1)}48%{transform:translate(-50%,-50%) scale(1.08)}}
        .sf-bounce{animation:sfB 1.6s ease-in-out infinite}
        @keyframes sfB{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}
        .st-cta .sf-arrow{transition:transform .2s}
        .st-cta:hover{box-shadow:0 16px 40px -10px rgba(245,181,114,.6)}
        .sf-tick:hover span:last-child{opacity:.85 !important;transform:translateX(0) !important}
        @media (max-width:880px){.sf-rail{display:none}.sf-navlinks a{display:none}}
      `}</style>
    </div>
  );
}
