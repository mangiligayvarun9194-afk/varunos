// CharioteerStage — the cinematic character layer for the homepage. Frames the
// original Divine Charioteer-Warrior render and surrounds it with code-driven VFX:
// a breathing gold halo bloom, volumetric god-rays, rising ember particles, idle
// float + breathing, and multi-depth cursor parallax. Pure DOM/Canvas (no WebGL),
// reduced-motion aware, and the ember loop pauses when offscreen.
import { useEffect, useRef } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function CharioteerStage({
  src, alt = 'Sarathi — the Divine Charioteer', aura = '#f5b572', scale = 1, dim = 0, offsetX = 50,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  // multi-depth cursor parallax → CSS vars on the wrapper
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || reduced()) return;
    let px = 0, py = 0, tx = 0, ty = 0, raf = 0;
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5);
      ty = (e.clientY / window.innerHeight - 0.5);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      wrap.style.setProperty('--px', px.toFixed(3));
      wrap.style.setProperty('--py', py.toFixed(3));
      raf = (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);

  // rising gold ember particles (capped, paused offscreen)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || reduced()) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), visible = true;
    const N = window.innerWidth < 760 ? 26 : 48;
    const P = [];
    const reset = (p, init) => {
      p.x = Math.random() * W; p.y = init ? Math.random() * H : H + 10;
      p.r = 0.6 + Math.random() * 2.2; p.s = 0.2 + Math.random() * 0.7;
      p.drift = (Math.random() - 0.5) * 0.3; p.a = 0.15 + Math.random() * 0.5;
    };
    const size = () => {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    for (let i = 0; i < N; i++) { const p = {}; reset(p, true); P.push(p); }
    const col = aura;
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        p.y -= p.s; p.x += p.drift;
        if (p.y < -10) reset(p, false);
        ctx.beginPath();
        ctx.fillStyle = col;
        ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin((p.y + p.x) * 0.02));
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    };
    loop();
    const io = new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; }), { threshold: 0 });
    io.observe(cv);
    const onResize = () => size();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(rafRef.current); io.disconnect(); window.removeEventListener('resize', onResize); };
  }, [aura]);

  return (
    <div ref={wrapRef} className="char-stage" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* volumetric god-rays from above */}
      <div className="char-rays" aria-hidden style={{
        position: 'absolute', left: '50%', top: '-30%', width: '120%', height: '120%', transform: 'translateX(-50%)',
        background: `conic-gradient(from 200deg at 50% 0%, transparent, ${aura}22, transparent 18%, transparent, ${aura}1c, transparent 38%)`,
        filter: 'blur(14px)', opacity: 0.7, mixBlendMode: 'screen',
      }} />
      {/* breathing halo bloom behind the figure */}
      <div className="char-halo" aria-hidden style={{
        position: 'absolute', left: `calc(${offsetX}% + var(--px,0)*40px)`, top: 'calc(34% + var(--py,0)*26px)',
        width: 'min(62vh, 560px)', aspectRatio: '1', transform: 'translate(-50%,-50%)',
        background: `radial-gradient(circle, ${aura}55 0%, ${aura}22 32%, transparent 64%)`,
        filter: 'blur(6px)',
      }} />
      {/* the character */}
      <img className="char-fig" src={src} alt={alt} draggable={false} style={{
        position: 'absolute', left: `calc(${offsetX}% + var(--px,0)*-22px)`, bottom: 0,
        height: '92%', maxWidth: 'none', transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'bottom center',
        filter: dim ? `brightness(${1 - dim * 0.45}) saturate(${1 - dim * 0.5})` : 'none',
        transition: 'filter .6s ease, transform .6s cubic-bezier(.22,1,.36,1)',
        WebkitMaskImage: 'linear-gradient(180deg,#000 86%,transparent)', maskImage: 'linear-gradient(180deg,#000 86%,transparent)',
      }} />
      {/* embers */}
      <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {/* grounding floor glow */}
      <div aria-hidden style={{ position: 'absolute', left: '50%', bottom: '-4%', width: '70%', height: '24%', transform: 'translateX(-50%)',
        background: `radial-gradient(50% 60% at 50% 50%, ${aura}33, transparent 70%)`, filter: 'blur(18px)' }} />
      <style>{`
        @keyframes charFloat{0%,100%{transform:translateX(-50%) scale(${scale}) translateY(0)}50%{transform:translateX(-50%) scale(${scale}) translateY(-1.4%)}}
        @keyframes charHalo{0%,100%{opacity:.78;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}
        @keyframes charRays{0%,100%{opacity:.55;transform:translateX(-50%) rotate(-3deg)}50%{opacity:.85;transform:translateX(-50%) rotate(3deg)}}
        .char-fig{animation:charFloat 6.5s ease-in-out infinite}
        .char-halo{animation:charHalo 5s ease-in-out infinite}
        .char-rays{animation:charRays 12s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.char-fig,.char-halo,.char-rays{animation:none}}
      `}</style>
    </div>
  );
}
