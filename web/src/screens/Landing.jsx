// Sarathi — cinematic 3D scroll-storytelling landing (the public front door).
// A living Twin (twinStage) sits fixed behind the page; scroll drives the camera,
// lighting and growth-stage hue while scenes reveal the charioteer story. Falls
// back to a static poster if WebGL/model fail. CTA → onStart() (sign up).
import { useEffect, useRef, useState } from 'react';
import CharioteerStage from './CharioteerStage.jsx';
import { useCountUp, useInView, useScrollProgress, useParallax, useMagnetic } from '../lib/motion.js';
import { LegalOverlay } from './Legal.jsx';

const HERO_IMG = '/img/charioteer-hero.png';
const ASCENDED_IMG = '/img/charioteer-ascended.png';
const GOLD = '#f5b572';

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cinematic word-by-word headline reveal (mask-up). Each word rises from behind a
// clip on scroll-in, staggered — the signature "expensive website" move.
function SplitText({ text, stagger = 0.045, delay = 0, style, className }) {
  const ref = useRef(null);
  const [on, setOn] = useState(prefersReduced());
  useEffect(() => {
    const el = ref.current; if (!el || prefersReduced()) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setOn(true); io.unobserve(el); } }), { threshold: 0.25 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const words = String(text).split(' ');
  return (
    <span ref={ref} className={className} style={style}>
      {words.map((w, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.08em' }}>
          <span style={{ display: 'inline-block', willChange: 'transform',
            transform: on ? 'translateY(0)' : 'translateY(115%)', opacity: on ? 1 : 0,
            transition: `transform .9s cubic-bezier(.2,1,.3,1) ${(delay + i * stagger).toFixed(2)}s, opacity .9s ease ${(delay + i * stagger).toFixed(2)}s` }}>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

// A primary CTA that drifts toward the cursor (magnetic) with a sheen sweep on hover.
function MagneticCTA({ children, onClick, primary = true, style }) {
  const ref = useMagnetic(0.4);
  return (
    <span ref={ref} style={{ display: 'inline-block' }}>
      <button className={`btn ${primary ? 'primary' : 'ghost'} lp-cta`} onClick={onClick} style={style}>{children}</button>
    </span>
  );
}

// Scroll-linked parallax wrapper for depth between layers.
function Parallax({ speed = 0.1, children, style, className }) {
  const ref = useParallax(speed);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}

// Infinite marquee of the product's pillars — premium editorial motion.
function Marquee({ items }) {
  const row = [...items, ...items];
  return (
    <div className="lp-marquee" aria-hidden style={{ position: 'relative', zIndex: 2, padding: '26px 0', borderTop: '1px solid rgba(151,168,205,.1)', borderBottom: '1px solid rgba(151,168,205,.1)', overflow: 'hidden', maskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)' }}>
      <div className="lp-marquee-track" style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', width: 'max-content' }}>
        {row.map((t, i) => (
          <span key={i} className="display" style={{ fontSize: 'clamp(20px,2.4vw,32px)', fontWeight: 700, letterSpacing: '-.02em', color: i % 2 ? GOLD : '#2a3145', display: 'inline-flex', alignItems: 'center', gap: 40 }}>
            {t}<span style={{ color: '#2a3145' }}>✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Landing({ onStart }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | poster
  const [seen, setSeen] = useState(false);         // hero in view → start count-ups
  const [legal, setLegal] = useState(null);        // null | 'privacy' | 'terms'
  const progress = useScrollProgress();
  const scrolled = progress > 0.02;

  useEffect(() => {
    // reveal-on-scroll
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-in', '1'); }), { threshold: 0.16 });
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    // start the hero count-ups once the hero scene is in view
    const heroIo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setSeen(true); }), { threshold: 0.4 });
    const hero = document.getElementById('lp-hero'); if (hero) heroIo.observe(hero);
    return () => { io.disconnect(); heroIo.disconnect(); };
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#04060a', color: '#f2f5fc', overflowX: 'hidden' }}>
      {/* scroll-progress rail */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 60, pointerEvents: 'none' }}>
        <div style={{ height: '100%', width: `${(progress * 100).toFixed(2)}%`, background: 'linear-gradient(90deg,#ffdeba,#f5b572 60%,#d97a45)', boxShadow: '0 0 12px rgba(245,181,114,.6)', transition: 'width .1s linear' }} />
      </div>
      {/* film grain + drifting aurora texture */}
      <div className="lp-grain" aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.5, mixBlendMode: 'overlay' }} />
      <div className="lp-aurora" aria-hidden style={{ position: 'fixed', inset: '-20%', zIndex: 0, pointerEvents: 'none' }} />
      {/* the Charioteer — fixed cinematic character layer behind the story.
          Bold in the hero, fades to an ambient presence as the story unfolds. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        opacity: Math.max(0.32, 1 - progress * 5), transition: 'opacity .3s linear' }}>
        <CharioteerStage src={HERO_IMG} aura={GOLD} offsetX={64} />
      </div>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(130% 90% at 50% 18%, transparent 45%, rgba(0,0,0,.55) 100%), radial-gradient(100% 60% at 50% 120%, rgba(0,0,0,.6), transparent 55%)' }} />

      {/* brand bar — condenses + blurs once you scroll, reveals a CTA */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: scrolled ? '12px 24px' : '20px 24px',
        background: scrolled ? 'rgba(4,6,10,0.6)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none', WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(151,168,205,.08)' : '1px solid transparent',
        transition: 'padding .4s cubic-bezier(.22,1,.36,1), background .4s ease, border-color .4s ease' }}>
        <span className="display" style={{ fontWeight: 700, fontSize: scrolled ? 15 : 17, transition: 'font-size .4s ease' }}>Sarathi</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#59648a' }}>Private AI Health OS</span>
          <button className="btn primary lp-cta" onClick={onStart}
            style={{ padding: '8px 16px', fontSize: 13, opacity: scrolled ? 1 : 0, transform: scrolled ? 'translateX(0)' : 'translateX(12px)', pointerEvents: scrolled ? 'auto' : 'none', transition: 'opacity .4s ease, transform .4s ease' }}>
            Get started
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* S1 — the charioteer */}
        <Scene left>
          <div data-reveal style={{ maxWidth: 640 }}>
            <Eyebrow>सारथि · the charioteer</Eyebrow>
            <h1 className="display" style={{ fontWeight: 400, fontSize: 'clamp(22px,3.2vw,38px)', lineHeight: 1.32, letterSpacing: '-.02em', color: '#cdd6e4' }}>
              The body is the chariot. The senses, its horses.<br />
              Sarathi is the <span style={{ color: GOLD }}>guiding intelligence</span> that steers you to your own victory.
            </h1>
          </div>
          <ScrollHint />
        </Scene>

        {/* S2 — hero */}
        <Scene id="lp-hero" left>
          <div data-reveal style={{ maxWidth: 680 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(38px,6vw,76px)', lineHeight: 0.98, letterSpacing: '-.04em', marginBottom: 20 }}>
              <SplitText text="Own your health." /><br />
              <SplitText text="Talk to it." delay={0.18} /><br />
              <span className="lp-shine" style={{ background: 'linear-gradient(100deg,#ffdeba,#f5b572 55%,#d97a45)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', display: 'inline-block' }}>Watch yourself level up.</span>
            </h2>
            <p style={{ color: '#8e9ab8', fontSize: 'clamp(15px,1.6vw,18px)', maxWidth: 560, marginBottom: 26 }}>
              A private AI health OS with a living Twin, a personal Hermes coach, and a Health Vault you own forever.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 30 }}>
              <MagneticCTA onClick={onStart} style={{ padding: '14px 24px' }}>Build your Twin</MagneticCTA>
              <a href="#roles" className="btn ghost lp-cta" style={{ padding: '14px 22px', textDecoration: 'none' }}>See how it works</a>
            </div>
            <Parallax speed={0.05} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Stat label="Readiness" value={84} suffix="▲" started={seen} />
              <Stat label="Level" value={62} started={seen} />
              <Stat label="Sleep" value={7.4} dec={1} suffix="h" started={seen} />
              <Stat label="HRV" value={68} suffix="ms" started={seen} />
            </Parallax>
          </div>
        </Scene>

        {/* Four roles */}
        <Scene id="roles">
          <div data-reveal style={{ maxWidth: 900, width: '100%' }}>
            <Eyebrow>00 · the model</Eyebrow>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(28px,4vw,48px)', letterSpacing: '-.03em', marginBottom: 8 }}>One chariot, four parts</h2>
            <p style={{ color: '#8e9ab8', maxWidth: 560, marginBottom: 26 }}>Sarathi is the charioteer. You are Arjuna. Every surface answers to one of four roles — body, light, memory, path.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
              <Role data-stage="2" tone="#f5b572" k="The Twin" v="is the body" d="Warm amber light — the living 3D figure that grows with you. What you feel." />
              <Role data-stage="1" tone="#ffd9a8" k="Hermes" v="is the guiding light" d="A calm point of warmth that speaks — the coach that reads your scores and shows the way." />
              <Role data-stage="4" tone="#4cc9f0" k="The Vault" v="is the memory" d="A cool cyan constellation — the Markdown vault you own, every session linked." />
              <Role data-stage="3" tone="#5fd0bd" k="Your journey" v="is the path" d="The line you walk — readiness, levels and PRs, becoming visible over time." />
            </div>
          </div>
        </Scene>

        {/* pillar marquee — editorial motion band */}
        <Marquee items={['LIVING TWIN', 'HERMES COACH', 'HEALTH VAULT', 'ON-DEVICE AI', 'FORM COACH', 'READINESS', 'STRENGTH INTELLIGENCE']} />

        {/* Moment — transformation / level up */}
        <TransformationScene />

        {/* Moment — recovery */}
        <RecoveryScene />

        {/* Moment — privacy */}
        <PrivacyScene />

        {/* How it works — horizontal rail */}
        <HowItWorks />

        {/* Proof — honest product facts */}
        <ProofBand />

        {/* Final CTA — the ascended charioteer */}
        <Scene>
          <div data-reveal style={{ textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'relative', width: 'min(380px,76vw)', margin: '0 auto 10px' }}>
              <div aria-hidden style={{ position: 'absolute', inset: '-12% -12% 6%', background: `radial-gradient(circle at 50% 42%, ${GOLD}33, transparent 62%)`, filter: 'blur(8px)' }} />
              <img src={ASCENDED_IMG} alt="Sarathi — the ascended Charioteer" style={{ position: 'relative', width: '100%', display: 'block',
                WebkitMaskImage: 'linear-gradient(180deg,#000 88%,transparent)', maskImage: 'linear-gradient(180deg,#000 88%,transparent)' }} />
            </div>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(32px,5vw,60px)', letterSpacing: '-.03em', marginBottom: 8 }}><SplitText text="Meet your Twin." /></h2>
            <p style={{ color: '#8e9ab8', marginBottom: 24 }}>Sixty seconds to set up. A lifetime that's yours.</p>
            <MagneticCTA onClick={onStart} style={{ padding: '16px 30px', fontSize: 15 }}>Build your Twin</MagneticCTA>
            <div style={{ marginTop: 16 }}>
              <button onClick={onStart} style={{ background: 'none', border: 'none', color: '#8e9ab8', cursor: 'pointer', fontSize: 13 }}>I already have an account →</button>
            </div>
          </div>
        </Scene>

        {/* footer */}
        <footer style={{ position: 'relative', zIndex: 2, padding: '28px 24px 36px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#59648a', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 18 }}>
            <button onClick={() => setLegal('privacy')} style={footLink}>Privacy</button>
            <button onClick={() => setLegal('terms')} style={footLink}>Terms</button>
          </div>
          <span>© {new Date().getFullYear()} Sarathi · Private AI Health OS</span>
        </footer>
      </div>

      {legal && <LegalOverlay doc={legal} onClose={() => setLegal(null)} />}
      <style>{`
        @keyframes lpspin{to{transform:rotate(360deg)}}
        @keyframes lpfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes lpmarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes lpaurora{0%,100%{transform:translate(-4%,-3%) rotate(0deg)}50%{transform:translate(4%,3%) rotate(8deg)}}
        @keyframes lpshine{to{background-position:200% center}}
        .lp-shine{background-size:200% auto;animation:lpshine 5s linear infinite}
        .lp-marquee-track{animation:lpmarquee 32s linear infinite}
        .lp-aurora{background:
          radial-gradient(40% 32% at 22% 30%, rgba(245,181,114,.10), transparent 60%),
          radial-gradient(36% 30% at 78% 62%, rgba(76,201,240,.08), transparent 60%),
          radial-gradient(30% 26% at 60% 12%, rgba(217,122,69,.08), transparent 60%);
          filter:blur(20px); animation:lpaurora 24s ease-in-out infinite}
        .lp-grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")}
        /* magnetic CTA: sheen sweep + lift on hover */
        .lp-cta{position:relative;overflow:hidden;transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease}
        .lp-cta::after{content:"";position:absolute;top:0;left:-130%;width:60%;height:100%;
          background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);transition:left .6s ease}
        .lp-cta:hover{transform:translateY(-2px)}
        .lp-cta:hover::after{left:140%}
        .btn.primary.lp-cta:hover{box-shadow:0 10px 30px -8px rgba(245,181,114,.55)}
        /* card hover lift on reveal cards */
        [data-reveal]{transition:opacity .9s cubic-bezier(.22,1,.36,1),transform 1s cubic-bezier(.22,1,.36,1)}
        @media (prefers-reduced-motion: reduce){.lp-marquee-track,.lp-aurora{animation:none}}
      `}</style>
    </div>
  );
}

const footLink = { background: 'none', border: 'none', color: '#8e9ab8', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' };

function Scene({ children, id, left }) {
  return (
    <section id={id} style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: left ? 'flex-start' : 'center', justifyContent: 'center',
      padding: left ? '0 24px 0 max(24px, 7vw)' : '0 24px', textAlign: left ? 'left' : 'center' }}>
      {children}
    </section>
  );
}

function Eyebrow({ children }) {
  return <p style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 12, letterSpacing: '.3em', textTransform: 'uppercase', color: GOLD, marginBottom: 18 }}>{children}</p>;
}

function ScrollHint() {
  return (
    <div data-reveal style={{ marginTop: 40, color: '#59648a', fontSize: 12 }}>
      <span style={{ display: 'inline-block', width: 22, height: 34, border: '1.5px solid rgba(151,168,205,.3)', borderRadius: 12, position: 'relative' }}>
        <span style={{ position: 'absolute', left: '50%', top: 7, transform: 'translateX(-50%)', width: 3, height: 6, borderRadius: 3, background: GOLD, animation: 'lpfloat 1.8s ease-in-out infinite' }} />
      </span>
    </div>
  );
}

function Stat({ label, value, dec = 0, suffix = '', started }) {
  const n = useCountUp(value, started, { decimals: dec });
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(151,168,205,0.14)', borderRadius: 14, padding: '10px 14px', textAlign: 'left', minWidth: 96 }}>
      <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#59648a' }}>{label}</div>
      <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{n}<span style={{ fontSize: 12, color: GOLD, marginLeft: 3 }}>{suffix}</span></div>
    </div>
  );
}

function Role({ tone, k, v, d, ...rest }) {
  return (
    <div data-reveal {...rest} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(151,168,205,0.14)', borderRadius: 16, padding: 18, textAlign: 'left' }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, marginBottom: 12, background: tone, boxShadow: `0 0 22px ${tone}66` }} />
      <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>{k}</div>
      <div style={{ color: tone, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{v}</div>
      <div style={{ color: '#8e9ab8', fontSize: 13, lineHeight: 1.5 }}>{d}</div>
    </div>
  );
}

/* ============ Cinematic moments (designed, data-driven) ============ */

// 01 — Transformation: a real level jump + muscle bars that fill on reveal.
function TransformationScene() {
  const [ref, inView] = useInView(0.2);
  const lvl = useCountUp(62, inView, { decimals: 0 });
  return (
    <Scene>
      <div ref={ref} data-reveal data-levelup style={{ maxWidth: 880, width: '100%' }}>
        <Eyebrow>01 · transformation</Eyebrow>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(34px,5vw,64px)', letterSpacing: '-.03em' }}>
          Your future self,<br /><span style={{ color: GOLD }}>becoming visible.</span>
        </h2>
        <p style={{ color: '#8e9ab8', maxWidth: 520, margin: '14px auto 26px' }}>
          Train, recover, log a meal — the Twin lights up, levels rise, and the muscle you worked grows. Progress you can see.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#59648a' }}>Level</div>
            <div className="display" style={{ fontSize: 'clamp(56px,9vw,96px)', fontWeight: 700, lineHeight: 1,
              background: 'linear-gradient(100deg,#ffdeba,#f5b572 55%,#d97a45)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{lvl}</div>
            <div style={{ color: '#5fd0bd', fontSize: 13, fontWeight: 600 }}>▲ from level 12</div>
          </div>
          <GrowthBars started={inView} />
        </div>
      </div>
    </Scene>
  );
}

// 02 — Recovery: a readiness ring + the signals behind it.
function RecoveryScene() {
  const [ref, inView] = useInView(0.2);
  return (
    <Scene>
      <div ref={ref} data-reveal data-stage="3" style={{ maxWidth: 820, width: '100%' }}>
        <Eyebrow>02 · recovery</Eyebrow>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(30px,4.6vw,58px)', letterSpacing: '-.03em' }}>
          Recover as hard<br />as you train.
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 34, alignItems: 'center', justifyContent: 'center', marginTop: 26 }}>
          <ReadinessRing value={84} started={inView} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            <MiniStat label="HRV" value={68} suffix="ms" tone="#5fd0bd" trend="▲ 6" started={inView} />
            <MiniStat label="Sleep" value={7.4} dec={1} suffix="h" tone="#f5b572" trend="78% efficiency" started={inView} />
            <MiniStat label="Resting HR" value={52} suffix="bpm" tone="#4cc9f0" trend="▼ 3" started={inView} />
          </div>
        </div>
        <p style={{ color: '#8e9ab8', maxWidth: 520, margin: '24px auto 0' }}>
          One readiness score from your sleep, HRV and strain — so you know when to push and when to back off.
        </p>
      </div>
    </Scene>
  );
}

// 03 — Privacy: a cyan vault constellation (the Markdown memory you own).
function PrivacyScene() {
  const [ref, inView] = useInView(0.2);
  return (
    <Scene>
      <div ref={ref} data-reveal data-stage="4" style={{ maxWidth: 720 }}>
        <Eyebrow>03 · privacy</Eyebrow>
        <VaultGraph on={inView} />
        <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(30px,4.4vw,56px)', letterSpacing: '-.03em', marginTop: 18 }}>
          Your data never<br />leaves your control.
        </h2>
        <p style={{ color: '#8e9ab8', maxWidth: 520, margin: '14px auto 0' }}>
          On-device coaching. A Health Vault in open Markdown that's yours forever — export it any time, no lock-in.
        </p>
      </div>
    </Scene>
  );
}

function ReadinessRing({ value = 84, started }) {
  const n = useCountUp(value, started, { decimals: 0 });
  const R = 76, C = 2 * Math.PI * R;
  return (
    <svg width="190" height="190" viewBox="0 0 190 190" style={{ filter: 'drop-shadow(0 0 18px rgba(245,181,114,.28))' }}>
      <defs>
        <linearGradient id="lp-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffdeba" /><stop offset="0.5" stopColor="#f5b572" /><stop offset="1" stopColor="#5fd0bd" />
        </linearGradient>
      </defs>
      <circle cx="95" cy="95" r={R} fill="none" stroke="rgba(151,168,205,.12)" strokeWidth="11" />
      <circle cx="95" cy="95" r={R} fill="none" stroke="url(#lp-ring)" strokeWidth="11" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={started ? C * (1 - value / 100) : C} transform="rotate(-90 95 95)"
        style={{ transition: 'stroke-dashoffset 1.7s cubic-bezier(.22,1,.36,1)' }} />
      <text x="95" y="92" textAnchor="middle" fill="#f2f5fc" style={{ fontSize: 44, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{n}</text>
      <text x="95" y="118" textAnchor="middle" fill="#8e9ab8" style={{ fontSize: 11, letterSpacing: '.16em', fontFamily: 'var(--font-eyebrow)' }}>READY</text>
    </svg>
  );
}

function MiniStat({ label, value, dec = 0, suffix, tone, trend, started }) {
  const n = useCountUp(value, started, { decimals: dec });
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 220 }}>
      <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#59648a', width: 84 }}>{label}</div>
      <div className="display" style={{ fontSize: 26, fontWeight: 700 }}>{n}<span style={{ fontSize: 12, color: tone, marginLeft: 3 }}>{suffix}</span></div>
      <div style={{ fontSize: 12, color: tone, marginLeft: 'auto' }}>{trend}</div>
    </div>
  );
}

function GrowthBars({ started }) {
  const bars = [['Legs', 86, '#f5b572'], ['Back', 64, '#f5b572'], ['Chest', 58, '#f5b572'], ['Arms', 47, '#4cc9f0']];
  return (
    <div style={{ display: 'grid', gap: 11, minWidth: 280 }}>
      {bars.map(([l, v, c], i) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 54, fontSize: 12, color: '#8e9ab8', textAlign: 'left' }}>{l}</span>
          <div style={{ flex: 1, height: 9, background: 'rgba(151,168,205,.12)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: c, width: started ? `${v}%` : '0%',
              transition: `width 1.3s cubic-bezier(.22,1,.36,1) ${0.12 * i}s` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 04 — How it works: a horizontal scroll-snap rail of numbered steps.
function HowItWorks() {
  const steps = [
    ['01', 'Connect', 'Sync Apple Health or import your history — HRV, sleep and every lift, all in one place.', '#f5b572'],
    ['02', 'Coach', 'The camera counts your reps on-device while Hermes reads your scores and shows the way.', '#ffd9a8'],
    ['03', 'Grow', 'Every logged set grows your living Twin — the exact muscle you trained, visibly.', '#5fd0bd'],
    ['04', 'Notice', 'Strength Intelligence spots stalls, PRs and imbalances — and your coach speaks them.', '#4cc9f0'],
  ];
  return (
    <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '70px 0' }}>
      <div data-reveal style={{ padding: '0 24px', maxWidth: 920, margin: '0 auto', width: '100%', textAlign: 'center' }}>
        <Eyebrow>04 · how it works</Eyebrow>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(28px,4vw,48px)', letterSpacing: '-.03em', marginBottom: 6 }}>
          From signal to self-knowledge.
        </h2>
        <p style={{ color: '#8e9ab8', maxWidth: 520, margin: '0 auto' }}>Four moves. The loop no one else has — coach, grow, notice, repeat.</p>
      </div>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '30px 24px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        <div style={{ flex: '0 0 max(0px, calc(50vw - 480px))' }} />
        {steps.map(([n, t, d, c]) => (
          <div key={n} data-reveal style={{ scrollSnapAlign: 'center', flex: '0 0 280px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(151,168,205,0.14)', borderRadius: 20, padding: 22, textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${c}, transparent)` }} />
            <div className="display" style={{ fontSize: 42, fontWeight: 700, color: c, lineHeight: 1, opacity: 0.9 }}>{n}</div>
            <div className="display" style={{ fontWeight: 700, fontSize: 22, margin: '14px 0 8px' }}>{t}</div>
            <div style={{ color: '#8e9ab8', fontSize: 14, lineHeight: 1.55 }}>{d}</div>
          </div>
        ))}
        <div style={{ flex: '0 0 max(0px, calc(50vw - 480px))' }} />
      </div>
    </section>
  );
}

// 05 — Proof: honest product facts (no fake testimonials), big count-up numerals.
function ProofBand() {
  const [ref, inView] = useInView(0.3);
  return (
    <section ref={ref} style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
      <div data-reveal style={{ maxWidth: 900, width: '100%', textAlign: 'center' }}>
        <Eyebrow>05 · the promise</Eyebrow>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(24px,3.4vw,40px)', letterSpacing: '-.03em', marginBottom: 34 }}>
          Built for you alone.
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '28px 0' }}>
          <ProofStat value={24} label="Coached lifts" started={inView} />
          <ProofDivider />
          <ProofStat value={100} suffix="%" label="On-device AI" started={inView} />
          <ProofDivider />
          <ProofStat value={0} label="Data sold, ever" started={inView} />
          <ProofDivider />
          <ProofStat glyph="∞" label="Yours forever" />
        </div>
      </div>
    </section>
  );
}

function ProofStat({ value, suffix = '', label, started, glyph }) {
  const n = useCountUp(value || 0, started, { decimals: 0 });
  return (
    <div style={{ flex: '1 1 160px', minWidth: 140 }}>
      <div className="display" style={{ fontSize: 'clamp(40px,6vw,64px)', fontWeight: 700, lineHeight: 1,
        background: 'linear-gradient(100deg,#ffdeba,#f5b572 60%,#d97a45)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
        {glyph || n}<span style={{ fontSize: '0.5em' }}>{suffix}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#59648a', marginTop: 10 }}>{label}</div>
    </div>
  );
}

function ProofDivider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(151,168,205,0.14)', margin: '0 6px' }} />;
}

function VaultGraph({ on }) {
  // a small constellation of linked Markdown notes (the Vault, in cyan)
  const nodes = [[60, 40], [150, 28], [230, 60], [40, 110], [120, 100], [210, 120], [90, 160], [180, 170]];
  const links = [[0, 1], [1, 2], [0, 4], [1, 4], [2, 5], [3, 4], [4, 6], [4, 5], [5, 7], [6, 7]];
  return (
    <svg width="270" height="200" viewBox="0 0 270 200" style={{ margin: '0 auto', display: 'block', maxWidth: '90%' }}>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="#4cc9f0" strokeWidth="1" strokeOpacity={on ? 0.35 : 0}
          style={{ transition: `stroke-opacity .8s ease ${0.05 * i}s` }} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={on ? 4 : 0} fill="#4cc9f0"
          style={{ transition: `r .5s cubic-bezier(.22,1,.36,1) ${0.06 * i}s`, filter: 'drop-shadow(0 0 6px #4cc9f0)' }} />
      ))}
    </svg>
  );
}
