// Sarathi — the public pre-auth homepage. A pinned, scroll-scrubbed cinematic
// GuidedTour where the Divine Charioteer leads the visitor through each feature,
// wrapped in a condensing brand bar, scroll-progress rail, film grain, and footer.
// CTA → onStart() (sign up).
import { useState } from 'react';
import GuidedTour from './Tour3D.jsx';
import { useScrollProgress } from '../lib/motion.js';
import { LegalOverlay } from './Legal.jsx';

const footLink = { background: 'none', border: 'none', color: '#8e9ab8', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' };

export default function Landing({ onStart }) {
  const [legal, setLegal] = useState(null);
  const progress = useScrollProgress();
  const scrolled = progress > 0.015;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#04060a', color: '#f2f5fc' }}>
      {/* scroll-progress rail */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 60, pointerEvents: 'none' }}>
        <div style={{ height: '100%', width: `${(progress * 100).toFixed(2)}%`, background: 'linear-gradient(90deg,#ffdeba,#f5b572 60%,#d97a45)', boxShadow: '0 0 12px rgba(245,181,114,.6)', transition: 'width .08s linear' }} />
      </div>

      {/* film grain */}
      <div className="lp-grain" aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.42, mixBlendMode: 'overlay' }} />

      {/* brand bar — condenses + reveals a CTA on scroll */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: scrolled ? '12px 24px' : '20px 24px',
        background: scrolled ? 'rgba(4,6,10,0.62)' : 'transparent',
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

      {/* the centerpiece — character-led scroll tour */}
      <GuidedTour onStart={onStart} />

      {/* footer */}
      <footer style={{ position: 'relative', zIndex: 2, padding: '28px 24px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#59648a', fontSize: 12, background: '#04060a' }}>
        <div style={{ display: 'flex', gap: 18 }}>
          <button onClick={() => setLegal('privacy')} style={footLink}>Privacy</button>
          <button onClick={() => setLegal('terms')} style={footLink}>Terms</button>
        </div>
        <span>© {new Date().getFullYear()} Sarathi · Private AI Health OS</span>
      </footer>

      {legal && <LegalOverlay doc={legal} onClose={() => setLegal(null)} />}

      <style>{`
        .lp-grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")}
        .lp-cta{position:relative;overflow:hidden;transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease}
        .lp-cta::after{content:"";position:absolute;top:0;left:-130%;width:60%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);transition:left .6s ease}
        .lp-cta:hover{transform:translateY(-2px)}
        .lp-cta:hover::after{left:140%}
        .btn.primary.lp-cta:hover{box-shadow:0 10px 30px -8px rgba(245,181,114,.55)}
      `}</style>
    </div>
  );
}
