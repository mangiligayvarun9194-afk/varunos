// Sarathi — cinematic 3D scroll-storytelling landing (the public front door).
// A living Twin (twinStage) sits fixed behind the page; scroll drives the camera,
// lighting and growth-stage hue while scenes reveal the charioteer story. Falls
// back to a static poster if WebGL/model fail. CTA → onStart() (sign up).
import { useEffect, useRef, useState } from 'react';
import { initStage } from '../lib/twinStage.js';
import { useCountUp } from '../lib/motion.js';

const MODEL = '/models/twin-custom.glb';
const GOLD = '#f5b572';

export default function Landing({ onStart }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | poster
  const [seen, setSeen] = useState(false);         // hero in view → start count-ups

  useEffect(() => {
    let stage = null;
    const hasWebGL = (() => {
      try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
      catch (e) { return false; }
    })();
    if (!hasWebGL || !canvasRef.current) { setStatus('poster'); }
    else {
      try {
        stage = initStage({
          canvas: canvasRef.current, url: MODEL,
          onReady: () => setStatus('ready'),
          onError: () => setStatus('poster'),
        });
        stageRef.current = stage;
        // safety: reveal even if the model is slow
        const t = setTimeout(() => setStatus((s) => (s === 'loading' ? 'ready' : s)), 6000);
        stage._t = t;
      } catch (e) { setStatus('poster'); }
    }

    // reveal-on-scroll + growth-stage hue + level-up pulse
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-in', '1'); }), { threshold: 0.16 });
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    let sio, lio;
    if (stage) {
      sio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) stage.setStage(+e.target.getAttribute('data-stage')); }), { threshold: 0.55 });
      document.querySelectorAll('[data-stage]').forEach((el) => sio.observe(el));
      let fired = false;
      lio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !fired) { fired = true; stage.pulse(); } }), { threshold: 0.5 });
      document.querySelectorAll('[data-levelup]').forEach((el) => lio.observe(el));
    }
    const heroIo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setSeen(true); }), { threshold: 0.4 });
    const hero = document.getElementById('lp-hero'); if (hero) heroIo.observe(hero);

    return () => {
      io.disconnect(); sio && sio.disconnect(); lio && lio.disconnect(); heroIo.disconnect();
      if (stage) { clearTimeout(stage._t); stage.dispose(); }
    };
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#04060a', color: '#f2f5fc', overflowX: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(130% 90% at 50% 18%, transparent 40%, rgba(0,0,0,.5) 100%), radial-gradient(100% 60% at 50% 120%, rgba(0,0,0,.55), transparent 55%)' }} />
      {status === 'poster' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(680px 760px at 64% 40%, rgba(245,181,114,.22), transparent 60%), #05070c' }}>
          <div style={{ position: 'absolute', left: '62%', top: '50%', transform: 'translate(-50%,-50%)', width: 200, height: 380,
            borderRadius: '46% 46% 40% 40% / 52% 52% 30% 30%', filter: 'blur(8px)',
            background: 'linear-gradient(180deg, rgba(255,222,186,.5), rgba(245,181,114,.16) 64%, transparent)' }} />
        </div>
      )}

      {/* loader */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
        background: '#04060a', transition: 'opacity .9s ease', opacity: status === 'loading' ? 1 : 0, pointerEvents: 'none' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid rgba(245,181,114,.22)', borderTopColor: GOLD, animation: 'lpspin 1s linear infinite' }} />
        <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8e9ab8' }}>Summoning your Twin…</span>
      </div>

      {/* brand bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', pointerEvents: 'none' }}>
        <span className="display" style={{ fontWeight: 700, fontSize: 17 }}>Sarathi</span>
        <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#59648a' }}>Private AI Health OS</span>
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* S1 — the charioteer */}
        <Scene>
          <div data-reveal style={{ textAlign: 'center', maxWidth: 760 }}>
            <Eyebrow>सारथि · the charioteer</Eyebrow>
            <h1 className="display" style={{ fontWeight: 400, fontSize: 'clamp(22px,3.2vw,38px)', lineHeight: 1.32, letterSpacing: '-.02em', color: '#cdd6e4' }}>
              The body is the chariot. The senses, its horses.<br />
              Sarathi is the <span style={{ color: GOLD }}>guiding intelligence</span> that steers you to your own victory.
            </h1>
          </div>
          <ScrollHint />
        </Scene>

        {/* S2 — hero */}
        <Scene id="lp-hero">
          <div data-reveal style={{ maxWidth: 820 }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(38px,6vw,76px)', lineHeight: 0.98, letterSpacing: '-.04em', marginBottom: 20 }}>
              Own your health.<br />Talk to it.<br />
              <span style={{ background: 'linear-gradient(100deg,#ffdeba,#f5b572 55%,#d97a45)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Watch yourself level up.</span>
            </h2>
            <p style={{ color: '#8e9ab8', fontSize: 'clamp(15px,1.6vw,18px)', maxWidth: 560, marginBottom: 26 }}>
              A private AI health OS with a living Twin, a personal Hermes coach, and a Health Vault you own forever.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 30 }}>
              <button className="btn primary" onClick={onStart} style={{ padding: '14px 24px' }}>Build your Twin</button>
              <a href="#roles" className="btn ghost" style={{ padding: '14px 22px', textDecoration: 'none' }}>See how it works</a>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Stat label="Readiness" value={84} suffix="▲" started={seen} />
              <Stat label="Level" value={62} started={seen} />
              <Stat label="Sleep" value={7.4} dec={1} suffix="h" started={seen} />
              <Stat label="HRV" value={68} suffix="ms" started={seen} />
            </div>
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

        {/* Moment — transformation / level up */}
        <Scene>
          <div data-reveal data-levelup style={{ textAlign: 'center', maxWidth: 720 }}>
            <Eyebrow>01 · transformation</Eyebrow>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(34px,5vw,64px)', letterSpacing: '-.03em' }}>
              Your future self,<br /><span style={{ color: GOLD }}>becoming visible.</span>
            </h2>
            <p style={{ color: '#8e9ab8', maxWidth: 520, margin: '14px auto 0' }}>Train, recover, log a meal — the Twin lights up, levels rise, and the muscle you worked grows. Progress you can see, not just numbers.</p>
          </div>
        </Scene>

        {/* Moment — privacy */}
        <Scene>
          <div data-reveal data-stage="4" style={{ textAlign: 'center', maxWidth: 720 }}>
            <Eyebrow>02 · privacy</Eyebrow>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(30px,4.4vw,56px)', letterSpacing: '-.03em' }}>Your data never leaves your control.</h2>
            <p style={{ color: '#8e9ab8', maxWidth: 520, margin: '14px auto 0' }}>On-device coaching. A Health Vault in open Markdown that's yours forever — export it any time, no lock-in.</p>
          </div>
        </Scene>

        {/* Final CTA */}
        <Scene>
          <div data-reveal style={{ textAlign: 'center' }}>
            <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(32px,5vw,60px)', letterSpacing: '-.03em', marginBottom: 8 }}>Meet your Twin.</h2>
            <p style={{ color: '#8e9ab8', marginBottom: 24 }}>Sixty seconds to set up. A lifetime that's yours.</p>
            <button className="btn primary" onClick={onStart} style={{ padding: '16px 30px', fontSize: 15 }}>Build your Twin</button>
            <div style={{ marginTop: 16 }}>
              <button onClick={onStart} style={{ background: 'none', border: 'none', color: '#8e9ab8', cursor: 'pointer', fontSize: 13 }}>I already have an account →</button>
            </div>
          </div>
        </Scene>
      </div>

      <style>{`@keyframes lpspin{to{transform:rotate(360deg)}} @keyframes lpfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}`}</style>
    </div>
  );
}

function Scene({ children, id }) {
  return (
    <section id={id} style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
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
