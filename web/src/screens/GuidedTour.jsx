// GuidedTour — the homepage centerpiece. A pinned, scroll-scrubbed cinematic tour
// where the Divine Charioteer stays dominant on stage and LEADS the visitor through
// each Sarathi feature: as you scroll, he re-frames/scales, the aura shifts hue, an
// energy burst fires on every beat change, and the matching feature panel crossfades
// in. Driven imperatively from one rAF scroll loop (no per-frame React re-render) for
// buttery scrubbing. Reduced-motion → a clean stacked fallback.
import { useEffect, useRef } from 'react';

const HERO = '/img/charioteer-hero.png';
const ASCENDED = '/img/charioteer-ascended.png';
const reduced = () => typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// side: where the feature copy sits → the character drifts the opposite way.
const BEATS = [
  { eyebrow: 'सारथि · the charioteer', title: 'Meet your Sarathi.', body: 'The body is the chariot. The senses, its horses. Sarathi is the guiding intelligence that steers you to your own victory.', accent: '#f5b572', side: 'center', scale: 1.0 },
  { eyebrow: '01 · the living twin', title: 'This is you, rendered.', body: 'A living Twin that grows as you train — every muscle, every level, made visible.', accent: '#f5b572', side: 'left', scale: 1.05 },
  { eyebrow: '02 · hermes', title: 'Your guiding light.', body: 'A personal AI coach that reads your scores and speaks the next move — every day.', accent: '#ffd9a8', side: 'right', scale: 1.08 },
  { eyebrow: '03 · form coach', title: 'The camera that coaches.', body: 'On-device pose AI counts your reps and grades your form in real time. Nothing leaves your phone.', accent: '#7fd4f0', side: 'left', scale: 1.11 },
  { eyebrow: '04 · readiness', title: 'Recover as hard as you train.', body: 'Sleep, HRV and strain become one readiness score — so you know when to push and when to rest.', accent: '#5fd0bd', side: 'right', scale: 1.14, ring: 84 },
  { eyebrow: '05 · the vault', title: 'Yours. Forever.', body: 'A Health Vault in open Markdown that you own and export anytime. No lock-in, no data sold.', accent: '#4cc9f0', side: 'left', scale: 1.17, vault: true },
  { eyebrow: 'become', title: 'Meet your Twin.', body: 'Sixty seconds to set up. A lifetime that’s yours.', accent: '#ffdeba', side: 'center', scale: 1.24, cta: true },
];
const N = BEATS.length;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (h1, h2, t) => { const a = hex(h1), b = hex(h2); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; };

export default function GuidedTour({ onStart }) {
  const outerRef = useRef(null);
  const stageRef = useRef(null);
  const heroRef = useRef(null);
  const ascRef = useRef(null);
  const haloRef = useRef(null);
  const raysRef = useRef(null);
  const washRef = useRef(null);
  const floorRef = useRef(null);
  const burstRef = useRef(null);
  const canvasRef = useRef(null);
  const panelRefs = useRef([]);
  const dotRefs = useRef([]);
  const auraRef = useRef('#f5b572');     // live aura color for the ember loop
  const lastBeat = useRef(-1);

  // ---- imperative scroll choreography ----
  useEffect(() => {
    if (reduced()) return;        // stacked fallback handles motionless mode
    let raf = 0;
    const apply = () => {
      raf = 0;
      const outer = outerRef.current; if (!outer) return;
      const total = outer.offsetHeight - window.innerHeight;
      const top = outer.getBoundingClientRect().top;
      const p = clamp(-top / (total || 1), 0, 1);
      const f = p * (N - 1);
      const i = clamp(Math.floor(f), 0, N - 2);
      const frac = f - i;
      const a = BEATS[i], b = BEATS[i + 1];

      // accent (aura) + character scale + horizontal drift (opposite the copy)
      const accent = mix(a.accent, b.accent, frac);
      auraRef.current = accent;
      const sideX = (s) => (s === 'left' ? 16 : s === 'right' ? -16 : 0);
      const x = lerp(sideX(a.side), sideX(b.side), frac);
      const sc = lerp(a.scale, b.scale, frac);
      const hero = heroRef.current, asc = ascRef.current;
      const charT = `translateX(calc(-50% + ${x.toFixed(2)}vw)) scale(${sc.toFixed(3)})`;
      if (hero) hero.style.transform = charT;
      if (asc) asc.style.transform = charT;
      // crossfade to the ascended render across the final beat
      const ascend = clamp((f - (N - 2)) / 1, 0, 1);
      if (hero) hero.style.opacity = (1 - ascend).toFixed(3);
      if (asc) asc.style.opacity = ascend.toFixed(3);

      // VFX layers tinted + scaled
      if (haloRef.current) {
        haloRef.current.style.background = `radial-gradient(circle, ${accent}66 0%, ${accent}26 34%, transparent 66%)`;
        haloRef.current.style.transform = `translate(-50%,-50%) scale(${(0.9 + sc * 0.25).toFixed(3)})`;
      }
      if (raysRef.current) raysRef.current.style.background = `conic-gradient(from 200deg at 50% 0%, transparent, ${accent}26, transparent 16%, transparent, ${accent}1f, transparent 36%)`;
      if (washRef.current) washRef.current.style.background = `radial-gradient(60% 55% at 50% 42%, ${accent}1f, transparent 70%)`;
      if (floorRef.current) floorRef.current.style.background = `radial-gradient(50% 60% at 50% 50%, ${accent}40, transparent 70%)`;

      // panels: opacity + slide by proximity to their beat
      panelRefs.current.forEach((el, k) => {
        if (!el) return;
        const d = f - k;
        const op = clamp(1 - Math.abs(d) * 1.7, 0, 1);
        el.style.opacity = op.toFixed(3);
        el.style.transform = `translateY(${(d * 26).toFixed(1)}px)`;
        el.style.pointerEvents = op > 0.6 ? 'auto' : 'none';
      });
      dotRefs.current.forEach((el, k) => { if (el) el.style.opacity = (Math.round(f) === k ? '1' : '0.3'); });

      // energy burst on beat change
      const cur = Math.round(f);
      if (cur !== lastBeat.current) {
        lastBeat.current = cur;
        const bu = burstRef.current;
        if (bu) { bu.style.borderColor = accent; bu.style.animation = 'none'; void bu.offsetWidth; bu.style.animation = 'gtBurst 1.1s cubic-bezier(.22,1,.36,1)'; }
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // ---- ember particles ----
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || reduced()) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, vis = true, raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const P = [];
    const NP = window.innerWidth < 760 ? 36 : 70;
    const reset = (p, init) => { p.x = Math.random() * W; p.y = init ? Math.random() * H : H + 8; p.r = 0.6 + Math.random() * 2.6; p.s = 0.2 + Math.random() * 0.9; p.d = (Math.random() - 0.5) * 0.4; p.a = 0.12 + Math.random() * 0.5; };
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); for (let k = 0; k < NP; k++) { const p = {}; reset(p, true); P.push(p); }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!vis || document.hidden) return;
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
      const col = auraRef.current;
      for (const p of P) { p.y -= p.s; p.x += p.d; if (p.y < -8) reset(p, false);
        ctx.beginPath(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 9;
        ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin((p.y + p.x) * 0.02)); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    };
    loop();
    const io = new IntersectionObserver((es) => es.forEach((e) => { vis = e.isIntersecting; }), { threshold: 0 });
    io.observe(cv); const rs = () => size(); window.addEventListener('resize', rs);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', rs); };
  }, []);

  if (reduced()) return <StackedFallback onStart={onStart} />;

  return (
    <section ref={outerRef} style={{ position: 'relative', height: `${N * 100}vh` }}>
      <div ref={stageRef} style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        {/* VFX backdrop */}
        <div ref={washRef} aria-hidden style={{ position: 'absolute', inset: 0 }} />
        <div ref={raysRef} className="gt-rays" aria-hidden style={{ position: 'absolute', left: '50%', top: '-30%', width: '130%', height: '130%', transform: 'translateX(-50%)', filter: 'blur(16px)', mixBlendMode: 'screen', opacity: 0.8 }} />
        <div ref={haloRef} className="gt-halo" aria-hidden style={{ position: 'absolute', left: '50%', top: '40%', width: 'min(70vh,640px)', aspectRatio: '1', transform: 'translate(-50%,-50%)', filter: 'blur(6px)' }} />
        <div ref={burstRef} aria-hidden style={{ position: 'absolute', left: '50%', top: '42%', width: 'min(60vh,520px)', aspectRatio: '1', transform: 'translate(-50%,-50%)', border: '2px solid #f5b572', borderRadius: '50%', opacity: 0 }} />

        {/* the Charioteer — dominant, center stage */}
        <img ref={heroRef} className="gt-char" src={HERO} alt="Sarathi — the Divine Charioteer" draggable={false}
          style={{ position: 'absolute', left: '50%', bottom: '-2%', height: '94%', transform: 'translateX(-50%)', transformOrigin: 'bottom center',
            WebkitMaskImage: 'linear-gradient(180deg,#000 88%,transparent)', maskImage: 'linear-gradient(180deg,#000 88%,transparent)', willChange: 'transform,opacity' }} />
        <img ref={ascRef} src={ASCENDED} alt="" aria-hidden draggable={false}
          style={{ position: 'absolute', left: '50%', bottom: '-2%', height: '94%', transform: 'translateX(-50%)', transformOrigin: 'bottom center', opacity: 0,
            WebkitMaskImage: 'linear-gradient(180deg,#000 88%,transparent)', maskImage: 'linear-gradient(180deg,#000 88%,transparent)', willChange: 'transform,opacity' }} />

        <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div ref={floorRef} aria-hidden style={{ position: 'absolute', left: '50%', bottom: '-4%', width: '70%', height: '22%', transform: 'translateX(-50%)', filter: 'blur(20px)' }} />
        {/* vignette for legibility */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(130% 100% at 50% 15%, transparent 45%, rgba(0,0,0,.6) 100%)' }} />

        {/* feature panels (one per beat, crossfaded by scroll) */}
        {BEATS.map((bt, k) => (
          <div key={k} ref={(el) => (panelRefs.current[k] = el)}
            style={{ position: 'absolute', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '0 7vw', maxWidth: 540, opacity: 0, willChange: 'opacity,transform',
              ...(bt.side === 'left' ? { left: 0, textAlign: 'left', alignItems: 'flex-start' }
                : bt.side === 'right' ? { right: 0, textAlign: 'right', alignItems: 'flex-end' }
                : { left: '50%', transform: 'translateX(-50%)', textAlign: 'center', alignItems: 'center' }) }}>
            <p style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 12, letterSpacing: '.3em', textTransform: 'uppercase', color: bt.accent, marginBottom: 16 }}>{bt.eyebrow}</p>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(34px,5.2vw,68px)', lineHeight: 1.02, letterSpacing: '-.03em', marginBottom: 16,
              textShadow: '0 4px 40px rgba(0,0,0,.6)' }}>{bt.title}</h2>
            <p style={{ color: '#cfd8ea', fontSize: 'clamp(15px,1.5vw,18px)', lineHeight: 1.6, maxWidth: 440, textShadow: '0 2px 20px rgba(0,0,0,.7)' }}>{bt.body}</p>
            {bt.ring && <Ring value={bt.ring} accent={bt.accent} />}
            {bt.vault && <Vault accent={bt.accent} />}
            {bt.cta && (
              <div style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn primary lp-cta" onClick={onStart} style={{ padding: '15px 30px', fontSize: 15 }}>Build your Twin</button>
                <button onClick={onStart} style={{ background: 'none', border: 'none', color: '#9aa6c2', cursor: 'pointer', fontSize: 14, alignSelf: 'center' }}>I already have an account →</button>
              </div>
            )}
          </div>
        ))}

        {/* beat dots */}
        <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BEATS.map((_, k) => (
            <div key={k} ref={(el) => (dotRefs.current[k] = el)} style={{ width: 7, height: 7, borderRadius: '50%', background: '#f5b572', opacity: k === 0 ? 1 : 0.3, transition: 'opacity .3s' }} />
          ))}
        </div>
        {/* scroll hint */}
        <div className="gt-hint" aria-hidden style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7d88a6' }}>scroll ↓</div>
      </div>

      <style>{`
        @keyframes gtHalo{0%,100%{opacity:.82}50%{opacity:1}}
        @keyframes gtRays{0%,100%{transform:translateX(-50%) rotate(-4deg)}50%{transform:translateX(-50%) rotate(4deg)}}
        @keyframes gtFloat{0%,100%{margin-bottom:0}50%{margin-bottom:1.2vh}}
        @keyframes gtBurst{0%{opacity:.7;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}
        @keyframes gtHint{0%,100%{opacity:.4;transform:translateX(-50%) translateY(0)}50%{opacity:.9;transform:translateX(-50%) translateY(4px)}}
        .gt-halo{animation:gtHalo 5s ease-in-out infinite}
        .gt-rays{animation:gtRays 14s ease-in-out infinite}
        .gt-char{animation:gtFloat 6.5s ease-in-out infinite}
        .gt-hint{animation:gtHint 2s ease-in-out infinite}
      `}</style>
    </section>
  );
}

function Ring({ value = 84, accent }) {
  const R = 54, C = 2 * Math.PI * R;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ marginTop: 22, filter: `drop-shadow(0 0 16px ${accent}55)` }}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(151,168,205,.14)" strokeWidth="9" />
      <circle cx="70" cy="70" r={R} fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)} transform="rotate(-90 70 70)" />
      <text x="70" y="66" textAnchor="middle" fill="#f2f5fc" style={{ fontSize: 34, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</text>
      <text x="70" y="88" textAnchor="middle" fill="#8e9ab8" style={{ fontSize: 9, letterSpacing: '.16em', fontFamily: 'var(--font-eyebrow)' }}>READY</text>
    </svg>
  );
}

function Vault({ accent }) {
  const nodes = [[40, 30], [110, 22], [170, 48], [28, 86], [96, 80], [156, 96], [70, 128], [140, 132]];
  const links = [[0, 1], [1, 2], [0, 4], [1, 4], [2, 5], [3, 4], [4, 6], [4, 5], [5, 7], [6, 7]];
  return (
    <svg width="200" height="150" viewBox="0 0 200 150" style={{ marginTop: 20 }}>
      {links.map(([a, b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={accent} strokeOpacity="0.4" strokeWidth="1" />)}
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />)}
    </svg>
  );
}

// Motionless / reduced-motion fallback: stacked beats, character at top.
function StackedFallback({ onStart }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '90px 24px 60px' }}>
      <img src={HERO} alt="Sarathi — the Divine Charioteer" style={{ display: 'block', width: 'min(280px,70vw)', margin: '0 auto 30px' }} />
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
