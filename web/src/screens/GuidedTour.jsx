// GuidedTour — the homepage centerpiece. A pinned, scroll-scrubbed cinematic tour
// where the Divine Charioteer stays dominant and LEADS the visitor through each
// Sarathi feature. One continuous rAF loop drives everything imperatively with
// inertial smoothing (buttery scrub), a materialization intro, per-beat title
// reveals, cursor tilt/parallax, a starfield depth layer, ember particles, per-beat
// aura hue + energy bursts, and a crossfade to the ascended charioteer at the finale.
// Reduced-motion → a clean stacked fallback.
import { useEffect, useRef, useState } from 'react';

const HERO = '/img/charioteer-hero.png';
const ASCENDED = '/img/charioteer-ascended.png';
const reduced = () => typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (h1, h2, t) => { const a = hx(h1), b = hx(h2); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; };

export default function GuidedTour({ onStart }) {
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 760);
  useEffect(() => { const f = () => setMobile(window.innerWidth < 760); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

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
  const auraRef = useRef('#f5b572');
  const lastBeat = useRef(-1);

  // ---- one continuous rAF: smoothing + intro + pointer + choreography ----
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, t0 = performance.now(), introStart = performance.now();
    let cur = 0, px = 0, py = 0, tpx = 0, tpy = 0;
    const onMove = (e) => { tpx = e.clientX / window.innerWidth - 0.5; tpy = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener('pointermove', onMove, { passive: true });

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const t = (now - t0) / 1000;
      const outer = outerRef.current; if (!outer) return;
      const total = outer.offsetHeight - window.innerHeight;
      const top = outer.getBoundingClientRect().top;
      const target = clamp(-top / (total || 1), 0, 1);
      cur += (target - cur) * 0.085;                       // inertial scrub smoothing
      px += (tpx - px) * 0.05; py += (tpy - py) * 0.05;
      const intro = 1 - Math.pow(1 - clamp((now - introStart) / 1300, 0, 1), 3);

      const f = cur * (N - 1);
      const i = clamp(Math.floor(f), 0, N - 2);
      const frac = f - i;
      const a = BEATS[i], b = BEATS[i + 1];
      const accent = mix(a.accent, b.accent, frac);
      auraRef.current = accent;

      // character: scale + horizontal drift (opposite copy) + float + cursor tilt + intro
      const sideX = (s) => (mobile ? 0 : s === 'left' ? 16 : s === 'right' ? -16 : 0);
      const x = lerp(sideX(a.side), sideX(b.side), frac);
      const sc = lerp(a.scale, b.scale, frac) * (mobile ? 0.9 : 1) * lerp(1.08, 1, intro);
      const floatY = Math.sin(t * 1.1) * (mobile ? 0.6 : 1.1);
      const tilt = mobile ? 0 : px * 7;
      const charT = `translateX(calc(-50% + ${x.toFixed(2)}vw)) translateY(${floatY.toFixed(2)}vh) scale(${sc.toFixed(3)}) rotateY(${tilt.toFixed(2)}deg)`;
      if (heroRef.current) heroRef.current.style.transform = charT;
      if (ascRef.current) ascRef.current.style.transform = charT;
      const ascend = clamp((f - (N - 2)) / 1, 0, 1);
      if (heroRef.current) heroRef.current.style.opacity = ((1 - ascend) * intro).toFixed(3);
      if (ascRef.current) ascRef.current.style.opacity = (ascend * intro).toFixed(3);

      if (stageRef.current) stageRef.current.style.opacity = intro.toFixed(3);

      // VFX tints + halo scale + parallax drift
      const halo = haloRef.current;
      if (halo) {
        halo.style.background = `radial-gradient(circle, ${accent}66 0%, ${accent}26 34%, transparent 66%)`;
        halo.style.transform = `translate(calc(-50% + ${(px * 30).toFixed(1)}px), calc(-50% + ${(py * 18).toFixed(1)}px)) scale(${(0.9 + sc * 0.22).toFixed(3)})`;
      }
      if (raysRef.current) raysRef.current.style.background = `conic-gradient(from 200deg at 50% 0%, transparent, ${accent}28, transparent 16%, transparent, ${accent}20, transparent 36%)`;
      if (washRef.current) washRef.current.style.background = `radial-gradient(58% 52% at 50% 40%, ${accent}22, transparent 70%)`;
      if (floorRef.current) floorRef.current.style.background = `radial-gradient(50% 60% at 50% 50%, ${accent}44, transparent 70%)`;

      // panels: opacity + slide + active flag (drives the title blur-rise via CSS)
      panelRefs.current.forEach((el, k) => {
        if (!el) return;
        const d = f - k;
        const op = clamp(1 - Math.abs(d) * 1.7, 0, 1);
        el.style.opacity = (op * intro).toFixed(3);
        el.style.transform = mobile ? `translateY(${(d * 16).toFixed(1)}px)` : `translateY(${(d * 26).toFixed(1)}px)`;
        el.style.pointerEvents = op > 0.6 ? 'auto' : 'none';
        el.dataset.active = op > 0.75 ? '1' : '0';
      });
      dotRefs.current.forEach((el, k) => { if (el) el.style.opacity = (Math.round(f) === k ? '1' : '0.3'); });

      const beat = Math.round(f);
      if (beat !== lastBeat.current) {
        lastBeat.current = beat;
        const bu = burstRef.current;
        if (bu) { bu.style.borderColor = accent; bu.style.animation = 'none'; void bu.offsetWidth; bu.style.animation = 'gtBurst 1.1s cubic-bezier(.22,1,.36,1)'; }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); };
  }, [mobile]);

  // ---- starfield depth + ember particles (one canvas) ----
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || reduced()) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, vis = true, raf = 0, t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const stars = [], P = [];
    const NS = mobile ? 60 : 120, NP = mobile ? 30 : 64;
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const resetP = (p, init) => { p.x = Math.random() * W; p.y = init ? Math.random() * H : H + 8; p.r = 0.6 + Math.random() * 2.6; p.s = 0.2 + Math.random() * 0.9; p.d = (Math.random() - 0.5) * 0.4; p.a = 0.12 + Math.random() * 0.5; };
    size();
    for (let k = 0; k < NS; k++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7, r: Math.random() * 1.3, ph: Math.random() * 6.28 });
    for (let k = 0; k < NP; k++) { const p = {}; resetP(p, true); P.push(p); }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!vis || document.hidden) return;
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      // starfield (twinkle, faint)
      ctx.globalCompositeOperation = 'source-over';
      for (const s of stars) {
        ctx.globalAlpha = 0.12 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.ph)) * s.z;
        ctx.fillStyle = '#cfe0ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.z, 0, 6.2832); ctx.fill();
      }
      // embers (additive, aura-colored)
      ctx.globalCompositeOperation = 'lighter';
      const col = auraRef.current;
      for (const p of P) {
        p.y -= p.s; p.x += p.d; if (p.y < -8) resetP(p, false);
        ctx.beginPath(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 9;
        ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin((p.y + p.x) * 0.02)); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    };
    loop();
    const io = new IntersectionObserver((es) => es.forEach((e) => { vis = e.isIntersecting; }), { threshold: 0 });
    io.observe(cv); const rs = () => size(); window.addEventListener('resize', rs);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', rs); };
  }, [mobile]);

  if (reduced()) return <StackedFallback onStart={onStart} />;

  // Full-bleed bottom-anchored on both desktop and mobile so the render's dark
  // backdrop runs off-screen (no visible box); the panel sits over the lower body.
  const charBase = { position: 'absolute', left: '50%', bottom: '-2%', height: mobile ? '86%' : '94%', transform: 'translateX(-50%)', transformOrigin: 'bottom center' };
  // feather all edges so the render's dark rectangular backdrop never shows as a box
  const edgeMask = 'radial-gradient(118% 96% at 50% 44%, #000 66%, rgba(0,0,0,.35) 86%, transparent 100%)';
  const charMask = { WebkitMaskImage: edgeMask, maskImage: edgeMask, willChange: 'transform,opacity', perspective: 800 };

  return (
    <section ref={outerRef} style={{ position: 'relative', height: `${N * 100}vh` }}>
      <div ref={stageRef} style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', opacity: 0 }}>
        <div ref={washRef} aria-hidden style={{ position: 'absolute', inset: 0 }} />
        <div ref={raysRef} className="gt-rays" aria-hidden style={{ position: 'absolute', left: '50%', top: '-30%', width: '130%', height: '130%', transform: 'translateX(-50%)', filter: 'blur(16px)', mixBlendMode: 'screen', opacity: 0.85 }} />
        <div ref={haloRef} className="gt-halo" aria-hidden style={{ position: 'absolute', left: '50%', top: mobile ? '30%' : '40%', width: mobile ? 'min(46vh,320px)' : 'min(70vh,640px)', aspectRatio: '1', transform: 'translate(-50%,-50%)', filter: 'blur(6px)' }} />
        <div ref={burstRef} aria-hidden style={{ position: 'absolute', left: '50%', top: mobile ? '32%' : '42%', width: mobile ? 'min(42vh,300px)' : 'min(60vh,520px)', aspectRatio: '1', transform: 'translate(-50%,-50%)', border: '2px solid #f5b572', borderRadius: '50%', opacity: 0 }} />

        <img ref={heroRef} className="gt-char" src={HERO} alt="Sarathi — the Divine Charioteer" draggable={false} style={{ ...charBase, ...charMask, opacity: 0 }} />
        <img ref={ascRef} src={ASCENDED} alt="" aria-hidden draggable={false} style={{ ...charBase, ...charMask, opacity: 0 }} />

        <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div ref={floorRef} aria-hidden style={{ position: 'absolute', left: '50%', bottom: '-4%', width: '70%', height: '22%', transform: 'translateX(-50%)', filter: 'blur(20px)' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: mobile ? 'linear-gradient(180deg, rgba(0,0,0,.25) 0%, transparent 22%, rgba(0,0,0,.5) 52%, rgba(4,6,10,.95) 80%)' : 'radial-gradient(130% 100% at 50% 15%, transparent 45%, rgba(0,0,0,.6) 100%)' }} />

        {BEATS.map((bt, k) => {
          const pos = mobile
            ? { left: 0, right: 0, bottom: '6%', top: 'auto', maxWidth: 'none', textAlign: 'center', alignItems: 'center', padding: '0 22px' }
            : bt.side === 'left' ? { left: 0, textAlign: 'left', alignItems: 'flex-start' }
              : bt.side === 'right' ? { right: 0, textAlign: 'right', alignItems: 'flex-end' }
                : { left: '50%', transform: 'translateX(-50%)', textAlign: 'center', alignItems: 'center' };
          return (
            <div key={k} ref={(el) => (panelRefs.current[k] = el)} className="gt-panel" data-active="0"
              style={{ position: 'absolute', top: mobile ? 'auto' : 0, bottom: mobile ? '6%' : 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: mobile ? '0 22px' : '0 7vw', maxWidth: mobile ? 'none' : 540, opacity: 0, willChange: 'opacity,transform', ...pos }}>
              <p className="gt-eyebrow" style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 12, letterSpacing: '.3em', textTransform: 'uppercase', color: bt.accent, marginBottom: 14 }}>{bt.eyebrow}</p>
              <h2 className="display gt-title" style={{ fontWeight: 700, fontSize: mobile ? 'clamp(28px,8vw,40px)' : 'clamp(34px,5.2vw,68px)', lineHeight: 1.02, letterSpacing: '-.03em', marginBottom: 14, textShadow: '0 4px 40px rgba(0,0,0,.7)' }}>{bt.title}</h2>
              <p className="gt-body" style={{ color: '#d3dcec', fontSize: mobile ? 15 : 'clamp(15px,1.5vw,18px)', lineHeight: 1.6, maxWidth: 440, textShadow: '0 2px 20px rgba(0,0,0,.8)' }}>{bt.body}</p>
              {bt.ring && <Ring value={bt.ring} accent={bt.accent} />}
              {bt.vault && <Vault accent={bt.accent} />}
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
        @keyframes gtHalo{0%,100%{opacity:.82}50%{opacity:1}}
        @keyframes gtRays{0%,100%{transform:translateX(-50%) rotate(-4deg)}50%{transform:translateX(-50%) rotate(4deg)}}
        @keyframes gtBurst{0%{opacity:.7;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}
        @keyframes gtHint{0%,100%{opacity:.4;transform:translateX(-50%) translateY(0)}50%{opacity:.9;transform:translateX(-50%) translateY(4px)}}
        .gt-halo{animation:gtHalo 5s ease-in-out infinite}
        .gt-rays{animation:gtRays 14s ease-in-out infinite}
        .gt-hint{animation:gtHint 2s ease-in-out infinite}
        /* per-beat reveal: titles rise + de-blur, body + chrome fade, when the panel is active */
        .gt-panel .gt-title,.gt-panel .gt-eyebrow,.gt-panel .gt-body{transition:transform .7s cubic-bezier(.2,1,.3,1),filter .7s ease,opacity .6s ease}
        .gt-panel[data-active="0"] .gt-title{transform:translateY(26px);filter:blur(8px);opacity:0}
        .gt-panel[data-active="0"] .gt-eyebrow{opacity:0;transform:translateY(14px)}
        .gt-panel[data-active="0"] .gt-body{opacity:0;transform:translateY(14px)}
        .gt-panel[data-active="1"] .gt-title,.gt-panel[data-active="1"] .gt-eyebrow,.gt-panel[data-active="1"] .gt-body{transform:none;filter:none;opacity:1}
      `}</style>
    </section>
  );
}

function Ring({ value = 84, accent }) {
  const R = 54, C = 2 * Math.PI * R;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ marginTop: 20, filter: `drop-shadow(0 0 16px ${accent}55)` }}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(151,168,205,.14)" strokeWidth="9" />
      <circle cx="70" cy="70" r={R} fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)} transform="rotate(-90 70 70)" />
      <text x="70" y="66" textAnchor="middle" fill="#f2f5fc" style={{ fontSize: 34, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</text>
      <text x="70" y="88" textAnchor="middle" fill="#8e9ab8" style={{ fontSize: 9, letterSpacing: '.16em', fontFamily: 'var(--font-eyebrow)' }}>READY</text>
    </svg>
  );
}

function Vault({ accent }) {
  const nodes = [[40, 30], [110, 22], [170, 48], [28, 86], [96, 80], [156, 96], [70, 128], [140, 132]];
  const links = [[0, 1], [1, 2], [0, 4], [1, 4], [2, 5], [3, 4], [4, 6], [4, 5], [5, 7], [6, 7]];
  return (
    <svg width="200" height="150" viewBox="0 0 200 150" style={{ marginTop: 18 }}>
      {links.map(([a, b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={accent} strokeOpacity="0.4" strokeWidth="1" />)}
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />)}
    </svg>
  );
}

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
