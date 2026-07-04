// WeatherBackdrop — self-contained ambient weather layer for the Twin's world.
// Renders a pointer-events:none canvas plus a soft radial tint keyed to a
// preset from src/lib/weatherworld.js ({ mode, night, tint, intensity }).
//
// Discipline (matches the other canvas stages in this repo):
//   one rAF loop • particle counts ≤ 60 • DPR capped at 1.5 •
//   paused while document.hidden • fully disabled (tint only) under
//   prefers-reduced-motion • cleans up rAF + listeners on unmount.
import { useEffect, useRef, useState } from 'react';

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hexToRgba = (hex, a) => {
  const h = (hex || '#f5b572').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const rand = (a, b) => a + Math.random() * (b - a);

// ---- particle builders (all counts ≤ 60) ----------------------------------

function buildParticles(mode, intensity, W, H) {
  const P = [];
  if (mode === 'snow') {
    const n = Math.min(60, Math.round(34 + intensity * 26));
    for (let i = 0; i < n; i++) {
      P.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rand(1, 3.2), s: rand(0.25, 0.9),
        ph: Math.random() * Math.PI * 2, sw: rand(0.2, 0.7), a: rand(0.35, 0.85),
      });
    }
  } else if (mode === 'rain') {
    const n = Math.min(60, Math.round(26 + intensity * 34));
    for (let i = 0; i < n; i++) {
      P.push({
        x: Math.random() * (W + 80) - 40, y: Math.random() * H,
        len: rand(9, 22) * (0.7 + intensity * 0.5),
        s: rand(6, 11) * (0.6 + intensity * 0.7),
        a: rand(0.18, 0.4), bright: Math.random() < 0.1,
      });
    }
  } else if (mode === 'heat') {
    for (let i = 0; i < 9; i++) { // shimmer waves
      P.push({
        kind: 'wave', x: ((i + 0.5) / 9) * W, y: Math.random() * H,
        h: rand(H * 0.18, H * 0.4), s: rand(0.15, 0.45),
        ph: Math.random() * Math.PI * 2, amp: rand(3, 9), a: rand(0.05, 0.12),
      });
    }
    for (let i = 0; i < 22; i++) { // ember specks
      P.push({
        kind: 'ember', x: Math.random() * W, y: Math.random() * H,
        r: rand(0.5, 1.6), s: rand(0.15, 0.5),
        drift: rand(-0.15, 0.15), a: rand(0.1, 0.4),
      });
    }
  } else if (mode === 'fog') {
    const n = 4;
    for (let i = 0; i < n; i++) {
      P.push({
        x: Math.random() * W, y: rand(H * 0.15, H * 0.85),
        r: rand(Math.max(W, H) * 0.25, Math.max(W, H) * 0.45),
        s: rand(0.04, 0.12) * (Math.random() < 0.5 ? -1 : 1),
        a: rand(0.05, 0.11),
      });
    }
  } else { // clear — sparse floating motes
    for (let i = 0; i < 24; i++) {
      P.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rand(0.6, 2), sx: rand(-0.12, 0.12), sy: rand(-0.2, 0.05),
        ph: Math.random() * Math.PI * 2, a: rand(0.1, 0.5),
      });
    }
  }
  return P;
}

// ---- per-mode draw passes ---------------------------------------------------

function drawFrame(ctx, mode, tint, P, W, H, t) {
  ctx.clearRect(0, 0, W, H);
  if (mode === 'snow') {
    ctx.fillStyle = '#eaf2fb';
    for (const p of P) {
      p.y += p.s; p.ph += 0.012; p.x += Math.sin(p.ph) * p.sw;
      if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
      if (p.x < -6) p.x = W + 6; else if (p.x > W + 6) p.x = -6;
      ctx.globalAlpha = p.a;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (mode === 'rain') {
    const slant = 0.18;
    ctx.lineWidth = 1;
    for (const p of P) {
      p.y += p.s; p.x += p.s * slant;
      if (p.y > H + p.len) { p.y = -p.len; p.x = Math.random() * (W + 80) - 40; }
      ctx.globalAlpha = p.bright ? Math.min(1, p.a * 2.2) : p.a;
      ctx.strokeStyle = p.bright ? '#cdd8ff' : tint;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.len * slant, p.y - p.len);
      ctx.stroke();
    }
  } else if (mode === 'heat') {
    for (const p of P) {
      if (p.kind === 'wave') {
        p.y -= p.s; p.ph += 0.02;
        if (p.y + p.h < 0) { p.y = H; p.ph = Math.random() * Math.PI * 2; }
        ctx.globalAlpha = p.a;
        ctx.strokeStyle = tint;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let yy = 0; yy <= p.h; yy += 8) {
          const xx = p.x + Math.sin(p.ph + yy * 0.045 + t * 0.0012) * p.amp;
          yy === 0 ? ctx.moveTo(xx, p.y + yy) : ctx.lineTo(xx, p.y + yy);
        }
        ctx.stroke();
      } else {
        p.y -= p.s; p.x += p.drift;
        if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
        ctx.globalAlpha = p.a;
        ctx.fillStyle = '#ffc891';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (mode === 'fog') {
    for (const p of P) {
      p.x += p.s;
      if (p.x - p.r > W) p.x = -p.r; else if (p.x + p.r < 0) p.x = W + p.r;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, hexToRgba(tint, p.a));
      g.addColorStop(1, hexToRgba(tint, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  } else { // clear
    ctx.fillStyle = tint;
    for (const p of P) {
      p.ph += 0.008;
      p.x += p.sx + Math.sin(p.ph) * 0.08;
      p.y += p.sy;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      if (p.x < -4) p.x = W + 4; else if (p.x > W + 4) p.x = -4;
      ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.ph * 2));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---- component --------------------------------------------------------------

export default function WeatherBackdrop({ preset, style }) {
  const canvasRef = useRef(null);
  const p = preset || { mode: 'clear', night: false, tint: '#f5b572', intensity: 0.6 };
  const { mode, night, tint } = p;
  const intensity = p.intensity == null ? 0.6 : p.intensity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced()) return undefined; // reduced motion → tint only

    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, P = [], raf = 0, running = false;

    const size = () => {
      const host = canvas.parentElement || canvas;
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = Math.max(1, rect.width); H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      P = buildParticles(mode, intensity, W, H);
    };

    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      drawFrame(ctx, mode, tint, P, W, H, t || 0);
    };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onVis = () => { document.hidden ? stop() : start(); };
    const onResize = () => size();

    size();
    if (!document.hidden) start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      ctx.clearRect(0, 0, W, H);
    };
  }, [mode, tint, intensity]);

  const tintAlpha = night ? 0.22 : 0.12;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', ...style,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(120% 90% at 50% 20%, ${hexToRgba(tint, tintAlpha)} 0%, ${hexToRgba(tint, tintAlpha * 0.35)} 45%, transparent 75%)`,
          transition: 'background 1.2s ease',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

// Demo harness for visual review only — cycles every preset every 3s on an
// obsidian stage. Not wired into any screen on purpose.
export function WeatherBackdropDemo() {
  const presets = [
    { mode: 'snow', night: false, tint: '#a8c5e0', intensity: 0.6, label: 'snowfall' },
    { mode: 'rain', night: false, tint: '#6f8cff', intensity: 0.6, label: 'steady rain' },
    { mode: 'rain', night: true, tint: '#6f8cff', intensity: 1.0, label: 'heavy storm' },
    { mode: 'heat', night: false, tint: '#ff9e5e', intensity: 0.6, label: 'scorching heat' },
    { mode: 'fog', night: true, tint: '#8e9ab8', intensity: 0.6, label: 'thick fog' },
    { mode: 'clear', night: false, tint: '#f5b572', intensity: 0.6, label: 'clear day' },
    { mode: 'clear', night: true, tint: '#c5b3ff', intensity: 0.6, label: 'clear night' },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % presets.length), 3000);
    return () => clearInterval(id);
  }, []);
  const p = presets[i];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#0b0b10' }}>
      <WeatherBackdrop preset={p} />
      <div
        style={{
          position: 'absolute', bottom: 24, left: 24, color: '#f5b572',
          fontFamily: 'system-ui, sans-serif', fontSize: 14, letterSpacing: '0.08em',
          textTransform: 'uppercase', opacity: 0.9,
        }}
      >
        {p.label} — {p.mode}{p.night ? ' · night' : ' · day'}
      </div>
    </div>
  );
}
