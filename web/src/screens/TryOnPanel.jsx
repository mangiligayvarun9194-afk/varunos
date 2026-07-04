// Try-On panel — the Twin's wardrobe. True-size fit verdicts for a small
// garment catalog, on today's body or the goal body. Mounted inside the Twin
// screen by the architect; fully self-contained, real data only.
//
//   GET  /v1/tryon/catalog  → { items: [{ id, name, kind, price_inr, sizes,
//                               today:{size, verdict}, goal:{size, verdict} }] }
//   POST /v1/tryon/intent     { item_id, size, mode }  → { ok: true }
//
// verdict ∈ 'true' | 'size_up' | 'size_down' | 'no_fit' | 'need_measurements'
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useToast, stagger, rise } from '../components/ui.jsx';

const GOLD = '#f5b572';
const TEAL = '#2ec4b6';
const LINE = 'rgba(151,168,205,0.12)';

/* ---- fit verdict → display text + tone ---- */
function fitLine(fit) {
  const v = fit?.verdict;
  if (!v || v === 'need_measurements')
    return { text: 'Needs measurements', color: 'var(--mute)', italic: true, wearable: false };
  if (v === 'no_fit')
    return { text: 'No fit', color: 'var(--mute)', italic: false, wearable: false };
  const size = fit.size || '—';
  if (v === 'true')
    return { text: `Size ${size} · true to size`, color: GOLD, italic: false, wearable: true };
  if (v === 'size_up')
    return { text: `Size ${size} · size up`, color: 'var(--amber)', italic: false, wearable: true };
  if (v === 'size_down')
    return { text: `Size ${size} · size down`, color: 'var(--amber)', italic: false, wearable: true };
  return { text: `Size ${size}`, color: 'var(--dim)', italic: false, wearable: true };
}

/* ---- garment silhouettes: elegant single-stroke line drawings ---- */
function KindGlyph({ kind }) {
  const paths = {
    tee: [
      'M16 10 L7 16 L11 23 L16 19.5 L16 40 L32 40 L32 19.5 L37 23 L41 16 L32 10',
      'M16 10 Q24 17 32 10',
    ],
    tank: [
      'M16 8 C16 17 13.5 23 13.5 40 L34.5 40 C34.5 23 32 17 32 8',
      'M16 8 Q24 19 32 8',
    ],
    hoodie: [
      'M16 13 L7 19 L11 26 L16 22 L16 41 L32 41 L32 22 L37 26 L41 19 L32 13',
      'M16 13 Q24 4 32 13 Q24 20 16 13',
      'M19 33 L29 33 L27.5 39 L20.5 39 Z',
    ],
    joggers: [
      'M15 7 L33 7 L35.5 40 L27.5 40 L24 19 L20.5 40 L12.5 40 Z',
      'M12.5 36.5 L20 36.5', 'M28 36.5 L35.5 36.5', 'M15 11 L33 11',
    ],
    shorts: [
      'M15 9 L33 9 L36.5 27 L26 27 L24 18.5 L22 27 L11.5 27 Z',
      'M15 13 L33 13',
    ],
  };
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"
      style={{ display: 'block', color: 'rgba(245,181,114,0.75)' }}>
      {(paths[kind] || paths.tee).map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" opacity={i === 0 ? 1 : 0.7} />
      ))}
    </svg>
  );
}

/* ---- loading skeleton: simple pulsing bars ---- */
function WardrobeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading wardrobe"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${LINE}`, borderRadius: 18, padding: 16 }}>
          <div className="skel" style={{ height: 74, borderRadius: 12 }} />
          <div className="skel" style={{ height: 14, width: '70%', marginTop: 12 }} />
          <div className="skel" style={{ height: 12, width: '45%', marginTop: 8 }} />
          <div className="skel" style={{ height: 34, borderRadius: 11, marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

export default function TryOnPanel() {
  const toast = useToast();
  const [cat, setCat] = useState(undefined);  // undefined=loading, null=error, {items}
  const [mode, setMode] = useState('today');  // 'today' | 'goal'
  const [noted, setNoted] = useState({});     // `${id}:${mode}` → true

  useEffect(() => {
    let on = true;
    api('/v1/tryon/catalog')
      .then((r) => { if (on) setCat(r && Array.isArray(r.items) ? r : { items: [] }); })
      .catch(() => { if (on) setCat(null); });
    return () => { on = false; };
  }, []);

  async function wear(item, fit) {
    const key = `${item.id}:${mode}`;
    if (noted[key]) return;
    setNoted((n) => ({ ...n, [key]: true }));           // optimistic
    toast('✓ Noted — the wardrobe remembers');
    try {
      await api('/v1/tryon/intent', { method: 'POST', body: { item_id: item.id, size: fit.size, mode } });
    } catch (_) {
      setNoted((n) => { const c = { ...n }; delete c[key]; return c; });
      toast('Couldn’t reach the wardrobe — try again');
    }
  }

  const items = cat && cat.items ? cat.items : [];
  const needsMeasurements = cat && items.length > 0 &&
    items.every((it) => (it[mode]?.verdict || 'need_measurements') === 'need_measurements');

  /* segmented Today / Goal-you toggle */
  const pill = (active, color) => ({
    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 15px',
    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
    fontFamily: 'var(--font-body)', transition: 'color 0.18s, background 0.18s',
    background: active ? `${color}26` : 'transparent',
    color: active ? color : 'var(--mute)',
    boxShadow: active ? `inset 0 0 0 1px ${color}55` : 'none',
  });

  return (
    <div>
      {/* header: eyebrow + mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '4px 0 14px' }}>
        <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, fontWeight: 500, color: GOLD,
          textTransform: 'uppercase', letterSpacing: '0.18em' }}>
          twin wardrobe · true-size try-on
        </div>
        <div role="tablist" aria-label="Fit mode" style={{ display: 'flex', gap: 4, padding: 3,
          background: 'rgba(8,10,16,0.7)', border: `1px solid ${LINE}`, borderRadius: 999 }}>
          <button role="tab" aria-selected={mode === 'today'} style={pill(mode === 'today', GOLD)} onClick={() => setMode('today')}>Today</button>
          <button role="tab" aria-selected={mode === 'goal'} style={pill(mode === 'goal', TEAL)} onClick={() => setMode('goal')}>Goal you</button>
        </div>
      </div>

      {/* loading / error / empty */}
      {cat === undefined && <WardrobeSkeleton />}
      {cat === null && (
        <div className="card" role="alert" style={{ textAlign: 'center', padding: '26px 20px', borderColor: 'rgba(251,113,133,0.3)' }}>
          <h3 className="display" style={{ fontSize: 15, fontWeight: 650, color: 'var(--red)', marginBottom: 4 }}>The wardrobe is offline — try again</h3>
          <p className="meta">Check your connection, or that the server supports try-on.</p>
        </div>
      )}
      {cat && items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '26px 20px', borderStyle: 'dashed' }}>
          <p className="meta">The wardrobe is empty for now — new garments are on the way.</p>
        </div>
      )}

      {/* friendly nudge when nothing can be sized yet */}
      {needsMeasurements && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'rgba(245,181,114,0.28)',
          background: 'rgba(8,10,16,0.7)' }}>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>
            <span style={{ color: GOLD, fontWeight: 700 }}>Almost there — </span>
            Enter your measurements in Settings to unlock true-size fit.
          </p>
        </div>
      )}

      {/* garment grid */}
      {cat && items.length > 0 && (
        <motion.div key={mode} variants={stagger} initial="hidden" animate="show"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
          {items.map((item) => {
            const fit = fitLine(item[mode]);
            const key = `${item.id}:${mode}`;
            const done = !!noted[key];
            const goalDiffers = mode === 'goal' && item.goal?.size && item.today?.size &&
              item.goal.size !== item.today.size && (item.goal.verdict !== 'no_fit') &&
              (item.goal.verdict !== 'need_measurements');
            return (
              <motion.div key={item.id} variants={rise}
                whileHover={{ y: -3, boxShadow: '0 18px 44px -18px rgba(0,0,0,0.85), 0 0 32px -16px rgba(245,181,114,0.45)' }}
                style={{ background: 'var(--surface)', border: `1px solid ${LINE}`, borderRadius: 18,
                  padding: 16, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* glyph block */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 84, borderRadius: 12, border: `1px solid ${LINE}`,
                  background: 'linear-gradient(160deg, rgba(245,181,114,0.08), rgba(8,10,16,0.7) 60%, rgba(46,196,182,0.05))' }}>
                  <KindGlyph kind={item.kind} />
                </div>
                {/* name + price */}
                <div>
                  <div className="display" style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em' }}>{item.name}</div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
                    ₹{Number(item.price_inr || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                {/* fit line + goal chip */}
                <div style={{ minHeight: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: fit.color,
                    fontStyle: fit.italic ? 'italic' : 'normal' }}>{fit.text}</span>
                  {goalDiffers && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: TEAL,
                      border: `1px solid ${TEAL}55`, background: `${TEAL}1a`,
                      borderRadius: 999, padding: '2px 9px', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                      → {item.goal.size} on goal-you
                    </span>
                  )}
                </div>
                {/* intent */}
                <motion.button whileTap={{ scale: 0.97 }}
                  disabled={!fit.wearable || done}
                  onClick={() => wear(item, item[mode])}
                  style={{
                    marginTop: 'auto', cursor: (!fit.wearable || done) ? 'not-allowed' : 'pointer',
                    borderRadius: 11, padding: '10px 12px', fontSize: 13, fontWeight: 650,
                    fontFamily: 'var(--font-body)', transition: 'filter 0.15s',
                    ...(done
                      ? { background: 'transparent', color: GOLD, border: `1px solid ${GOLD}55` }
                      : fit.wearable
                        ? { background: 'linear-gradient(150deg, var(--accent-hi), var(--accent) 55%, var(--accent-2))',
                            color: 'var(--accent-ink)', border: 'none',
                            boxShadow: '0 8px 26px -10px rgba(245,181,114,0.5)' }
                        : { background: 'transparent', color: 'var(--mute)', border: `1px solid ${LINE}`, opacity: 0.6 }),
                  }}>
                  {done ? 'Noted ✓' : 'I’d wear this'}
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
