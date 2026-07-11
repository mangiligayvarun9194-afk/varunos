// SarathiJourney (#journey) — the NRG "Build Your Data Center" experience,
// rebuilt mechanic-for-mechanic in Sarathi's world (their interactions, our brand,
// zero copied assets/copy):
//   preloader → Enter gate → ivory manifesto (scroll-highlighted lines) →
//   five dark phase chapters (sticky cinematic stage, letter-fill titles,
//   film captions, STEP callouts, labeled pins, completion flood, "Scroll to
//   Phase N" pill) interleaved with ivory PROOF sections (real product screens)
//   → explorable finale hotspot map → header tracker morphs into the CTA.
// Stage images are Varun-supplied slots (/journey/<id>-lack|gift.jpg) with a
// tinted master-portrait fallback so the route reviews today, swaps later.
// Motion: native scroll; every visual response is lerp-eased (liquid, a11y-safe).
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { PHASES, HOTSPOTS, MANIFESTO, GOLD, IVORY } from '../lib/journeydata.js';

const HERO = '/img/sarathi-master.webp';
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease3 = (t) => t * t * (3 - 2 * t);
const reducedQ = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Mouse({ c = '#211a10' }) {
  return <svg width="15" height="20" viewBox="0 0 15 20" fill="none" aria-hidden><rect x="1" y="1" width="13" height="18" rx="6.5" stroke={c} strokeWidth="1.6" /><line x1="7.5" y1="5" x2="7.5" y2="8.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

// ── header: brand · "what is sarathi?" tooltip · phase tracker → CTA morph ──
function Header({ phase, finale, onStart }) {
  const P = phase ? PHASES[phase - 1] : null;
  return (
    <header style={{ position: 'fixed', top: 16, left: 0, right: 0, zIndex: 90, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', pointerEvents: 'none' }}>
      <div className="jr-pill" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: '#f2f5fc' }}>सारथि</span>
        <span style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#8e9ab8' }}>Sarathi</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
        <div className="jr-what">
          <button className="jr-pill jr-whatbtn" aria-describedby="jr-what-tip">
            <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, background: GOLD, display: 'inline-grid', placeItems: 'center', color: '#1a0f06', fontSize: 10, fontWeight: 800 }}>?</span>
            What is Sarathi?
          </button>
          <div role="tooltip" id="jr-what-tip" className="jr-whattip">
            <b>सारथि · the charioteer.</b> A private AI health OS: five ancient powers — memory, motion, fuel, recovery, strength — rebuilt as one guide that grows with you.
          </div>
        </div>
        {finale ? (
          <button onClick={onStart} className="jr-cta" style={{ animation: 'jrIn .45s cubic-bezier(.22,1,.36,1) both' }}>
            Begin your Becoming <span aria-hidden>→</span>
          </button>
        ) : P ? (
          <div key={P.id} className="jr-pill" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 6px 6px', animation: 'jrIn .4s cubic-bezier(.22,1,.36,1) both' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: P.accent, color: '#0a0c12', fontWeight: 700, fontSize: 13, display: 'grid', placeItems: 'center', boxShadow: `0 0 14px ${P.accent}66` }}>{P.n}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f2f5fc', whiteSpace: 'nowrap' }}>{P.word} · {P.name}</span>
            <span style={{ display: 'flex', gap: 4, marginLeft: 2 }} aria-hidden>
              {PHASES.map((q) => (
                <span key={q.n} style={{ width: 5, height: 5, borderRadius: '50%', background: q.n < P.n ? GOLD : q.n === P.n ? P.accent : 'rgba(151,168,205,.3)', boxShadow: q.n === P.n ? `0 0 8px ${P.accent}` : 'none', transition: 'all .4s' }} />
              ))}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

// ── the enter gate: preloader → deliberate threshold ────────────────────────
function EnterGate({ onEnter }) {
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const urls = [HERO, ...PHASES.flatMap((p) => [p.img.lack, p.img.gift])];
    let done = 0, dead = false;
    const bump = () => { done += 1; if (!dead) setPct(Math.round((done / urls.length) * 100)); };
    urls.forEach((u) => { const im = new Image(); im.onload = bump; im.onerror = bump; im.src = u; });
    const min = setTimeout(() => setReady(true), 900);
    return () => { dead = true; clearTimeout(min); document.body.style.overflow = ''; };
  }, []);
  const go = () => { document.body.style.overflow = ''; onEnter(); };
  return (
    <div className="jr-gate" role="dialog" aria-label="Enter Sarathi">
      <div style={{ textAlign: 'center', maxWidth: 560, padding: 24 }}>
        <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', color: GOLD, marginBottom: 14 }}>सारथि · a journey in five powers</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2.2rem,6vw,3.6rem)', lineHeight: 1.05, color: '#f6f8ff' }}>The Five Gifts</div>
        <div style={{ margin: '26px auto 0', width: 220, height: 2, background: 'rgba(151,168,205,.2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(pct, ready ? 100 : pct)}%`, height: '100%', background: GOLD, transition: 'width .3s' }} />
        </div>
        <button onClick={go} disabled={!ready} className="jr-cta" style={{ marginTop: 30, opacity: ready ? 1 : 0.35, transition: 'opacity .4s' }}>
          Enter <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

// ── ivory manifesto: giant type, lines ignite as they cross center ──────────
function Manifesto() {
  const ref = useRef(null);
  useEffect(() => {
    const lines = ref.current ? [...ref.current.querySelectorAll('[data-line]')] : [];
    let raf;
    const loop = () => {
      const mid = window.innerHeight * 0.52;
      for (const el of lines) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        const k = 1 - clamp01(d / (window.innerHeight * 0.42));
        el.style.opacity = (0.22 + 0.78 * ease3(k)).toFixed(3);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <section ref={ref} style={{ background: IVORY.bg, color: IVORY.ink, padding: 'clamp(110px,16vh,180px) 24px clamp(80px,12vh,140px)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 data-line style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2.6rem,7.2vw,5.6rem)', lineHeight: 1.0, letterSpacing: '-.015em', margin: 0, textTransform: 'uppercase', textWrap: 'balance' }}>{MANIFESTO[0]}</h1>
        <div style={{ marginTop: 'clamp(48px,9vh,110px)', display: 'grid', gap: 18 }}>
          {MANIFESTO.slice(1).map((l, i) => (
            <p key={i} data-line style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'clamp(1.4rem,3.4vw,2.5rem)', lineHeight: 1.2, margin: 0, textWrap: 'balance' }}>{l}</p>
          ))}
        </div>
        <div style={{ marginTop: 'clamp(56px,10vh,120px)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: IVORY.ink2, marginBottom: 8 }}>begin the journey</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.5rem,3vw,2.1rem)' }}>See the five powers return, in five phases.</div>
          </div>
          <span className="jr-nextpill" style={{ marginLeft: 'auto' }}>
            <span className="jr-nextpill-ic" style={{ background: PHASES[0].accent }}><Mouse c="#0a0c12" /></span>
            Scroll to Phase 1 · आकाश
          </span>
        </div>
      </div>
    </section>
  );
}

// ── one dark phase chapter: sticky stage + all NRG mechanics ────────────────
function PhaseChapter({ P, next, onLive }) {
  const rootRef = useRef(null), lackRef = useRef(null), giftRef = useRef(null), floodRef = useRef(null),
    titleRef = useRef(null), fillRef = useRef(null), sumRef = useRef(null), hintRef = useRef(null),
    cap1Ref = useRef(null), cap2Ref = useRef(null), s1Ref = useRef(null), s2Ref = useRef(null),
    pinsRef = useRef(null), nextRef = useRef(null), dotsRef = useRef(null);
  const [imgOk, setImgOk] = useState({ lack: true, gift: true });

  useEffect(() => {
    let raf, pv = 0, live = false;
    const loop = () => {
      const el = rootRef.current; if (!el) { raf = requestAnimationFrame(loop); return; }
      const r = el.getBoundingClientRect(); const vh = window.innerHeight;
      if (r.bottom < -200 || r.top > vh + 200) { if (live) { live = false; onLive(P.n, false); } raf = requestAnimationFrame(loop); return; }
      const p = clamp01(-r.top / Math.max(1, r.height - vh));
      pv += (p - pv) * 0.16;                       // liquid easing — the "momentum" feel
      const nowLive = r.top < vh * 0.5 && r.bottom > vh * 0.5;
      if (nowLive !== live) { live = nowLive; onLive(P.n, nowLive); }
      const q = pv;
      // stage: lack → gift crossfade + slow cinematic drift, accent flood at the end
      const giftI = ease3(clamp01((q - 0.42) / 0.14));
      if (lackRef.current) {
        lackRef.current.style.opacity = (1 - giftI).toFixed(3);
        lackRef.current.style.transform = `scale(${(1.12 + q * 0.06).toFixed(4)}) translateY(${(-q * 2.2).toFixed(2)}%)`;
        lackRef.current.style.filter = `saturate(${(0.35 + giftI * 0.65).toFixed(2)}) brightness(${(0.62 + giftI * 0.38).toFixed(2)})`;
      }
      if (giftRef.current) {
        giftRef.current.style.opacity = giftI.toFixed(3);
        giftRef.current.style.transform = `scale(${(1.18 - giftI * 0.05 + q * 0.03).toFixed(4)}) translateY(${(-q * 2.2).toFixed(2)}%)`;
      }
      if (floodRef.current) floodRef.current.style.opacity = (ease3(clamp01((q - 0.88) / 0.1)) * 0.38).toFixed(3);
      // interstitial title: letter-fill 0→22%, retire by 30%
      const tOp = 1 - ease3(clamp01((q - 0.22) / 0.08));
      if (titleRef.current) { titleRef.current.style.opacity = tOp.toFixed(3); titleRef.current.style.pointerEvents = 'none'; }
      if (fillRef.current) fillRef.current.style.setProperty('--fill', `${Math.round(clamp01(q / 0.2) * 100)}%`);
      if (sumRef.current) sumRef.current.style.opacity = (tOp * ease3(clamp01((q - 0.02) / 0.06))).toFixed(3);
      if (hintRef.current) hintRef.current.style.opacity = (q < 0.24 ? 1 : 0).toString();
      // film captions: one line at a time
      if (cap1Ref.current) cap1Ref.current.style.opacity = (ease3(clamp01((q - 0.28) / 0.06)) * (1 - ease3(clamp01((q - 0.5) / 0.06)))).toFixed(3);
      if (cap2Ref.current) cap2Ref.current.style.opacity = (ease3(clamp01((q - 0.56) / 0.06)) * (1 - ease3(clamp01((q - 0.86) / 0.06)))).toFixed(3);
      // STEP callouts (NRG's numbered steps, bottom-right)
      const st1 = ease3(clamp01((q - 0.3) / 0.06)) * (1 - ease3(clamp01((q - 0.52) / 0.06)));
      const st2 = ease3(clamp01((q - 0.58) / 0.06)) * (1 - ease3(clamp01((q - 0.88) / 0.06)));
      if (s1Ref.current) s1Ref.current.style.opacity = st1.toFixed(3);
      if (s2Ref.current) s2Ref.current.style.opacity = st2.toFixed(3);
      if (dotsRef.current) {
        const kids = dotsRef.current.children;
        if (kids[0]) kids[0].style.background = st1 > 0.4 ? P.accent : 'rgba(151,168,205,.35)';
        if (kids[1]) kids[1].style.background = st2 > 0.4 ? P.accent : 'rgba(151,168,205,.35)';
      }
      // pins pop with the gift; retire before handoff
      if (pinsRef.current) pinsRef.current.classList.toggle('jr-pins-on', q > 0.55 && q < 0.92);
      // the named forward pull
      if (nextRef.current) nextRef.current.style.opacity = (q > 0.9 ? 1 : 0).toString();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); onLive(P.n, false); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stageImg = (kind, ref) => (
    <img ref={ref} src={imgOk[kind] ? P.img[kind] : HERO} alt=""
      onError={() => setImgOk((s) => ({ ...s, [kind]: false }))}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', willChange: 'transform,opacity' }} />
  );

  return (
    <section ref={rootRef} aria-label={`Phase ${P.n}: ${P.name}`} style={{ position: 'relative', height: '340vh', background: '#05070c' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        {/* the stage */}
        {stageImg('lack', lackRef)}
        {stageImg('gift', giftRef)}
        {/* fallback tint so master-portrait placeholders still read as this element's world */}
        {(!imgOk.lack || !imgOk.gift) && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(80% 60% at ${P.glow.x}% ${P.glow.y}%, ${P.accent}2e, transparent 70%)`, mixBlendMode: 'screen' }} />
        )}
        <div ref={floodRef} aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 100% at 50% 50%, ${P.accent}66, ${P.accent}22 60%, transparent 100%)`, opacity: 0, mixBlendMode: 'screen' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(3,4,6,.55), transparent 22%, transparent 60%, rgba(3,4,6,.72))' }} />

        {/* interstitial title — letter-fill like NRG's CONSTRUCTION */}
        <div ref={titleRef} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(20px,6vw,90px)' }}>
          <span style={{ alignSelf: 'flex-start', fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: '#dfe5f2', border: '1px solid rgba(242,245,252,.4)', borderRadius: 999, padding: '4px 12px', marginBottom: 18 }}>Phase {P.n}</span>
          <div ref={fillRef} className="jr-filltitle" style={{ '--acc': P.accent }}>
            <span aria-hidden>{P.title}</span>
            <span className="jr-filltitle-top">{P.title}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem,3.4vw,2.4rem)', fontWeight: 600, color: '#f6f8ff', marginTop: 6 }}>{P.word} · the {P.name.toLowerCase()}</div>
          <p ref={sumRef} style={{ maxWidth: 520, marginLeft: 'auto', marginTop: 'clamp(18px,6vh,54px)', fontSize: 'clamp(16px,1.6vw,21px)', lineHeight: 1.5, fontWeight: 600, color: '#eef1fa' }}>{P.summary}</p>
        </div>
        <div ref={hintRef} style={{ position: 'absolute', left: 24, bottom: 22, display: 'flex', alignItems: 'center', gap: 8, color: '#aab4cc', fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', transition: 'opacity .5s' }}>
          <Mouse c="#aab4cc" /> scroll to explore
        </div>

        {/* film captions */}
        <div ref={cap1Ref} className="jr-cap">{P.lackCap}</div>
        <div ref={cap2Ref} className="jr-cap" style={{ color: '#fff' }}>{P.giftCap}</div>

        {/* STEP callouts */}
        <div ref={s1Ref} className="jr-step"><span style={{ color: P.accent }}>✦ step 01</span><p>{P.steps[0].t}</p></div>
        <div ref={s2Ref} className="jr-step"><span style={{ color: P.accent }}>✦ step 02</span><p>{P.steps[1].t}</p></div>
        <div ref={dotsRef} aria-hidden style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ width: 5, height: 18, borderRadius: 3, background: 'rgba(151,168,205,.35)', transition: 'background .4s' }} />
          <span style={{ width: 5, height: 18, borderRadius: 3, background: 'rgba(151,168,205,.35)', transition: 'background .4s' }} />
        </div>

        {/* labeled pins */}
        <div ref={pinsRef} aria-hidden className="jr-pins">
          {P.pins.map((pin, i) => (
            <div key={i} className="jr-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%`, '--d': `${0.1 + i * 0.2}s` }}>
              <span className="jr-pindot" style={{ background: P.accent, boxShadow: `0 0 12px ${P.accent}` }} />
              <span className="jr-pinlabel">{pin.t}</span>
            </div>
          ))}
        </div>

        {/* the named forward pull */}
        <div ref={nextRef} style={{ position: 'absolute', right: 22, bottom: 22, opacity: 0, transition: 'opacity .45s' }}>
          <span className="jr-nextpill">
            <span className="jr-nextpill-ic" style={{ background: next ? next.accent : GOLD }}><Mouse c="#0a0c12" /></span>
            {next ? `Scroll to Phase ${next.n} · ${next.word}` : 'Scroll to the Awakening'}
          </span>
        </div>
      </div>
    </section>
  );
}

// ── ivory proof section: the myth condenses into the real product ───────────
function ProofSection({ pr, accent, onStart }) {
  const [shotOk, setShotOk] = useState(true);
  return (
    <section className="jr-reveal" style={{ background: IVORY.bg, color: IVORY.ink, padding: 'clamp(70px,10vh,120px) 24px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(280px,1fr)', gap: 'clamp(28px,5vw,64px)', alignItems: 'center' }} className="jr-proofgrid">
        <div>
          <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: accent, filter: 'brightness(.62) saturate(1.4)', marginBottom: 12 }}>{pr.k}</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.7rem,3.6vw,2.7rem)', lineHeight: 1.06, margin: '0 0 14px', textWrap: 'balance' }}>{pr.title}</h2>
          <p style={{ fontSize: 'clamp(15px,1.4vw,17px)', lineHeight: 1.65, color: IVORY.ink2, margin: '0 0 18px', maxWidth: '52ch' }}>{pr.body}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {pr.chips.map((c) => (
              <span key={c} style={{ fontSize: 12.5, fontWeight: 600, border: `1px solid ${IVORY.line}`, borderRadius: 999, padding: '5px 13px', color: IVORY.ink }}>{c}</span>
            ))}
          </div>
          <button onClick={onStart} className="jr-ghostcta">Open Sarathi <span aria-hidden>→</span></button>
        </div>
        <div style={{ background: IVORY.bg2, border: `1px solid ${IVORY.line}`, borderRadius: 14, padding: 12, boxShadow: '0 30px 60px -30px rgba(33,26,16,.35)' }}>
          {shotOk ? (
            <img src={pr.shot} alt={pr.shotAlt} onError={() => setShotOk(false)}
              style={{ display: 'block', width: '100%', borderRadius: 8, border: `1px solid ${IVORY.line}` }} />
          ) : (
            <div style={{ aspectRatio: '4/3', display: 'grid', placeItems: 'center', borderRadius: 8, border: `1.5px dashed ${accent}88`, color: IVORY.ink2, fontSize: 13, textAlign: 'center', padding: 20 }}>
              live product screen — being captured
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── finale: explorable hotspot map + CTA ────────────────────────────────────
function Finale({ onLive, onStart }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => onLive(e.isIntersecting), { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section ref={ref} style={{ position: 'relative', background: '#05070c', minHeight: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '110px 20px 90px' }}>
      <img src={HERO} alt="The awakened charioteer" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 60% at 50% 42%, transparent 30%, rgba(3,4,6,.72) 100%)' }} />
      <div style={{ position: 'absolute', top: 'clamp(84px,12vh,130px)', left: 0, right: 0, textAlign: 'center', padding: '0 20px' }}>
        <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '.26em', textTransform: 'uppercase', color: GOLD, marginBottom: 10 }}>take the tour</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2rem,6vw,4.4rem)', lineHeight: 1, color: '#f6f8ff', margin: 0, textTransform: 'uppercase', textWrap: 'balance' }}>Explore your charioteer</h2>
        <p style={{ color: '#c7cfe2', fontSize: 'clamp(14px,1.4vw,17px)', marginTop: 12 }}>All five powers, awake in one body. Touch any light.</p>
      </div>
      {HOTSPOTS.map((h, i) => (
        <button key={i} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
          style={{ position: 'absolute', left: `${h.x}%`, top: `${h.y}%`, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(10,12,18,.6)', border: `1px solid ${h.accent}66`, borderRadius: 999, padding: '7px 14px 7px 8px', cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: h.accent, boxShadow: `0 0 14px ${h.accent}` }} className="jr-hotdot" />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#eef1fa', whiteSpace: 'nowrap' }}>{h.t}</span>
        </button>
      ))}
      {open != null && (
        <div role="dialog" aria-label={HOTSPOTS[open].t} style={{ position: 'absolute', left: '50%', bottom: 'clamp(24px,6vh,56px)', transform: 'translateX(-50%)', width: 'min(460px,92vw)', background: 'rgba(8,10,16,.92)', border: `1px solid ${HOTSPOTS[open].accent}55`, borderLeft: `3px solid ${HOTSPOTS[open].accent}`, borderRadius: 10, padding: '18px 20px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', animation: 'jrIn .35s cubic-bezier(.22,1,.36,1) both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <b style={{ color: '#f6f8ff', fontSize: 15 }}>{HOTSPOTS[open].t}</b>
            <button onClick={() => setOpen(null)} aria-label="Close" style={{ background: 'none', border: 'none', color: '#8e9ab8', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
          </div>
          <p style={{ margin: '8px 0 0', color: '#c7cfe2', fontSize: 14, lineHeight: 1.55 }}>{HOTSPOTS[open].d}</p>
        </div>
      )}
    </section>
  );
}

// ── the journey ─────────────────────────────────────────────────────────────
export default function SarathiJourney({ onStart }) {
  const rm = useReducedMotion() || reducedQ();
  const [entered, setEntered] = useState(rm);
  const [phase, setPhase] = useState(0);          // 0 = none, 1..5 live phase
  const [finale, setFinale] = useState(false);
  const liveSet = useRef(new Set());
  const onLive = (n, is) => {
    if (is) liveSet.current.add(n); else liveSet.current.delete(n);
    const top = liveSet.current.size ? Math.max(...liveSet.current) : 0;
    setPhase((v) => (v === top ? v : top));
  };

  // reveal-on-scroll for ivory sections
  useEffect(() => {
    if (rm) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('jr-reveal-on')), { threshold: 0.18 });
    document.querySelectorAll('.jr-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rm]);

  if (rm) {
    return (
      <div style={{ background: '#04060a', minHeight: '100vh', color: '#e8ecf7' }}>
        <Header phase={0} finale={false} onStart={onStart} />
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px 80px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)' }}>The Five Gifts</h1>
          {MANIFESTO.map((l) => <p key={l} style={{ color: '#aab4cc' }}>{l}</p>)}
          {PHASES.map((P) => (
            <section key={P.id} style={{ margin: '48px 0' }}>
              <h2 style={{ color: P.accent, fontFamily: 'var(--font-display)' }}>Phase {P.n} · {P.word} — {P.name}</h2>
              <p style={{ color: '#aab4cc' }}>{P.summary}</p>
              <p style={{ fontStyle: 'italic', color: '#8e9ab8' }}>{P.lackCap} {P.giftCap}</p>
              <p style={{ color: '#aab4cc' }}><b style={{ color: '#e8ecf7' }}>{P.proof.title}</b> {P.proof.body}</p>
            </section>
          ))}
          <button onClick={onStart} className="jr-cta">Begin your Becoming →</button>
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div style={{ background: '#05070c' }}>
      {!entered && <EnterGate onEnter={() => setEntered(true)} />}
      <Header phase={phase} finale={finale} onStart={onStart} />
      <Manifesto />
      {PHASES.map((P, i) => (
        <div key={P.id}>
          <PhaseChapter P={P} next={PHASES[i + 1] || null} onLive={onLive} />
          <ProofSection pr={P.proof} accent={P.accent} onStart={onStart} />
        </div>
      ))}
      <Finale onLive={setFinale} onStart={onStart} />
      <footer style={{ padding: '26px 24px 38px', textAlign: 'center', color: '#59648a', fontSize: 12, background: '#04060a' }}>
        © {new Date().getFullYear()} Sarathi · Private AI Health OS · सारथि — <em>yatra yogeśvaraḥ, tatra vijayaḥ</em>
      </footer>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .jr-pill{background:rgba(12,15,23,.62);border:1px solid rgba(151,168,205,.16);border-radius:999px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
  .jr-cta{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body);font-size:14px;font-weight:600;color:#1a0f06;background:${GOLD};border:none;border-radius:999px;padding:12px 22px;cursor:pointer;box-shadow:0 10px 30px -10px rgba(245,181,114,.55);transition:transform .2s}
  .jr-cta:hover{transform:translateY(-1px)}
  .jr-ghostcta{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-body);font-size:14px;font-weight:600;color:${IVORY.ink};background:none;border:1.5px solid ${IVORY.ink};border-radius:999px;padding:10px 20px;cursor:pointer;transition:all .2s}
  .jr-ghostcta:hover{background:${IVORY.ink};color:${IVORY.bg}}
  .jr-gate{position:fixed;inset:0;z-index:200;background:#04060a;display:flex;align-items:center;justify-content:center}
  .jr-what{position:relative}
  .jr-whatbtn{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body);font-size:12.5px;font-weight:600;color:#e8ecf7;padding:9px 14px;cursor:pointer}
  .jr-whattip{position:absolute;top:calc(100% + 10px);right:0;width:300px;background:rgba(8,10,16,.95);border:1px solid rgba(245,181,114,.4);border-radius:10px;padding:13px 15px;font-size:12.5px;line-height:1.55;color:#c7cfe2;opacity:0;transform:translateY(-4px);pointer-events:none;transition:all .25s}
  .jr-whattip b{color:#f5b572}
  .jr-what:hover .jr-whattip,.jr-what:focus-within .jr-whattip{opacity:1;transform:none}
  .jr-filltitle{position:relative;font-family:var(--font-display);font-weight:700;font-size:clamp(3.4rem,13vw,10.5rem);line-height:.94;letter-spacing:-.01em;text-transform:uppercase;color:rgba(242,245,252,.28)}
  .jr-filltitle-top{position:absolute;inset:0;color:var(--acc);clip-path:inset(0 calc(100% - var(--fill,0%)) 0 0);transition:clip-path .1s linear}
  .jr-cap{position:absolute;left:clamp(20px,6vw,90px);bottom:clamp(88px,16vh,150px);max-width:26ch;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:clamp(1.4rem,3.2vw,2.5rem);line-height:1.25;color:#eef1fa;text-shadow:0 2px 30px rgba(0,0,0,.7);opacity:0}
  .jr-step{position:absolute;right:clamp(20px,5vw,72px);bottom:clamp(88px,16vh,150px);width:min(360px,72vw);opacity:0;text-align:left}
  .jr-step span{display:block;font-family:var(--font-eyebrow);font-size:10px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px}
  .jr-step p{margin:0;font-family:var(--font-display);font-weight:600;font-size:clamp(1.05rem,1.9vw,1.5rem);line-height:1.3;color:#f6f8ff;text-shadow:0 2px 24px rgba(0,0,0,.65)}
  .jr-pins{position:absolute;inset:0;pointer-events:none}
  .jr-pins .jr-pin{position:absolute;display:flex;align-items:center;gap:8px;opacity:0}
  .jr-pins.jr-pins-on .jr-pin{animation:jrPin .55s cubic-bezier(.22,1,.36,1) forwards;animation-delay:var(--d)}
  .jr-pindot{width:9px;height:9px;border-radius:50%;flex:none}
  .jr-pinlabel{font-family:var(--font-body);font-size:11.5px;font-weight:600;color:#eef1fa;background:rgba(10,12,18,.6);border:1px solid rgba(151,168,205,.24);padding:5px 12px;border-radius:999px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);white-space:nowrap}
  .jr-nextpill{display:inline-flex;align-items:center;gap:12px;background:${IVORY.bg};color:${IVORY.ink};font-family:var(--font-body);font-size:14.5px;font-weight:700;border-radius:999px;padding:9px 22px 9px 9px;box-shadow:0 16px 40px -14px rgba(0,0,0,.6)}
  .jr-nextpill-ic{width:38px;height:38px;border-radius:50%;display:grid;place-items:center}
  .jr-hotdot{animation:jrPulse 2.2s ease-in-out infinite}
  .jr-reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
  .jr-reveal-on{opacity:1;transform:none}
  @keyframes jrIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes jrPin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes jrPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
  @media (max-width:820px){
    .jr-proofgrid{grid-template-columns:1fr !important}
    .jr-cap{bottom:clamp(120px,20vh,190px)}
    .jr-step{right:20px;bottom:36px;width:min(320px,80vw)}
    .jr-whatbtn{display:none}
  }
  @media (prefers-reduced-motion:reduce){.jr-reveal{opacity:1;transform:none}}
`;
