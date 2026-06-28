// GuidedTour — the homepage centerpiece, directed like a film. A pinned, scroll-
// scrubbed sequence where a virtual CAMERA travels down the Divine Charioteer's body
// and each part IS a pillar of Sarathi: the mind = Hermes, the heart = Readiness, the
// hands = Form Coach, the core = the Vault, the foundation = the living Twin. The
// camera pushes in (Ken-Burns), a spotlight ignites the focal region in its accent,
// embers drift, and narrative copy reveals — then it pulls back to the ascended hero
// for the CTA. One rAF loop with inertial smoothing. Reduced-motion → stacked story.
import { useEffect, useRef, useState } from 'react';

const HERO = '/img/charioteer-hero.webp';
const ASCENDED = '/img/charioteer-ascended.webp';
const reduced = () => typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// focalY = where this body part sits on the figure (0 top … 1 feet). zoom = push-in.
const BEATS = [
  { eyebrow: 'the vehicle of the self', kicker: '', title: 'You are the chariot.', body: 'Your body carries you through every day. Sarathi is the charioteer that learns it, reads it, and steers it toward your own victory.', accent: '#f5b572', focalY: 0.42, zoom: 1.0, side: 'center' },
  { eyebrow: 'the mind · hermes', title: 'A coach that remembers.', body: 'Hermes lives in the mind of your Twin — reading every score, recalling every session, and speaking the one move that matters next.', accent: '#ffd9a8', focalY: 0.12, zoom: 1.55, side: 'left' },
  { eyebrow: 'the heart · readiness', title: 'It feels what you feel.', body: 'Sleep, HRV and strain converge into a single readiness score — so you know, in your chest, when to push and when to rest.', accent: '#5fd0bd', focalY: 0.30, zoom: 1.5, side: 'right', ring: 84 },
  { eyebrow: 'the hands · form coach', title: 'It watches every rep.', body: 'Point your camera and the Form Coach counts and grades each rep on-device. Your hands, perfected — and nothing ever leaves your phone.', accent: '#7fd4f0', focalY: 0.40, zoom: 1.42, side: 'left' },
  { eyebrow: 'the core · the vault', title: 'Its memory is yours.', body: 'Every reading, meal and lift is written to a Health Vault in open Markdown that you own forever. Your core — exportable, and never sold.', accent: '#4cc9f0', focalY: 0.47, zoom: 1.5, side: 'right', vault: true },
  { eyebrow: 'the foundation · the twin', title: 'It grows as you do.', body: 'Train, and the muscle you worked lights up and grows on your living Twin. Strength made visible — built from the ground up.', accent: '#f5b572', focalY: 0.72, zoom: 1.4, side: 'left' },
  { eyebrow: 'become', title: 'Meet your Twin.', body: 'Sixty seconds to begin. A lifetime that’s yours.', accent: '#ffdeba', focalY: 0.45, zoom: 1.0, side: 'center', cta: true },
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
  const spotRef = useRef(null);
  const burstRef = useRef(null);
  const markRef = useRef(null);
  const canvasRef = useRef(null);
  const panelRefs = useRef([]);
  const dotRefs = useRef([]);
  const auraRef = useRef('#f5b572');
  const lastBeat = useRef(-1);

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
      cur += (target - cur) * 0.08;
      px += (tpx - px) * 0.05; py += (tpy - py) * 0.05;
      const intro = 1 - Math.pow(1 - clamp((now - introStart) / 1300, 0, 1), 3);

      const f = cur * (N - 1);
      const i = clamp(Math.floor(f), 0, N - 2);
      const frac = f - i;
      const a = BEATS[i], b = BEATS[i + 1];
      const accent = mix(a.accent, b.accent, frac);
      auraRef.current = accent;

      // ---- the CAMERA: frame the focal body part, centered + pushed in ----
      const focal = lerp(a.focalY, b.focalY, frac);
      const zoom = lerp(a.zoom, b.zoom, frac) * lerp(1.06, 1, intro);
      const floatY = Math.sin(t * 1.0) * 0.5;                 // gentle life
      const ty = (0.5 - focal) * 100 + floatY;                // center the part vertically
      const tilt = mobile ? 0 : px * 5;
      const camT = `translate(calc(-50% + ${(px * 1.5).toFixed(2)}%), ${ty.toFixed(2)}%) scale(${zoom.toFixed(3)}) rotateY(${tilt.toFixed(2)}deg)`;
      const setCam = (el, op) => { if (!el) return; el.style.transformOrigin = `50% ${(focal * 100).toFixed(1)}%`; el.style.transform = camT; el.style.opacity = op.toFixed(3); };
      const ascend = clamp((f - (N - 2)) / 1, 0, 1);
      setCam(heroRef.current, (1 - ascend) * intro);
      setCam(ascRef.current, ascend * intro);
      if (stageRef.current) stageRef.current.style.opacity = intro.toFixed(3);

      // ---- spotlight: ignite the centered focal region in the accent ----
      if (spotRef.current) {
        spotRef.current.style.background =
          `radial-gradient(circle at 50% 48%, ${accent}30 0%, transparent 26%),` +
          `radial-gradient(circle at 50% 48%, transparent 30%, rgba(4,6,10,.5) 64%, rgba(4,6,10,.92) 100%)`;
      }

      // ---- focus reticle: ignites as the lens pushes into a body part ----
      if (markRef.current) { markRef.current.style.borderColor = accent; markRef.current.style.opacity = clamp((zoom - 1.06) * 1.6, 0, 0.5).toFixed(3); }

      // ---- panels ----
      panelRefs.current.forEach((el, k) => {
        if (!el) return;
        const d = f - k;
        const op = clamp(1 - Math.abs(d) * 1.7, 0, 1);
        el.style.opacity = (op * intro).toFixed(3);
        el.style.transform = `translateY(${(d * (mobile ? 16 : 26)).toFixed(1)}px)`;
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

  // starfield depth + aura embers
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || reduced()) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, vis = true, raf = 0, t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const stars = [], P = [];
    const NS = mobile ? 50 : 110, NP = mobile ? 26 : 56;
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const resetP = (p, init) => { p.x = Math.random() * W; p.y = init ? Math.random() * H : H + 8; p.r = 0.6 + Math.random() * 2.4; p.s = 0.2 + Math.random() * 0.9; p.d = (Math.random() - 0.5) * 0.4; p.a = 0.12 + Math.random() * 0.5; };
    size();
    for (let k = 0; k < NS; k++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7, r: Math.random() * 1.3, ph: Math.random() * 6.28 });
    for (let k = 0; k < NP; k++) { const p = {}; resetP(p, true); P.push(p); }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!vis || document.hidden) return;
      t += 0.016; ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      for (const s of stars) { ctx.globalAlpha = 0.1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.ph)) * s.z; ctx.fillStyle = '#cfe0ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.z, 0, 6.2832); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter';
      const col = auraRef.current;
      for (const p of P) { p.y -= p.s; p.x += p.d; if (p.y < -8) resetP(p, false); ctx.beginPath(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 9; ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin((p.y + p.x) * 0.02)); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    };
    loop();
    const io = new IntersectionObserver((es) => es.forEach((e) => { vis = e.isIntersecting; }), { threshold: 0 });
    io.observe(cv); const rs = () => size(); window.addEventListener('resize', rs);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', rs); };
  }, [mobile]);

  if (reduced()) return <StackedFallback onStart={onStart} />;

  const edgeMask = 'radial-gradient(120% 100% at 50% 46%, #000 70%, transparent 100%)';
  const charBase = { position: 'absolute', left: '50%', top: 0, height: '100%', transformOrigin: '50% 42%', willChange: 'transform,opacity', WebkitMaskImage: edgeMask, maskImage: edgeMask, perspective: 800 };

  return (
    <section ref={outerRef} style={{ position: 'relative', height: `${N * 100}vh` }}>
      <div ref={stageRef} style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', opacity: 0 }}>
        {/* the camera subject */}
        <img ref={heroRef} src={HERO} alt="Sarathi — the Divine Charioteer" draggable={false} style={charBase} />
        <img ref={ascRef} src={ASCENDED} alt="" aria-hidden draggable={false} style={{ ...charBase, opacity: 0 }} />

        {/* spotlight that ignites the focal body part */}
        <div ref={spotRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div ref={burstRef} aria-hidden style={{ position: 'absolute', left: '50%', top: '48%', width: 'min(58vh,520px)', aspectRatio: '1', transform: 'translate(-50%,-50%)', border: '2px solid #f5b572', borderRadius: '50%', opacity: 0 }} />
        <div ref={markRef} aria-hidden style={{ position: 'absolute', left: '50%', top: '48%', width: 'min(44vh,360px)', aspectRatio: '1', transform: 'translate(-50%,-50%)', border: '1px solid #f5b572', borderRadius: '50%', opacity: 0 }} />
        <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* narrative panels */}
        {BEATS.map((bt, k) => {
          const pos = mobile
            ? { left: 0, right: 0, bottom: '6%', top: 'auto', maxWidth: 'none', textAlign: 'center', alignItems: 'center', padding: '0 22px' }
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
        @keyframes gtBurst{0%{opacity:.7;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}
        @keyframes gtHint{0%,100%{opacity:.4;transform:translateX(-50%) translateY(0)}50%{opacity:.9;transform:translateX(-50%) translateY(4px)}}
        .gt-hint{animation:gtHint 2s ease-in-out infinite}
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

function Vault({ accent }) {
  const nodes = [[40, 30], [110, 22], [170, 48], [28, 86], [96, 80], [156, 96], [70, 128], [140, 132]];
  const links = [[0, 1], [1, 2], [0, 4], [1, 4], [2, 5], [3, 4], [4, 6], [4, 5], [5, 7], [6, 7]];
  return (
    <svg width="190" height="145" viewBox="0 0 200 150" style={{ marginTop: 16 }}>
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
