// SarathiHero — a full-viewport "figurine carousel" hero, in the TOONHUB interaction
// language (giant ghost word, bottom-anchored hero figure, 4 rotating roles, 650ms
// crossfade of position/scale/blur/opacity + background tint, film grain, nav arrows),
// reskinned to Sarathi: obsidian + molten-gold, one per-pillar accent that crossfades.
// Each "edition" is a Sarathi pillar (Hermes / Form / Readiness / Vault) wearing the
// charioteer figure. No Tailwind / lucide — JSX + inline styles + inline SVG (repo idiom).
// Gated behind #sarathi-hero so it never touches the live homepage until chosen.
import { useEffect, useRef, useState } from 'react';

// 4 editions — each a pillar of the Sarathi story, with its signature accent + figure.
const PILLARS = [
  { word: 'HERMES', tag: 'the mind',  accent: '#ffd9a8', img: '/img/charioteer-hero.png',
    blurb: 'A coach that remembers every score and every session — and speaks the one move that matters next.' },
  { word: 'FORM',   tag: 'the hands', accent: '#7fd4f0', img: '/img/charioteer-ascended.png',
    blurb: 'On-device pose AI counts and grades every rep in real time. Nothing ever leaves your phone.' },
  { word: 'READY',  tag: 'the heart', accent: '#5fd0bd', img: '/img/charioteer-hero.png',
    blurb: 'Sleep, HRV and strain fuse into one readiness score — push on the right days, recover on the rest.' },
  { word: 'VAULT',  tag: 'the path',  accent: '#4cc9f0', img: '/img/charioteer-ascended.png',
    blurb: 'Every reading, meal and lift written to a Health Vault in open Markdown you own forever.' },
];
const N = PILLARS.length;
const EASE = 'cubic-bezier(0.4,0,0.2,1)';
const DUR = 650;

const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (h1, h2, t) => { const a = hx(h1), b = hx(h2); const c = (i) => Math.round(a[i] + (b[i] - a[i]) * t); return `rgb(${c(0)},${c(1)},${c(2)})`; };

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")";

function Arrow({ dir = 'right', size = 26 }) {
  const sw = 2.25;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ transform: dir === 'left' ? 'scaleX(-1)' : 'none' }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function SarathiHero({ onStart }) {
  const [activeIndex, setActiveIndex] = useState(2); // open on READY · the heart
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  const lockRef = useRef(false);

  // preload all figures + track viewport
  useEffect(() => {
    PILLARS.forEach((p) => { const im = new Image(); im.src = p.img; });
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navigate = (dir) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setActiveIndex((prev) => (dir === 'next' ? (prev + 1) % N : (prev + N - 1) % N));
    setTimeout(() => { lockRef.current = false; }, DUR);
  };

  // keyboard arrows
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'ArrowRight') navigate('next'); if (e.key === 'ArrowLeft') navigate('prev'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const center = activeIndex;
  const left = (activeIndex + N - 1) % N;
  const right = (activeIndex + 1) % N;
  const back = (activeIndex + 2) % N;
  const roleOf = (i) => (i === center ? 'center' : i === left ? 'left' : i === right ? 'right' : 'back');
  const accent = PILLARS[activeIndex].accent;
  const bg = mix('#050608', accent, 0.05); // near-black obsidian, a whisper of the active pillar (matches the figures' backplate so no seam)

  const itemStyle = (role) => {
    const tr = `transform ${DUR}ms ${EASE}, filter ${DUR}ms ${EASE}, opacity ${DUR}ms ${EASE}, left ${DUR}ms ${EASE}, height ${DUR}ms ${EASE}, bottom ${DUR}ms ${EASE}`;
    const base = { position: 'absolute', aspectRatio: '0.6 / 1', transition: tr, willChange: 'transform, filter, opacity', transformOrigin: 'bottom center', pointerEvents: 'none' };
    if (role === 'center') return { ...base, left: '50%', bottom: isMobile ? '20%' : '4%', height: isMobile ? '60%' : '90%', transform: `translateX(-50%) scale(${isMobile ? 1.1 : 1.0})`, filter: 'blur(0px)', opacity: 1, zIndex: 20 };
    if (role === 'left') return { ...base, left: isMobile ? '20%' : '30%', bottom: isMobile ? '32%' : '12%', height: isMobile ? '16%' : '28%', transform: 'translateX(-50%) scale(1)', filter: 'blur(2px)', opacity: 0.8, zIndex: 10 };
    if (role === 'right') return { ...base, left: isMobile ? '80%' : '70%', bottom: isMobile ? '32%' : '12%', height: isMobile ? '16%' : '28%', transform: 'translateX(-50%) scale(1)', filter: 'blur(2px)', opacity: 0.8, zIndex: 10 };
    return { ...base, left: '50%', bottom: isMobile ? '32%' : '12%', height: isMobile ? '13%' : '22%', transform: 'translateX(-50%) scale(1)', filter: 'blur(4px)', opacity: 0.9, zIndex: 5 };
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', backgroundColor: bg, transition: `background-color ${DUR}ms ${EASE}`, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>

        {/* accent halo behind the hero figure — crossfades with the pillar */}
        <div aria-hidden style={{ position: 'absolute', left: '50%', bottom: isMobile ? '18%' : '4%', width: isMobile ? '120vw' : '70vw', height: isMobile ? '60vh' : '92vh', transform: 'translateX(-50%)', zIndex: 1, pointerEvents: 'none',
          background: `radial-gradient(50% 50% at 50% 55%, ${accent}33 0%, ${accent}14 38%, transparent 70%)`, transition: `background ${DUR}ms ${EASE}, bottom ${DUR}ms ${EASE}`, filter: 'blur(8px)' }} />

        {/* giant ghost word — all 4 stacked, only the active one shows (650ms crossfade) */}
        <div style={{ position: 'absolute', inset: 0, top: '16%', zIndex: 2, pointerEvents: 'none', userSelect: 'none' }}>
          {PILLARS.map((p, i) => (
            <div key={p.word} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              opacity: i === center ? 0.085 : 0, transition: `opacity ${DUR}ms ${EASE}`,
              fontFamily: 'Anton, sans-serif', fontSize: 'clamp(90px, 26vw, 360px)', fontWeight: 400, color: '#fff',
              lineHeight: 1, textTransform: 'uppercase', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{p.word}</div>
          ))}
        </div>

        {/* film grain */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50, opacity: 0.4, backgroundImage: GRAIN, backgroundSize: '200px 200px', backgroundRepeat: 'repeat' }} />

        {/* top-left brand */}
        <div style={{ position: 'absolute', top: 24, left: isMobile ? 16 : 32, zIndex: 60, color: '#fff', opacity: 0.9, textTransform: 'uppercase' }}>
          <span style={{ fontFamily: 'Anton, sans-serif', fontSize: 13, letterSpacing: '0.18em' }}>सारथि</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', marginLeft: 10, opacity: 0.7 }}>SARATHI</span>
        </div>

        {/* carousel */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
          {PILLARS.map((p, i) => {
            const role = roleOf(i);
            return (
              <div key={p.word} style={itemStyle(role)}>
                <img src={p.img} alt={p.word} draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom center',
                    // the source PNGs have an opaque near-black backplate; feather the edges so the
                    // figure emerges from the obsidian void (no hard rectangle seam) and overlaps the ghost word.
                    WebkitMaskImage: 'radial-gradient(58% 96% at 50% 50%, #000 60%, transparent 98%)',
                    maskImage: 'radial-gradient(58% 96% at 50% 50%, #000 60%, transparent 98%)',
                    filter: role === 'center' ? `drop-shadow(0 24px 60px ${accent}55)` : 'none' }} />
              </div>
            );
          })}
        </div>

        {/* bottom-left: pillar copy + nav */}
        <div style={{ position: 'absolute', bottom: isMobile ? 24 : 80, left: isMobile ? 16 : 96, zIndex: 60, maxWidth: 340 }}>
          <p style={{ margin: 0, marginBottom: isMobile ? 8 : 12, fontSize: isMobile ? 16 : 22, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#fff', opacity: 0.95 }}>
            <span style={{ color: accent, transition: `color ${DUR}ms ${EASE}` }}>{PILLARS[activeIndex].tag}</span> · {PILLARS[activeIndex].word}
          </p>
          <p style={{ margin: 0, marginBottom: isMobile ? 16 : 20, fontSize: isMobile ? 12 : 14, lineHeight: 1.6, color: '#fff', opacity: 0.82, display: isMobile ? 'none' : 'block' }}>
            {PILLARS[activeIndex].blurb}
          </p>
          <div style={{ display: 'flex', gap: 14 }}>
            {['prev', 'next'].map((dir) => (
              <button key={dir} onClick={() => navigate(dir)} aria-label={dir === 'prev' ? 'Previous' : 'Next'}
                className="sh-navbtn"
                style={{ width: isMobile ? 48 : 60, height: isMobile ? 48 : 60, borderRadius: '50%', background: 'transparent', border: '2px solid rgba(255,255,255,0.85)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 150ms, background-color 150ms' }}>
                <Arrow dir={dir === 'prev' ? 'left' : 'right'} size={isMobile ? 22 : 26} />
              </button>
            ))}
          </div>
        </div>

        {/* bottom-right: discover / enter */}
        <button onClick={() => onStart && onStart()}
          className="sh-discover"
          style={{ position: 'absolute', bottom: isMobile ? 24 : 80, right: isMobile ? 16 : 40, zIndex: 60, display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Anton, sans-serif', fontSize: 'clamp(20px, 4vw, 54px)', fontWeight: 400, color: '#fff', opacity: 0.95, letterSpacing: '-0.02em', lineHeight: 1, textTransform: 'uppercase', transition: 'opacity 200ms' }}>
          Meet your Twin
          <span style={{ display: 'inline-flex', width: isMobile ? 20 : 32, height: isMobile ? 20 : 32 }}><Arrow dir="right" size={isMobile ? 20 : 32} /></span>
        </button>

        <style>{`
          .sh-navbtn:hover { transform: scale(1.08); background-color: rgba(255,255,255,0.12); }
          .sh-discover:hover { opacity: 1; }
        `}</style>
      </div>
    </div>
  );
}
