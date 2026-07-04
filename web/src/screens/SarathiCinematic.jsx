// SarathiCinematic — Phase 1 "The Cinematic Gate". Full-viewport hero in the
// background-video pattern (fullscreen cinematic bg · centered pill navbar · bottom-left
// invocation · gold micro-interactions), reskinned to Sarathi in the repo's idiom
// (JSX + inline styles, inline SVG — no TS/Tailwind/lucide). The <video> slot is wired and
// ready: drop the Dreamina armor→heart render into VIDEO_SRC and it becomes a true video
// hero; until then the charioteer is a living cinematic background (Ken-Burns float, gold
// halo, volumetric god-rays, embers, film grain). Reduced-motion → still.
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Scene 1 — the intro plays ONCE, then crossfades into the looping poster and the
// headline + nav rise in. Drop a seamless loop clip into LOOP_SRC to swap the still for video.
// Old intro starred the retired anime charioteer — disabled until the new intro is rendered
// from the locked photoreal master (image-to-video, master as start frame). Was: '/video/scene-1-intro.mp4'
const INTRO_SRC = null;
const LOOP_SRC = null;                           // optional seamless loop bg; null → living poster still
const FIGURE = '/img/sarathi-master.webp';       // THE locked photoreal master (v1, 2026-07-02)
const NAV = ['Story', 'Coach', 'Twin', 'Vault'];
const GOLD = '#f5b572';
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Mark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <circle cx="50" cy="46" r="22" fill="none" stroke={GOLD} strokeWidth="6" />
      <text x="50" y="64" fontSize="40" fontFamily="Space Grotesk, Georgia, serif" fontWeight="700" fill={GOLD} textAnchor="middle">S</text>
    </svg>
  );
}
function Arrow({ size = 14 }) {
  return (
    <svg className="sc-arrow" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// spring-staggered entrance choreography (Framer Motion)
const wrapVar = { hidden: {}, show: { transition: { staggerChildren: 0.11, delayChildren: 0.25 } } };
const riseVar = { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 17 } } };
const lineVar = { hidden: { y: '112%' }, show: { y: '0%', transition: { type: 'spring', stiffness: 74, damping: 16 } } };

export default function SarathiCinematic({ onStart }) {
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 760);
  const rm = useReducedMotion();
  const emberRef = useRef(null), introRef = useRef(null);

  // intro plays once → 'done'. Skipped under reduced-motion (poster + headline show at once).
  const playIntro = !!INTRO_SRC && !reduced();
  const [phase, setPhase] = useState(playIntro ? 'intro' : 'done');
  const finishIntro = () => setPhase('done');
  useEffect(() => {
    if (phase !== 'intro') return;                        // safety net if 'ended' never fires
    const t = setTimeout(finishIntro, 9000);
    return () => clearTimeout(t);
  }, [phase]);

  // ensure playback starts; if autoplay is blocked, skip straight to poster + headline
  useEffect(() => {
    if (!playIntro) return;
    const v = introRef.current; if (!v) return;
    const p = v.play && v.play();
    if (p && p.catch) p.catch(() => finishIntro());
  }, []);

  useEffect(() => {
    const f = () => setMobile(window.innerWidth < 760);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  // lightweight gold embers drifting up (canvas) — skipped on reduced-motion / mobile
  useEffect(() => {
    if (reduced() || mobile) return;
    const cv = emberRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); let raf, dead = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; };
    resize(); window.addEventListener('resize', resize);
    const N = 46;
    const P = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4, s: Math.random() * 0.00035 + 0.00012, a: Math.random() * 0.5 + 0.2, tw: Math.random() * Math.PI * 2 }));
    const tick = () => {
      if (dead) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of P) {
        p.y -= p.s; p.tw += 0.03; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        const x = p.x * cv.width, y = p.y * cv.height, fl = 0.7 + Math.sin(p.tw) * 0.3;
        ctx.beginPath(); ctx.arc(x, y, p.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,181,114,${p.a * fl})`; ctx.shadowBlur = 8 * dpr; ctx.shadowColor = 'rgba(245,181,114,0.8)';
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [mobile]);

  const start = () => onStart && onStart();

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: 'radial-gradient(120% 90% at 70% 30%, #0a0e16 0%, #05070c 55%, #030406 100%)', fontFamily: 'var(--font-body)' }}>

      {/* ── background layer ───────────────────────────────────────────── */}
      {/* god-rays from above-right */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.5,
        background: 'conic-gradient(from 210deg at 72% -10%, transparent 0deg, rgba(245,181,114,0.10) 12deg, transparent 26deg, rgba(245,181,114,0.07) 40deg, transparent 60deg)', filter: 'blur(6px)' }} />
      {/* gold halo bloom behind the figure */}
      <div aria-hidden className="sc-breathe" style={{ position: 'absolute', zIndex: 0, right: mobile ? '50%' : '24%', top: mobile ? '14%' : '18%', transform: mobile ? 'translateX(50%)' : 'none', width: mobile ? '90vw' : '46vw', height: mobile ? '90vw' : '46vw', pointerEvents: 'none',
        background: 'radial-gradient(50% 50% at 50% 50%, rgba(245,181,114,0.42) 0%, rgba(245,181,114,0.14) 36%, transparent 68%)', filter: 'blur(4px)' }} />

      {/* the looping hero media (revealed after the intro): seamless loop clip, else living still */}
      {LOOP_SRC ? (
        <video autoPlay muted loop playsInline aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} src={LOOP_SRC} />
      ) : (
        <div aria-hidden className="sc-figure" style={{ position: 'absolute', zIndex: 1, pointerEvents: 'none',
          right: mobile ? '50%' : '20%', bottom: 0, transform: mobile ? 'translateX(50%)' : 'none',
          width: mobile ? '108vw' : '52vw', height: mobile ? '82vh' : '98vh',
          backgroundImage: `url(${FIGURE})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom center',
          WebkitMaskImage: 'radial-gradient(62% 92% at 50% 46%, #000 64%, transparent 96%)', maskImage: 'radial-gradient(62% 92% at 50% 46%, #000 64%, transparent 96%)',
          filter: 'drop-shadow(0 30px 80px rgba(245,181,114,0.22))' }} />
      )}

      {/* embers + bottom scrim + film grain */}
      <canvas ref={emberRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(3,4,6,0.55) 0%, transparent 22%, transparent 52%, rgba(3,4,6,0.78) 100%)' }} />
      <div aria-hidden className="sc-grain" style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', opacity: 0.4, mixBlendMode: 'overlay' }} />

      {/* ── Scene 1 intro: plays once, then crossfades out to reveal the loop/poster ──── */}
      {playIntro && (
        <>
          <video ref={introRef} src={INTRO_SRC} autoPlay muted playsInline preload="auto"
            onEnded={finishIntro} onError={finishIntro} onClick={finishIntro}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 6,
              opacity: phase === 'intro' ? 1 : 0, transition: 'opacity 1.2s ease', pointerEvents: phase === 'intro' ? 'auto' : 'none', cursor: phase === 'intro' ? 'pointer' : 'default' }} />
          {phase === 'intro' && (
            <button onClick={finishIntro} aria-label="Skip intro"
              style={{ position: 'absolute', bottom: mobile ? 18 : 28, right: mobile ? 18 : 30, zIndex: 7, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(8,10,16,0.4)', color: '#e8ecf7', fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
              Skip <Arrow size={12} />
            </button>
          )}
        </>
      )}

      {/* ── foreground content (spring-staggered entrance after the intro) ── */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100vh', pointerEvents: phase === 'done' ? 'auto' : 'none' }}>

        {/* centered pill navbar — drops in from above */}
        <motion.nav initial={rm ? false : { y: -28, opacity: 0 }} animate={phase === 'done' ? { y: 0, opacity: 1 } : {}}
          transition={{ type: 'spring', stiffness: 80, damping: 16, delay: 0.1 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: mobile ? 16 : 26, paddingLeft: 16, paddingRight: 16, gap: 10, opacity: rm && phase !== 'done' ? 0 : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '999px', width: mobile ? 40 : 46, height: mobile ? 40 : 46, flexShrink: 0, background: 'rgba(20,24,34,0.55)', border: '1px solid rgba(245,181,114,0.22)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            <Mark size={mobile ? 18 : 22} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 16 : 34, borderRadius: 14, padding: mobile ? '10px 18px' : '12px 30px', background: 'rgba(20,24,34,0.55)', border: '1px solid rgba(151,168,205,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            <span className="sc-brand" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: mobile ? 13 : 15, color: '#f2f5fc', letterSpacing: '0.01em', marginRight: 2 }}>सारथि</span>
            {NAV.map((l) => (
              <a key={l} href="#" className="sc-navlink" style={{ fontSize: mobile ? 12 : 14, fontWeight: 500, color: '#c7cfe2', textDecoration: 'none', transition: 'color .2s' }}>{l}</a>
            ))}
          </div>
        </motion.nav>

        {/* bottom-left invocation — staggered spring reveal, masked headline lines */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: mobile ? 44 : 80, paddingLeft: mobile ? 24 : 100, paddingRight: 24 }}>
          <motion.div variants={rm ? undefined : wrapVar} initial={rm ? false : 'hidden'} animate={phase === 'done' ? 'show' : 'hidden'}
            style={{ maxWidth: mobile ? 320 : 440, opacity: rm && phase !== 'done' ? 0 : undefined }}>
            <motion.a variants={riseVar} href="#" className="sc-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, textDecoration: 'none', marginBottom: 16 }}>
              Private AI Health OS <Arrow size={13} />
            </motion.a>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: mobile ? '2rem' : '3.1rem', lineHeight: 1.12, fontWeight: 600, color: '#f6f8ff', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              {[<>Own your health.</>, <>Talk to it.</>, <span key="g" style={{ color: GOLD }}>Watch yourself level up.</span>].map((line, i) => (
                <span key={i} style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.08em', marginBottom: '-0.08em' }}>
                  <motion.span variants={lineVar} style={{ display: 'block', willChange: 'transform' }}>{line}</motion.span>
                </span>
              ))}
            </h1>
            <motion.p variants={riseVar} style={{ fontSize: mobile ? 13 : 15, lineHeight: 1.6, color: '#aab4cc', fontWeight: 400, margin: '0 0 24px', maxWidth: 380 }}>
              Your body is the field where every battle is fought — and won. Sarathi, the charioteer, knows the field: he reads the five elements in you and brings them into balance.
            </motion.p>
            <motion.button variants={riseVar} whileHover={rm ? undefined : { y: -2 }} whileTap={rm ? undefined : { scale: 0.97 }}
              onClick={start} className="sc-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: GOLD, background: 'transparent', border: `1px solid ${GOLD}`, borderRadius: '999px', padding: '12px 24px', cursor: 'pointer', transition: 'background .2s, color .2s, border-color .2s, box-shadow .2s' }}>
              Meet your Twin <Arrow size={15} />
            </motion.button>
          </motion.div>
        </div>
      </div>

      <style>{`
        .sc-grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");background-size:180px 180px}
        .sc-navlink:hover{color:#fff}
        .sc-badge .sc-arrow{transition:transform .2s}
        .sc-badge:hover .sc-arrow{transform:translateX(2px)}
        .sc-cta .sc-arrow{transition:transform .2s}
        .sc-cta:hover{background:${GOLD};color:#1a0f06;border-color:${GOLD};box-shadow:0 14px 38px -10px rgba(245,181,114,.55)}
        .sc-cta:hover .sc-arrow{transform:translateX(2px)}
        .sc-breathe{animation:scBreathe 7s ease-in-out infinite}
        @keyframes scBreathe{0%,100%{opacity:.85;transform:${'scale(1)'}}50%{opacity:1;transform:scale(1.05)}}
        .sc-figure{animation:scFloat 9s ease-in-out infinite}
        @keyframes scFloat{0%,100%{transform:translateY(0) scale(1.0)}50%{transform:translateY(-1.2%) scale(1.012)}}
        @media (max-width:760px){.sc-figure{animation:none}}
        @media (prefers-reduced-motion:reduce){.sc-breathe,.sc-figure{animation:none}}
      `}</style>
    </div>
  );
}
